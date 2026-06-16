/**
 * Real-time token streamer.
 *
 * Wraps an OpenAI-format SSE stream produced by the inference gateway
 * and posts a Token-2022 micro-payment for every accumulated batch of
 * output tokens. The debit is computed against the pricing captured at
 * stream open time so a mid-stream price change on the model registry
 * has no effect on an in-flight session.
 */

import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { buildTransferWithHookIx, deriveStreamPda } from "./transferHook.js";
import type {
  StreamChunk,
  StreamContext,
  StreamMeter,
  StreamMicroPayment,
  StreamSettlementReceipt,
} from "./types.js";

/**
 * Options controlling how often the streamer flushes accumulated tokens
 * to an on-chain micro-payment.
 */
export interface StreamerOptions {
  /** Flush every N accumulated output tokens. Default: 16. */
  batchTokens?: number;
  /** Or after `batchIntervalMillis` since the last flush. Default: 1200. */
  batchIntervalMillis?: number;
  /** Wattz Anchor program id. */
  wattzProgramId: PublicKey;
  /** Node treasury token account (destination of the transfer). */
  nodeTreasury: PublicKey;
  /** Node keypair authorised to settle the stream on the payer's behalf. */
  streamAuthority: Keypair;
  /** Payment mint decimals (defaults to 6, consistent with USDC). */
  mintDecimals?: number;
}

export interface FlushResult extends StreamMicroPayment {}

/**
 * Chunk source -- an async iterable of `StreamChunk` produced by whatever
 * gateway proxy the caller is running. The streamer is deliberately
 * transport-agnostic so it can be plugged into an axum SSE proxy, a
 * WebSocket bridge, or a raw HTTP2 stream.
 */
export type ChunkSource = AsyncIterable<StreamChunk>;

/**
 * Consume a chunk source, debiting the payer with micro-payments as
 * tokens accumulate. Every emitted chunk is yielded to the caller so it
 * can be forwarded to the end-user with no perceptible latency added by
 * the payment path.
 *
 * The returned async generator yields `{ chunk, payment? }` pairs where
 * `payment` is populated on the exact chunk boundary at which the
 * streamer flushed a micro-payment.
 */
export async function* streamWithPayments(
  connection: Connection,
  ctx: StreamContext,
  source: ChunkSource,
  options: StreamerOptions,
): AsyncGenerator<
  { chunk: StreamChunk; payment: FlushResult | null },
  StreamSettlementReceipt,
  void
> {
  const batchTokens = options.batchTokens ?? 16;
  const batchIntervalMillis = options.batchIntervalMillis ?? 1200;
  const decimals = options.mintDecimals ?? 6;

  const meter: StreamMeter = {
    inputTokens: 0,
    outputTokens: 0,
    debitedMicros: 0n,
    transferCount: 0,
  };
  const microPayments: StreamMicroPayment[] = [];
  let pendingOutputTokens = 0;
  let lastFlushMillis = ctx.openedAt;

  // Charge the session fee up-front if configured. Runs synchronously
  // before any tokens flow.
  if (ctx.pricing.sessionMicros > 0n) {
    const payment = await flush(
      connection,
      ctx,
      options,
      decimals,
      meter,
      0,
      ctx.pricing.sessionMicros,
      Date.now(),
      microPayments.length,
    );
    microPayments.push(payment);
  }

  for await (const chunk of source) {
    pendingOutputTokens += chunk.outputTokens;
    meter.outputTokens += chunk.outputTokens;

    const now = Date.now();
    const shouldFlush =
      chunk.done ||
      pendingOutputTokens >= batchTokens ||
      now - lastFlushMillis >= batchIntervalMillis;

    let payment: StreamMicroPayment | null = null;
    if (shouldFlush && (pendingOutputTokens > 0 || chunk.done)) {
      const debit = BigInt(pendingOutputTokens) * ctx.pricing.outputMicros;
      if (debit > 0n) {
        payment = await flush(
          connection,
          ctx,
          options,
          decimals,
          meter,
          pendingOutputTokens,
          debit,
          now,
          microPayments.length,
        );
        microPayments.push(payment);
      }
      pendingOutputTokens = 0;
      lastFlushMillis = now;
    }
    yield { chunk, payment };
    if (chunk.done) break;
  }

  return {
    streamId: ctx.streamId,
    requestId: ctx.requestId,
    payer: ctx.payer,
    node: ctx.node,
    mint: ctx.mint,
    model: ctx.model,
    openedAt: ctx.openedAt,
    closedAt: Date.now(),
    meter,
    microPayments,
  };
}

async function flush(
  connection: Connection,
  ctx: StreamContext,
  options: StreamerOptions,
  decimals: number,
  meter: StreamMeter,
  tokensDelta: number,
  debitMicros: bigint,
  now: number,
  seq: number,
): Promise<StreamMicroPayment> {
  const source = getAssociatedTokenAddressSync(
    ctx.mint,
    ctx.payer,
    true,
    TOKEN_2022_PROGRAM_ID,
  );
  const [streamPda] = deriveStreamPda(options.wattzProgramId, ctx.streamId);
  const ix = buildTransferWithHookIx({
    source,
    mint: ctx.mint,
    destination: options.nodeTreasury,
    authority: options.streamAuthority.publicKey,
    amount: debitMicros,
    decimals,
    wattzProgram: options.wattzProgramId,
    streamPda,
  });
  const tx = new Transaction().add(ix);
  tx.feePayer = options.streamAuthority.publicKey;
  const payment: StreamMicroPayment = {
    streamId: ctx.streamId,
    seq,
    outputTokensDelta: tokensDelta,
    debitMicros,
    timestampMillis: now,
    signature: null,
  };
  try {
    const sig = await sendAndConfirmTransaction(
      connection,
      tx,
      [options.streamAuthority],
      { commitment: "confirmed" },
    );
    payment.signature = sig;
    meter.transferCount += 1;
    meter.debitedMicros += debitMicros;
  } catch (err) {
    // Payment failed. The gateway keeps streaming (bounded loss) and
    // will replay this transfer during settlement close via the Anchor
    // dispute path. This is the correct behaviour: the alternative -
    // stalling the SSE stream on RPC failure - degrades UX.
    payment.signature = null;
    throw new StreamingPaymentError(
      `micro-payment (seq=${seq}) failed`,
      payment,
      err instanceof Error ? err : undefined,
    );
  }
  return payment;
}

/**
 * Thrown when a micro-payment cannot be posted. The caller is expected
 * to convert this into a stream-level error frame and continue with
 * settlement replay via the Anchor dispute path.
 */
export class StreamingPaymentError extends Error {
  constructor(
    message: string,
    public readonly payment: StreamMicroPayment,
    cause?: Error,
  ) {
    super(message, { cause });
    this.name = "StreamingPaymentError";
  }
}

/**
 * Types shared across the streaming-payment package.
 */

import type { PublicKey } from "@solana/web3.js";

/** Per-model pricing captured at the moment the stream opens. */
export interface StreamPricing {
  /** Micro-lamports of the payment mint charged per input token. */
  inputMicros: bigint;
  /** Micro-lamports of the payment mint charged per output token. */
  outputMicros: bigint;
  /** Fixed session fee charged at open. */
  sessionMicros: bigint;
}

export interface StreamContext {
  readonly streamId: string;
  readonly payer: PublicKey;
  readonly node: PublicKey;
  readonly mint: PublicKey;
  readonly pricing: StreamPricing;
  /** Opaque request identifier the inference gateway supplied. */
  readonly requestId: string;
  /** Model identifier -- copied into the settlement receipt. */
  readonly model: string;
  /** Monotonic timestamp (unix millis) that the stream opened. */
  readonly openedAt: number;
}

/**
 * A single delta emitted by the underlying backend. The streamer converts
 * every chunk into an on-chain micro-payment before forwarding the raw
 * OpenAI-format chunk to the client.
 */
export interface StreamChunk {
  /** Bytes of the SSE frame, exactly as the backend produced them. */
  readonly bytes: Uint8Array;
  /** Number of tokens attributed to this chunk. */
  readonly outputTokens: number;
  /** Whether this is the terminal `[DONE]` chunk. */
  readonly done: boolean;
}

export interface StreamMeter {
  /** Accumulated input token count charged at open. */
  inputTokens: number;
  /** Accumulated output tokens streamed so far. */
  outputTokens: number;
  /** Accumulated debit in micro-lamports of the payment mint. */
  debitedMicros: bigint;
  /** Number of on-chain transfer_hook micro-transactions posted. */
  transferCount: number;
}

/** A single micro-payment posted by the streamer. */
export interface StreamMicroPayment {
  readonly streamId: string;
  readonly seq: number;
  readonly outputTokensDelta: number;
  readonly debitMicros: bigint;
  readonly timestampMillis: number;
  /** Base58 tx signature when the transaction lands, `null` while pending. */
  signature: string | null;
}

/** Terminal receipt handed off to the settlement module of the gateway. */
export interface StreamSettlementReceipt {
  readonly streamId: string;
  readonly requestId: string;
  readonly payer: PublicKey;
  readonly node: PublicKey;
  readonly mint: PublicKey;
  readonly model: string;
  readonly openedAt: number;
  readonly closedAt: number;
  readonly meter: StreamMeter;
  readonly microPayments: readonly StreamMicroPayment[];
}

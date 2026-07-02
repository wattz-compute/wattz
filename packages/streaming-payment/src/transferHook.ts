/**
 * Token-2022 transfer hook helpers.
 *
 * Wattz uses a Token-2022 mint whose `TransferHook` extension points at
 * the Wattz Anchor program. Every micro-payment triggers a
 * `transferChecked` instruction; the transfer hook is invoked as a CPI
 * and records the micro-payment into a per-stream PDA that the Wattz
 * settlement module later reconciles.
 *
 * This module encodes the client-side pieces:
 *
 *  - `transferHookExtraAccounts` -- builds the additional
 *    `AccountMeta`s that Token-2022 forwards to the hook (per SPL Token
 *    2022 transfer_hook interface).
 *  - `buildTransferWithHookIx` -- convenience wrapper around
 *    `createTransferCheckedInstruction` that packs the extra accounts.
 *  - `deriveStreamPda` -- computes the deterministic PDA of a stream.
 */

import { createHash } from "node:crypto";
import {
  createTransferCheckedInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";

/** Seed prefix used by the Wattz Anchor program for stream PDAs. */
export const STREAM_PDA_SEED = new TextEncoder().encode("wattz-stream");

/**
 * Hash a stream id down to a fixed 32-byte seed.
 *
 * Stream ids are UUIDv4 strings, which are 36 bytes as UTF-8 (including
 * hyphens) and therefore exceed the 32-byte per-seed limit that
 * `findProgramAddressSync` enforces. SHA-256 collapses any id to a stable
 * 32-byte seed; the on-chain hook program hashes the id the same way when
 * it re-derives the PDA.
 */
export function streamIdSeed(streamId: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(streamId, "utf8").digest());
}

/**
 * Derive the `(streamPda, bump)` for a given stream id.
 *
 * @param programId Wattz Anchor program id.
 * @param streamId  UUID assigned by the gateway when the SSE session opens.
 */
export function deriveStreamPda(
  programId: PublicKey,
  streamId: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STREAM_PDA_SEED, streamIdSeed(streamId)],
    programId,
  );
}

/**
 * Assemble the extra `AccountMeta`s appended to a Token-2022
 * `transferChecked` so the transfer hook can settle the stream.
 *
 * Under the SPL Transfer Hook interface the mint's `TransferHook`
 * extension names the hook program, and the hook program owns an
 * `ExtraAccountMetaList` PDA (seeds `['extra-account-metas', mint]`) that
 * declares the additional accounts every transfer must carry. For a Wattz
 * stream that extra account is the per-stream PDA. Token-2022 reads the
 * list and CPIs into the hook with `source / mint / destination / owner`
 * plus the declared extras.
 *
 * At launch, callers build the transfer with
 * `createTransferCheckedWithTransferHookInstruction` from
 * `@solana/spl-token`, which fetches the `ExtraAccountMetaList` and
 * resolves these accounts automatically. This helper is the explicit
 * form used by the design and test path: it appends the stream PDA and
 * the hook program id that Token-2022 needs present in the outer
 * instruction's account list.
 */
export function transferHookExtraAccounts(
  streamPda: PublicKey,
  wattzProgram: PublicKey,
): AccountMeta[] {
  return [
    { pubkey: streamPda, isSigner: false, isWritable: true },
    { pubkey: wattzProgram, isSigner: false, isWritable: false },
  ];
}

export interface HookedTransferParams {
  source: PublicKey;
  mint: PublicKey;
  destination: PublicKey;
  authority: PublicKey;
  amount: bigint;
  decimals: number;
  wattzProgram: PublicKey;
  streamPda: PublicKey;
}

/**
 * Build a `transferChecked` instruction targeting a Token-2022 mint that
 * carries a Wattz transfer hook. The additional keys required by the
 * hook are appended per the SPL Transfer Hook Interface.
 */
export function buildTransferWithHookIx(
  params: HookedTransferParams,
): TransactionInstruction {
  const base = createTransferCheckedInstruction(
    params.source,
    params.mint,
    params.destination,
    params.authority,
    params.amount,
    params.decimals,
    [],
    TOKEN_2022_PROGRAM_ID,
  );
  const extras = transferHookExtraAccounts(params.streamPda, params.wattzProgram);
  return new TransactionInstruction({
    keys: [...base.keys, ...extras],
    programId: base.programId,
    data: base.data,
  });
}

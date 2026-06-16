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
 *  - `createTransferHookExtraAccountsIx` -- builds the additional
 *    `AccountMeta`s that Token-2022 forwards to the hook (per SPL Token
 *    2022 transfer_hook interface).
 *  - `buildTransferWithHookIx` -- convenience wrapper around
 *    `createTransferCheckedInstruction` that packs the extra accounts.
 *  - `deriveStreamPda` -- computes the deterministic PDA of a stream.
 */

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
    [STREAM_PDA_SEED, new TextEncoder().encode(streamId)],
    programId,
  );
}

/**
 * Assemble the extra `AccountMeta`s that the Token-2022 transfer hook
 * expects to receive. The account order is fixed by the
 * `spl-transfer-hook-interface` specification:
 *
 *   [0] source token account (writable)
 *   [1] mint (readonly)
 *   [2] destination token account (writable)
 *   [3] authority (signer)
 *   [4] wattz stream PDA (writable, owned by the Wattz program)
 *   [5] wattz program id (readonly, program)
 *
 * The final two entries are the "extra accounts" the hook needs; the
 * first four repeat the accounts already supplied by
 * `transferChecked` and Token-2022 fills them in automatically. They
 * are listed here as documentation only.
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

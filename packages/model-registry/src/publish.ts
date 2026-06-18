/**
 * Publish a model entry to the on-chain Wattz Model Registry PDA.
 *
 * The Anchor program's IDL is the source of truth for the instruction
 * layout; this module wraps the two most common flows -- register a new
 * model and update pricing / SVN -- as ergonomic TypeScript helpers.
 */

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import type { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { PublicKey as SolanaPublicKey } from "@solana/web3.js";
import type { ModelEntry } from "./schema.js";
import { ModelEntry as ModelEntrySchema } from "./schema.js";

interface AnchorMethodBuilder {
  accounts: (a: Record<string, PublicKey>) => AnchorMethodBuilder;
  signers: (s: Keypair[]) => AnchorMethodBuilder;
  rpc: () => Promise<string>;
}

/** Seed used by the Wattz Anchor program for the ModelEntry PDA. */
export const MODEL_ENTRY_SEED = new TextEncoder().encode("wattz-model");

/**
 * Derive the deterministic PDA for a model id.
 */
export function deriveModelEntryPda(
  programId: SolanaPublicKey,
  modelId: string,
): [SolanaPublicKey, number] {
  return SolanaPublicKey.findProgramAddressSync(
    [MODEL_ENTRY_SEED, new TextEncoder().encode(modelId)],
    programId,
  );
}

export interface PublishParams {
  connection: Connection;
  wallet: {
    publicKey: PublicKey;
    signTransaction<T>(tx: T): Promise<T>;
    signAllTransactions<T>(txs: T[]): Promise<T[]>;
  };
  program: {
    id: SolanaPublicKey;
    idl: Idl;
  };
  payer: Keypair;
  entry: ModelEntry;
}

/**
 * Publish (or upsert) a model entry. The Anchor program is expected to
 * expose two instructions:
 *
 *   registerModel(entry: RegisterModelArgs)
 *   updateModel(entry: UpdateModelArgs)
 *
 * where `RegisterModelArgs` mirrors the ModelEntry schema minus the
 * `publishedBy` and `publishedAtUnix` fields (they are set on-chain by
 * the program).
 */
export async function publishModelEntry(params: PublishParams): Promise<string> {
  const entry = ModelEntrySchema.parse(params.entry);
  const provider = new AnchorProvider(
    params.connection,
    params.wallet as unknown as AnchorProvider["wallet"],
    { commitment: "confirmed", preflightCommitment: "confirmed" },
  );
  const program = new Program(params.program.idl, provider);
  const [modelPda] = deriveModelEntryPda(params.program.id, entry.id);

  // If the PDA already exists, take the `updateModel` path.
  const accountInfo = await params.connection.getAccountInfo(modelPda);
  const args = {
    id: entry.id,
    displayName: entry.displayName,
    family: entry.family,
    version: entry.version,
    license: entry.license,
    licenseUrl: entry.licenseUrl,
    weightsUrl: entry.weightsUrl,
    weightsSha256: entry.weightsSha256,
    contextWindow: new BN(entry.contextWindow),
    vramMib: new BN(entry.vramMib),
    inputPer1kMicros: new BN(entry.price.inputPer1kMicros),
    outputPer1kMicros: new BN(entry.price.outputPer1kMicros),
    sessionMicros: new BN(entry.price.sessionMicros),
    kycRequired: entry.kycRequired,
    metadataKeys: Object.keys(entry.metadata),
    metadataValues: Object.values(entry.metadata),
  };

  // Anchor's typed method builder is generated from the IDL at runtime;
  // using a string index keeps this module buildable in isolation.
  const methods = program.methods as Record<string, (a: unknown) => AnchorMethodBuilder>;
  const method =
    accountInfo === null
      ? methods.registerModel(args)
      : methods.updateModel(args);

  return method
    .accounts({
      modelEntry: modelPda,
      payer: params.payer.publicKey,
      systemProgram: SolanaPublicKey.default,
    })
    .signers([params.payer])
    .rpc();
}

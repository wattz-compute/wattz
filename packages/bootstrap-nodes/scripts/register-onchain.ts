#!/usr/bin/env -S node --loader ts-node/esm
/**
 * register-onchain.ts
 *
 * Publishes a `register_node` instruction to the Wattz Anchor program
 * for a freshly-provisioned bootstrap GPU node. Reads the node's
 * ed25519 attestation public key + heartbeat endpoint from stdin and
 * signs the transaction with the wallet loaded from `WATTZ_PUBLISHER_KEYPAIR`.
 *
 * Usage:
 *   pnpm ts-node scripts/register-onchain.ts \
 *     --node-id wattz-runpod-01 \
 *     --pubkey <base58 solana pubkey> \
 *     --endpoint https://node-1.wattz.fi \
 *     --region us-east \
 *     --models "llama-3-8b-instruct,mistral-7b-instruct-v0.3" \
 *     --stake 1000000000
 */

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  AnchorProvider,
  BN,
  Program,
  Wallet,
  type Idl,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

interface CliArgs {
  nodeId: string;
  pubkey: string;
  endpoint: string;
  region: string;
  models: string[];
  attestationType: string;
  stake: bigint;
  programId: string;
  rpcUrl: string;
  idlPath: string;
  keypairPath: string;
  cluster: string;
}

function parseCli(): CliArgs {
  const { values } = parseArgs({
    options: {
      "node-id": { type: "string", short: "n" },
      pubkey: { type: "string", short: "p" },
      endpoint: { type: "string", short: "e" },
      region: { type: "string", short: "r" },
      models: { type: "string", short: "m" },
      "attestation-type": { type: "string" },
      stake: { type: "string", short: "s" },
      "program-id": { type: "string" },
      "rpc-url": { type: "string" },
      "idl-path": { type: "string" },
      "keypair-path": { type: "string" },
      cluster: { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });
  const require = (k: string, v: string | undefined): string => {
    if (!v) {
      throw new Error(`missing required flag: --${k}`);
    }
    return v;
  };
  return {
    nodeId: require("node-id", values["node-id"]),
    pubkey: require("pubkey", values.pubkey),
    endpoint: require("endpoint", values.endpoint),
    region: require("region", values.region),
    models: require("models", values.models).split(",").map((s) => s.trim()),
    attestationType: values["attestation-type"] ?? "software",
    stake: BigInt(values.stake ?? "0"),
    programId:
      values["program-id"] ??
      process.env.WATTZ_PROGRAM_ID ??
      "",
    rpcUrl:
      values["rpc-url"] ??
      process.env.SOLANA_RPC_URL ??
      "https://api.mainnet-beta.solana.com",
    idlPath: values["idl-path"] ?? "packages/anchor-program/target/idl/wattz.json",
    keypairPath:
      values["keypair-path"] ??
      process.env.WATTZ_PUBLISHER_KEYPAIR ??
      `${process.env.HOME}/.config/solana/id.json`,
    cluster: values.cluster ?? "mainnet-beta",
  };
}

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function loadIdl(path: string): Idl {
  return JSON.parse(readFileSync(path, "utf8")) as Idl;
}

function deriveNodePda(
  programId: PublicKey,
  pubkey: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("wattz-node"), pubkey.toBuffer()],
    programId,
  );
}

async function main(): Promise<void> {
  const cli = parseCli();
  if (!cli.programId) {
    throw new Error(
      "missing program id: pass --program-id or set WATTZ_PROGRAM_ID",
    );
  }
  const connection = new Connection(cli.rpcUrl, "confirmed");
  const wallet = new Wallet(loadKeypair(cli.keypairPath));
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const idl = loadIdl(cli.idlPath);
  const program = new Program(idl, provider);
  const programId = new PublicKey(cli.programId);
  const nodePubkey = new PublicKey(cli.pubkey);
  const [nodePda] = deriveNodePda(programId, nodePubkey);

  // The Anchor program's IDL exposes a `registerNode` instruction. This
  // helper is a thin ts wrapper.
  const args = {
    nodeId: cli.nodeId,
    endpoint: cli.endpoint,
    region: cli.region,
    models: cli.models,
    attestationType: cli.attestationType,
    stake: new BN(cli.stake.toString()),
  };

  const sig = await (program.methods as unknown as {
    registerNode: (args: unknown) => {
      accounts: (accounts: Record<string, PublicKey>) => {
        signers: (signers: Keypair[]) => { rpc: () => Promise<string> };
      };
    };
  })
    .registerNode(args)
    .accounts({
      node: nodePda,
      nodeAuthority: nodePubkey,
      payer: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([wallet.payer])
    .rpc();

  const explorer =
    cli.cluster === "mainnet-beta"
      ? `https://explorer.solana.com/tx/${sig}`
      : `https://explorer.solana.com/tx/${sig}?cluster=${cli.cluster}`;

  process.stdout.write(
    JSON.stringify(
      {
        signature: sig,
        nodePda: nodePda.toBase58(),
        explorer,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`register-onchain failed: ${(err as Error).message}\n`);
  process.exit(1);
});

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Keypair, PublicKey } from '@solana/web3.js';
import { ensureHome, keypairPath } from '../config/path';

export async function loadOrCreateKeypair(): Promise<Keypair> {
  const path = keypairPath();
  if (existsSync(path)) {
    return loadKeypair();
  }
  await ensureHome();
  const kp = Keypair.generate();
  await writeFile(path, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return kp;
}

export async function loadKeypair(): Promise<Keypair> {
  const path = keypairPath();
  if (!existsSync(path)) {
    throw new Error(`Keypair not found at ${path}. Run \`wattz node init\` first.`);
  }
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as number[];
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error(`Keypair file ${path} is malformed. Expected 64 byte secret array.`);
  }
  return Keypair.fromSecretKey(new Uint8Array(parsed));
}

export function parsePubkey(input: string): PublicKey {
  try {
    return new PublicKey(input);
  } catch {
    throw new Error(`Invalid Solana pubkey: ${input}`);
  }
}

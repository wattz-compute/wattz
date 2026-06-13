import { Connection, PublicKey } from '@solana/web3.js';
import { loadConfig } from '../config/schema';

export async function getConnection(): Promise<Connection> {
  const config = await loadConfig();
  return new Connection(config.solanaRpc, 'confirmed');
}

export async function airdropIfDevnet(pubkey: PublicKey, lamports: number): Promise<string | undefined> {
  const config = await loadConfig();
  if (config.cluster !== 'devnet') return undefined;
  const connection = new Connection(config.solanaRpc, 'confirmed');
  const sig = await connection.requestAirdrop(pubkey, lamports);
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

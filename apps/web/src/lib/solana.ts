import { clusterApiUrl } from '@solana/web3.js';

// Public RPC only for the client wallet adapter.
// Server-side Helius/QuickNode must never leak into NEXT_PUBLIC_*.
export function getClientRpcEndpoint(): string {
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (url && url.startsWith('https://')) return url;
  return clusterApiUrl('mainnet-beta');
}

export function projectCa(): string | null {
  const raw = process.env.NEXT_PUBLIC_0_PROJECT_CA;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Basic Solana address length sanity check.
  if (trimmed.length < 32 || trimmed.length > 44) return null;
  return trimmed;
}

export function programId(): string | null {
  const raw = process.env.NEXT_PUBLIC_2_PROGRAM_ID;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return null;
  return trimmed;
}

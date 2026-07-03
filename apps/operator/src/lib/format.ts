// $WATTZ carries 9 decimals (Token-2022), so the base-unit -> whole-token
// scale matches lamports. Stake, revenue, and rewards are all denominated in
// $WATTZ by the settlement program.
export function formatWattz(n: number | bigint): string {
  const num = typeof n === 'bigint' ? Number(n) : n;
  const wattz = num / 1_000_000_000;
  return `${wattz.toFixed(4)} $WATTZ`;
}

// Only for values that truly are native SOL fetched from the chain -- e.g. the
// operator wallet balance used to pay transaction fees.
export function formatSol(n: number | bigint): string {
  const num = typeof n === 'bigint' ? Number(n) : n;
  const sol = num / 1_000_000_000;
  return `${sol.toFixed(4)} SOL`;
}

export function shortPubkey(pk: string | undefined): string {
  if (!pk) return '-';
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}...${pk.slice(-4)}`;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || (!days && !hours)) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function formatNumber(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function formatTflops(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(2)} PFLOPS`;
  return `${n.toFixed(2)} TFLOPS`;
}

export function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function solanaCluster(): string {
  return process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
}

export function explorerTxUrl(signature: string): string {
  const cluster = solanaCluster();
  const suffix = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}

export function errorTitle(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 404) return 'Node not found';
  if (status === 400) return 'Bad request';
  if (status === 401 || status === 403) return 'Unauthorized';
  if (status === 408 || status === 504) return 'Request timed out';
  if (typeof status === 'number' && status >= 500) return 'Gateway unavailable';
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) {
    return 'Request timed out';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Network error';
  return 'Gateway unavailable';
}

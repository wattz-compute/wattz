export function formatLamports(n: number | bigint): string {
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

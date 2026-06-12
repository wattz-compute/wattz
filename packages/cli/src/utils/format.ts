export function formatLamports(n: number | bigint): string {
  const num = typeof n === 'bigint' ? Number(n) : n;
  const sol = num / 1_000_000_000;
  if (Math.abs(sol) < 0.0001 && sol !== 0) {
    return `${num.toLocaleString('en-US')} lamports`;
  }
  return `${sol.toFixed(4)} SOL`;
}

export function shortPubkey(pk: string): string {
  return pk.length > 12 ? `${pk.slice(0, 6)}...${pk.slice(-4)}` : pk;
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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(0);
  return `${minutes} min ${seconds}s`;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
}

export function padRight(str: string, width: number): string {
  if (str.length >= width) return str;
  return str + ' '.repeat(width - str.length);
}

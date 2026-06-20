export function truncateAddress(address: string, prefix = 4, suffix = 4): string {
  if (!address) return '';
  if (address.length <= prefix + suffix + 3) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toFixed(digits);
}

export function formatUsd(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '--';
  if (value < 0.0001 && value > 0) return `< $0.0001`;
  return `$${value.toFixed(digits)}`;
}

export function formatMs(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (value < 1) return '<1 ms';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

export function shortHash(hash: string, prefix = 6, suffix = 6): string {
  if (!hash) return '';
  if (hash.length <= prefix + suffix + 3) return hash;
  return `${hash.slice(0, prefix)}...${hash.slice(-suffix)}`;
}

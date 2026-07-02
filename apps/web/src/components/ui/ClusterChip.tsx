import { Chip } from './Chip';

// Single source of truth for the cluster label shown in chrome. Reads
// NEXT_PUBLIC_SOLANA_CLUSTER so a cluster cutover is one env change.
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';

interface ClusterChipProps {
  prefix?: string;
  tone?: 'cyan' | 'wire' | 'gold' | 'muted';
  className?: string;
}

export function ClusterChip({ prefix, tone = 'cyan', className }: ClusterChipProps) {
  return (
    <Chip tone={tone} className={className}>
      {prefix ? `${prefix} ${cluster}` : cluster}
    </Chip>
  );
}

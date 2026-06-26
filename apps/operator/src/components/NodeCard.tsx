import type { NodeInfo } from '@/types/wattz';
import { SafeLink } from './layout/SafeLink';
import { formatLamports, formatPct, formatTflops, shortPubkey, timeAgo } from '@/lib/format';

interface NodeCardProps {
  node: NodeInfo;
}

const attestationLabel: Record<NodeInfo['attestation_kind'], string> = {
  sgx: 'Intel SGX',
  sev: 'AMD SEV',
  nvidia_cc: 'NVIDIA CC',
  risc0: 'Risc0 ZK',
  sp1: 'SP1 ZK',
  none: 'no-tee',
};

export function NodeCard({ node }: NodeCardProps) {
  return (
    <SafeLink
      href={`/nodes/${node.pubkey}`}
      className="wattz-card group block rounded-lg p-5 transition-colors hover:border-cyan/45"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-sm uppercase tracking-[0.22em] text-cluster">
            {shortPubkey(node.pubkey)}
          </div>
          <div className="mt-1 text-xs text-fog">
            Operator {shortPubkey(node.operator)} - {node.region}
          </div>
        </div>
        <div className={node.online ? 'badge' : 'badge badge-fog'}>
          {node.online ? 'online' : 'offline'}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="metric-label">Uptime 30d</dt>
          <dd className="metric-value text-lg">{formatPct(node.uptime_pct)}</dd>
        </div>
        <div>
          <dt className="metric-label">TFLOPS active</dt>
          <dd className="metric-value text-lg">{formatTflops(node.tflops_active)}</dd>
        </div>
        <div>
          <dt className="metric-label">Stake</dt>
          <dd className="metric-value text-lg">{formatLamports(node.stake_lamports)}</dd>
        </div>
        <div>
          <dt className="metric-label">Reputation</dt>
          <dd className="metric-value text-lg">{node.reputation.toFixed(2)}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
        <span className="badge badge-gold">{attestationLabel[node.attestation_kind]}</span>
        {node.gpus.slice(0, 2).map((gpu) => (
          <span key={gpu} className="badge badge-wire">
            {gpu}
          </span>
        ))}
        {node.gpus.length > 2 && (
          <span className="badge badge-fog">+{node.gpus.length - 2}</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-fog">
        <span>{node.supported_models.length} models loaded</span>
        <span>heartbeat {timeAgo(node.last_heartbeat)}</span>
      </div>
    </SafeLink>
  );
}

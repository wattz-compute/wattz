'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { UptimeChart } from '@/components/UptimeChart';
import { RevenueChart } from '@/components/RevenueChart';
import { ModelChip } from '@/components/ModelChip';
import { StatCard } from '@/components/StatCard';
import { ErrorPanel } from '@/components/ErrorPanel';
import { errorTitle, formatWattz, formatNumber, formatPct, formatTflops, shortPubkey, timeAgo } from '@/lib/format';

const attestationLabel: Record<string, string> = {
  sgx: 'Intel SGX quote',
  sev: 'AMD SEV-SNP quote',
  nvidia_cc: 'NVIDIA Confidential Compute',
  risc0: 'Risc0 ZK proof',
  sp1: 'SP1 ZK proof',
  none: 'No hardware attestation',
};

export default function NodeDetailPage({ params }: { params: { id: string } }) {
  const nodeQuery = useQuery({
    queryKey: ['node', params.id],
    queryFn: () => api.node(params.id),
    refetchInterval: 30_000,
  });

  if (nodeQuery.isLoading) {
    return (
      <div className="wattz-card rounded-lg p-8 text-center text-sm text-fog">
        Loading node telemetry for {shortPubkey(params.id)}...
      </div>
    );
  }

  if (nodeQuery.isError) {
    return (
      <ErrorPanel
        title={errorTitle(nodeQuery.error)}
        message={(nodeQuery.error as Error).message}
      />
    );
  }

  const node = nodeQuery.data;
  if (!node) {
    return (
      <div className="wattz-card rounded-lg p-8 text-center text-sm text-fog">
        Node {shortPubkey(params.id)} was not found in the routing engine.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="metric-label">Node detail</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-4">
          <h1 className="font-display text-3xl uppercase tracking-[0.18em] text-cluster md:text-4xl">
            {shortPubkey(node.pubkey)}
          </h1>
          <span className={node.online ? 'badge' : 'badge badge-fog'}>
            {node.online ? 'online' : 'offline'}
          </span>
          <span className="badge badge-gold">{attestationLabel[node.attestation_kind]}</span>
          {node.source === 'network-preview' && (
            <span className="inline-flex items-center rounded border border-fog/30 bg-shadow px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-fog">
              network preview
            </span>
          )}
        </div>
        <p className="mt-3 text-sm text-fog">
          Operator {shortPubkey(node.operator)} in {node.region}. Heartbeat{' '}
          {timeAgo(node.last_heartbeat)}.
          {node.first_seen ? ` First seen ${timeAgo(node.first_seen)}.` : ''}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Uptime 30d" value={formatPct(node.uptime_pct)} />
        <StatCard label="TFLOPS active" value={formatTflops(node.tflops_active)} accent="wire" />
        <StatCard label="Stake" value={formatWattz(node.stake_lamports)} accent="gold" />
        <StatCard label="Reputation" value={node.reputation.toFixed(2)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <UptimeChart data={node.uptime_series} />
        <RevenueChart data={node.revenue_series} />
      </section>

      <section>
        <div className="metric-label">GPUs</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {node.gpus.map((gpu) => (
            <span key={gpu} className="badge badge-wire">
              {gpu}
            </span>
          ))}
          {node.gpus.length === 0 && (
            <span className="text-xs text-fog">No GPU roster returned by the routing engine.</span>
          )}
        </div>
      </section>

      <section>
        <div className="metric-label">Models loaded ({node.models_loaded.length})</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {node.models_loaded.map((id) => (
            <ModelChip key={id} modelId={id} active />
          ))}
          {node.models_loaded.length === 0 && (
            <div className="text-xs text-fog">
              No models loaded yet. Run{' '}
              <code className="font-mono text-cyan">wattz node start --model llama-3.1-8b-instant</code>{' '}
              to pin a model.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="wattz-card rounded-lg p-5">
          <div className="metric-label">Supported models</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {node.supported_models.map((id) => (
              <span key={id} className="badge">
                {id}
              </span>
            ))}
          </div>
        </div>
        <div className="wattz-card rounded-lg p-5">
          <div className="metric-label">Pricing</div>
          <div className="metric-value mt-3 text-2xl">
            price multiplier x{(node.price_multiplier ?? 1).toFixed(2)}
          </div>
          <div className="mt-2 text-xs text-fog">
            Final price = base * multiplier * region factor. Base prices are set in the model
            registry PDA. Region factors come from the routing engine.
          </div>
          <div className="mt-4 text-xs text-fog">
            {formatNumber(node.uptime_pct * 24 * 60 / 100, 0)} operator-minutes credited in the last
            24 hours.
          </div>
        </div>
      </section>

      {node.events && node.events.length > 0 && (
        <section>
          <div className="metric-label">Recent events</div>
          <ul className="mt-3 space-y-2 font-mono text-xs text-cluster/80">
            {node.events.map((event, i) => (
              <li
                key={`${event.timestamp}-${i}`}
                className="flex flex-col gap-1 border-l border-cyan/20 pl-3 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <span className="w-20 shrink-0 text-fog">{timeAgo(event.timestamp)}</span>
                <span className="w-24 shrink-0 uppercase tracking-widest text-cyan/70">
                  {event.kind}
                </span>
                <span>{event.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

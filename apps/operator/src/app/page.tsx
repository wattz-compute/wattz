'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '@/lib/api';
import { NodeCard } from '@/components/NodeCard';
import { StatCard } from '@/components/StatCard';
import { ErrorPanel } from '@/components/ErrorPanel';
import { formatLamports, formatNumber, formatTflops } from '@/lib/format';

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const operator = useMemo(() => publicKey?.toBase58(), [publicKey]);

  const statsQuery = useQuery({
    queryKey: ['stats', operator],
    queryFn: () => api.stats(operator),
    refetchInterval: 30_000,
  });

  const nodesQuery = useQuery({
    queryKey: ['nodes', operator],
    queryFn: () => api.nodes(operator),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-10">
      <section>
        <div className="metric-label">Operator control plane</div>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.18em] text-cluster md:text-4xl">
          Substation status
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-fog">
          Live view of your Wattz GPU inference nodes. Uptime and revenue update every 30 seconds
          straight from the Anchor mainnet settlement program and the routing engine.
        </p>
      </section>

      {statsQuery.isError && (
        <ErrorPanel
          message={(statsQuery.error as Error).message}
          hint="Check that INFERENCE_GATEWAY_URL points at a running Wattz gateway."
        />
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Online nodes"
          value={
            statsQuery.data
              ? `${statsQuery.data.online_nodes} / ${statsQuery.data.total_nodes}`
              : '- / -'
          }
          hint="Nodes with a heartbeat in the last 90 seconds"
        />
        <StatCard
          label="Aggregate TFLOPS"
          value={statsQuery.data ? formatTflops(statsQuery.data.aggregate_tflops) : '-'}
          hint="Sum across your fleet"
          accent="wire"
        />
        <StatCard
          label="Inferences / 24h"
          value={statsQuery.data ? formatNumber(statsQuery.data.daily_inferences, 0) : '-'}
          hint={
            statsQuery.data
              ? `${formatNumber(statsQuery.data.daily_tokens, 0)} tokens streamed`
              : undefined
          }
        />
        <StatCard
          label="Revenue / 24h"
          value={statsQuery.data ? formatLamports(statsQuery.data.daily_revenue_lamports) : '-'}
          hint={
            statsQuery.data
              ? `pending rewards ${formatLamports(statsQuery.data.pending_rewards_lamports)}`
              : undefined
          }
          accent="gold"
        />
      </section>

      <section>
        <div className="flex items-end justify-between">
          <div>
            <div className="metric-label">Fleet</div>
            <h2 className="mt-1 font-display text-2xl uppercase tracking-[0.18em] text-cluster">
              Nodes ({nodesQuery.data?.data.length ?? 0})
            </h2>
          </div>
          {!operator && (
            <div className="text-xs text-fog">
              Connect a wallet to filter to your operator identity.
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {nodesQuery.isLoading && (
            <div className="wattz-card col-span-full rounded-lg p-8 text-center text-sm text-fog">
              Loading node fleet...
            </div>
          )}
          {nodesQuery.isError && (
            <div className="col-span-full">
              <ErrorPanel message={(nodesQuery.error as Error).message} />
            </div>
          )}
          {nodesQuery.data?.data.length === 0 && (
            <div className="wattz-card col-span-full rounded-lg p-8 text-center text-sm text-fog">
              No nodes registered under this operator yet. Run{' '}
              <code className="font-mono text-cyan">wattz node init</code> and{' '}
              <code className="font-mono text-cyan">wattz node start</code> from the CLI to bring
              one online.
            </div>
          )}
          {nodesQuery.data?.data.map((node) => (
            <NodeCard key={node.pubkey} node={node} />
          ))}
        </div>
      </section>
    </div>
  );
}

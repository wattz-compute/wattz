'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '@/lib/api';
import { NodeCard } from '@/components/NodeCard';
import { StatCard } from '@/components/StatCard';
import { ErrorPanel } from '@/components/ErrorPanel';
import { ThroughputChart } from '@/components/ThroughputChart';
import { errorTitle, formatLamports, formatNumber, formatTflops, solanaCluster } from '@/lib/format';

type View = 'network' | 'mine';

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const operator = useMemo(() => publicKey?.toBase58(), [publicKey]);
  const cluster = solanaCluster();

  const [view, setView] = useState<View>('network');
  const autoSwitched = useRef(false);

  // Auto-switch to the operator's own fleet on first connect, but leave the
  // Network view one click away. Reset on disconnect.
  useEffect(() => {
    if (operator && !autoSwitched.current) {
      autoSwitched.current = true;
      setView('mine');
    }
    if (!operator) {
      autoSwitched.current = false;
      setView('network');
    }
  }, [operator]);

  const scopedOperator = view === 'mine' ? operator : undefined;

  const statsQuery = useQuery({
    queryKey: ['stats', scopedOperator],
    queryFn: () => api.stats(scopedOperator),
    refetchInterval: 30_000,
  });

  const nodesQuery = useQuery({
    queryKey: ['nodes', scopedOperator],
    queryFn: () => api.nodes(scopedOperator),
    refetchInterval: 30_000,
  });

  const historyQuery = useQuery({
    queryKey: ['stats-history'],
    queryFn: () => api.statsHistory(),
    refetchInterval: 60_000,
  });

  const isPreview = statsQuery.data?.source === 'network-preview';

  const regions = useMemo(() => {
    const map = new Map<string, { count: number; tflops: number; online: boolean }>();
    for (const node of nodesQuery.data?.data ?? []) {
      const cur = map.get(node.region) ?? { count: 0, tflops: 0, online: false };
      cur.count += 1;
      cur.tflops += node.tflops_active;
      cur.online = cur.online || node.online;
      map.set(node.region, cur);
    }
    return Array.from(map.entries())
      .map(([region, v]) => ({ region, ...v }))
      .sort((a, b) => b.tflops - a.tflops);
  }, [nodesQuery.data]);

  return (
    <div className="space-y-10">
      <section>
        <div className="metric-label">Operator control plane</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl uppercase tracking-[0.18em] text-cluster md:text-4xl">
            Substation status
          </h1>
          {isPreview && (
            <span className="inline-flex items-center rounded border border-fog/30 bg-shadow px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-fog">
              network preview — live gateway telemetry lands with the first registered node
            </span>
          )}
        </div>
        <p className="mt-3 max-w-2xl text-sm text-fog">
          Fleet view for Wattz node operators. Data updates every 30 seconds through the gateway;
          settlement references the Anchor program on Solana ({cluster}).
        </p>
      </section>

      <div className="inline-flex rounded-md border border-cyan/20 bg-shadow p-1 text-xs uppercase tracking-[0.2em]">
        <button
          type="button"
          onClick={() => setView('network')}
          aria-pressed={view === 'network'}
          className={
            view === 'network'
              ? 'rounded px-4 py-2 text-navy bg-cyan'
              : 'rounded px-4 py-2 text-fog transition-colors hover:text-cyan'
          }
        >
          Network
        </button>
        <button
          type="button"
          onClick={() => operator && setView('mine')}
          disabled={!operator}
          aria-pressed={view === 'mine'}
          className={
            view === 'mine'
              ? 'rounded px-4 py-2 text-navy bg-cyan'
              : 'rounded px-4 py-2 text-fog transition-colors hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-fog'
          }
        >
          My nodes
        </button>
      </div>

      {statsQuery.isError && (
        <ErrorPanel
          title={errorTitle(statsQuery.error)}
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
          hint={view === 'mine' ? 'Sum across your fleet' : 'Sum across the network'}
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
        <div className="metric-label mb-3">Network throughput</div>
        {historyQuery.isError ? (
          <ErrorPanel
            title={errorTitle(historyQuery.error)}
            message={(historyQuery.error as Error).message}
          />
        ) : (
          <ThroughputChart data={historyQuery.data?.data ?? []} />
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="metric-label">Fleet</div>
            <h2 className="mt-1 font-display text-2xl uppercase tracking-[0.18em] text-cluster">
              Nodes ({nodesQuery.data?.data.length ?? 0})
            </h2>
          </div>
          {view === 'network' && !operator && (
            <div className="text-xs text-fog">
              Connect a wallet to switch to your operator identity.
            </div>
          )}
        </div>

        {regions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {regions.map((r) => (
              <span
                key={r.region}
                className={
                  r.online
                    ? 'inline-flex items-center gap-2 rounded border border-cyan/25 bg-shadow px-3 py-1.5 text-xs text-cluster/85'
                    : 'inline-flex items-center gap-2 rounded border border-fog/20 bg-shadow px-3 py-1.5 text-xs text-fog/60'
                }
              >
                <span className="font-mono uppercase tracking-widest">{r.region}</span>
                <span className="text-fog">
                  {r.count} node{r.count === 1 ? '' : 's'} · {formatTflops(r.tflops)}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {nodesQuery.isLoading && (
            <div className="wattz-card col-span-full rounded-lg p-8 text-center text-sm text-fog">
              Loading node fleet...
            </div>
          )}
          {nodesQuery.isError && (
            <div className="col-span-full">
              <ErrorPanel
                title={errorTitle(nodesQuery.error)}
                message={(nodesQuery.error as Error).message}
              />
            </div>
          )}
          {nodesQuery.data?.data.length === 0 && (
            <div className="wattz-card col-span-full rounded-lg p-8 text-center text-sm text-fog">
              No nodes registered under this operator yet — bring a node online to see it here.
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

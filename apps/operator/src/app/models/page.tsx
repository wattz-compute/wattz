'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ErrorPanel } from '@/components/ErrorPanel';
import type { ModelStatus } from '@/types/wattz';
import { errorTitle, solanaCluster } from '@/lib/format';

const statusBadge: Record<ModelStatus, string> = {
  live: 'badge',
  relay: 'badge badge-wire',
  devnet: 'badge',
  'awaiting node': 'badge badge-fog',
};

export default function ModelsPage() {
  const cluster = solanaCluster();
  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: () => api.models(),
  });

  const isPreview = modelsQuery.data?.source === 'network-preview';

  return (
    <div className="space-y-8">
      <section>
        <div className="metric-label">Model registry</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl uppercase tracking-[0.18em] text-cluster md:text-4xl">
            Supported models
          </h1>
          {isPreview && (
            <span className="inline-flex items-center rounded border border-fog/30 bg-shadow px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-fog">
              network preview — live gateway telemetry lands with the first registered node
            </span>
          )}
        </div>
        <p className="mt-3 max-w-2xl text-sm text-fog">
          Models supported by the Wattz routing engine, with license, context window, and per-1k
          pricing. Registry publishing runs on Solana {cluster}; the network preview below shows the
          launch model set.
        </p>
      </section>

      {modelsQuery.isError && (
        <ErrorPanel
          title={errorTitle(modelsQuery.error)}
          message={(modelsQuery.error as Error).message}
        />
      )}

      <div className="wattz-card overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-cyan/10 text-sm">
          <thead className="bg-shadow/60 text-xs uppercase tracking-widest text-fog">
            <tr>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Family</th>
              <th className="px-4 py-3 text-left">License</th>
              <th className="px-4 py-3 text-left">Modality</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Nodes online</th>
              <th className="px-4 py-3 text-right">Context</th>
              <th className="px-4 py-3 text-right">
                Price (p/c)
                <span className="block text-[10px] normal-case text-fog/70">SOL / 1k tok</span>
              </th>
              <th className="px-4 py-3 text-right">VRAM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan/5">
            {modelsQuery.isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-fog">
                  Loading model registry...
                </td>
              </tr>
            )}
            {modelsQuery.data?.data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-fog">
                  Registry is empty.
                </td>
              </tr>
            )}
            {modelsQuery.data?.data.map((m) => (
              <tr key={m.id} className="hover:bg-cyan/5">
                <td className="px-4 py-3 font-mono text-cluster">{m.id}</td>
                <td className="px-4 py-3 text-cluster/80">{m.family}</td>
                <td className="px-4 py-3 text-cluster/80">
                  {m.license.name}
                  {m.license.kyc_required && <span className="ml-2 badge badge-wire">kyc</span>}
                </td>
                <td className="px-4 py-3 text-cluster/80">{m.modality}</td>
                <td className="px-4 py-3">
                  {m.status ? (
                    <span className={statusBadge[m.status] ?? 'badge'}>{m.status}</span>
                  ) : (
                    <span className="text-fog">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-cluster">
                  {m.nodes_online ?? 0}
                </td>
                <td className="px-4 py-3 text-right font-mono text-cluster">
                  {(m.context_window ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-cluster">
                  {m.price_per_1k_prompt}/{m.price_per_1k_completion}
                </td>
                <td className="px-4 py-3 text-right font-mono text-cluster/80">
                  {m.min_gpu_vram_gb}GB
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

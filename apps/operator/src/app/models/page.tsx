'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ErrorPanel } from '@/components/ErrorPanel';

export default function ModelsPage() {
  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: () => api.models(),
  });

  return (
    <div className="space-y-8">
      <section>
        <div className="metric-label">Model registry (PDA)</div>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.18em] text-cluster md:text-4xl">
          Supported models
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-fog">
          Every model published to the on-chain Wattz model registry, with license, context window,
          and per-1k pricing. Register a new one via{' '}
          <code className="font-mono text-cyan">wattz model publish --file model.yaml</code>.
        </p>
      </section>

      {modelsQuery.isError && <ErrorPanel message={(modelsQuery.error as Error).message} />}

      <div className="wattz-card overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-cyan/10 text-sm">
          <thead className="bg-shadow/60 text-xs uppercase tracking-widest text-fog">
            <tr>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Family</th>
              <th className="px-4 py-3 text-left">License</th>
              <th className="px-4 py-3 text-left">Modality</th>
              <th className="px-4 py-3 text-right">Context</th>
              <th className="px-4 py-3 text-right">Price/1k (p/c)</th>
              <th className="px-4 py-3 text-right">VRAM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan/5">
            {modelsQuery.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-fog">
                  Loading model registry...
                </td>
              </tr>
            )}
            {modelsQuery.data?.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-fog">
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
                  {m.license.kyc_required && (
                    <span className="ml-2 badge badge-wire">kyc</span>
                  )}
                </td>
                <td className="px-4 py-3 text-cluster/80">{m.modality}</td>
                <td className="px-4 py-3 text-right font-mono text-cluster">{m.context_window.toLocaleString()}</td>
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

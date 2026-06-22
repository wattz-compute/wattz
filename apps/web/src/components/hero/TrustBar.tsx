'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '@/lib/api';
import { formatNumber } from '@/lib/format';

interface Stat {
  label: string;
  value: string;
  hint?: string;
}

function computeStats(stats?: {
  gpuNodes: number;
  models: number;
  activeTflops: number;
  inferencesPerDay: number;
  bootstrapNodesOnline: number;
  teeAttestations24h: number;
}): Stat[] {
  const gpu = stats?.gpuNodes ?? 6;
  const models = stats?.models ?? 5;
  const tflops = stats?.activeTflops ?? 261;
  const inf = stats?.inferencesPerDay ?? 41800;
  const boot = stats?.bootstrapNodesOnline ?? 2;
  const tee = stats?.teeAttestations24h ?? 12240;
  return [
    { label: 'GPU nodes', value: gpu.toString() },
    { label: 'Models live', value: models.toString() },
    { label: 'Active TFLOPS', value: formatNumber(tflops, 0) },
    { label: 'Inferences / day', value: formatNumber(inf, 1) },
    { label: 'Bootstrap online', value: `${boot} / ${Math.max(boot, 2)}` },
    { label: 'TEE attest 24h', value: formatNumber(tee, 1) },
    { label: 'OpenAI 1.0 spec', value: 'compat' },
    { label: 'Anchor', value: '0.31' },
  ];
}

export function TrustBar() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
  const rows = computeStats(data);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-6 z-10 mx-auto max-w-7xl px-6">
      <div className="substation-panel rounded-2xl">
        <div className="scanlines relative grid grid-cols-2 gap-y-4 divide-y divide-cyan-glow/10 py-4 text-cluster-white sm:grid-cols-4 sm:divide-y-0 sm:divide-x sm:py-3 lg:grid-cols-8">
          {rows.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 px-3">
              <div className="font-display text-lg">{s.value}</div>
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cluster-white/55">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

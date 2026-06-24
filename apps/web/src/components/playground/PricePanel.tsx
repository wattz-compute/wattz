'use client';

import type { ModelDescriptor } from '@/lib/api';
import { formatMs, formatUsd } from '@/lib/format';

interface PricePanelProps {
  model?: ModelDescriptor;
  latencyMs?: number | null;
  region?: string | null;
  costUsd?: number | null;
  tokensIn?: number;
  tokensOut?: number;
}

export function PricePanel({
  model,
  latencyMs,
  region,
  costUsd,
  tokensIn = 0,
  tokensOut = 0,
}: PricePanelProps) {
  const estimatedIn = model ? (tokensIn / 1000) * model.inputPer1kUsd : 0;
  const estimatedOut = model ? (tokensOut / 1000) * model.outputPer1kUsd : 0;
  const estimated = estimatedIn + estimatedOut;

  return (
    <div className="playground-panel p-5">
      <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
        Settlement
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <MetricRow label="Model" value={model?.label || '--'} />
        <MetricRow label="Region" value={region || model?.region || '--'} />
        <MetricRow
          label="Latency"
          value={latencyMs != null ? formatMs(latencyMs) : '--'}
        />
        <MetricRow
          label="Cost"
          value={costUsd != null ? formatUsd(costUsd) : formatUsd(estimated)}
        />
        <MetricRow label="Tokens in" value={tokensIn.toString()} />
        <MetricRow label="Tokens out" value={tokensOut.toString()} />
      </div>
      {model ? (
        <div className="mt-6 space-y-2 border-t border-cyan-glow/10 pt-4 text-[11px] font-mono-tech uppercase tracking-widest text-cluster-white/55">
          <div className="flex items-center justify-between">
            <span>input rate</span>
            <span>${model.inputPer1kUsd.toFixed(4)} / 1k</span>
          </div>
          <div className="flex items-center justify-between">
            <span>output rate</span>
            <span>${model.outputPer1kUsd.toFixed(4)} / 1k</span>
          </div>
          <div className="flex items-center justify-between">
            <span>vs openai gpt-4o</span>
            <span>-72%</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50">
        {label}
      </div>
      <div className="mt-0.5 font-mono-tech text-sm text-cluster-white">{value}</div>
    </div>
  );
}

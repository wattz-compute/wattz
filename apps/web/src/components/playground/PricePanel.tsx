'use client';

import type { ModelDescriptor } from '@/lib/api';
import { formatMs, formatTps, formatUsd } from '@/lib/format';

// Public OpenAI GPT-4o list price (USD per 1M tokens). Reference only -- shown
// so callers can size the same token counts against a familiar hosted model.
const GPT4O_INPUT_PER_1M = 2.5;
const GPT4O_OUTPUT_PER_1M = 10;

interface PricePanelProps {
  model?: ModelDescriptor;
  tokensIn: number;
  tokensInEstimated: boolean;
  tokensOut: number;
  tokensOutEstimated: boolean;
  tokensPerSec: number | null;
  ttfbMs: number | null;
  streamMs: number | null;
}

export function PricePanel({
  model,
  tokensIn,
  tokensInEstimated,
  tokensOut,
  tokensOutEstimated,
  tokensPerSec,
  ttfbMs,
  streamMs,
}: PricePanelProps) {
  const gpt4oReference =
    tokensOut > 0
      ? (tokensIn / 1_000_000) * GPT4O_INPUT_PER_1M +
        (tokensOut / 1_000_000) * GPT4O_OUTPUT_PER_1M
      : null;

  return (
    <div className="playground-panel p-5">
      <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
        Metering
      </div>

      <div className="mt-4 rounded-xl border border-cyan-glow/10 bg-night-deep/40 px-4 py-3">
        <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50">
          Throughput
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-3xl text-cyan-glow">
            {tokensPerSec != null ? formatTps(tokensPerSec) : '--'}
          </span>
          <span className="font-mono-tech text-[11px] uppercase tracking-widest text-cluster-white/55">
            tok / s
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <MetricRow label="Model" value={model?.label || '--'} />
        <MetricRow
          label="First token"
          value={ttfbMs != null ? formatMs(ttfbMs) : '--'}
        />
        <MetricRow
          label="Stream time"
          value={streamMs != null ? formatMs(streamMs) : '--'}
        />
        <MetricRow
          label="Tokens out"
          value={tokensOut > 0 ? `${tokensOutEstimated ? '~' : ''}${tokensOut}` : '--'}
        />
        <MetricRow
          label="Tokens in"
          value={tokensIn > 0 ? `${tokensInEstimated ? '~' : ''}${tokensIn}` : '--'}
        />
        <MetricRow
          label="Served via"
          value={model?.servedVia || (model?.status === 'live' ? 'wattz node' : '--')}
        />
      </div>

      {gpt4oReference != null ? (
        <div className="mt-6 space-y-2 border-t border-cyan-glow/10 pt-4">
          <div className="flex items-center justify-between font-mono-tech text-[11px] uppercase tracking-widest text-cluster-white/55">
            <span>gpt-4o list-price</span>
            <span>{formatUsd(gpt4oReference)}</span>
          </div>
          <div className="font-mono-tech text-[10px] leading-4 text-cluster-white/40">
            Reference for these token counts at OpenAI GPT-4o public list price
            (${GPT4O_INPUT_PER_1M.toFixed(2)}/1M in, ${GPT4O_OUTPUT_PER_1M.toFixed(2)}/1M out).
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

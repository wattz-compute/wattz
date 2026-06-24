'use client';

import { cn } from '@/lib/cn';
import type { ModelDescriptor } from '@/lib/api';

interface ModelSelectorProps {
  models: ModelDescriptor[];
  value: string | null;
  onSelect: (id: string) => void;
}

export function ModelSelector({ models, value, onSelect }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      {models.map((m) => {
        const active = m.id === value;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-left transition',
              active
                ? 'border-cyan-glow/60 bg-night-deep/80 shadow-wire'
                : 'border-cyan-glow/10 bg-night-deep/40 hover:border-cyan-glow/40',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="font-display text-sm text-cluster-white">{m.label}</div>
              <span
                className={cn(
                  'font-mono-tech text-[10px] uppercase tracking-widest',
                  m.status === 'live'
                    ? 'text-cyan-glow'
                    : m.status === 'bootstrap'
                      ? 'text-wire-glow'
                      : 'text-fog',
                )}
              >
                {m.status}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                {m.provider} - {m.license}
              </span>
              <span className="font-mono-tech text-[11px] text-cluster-white/70">
                ${m.inputPer1kUsd.toFixed(4)}/1k in - ${m.outputPer1kUsd.toFixed(4)}/1k out
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50">
                ctx {m.contextWindow.toLocaleString()} tok
              </span>
              <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                {m.region} - avg {m.avgLatencyMs} ms
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

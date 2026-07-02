'use client';

import { cn } from '@/lib/cn';
import type { ModelDescriptor } from '@/lib/api';

interface ModelSelectorProps {
  models: ModelDescriptor[];
  value: string | null;
  onSelect: (id: string) => void;
}

function statusClass(status: ModelDescriptor['status']): string {
  if (status === 'live') return 'text-cyan-glow';
  if (status === 'relay') return 'text-wire-glow';
  return 'text-fog';
}

export function ModelSelector({ models, value, onSelect }: ModelSelectorProps) {
  return (
    <div className="space-y-2">
      {models.map((m) => {
        const active = m.id === value;
        const disabled = !m.selectable;
        return (
          <button
            key={m.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => m.selectable && onSelect(m.id)}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/70',
              active
                ? 'border-cyan-glow/60 bg-night-deep/80 shadow-wire'
                : disabled
                  ? 'cursor-not-allowed border-cyan-glow/10 bg-night-deep/20 opacity-60'
                  : 'border-cyan-glow/10 bg-night-deep/40 hover:border-cyan-glow/40',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-display text-sm text-cluster-white">{m.label}</div>
              <span
                className={cn(
                  'font-mono-tech text-[10px] uppercase tracking-widest',
                  statusClass(m.status),
                )}
              >
                {m.status}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                {m.provider} - {m.license}
              </span>
              {m.contextWindow > 0 ? (
                <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50">
                  ctx {m.contextWindow.toLocaleString()} tok
                </span>
              ) : null}
            </div>

            {active ? (
              <div className="mt-3 space-y-1 border-t border-cyan-glow/10 pt-3 font-mono-tech text-[11px] text-cluster-white/70">
                <div className="flex items-center justify-between">
                  <span className="text-cluster-white/45">license</span>
                  <span>{m.license}</span>
                </div>
                {m.contextWindow > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-cluster-white/45">context</span>
                    <span>{m.contextWindow.toLocaleString()} tokens</span>
                  </div>
                ) : null}
                {m.servedVia ? (
                  <div className="flex items-center justify-between">
                    <span className="text-cluster-white/45">served via</span>
                    <span>{m.servedVia}</span>
                  </div>
                ) : null}
              </div>
            ) : disabled ? (
              <div className="mt-2 font-mono-tech text-[10px] uppercase tracking-widest text-fog">
                awaiting node
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

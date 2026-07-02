'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

interface PromptInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  isStreaming,
}: PromptInputProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [value]);

  return (
    <div className="playground-panel p-4">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Ask the substation. Ex: `Explain Solana Token-2022 transfer hooks in one paragraph.`"
        className="min-h-[92px] w-full resize-none rounded-md bg-transparent font-body text-sm leading-6 text-cluster-white outline-none placeholder:text-cluster-white/40 focus-visible:ring-2 focus-visible:ring-cyan-glow/40"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!disabled) onSubmit();
          }
        }}
      />
      <div className="mt-3 flex items-center justify-between">
        <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
          Cmd/Ctrl + Enter to send · Esc to stop
        </div>
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="ghost rounded-md px-5 py-2 font-mono-tech text-xs uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/70"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled}
            className={cn(
              'primary rounded-md px-5 py-2 font-mono-tech text-xs uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/70',
              disabled && 'opacity-50',
            )}
          >
            Run inference
          </button>
        )}
      </div>
    </div>
  );
}

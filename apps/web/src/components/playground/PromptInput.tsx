'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

interface PromptInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
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
        className="min-h-[92px] w-full resize-none bg-transparent font-body text-sm leading-6 text-cluster-white outline-none placeholder:text-cluster-white/40"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="mt-3 flex items-center justify-between">
        <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
          Cmd/Ctrl + Enter to send
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className={cn(
            'primary rounded-md px-5 py-2 font-mono-tech text-xs uppercase tracking-widest',
            disabled && 'opacity-50',
          )}
        >
          {isStreaming ? 'Streaming...' : 'Run inference'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';

interface ResponseStreamProps {
  content: string;
  status: 'idle' | 'streaming' | 'complete' | 'error';
  errorMessage?: string | null;
}

export function ResponseStream({ content, status, errorMessage }: ResponseStreamProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [content, status]);

  return (
    <div className="playground-panel flex h-[420px] flex-col">
      <div className="flex items-center justify-between border-b border-cyan-glow/10 px-4 py-2 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
        <span>response stream</span>
        <span
          className={
            status === 'streaming'
              ? 'text-cyan-glow'
              : status === 'complete'
                ? 'text-wire-glow'
                : status === 'error'
                  ? 'text-accent-gold'
                  : 'text-fog'
          }
        >
          {status}
        </span>
      </div>
      <div
        ref={ref}
        className="stream-box flex-1 overflow-y-auto px-4 py-4 text-cluster-white/90"
      >
        {content ? (
          <>
            {content}
            {status === 'streaming' ? (
              <span className="ml-1 inline-block h-4 w-2 translate-y-[3px] bg-cyan-glow" />
            ) : null}
          </>
        ) : status === 'error' ? (
          <span className="text-accent-gold">
            {errorMessage || 'Inference failed. Check the gateway status.'}
          </span>
        ) : (
          <span className="text-cluster-white/40">
            Awaiting prompt. Every response is streamed token by token from a
            live GPU node.
          </span>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMs } from '@/lib/format';

export type StreamStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'warming';

interface ResponseStreamProps {
  content: string;
  status: StreamStatus;
  errorMessage?: string | null;
  tokensOut: number;
  tokensOutEstimated: boolean;
  ttfbMs: number | null;
  streamMs: number | null;
  totalMs: number | null;
}

export function ResponseStream({
  content,
  status,
  errorMessage,
  tokensOut,
  tokensOutEstimated,
  ttfbMs,
  streamMs,
  totalMs,
}: ResponseStreamProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [content, status]);

  const copy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked; ignore.
    }
  };

  const showWaterfall = ttfbMs != null || streamMs != null;

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
                  : status === 'warming'
                    ? 'text-fog'
                    : 'text-fog'
          }
        >
          {status}
        </span>
      </div>

      <div
        ref={ref}
        aria-live="polite"
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
        ) : status === 'warming' ? (
          <span className="text-fog">
            Gateway unreachable — relay warming. The wire protocol does not change.
          </span>
        ) : (
          <span className="text-cluster-white/40">
            Awaiting prompt. Every response streams token by token through the
            routing gateway.
          </span>
        )}
      </div>

      {showWaterfall ? (
        <div className="border-t border-cyan-glow/10 px-4 py-2">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-night-deep/60">
            <div
              className="h-full bg-cyan-glow/70"
              style={{ flexGrow: Math.max(1, ttfbMs ?? 1) }}
            />
            <div
              className="h-full bg-wire-glow/60"
              style={{ flexGrow: Math.max(1, streamMs ?? 1) }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50">
            <span>first token {ttfbMs != null ? formatMs(ttfbMs) : '--'}</span>
            <span>stream {streamMs != null ? formatMs(streamMs) : '--'}</span>
            <span>total {totalMs != null ? formatMs(totalMs) : '--'}</span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between border-t border-cyan-glow/10 px-4 py-2 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/55">
        <span>
          {tokensOut > 0 ? `${tokensOutEstimated ? '~' : ''}${tokensOut} tokens` : '0 tokens'}
        </span>
        <button
          type="button"
          onClick={copy}
          disabled={!content}
          className="rounded px-2 py-1 uppercase tracking-widest transition hover:text-cluster-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow/70 disabled:opacity-40"
        >
          {copied ? 'copied' : 'copy raw'}
        </button>
      </div>
    </div>
  );
}

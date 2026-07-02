'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

// Full, untruncated address with a copy button. Addresses shown to users are
// never shortened; the copy state resets after a short beat.
export function CopyAddress({
  address,
  className,
}: {
  address: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 700);
    } catch {
      // Clipboard unavailable; leave the address selectable.
    }
  };

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <code className="break-all font-mono-tech text-xs text-cluster-white/90">
        {address}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy address"
        className="shrink-0 rounded border border-cyan-glow/25 bg-night-deep/60 px-2 py-0.5 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/70 transition-colors hover:border-cyan-glow/60 hover:text-cluster-white"
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </span>
  );
}

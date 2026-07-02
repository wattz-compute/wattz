'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Chip } from '@/components/ui/Chip';
import { SafeLink } from '@/components/layout/SafeLink';
import { shortHash } from '@/lib/format';

interface Receipt {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  confirmationStatus: string | null;
}
interface ReceiptsResponse {
  programId: string;
  cluster: string;
  receipts: Receipt[];
  error?: string;
}

function timeAgo(blockTime: number | null): string {
  if (blockTime == null) return 'pending';
  const seconds = Math.floor(Date.now() / 1000 - blockTime);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ReceiptsPage() {
  const [data, setData] = useState<ReceiptsResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/receipts', { cache: 'no-store' });
        if (!res.ok) throw new Error(`receipts ${res.status}`);
        const json = (await res.json()) as ReceiptsResponse;
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const receipts = data?.receipts ?? [];

  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="cyan">On-chain</Chip>
            <Chip tone="wire">devnet</Chip>
          </div>
          <h1 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
            Settlement receipts &mdash; Solana devnet
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cluster-white/70">
            Every settled inference writes a receipt against the program. Devnet
            activity below is live.
          </p>

          <div className="mt-10 substation-panel overflow-hidden rounded-2xl">
            <div className="hidden border-b border-cyan-glow/10 px-5 py-3 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/55 sm:grid sm:grid-cols-12 sm:gap-4">
              <span className="sm:col-span-5">Signature</span>
              <span className="sm:col-span-2">Slot</span>
              <span className="sm:col-span-2">Age</span>
              <span className="sm:col-span-3 text-right">Status</span>
            </div>

            {loading ? (
              <div className="px-5 py-12 text-center font-mono-tech text-xs uppercase tracking-widest text-cluster-white/50">
                reading the ledger...
              </div>
            ) : error ? (
              <div className="px-5 py-12 text-center font-mono-tech text-xs uppercase tracking-widest text-fog">
                devnet RPC unreachable &mdash; retry shortly
              </div>
            ) : receipts.length === 0 ? (
              <div className="px-5 py-12 text-center font-mono-tech text-xs uppercase tracking-widest text-cluster-white/50">
                no settled receipts yet on devnet
              </div>
            ) : (
              <ul>
                {receipts.map((r) => {
                  const failed = r.err != null;
                  return (
                    <li
                      key={r.signature}
                      className="border-b border-cyan-glow/[0.06] px-5 py-4 last:border-b-0 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4"
                    >
                      <div className="sm:col-span-5">
                        <SafeLink
                          href={`https://explorer.solana.com/tx/${r.signature}?cluster=devnet`}
                          className="font-mono-tech text-xs text-cyan-glow/90 hover:underline"
                        >
                          {shortHash(r.signature, 8, 8)}
                        </SafeLink>
                      </div>
                      <div className="mt-1 font-mono-tech text-[11px] text-cluster-white/70 sm:col-span-2 sm:mt-0">
                        <span className="text-cluster-white/40 sm:hidden">slot </span>
                        {r.slot.toLocaleString()}
                      </div>
                      <div className="mt-1 font-mono-tech text-[11px] text-cluster-white/70 sm:col-span-2 sm:mt-0">
                        {timeAgo(r.blockTime)}
                      </div>
                      <div className="mt-2 sm:col-span-3 sm:mt-0 sm:text-right">
                        <span
                          className={failed ? 'chip warn text-[9px]' : 'chip text-[9px]'}
                        >
                          <span className="dot" />
                          {failed ? 'failed' : r.confirmationStatus ?? 'confirmed'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 font-mono-tech text-[11px] text-cluster-white/50">
            <SafeLink href="/status" className="hover:text-cyan-glow">
              Grid status -&gt;
            </SafeLink>
            <SafeLink href="/docs" className="hover:text-cyan-glow">
              API docs -&gt;
            </SafeLink>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Chip } from '@/components/ui/Chip';
import { SafeLink } from '@/components/layout/SafeLink';
import { formatMs } from '@/lib/format';

type State = 'ok' | 'degraded' | 'down';
interface Row {
  id: string;
  label: string;
  state: State;
  detail: string;
  latencyMs: number | null;
  checkedAt: string;
}
interface StatusResponse {
  cluster: string;
  rows: Row[];
  generatedAt: string;
}

const dotColor: Record<State, string> = {
  ok: 'bg-cyan-glow shadow-[0_0_8px_rgba(91,192,235,0.9)]',
  degraded: 'bg-wire-glow shadow-[0_0_8px_rgba(255,217,61,0.85)]',
  down: 'bg-fog shadow-none',
};

const stateLabel: Record<State, string> = {
  ok: 'ok',
  degraded: 'degraded',
  down: 'down',
};

function clockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--';
  }
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as StatusResponse;
        if (alive) {
          setData(json);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="cyan">Live checks</Chip>
            <Chip tone="wire">devnet</Chip>
          </div>
          <h1 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
            Grid status
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cluster-white/70">
            Each bus below is probed server-side on load. Latency is a single
            measured round-trip, not an average. No uptime percentage is claimed
            here because nothing is measuring one yet.
          </p>

          <div className="mt-10 substation-panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-cyan-glow/10 px-5 py-3">
              <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/55">
                Bus
              </span>
              <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/55">
                Latency / checked
              </span>
            </div>

            {loading && !data ? (
              <div className="px-5 py-10 text-center font-mono-tech text-xs uppercase tracking-widest text-cluster-white/50">
                probing buses...
              </div>
            ) : error && !data ? (
              <div className="px-5 py-10 text-center font-mono-tech text-xs uppercase tracking-widest text-fog">
                status feed unreachable
              </div>
            ) : (
              <ul>
                {data?.rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 border-b border-cyan-glow/[0.06] px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor[row.state]}`}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm text-cluster-white">
                            {row.label}
                          </span>
                          <span className="font-mono-tech text-[9px] uppercase tracking-widest text-cluster-white/45">
                            {stateLabel[row.state]}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono-tech text-[11px] text-cluster-white/60">
                          {row.detail}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 pl-5 font-mono-tech text-[11px] text-cluster-white/80 sm:pl-0">
                      <span>{row.latencyMs == null ? '--' : formatMs(row.latencyMs)}</span>
                      <span className="text-cluster-white/45">{clockTime(row.checkedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 font-mono-tech text-[11px] text-cluster-white/50">
            <SafeLink href="/receipts" className="hover:text-cyan-glow">
              Settlement receipts -&gt;
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

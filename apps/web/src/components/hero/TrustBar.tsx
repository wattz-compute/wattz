'use client';

import { useQuery } from '@tanstack/react-query';
import { SafeLink } from '@/components/layout/SafeLink';
import { cn } from '@/lib/cn';
import { FLAGS } from '@/lib/flags';

// The stats contract served by GET /api/stats. Every value shown here is
// click-verifiable against the live gateway or the Solana explorer; nothing
// is fabricated and numbers render as em dashes until the fetch resolves.
interface StatsResponse {
  cluster: string;
  programId: string;
  anchorVersion: string;
  gateway: { status: 'ok' | 'down'; latencyMs: number | null; url: string };
  models: { relayLive: number; catalog: number };
  relay: { provider: string; active: boolean };
  externalNodes: number;
}

async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch('/api/stats', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
  return res.json();
}

const PROGRAM_ID =
  process.env.NEXT_PUBLIC_2_PROGRAM_ID ||
  'GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU';
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const GITHUB = process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';
const EXPLORER = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${CLUSTER}`;
const EM = '—';

interface Cell {
  label: string;
  value: string;
  href?: string;
  hint?: string;
}

// Optional chaining guards the case where the stats route has not yet been
// migrated to the contract above: unresolved fields render as em dashes rather
// than "undefined", and nothing is ever faked in.
function buildCells(data?: StatsResponse): Cell[] {
  const gw = data?.gateway;
  const gateway = !gw
    ? EM
    : gw.status === 'ok' && gw.latencyMs != null
      ? `ok / ${gw.latencyMs} ms`
      : gw.status ?? EM;

  const relayLive =
    data?.models?.relayLive != null
      ? `${data.models.relayLive} / ${data.models.catalog}`
      : EM;

  // First four are the strongest facts and are the only cells shown on mobile.
  return [
    {
      label: 'program id',
      value: `${PROGRAM_ID.slice(0, 4)}…${PROGRAM_ID.slice(-4)}`,
      href: EXPLORER,
    },
    { label: 'gateway', value: gateway },
    { label: 'relay-live models', value: relayLive },
    // Zero-width space marks the only allowed break point so the path never
    // splits mid-word in narrow cells.
    {
      label: 'openai wire',
      value: '/v1/chat/​completions',
      href: FLAGS.sdk ? '/docs' : `https://github.com/${GITHUB}`,
    },
    { label: 'relay', value: data?.relay?.provider ?? EM },
    {
      label: 'external nodes',
      value: data?.externalNodes != null ? `${data.externalNodes}` : EM,
      hint: 'registration open',
    },
    { label: 'anchor', value: data?.anchorVersion ?? EM },
    {
      label: 'source',
      value: GITHUB.replace('/', '/​'),
      href: `https://github.com/${GITHUB}`,
    },
  ];
}

export function TrustBar() {
  const { data } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 60_000,
  });
  const cells = buildCells(data);

  return (
    <div className="pointer-events-auto z-10 mx-auto mt-6 max-w-7xl px-6 md:absolute md:inset-x-0 md:bottom-6 md:mt-0">
      <div className="substation-panel rounded-2xl">
        <div className="scanlines relative grid grid-cols-2 gap-y-3 divide-y divide-cyan-glow/10 py-3 text-cluster-white md:grid-cols-4 md:divide-y-0 lg:grid-cols-8 lg:divide-x lg:divide-y-0">
          {cells.map((cell, i) => (
            <TrustCell key={cell.label} cell={cell} hideOnMobile={i >= 4} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TrustCell({ cell, hideOnMobile }: { cell: Cell; hideOnMobile: boolean }) {
  const value = (
    <span
      className={cn(
        'break-words font-mono-tech text-[12px] leading-tight text-cluster-white/90',
        cell.href && 'group-hover:text-cyan-glow',
      )}
    >
      {cell.value}
    </span>
  );

  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-3.5 py-1',
        hideOnMobile && 'hidden md:flex',
      )}
    >
      <span className="font-mono-tech text-[9px] uppercase tracking-[0.22em] text-cluster-white/45">
        {cell.label}
      </span>
      {cell.href ? (
        <SafeLink href={cell.href} className="group inline-flex items-center gap-1">
          {value}
          <span aria-hidden className="text-cyan-glow/50 group-hover:text-cyan-glow">
            &#8599;
          </span>
        </SafeLink>
      ) : (
        value
      )}
      {cell.hint ? (
        <span className="font-mono-tech text-[9px] lowercase tracking-wide text-cluster-white/40">
          {cell.hint}
        </span>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SafeLink } from '@/components/layout/SafeLink';
import { cn } from '@/lib/cn';

const operatorUrl =
  process.env.NEXT_PUBLIC_OPERATOR_URL || 'https://operator.wattz.fi';

const REGISTER_COMMAND = 'wattz node register --region us-east';

// Eight genesis slots on devnet. Every slot is open until a node registers
// on-chain; slot 001 is the genesis operator seat.
const slots = Array.from({ length: 8 }, (_, i) => {
  const number = String(i + 1).padStart(3, '0');
  return { number, genesis: i === 0 };
});

const split = [
  { label: 'node immediate', value: '80%', note: 'released on settlement' },
  { label: 'node pending', value: '10%', note: 'held through dispute window' },
  { label: 'model publisher', value: '5%', note: 'registry royalty' },
  { label: 'project fee', value: '5%', note: 'half burned on settlement' },
];

function CopyButton({
  text,
  label = 'copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 900);
    } catch {
      // Clipboard unavailable; text stays selectable.
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy to clipboard"
      className={cn(
        'shrink-0 rounded border border-cyan-glow/25 bg-night-deep/80 px-2 py-0.5 font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/70 transition-colors hover:border-cyan-glow/60 hover:text-cluster-white',
        className,
      )}
    >
      {copied ? 'copied' : label}
    </button>
  );
}

export default function OperatorPage() {
  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="cyan">Operator</Chip>
            <Chip tone="wire">devnet</Chip>
            <Chip tone="gold">registration live</Chip>
          </div>
          <h1 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
            Run a GPU node. Get paid per token.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cluster-white/70">
            Operators register a node on devnet and route inference through the
            settlement program. The Operator Dashboard is live at{' '}
            <SafeLink
              href={operatorUrl}
              className="text-cyan-glow hover:underline"
            >
              operator.wattz.fi
            </SafeLink>
            . Every seat below is open until a node claims it on-chain.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Genesis slot board */}
            <Card glow="cyan" className="lg:col-span-8">
              <div className="flex items-center justify-between">
                <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                  Node slots &mdash; genesis board
                </div>
                <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
                  devnet
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {slots.map((s) => (
                  <div
                    key={s.number}
                    className={cn(
                      'rounded-xl border bg-night-deep/40 p-4',
                      s.genesis
                        ? 'border-accent-gold/50 shadow-gold'
                        : 'border-cyan-glow/10',
                    )}
                  >
                    <div className="font-display text-lg text-cluster-white">
                      {s.number}
                    </div>
                    <div className="mt-2 flex items-center">
                      <span
                        className={
                          s.genesis ? 'chip gold text-[9px]' : 'chip text-[9px]'
                        }
                      >
                        <span className="dot" />
                        open
                      </span>
                    </div>
                    <div className="mt-2 font-mono-tech text-[10px] leading-4 text-cluster-white/55">
                      {s.genesis
                        ? 'Genesis operator seat'
                        : 'Registration live on devnet'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50">
                  Claim a slot
                </div>
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-cyan-glow/10 bg-night-deep/70 px-4 py-3">
                  <code className="grow break-all font-mono-tech text-[12px] text-cluster-white/85">
                    {REGISTER_COMMAND}
                  </code>
                  <CopyButton text={REGISTER_COMMAND} />
                </div>
                <p className="mt-3 text-xs leading-6 text-cluster-white/60">
                  Registration writes a node account against the settlement
                  program. This board reflects the genesis seats; no node has
                  registered yet.
                </p>
              </div>
            </Card>

            {/* Reference economics */}
            <Card glow="gold" className="lg:col-span-4">
              <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                Reference economics
              </div>
              <div className="mt-1 font-display text-sm text-cluster-white/80">
                Projections at target capacity
              </div>
              <div className="mt-4 space-y-3">
                {split.map((r) => (
                  <div
                    key={r.label}
                    className="flex items-baseline justify-between gap-3 border-b border-cyan-glow/[0.06] pb-2 last:border-b-0"
                  >
                    <div>
                      <div className="font-mono-tech text-[11px] text-cluster-white">
                        {r.label}
                      </div>
                      <div className="font-mono-tech text-[9px] uppercase tracking-widest text-cluster-white/45">
                        {r.note}
                      </div>
                    </div>
                    <div className="font-display text-lg text-cluster-white">
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 text-xs leading-6 text-cluster-white/60">
                <p>
                  Splits are fixed in the Anchor program constants. Half of the
                  project fee &mdash; 2.5% of every settled fee &mdash; is burned
                  via a direct SPL Token Burn CPI.
                </p>
                <p>
                  These are per-node projections, not earnings. No payout history
                  is shown: settlement runs on devnet and $WATTZ has not launched.
                </p>
              </div>
            </Card>

            {/* CLI onboarding */}
            <Card glow="wire" className="lg:col-span-12">
              <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                CLI onboarding
              </div>
              <pre className="mt-4 overflow-x-auto whitespace-pre rounded-xl border border-cyan-glow/10 bg-night-deep/70 px-4 py-4 font-mono-tech text-[12px] leading-6 text-cluster-white/85">
{`npm install -g wattz-cli
wattz node init --region us-east --gpu rtx-4090
wattz node keys generate
wattz node register
wattz node start --models llama-3.1-8b-instant
wattz node logs --follow`}
              </pre>
              <div className="mt-6 flex flex-wrap gap-3">
                <SafeLink href={operatorUrl} external>
                  <Button variant="primary">Open the Operator Dashboard</Button>
                </SafeLink>
                <SafeLink href="/docs">
                  <Button variant="ghost">Read the operator spec</Button>
                </SafeLink>
                <SafeLink href="/status">
                  <Button variant="ghost">Grid status</Button>
                </SafeLink>
              </div>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

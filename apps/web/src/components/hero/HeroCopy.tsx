'use client';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ClusterChip } from '@/components/ui/ClusterChip';
import { SafeLink } from '@/components/layout/SafeLink';

export function HeroCopy() {
  return (
    <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 pb-10 pt-28 md:pointer-events-none md:absolute md:inset-x-0 md:top-32 md:pb-0 md:pt-0">
      <div className="flex flex-wrap items-center gap-3 md:pointer-events-auto">
        <ClusterChip prefix="Solana" />
        <Chip tone="wire">OpenAI-compatible</Chip>
        <Chip tone="gold">Groq LPU relay</Chip>
      </div>

      <div className="max-w-3xl md:pointer-events-auto">
        <h1 className="font-display text-4xl leading-[1.05] text-cluster-white sm:text-5xl md:text-6xl">
          Power the inference.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-cluster-white/75 sm:text-lg">
          Point any OpenAI client at{' '}
          <code className="rounded bg-night/70 px-1.5 py-0.5 font-mono-tech text-[0.9em] text-cyan-glow">
            https://api.wattz.fi/v1
          </code>
          . Requests route through the gateway to verified capacity;
          settlement clears on Solana.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:pointer-events-auto">
        <SafeLink href="/playground">
          <Button size="lg" variant="primary">
            Try the playground
          </Button>
        </SafeLink>
        <SafeLink href="/docs">
          <Button size="lg" variant="ghost">
            Read the spec
          </Button>
        </SafeLink>
      </div>
    </div>
  );
}

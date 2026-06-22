'use client';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SafeLink } from '@/components/layout/SafeLink';

export function HeroCopy() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-24 z-10 mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 md:top-32">
      <div className="pointer-events-auto flex flex-wrap items-center gap-3">
        <Chip tone="cyan">Solana mainnet</Chip>
        <Chip tone="wire">OpenAI-compatible</Chip>
        <Chip tone="gold">TEE verified</Chip>
      </div>

      <div className="pointer-events-auto max-w-3xl">
        <h1 className="font-display text-4xl leading-[1.05] text-cluster-white sm:text-5xl md:text-6xl">
          Power the inference.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-cluster-white/75 sm:text-lg">
          Wattz is a Solana-native marketplace for AI inference. Sign in with
          any OpenAI client. Route to TEE-verified GPU nodes. Settle micro
          payments per token through Anchor. The substation is already awake.
        </p>
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center gap-3">
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

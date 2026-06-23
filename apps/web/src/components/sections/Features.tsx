import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';

const features = [
  {
    tag: 'Model registry',
    title: 'On-chain source of truth',
    lines: [
      'Every model publishes as a PDA with license, weights checksum, and version.',
      'Registry crawler scans license text at publish time. Commercial-only models are KYC-gated automatically.',
      'Supports Meta Llama Community, Apache 2.0, MIT, OpenRAIL-M, and custom license classes.',
    ],
    metrics: [
      { key: 'Registered models', value: 'Llama 3 - Mistral - SDXL - Whisper - GPT-OSS' },
      { key: 'License classes', value: '5 supported, extensible' },
    ],
    glow: 'cyan' as const,
  },
  {
    tag: 'Compute verification',
    title: 'TEE plus optional ZK',
    lines: [
      'GPU nodes execute under Intel SGX, AMD SEV, or NVIDIA Confidential Computing enclaves.',
      'Each response returns an attestation quote; skeptical clients may demand a Risc0 or SP1 receipt of the tokenizer path.',
      'Failed attestations trigger stake slashing through the Anchor dispute program.',
    ],
    metrics: [
      { key: 'Enclave targets', value: 'SGX / SEV / NVIDIA CC' },
      { key: 'ZK backends', value: 'Risc0 v1.1, SP1 v3.0' },
    ],
    glow: 'gold' as const,
  },
  {
    tag: 'Routing engine',
    title: 'Latency-aware and honest',
    lines: [
      'The router considers model availability, GPU class, regional latency, historical uptime, and price ceilings per call.',
      'Priority routing is bought with $WATTZ stake; slashing punishes region misreporting.',
      'Fallback logic transparently walks nodes so a single evicted GPU never breaks a session.',
    ],
    metrics: [
      { key: 'Global regions', value: 'US-East - US-West - EU - JP - SG' },
      { key: 'Cold routes', value: '<180 ms median start' },
    ],
    glow: 'cyan' as const,
  },
  {
    tag: 'Streaming payment',
    title: 'Token-2022 per-token settlement',
    lines: [
      'Every returned token triggers a transfer hook that debits $WATTZ from the caller and credits the node, model host, and treasury.',
      'Anchor mainnet settles bulk state hourly; disputes and refunds resolve on-chain.',
      'A single OpenAI request is one on-chain settlement, not one per token.',
    ],
    metrics: [
      { key: 'Settlement window', value: '3600 s bulk, per-call resolve' },
      { key: 'Fee split', value: 'Node 68 - Host 22 - Treasury 10' },
    ],
    glow: 'wire' as const,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <div className="max-w-2xl">
            <Chip tone="gold">Four busbars</Chip>
            <h2 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
              Every load routes through the same four pieces.
            </h2>
            <p className="mt-4 text-base leading-7 text-cluster-white/70">
              A model registry, verified compute, an honest router, and a
              streaming payment layer. Nothing else in the middle. Nothing
              proprietary at the edge.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {features.map((f, i) => (
            <ScrollReveal key={f.tag} delay={i * 80}>
              <Card glow={f.glow} className="h-full">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cyan-glow/85">
                      {f.tag}
                    </span>
                    <span className="chip warn text-[9px]">
                      <span className="dot" /> live
                    </span>
                  </div>
                  <div className="font-display text-2xl leading-snug text-cluster-white">
                    {f.title}
                  </div>
                  <ul className="mt-1 space-y-2 text-sm leading-6 text-cluster-white/70">
                    {f.lines.map((line, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="mt-2 h-[3px] w-3 shrink-0 rounded-full bg-cyan-glow/60" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 grid grid-cols-1 gap-2 border-t border-cyan-glow/10 pt-4 sm:grid-cols-2">
                    {f.metrics.map((m) => (
                      <div key={m.key} className="flex flex-col">
                        <span className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-cluster-white/50">
                          {m.key}
                        </span>
                        <span className="font-mono-tech text-xs text-cluster-white/90">
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

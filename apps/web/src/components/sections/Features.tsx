import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';

type Status = 'live' | 'devnet' | 'relay' | 'at TGE';

const statusTone: Record<Status, 'cyan' | 'wire' | 'gold' | 'muted'> = {
  live: 'cyan',
  devnet: 'cyan',
  relay: 'gold',
  'at TGE': 'muted',
};

const features = [
  {
    tag: 'Model registry',
    title: 'On-chain source of truth',
    status: 'devnet' as Status,
    lines: [
      'Every model publishes as a PDA with license, weights checksum, and version.',
      'The registry crawler scans license text at publish time; commercial-only weights are KYC-gated automatically.',
      'License classes cover Meta Llama Community, Apache 2.0, MIT, and OpenRAIL-M.',
    ],
    metrics: [
      { key: 'Catalog', value: '5 models, 3 relay-live' },
      { key: 'Licenses', value: 'Meta / Apache 2.0 / MIT / OpenRAIL-M' },
    ],
    glow: 'cyan' as const,
  },
  {
    tag: 'Compute verification',
    title: 'TEE plus optional ZK',
    status: 'relay' as Status,
    lines: [
      'Bare-metal GPU nodes run under Intel SGX, AMD SEV, or NVIDIA Confidential Computing, and each response carries an attestation quote.',
      'Until the first node registers, inference is relayed and marked kind "relay" with verified:false -- no attestation is invented.',
      'Once nodes are live, skeptical clients can demand a Risc0 or SP1 receipt of the tokenizer path.',
    ],
    metrics: [
      { key: 'Today', value: 'relay path, verified:false' },
      { key: 'On node register', value: 'SGX / SEV / NVIDIA CC' },
    ],
    glow: 'gold' as const,
  },
  {
    tag: 'Routing engine',
    title: 'Latency-aware and honest',
    status: 'relay' as Status,
    lines: [
      'The router matches each request against model availability, region latency, GPU class, and per-call price ceilings.',
      'Today all traffic routes to the Groq LPU relay; the wire protocol does not change when nodes join.',
      'Fallback walks candidates in order, so a single evicted node never breaks a session.',
    ],
    metrics: [
      { key: 'Today', value: 'routes to Groq LPU relay' },
      { key: 'Cold start', value: 'target: <200 ms' },
    ],
    glow: 'cyan' as const,
  },
  {
    tag: 'Streaming payment',
    title: 'Token-2022 per-token settlement',
    status: 'at TGE' as Status,
    lines: [
      'Each settled request splits its fee on-chain: 80% to the node immediately, 10% held as node pending, 5% to the model publisher, 5% project fee.',
      'Half of the project fee -- 2.5% of every settled fee -- is burned through a direct SPL Token Burn CPI.',
      'Token-2022 streaming settlement activates with the $WATTZ mint at launch; one request settles once, not once per token.',
    ],
    metrics: [
      { key: 'Fee split', value: 'Node 80, pending 10, pub 5, proj 5' },
      { key: 'Burn', value: '2.5% of every settled fee' },
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
                    <Chip tone={statusTone[f.status]} className="text-[9px]">
                      {f.status}
                    </Chip>
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

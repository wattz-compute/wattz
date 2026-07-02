import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';

const flow = [
  {
    step: '01',
    title: 'Client calls /v1/chat/completions',
    body: (
      <>
        Existing OpenAI SDKs just swap{' '}
        <code className="rounded bg-night/70 px-1.5 py-0.5 font-mono-tech text-[0.85em] text-cyan-glow">
          baseURL
        </code>
        . No new client library required. Streaming responses ride the same SSE
        contract as OpenAI.
      </>
    ),
  },
  {
    step: '02',
    title: 'Router picks the transformer',
    body: 'The routing engine matches the request against model availability, region latency, GPU class, and node reputation. Priority slots are staked with $WATTZ.',
  },
  {
    step: '03',
    title: 'Node executes inside a TEE',
    body: 'Selected GPU nodes execute under Intel SGX, AMD SEV, or NVIDIA Confidential Computing. Each response returns an attestation quote plus an optional Risc0 / SP1 receipt.',
  },
  {
    step: '04',
    title: 'Token-2022 streams payment',
    body: 'Per-token cost is settled through a Token-2022 transfer hook, meter by meter. Refunds and disputes settle through the Anchor settlement program (devnet today).',
  },
  {
    step: '05',
    title: 'Model registry stays honest',
    body: 'Every model lives as a PDA with license, checksum, and version. Registry publish scans license text and gates commercial-only models behind KYC.',
  },
  {
    step: '06',
    title: 'Bootstrap nodes keep the grid warm',
    body: 'Bootstrap capacity keeps the grid warm. Today that is a Groq LPU relay; Wattz-operated bare-metal nodes join the pool as they come online.',
  },
];

export function SolutionSection() {
  return (
    <section id="solution" className="relative py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-wire-glow/[0.05] to-transparent mix-blend-screen" />
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <div className="max-w-3xl">
            <Chip tone="cyan">The substation</Chip>
            <h2 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
              One protocol. Six busbars. Every AI dApp gets the same wiring.
            </h2>
            <p className="mt-4 text-base leading-7 text-cluster-white/70">
              Wattz is not another GPU rental service. It is the first
              inference marketplace built to speak the OpenAI dialect Solana
              already understands.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {flow.map((f, i) => (
            <ScrollReveal key={f.step} delay={i * 70}>
              <Card glow={i % 2 === 0 ? 'cyan' : 'gold'}>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cyan-glow/85">
                    step {f.step}
                  </span>
                </div>
                <div className="mt-4 font-display text-xl text-cluster-white">
                  {f.title}
                </div>
                <p className="mt-3 text-sm leading-6 text-cluster-white/70">
                  {f.body}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

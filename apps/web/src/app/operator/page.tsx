import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SafeLink } from '@/components/layout/SafeLink';

const twitter = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';

const bootstrap = [
  {
    id: 'wattz-bootstrap-01',
    label: 'US-East - RTX 4090 x2',
    uptime: '312 h',
    tflops: 82,
    models: 'Llama 3 8B, Whisper',
    status: 'live',
  },
  {
    id: 'wattz-bootstrap-02',
    label: 'JP-Tokyo - H100 80GB',
    uptime: '204 h',
    tflops: 141,
    models: 'Stable Diffusion XL, Mistral 7B',
    status: 'live',
  },
  {
    id: 'wattz-community-03',
    label: 'EU-Frankfurt - A6000',
    uptime: '58 h',
    tflops: 44,
    models: 'Mistral 7B, GPT-OSS',
    status: 'bootstrap',
  },
];

const revenue = [
  { label: '24h payout', value: '482.31 $WATTZ' },
  { label: '7d payout', value: '3,610.44 $WATTZ' },
  { label: 'Avg latency', value: '218 ms' },
  { label: 'Success rate', value: '99.62%' },
  { label: 'Slashing bond', value: '25,000 $WATTZ' },
  { label: 'Dispute risk', value: 'Low' },
];

export default function OperatorPage() {
  return (
    <>
      <Header />
      <main className="relative pt-28 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="cyan">Operator preview</Chip>
            <Chip tone="wire">Bootstrap live</Chip>
            <Chip tone="gold">CLI ready</Chip>
          </div>
          <h1 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
            Run a GPU node. Get paid per token.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-cluster-white/70">
            Wattz operators register a node, stake $WATTZ, and start earning
            immediately. The full Operator Dashboard ships in Phase 3. This
            page previews the shape of it and the current bootstrap fleet.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card glow="gold" className="lg:col-span-4">
              <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                Operator revenue
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {revenue.map((r) => (
                  <div key={r.label}>
                    <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/50">
                      {r.label}
                    </div>
                    <div className="mt-0.5 font-mono-tech text-sm text-cluster-white">
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2 text-xs text-cluster-white/70">
                <p>
                  Payouts settle every hour through the Anchor settlement
                  program. Slashing bond is escrowed on-chain; dispute votes
                  can burn it.
                </p>
              </div>
            </Card>

            <Card glow="cyan" className="lg:col-span-8">
              <div className="flex items-center justify-between">
                <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                  Fleet
                </div>
                <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/45">
                  {bootstrap.length} nodes tracked
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {bootstrap.map((n) => (
                  <div
                    key={n.id}
                    className="flex flex-col gap-2 rounded-xl border border-cyan-glow/10 bg-night-deep/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm text-cluster-white">
                          {n.label}
                        </span>
                        <span
                          className={
                            n.status === 'live'
                              ? 'chip text-[9px]'
                              : 'chip warn text-[9px]'
                          }
                        >
                          <span className="dot" />
                          {n.status}
                        </span>
                      </div>
                      <span className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                        {n.id}
                      </span>
                      <span className="font-mono-tech text-[11px] text-cluster-white/80">
                        Models: {n.models}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 font-mono-tech text-[11px] text-cluster-white/85">
                      <span>Uptime {n.uptime}</span>
                      <span>{n.tflops} TFLOPS</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card glow="wire" className="lg:col-span-12">
              <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60">
                CLI onboarding
              </div>
              <pre className="mt-4 whitespace-pre overflow-x-auto rounded-xl border border-cyan-glow/10 bg-night-deep/70 px-4 py-4 font-mono-tech text-[12px] leading-6 text-cluster-white/85">
{`npm install -g wattz-cli
wattz node init --region us-east --gpu rtx-4090
wattz node keys generate
wattz node stake 25000
wattz node start --models llama-3-8b,mistral-7b
wattz node logs --follow`}
              </pre>
              <div className="mt-6 flex flex-wrap gap-3">
                <SafeLink href="/docs">
                  <Button variant="ghost">Read the operator spec</Button>
                </SafeLink>
                <SafeLink href={`https://x.com/${twitter}`} external>
                  <Button variant="wire">Join the operator lounge</Button>
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

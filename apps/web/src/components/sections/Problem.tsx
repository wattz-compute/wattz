import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';

const gaps = [
  {
    tag: 'IaaS only',
    title: 'GPU rentals are not inference',
    body: 'io.net and its peers rent bare compute. There is no OpenAI-compatible surface, no model registry, no license enforcement.',
  },
  {
    tag: 'Registry gap',
    title: 'No shared model registry',
    body: 'Llama 3, Mistral, Stable Diffusion, and Whisper each ship with distinct licenses. Solana has no canonical way to publish and version them on-chain.',
  },
  {
    tag: 'Trust gap',
    title: 'Nodes cannot prove they computed',
    body: 'Renters take GPU logs at face value. Without TEE attestation or ZK proof, a dishonest node can return anything it wants.',
  },
  {
    tag: 'Routing gap',
    title: 'No native routing',
    body: 'Which GPU, which region, which model, which price? Every dApp has to invent its own router. There is no protocol layer.',
  },
  {
    tag: 'Payment gap',
    title: 'Per-token payments are absent',
    body: 'Inference cost is measured in tokens, not epochs. Without Token-2022 transfer hooks, teams overpay through 30-day invoices.',
  },
  {
    tag: 'Fleet gap',
    title: 'Consumer + DC fleets are siloed',
    body: 'Home RTX 4090s and H100 racks should share load. Instead they run on different rails with different economics.',
  },
];

export function ProblemSection() {
  return (
    <section id="problem" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <ScrollReveal>
          <div className="max-w-2xl">
            <Chip tone="wire">The gap</Chip>
            <h2 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
              Solana has liquidity, users, and GPUs. It does not have an
              inference standard.
            </h2>
            <p className="mt-4 text-base leading-7 text-cluster-white/70">
              Every existing piece was solved by someone. Nothing was solved
              together. Six concrete gaps make AI on Solana feel improvised.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {gaps.map((g, i) => (
            <ScrollReveal key={g.tag} delay={i * 60}>
              <Card>
                <div className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cyan-glow/85">
                  {g.tag}
                </div>
                <div className="mt-3 font-display text-xl text-cluster-white">
                  {g.title}
                </div>
                <p className="mt-3 text-sm leading-6 text-cluster-white/70">
                  {g.body}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

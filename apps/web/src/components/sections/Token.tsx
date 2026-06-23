import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { projectCa } from '@/lib/solana';

const distribution = [
  { name: 'Node operators', value: 34, description: 'Long-tail rewards + slashing bond' },
  { name: 'Model hosters', value: 18, description: 'Publish Llama, Mistral, and community models' },
  { name: 'Treasury', value: 20, description: 'Bootstrap nodes, grants, security audits' },
  { name: 'Public sale', value: 14, description: 'On-chain public tranche via Anchor' },
  { name: 'Team / Contributors', value: 8, description: 'Four-year vesting, one-year cliff' },
  { name: 'Ecosystem grants', value: 6, description: 'IDE integrations and OSS SDKs' },
];

const utilities = [
  {
    title: '50% inference fee buyback burn',
    body: 'Half of every settled inference fee is used to market-buy $WATTZ and burn. The rest funds nodes, hosters, and treasury.',
  },
  {
    title: 'Node staking + slashing',
    body: 'Operators post $WATTZ collateral. Bad attestations, region misreporting, or dropped sessions trigger dispute-driven slashing.',
  },
  {
    title: 'Priority routing lane',
    body: 'Callers may stake $WATTZ for a priority queue - low-latency slots ahead of best-effort load.',
  },
  {
    title: 'Dispute governance',
    body: 'Any settlement can be disputed on Anchor. $WATTZ holders vote on complex judgments, resolvers earn micro fees.',
  },
];

export function TokenSection() {
  const ca = projectCa();
  return (
    <section id="token" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <ScrollReveal className="lg:col-span-5">
            <Chip tone="gold">$WATTZ</Chip>
            <h2 className="mt-6 font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
              The meter is the token.
            </h2>
            <p className="mt-4 text-base leading-7 text-cluster-white/70">
              Every inference call is a small transaction. Every token returned
              is a small settlement. Value accrual is a function of throughput,
              not narrative.
            </p>

            {ca ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Chip tone="gold">CA</Chip>
                <code className="font-mono-tech text-xs text-cluster-white/85">{ca}</code>
              </div>
            ) : (
              <div className="mt-8">
                <Chip tone="muted">CA reveals at launch</Chip>
              </div>
            )}

            <div className="mt-10 space-y-4">
              {utilities.map((u) => (
                <div
                  key={u.title}
                  className="border-l-2 border-cyan-glow/40 pl-4 text-cluster-white/85"
                >
                  <div className="font-display text-lg text-cluster-white">
                    {u.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-cluster-white/70">
                    {u.body}
                  </p>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal className="lg:col-span-7" delay={80}>
            <Card glow="gold">
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cluster-white/60">
                Distribution
              </div>
              <div className="mt-4 space-y-3">
                {distribution.map((d) => (
                  <div key={d.name}>
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm text-cluster-white">
                          {d.name}
                        </span>
                        <span className="font-mono-tech text-[10px] uppercase tracking-widest text-fog">
                          {d.description}
                        </span>
                      </div>
                      <div className="font-mono-tech text-sm text-cluster-white">
                        {d.value}%
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-night-deep">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-glow via-wire-glow to-accent-gold"
                        style={{ width: `${d.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-cyan-glow/10 pt-6 sm:grid-cols-4">
                <MetaRow label="Total supply" value="1,000,000,000" />
                <MetaRow label="Emission" value="Zero fresh mint" />
                <MetaRow label="Mint auth" value="Revoked at TGE" />
                <MetaRow label="Standard" value="Token-2022" />
              </div>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-cluster-white/55">
        {label}
      </div>
      <div className="font-mono-tech text-sm text-cluster-white">{value}</div>
    </div>
  );
}

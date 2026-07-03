import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CopyAddress } from '@/components/ui/CopyAddress';
import { projectCa } from '@/lib/solana';

const distribution = [
  { name: 'Node operators', value: 34, description: 'Long-tail rewards + slashing bond' },
  { name: 'Model hosters', value: 18, description: 'Publish Llama, GPT-OSS, and community models' },
  { name: 'Treasury', value: 20, description: 'Bootstrap nodes, grants, security audits' },
  { name: 'Public sale', value: 14, description: 'On-chain public tranche via Anchor' },
  { name: 'Team / Contributors', value: 8, description: 'Four-year vesting, one-year cliff' },
  { name: 'Ecosystem grants', value: 6, description: 'IDE integrations and OSS SDKs' },
];

const utilities: { title: string; body: string; tag?: string }[] = [
  {
    title: 'Node stake collateral',
    body: 'Operators post $WATTZ to register a node -- a protocol minimum of 100 $WATTZ, locked for 7 days. Bad attestations and dropped sessions are slashed, and the slashed stake is burned.',
  },
  {
    title: 'Fee burn on every settlement',
    body: 'Each settled inference splits its fee 80/10/5/5 across node, node pending, model publisher, and project. Half of the project fee -- 2.5% of every settled fee -- is burned through a direct SPL Token Burn CPI.',
  },
  {
    title: 'Model publishing',
    body: 'Registering a model to the on-chain registry stakes the publisher share; that publisher then earns 5% of every settlement routed to the model.',
  },
  {
    title: 'Priority routing lane',
    tag: 'planned',
    body: 'A stake-weighted low-latency lane is a design intent, not live. Routing today scores price, latency, reputation, and region only.',
  },
  {
    title: 'Community dispute resolution',
    tag: 'at TGE',
    body: 'Holder-voted judgments on disputed settlements are planned for TGE. On devnet, disputes resolve inside a one-hour window under admin control.',
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
              <div className="mt-8 flex flex-col gap-3">
                <Chip tone="gold">$WATTZ CA</Chip>
                <CopyAddress address={ca} />
              </div>
            ) : (
              <div className="mt-8">
                <Chip tone="muted">CA reveals at launch</Chip>
              </div>
            )}

            <FeeFlow />

            <div className="mt-10 space-y-4">
              {utilities.map((u) => (
                <div
                  key={u.title}
                  className="border-l-2 border-cyan-glow/40 pl-4 text-cluster-white/85"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-lg text-cluster-white">
                      {u.title}
                    </div>
                    {u.tag ? (
                      <Chip tone="muted" className="text-[9px]">
                        {u.tag}
                      </Chip>
                    ) : null}
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

const CYAN = '#5BC0EB';
const GOLD = '#D4AF37';
const WIRE = '#FFD93D';

// Busbar-style diagram of how a single settled fee is split on-chain, with the
// burn leg drawn as half of the project fee. Values mirror the anchor program.
function FeeFlow() {
  const legs = [
    { cx: 96, pct: '80%', label: 'node', color: CYAN, softColor: 'rgba(91,192,235,0.55)' },
    { cx: 248, pct: '10%', label: 'node pending', color: 'rgba(91,192,235,0.55)', softColor: 'rgba(91,192,235,0.4)' },
    { cx: 400, pct: '5%', label: 'model publisher', color: GOLD, softColor: 'rgba(212,175,55,0.5)' },
    { cx: 552, pct: '5%', label: 'project fee', color: GOLD, softColor: 'rgba(212,175,55,0.5)' },
  ];

  return (
    <div className="mt-8 rounded-xl border border-cyan-glow/10 bg-night-deep/40 p-4">
      <div className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cluster-white/55">
        Per-settlement fee routing
      </div>
      <svg
        viewBox="0 0 640 178"
        className="mt-3 w-full"
        role="img"
        aria-label="Each settled fee splits into node 80 percent, node pending 10 percent, model publisher 5 percent, and project 5 percent. Half of the project fee, 2.5 percent, is burned."
      >
        {/* Incoming busbar carrying 100% of the settled fee */}
        <text x="24" y="15" className="font-mono-tech" fill="#F0EAD6" fillOpacity="0.7" fontSize="10">
          settled fee 100%
        </text>
        <line x1="24" y1="28" x2="616" y2="28" stroke={CYAN} strokeOpacity="0.5" strokeWidth="2" />
        <circle cx="24" cy="28" r="3" fill={CYAN} />

        {legs.map((leg) => (
          <g key={leg.label}>
            <circle cx={leg.cx} cy="28" r="2.5" fill={leg.softColor} />
            <line x1={leg.cx} y1="28" x2={leg.cx} y2="64" stroke={leg.softColor} strokeWidth="1.4" />
            <rect
              x={leg.cx - 59}
              y="64"
              width="118"
              height="40"
              rx="6"
              fill={leg.color}
              fillOpacity="0.08"
              stroke={leg.color}
              strokeOpacity="0.55"
            />
            <text
              x={leg.cx}
              y="85"
              textAnchor="middle"
              className="font-mono-tech"
              fill="#F0EAD6"
              fontSize="15"
            >
              {leg.pct}
            </text>
            <text
              x={leg.cx}
              y="98"
              textAnchor="middle"
              className="font-mono-tech"
              fill="#8B8680"
              fontSize="8.5"
            >
              {leg.label}
            </text>
          </g>
        ))}

        {/* Burn leg: half of the project fee is burned via a Token Burn CPI */}
        <line x1="552" y1="104" x2="552" y2="130" stroke={WIRE} strokeOpacity="0.6" strokeWidth="1.4" />
        <rect
          x="493"
          y="130"
          width="118"
          height="38"
          rx="6"
          fill={WIRE}
          fillOpacity="0.1"
          stroke={WIRE}
          strokeOpacity="0.6"
        />
        <text x="552" y="150" textAnchor="middle" className="font-mono-tech" fill="#F0EAD6" fontSize="14">
          2.5%
        </text>
        <text x="552" y="162" textAnchor="middle" className="font-mono-tech" fill="#8B8680" fontSize="8.5">
          burn / SPL CPI
        </text>
      </svg>
    </div>
  );
}

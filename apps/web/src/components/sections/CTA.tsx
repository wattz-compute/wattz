import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Button } from '@/components/ui/Button';
import { SafeLink } from '@/components/layout/SafeLink';
import { Chip } from '@/components/ui/Chip';

const twitter = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';
const github = process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';
const programId = process.env.NEXT_PUBLIC_2_PROGRAM_ID || '';
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const explorerHref = programId
  ? `https://explorer.solana.com/address/${programId}?cluster=${cluster}`
  : 'https://explorer.solana.com/';

export function CtaSection() {
  return (
    <section id="cta" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <div className="substation-panel rounded-3xl px-8 py-14 text-center sm:px-16">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
              <Chip tone="wire">Substation online</Chip>
              <h2 className="font-display text-3xl leading-tight text-cluster-white sm:text-4xl">
                Try one inference. Then swap your OpenAI baseURL.
              </h2>
              <p className="text-base leading-7 text-cluster-white/70">
                The playground streams live from the gateway at{' '}
                <code className="font-mono-tech text-cluster-white">
                  https://api.wattz.fi/v1
                </code>
                . Point your existing OpenAI SDK at the same base URL and keep
                every call you already have.
              </p>
              <p className="max-w-xl font-mono-tech text-xs leading-6 text-cluster-white/45">
                Inference is relayed through Groq LPU capacity until the first
                bare-metal node registers. The wire protocol does not change.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <SafeLink href="/playground">
                  <Button size="lg">Try the playground</Button>
                </SafeLink>
                <SafeLink href="/docs">
                  <Button size="lg" variant="ghost">
                    Read the spec
                  </Button>
                </SafeLink>
                <SafeLink href={`https://x.com/${twitter}`}>
                  <Button size="lg" variant="wire">
                    Follow on X
                  </Button>
                </SafeLink>
              </div>

              <div className="mt-8 grid w-full grid-cols-1 gap-4 border-t border-cyan-glow/10 pt-8 sm:grid-cols-3">
                <MicroLink
                  label="GitHub"
                  href={`https://github.com/${github}`}
                  hint={github.split('/').pop() || 'wattz'}
                />
                <MicroLink
                  label="Explorer"
                  href={explorerHref}
                  hint={programId ? `program ${programId.slice(0, 4)}...${programId.slice(-4)}` : 'Anchor 0.31'}
                />
                <MicroLink label="Operator" href="/operator" hint="Node onboarding" />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

function MicroLink({ label, href, hint }: { label: string; href: string; hint: string }) {
  return (
    <SafeLink
      href={href}
      className="group flex flex-col items-center gap-1 rounded-xl border border-cyan-glow/10 bg-night-deep/40 py-4 text-cluster-white/80 hover:border-cyan-glow/50"
    >
      <span className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-cluster-white/60">
        {label}
      </span>
      <span className="font-display text-sm group-hover:text-cyan-glow">{hint}</span>
    </SafeLink>
  );
}

import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Button } from '@/components/ui/Button';
import { SafeLink } from '@/components/layout/SafeLink';
import { Chip } from '@/components/ui/Chip';

const twitter = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';
const github =
  process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';

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
                The playground streams Llama 3 through a live gateway. When you
                are ready, point your existing OpenAI SDK at{' '}
                <code className="font-mono-tech text-cluster-white">
                  https://api.wattz.fi/v1
                </code>{' '}
                and keep every OpenAI call you already have.
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
                  hint="wattz-inference-gateway"
                />
                <MicroLink label="Explorer" href="https://explorer.solana.com/" hint="Anchor 0.31" />
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

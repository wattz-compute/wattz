import { SafeLink } from './SafeLink';
import { CopyAddress } from '@/components/ui/CopyAddress';
import { projectCa } from '@/lib/solana';

const twitter = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';
const github = process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';
const programId = process.env.NEXT_PUBLIC_2_PROGRAM_ID || '';
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const explorerHref = programId
  ? `https://explorer.solana.com/address/${programId}?cluster=${cluster}`
  : 'https://explorer.solana.com/';

export function Footer() {
  const ca = projectCa();
  return (
    <footer className="relative border-t border-cyan-glow/10 bg-night-deep/60 pt-16 pb-10">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-display text-2xl text-cluster-white">wattz</div>
          <p className="mt-4 max-w-md text-sm leading-6 text-fog">
            Solana-native AI inference marketplace. OpenAI-compatible API, PDA
            model registry, TEE-verified compute, and Token-2022 streaming
            payments. Power the inference.
          </p>
          {ca ? (
            <div className="mt-6 flex flex-col gap-3">
              <span className="chip gold text-[10px]">
                <span className="dot" /> $WATTZ CA
              </span>
              <CopyAddress address={ca} />
            </div>
          ) : null}
        </div>

        <div>
          <div className="font-mono-tech text-xs uppercase tracking-widest text-cluster-white/60">
            Product
          </div>
          <ul className="mt-4 space-y-3 text-sm text-cluster-white/85">
            <li>
              <SafeLink href="/playground" className="hover:text-cyan-glow">
                Inference Playground
              </SafeLink>
            </li>
            <li>
              <SafeLink href="/operator" className="hover:text-cyan-glow">
                Operator Dashboard
              </SafeLink>
            </li>
            <li>
              <SafeLink href="/docs" className="hover:text-cyan-glow">
                Docs
              </SafeLink>
            </li>
          </ul>
        </div>

        <div>
          <div className="font-mono-tech text-xs uppercase tracking-widest text-cluster-white/60">
            Network
          </div>
          <ul className="mt-4 space-y-3 text-sm text-cluster-white/85">
            <li>
              <SafeLink
                href={`https://github.com/${github}`}
                className="hover:text-cyan-glow"
              >
                GitHub
              </SafeLink>
            </li>
            <li>
              <SafeLink
                href={`https://x.com/${twitter}`}
                className="hover:text-cyan-glow"
              >
                X / @{twitter}
              </SafeLink>
            </li>
            <li>
              <SafeLink
                href={explorerHref}
                className="hover:text-cyan-glow"
              >
                Solana Explorer
              </SafeLink>
            </li>
          </ul>
        </div>
      </div>

      {programId ? (
        <div className="mx-auto mt-10 max-w-7xl px-6">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-cyan-glow/10 bg-night-deep/40 px-4 py-3">
            <span className="chip gold text-[10px]">
              <span className="dot" /> program id
            </span>
            <code className="break-all font-mono-tech text-xs text-cluster-white/85">
              {programId}
            </code>
            <SafeLink
              href={explorerHref}
              className="ml-auto font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/60 hover:text-cyan-glow"
            >
              View on Explorer -&gt;
            </SafeLink>
          </div>
        </div>
      ) : null}

      <div className="mx-auto mt-12 max-w-7xl px-6">
        <div className="wire-divider" />
        <div className="mt-6 flex flex-col items-start justify-between gap-3 text-xs text-fog md:flex-row md:items-center">
          <span>
            Wattz is public infrastructure. Nothing on this site is financial
            advice.
          </span>
          <span className="font-mono-tech uppercase tracking-widest">
            Solana {cluster} -- Anchor 0.31 -- OpenAI 1.0 spec
          </span>
        </div>
      </div>
    </footer>
  );
}

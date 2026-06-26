import { SafeLink } from './SafeLink';

export function Footer() {
  const twitter = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';
  const github = process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';
  const ca = process.env.NEXT_PUBLIC_0_PROJECT_CA;

  return (
    <footer className="mt-24 border-t border-cyan/10 bg-navy/70">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="font-display text-lg uppercase tracking-[0.24em] text-cluster">
              Wattz <span className="text-cyan">Operator</span>
            </div>
            <p className="mt-3 text-xs text-fog">
              Node dashboard. Live uptime, revenue, model roster, and reward claiming for the
              Wattz Solana AI inference marketplace.
            </p>
          </div>
          <div>
            <div className="metric-label mb-3">Resources</div>
            <ul className="space-y-2 text-sm text-cluster/80">
              <li>
                <SafeLink external href="https://wattz.fi/docs" className="hover:text-cyan">
                  Documentation
                </SafeLink>
              </li>
              <li>
                <SafeLink external href="https://wattz.fi" className="hover:text-cyan">
                  Landing site
                </SafeLink>
              </li>
              <li>
                <SafeLink href="/models" className="hover:text-cyan">
                  Model registry
                </SafeLink>
              </li>
            </ul>
          </div>
          <div>
            <div className="metric-label mb-3">Community</div>
            <ul className="space-y-2 text-sm text-cluster/80">
              <li>
                <SafeLink external href={`https://x.com/${twitter}`} className="hover:text-cyan">
                  X / @{twitter}
                </SafeLink>
              </li>
              <li>
                <SafeLink
                  external
                  href={`https://github.com/${github}`}
                  className="hover:text-cyan"
                >
                  GitHub
                </SafeLink>
              </li>
            </ul>
          </div>
          <div>
            <div className="metric-label mb-3">Contract</div>
            {ca && ca.length > 0 ? (
              <code className="block break-all rounded border border-cyan/20 bg-shadow px-3 py-2 text-xs text-cluster/90">
                {ca}
              </code>
            ) : (
              <p className="text-xs text-fog">Ticker CA will publish after launch.</p>
            )}
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-cyan/10 pt-6 text-xs text-fog md:flex-row md:items-center">
          <span>Power the inference.</span>
          <span>Wattz Labs. Solana mainnet. Apache-2.0.</span>
        </div>
      </div>
    </footer>
  );
}

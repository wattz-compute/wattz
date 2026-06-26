'use client';

import dynamic from 'next/dynamic';
import { SafeLink } from './SafeLink';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <span className="text-xs uppercase tracking-widest text-fog">wallet: -</span> },
);

const NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Overview' },
  { href: '/models', label: 'Models' },
  { href: '/rewards', label: 'Rewards' },
  { href: '/stake', label: 'Stake' },
];

export function Header() {
  const twitter = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';
  const github = process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';

  return (
    <header className="sticky top-0 z-30 border-b border-cyan/10 bg-navy/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <SafeLink href="/" className="flex items-center gap-3">
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan/40 bg-shadow shadow-cyan-glow">
              <span className="h-2 w-2 rounded-full bg-cyan animate-pulse" />
            </span>
            <span className="font-display text-lg uppercase tracking-[0.28em] text-cluster">
              Wattz <span className="text-cyan">Operator</span>
            </span>
          </SafeLink>
          <nav className="hidden gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <SafeLink
                key={link.href}
                href={link.href}
                className="text-xs uppercase tracking-[0.24em] text-fog transition-colors hover:text-cyan"
              >
                {link.label}
              </SafeLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <SafeLink
            external
            href={`https://x.com/${twitter}`}
            className="hidden text-xs uppercase tracking-[0.24em] text-fog hover:text-cyan md:inline-block"
          >
            X / {twitter}
          </SafeLink>
          <SafeLink
            external
            href={`https://github.com/${github}`}
            className="hidden text-xs uppercase tracking-[0.24em] text-fog hover:text-cyan md:inline-block"
          >
            GitHub
          </SafeLink>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { SafeLink } from './SafeLink';
import { cn } from '@/lib/cn';

const WalletMultiButton = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <ConnectPlaceholder /> },
);

const twitter = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';
const github =
  process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';

const nav = [
  { href: '/#solution', label: 'Solution' },
  { href: '/#features', label: 'Features' },
  { href: '/#token', label: 'Token' },
  { href: '/playground', label: 'Playground' },
  { href: '/operator', label: 'Operator' },
  { href: '/docs', label: 'Docs' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-30 transition-colors duration-500',
        scrolled
          ? 'border-b border-cyan-glow/10 bg-night-deep/80 backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <SafeLink href="/" className="flex items-center gap-3 group">
          <LogoMark />
          <span className="font-display text-lg tracking-tight text-cluster-white">
            wattz
          </span>
          <span className="chip text-[10px] hidden sm:inline-flex">
            <span className="dot" /> mainnet
          </span>
        </SafeLink>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <SafeLink
              key={item.href}
              href={item.href}
              className="font-mono-tech text-[13px] uppercase tracking-widest text-cluster-white/70 hover:text-cluster-white"
            >
              {item.label}
            </SafeLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <SafeLink
            href={`https://x.com/${twitter}`}
            aria-label="Wattz on X"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-cyan-glow/20 text-cluster-white/80 hover:border-cyan-glow/60 sm:flex"
          >
            <XIcon />
          </SafeLink>
          <SafeLink
            href={`https://github.com/${github}`}
            aria-label="Wattz on GitHub"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-cyan-glow/20 text-cluster-white/80 hover:border-cyan-glow/60 sm:flex"
          >
            <GithubIcon />
          </SafeLink>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 32 32"
      fill="none"
      className="text-cyan-glow"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="26" height="20" rx="1.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <rect x="7" y="10" width="7" height="12" rx="0.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1" />
      <rect x="18" y="10" width="7" height="12" rx="0.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1" />
      <path d="M10.5 22V26M21.5 22V26" stroke="#FFD93D" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M3 16H29" stroke="currentColor" strokeWidth="0.7" strokeDasharray="1 3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.25 2.25h6.906l4.713 6.231 5.375-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.11-.75.4-1.26.72-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.35.77 1.05.77 2.13v3.16c0 .31.21.68.8.56C20.21 21.4 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function ConnectPlaceholder() {
  return (
    <button className="ghost rounded-md px-4 py-2 font-mono-tech text-xs uppercase tracking-widest" disabled>
      Loading...
    </button>
  );
}

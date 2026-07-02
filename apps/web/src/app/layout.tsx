import type { Metadata, Viewport } from 'next';
import { Inter, Space_Mono, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/providers/Providers';
import { BackgroundMusic } from '@/components/layout/BackgroundMusic';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://wattz.fi';
const twitterHandle = process.env.NEXT_PUBLIC_TWITTER || 'wattzfi';
const githubRepo = process.env.NEXT_PUBLIC_GITHUB || 'wattz-compute/wattz';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Wattz',
      url: siteUrl,
      logo: `${siteUrl}/logo.svg`,
      description:
        'Solana-native AI inference marketplace with an OpenAI-compatible API.',
      sameAs: [
        `https://x.com/${twitterHandle}`,
        `https://github.com/${githubRepo}`,
      ],
    },
    {
      '@type': 'WebSite',
      name: 'Wattz',
      url: siteUrl,
    },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'Wattz -- Power the inference.',
    template: '%s -- Wattz',
  },
  description:
    'Wattz is a Solana-native AI inference marketplace. OpenAI-compatible API, TEE-verified compute, PDA model registry, and Token-2022 streaming micro payments.',
  metadataBase: new URL(siteUrl),
  applicationName: 'Wattz',
  keywords: [
    'Solana',
    'AI inference',
    'GPU marketplace',
    'OpenAI-compatible',
    'TEE',
    'Model Registry',
    'Anchor',
    'Token-2022',
  ],
  openGraph: {
    title: 'Wattz -- Power the inference.',
    description:
      'Solana AI inference marketplace. OpenAI-compatible API, TEE-verified compute, PDA model registry, Token-2022 streaming payments.',
    url: siteUrl,
    siteName: 'Wattz',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Wattz' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wattz -- Power the inference.',
    description:
      'Solana AI inference marketplace. OpenAI-compatible API, TEE verification, model registry, streaming Token-2022 payments.',
    site: `@${twitterHandle}`,
    creator: `@${twitterHandle}`,
    images: ['/og.png'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0A0E27',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          {children}
          <BackgroundMusic />
        </Providers>
      </body>
    </html>
  );
}

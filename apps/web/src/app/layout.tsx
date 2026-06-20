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
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'Wattz' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wattz -- Power the inference.',
    description:
      'Solana AI inference marketplace. OpenAI-compatible API, TEE verification, model registry, streaming Token-2022 payments.',
    creator: `@${process.env.NEXT_PUBLIC_TWITTER || 'wattzfi'}`,
    images: ['/og.svg'],
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
        <Providers>
          {children}
          <BackgroundMusic />
        </Providers>
      </body>
    </html>
  );
}

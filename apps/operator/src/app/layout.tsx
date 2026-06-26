import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Mono } from 'next/font/google';
import './globals.css';

import { WalletProvider } from '@/providers/WalletProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BackgroundMusic } from '@/components/layout/BackgroundMusic';

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
});
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wattz Operator Dashboard',
  description:
    'Operate a Wattz GPU inference node on Solana. Track uptime, revenue, model roster, and claim rewards.',
  openGraph: {
    title: 'Wattz Operator Dashboard',
    description: 'Solana AI inference marketplace. Operator control plane.',
    url: 'https://operator.wattz.fi',
    siteName: 'Wattz Operator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wattz Operator Dashboard',
    description: 'Solana AI inference marketplace. Operator control plane.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <WalletProvider>
          <QueryProvider>
            <Header />
            <main className="mx-auto min-h-[calc(100vh-64px)] max-w-7xl px-6 py-10">
              {children}
            </main>
            <Footer />
            <BackgroundMusic />
          </QueryProvider>
        </WalletProvider>
      </body>
    </html>
  );
}

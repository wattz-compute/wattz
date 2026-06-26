'use client';

import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

import '@solana/wallet-adapter-react-ui/styles.css';

const PUBLIC_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_SOLANA_RPC;
    if (!configured || configured.length === 0) return PUBLIC_MAINNET_RPC;
    return configured;
  }, []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: WalletAdapterNetwork.Mainnet })],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

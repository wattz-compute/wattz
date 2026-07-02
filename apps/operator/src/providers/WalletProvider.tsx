'use client';

import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import type { Adapter } from '@solana/wallet-adapter-base';
import { clusterApiUrl, type Cluster } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

function resolveCluster(): Cluster {
  const value = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  if (value === 'mainnet-beta' || value === 'testnet') return value;
  return 'devnet';
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => {
    const configured = process.env.NEXT_PUBLIC_SOLANA_RPC;
    if (configured && configured.length > 0) return configured;
    return clusterApiUrl(resolveCluster());
  }, []);

  // Phantom and Solflare register themselves through the Wallet Standard, so no
  // explicit adapters are needed; wallet-adapter-react auto-detects them. This
  // keeps the connection tied to the configured cluster with no hard-coded
  // network.
  const wallets = useMemo<Adapter[]>(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

'use client';

import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { getClientRpcEndpoint } from '@/lib/solana';

import '@solana/wallet-adapter-react-ui/styles.css';

// Solana Wallet Adapter provider. Uses only public RPC (mainnet-beta) to
// avoid leaking Helius/QuickNode keys into the client bundle.
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getClientRpcEndpoint(), []);
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
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

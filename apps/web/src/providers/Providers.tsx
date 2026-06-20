'use client';

import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { WalletContextProvider } from './WalletProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <WalletContextProvider>{children}</WalletContextProvider>
    </QueryProvider>
  );
}

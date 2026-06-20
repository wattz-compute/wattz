'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest on the server log without leaking stack to the user.
    // eslint-disable-next-line no-console
    console.error('wattz:error', error);
  }, [error]);

  return (
    <html>
      <body>
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center text-cluster-white">
          <div className="font-mono-tech text-[10px] uppercase tracking-[0.32em] text-wire-glow">
            substation fault
          </div>
          <h1 className="font-display text-3xl leading-tight">
            The grid tripped. Reset the breaker.
          </h1>
          <p className="max-w-md text-cluster-white/70">
            The frontend hit an unhandled error. Node operators and the
            gateway are unaffected. You can retry now or return to the landing.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => reset()}>Retry</Button>
            <Button variant="ghost" onClick={() => window.location.assign('/')}>
              Landing
            </Button>
          </div>
          {error.digest ? (
            <div className="font-mono-tech text-[10px] uppercase tracking-widest text-cluster-white/40">
              digest {error.digest}
            </div>
          ) : null}
        </main>
      </body>
    </html>
  );
}

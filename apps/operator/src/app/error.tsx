'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  return (
    <div className="wattz-card mx-auto max-w-lg rounded-lg p-10 text-center">
      <div className="metric-label">Runtime error</div>
      <h1 className="mt-3 font-display text-2xl uppercase tracking-[0.2em] text-cluster">
        Operator dashboard tripped
      </h1>
      <p className="mt-3 text-sm text-fog">{error.message}</p>
      <button
        onClick={reset}
        className="mt-6 rounded-md border border-cyan/60 bg-shadow px-4 py-2 font-display text-xs uppercase tracking-[0.24em] text-cyan hover:bg-navy/70"
      >
        Retry
      </button>
    </div>
  );
}

import { SafeLink } from '@/components/layout/SafeLink';

export default function NotFound() {
  return (
    <div className="wattz-card mx-auto max-w-lg rounded-lg p-10 text-center">
      <div className="metric-label">404</div>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-[0.2em] text-cluster">
        Not routed
      </h1>
      <p className="mt-3 text-sm text-fog">
        This substation does not appear on the operator dashboard. Head back to overview to see
        your node fleet.
      </p>
      <div className="mt-6">
        <SafeLink
          href="/"
          className="inline-block rounded-md border border-cyan/60 bg-shadow px-4 py-2 font-display text-xs uppercase tracking-[0.24em] text-cyan hover:bg-navy/70"
        >
          Return to overview
        </SafeLink>
      </div>
    </div>
  );
}

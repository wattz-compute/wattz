import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: 'cyan' | 'wire' | 'gold';
}

const accentClass: Record<NonNullable<StatCardProps['accent']>, string> = {
  cyan: 'text-cyan',
  wire: 'text-wire',
  gold: 'text-gold',
};

export function StatCard({ label, value, hint, accent = 'cyan' }: StatCardProps) {
  return (
    <div className="wattz-card rounded-lg p-5">
      <div className="metric-label">{label}</div>
      <div className={`metric-value mt-3 text-3xl font-semibold ${accentClass[accent]}`}>{value}</div>
      {hint && <div className="mt-2 text-xs text-fog">{hint}</div>}
    </div>
  );
}

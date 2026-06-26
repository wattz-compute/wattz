interface ErrorPanelProps {
  message: string;
  hint?: string;
}

export function ErrorPanel({ message, hint }: ErrorPanelProps) {
  return (
    <div className="wattz-card rounded-lg border-wire/30 p-6 text-cluster">
      <div className="metric-label mb-2 text-wire">Gateway unavailable</div>
      <p className="text-sm">{message}</p>
      {hint && <p className="mt-2 text-xs text-fog">{hint}</p>}
    </div>
  );
}

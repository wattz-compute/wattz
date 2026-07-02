interface ErrorPanelProps {
  message: string;
  hint?: string;
  title?: string;
}

export function ErrorPanel({ message, hint, title = 'Gateway unavailable' }: ErrorPanelProps) {
  return (
    <div className="wattz-card rounded-lg border-wire/30 p-6 text-cluster">
      <div className="metric-label mb-2 text-wire">{title}</div>
      <p className="text-sm">{message}</p>
      {hint && <p className="mt-2 text-xs text-fog">{hint}</p>}
    </div>
  );
}

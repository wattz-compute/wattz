import clsx from 'clsx';

interface ModelChipProps {
  modelId: string;
  active?: boolean;
  license?: string;
}

export function ModelChip({ modelId, active, license }: ModelChipProps) {
  return (
    <div
      className={clsx(
        'wattz-card flex items-center justify-between rounded-md px-3 py-2 text-xs',
        active ? 'border-cyan/45 text-cluster' : 'text-cluster/80',
      )}
    >
      <span className="font-mono">{modelId}</span>
      {license && (
        <span className="ml-3 text-[10px] uppercase tracking-widest text-fog">{license}</span>
      )}
    </div>
  );
}

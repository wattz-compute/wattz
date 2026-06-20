import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'cyan' | 'wire' | 'gold' | 'muted';

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  children: ReactNode;
}

export function Chip({ tone = 'cyan', className, children, ...rest }: ChipProps) {
  const toneClass =
    tone === 'wire' ? 'warn' : tone === 'gold' ? 'gold' : tone === 'muted' ? 'muted' : '';

  return (
    <span className={cn('chip', toneClass, className)} {...rest}>
      <span className="dot" />
      {children}
    </span>
  );
}

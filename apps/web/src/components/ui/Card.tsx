import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: 'cyan' | 'gold' | 'wire' | 'none';
}

export function Card({ className, children, glow = 'cyan', ...rest }: CardProps) {
  const glowClass =
    glow === 'gold'
      ? 'before:bg-accent-gold/20'
      : glow === 'wire'
        ? 'before:bg-wire-glow/25'
        : glow === 'none'
          ? ''
          : 'before:bg-cyan-glow/20';

  return (
    <div
      className={cn(
        'substation-panel relative overflow-hidden rounded-2xl p-6 shadow-substation',
        'before:pointer-events-none before:absolute before:-top-32 before:right-[-40%] before:h-64 before:w-2/3 before:rounded-full before:blur-3xl',
        glowClass,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

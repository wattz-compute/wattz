import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'ghost' | 'wire';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const sizeClass: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center gap-2 rounded-md font-mono-tech uppercase tracking-widest whitespace-nowrap';

  const variantClass: Record<Variant, string> = {
    primary: 'primary',
    ghost: 'ghost',
    wire: 'border border-wire-glow/50 bg-night text-cluster-white hover:border-wire-glow',
  };

  return (
    <button className={cn(base, sizeClass[size], variantClass[variant], className)} {...rest}>
      {children}
    </button>
  );
}

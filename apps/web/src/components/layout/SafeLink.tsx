import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Plain <a href> hard navigation. Avoids client-router crashes with 3D +
// force-dynamic routes.
export interface SafeLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  external?: boolean;
  children: ReactNode;
}

export function SafeLink({
  href,
  external,
  children,
  className,
  ...rest
}: SafeLinkProps) {
  const isAbsolute = /^https?:\/\//.test(href);
  const treatAsExternal = external ?? isAbsolute;
  return (
    <a
      href={href}
      className={cn('transition-colors', className)}
      target={treatAsExternal ? '_blank' : undefined}
      rel={treatAsExternal ? 'noopener noreferrer' : undefined}
      {...rest}
    >
      {children}
    </a>
  );
}

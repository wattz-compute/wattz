'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';

interface SafeLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
  href: string;
  children: ReactNode;
  external?: boolean;
}

/**
 * Plain anchor tag with a hard navigation. We deliberately avoid `next/link`
 * so that page transitions do not carry hydration state across the wallet
 * adapter provider tree, which can crash 3D pages if the operator's wallet
 * disconnects mid-transition.
 */
export function SafeLink({ href, external, children, ...rest }: SafeLinkProps) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

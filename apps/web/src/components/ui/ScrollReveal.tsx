'use client';

import { createElement, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'article' | 'header';
}

export function ScrollReveal({ children, className, delay = 0, as = 'div' }: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            const targetDelay = Number(target.dataset.delay || 0);
            window.setTimeout(() => target.classList.add('visible'), targetDelay);
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.14 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return createElement(
    as,
    {
      ref,
      'data-delay': delay,
      className: cn('reveal', className),
    },
    children,
  );
}

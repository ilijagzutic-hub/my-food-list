'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-gold-500 text-forest-950 font-semibold',
  secondary: 'bg-forest-900/60 border border-cream-300/15 text-cream-100',
  ghost: 'text-gold-400/90',
};

export default function Button({
  variant = 'primary',
  children,
  className = '',
  ...rest
}: {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`px-4 py-2.5 rounded-xl text-sm tap-highlight-none disabled:opacity-50 transition-colors ${VARIANT_CLASS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}

const BASE =
  'shrink-0 px-3.5 py-1.5 rounded-full text-[13px] border tap-highlight-none transition-colors inline-flex items-center gap-1';

function chipClass(active: boolean, className: string) {
  return `${BASE} ${
    active
      ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
      : 'bg-forest-800/60 border-cream-300/15 text-cream-100'
  } ${className}`;
}

/** Shared pill control — used by new Stage 2 surfaces (quick actions, etc).
 * Existing chip-like buttons elsewhere (CravingChips, FilterSheet, Explore's
 * quick views) are left as-is rather than force-migrated onto this. */
export default function Chip({ children, active = false, onClick, href, className = '' }: ChipProps) {
  if (href) {
    return (
      <Link href={href} className={chipClass(active, className)}>
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={chipClass(active, className)}>
      {children}
    </button>
  );
}

'use client';

import { useState } from 'react';
import { setReallyWantToTry } from '@/lib/actions';

// A ribbon/bookmark shape — deliberately not the favourite star (FavouriteToggle.tsx),
// so the two distinct meanings ("we already like this" vs "we haven't been but
// really want to go") never look like the same control at a glance.
const RIBBON_PATH = 'M6 2.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V3.5a1 1 0 0 1 1-1z';

/**
 * Stage 6B personal intent signal — see actions.ts's setReallyWantToTry.
 * Same optimistic-update-then-revert-on-failure pattern as FavouriteToggle.
 */
export default function ReallyWantToTryToggle({
  restaurantId,
  value,
  onChange,
  size = 20,
  stopPropagation = true,
  showLabel = false,
}: {
  restaurantId: number;
  value: boolean;
  onChange: (next: boolean) => void;
  size?: number;
  stopPropagation?: boolean;
  showLabel?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    if (busy) return;
    const next = !value;
    onChange(next); // optimistic
    setBusy(true);
    try {
      await setReallyWantToTry(restaurantId, next);
    } catch {
      onChange(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={value ? 'Remove from Really Want to Try' : 'Mark Really Want to Try'}
      aria-pressed={value}
      className={`inline-flex items-center gap-1.5 tap-highlight-none disabled:opacity-50 ${
        showLabel ? 'px-2.5 py-1 rounded-full border' : 'p-1 -m-1'
      } ${showLabel ? (value ? 'bg-gold-500/15 border-gold-500/40' : 'border-cream-300/15') : ''}`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path
          d={RIBBON_PATH}
          fill={value ? '#d4af6a' : 'none'}
          stroke="#d4af6a"
          strokeOpacity={value ? 1 : 0.55}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {showLabel && (
        <span className={`text-[12.5px] ${value ? 'text-gold-400 font-medium' : 'text-cream-300/70'}`}>
          Really want to try
        </span>
      )}
    </button>
  );
}

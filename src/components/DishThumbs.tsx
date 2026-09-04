'use client';

import { setDishLiked } from '@/lib/actions';

const THUMB_PATH =
  'M2 9h4v12H2V9zm7 12h9.5a2 2 0 0 0 1.94-1.51l1.86-7.4A2 2 0 0 0 20.4 10H14l.94-4.66c.14-.7-.08-1.42-.6-1.92a1.94 1.94 0 0 0-2.7 0L7 8v13h2z';

export function ThumbUpIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d={THUMB_PATH} />
    </svg>
  );
}

export function ThumbDownIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      style={{ transform: 'rotate(180deg)' }}
    >
      <path d={THUMB_PATH} />
    </svg>
  );
}

/**
 * Thumbs up/down on a single dish. Optimistically updates via onChange, then
 * writes to Supabase; reverts the optimistic update if the write fails (e.g.
 * the RLS policy for dish writes hasn't been set up yet).
 */
export default function DishThumbs({
  dishId,
  liked,
  onChange,
}: {
  dishId: number;
  liked: boolean | null;
  onChange: (liked: boolean | null) => void;
}) {
  async function tap(next: boolean) {
    const value = liked === next ? null : next;
    onChange(value);
    try {
      await setDishLiked(dishId, value);
    } catch {
      onChange(liked);
    }
  }

  return (
    <span className="inline-flex items-center gap-2.5 shrink-0">
      <button
        aria-label="Liked this dish"
        onClick={(e) => {
          e.stopPropagation();
          tap(true);
        }}
        className={`p-0.5 tap-highlight-none ${
          liked === true ? 'text-gold-400' : 'text-cream-300/30'
        }`}
      >
        <ThumbUpIcon filled={liked === true} />
      </button>
      <button
        aria-label="Didn't like this dish"
        onClick={(e) => {
          e.stopPropagation();
          tap(false);
        }}
        className={`p-0.5 tap-highlight-none ${
          liked === false ? 'text-red-300' : 'text-cream-300/30'
        }`}
      >
        <ThumbDownIcon filled={liked === false} />
      </button>
    </span>
  );
}

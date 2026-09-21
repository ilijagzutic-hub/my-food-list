'use client';

import { useState } from 'react';
import { setFavourite } from '@/lib/actions';

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.1 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z';

/**
 * Favourite is a separate concept from Priority: a personal saved-favourite
 * flag the app never infers on its own. This control is used both as a
 * read+toggle affordance (detail page, My Food) and as a compact indicator
 * on RestaurantCard.
 */
export default function FavouriteToggle({
  restaurantId,
  isFavourite,
  onChange,
  size = 20,
  stopPropagation = true,
}: {
  restaurantId: number;
  isFavourite: boolean;
  onChange: (next: boolean) => void;
  size?: number;
  stopPropagation?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    if (busy) return;
    const next = !isFavourite;
    onChange(next); // optimistic
    setBusy(true);
    try {
      await setFavourite(restaurantId, next);
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
      aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
      aria-pressed={isFavourite}
      className="p-1 -m-1 tap-highlight-none disabled:opacity-50"
    >
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path
          d={STAR_PATH}
          fill={isFavourite ? '#d4af6a' : 'none'}
          stroke="#d4af6a"
          strokeOpacity={isFavourite ? 1 : 0.55}
          strokeWidth="1.6"
        />
      </svg>
    </button>
  );
}

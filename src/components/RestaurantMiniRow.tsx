'use client';

import Link from 'next/link';
import type { RestaurantWithDishes } from '@/lib/types';
import { parseRating, formatRating } from '@/lib/rating';
import PriorityBadge from './PriorityBadge';

/**
 * A single-line preview row — not a full RestaurantCard. Used by My Food's
 * dashboard sections so a restaurant that belongs to several categories
 * (favourite + tried + highly rated) doesn't render as three large cards
 * stacked on the same page. Always links through to the full detail page.
 */
export default function RestaurantMiniRow({ restaurant }: { restaurant: RestaurantWithDishes }) {
  const rating = parseRating(restaurant.rating);
  const subtitle = [restaurant.cuisine?.[0], restaurant.suburb || restaurant.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/restaurant/${restaurant.id}/`}
      className="flex items-center justify-between gap-3 py-2.5 border-b border-cream-300/10 last:border-b-0 tap-highlight-none"
    >
      <div className="min-w-0">
        <p className="text-[14px] text-cream-50 truncate">{restaurant.name}</p>
        {subtitle && <p className="text-[12px] text-cream-300/55 truncate">{subtitle}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {rating != null ? (
          <span className="text-[12.5px] font-medium text-gold-400">{formatRating(rating)}</span>
        ) : (
          <PriorityBadge priority={restaurant.priority} />
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-cream-300/40 shrink-0"
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </Link>
  );
}

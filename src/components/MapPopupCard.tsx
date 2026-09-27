import Link from 'next/link';
import type { RestaurantWithDishes } from '@/lib/types';
import { formatDistance } from '@/lib/geo';
import { parseRating } from '@/lib/rating';

// PriorityBadge's palette (light text for the app's dark forest background)
// is illegible on Leaflet's white popup chrome, so the popup gets its own
// small dark-on-light chip instead of reusing that component here.
const PRIORITY_LABEL: Record<string, string> = {
  'VERY HIGH': 'Very High',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
};

/** Same "what to order" pick RestaurantCard uses — must_order dishes first,
 * else just the first couple on file — so the map's popup reads consistently
 * with the rest of the app instead of inventing its own rule. */
function keyDishes(r: RestaurantWithDishes): string[] {
  const mustOrder = r.dishes.filter((d) => d.must_order).map((d) => d.name);
  if (mustOrder.length) return mustOrder.slice(0, 2);
  return r.dishes.slice(0, 2).map((d) => d.name);
}

/**
 * Compact marker preview — a decision-making snapshot, not the full
 * restaurant record. Read-only (no favourite/rating editing here); the one
 * action is opening the real detail page.
 */
export default function MapPopupCard({ restaurant: r }: { restaurant: RestaurantWithDishes & { distanceKm?: number | null } }) {
  const ratingNum = parseRating(r.rating);
  const dishes = keyDishes(r);

  return (
    <div className="w-[220px] font-sans">
      <div className="flex items-start justify-between gap-2">
        <p className="font-serif text-[15px] leading-snug text-forest-950">{r.name}</p>
        {r.is_favourite && <span className="text-[13px] shrink-0">★</span>}
      </div>
      <p className="text-[12px] text-forest-700/80 mt-0.5">
        {[r.cuisine?.[0], r.suburb || r.city].filter(Boolean).join(' · ')}
        {r.distanceKm != null ? ` · ${formatDistance(r.distanceKm)}` : ''}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-forest-900/8 text-forest-800">
          {r.status}
        </span>
        <span className="text-[10.5px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gold-500/15 text-gold-600 border border-gold-500/30">
          {PRIORITY_LABEL[r.priority || 'NORMAL'] || 'Normal'}
        </span>
        {ratingNum != null && (
          <span className="text-[11px] text-gold-600 font-medium">{ratingNum}/10</span>
        )}
      </div>
      {dishes.length > 0 && (
        <p className="text-[12px] text-forest-800/80 mt-1.5 leading-snug">
          <span className="text-forest-700/60">Go for: </span>
          {dishes.join(', ')}
        </p>
      )}
      <Link
        href={`/restaurant/${r.id}/`}
        className="block text-center mt-2.5 py-1.5 rounded-lg bg-forest-900 text-cream-50 text-[12px] font-medium tap-highlight-none"
      >
        View details
      </Link>
    </div>
  );
}

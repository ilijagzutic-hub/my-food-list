'use client';

import Link from 'next/link';
import type { Person } from '@/lib/types';
import type { RecentVisit } from '@/lib/useVisits';

function relativeDate(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(iso + 'T00:00:00');
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** One-line "Recent visits" row for My Food's dashboard — parallel to
 * RestaurantMiniRow, but describing a visit rather than a restaurant. */
export default function VisitMiniRow({ item, people }: { item: RecentVisit; people: Person[] }) {
  const names = item.attendeePersonIds
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];
  if (item.visit.includes_guests) names.push('Guests');

  const subtitle = [
    relativeDate(item.visit.visited_at),
    names.join(' + '),
    item.visit.occasion,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/restaurant/${item.restaurantId}/`}
      className="flex items-center justify-between gap-3 py-2.5 border-b border-cream-300/10 last:border-b-0 tap-highlight-none"
    >
      <div className="min-w-0">
        <p className="text-[14px] text-cream-50 truncate">{item.restaurantName}</p>
        <p className="text-[12px] text-cream-300/55 truncate">{subtitle}</p>
      </div>
      {item.visit.overall_rating != null && (
        <span className="shrink-0 text-[12.5px] font-medium text-gold-400">
          {item.visit.overall_rating}/10
        </span>
      )}
    </Link>
  );
}

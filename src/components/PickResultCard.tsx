'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ScoredPick, PickAnswers } from '@/lib/pick';
import { explainPick, highlightDishes } from '@/lib/pick';
import { formatDistance } from '@/lib/geo';
import { parseRating } from '@/lib/rating';
import type { Person } from '@/lib/types';
import PriorityBadge from './PriorityBadge';
import FastVisitSheet from './FastVisitSheet';

/**
 * A Pick result — deliberately not RestaurantCard: this needs to foreground
 * the "why this?" explanation and stay to exactly the fields Stage 6A asks
 * for, not the full expandable card used for general browsing.
 */
export default function PickResultCard({
  picked,
  answers,
  people,
  onVisitSaved,
}: {
  picked: ScoredPick;
  answers: PickAnswers;
  people: Person[];
  // Stage 6B: closes the Pick → Eat → Feedback loop — after a visit is
  // saved from here, the parent re-fetches so this restaurant's status
  // (now Tried) is reflected if the user runs Pick again.
  onVisitSaved?: () => void;
}) {
  const r = picked.restaurant;
  const ratingNum = parseRating(r.rating);
  const dishes = highlightDishes(r);
  const [beenHereOpen, setBeenHereOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="rounded-xl2 bg-forest-800/60 border border-cream-300/10 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-serif text-[18px] leading-snug text-cream-50">{r.name}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {r.really_want_to_try && (
            <span title="Really want to try" className="text-gold-400 text-[13px]">
              🔖
            </span>
          )}
          {r.is_favourite && <span className="text-gold-400 text-[15px]">★</span>}
        </div>
      </div>
      <p className="text-[13px] text-cream-300/70 mt-1">
        {[
          r.distanceKm != null ? formatDistance(r.distanceKm) : null,
          r.cuisine?.[0],
          r.suburb || r.city,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="flex items-center gap-2 flex-wrap mt-2">
        <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-forest-900/60 text-cream-200 border border-cream-300/15">
          {r.status}
        </span>
        <PriorityBadge priority={r.priority} />
        {ratingNum != null && (
          <span className="text-[12px] font-medium text-gold-400">{ratingNum}/10</span>
        )}
      </div>
      {dishes.length > 0 && (
        <p className="text-[13px] text-cream-100/80 mt-2.5">
          <span className="text-cream-300/55">Known for: </span>
          {dishes.join(' · ')}
        </p>
      )}
      <p className="text-[13px] text-cream-300/70 mt-2.5 leading-relaxed">
        <span className="text-cream-300/50">Why this: </span>
        {explainPick(picked, answers)}
      </p>

      <Link
        href={`/restaurant/${r.id}/`}
        className="block text-center mt-3.5 py-2.5 rounded-lg bg-gold-500 text-forest-950 text-[13px] font-semibold tap-highlight-none"
      >
        View restaurant
      </Link>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Link
          href={`/map/?focus=${r.id}`}
          className="text-center py-2.5 rounded-lg bg-forest-900/60 text-cream-100 text-[13px] font-medium tap-highlight-none"
        >
          Show on map
        </Link>
        <button
          onClick={() => setBeenHereOpen(true)}
          className="text-center py-2.5 rounded-lg bg-forest-900/60 text-cream-100 text-[13px] font-medium tap-highlight-none"
        >
          Been here?
        </button>
      </div>

      {beenHereOpen && (
        <FastVisitSheet
          restaurantId={r.id}
          restaurantDishes={r.dishes}
          people={people}
          onClose={() => setBeenHereOpen(false)}
          onSaved={() => {
            setBeenHereOpen(false);
            onVisitSaved?.();
          }}
          // Pick's cards stay lightweight — the full detailed editor (date,
          // occasion, guests) lives on the restaurant's own page, so "More
          // details" here just takes you there instead of duplicating it.
          onMoreDetails={() => router.push(`/restaurant/${r.id}/`)}
        />
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RestaurantWithDishes, VisitAgain } from '@/lib/types';
import PriorityBadge from './PriorityBadge';
import RatingEditor from './RatingEditor';
import RatingStars from './RatingStars';
import DishCatalogue from './DishCatalogue';
import FavouriteToggle from './FavouriteToggle';
import { markTried, markWantToTry } from '@/lib/actions';
import { formatDistance } from '@/lib/geo';

const VISIT_AGAIN_LABEL: Record<VisitAgain, string> = {
  yes: 'Would go back',
  maybe: 'Might go back',
  no: 'Would not go back',
};

function mapUrl(r: RestaurantWithDishes) {
  if (r.latitude != null && r.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`;
  }
  const q = [r.name, r.address, r.suburb, r.city, r.country].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function websiteSearchUrl(r: RestaurantWithDishes) {
  const q = [r.name, r.suburb || r.city].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function oneLineHighlight(r: RestaurantWithDishes): string {
  const mustOrder = r.dishes.filter((d) => d.must_order).map((d) => d.name);
  if (mustOrder.length) return mustOrder.slice(0, 3).join(', ') + '.';
  if (r.dishes.length) return r.dishes.slice(0, 3).map((d) => d.name).join(', ') + '.';
  if (r.summary) return r.summary;
  return (r.cuisine || []).join(', ') || (r.venue_type || []).join(', ') || '';
}

export default function RestaurantCard({
  restaurant,
  expanded,
  onToggle,
}: {
  restaurant: RestaurantWithDishes;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [r, setR] = useState(restaurant);
  const [showRating, setShowRating] = useState(false);
  const [busy, setBusy] = useState(false);

  const ratingNum =
    typeof r.rating === 'number' ? r.rating : r.rating ? parseFloat(String(r.rating)) : null;

  async function handleToggleTried() {
    setBusy(true);
    try {
      if (r.status === 'Tried') {
        await markWantToTry(r.id);
        setR((prev) => ({ ...prev, status: 'Want to try' }));
      } else {
        await markTried(r.id);
        setR((prev) => ({ ...prev, status: 'Tried' }));
      }
    } catch {
      // Silently ignored in the button; the rating editor surfaces the same
      // failure with an explanation when writes aren't enabled yet.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-xl2 bg-forest-800/60 border border-cream-300/10 overflow-hidden transition-shadow ${
        expanded ? 'shadow-cardHover' : 'shadow-card'
      }`}
    >
      {/* A div (not a <button>) so the favourite star and the detail-page
          link below can be real, independently-clickable buttons/links
          nested inside — buttons can't legally nest in HTML. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full text-left px-4 py-3.5 flex flex-col gap-1 tap-highlight-none active:bg-forest-800 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-[17px] leading-snug text-cream-50">{r.name}</h3>
          <div className="shrink-0 flex items-center gap-2.5 mt-0.5">
            {r.status === 'Tried' && (
              <span className="text-[11px] uppercase tracking-wide text-cream-300/50">Tried</span>
            )}
            <FavouriteToggle
              restaurantId={r.id}
              isFavourite={r.is_favourite}
              onChange={(next) => setR((prev) => ({ ...prev, is_favourite: next }))}
              size={17}
            />
            <Link
              href={`/restaurant/${r.id}/`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`View full details for ${r.name}`}
              className="text-cream-300/50 tap-highlight-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-cream-300/70">
          <span>{r.suburb || r.city || r.region}</span>
          {r.distanceKm != null && (
            <>
              <span className="text-cream-300/30">·</span>
              <span>{formatDistance(r.distanceKm)}</span>
            </>
          )}
        </div>
        {oneLineHighlight(r) && (
          <p className="text-[13.5px] text-cream-100/80 mt-0.5 line-clamp-1">
            {oneLineHighlight(r)}
          </p>
        )}
        <div className="mt-1">
          <PriorityBadge priority={r.priority} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-cream-300/10 animate-fade-slide">
          <div className="flex items-center gap-2 text-[13px] text-cream-300/70 mt-3">
            <span>{(r.cuisine || []).join(', ') || '—'}</span>
            {r.venue_type?.length ? (
              <>
                <span className="text-cream-300/30">·</span>
                <span>{r.venue_type.join(', ')}</span>
              </>
            ) : null}
          </div>
          <div className="mt-2">
            <PriorityBadge priority={r.priority} />
          </div>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-2">Dishes</p>
            <DishCatalogue
              restaurantId={r.id}
              dishes={r.dishes}
              onDishesChange={(dishes) => setR((prev) => ({ ...prev, dishes }))}
            />
          </div>

          {(r.user_notes || r.summary) && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-1.5">
                Why it&apos;s on my list
              </p>
              <p className="text-[14px] text-cream-100/85 leading-relaxed">
                {r.user_notes || r.summary}
              </p>
            </div>
          )}

          {ratingNum != null && (
            <div className="mt-4">
              <RatingStars value={ratingNum} />
            </div>
          )}

          {r.visit_again && (
            <p className="text-[13px] text-cream-300/70 mt-2">
              {VISIT_AGAIN_LABEL[r.visit_again]}
            </p>
          )}

          {r.address && (
            <p className="text-[13px] text-cream-300/60 mt-4">{r.address}</p>
          )}
          <p className="text-[13px] text-cream-300/60 mt-1">{r.status}</p>

          <div className="grid grid-cols-4 gap-2 mt-4">
            <a
              href={mapUrl(r)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-forest-900/60 text-[11px] text-cream-100 tap-highlight-none"
            >
              <span>📍</span>Map
            </a>
            <a
              href={websiteSearchUrl(r)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-forest-900/60 text-[11px] text-cream-100 tap-highlight-none"
            >
              <span>🔗</span>Website
            </a>
            <button
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTried();
              }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-forest-900/60 text-[11px] text-cream-100 tap-highlight-none disabled:opacity-50"
            >
              <span>✓</span>
              {r.status === 'Tried' ? 'Undo' : 'Mark Tried'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRating(true);
              }}
              className="flex flex-col items-center gap-1 py-2.5 rounded-lg bg-forest-900/60 text-[11px] text-cream-100 tap-highlight-none"
            >
              <span>★</span>Rate
            </button>
          </div>
        </div>
      )}

      {showRating && (
        <RatingEditor
          restaurant={r}
          onClose={() => setShowRating(false)}
          onSaved={(rating, notes, visitAgain) =>
            setR((prev) => ({ ...prev, rating, user_notes: notes || null, visit_again: visitAgain }))
          }
        />
      )}
    </div>
  );
}

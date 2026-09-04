'use client';

import { useState } from 'react';
import type { RestaurantWithDishes } from '@/lib/types';
import PriorityBadge from './PriorityBadge';
import RatingEditor from './RatingEditor';
import { markTried, markWantToTry } from '@/lib/actions';
import { formatDistance } from '@/lib/geo';

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

  const mustOrder = r.dishes.filter((d) => d.must_order);
  const others = r.dishes.filter((d) => !d.must_order);
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
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5 flex flex-col gap-1 tap-highlight-none active:bg-forest-800"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-[17px] leading-snug text-cream-50">{r.name}</h3>
          {r.status === 'Tried' && (
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-cream-300/50 mt-0.5">
              Tried
            </span>
          )}
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
      </button>

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

          {(mustOrder.length > 0 || others.length > 0) && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-2">
                What to order
              </p>
              {mustOrder.map((d) => (
                <div key={d.id} className="flex items-start gap-2 text-[14px] text-cream-50 mb-1.5">
                  <svg
                    className="mt-0.5 shrink-0"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="#d4af6a"
                  >
                    <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.1 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z" />
                  </svg>
                  <span>
                    {d.name}
                    {d.description && (
                      <span className="text-cream-300/60"> — {d.description}</span>
                    )}
                  </span>
                </div>
              ))}
              {others.length > 0 && (
                <p className="text-[13.5px] text-cream-300/70 mt-1">
                  {others.map((d) => d.name).join(' · ')}
                </p>
              )}
            </div>
          )}

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
            <div className="mt-4 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <svg
                  key={n}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={n <= ratingNum ? '#d4af6a' : 'none'}
                  stroke="#d4af6a"
                  strokeOpacity={n <= ratingNum ? 1 : 0.35}
                  strokeWidth="1.6"
                >
                  <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.1 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z" />
                </svg>
              ))}
            </div>
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
          onSaved={(rating, notes) =>
            setR((prev) => ({ ...prev, rating, user_notes: notes || null }))
          }
        />
      )}
    </div>
  );
}

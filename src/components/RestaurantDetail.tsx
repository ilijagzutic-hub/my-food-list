'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRestaurants } from '@/lib/useRestaurants';
import { supabase } from '@/lib/supabase';
import { markTried, markWantToTry } from '@/lib/actions';
import type { RestaurantWithDishes, VisitAgain } from '@/lib/types';
import PriorityBadge from './PriorityBadge';
import FavouriteToggle from './FavouriteToggle';
import DishCatalogue from './DishCatalogue';
import Rating from './Rating';
import RatingEditor from './RatingEditor';
import BottomNav from './BottomNav';
import { parseRating } from '@/lib/rating';

const VISIT_AGAIN_LABEL: Record<VisitAgain, string> = {
  yes: 'Would go back',
  maybe: 'Might go back',
  no: 'Would not go back',
};

/**
 * Personal-decision-first restaurant detail page: what is this place, why
 * did we save it, what should we order, have we been, what did we think,
 * would we go back, and our own notes — deliberately not a Google-style
 * directory listing. No hero image infrastructure yet (see header below).
 */
export default function RestaurantDetail({ id }: { id: number }) {
  const { restaurants, loading, error } = useRestaurants();
  const found = useMemo(() => restaurants.find((r) => r.id === id) || null, [restaurants, id]);
  const [r, setR] = useState<RestaurantWithDishes | null>(found);
  const [showRating, setShowRating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visitCount, setVisitCount] = useState<number | null>(null);

  useEffect(() => {
    setR(found);
  }, [found]);

  // restaurant_visits is Stage 1's empty, additive table — visit logging
  // itself is a later stage, but the "Our history" section should already
  // reflect real rows if/when they exist rather than assuming zero.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('restaurant_visits')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', id)
      .then(({ count }) => {
        if (!cancelled) setVisitCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleToggleTried() {
    if (!r) return;
    setBusy(true);
    try {
      if (r.status === 'Tried') {
        await markWantToTry(r.id);
        setR((prev) => (prev ? { ...prev, status: 'Want to try' } : prev));
      } else {
        await markTried(r.id);
        setR((prev) => (prev ? { ...prev, status: 'Tried' } : prev));
      }
    } catch {
      // Rate & add notes surfaces write-permission failures explicitly;
      // this shortcut button fails quietly like it does on RestaurantCard.
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto min-h-screen pb-24">
        <p className="text-cream-300/50 text-sm py-16 text-center">Loading…</p>
        <BottomNav />
      </main>
    );
  }

  if (error || !r) {
    return (
      <main className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto min-h-screen pb-24 px-4">
        <Link href="/explore/" className="text-[13px] text-gold-400 tap-highlight-none">
          ← Explore
        </Link>
        <p className="text-cream-300/60 text-sm py-16 text-center">
          {error || "Couldn't find that restaurant."}
        </p>
        <BottomNav />
      </main>
    );
  }

  const ratingNum = parseRating(r.rating);
  const hasWhyContent =
    !!r.summary || !!r.source_notes || !!r.tags?.length || !!r.occasions?.length;

  return (
    <main className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto min-h-screen pb-24">
      <div className="px-4 pt-safe-top pt-6">
        <Link href="/explore/" className="text-[13px] text-cream-300/60 tap-highlight-none">
          ← Explore
        </Link>
      </div>

      {/* Header — polished, non-image. A fixed block that can later host a
          hero photo without restructuring the page. */}
      <div className="mx-4 mt-3 rounded-xl2 overflow-hidden bg-gradient-to-br from-forest-700 via-forest-800 to-forest-950 border border-cream-300/10 px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-[24px] leading-tight text-cream-50">{r.name}</h1>
            <p className="text-[13.5px] text-cream-300/70 mt-1">
              {[r.suburb || r.city, (r.cuisine || []).join(', ')].filter(Boolean).join(' · ')}
            </p>
          </div>
          <FavouriteToggle
            restaurantId={r.id}
            isFavourite={r.is_favourite}
            onChange={(next) => setR((prev) => (prev ? { ...prev, is_favourite: next } : prev))}
            size={24}
            stopPropagation={false}
          />
        </div>
        <div className="flex items-center gap-3 mt-4">
          <PriorityBadge priority={r.priority} />
          <span className="text-[12px] uppercase tracking-wide text-cream-300/60">{r.status}</span>
        </div>
      </div>

      <section className="px-4 mt-6">
        <h2 className="font-serif text-[17px] text-cream-50 mb-2">Why it&apos;s on our list</h2>
        {hasWhyContent ? (
          <>
            {(r.summary || r.source_notes) && (
              <p className="text-[14px] text-cream-100/85 leading-relaxed">
                {r.summary || r.source_notes}
              </p>
            )}
            {(r.tags?.length || r.occasions?.length) && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {[...(r.tags || []), ...(r.occasions || [])].map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="px-2.5 py-1 rounded-full text-[12px] bg-forest-800/70 border border-cream-300/10 text-cream-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-[13.5px] text-cream-300/50">
            No notes saved yet for why this one made the list.
          </p>
        )}
      </section>

      <section className="px-4 mt-6">
        <h2 className="font-serif text-[17px] text-cream-50 mb-2">What to order</h2>
        <DishCatalogue
          restaurantId={r.id}
          dishes={r.dishes}
          onDishesChange={(dishes) => setR((prev) => (prev ? { ...prev, dishes } : prev))}
        />
      </section>

      <section className="px-4 mt-6">
        <h2 className="font-serif text-[17px] text-cream-50 mb-2">Our history</h2>
        {visitCount === null ? (
          <p className="text-[13.5px] text-cream-300/40">Checking…</p>
        ) : visitCount > 0 ? (
          <p className="text-[13.5px] text-cream-300/70">
            {visitCount} visit{visitCount === 1 ? '' : 's'} logged.
          </p>
        ) : (
          <p className="text-[13.5px] text-cream-300/50">No visits logged yet.</p>
        )}

        {r.status === 'Tried' && (ratingNum != null || r.visit_again || r.last_visited_at) && (
          <div className="mt-3 p-3.5 rounded-xl bg-forest-800/50 border border-cream-300/10">
            <p className="text-[11px] uppercase tracking-wide text-cream-300/50 mb-2">
              Current rating (from before visit history existed)
            </p>
            {ratingNum != null && <Rating value={ratingNum} />}
            {r.visit_again && (
              <p className="text-[13px] text-cream-300/70 mt-2">
                {VISIT_AGAIN_LABEL[r.visit_again]}
              </p>
            )}
            {r.last_visited_at && (
              <p className="text-[12px] text-cream-300/50 mt-1">
                Last visited {new Date(r.last_visited_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="px-4 mt-6">
        <h2 className="font-serif text-[17px] text-cream-50 mb-2">Personal notes</h2>
        {r.user_notes ? (
          <p className="text-[14px] text-cream-100/85 leading-relaxed">{r.user_notes}</p>
        ) : (
          <p className="text-[13.5px] text-cream-300/50">
            No personal notes yet — add some from Rate &amp; add notes below.
          </p>
        )}
      </section>

      <section className="px-4 mt-6 mb-4">
        <h2 className="font-serif text-[17px] text-cream-50 mb-3">Actions</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            disabled={busy}
            onClick={handleToggleTried}
            className="py-3 rounded-xl bg-forest-800/70 border border-cream-300/15 text-[13.5px] text-cream-100 disabled:opacity-50 tap-highlight-none"
          >
            {r.status === 'Tried' ? 'Mark Want to Try' : 'Mark Tried'}
          </button>
          <button
            onClick={() => setShowRating(true)}
            className="py-3 rounded-xl bg-gold-500 text-forest-950 font-semibold text-[13.5px] tap-highlight-none"
          >
            Rate &amp; add notes
          </button>
        </div>
      </section>

      {showRating && (
        <RatingEditor
          restaurant={r}
          onClose={() => setShowRating(false)}
          onSaved={(rating, notes, visitAgain) =>
            setR((prev) =>
              prev ? { ...prev, rating, user_notes: notes || null, visit_again: visitAgain } : prev
            )
          }
        />
      )}

      <BottomNav />
    </main>
  );
}

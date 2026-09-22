'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRestaurants } from '@/lib/useRestaurants';
import { useRestaurantVisits, usePeople } from '@/lib/useVisits';
import { markTried, markWantToTry } from '@/lib/actions';
import type { RestaurantWithDishes, VisitAgain } from '@/lib/types';
import PriorityBadge from './PriorityBadge';
import FavouriteToggle from './FavouriteToggle';
import DishCatalogue from './DishCatalogue';
import Rating from './Rating';
import RatingEditor from './RatingEditor';
import LogVisitSheet from './LogVisitSheet';
import VisitCard from './VisitCard';
import BottomNav from './BottomNav';
import { parseRating } from '@/lib/rating';

const VISITS_INITIAL_CAP = 5;

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
  const { restaurants, loading, error, reload: reloadRestaurants } = useRestaurants();
  const found = useMemo(() => restaurants.find((r) => r.id === id) || null, [restaurants, id]);
  const [r, setR] = useState<RestaurantWithDishes | null>(found);
  const [showRating, setShowRating] = useState(false);
  const [busy, setBusy] = useState(false);

  const { visits, reload: reloadVisits } = useRestaurantVisits(id);
  const { people } = usePeople();
  const [sheetMode, setSheetMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  // null = no manual override yet, so the newest visit is expanded by
  // default (see effectiveExpandedId below); -1 = the user explicitly
  // collapsed everything, which null can't represent without falling
  // straight back to "expand the newest one".
  const [expandedVisitId, setExpandedVisitId] = useState<number | null>(null);
  const [showAllVisits, setShowAllVisits] = useState(false);

  useEffect(() => {
    setR(found);
  }, [found]);

  const effectiveExpandedId = expandedVisitId ?? visits[0]?.id ?? null;
  const visibleVisits = showAllVisits ? visits : visits.slice(0, VISITS_INITIAL_CAP);
  const latestVisit = visits[0] ?? null;

  async function handleVisitSaved() {
    setSheetMode('closed');
    setEditingVisitId(null);
    setExpandedVisitId(null); // fall back to "newest expanded" default
    await Promise.all([reloadVisits(), reloadRestaurants()]);
  }

  async function handleVisitDeleted() {
    setExpandedVisitId(null);
    await Promise.all([reloadVisits(), reloadRestaurants()]);
  }

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

      <section className="px-4 mt-4">
        <button
          onClick={() => setSheetMode('create')}
          className="w-full py-3.5 rounded-xl2 bg-gold-500 text-forest-950 font-semibold text-[14.5px] tap-highlight-none"
        >
          + Log a visit
        </button>
      </section>

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
        {visits.length === 0 ? (
          <>
            <p className="text-[13.5px] text-cream-300/50">No visits logged yet.</p>
            {/* Legacy pre-Stage-3 rating: only shown while this restaurant has
                no real visit history, so it's never displayed alongside (and
                duplicating) a visit card showing the same info. */}
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
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-cream-300/50 mb-2.5">
              {visits.length} visit{visits.length === 1 ? '' : 's'}
            </p>
            <div className="flex flex-col gap-2.5">
              {visibleVisits.map((v) => (
                <VisitCard
                  key={v.id}
                  visit={v}
                  people={people}
                  expanded={effectiveExpandedId === v.id}
                  onToggle={() =>
                    setExpandedVisitId((cur) => (cur === v.id ? -1 : v.id))
                  }
                  onEdit={() => {
                    setEditingVisitId(v.id);
                    setSheetMode('edit');
                  }}
                  onDeleted={handleVisitDeleted}
                />
              ))}
            </div>
            {!showAllVisits && visits.length > VISITS_INITIAL_CAP && (
              <button
                onClick={() => setShowAllVisits(true)}
                className="text-[13px] text-gold-400 tap-highlight-none mt-3"
              >
                Show all {visits.length} visits
              </button>
            )}
          </>
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
            onClick={() => {
              if (latestVisit) {
                setEditingVisitId(latestVisit.id);
                setSheetMode('edit');
              } else {
                setShowRating(true);
              }
            }}
            className="py-3 rounded-xl bg-gold-500 text-forest-950 font-semibold text-[13.5px] tap-highlight-none"
          >
            {latestVisit ? 'Edit latest visit' : 'Rate & add notes'}
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

      {sheetMode !== 'closed' && (
        <LogVisitSheet
          restaurantId={r.id}
          restaurantDishes={r.dishes}
          people={people}
          editingVisit={
            sheetMode === 'edit' ? visits.find((v) => v.id === editingVisitId) ?? null : null
          }
          onClose={() => {
            setSheetMode('closed');
            setEditingVisitId(null);
          }}
          onSaved={handleVisitSaved}
        />
      )}

      <BottomNav />
    </main>
  );
}

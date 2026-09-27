'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LatLngBounds } from 'leaflet';
import { useRestaurants } from '@/lib/useRestaurants';
import { rankRestaurants } from '@/lib/search';
import { getBrowserLocation } from '@/lib/geo';
import type { Coords } from '@/lib/types';
import RestaurantList from '@/components/RestaurantList';
import BottomNav from '@/components/BottomNav';
import FilterSheet, { EMPTY_FILTERS, type Filters } from '@/components/FilterSheet';

// Leaflet touches window/document at import time, so the actual map is
// loaded client-only — Next still prerenders this page's own shell at
// build time under output:'export', which would otherwise crash.
const RestaurantMap = dynamic(() => import('@/components/RestaurantMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-forest-800/40">
      <p className="text-cream-300/50 text-sm">Loading map…</p>
    </div>
  ),
});

type QuickFilter = 'want_to_try' | 'tried' | 'favourites' | 'would_return' | null;

export default function MapPage() {
  const { restaurants, loading, error } = useRestaurants();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [quick, setQuick] = useState<QuickFilter>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);

  const facets = useMemo(() => {
    const cuisines = new Set<string>();
    const venueTypes = new Set<string>();
    const occasions = new Set<string>();
    restaurants.forEach((r) => {
      (r.cuisine || []).forEach((c) => cuisines.add(c));
      (r.venue_type || []).forEach((v) => venueTypes.add(v));
      (r.occasions || []).forEach((o) => occasions.add(o));
    });
    return {
      cuisines: Array.from(cuisines).sort(),
      venueTypes: Array.from(venueTypes).sort(),
      occasions: Array.from(occasions).sort(),
    };
  }, [restaurants]);

  // Quick chips (favourites / would-return) sit outside the shared Filters
  // shape, same split Explore already uses — kept here rather than changing
  // FilterSheet, so Explore's own behaviour is untouched.
  const quickFiltered = useMemo(() => {
    if (quick === 'favourites') return restaurants.filter((r) => r.is_favourite);
    if (quick === 'would_return') return restaurants.filter((r) => r.visit_again === 'yes');
    return restaurants;
  }, [restaurants, quick]);

  const ranked = useMemo(
    () =>
      rankRestaurants(quickFiltered, {
        coords: userCoords,
        cuisines: filters.cuisines,
        venueTypes: filters.venueTypes,
        occasions: filters.occasions,
        priorities: filters.priorities,
        status:
          quick === 'want_to_try' ? 'Want to try' : quick === 'tried' ? 'Tried' : filters.status,
      }),
    [quickFiltered, filters, quick, userCoords]
  );

  // Only a restaurant with a genuinely verified address-level coordinate
  // goes on the map — no suburb-centroid stand-ins, no guessed pins. This
  // is a data-quality rule, not a hardcoded exclusion list, so it keeps
  // working correctly as new restaurants are researched and added.
  const mappable = useMemo(
    () =>
      ranked.filter(
        (r) => r.latitude != null && r.longitude != null && r.location_precision === 'address'
      ),
    [ranked]
  );

  const unmappableCount = useMemo(
    () => restaurants.length - restaurants.filter((r) => r.latitude != null && r.longitude != null && r.location_precision === 'address').length,
    [restaurants]
  );

  const listRestaurants = useMemo(() => {
    if (!bounds) return mappable;
    return mappable.filter((r) => bounds.contains([r.latitude!, r.longitude!]));
  }, [mappable, bounds]);

  const activeFilterCount =
    filters.cuisines.length +
    filters.venueTypes.length +
    filters.occasions.length +
    filters.priorities.length +
    (quick ? 1 : 0);

  function clearAll() {
    setQuick(null);
    setFilters(EMPTY_FILTERS);
  }

  function toggleQuick(v: Exclude<QuickFilter, null>) {
    setQuick((cur) => (cur === v ? null : v));
  }

  async function handleNearMe() {
    setLocating(true);
    setLocationError(null);
    const coords = await getBrowserLocation();
    setLocating(false);
    if (coords) {
      setUserCoords(coords);
    } else {
      setLocationError("Couldn't get your location — check permissions and try again.");
    }
  }

  return (
    // BottomNav is fixed/overlaid, not part of normal document flow — other
    // pages reserve pb-24 beneath their scrollable content so the last item
    // doesn't end up hidden behind it. Here the map fills a flex-1 region
    // sized by this wrapper, so that same pb-24 would just shrink the map
    // for no reason — a smaller reserve (roughly the nav's real height) is
    // enough, and matters more here given "occupy most of the viewport".
    <main className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto h-screen pb-16 flex flex-col">
      <header className="px-4 pt-safe-top pt-5 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400/80 mb-0.5">
              My Food List
            </p>
            <h1 className="font-serif text-[22px] leading-tight text-cream-50">Map</h1>
          </div>
          <div className="flex rounded-full border border-cream-300/15 overflow-hidden text-[12.5px]">
            {(['map', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3.5 py-1.5 capitalize tap-highlight-none ${
                  view === v ? 'bg-gold-500 text-forest-950 font-medium' : 'bg-forest-800/70 text-cream-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="px-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(
            [
              ['want_to_try', 'Want to try'],
              ['tried', 'Tried'],
              ['favourites', 'Favourites'],
              ['would_return', 'Would go back'],
            ] as [Exclude<QuickFilter, null>, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleQuick(key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] border tap-highlight-none ${
                quick === key
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-800/60 border-cream-300/15 text-cream-100'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setSheetOpen(true)}
            className="shrink-0 px-3 py-1.5 rounded-full text-[12.5px] border border-cream-300/15 bg-forest-800/60 text-cream-100 tap-highlight-none"
          >
            More{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
          {(quick || activeFilterCount > 0) && (
            <button onClick={clearAll} className="shrink-0 px-2 py-1.5 text-[12.5px] text-gold-400 tap-highlight-none">
              Clear
            </button>
          )}
        </div>
        <p className="text-[11.5px] text-cream-300/45 mt-2">
          {view === 'map'
            ? `${mappable.length} restaurant${mappable.length === 1 ? '' : 's'} on the map`
            : `${listRestaurants.length} in this area`}
          {unmappableCount > 0 &&
            ` — ${unmappableCount} don't have a confirmed address yet`}
        </p>
      </section>

      {loading && <p className="text-cream-300/50 text-sm py-8 text-center">Loading your list…</p>}
      {error && <p className="text-red-300 text-sm py-8 text-center">{error}</p>}

      {!loading && !error && (
        <div className="flex-1 min-h-0 relative">
          {/* Map stays mounted (just hidden) in List view so zoom/pan/bounds
              survive switching back, instead of re-fitting from scratch. */}
          <div className={`absolute inset-0 ${view === 'map' ? '' : 'invisible pointer-events-none'}`}>
            <RestaurantMap restaurants={mappable} userCoords={userCoords} onBoundsChange={setBounds} />

            <button
              onClick={handleNearMe}
              disabled={locating}
              className="absolute bottom-4 right-4 z-[1000] flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-forest-950/95 border border-cream-300/15 text-cream-50 text-[13px] font-medium shadow-cardHover tap-highlight-none disabled:opacity-60"
            >
              <span>{locating ? '…' : '📍'}</span>
              Near me
            </button>

            {locationError && (
              <div className="absolute bottom-20 left-4 right-4 z-[1000] px-3.5 py-2.5 rounded-xl bg-forest-950/95 border border-cream-300/15 text-cream-100 text-[12.5px]">
                {locationError}
              </div>
            )}
          </div>

          {view === 'list' && (
            <div className="absolute inset-0 overflow-y-auto px-4 pt-2 pb-4">
              <RestaurantList
                restaurants={listRestaurants}
                emptyMessage="Nothing on the map in this area — move or zoom out."
              />
            </div>
          )}
        </div>
      )}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        setFilters={setFilters}
        facets={facets}
        hasLocation={!!userCoords}
      />

      <BottomNav />
    </main>
  );
}

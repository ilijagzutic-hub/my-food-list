'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRestaurants } from '@/lib/useRestaurants';
import { rankRestaurants } from '@/lib/search';
import type { Coords } from '@/lib/types';
import RestaurantList from '@/components/RestaurantList';
import LocationInput from '@/components/LocationInput';
import BottomNav from '@/components/BottomNav';
import FilterSheet, { EMPTY_FILTERS, type Filters } from '@/components/FilterSheet';

interface QuickView {
  label: string;
  apply: (f: Filters) => Filters;
  needsLocation?: boolean;
}

export default function ExplorePage() {
  const { restaurants, loading, error } = useRestaurants();
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeQuickView, setActiveQuickView] = useState<string | null>(null);

  const facets = useMemo(() => {
    const cuisines = new Set<string>();
    const venueTypes = new Set<string>();
    const occasions = new Set<string>();
    const cuisineCounts = new Map<string, number>();
    restaurants.forEach((r) => {
      (r.cuisine || []).forEach((c) => {
        cuisines.add(c);
        cuisineCounts.set(c, (cuisineCounts.get(c) || 0) + 1);
      });
      (r.venue_type || []).forEach((v) => venueTypes.add(v));
      (r.occasions || []).forEach((o) => occasions.add(o));
    });
    const topCuisines = Array.from(cuisineCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([c]) => c);
    return {
      cuisines: Array.from(cuisines).sort(),
      venueTypes: Array.from(venueTypes).sort(),
      occasions: Array.from(occasions).sort(),
      topCuisines,
    };
  }, [restaurants]);

  const quickViews: QuickView[] = useMemo(() => {
    const views: QuickView[] = [
      { label: 'Favourites', apply: (f) => f },
      { label: 'Very High Priority', apply: (f) => ({ ...f, priorities: ['VERY HIGH'] }) },
      { label: 'Near Me', apply: (f) => f, needsLocation: true },
      { label: 'Tried', apply: (f) => ({ ...f, status: 'Tried' }) },
    ];
    facets.occasions
      .filter((o) => /date/i.test(o) || /casual/i.test(o))
      .forEach((o) => views.push({ label: o, apply: (f) => ({ ...f, occasions: [o] }) }));
    facets.topCuisines.forEach((c) =>
      views.push({ label: c, apply: (f) => ({ ...f, cuisines: [c] }) })
    );
    return views;
  }, [facets]);

  function selectQuickView(qv: QuickView) {
    if (activeQuickView === qv.label) {
      setActiveQuickView(null);
      setFilters(EMPTY_FILTERS);
      setFavouritesOnly(false);
      return;
    }
    setActiveQuickView(qv.label);
    setFavouritesOnly(qv.label === 'Favourites');
    setFilters(qv.apply(EMPTY_FILTERS));
  }

  // Home's quick actions link here with a query string instead of
  // duplicating any filtering logic — this is the only place that reads
  // it, translating it into the same Filters/quick-view state a manual tap
  // in Explore would produce. Plain browser API (no next/navigation
  // useSearchParams) so this needs no Suspense boundary under static export.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;

    const priority = params.get('priority');
    const occasion = params.get('occasion');
    const occasionGroup = params.get('occasionGroup');
    const near = params.get('near');
    const favourites = params.get('favourites');

    if (favourites) {
      setFavouritesOnly(true);
      setActiveQuickView('Favourites');
    } else if (priority) {
      setFilters((f) => ({ ...f, priorities: [priority] }));
      setActiveQuickView('Very High Priority');
    } else if (occasionGroup === 'casual') {
      const matches = facets.occasions.filter((o) => /casual/i.test(o));
      if (matches.length) setFilters((f) => ({ ...f, occasions: matches }));
    } else if (occasion) {
      setFilters((f) => ({ ...f, occasions: [occasion] }));
      const matchingChip = facets.occasions.find((o) => o === occasion);
      if (matchingChip) setActiveQuickView(matchingChip);
    } else if (near) {
      setActiveQuickView('Near Me');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facets.occasions.length]);

  const results = useMemo(
    () =>
      rankRestaurants(
        favouritesOnly ? restaurants.filter((r) => r.is_favourite) : restaurants,
        {
          query,
          coords,
          cuisines: filters.cuisines,
          venueTypes: filters.venueTypes,
          occasions: filters.occasions,
          priorities: filters.priorities,
          status: filters.status,
          maxDistanceKm: filters.maxDistanceKm,
        }
      ),
    [restaurants, query, coords, filters, favouritesOnly]
  );

  const activeFilterCount =
    filters.cuisines.length +
    filters.venueTypes.length +
    filters.occasions.length +
    filters.priorities.length +
    (filters.status !== 'All' ? 1 : 0) +
    (filters.maxDistanceKm ? 1 : 0) +
    (favouritesOnly ? 1 : 0);

  return (
    <main className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen pb-24">
      <header className="px-4 pt-safe-top pt-8 pb-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400/80 mb-1">
          My Food List
        </p>
        <h1 className="font-serif text-[26px] leading-tight text-cream-50">Explore</h1>
      </header>

      <section className="px-4 mt-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, cuisine, tags, dishes…"
          className="flex-1 bg-forest-800/70 border border-cream-300/15 rounded-full px-4 py-2.5 text-[14px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
        />
        <button
          onClick={() => setSheetOpen(true)}
          className="shrink-0 flex items-center gap-1 px-4 rounded-full bg-forest-800/70 border border-cream-300/15 text-[13px] text-cream-100"
        >
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </section>

      <section className="mt-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
          {quickViews.map((qv) => (
            <button
              key={qv.label}
              onClick={() => selectQuickView(qv)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
                activeQuickView === qv.label
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-800/60 border-cream-300/15 text-cream-100'
              }`}
            >
              {qv.label}
            </button>
          ))}
        </div>
      </section>

      {(activeQuickView === 'Near Me' || filters.maxDistanceKm) && (
        <section className="px-4 mt-3">
          <LocationInput
            onLocationChange={(c, label) => {
              setCoords(c);
              setLocationLabel(label);
            }}
            locationLabel={locationLabel}
          />
        </section>
      )}

      <section className="px-4 mt-5">
        <p className="text-[12.5px] text-cream-300/50 mb-2.5">
          {results.length} restaurant{results.length === 1 ? '' : 's'}
        </p>
        {loading && (
          <p className="text-cream-300/50 text-sm py-8 text-center">Loading your list…</p>
        )}
        {error && <p className="text-red-300 text-sm py-8 text-center">{error}</p>}
        {!loading && !error && (
          <RestaurantList
            restaurants={results}
            emptyMessage={
              favouritesOnly
                ? "No favourites yet — tap the star on any restaurant to add one."
                : undefined
            }
          />
        )}
      </section>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        setFilters={setFilters}
        facets={facets}
        hasLocation={!!coords}
      />

      <BottomNav />
    </main>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRestaurants } from '@/lib/useRestaurants';
import { topRecommendations } from '@/lib/search';
import type { Coords } from '@/lib/types';
import RestaurantList from '@/components/RestaurantList';
import LocationInput from '@/components/LocationInput';
import CravingChips from '@/components/CravingChips';
import BottomNav from '@/components/BottomNav';

export default function HomePage() {
  const { restaurants, loading, error } = useRestaurants();
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationLabel, setLocationLabel] = useState('');

  const hasQuery = query.trim().length > 0;

  const recommendations = useMemo(
    () =>
      topRecommendations(
        restaurants,
        { query, coords, status: 'Want to try' },
        hasQuery || coords ? 5 : 4
      ),
    [restaurants, query, coords, hasQuery]
  );

  const heading = hasQuery
    ? `For "${query}"`
    : coords
    ? 'Strong picks near you'
    : 'Tonight’s strongest picks';

  return (
    <main className="max-w-md mx-auto min-h-screen pb-24">
      <header className="px-4 pt-safe-top pt-8 pb-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400/80 mb-1">
          My Food List
        </p>
        <h1 className="font-serif text-[26px] leading-tight text-cream-50">
          Where should I eat?
        </h1>
      </header>

      <section className="px-4 mt-5">
        <label className="text-xs uppercase tracking-wide text-cream-300/50 mb-2 block">
          What do you feel like?
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ramen, date night, spicy…"
          className="w-full bg-forest-800/70 border border-cream-300/15 rounded-full px-4 py-3 text-[15px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
        />
        <div className="mt-3">
          <CravingChips active={query} onSelect={setQuery} />
        </div>
      </section>

      <section className="px-4 mt-5">
        <label className="text-xs uppercase tracking-wide text-cream-300/50 mb-2 block">
          Where are you?
        </label>
        <LocationInput
          onLocationChange={(c, label) => {
            setCoords(c);
            setLocationLabel(label);
          }}
          locationLabel={locationLabel}
        />
      </section>

      <section className="px-4 mt-7">
        <h2 className="font-serif text-[18px] text-cream-50 mb-3">{heading}</h2>

        {loading && (
          <p className="text-cream-300/50 text-sm py-8 text-center">Loading your list…</p>
        )}
        {error && <p className="text-red-300 text-sm py-8 text-center">{error}</p>}
        {!loading && !error && (
          <RestaurantList
            restaurants={recommendations}
            emptyMessage="Nothing matched that craving yet — try Browse All."
          />
        )}
      </section>

      <BottomNav />
    </main>
  );
}

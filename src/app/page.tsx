'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRestaurants } from '@/lib/useRestaurants';
import {
  rankRestaurants,
  topPicksForYou,
  worthTryingSoon,
  goBackHere,
  somethingNew,
  type RankedRestaurant,
} from '@/lib/search';
import { getBrowserLocation } from '@/lib/geo';
import type { Coords } from '@/lib/types';
import RestaurantList from '@/components/RestaurantList';
import LocationInput from '@/components/LocationInput';
import CravingChips from '@/components/CravingChips';
import QuickActions from '@/components/QuickActions';
import SectionHeading from '@/components/SectionHeading';
import BottomNav from '@/components/BottomNav';

function Rail({
  title,
  subtitle,
  restaurants,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  restaurants: RankedRestaurant[];
  emptyMessage: string;
}) {
  return (
    <section className="px-4 mt-7">
      <SectionHeading title={title} subtitle={subtitle} />
      {restaurants.length === 0 ? (
        <p className="text-cream-300/50 text-[13.5px] py-4">{emptyMessage}</p>
      ) : (
        <RestaurantList restaurants={restaurants} />
      )}
    </section>
  );
}

export default function HomePage() {
  const { restaurants, loading, error } = useRestaurants();
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationDenied, setLocationDenied] = useState(false);
  const [somethingNewPick, setSomethingNewPick] = useState<RankedRestaurant | null | undefined>(
    undefined
  );

  const hasQuery = query.trim().length > 0;

  // Silently try the device's location on load so distance-aware sections
  // work by default, instead of pulling from anywhere in the city.
  useEffect(() => {
    let cancelled = false;
    getBrowserLocation().then((c) => {
      if (cancelled) return;
      if (c) {
        setCoords((prev) => prev ?? c);
        setLocationLabel((prev) => prev || 'Current location');
      } else {
        setLocationDenied(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A typed craving is a real search: it surfaces every match, including
  // Tried places, rather than the curated Want-to-try-only rails below.
  const searchResults = useMemo(
    () => (hasQuery ? rankRestaurants(restaurants, { query, coords, status: 'All' }) : []),
    [restaurants, query, coords, hasQuery]
  );

  const topPicks = useMemo(
    () => topPicksForYou(restaurants, { coords }),
    [restaurants, coords]
  );
  const worthTrying = useMemo(
    () => worthTryingSoon(restaurants, { coords }),
    [restaurants, coords]
  );
  const goBack = useMemo(() => goBackHere(restaurants, { coords }), [restaurants, coords]);

  function pickSomethingNew() {
    setSomethingNewPick(somethingNew(restaurants, { coords }));
  }

  return (
    <main className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen pb-24">
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
        {locationDenied && !coords && (
          <p className="text-[12.5px] text-cream-300/50 mt-2">
            Turn on location, or search above, for picks near you.
          </p>
        )}
      </section>

      <section className="px-4 mt-5">
        <label className="text-xs uppercase tracking-wide text-cream-300/50 mb-2 block">
          Quick actions
        </label>
        <QuickActions onSomethingNew={pickSomethingNew} />
      </section>

      {somethingNewPick !== undefined && (
        <section className="px-4 mt-5">
          <SectionHeading
            title="Something new"
            subtitle="A Want-to-try pick, weighted toward your priorities"
            action={
              <button onClick={pickSomethingNew} className="text-[13px] text-gold-400 tap-highlight-none">
                Try another
              </button>
            }
          />
          {somethingNewPick === null ? (
            <p className="text-cream-300/50 text-[13.5px] py-4">
              Nothing left on your Want to Try list to suggest.
            </p>
          ) : (
            <RestaurantList restaurants={[somethingNewPick]} />
          )}
        </section>
      )}

      {loading && (
        <p className="text-cream-300/50 text-sm py-8 text-center">Loading your list…</p>
      )}
      {error && <p className="text-red-300 text-sm py-8 text-center">{error}</p>}

      {!loading && !error && hasQuery && (
        <section className="px-4 mt-7">
          <SectionHeading title={`For "${query}"`} />
          <RestaurantList
            restaurants={searchResults}
            emptyMessage="Nothing matched that craving yet — try Explore."
          />
        </section>
      )}

      {!loading && !error && !hasQuery && (
        <>
          <Rail
            title="Top picks for you"
            subtitle="Discovery — places you haven't tried yet"
            restaurants={topPicks}
            emptyMessage="Add a few more Want to Try spots to see picks here."
          />
          <Rail
            title="Worth trying soon"
            subtitle="Your HIGH / VERY HIGH priority untried spots"
            restaurants={worthTrying}
            emptyMessage="Nothing marked HIGH or VERY HIGH priority yet."
          />
          <Rail
            title="Go back here"
            subtitle="Tried, and you said you'd return"
            restaurants={goBack}
            emptyMessage="Once you've been back somewhere you loved, it'll show up here."
          />
        </>
      )}

      <BottomNav />
    </main>
  );
}

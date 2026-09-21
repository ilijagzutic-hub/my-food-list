'use client';

import { useMemo } from 'react';
import { useRestaurants } from '@/lib/useRestaurants';
import { rankRestaurants, type RankedRestaurant } from '@/lib/search';
import RestaurantList from '@/components/RestaurantList';
import SectionHeading from '@/components/SectionHeading';
import BottomNav from '@/components/BottomNav';
import type { RestaurantWithDishes } from '@/lib/types';

// restaurants.rating is a 0–10 scale (DB check constraint) — "Highly Rated"
// is defined against that real scale, not the 5-star picker the rating
// editor happens to expose today.
const HIGHLY_RATED_THRESHOLD = 8;

function ratingOf(r: RestaurantWithDishes): number | null {
  return typeof r.rating === 'number' ? r.rating : r.rating ? parseFloat(String(r.rating)) : null;
}

function Group({
  title,
  restaurants,
  emptyMessage,
}: {
  title: string;
  restaurants: RankedRestaurant[];
  emptyMessage: string;
}) {
  return (
    <section className="px-4 mt-7">
      <SectionHeading title={title} subtitle={`${restaurants.length} restaurant${restaurants.length === 1 ? '' : 's'}`} />
      {restaurants.length === 0 ? (
        <p className="text-cream-300/50 text-[13.5px] py-4">{emptyMessage}</p>
      ) : (
        <RestaurantList restaurants={restaurants} />
      )}
    </section>
  );
}

export default function MyFoodPage() {
  const { restaurants, loading, error } = useRestaurants();

  const favourites = useMemo(
    () => rankRestaurants(restaurants.filter((r) => r.is_favourite), {}),
    [restaurants]
  );
  const tried = useMemo(
    () => rankRestaurants(restaurants, { status: 'Tried' }),
    [restaurants]
  );
  const wantToTry = useMemo(
    () => rankRestaurants(restaurants, { status: 'Want to try' }),
    [restaurants]
  );
  const highlyRated = useMemo(
    () =>
      rankRestaurants(
        restaurants.filter((r) => {
          const n = ratingOf(r);
          return n != null && n >= HIGHLY_RATED_THRESHOLD;
        }),
        {}
      ),
    [restaurants]
  );
  const wouldGoBack = useMemo(
    () => rankRestaurants(restaurants.filter((r) => r.visit_again === 'yes'), {}),
    [restaurants]
  );

  return (
    <main className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto min-h-screen pb-24">
      <header className="px-4 pt-safe-top pt-8 pb-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold-400/80 mb-1">
          My Food List
        </p>
        <h1 className="font-serif text-[26px] leading-tight text-cream-50">My Food</h1>
        <p className="text-[13px] text-cream-300/60 mt-1.5">
          Your personal memory of this list — favourites, history, and what's still ahead.
        </p>
      </header>

      {loading && (
        <p className="text-cream-300/50 text-sm py-8 text-center">Loading your list…</p>
      )}
      {error && <p className="text-red-300 text-sm py-8 text-center">{error}</p>}

      {!loading && !error && (
        <>
          <Group
            title="Favourites"
            restaurants={favourites}
            emptyMessage="No favourites yet — tap the star on any restaurant to add one."
          />
          <Group
            title="Would go back"
            restaurants={wouldGoBack}
            emptyMessage="Once you've rated a visit 'would go back', it'll show up here."
          />
          <Group
            title="Highly rated"
            restaurants={highlyRated}
            emptyMessage={`No restaurants rated ${HIGHLY_RATED_THRESHOLD}/10 or above yet.`}
          />
          <Group
            title="Tried"
            restaurants={tried}
            emptyMessage="Nothing marked Tried yet."
          />
          <Group
            title="Want to try"
            restaurants={wantToTry}
            emptyMessage="Your Want to Try list is empty."
          />
        </>
      )}

      <BottomNav />
    </main>
  );
}

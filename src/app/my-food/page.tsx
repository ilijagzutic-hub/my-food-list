'use client';

import { useMemo, useState } from 'react';
import { useRestaurants } from '@/lib/useRestaurants';
import { rankRestaurants, type RankedRestaurant } from '@/lib/search';
import { parseRating } from '@/lib/rating';
import RestaurantList from '@/components/RestaurantList';
import RestaurantMiniRow from '@/components/RestaurantMiniRow';
import SectionHeading from '@/components/SectionHeading';
import BottomNav from '@/components/BottomNav';
import type { RestaurantWithDishes } from '@/lib/types';

type Tab = 'favourites' | 'tried' | 'want_to_try' | 'would_return';

const TABS: { value: Tab; label: string }[] = [
  { value: 'favourites', label: 'Favourites' },
  { value: 'tried', label: 'Tried' },
  { value: 'want_to_try', label: 'Want to try' },
  { value: 'would_return', label: 'Would return' },
];

const DASHBOARD_CAP = 4;

function DashboardSection({
  title,
  subtitle,
  restaurants,
  emptyMessage,
  seeAll,
}: {
  title: string;
  subtitle?: string;
  restaurants: RestaurantWithDishes[];
  emptyMessage: string;
  seeAll?: { count: number; onClick: () => void };
}) {
  return (
    <section className="px-4 mt-7">
      <SectionHeading
        title={title}
        subtitle={subtitle}
        action={
          seeAll && seeAll.count > DASHBOARD_CAP ? (
            <button
              onClick={seeAll.onClick}
              className="text-[13px] text-gold-400 tap-highlight-none"
            >
              See all {seeAll.count}
            </button>
          ) : undefined
        }
      />
      {restaurants.length === 0 ? (
        <p className="text-cream-300/50 text-[13px] py-2">{emptyMessage}</p>
      ) : (
        <div className="rounded-xl2 bg-forest-800/60 border border-cream-300/10 px-3.5">
          {restaurants.map((r) => (
            <RestaurantMiniRow key={r.id} restaurant={r} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function MyFoodPage() {
  const { restaurants, loading, error } = useRestaurants();
  const [tab, setTab] = useState<Tab | null>(null);

  // Full, ranked lists per category — used both for the dashboard previews
  // (sliced) and the full single-category view when a tab is selected.
  const favourites = useMemo(
    () => rankRestaurants(restaurants.filter((r) => r.is_favourite), {}),
    [restaurants]
  );
  const tried = useMemo(() => {
    const list = rankRestaurants(restaurants, { status: 'Tried' });
    // Most recently visited first — falls back to updated_at for the rows
    // that predate visit tracking, but never invents a date.
    return [...list].sort((a, b) => {
      const ta = new Date(a.last_visited_at || a.updated_at).getTime();
      const tb = new Date(b.last_visited_at || b.updated_at).getTime();
      return tb - ta;
    });
  }, [restaurants]);
  const wantToTry = useMemo(
    () => rankRestaurants(restaurants, { status: 'Want to try' }),
    [restaurants]
  );
  const wouldReturn = useMemo(
    () => rankRestaurants(restaurants.filter((r) => r.visit_again === 'yes'), {}),
    [restaurants]
  );
  const highestRated = useMemo(() => {
    const rated = restaurants.filter((r) => parseRating(r.rating) != null);
    return [...rated].sort((a, b) => (parseRating(b.rating) ?? 0) - (parseRating(a.rating) ?? 0));
  }, [restaurants]);

  const byTab: Record<Tab, { title: string; list: RankedRestaurant[]; emptyMessage: string }> = {
    favourites: {
      title: 'Favourites',
      list: favourites,
      emptyMessage: 'No favourites yet — tap the star on any restaurant to add one.',
    },
    tried: {
      title: 'Tried',
      list: tried,
      emptyMessage: 'Nothing marked Tried yet.',
    },
    want_to_try: {
      title: 'Want to try',
      list: wantToTry,
      emptyMessage: 'Your Want to Try list is empty.',
    },
    would_return: {
      title: 'Would return',
      list: wouldReturn,
      emptyMessage: "Once you've rated a visit 'would go back', it'll show up here.",
    },
  };

  function toggleTab(t: Tab) {
    setTab((cur) => (cur === t ? null : t));
  }

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

      <section className="mt-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => toggleTab(t.value)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
                tab === t.value
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-800/60 border-cream-300/15 text-cream-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {loading && (
        <p className="text-cream-300/50 text-sm py-8 text-center">Loading your list…</p>
      )}
      {error && <p className="text-red-300 text-sm py-8 text-center">{error}</p>}

      {!loading && !error && tab && (
        <section className="px-4 mt-6">
          <SectionHeading
            title={byTab[tab].title}
            subtitle={`${byTab[tab].list.length} restaurant${byTab[tab].list.length === 1 ? '' : 's'}`}
          />
          <RestaurantList restaurants={byTab[tab].list} emptyMessage={byTab[tab].emptyMessage} />
        </section>
      )}

      {!loading && !error && !tab && (
        <>
          <DashboardSection
            title="Recent / Tried"
            subtitle="Most recently visited first"
            restaurants={tried.slice(0, DASHBOARD_CAP)}
            emptyMessage="Nothing marked Tried yet."
            seeAll={{ count: tried.length, onClick: () => setTab('tried') }}
          />
          <DashboardSection
            title="Favourites"
            restaurants={favourites.slice(0, DASHBOARD_CAP)}
            emptyMessage="No favourites yet — tap the star on any restaurant to add one."
            seeAll={{ count: favourites.length, onClick: () => setTab('favourites') }}
          />
          <DashboardSection
            title="Highest rated"
            restaurants={highestRated.slice(0, DASHBOARD_CAP)}
            emptyMessage="No ratings saved yet."
          />
          <DashboardSection
            title="Want to try next"
            subtitle="By priority"
            restaurants={wantToTry.slice(0, DASHBOARD_CAP)}
            emptyMessage="Your Want to Try list is empty."
            seeAll={{ count: wantToTry.length, onClick: () => setTab('want_to_try') }}
          />
        </>
      )}

      <BottomNav />
    </main>
  );
}

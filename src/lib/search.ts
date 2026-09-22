import type { Coords, RestaurantWithDishes } from './types';
import { haversineKm } from './geo';
import { parseRating } from './rating';

const PRIORITY_WEIGHT: Record<string, number> = {
  'VERY HIGH': 3,
  HIGH: 2,
  NORMAL: 1,
  LOW: 0.3,
};

// A plain tier rank (not the blended score) for sorts/rails that need to
// order by priority first, deterministically — e.g. "Want to try" and the
// Explore "Priority" sort.
const PRIORITY_RANK: Record<string, number> = {
  'VERY HIGH': 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

// Light synonym expansion so common cravings surface good matches even when
// the exact word isn't in the restaurant's own tags/cuisine/summary text.
const SYNONYMS: Record<string, string[]> = {
  spicy: ['spicy', 'chilli', 'chili', 'hot', 'szechuan', 'sichuan'],
  seafood: ['seafood', 'fish', 'prawn', 'prawns', 'oyster', 'oysters', 'crab', 'lobster', 'sashimi'],
  ramen: ['ramen', 'noodle', 'noodles', 'japanese'],
  burgers: ['burger', 'burgers', 'smashburger'],
  bakery: ['bakery', 'bake', 'pastry', 'pastries', 'bread', 'patisserie'],
  'date night': ['date night', 'romantic', 'intimate', 'wine bar'],
  'group dinner': ['group', 'group dinner', 'group meal', 'sharing', 'shared plates', 'banquet'],
  'casual lunch': ['casual', 'casual lunch', 'lunch', 'quick bite'],
  thai: ['thai', 'thailand', 'pad thai'],
  brunch: ['brunch', 'breakfast', 'cafe'],
};

function expandTokens(raw: string): string[] {
  const q = raw.toLowerCase().trim();
  if (!q) return [];
  const direct = q.split(/\s+/).filter(Boolean);
  const extra = SYNONYMS[q] || [];
  return Array.from(new Set([...direct, q, ...extra]));
}

function searchableText(r: RestaurantWithDishes): string {
  const parts: (string | null | undefined)[] = [
    r.name,
    r.suburb,
    r.city,
    r.region,
    r.summary,
    r.user_notes,
    r.source_notes,
    ...(r.cuisine || []),
    ...(r.venue_type || []),
    ...(r.occasions || []),
    ...(r.tags || []),
    ...(r.dishes || []).flatMap((d) => [d.name, d.description]),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export interface RankOptions {
  query?: string;
  coords?: Coords | null;
  cuisines?: string[];
  venueTypes?: string[];
  occasions?: string[];
  priorities?: string[];
  status?: 'Want to try' | 'Tried' | 'All';
  maxDistanceKm?: number | null;
}

export interface RankedRestaurant extends RestaurantWithDishes {
  _score: number;
  _matched: boolean;
}

export function rankRestaurants(
  restaurants: RestaurantWithDishes[],
  opts: RankOptions
): RankedRestaurant[] {
  const tokens = expandTokens(opts.query || '');
  const hasQuery = tokens.length > 0;

  const withDistance = restaurants.map((r) => {
    let distanceKm: number | null = null;
    if (opts.coords && r.latitude != null && r.longitude != null) {
      distanceKm = haversineKm(opts.coords, { lat: r.latitude, lon: r.longitude });
    }
    return { ...r, distanceKm };
  });

  const filtered = withDistance.filter((r) => {
    if (r.closed) return false;
    if (opts.status && opts.status !== 'All' && r.status !== opts.status) return false;
    if (opts.cuisines?.length && !r.cuisine?.some((c) => opts.cuisines!.includes(c))) return false;
    if (opts.venueTypes?.length && !r.venue_type?.some((v) => opts.venueTypes!.includes(v)))
      return false;
    if (opts.occasions?.length && !r.occasions?.some((o) => opts.occasions!.includes(o)))
      return false;
    if (opts.priorities?.length && !opts.priorities.includes(r.priority || 'NORMAL')) return false;
    if (
      opts.maxDistanceKm != null &&
      r.distanceKm != null &&
      r.distanceKm > opts.maxDistanceKm
    )
      return false;
    return true;
  });

  const scored: RankedRestaurant[] = filtered.map((r) => {
    let score = 0;
    let matched = !hasQuery;

    if (hasQuery) {
      const text = searchableText(r);
      let hits = 0;
      for (const t of tokens) {
        if (!t) continue;
        if (text.includes(t)) {
          hits += 1;
          // Name matches count extra — a craving that names the restaurant
          // directly should surface it strongly.
          if (r.name.toLowerCase().includes(t)) hits += 1.5;
        }
      }
      if (hits > 0) {
        matched = true;
        score += Math.min(hits, 6) * 6; // cap so one field stuffed with matches doesn't dominate
      }
    }

    // Priority: a meaningful, not overwhelming, influence.
    score += (PRIORITY_WEIGHT[r.priority || 'NORMAL'] ?? 1) * 4;

    // Rating, once the restaurant has been tried and rated.
    const ratingNum =
      typeof r.rating === 'number' ? r.rating : r.rating ? parseFloat(String(r.rating)) : null;
    if (r.status === 'Tried' && ratingNum != null && !Number.isNaN(ratingNum)) {
      score += ratingNum * 1.5;
    }

    // Distance: closer is better, but capped so it nudges rather than dominates.
    if (r.distanceKm != null) {
      const distanceBonus = Math.max(0, 8 - Math.min(r.distanceKm, 8));
      score += distanceBonus;
    }

    return { ...r, _score: score, _matched: matched };
  });

  const result = hasQuery ? scored.filter((r) => r._matched) : scored;
  result.sort((a, b) => b._score - a._score);
  return result;
}

/** Top picks for the home screen — a short, decisive list, not the whole catalog. */
export function topRecommendations(
  restaurants: RestaurantWithDishes[],
  opts: RankOptions,
  count = 5
): RankedRestaurant[] {
  return rankRestaurants(restaurants, opts).slice(0, count);
}

// ---------------------------------------------------------------------------
// Home V2 curated rails. Each reuses the same rankRestaurants scoring engine
// (no separate/duplicated filtering logic) — they differ only in which
// status/priority slice of the ranked list they draw from.
// ---------------------------------------------------------------------------

/**
 * "Top picks for you" — discovery, not repeat-visit recommendations.
 * Deliberately scoped to Want to try only, so restaurants already tried
 * live in "Go back here" instead of showing up in both places.
 */
export function topPicksForYou(
  restaurants: RestaurantWithDishes[],
  opts: RankOptions,
  count = 6
): RankedRestaurant[] {
  return rankRestaurants(restaurants, { ...opts, status: 'Want to try' }).slice(0, count);
}

/**
 * "Want to try" — everything else on the Want-to-try list, deliberately
 * excluding whatever "Top picks for you" is already showing so the two
 * rails don't just repeat each other in a different order. Ordered by
 * priority tier first, then the existing recommendation score, then id as
 * a stable, deterministic fallback.
 */
export function wantToTryRail(
  restaurants: RestaurantWithDishes[],
  opts: RankOptions,
  count = 6
): RankedRestaurant[] {
  const shownInTopPicks = new Set(
    topPicksForYou(restaurants, opts, count).map((r) => r.id)
  );
  const pool = rankRestaurants(restaurants, { ...opts, status: 'Want to try' }).filter(
    (r) => !shownInTopPicks.has(r.id)
  );
  pool.sort((a, b) => {
    const byPriority =
      (PRIORITY_RANK[b.priority || 'NORMAL'] ?? 0) - (PRIORITY_RANK[a.priority || 'NORMAL'] ?? 0);
    if (byPriority !== 0) return byPriority;
    if (b._score !== a._score) return b._score - a._score;
    return a.id - b.id;
  });
  return pool.slice(0, count);
}

/** "Go back here" — Tried restaurants we've said we'd return to. */
export function goBackHere(
  restaurants: RestaurantWithDishes[],
  opts: RankOptions,
  count = 6
): RankedRestaurant[] {
  return rankRestaurants(restaurants, { ...opts, status: 'Tried' })
    .filter((r) => r.visit_again === 'yes')
    .slice(0, count);
}

/**
 * "Something new" — a single surprise suggestion from the Want-to-try list,
 * not a plain random pick across all 100+ untried restaurants. Draws from a
 * pool of the strongest-ranked candidates (priority + any other existing
 * signal already in rankRestaurants) so HIGH/VERY HIGH restaurants are more
 * likely to come up, then picks randomly within that pool for variety.
 * Returns null when there's nothing untried to suggest.
 */
export function somethingNew(
  restaurants: RestaurantWithDishes[],
  opts: RankOptions,
  poolSize = 12
): RankedRestaurant | null {
  const ranked = rankRestaurants(restaurants, { ...opts, status: 'Want to try' });
  if (!ranked.length) return null;
  const pool = ranked.slice(0, Math.min(poolSize, ranked.length));
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------------------
// Explore sorting. Each option only uses data that actually exists — there's
// no "recently visited" sort, for example, because last_visited_at is null
// for almost everything (see visit history in a later stage). There's also
// no "recently added" sort: 91 of 112 restaurants (81%) share a created_at
// within the first two days after the Stage 1 bulk import, so that column
// reflects import-batch order, not a meaningful "when I added this to my
// list" date — sorting by it would mostly just replay the migration script.
// Applied after rankRestaurants, so filtering/scoring stays in one place;
// sort only reorders the already-filtered list.
// ---------------------------------------------------------------------------

export type SortKey = 'recommended' | 'nearest' | 'rating' | 'priority';

export const SORT_OPTIONS: { value: SortKey; label: string; needsLocation?: boolean }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'nearest', label: 'Nearest', needsLocation: true },
  { value: 'rating', label: 'Highest rated' },
  { value: 'priority', label: 'Priority' },
];

export function sortRestaurants(list: RankedRestaurant[], key: SortKey): RankedRestaurant[] {
  const arr = [...list];
  switch (key) {
    case 'nearest':
      return arr.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    case 'rating':
      return arr.sort((a, b) => {
        const ra = parseRating(a.rating);
        const rb = parseRating(b.rating);
        if (ra == null && rb == null) return 0;
        if (ra == null) return 1;
        if (rb == null) return -1;
        return rb - ra;
      });
    case 'priority':
      return arr.sort((a, b) => {
        const byPriority =
          (PRIORITY_RANK[b.priority || 'NORMAL'] ?? 0) -
          (PRIORITY_RANK[a.priority || 'NORMAL'] ?? 0);
        if (byPriority !== 0) return byPriority;
        return b._score - a._score;
      });
    case 'recommended':
    default:
      return arr;
  }
}

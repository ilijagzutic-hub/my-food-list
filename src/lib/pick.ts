import type { Coords, RestaurantWithDishes } from './types';
import { haversineKm, formatDistance } from './geo';
import { parseRating } from './rating';

// ---------------------------------------------------------------------------
// Stage 6A — Pick for Me: a transparent, deterministic decision engine over
// restaurants already in My Food List. Not a recommendation/ML system — see
// the comments below for exactly why each signal counts what it counts.
//
// Deliberately separate from search.ts's rankRestaurants(): that function is
// tuned for open-ended search-query relevance across the whole catalogue
// (Explore/Home). Pick has a different shape entirely — a short sequence of
// HARD constraints (cuisine, distance/area, new-vs-repeat) followed by a
// SOFT score with explainable reason codes, and it needs to distinguish
// "we researched this" from "you told us you liked this", which
// rankRestaurants has no reason to care about. It reuses the same low-level
// primitives (haversineKm, formatDistance, parseRating) rather than
// reimplementing them.
// ---------------------------------------------------------------------------

export type ReasonCode =
  | 'nearby'
  | 'exact_cuisine'
  | 'food_match'
  | 'occasion_match'
  | 'favourite'
  | 'highly_rated'
  | 'would_return'
  | 'something_new'
  | 'known_for_dish'
  | 'high_interest'
  | 'really_want_to_try';

export type WhereMode = 'near' | 'area' | 'anywhere';
export type NewOrRepeat = 'new' | 'repeat' | 'either';

export interface PickAnswers {
  where: WhereMode;
  coords: Coords | null; // set once geolocation resolves, where='near' only
  maxDistanceKm: number | null; // where='near' only
  area: string | null; // exact suburb or city string, where='area' only
  occasion: string | null; // an OCCASION_OPTIONS key, or null = Anything
  cuisine: string | null; // an exact cuisine string as stored on restaurants, or null = Anything
  foodQuery: string; // free-text dish/tag search, '' = none
  newOrRepeat: NewOrRepeat;
  // A restaurant marked visit_again='no' is excluded from the "Go back
  // somewhere" pool by default (see applyHardConstraints) — this is the
  // one explicit, user-triggered override, offered as a relaxation rather
  // than ever applied automatically.
  includeVisitAgainNo: boolean;
}

export const DEFAULT_ANSWERS: PickAnswers = {
  where: 'anywhere',
  coords: null,
  maxDistanceKm: 5,
  area: null,
  occasion: null,
  cuisine: null,
  foodQuery: '',
  newOrRepeat: 'either',
  includeVisitAgainNo: false,
};

export const DISTANCE_OPTIONS_KM = [2, 5, 10, 20];

// Derived from the actual occasions text on file (see Stage 6A build notes)
// rather than invented wholesale — free-text values like "Casual lunch" /
// "Special dinner" / "Quick meal" get bucketed into these few practical
// choices. Genuinely absent from a restaurant's occasions (most rows —
// occasions is only ~40% populated) never eliminates it; a match just adds
// a meaningful score boost. See occasionMatches() below.
export const OCCASION_OPTIONS: { key: string; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'date_night', label: 'Date night' },
  { key: 'quick_bite', label: 'Quick bite' },
  { key: 'breakfast_brunch', label: 'Breakfast / Brunch' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

const OCCASION_MATCH: Record<string, string[]> = {
  casual: ['casual'],
  date_night: ['date night'],
  quick_bite: ['quick', 'takeaway'],
  breakfast_brunch: ['breakfast', 'brunch', 'morning'],
  lunch: ['lunch'],
  dinner: ['dinner'],
};

function occasionMatches(r: RestaurantWithDishes, occasionKey: string | null): boolean {
  if (!occasionKey) return false;
  const needles = OCCASION_MATCH[occasionKey] || [];
  if (!needles.length) return false;
  const hay = (r.occasions || []).join(' ').toLowerCase();
  return needles.some((n) => hay.includes(n));
}

function foodQueryMatches(r: RestaurantWithDishes, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if ((r.tags || []).some((t) => t.toLowerCase().includes(q))) return true;
  return (r.dishes || []).some(
    (d) => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
  );
}

export type EligibleRestaurant = RestaurantWithDishes & { distanceKm: number | null };

/**
 * Hard constraints only — cuisine, distance/area, and Something New vs Go
 * Back. Pure and side-effect-free so the "how many would this leave"
 * relaxation math (below) can call it repeatedly without surprises.
 */
export function applyHardConstraints(
  restaurants: RestaurantWithDishes[],
  answers: PickAnswers
): EligibleRestaurant[] {
  return restaurants
    .filter((r) => !r.closed)
    .filter((r) => {
      // A distance-constrained recommendation is only meaningful with a
      // real, verified address-level coordinate — never a suburb centroid,
      // matching Stage 5B's own map-eligibility rule.
      if (answers.where === 'near' && answers.coords && answers.maxDistanceKm != null) {
        return r.latitude != null && r.longitude != null && r.location_precision === 'address';
      }
      return true;
    })
    .map((r): EligibleRestaurant => {
      const distanceKm =
        answers.coords && r.latitude != null && r.longitude != null
          ? haversineKm(answers.coords, { lat: r.latitude, lon: r.longitude })
          : null;
      return { ...r, distanceKm };
    })
    .filter((r) => {
      if (answers.where === 'near' && answers.maxDistanceKm != null && r.distanceKm != null) {
        return r.distanceKm <= answers.maxDistanceKm;
      }
      return true;
    })
    .filter((r) => {
      if (answers.where === 'area' && answers.area) {
        const a = answers.area.toLowerCase();
        return (r.suburb || '').toLowerCase() === a || (r.city || '').toLowerCase() === a;
      }
      return true;
    })
    .filter((r) => {
      if (!answers.cuisine) return true;
      return (r.cuisine || []).some((c) => c.toLowerCase() === answers.cuisine!.toLowerCase());
    })
    .filter((r) => {
      if (answers.newOrRepeat === 'new') return r.status === 'Want to try';
      if (answers.newOrRepeat === 'repeat') {
        // visit_again='no' is excluded by default (see suggestRelaxations
        // for the one-tap, user-controlled way back in via
        // includeVisitAgainNo) — never silently included otherwise.
        if (answers.includeVisitAgainNo) return r.status === 'Tried';
        return r.status === 'Tried' && r.visit_again !== 'no';
      }
      return true; // either
    });
}

export interface ScoredPick {
  restaurant: EligibleRestaurant;
  score: number;
  reasons: ReasonCode[];
}

const PRIORITY_WEIGHT: Record<string, number> = {
  'VERY HIGH': 2,
  HIGH: 1.4,
  NORMAL: 0.6,
  LOW: 0.2,
};

/**
 * Scores restaurants that have ALREADY passed applyHardConstraints. Signal
 * weights are deliberately tiered — see Stage 6A's brief:
 *   Strong:   proximity, exact cuisine (already guaranteed true here),
 *             food/tag match, occasion match, Really Want to Try (Stage 6B)
 *   Moderate: favourite, personal rating, visit_again, known-for dishes
 *   Light:    priority, other catalogue/research signals
 * priority and known_for/must_order are catalogue/research signals, not
 * personal ones — they stay in the "light" tier on purpose, so a VERY HIGH
 * priority place never outranks somewhere Ilija or Yarra actually rated
 * highly or said they'd go back to. really_want_to_try (Stage 6B) is a
 * genuine personal signal, weighted well above priority's max — but only
 * for a still-Want-to-try restaurant, so it never fires under "Go back
 * somewhere" (which hard-filters to Tried anyway) or for a place already
 * visited.
 */
export function scoreCandidates(eligible: EligibleRestaurant[], answers: PickAnswers): ScoredPick[] {
  const scored = eligible.map((r): ScoredPick => {
    let score = 0;
    const reasons: ReasonCode[] = [];

    // --- Strong signals ---
    if (answers.where === 'near' && r.distanceKm != null) {
      score += Math.max(0, 10 - Math.min(r.distanceKm, 10));
      if (r.distanceKm <= 3) reasons.push('nearby');
    }
    if (answers.cuisine) {
      reasons.push('exact_cuisine');
      score += 12;
    }
    if (answers.foodQuery.trim() && foodQueryMatches(r, answers.foodQuery)) {
      reasons.push('food_match');
      score += 14;
    }
    if (occasionMatches(r, answers.occasion)) {
      reasons.push('occasion_match');
      score += 10;
    }

    // --- Moderate signals (genuine personal data only) ---
    if (r.is_favourite) {
      reasons.push('favourite');
      score += 6;
    }
    const rating = parseRating(r.rating);
    if (r.status === 'Tried' && rating != null) {
      if (rating >= 6) reasons.push('highly_rated');
      score += rating * 0.8; // up to +8 at 10/10 — never dominates a strong signal
    }
    if (r.visit_again === 'yes') {
      reasons.push('would_return');
      score += 6;
    } else if (r.visit_again === 'maybe') {
      score += 2; // present but deliberately weaker than 'yes'
    }
    const knownFor = (r.dishes || []).filter((d) => d.dish_status === 'known_for' || d.must_order);
    if (knownFor.length > 0) {
      reasons.push('known_for_dish');
      score += 3;
    }
    // Stage 6B: a genuine "we really want to go here" signal — only
    // meaningful for a restaurant not yet tried (r.status === 'Want to
    // try' already excludes anything 'repeat' mode would have hard-
    // filtered to Tried-only, so this never fires there). Weighted well
    // above priority's max (2) on purpose.
    if (r.really_want_to_try && r.status === 'Want to try') {
      reasons.push('really_want_to_try');
      score += 9;
    }
    if (answers.newOrRepeat === 'new' && r.status === 'Want to try') {
      reasons.push('something_new');
    }

    // --- Light signals (research/catalogue only, never personal) ---
    score += PRIORITY_WEIGHT[r.priority || 'NORMAL'] ?? 0.6;
    if (r.priority === 'VERY HIGH' || r.priority === 'HIGH') {
      reasons.push('high_interest');
    }

    return { restaurant: r, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score || a.restaurant.id - b.restaurant.id);
  return scored;
}

/** Up to 3 known-for/must-order dishes worth showing on a result card. */
export function highlightDishes(r: RestaurantWithDishes, count = 3): string[] {
  const mustOrder = r.dishes.filter((d) => d.must_order).map((d) => d.name);
  const known = r.dishes.filter((d) => d.dish_status === 'known_for').map((d) => d.name);
  const combined = Array.from(new Set([...mustOrder, ...known]));
  return combined.slice(0, count);
}

function joinPhrases(phrases: string[]): string {
  if (phrases.length === 0) return '';
  if (phrases.length === 1) return phrases[0];
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
}

/**
 * Turns a scored candidate's reason codes into the short "Why this?" line —
 * built only from factors that actually fired for THIS candidate in THIS
 * search, never generic or invented copy. Capped at 3 phrases so it stays a
 * sentence, not a bullet list.
 */
export function explainPick(picked: ScoredPick, answers: PickAnswers): string {
  const r = picked.restaurant;
  const has = (c: ReasonCode) => picked.reasons.includes(c);
  const phrases: string[] = [];

  if (has('food_match') && answers.foodQuery.trim()) {
    phrases.push(`matches "${answers.foodQuery.trim()}"`);
  }
  if (has('nearby') && r.distanceKm != null) {
    phrases.push(`nearby (${formatDistance(r.distanceKm)})`);
  } else if (answers.where === 'near' && r.distanceKm != null) {
    phrases.push(`${formatDistance(r.distanceKm)} away`);
  }
  if (has('exact_cuisine') && answers.cuisine) {
    phrases.push(`matches ${answers.cuisine}`);
  }
  if (has('occasion_match')) {
    const label = OCCASION_OPTIONS.find((o) => o.key === answers.occasion)?.label;
    if (label) phrases.push(`good for ${label.toLowerCase()}`);
  }
  if (has('really_want_to_try')) {
    phrases.push("you've marked this as somewhere you really want to try");
  }
  if (has('would_return')) phrases.push("you said you'd go back");
  if (has('highly_rated')) {
    const rating = parseRating(r.rating);
    if (rating != null) phrases.push(`you rated it ${rating}/10`);
  }
  if (has('favourite')) phrases.push("it's one of your favourites");
  if (has('known_for_dish')) phrases.push('has dishes worth ordering on file');
  if (has('high_interest') && phrases.length < 3) {
    phrases.push('one of your higher-priority saved places');
  }

  const capped = phrases.slice(0, 3);
  if (!capped.length) return 'A saved place that fits what you asked for.';
  const sentence = joinPhrases(capped);
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

export function pickThree(scored: ScoredPick[]): ScoredPick[] {
  return scored.slice(0, 3);
}

/**
 * "Give me 3 different ones" — a genuinely different qualified shortlist
 * (excludes whatever was already shown) rather than a reshuffle of the
 * same top 3.
 */
export function pickThreeDifferent(scored: ScoredPick[], excludeIds: number[]): ScoredPick[] {
  const remaining = scored.filter((c) => !excludeIds.includes(c.restaurant.id));
  return remaining.slice(0, 3);
}

/**
 * "Pick one for us" — the core scoring above stays fully deterministic;
 * this is the one place randomness is allowed, and it's isolated here so
 * it can be tested by injecting a fixed `rng`. Draws from a small pool of
 * the strongest qualified candidates, weighted toward the stronger ones,
 * rather than always the single top score (no variety) or a flat random
 * pick among them (ignores how much better some candidates are).
 */
export function pickOneForUs(scored: ScoredPick[], rng: () => number = Math.random): ScoredPick | null {
  if (!scored.length) return null;
  const pool = scored.slice(0, Math.min(5, scored.length));
  const weights = pool.map((c) => Math.max(c.score, 0.1) ** 1.5);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export interface RelaxationOption {
  key: string;
  label: string;
  next: PickAnswers;
  resultingCount: number;
}

/**
 * One-tap relaxation offers for a fewer-than-3 result. Only ever returns
 * options that would actually help (resultingCount is computed for real,
 * not guessed) — and never applies itself. The user picks; nothing is
 * silently broadened. See Stage 6A §12.
 */
export function suggestRelaxations(
  restaurants: RestaurantWithDishes[],
  answers: PickAnswers,
  currentCount: number
): RelaxationOption[] {
  const options: RelaxationOption[] = [];

  if (answers.where === 'near' && answers.maxDistanceKm != null) {
    const bigger = DISTANCE_OPTIONS_KM.find((km) => km > answers.maxDistanceKm!);
    if (bigger) {
      const next = { ...answers, maxDistanceKm: bigger };
      const count = applyHardConstraints(restaurants, next).length;
      if (count > currentCount) {
        options.push({ key: 'expand_distance', label: `Expand to ${bigger} km`, next, resultingCount: count });
      }
    }
  }

  if (answers.where === 'near' || answers.where === 'area') {
    const next = { ...answers, where: 'anywhere' as const, coords: null, area: null };
    const count = applyHardConstraints(restaurants, next).length;
    if (count > currentCount) {
      options.push({ key: 'anywhere', label: 'Search anywhere', next, resultingCount: count });
    }
  }

  if (answers.cuisine) {
    const next = { ...answers, cuisine: null };
    const count = applyHardConstraints(restaurants, next).length;
    if (count > currentCount) {
      options.push({ key: 'any_cuisine', label: 'Any cuisine', next, resultingCount: count });
    }
  }

  if (answers.newOrRepeat === 'new') {
    const next = { ...answers, newOrRepeat: 'either' as const };
    const count = applyHardConstraints(restaurants, next).length;
    if (count > currentCount) {
      options.push({ key: 'include_tried', label: "Include places we've tried", next, resultingCount: count });
    }
  }

  if (answers.newOrRepeat === 'repeat' && !answers.includeVisitAgainNo) {
    const next = { ...answers, includeVisitAgainNo: true };
    const count = applyHardConstraints(restaurants, next).length;
    if (count > currentCount) {
      options.push({
        key: 'include_visit_again_no',
        label: "Include places you said you wouldn't go back to",
        next,
        resultingCount: count,
      });
    }
  }

  return options;
}

/** Plain-English summary of the active constraints, for the low-result
 * message ("Only 1 saved restaurant matches Japanese within 2 km."). */
export function describeAnswers(answers: PickAnswers): string {
  const parts: string[] = [];
  if (answers.cuisine) parts.push(answers.cuisine);
  if (answers.foodQuery.trim()) parts.push(`"${answers.foodQuery.trim()}"`);
  const what = parts.length ? joinPhrases(parts) : null;

  const where =
    answers.where === 'near' && answers.maxDistanceKm != null
      ? `within ${answers.maxDistanceKm} km`
      : answers.where === 'area' && answers.area
      ? `in ${answers.area}`
      : null;

  const scope =
    answers.newOrRepeat === 'new'
      ? 'from your Want to Try list'
      : answers.newOrRepeat === 'repeat'
      ? 'you’ve tried and would go back to'
      : null;

  const bits = [what, where, scope].filter(Boolean);
  return bits.length ? bits.join(' ') : 'your saved list';
}

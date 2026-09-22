/**
 * restaurants.rating is stored as numeric(3,1) on a 0–10 scale. These two
 * helpers are the single place that parses/formats it, so every surface
 * (card, detail page, editor, My Food) agrees on what "the rating" means —
 * never a 5-star reinterpretation.
 */
export function parseRating(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (value == null || value === '') return null;
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

export function formatRating(value: number): string {
  return Number.isInteger(value) ? `${value}/10` : `${value.toFixed(1)}/10`;
}

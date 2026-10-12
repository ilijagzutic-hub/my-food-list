/**
 * Today's calendar date in the USER'S timezone, as YYYY-MM-DD.
 *
 * Do not use `new Date().toISOString().slice(0, 10)` for this: that is the
 * UTC date, which in Sydney is still "yesterday" from local midnight until
 * about 10-11am — a morning visit would be saved against the previous day.
 */
export function todayLocalIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

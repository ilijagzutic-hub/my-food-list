'use client';

// The one 1-10 whole-number rating control, shared by RatingEditor
// (restaurant-level legacy rating) and LogVisitSheet (per-visit rating) —
// Stage 3 must use "the same 1–10 whole-number interaction already
// established in Stage 2.1", not a lookalike copy.
const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function RatingPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {RATING_VALUES.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          aria-label={`Rate ${n} out of 10`}
          aria-pressed={value === n}
          className={`py-2.5 rounded-lg text-[14px] font-medium tap-highlight-none border ${
            value != null && n <= value
              ? 'bg-gold-500 border-gold-500 text-forest-950'
              : 'bg-forest-900 border-cream-300/15 text-cream-100'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

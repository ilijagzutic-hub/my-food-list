'use client';

import { useState } from 'react';
import { saveRatingAndNotes } from '@/lib/actions';
import { parseRating, formatRating } from '@/lib/rating';
import type { RestaurantWithDishes, VisitAgain } from '@/lib/types';

const VISIT_AGAIN_OPTIONS: { value: VisitAgain; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

// restaurants.rating is a 0–10 scale (DB check constraint). The picker
// below writes whole numbers 1–10 directly into that column — no more
// 1–5 star taps silently becoming an n/10 score. An existing decimal
// rating (e.g. from data entered before this UI existed) is left alone
// unless the user actually taps a new value.
const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function RatingEditor({
  restaurant,
  onClose,
  onSaved,
}: {
  restaurant: RestaurantWithDishes;
  onClose: () => void;
  onSaved: (rating: number | null, notes: string, visitAgain: VisitAgain | null) => void;
}) {
  const initialRating = parseRating(restaurant.rating);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [notes, setNotes] = useState(restaurant.user_notes || '');
  const [visitAgain, setVisitAgain] = useState<VisitAgain | null>(restaurant.visit_again);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveRatingAndNotes(restaurant.id, rating, notes, visitAgain);
      onSaved(rating, notes, visitAgain);
      onClose();
    } catch (e) {
      setError(
        "Couldn't save — your Supabase table needs a write policy for this key. Ask Claude to help enable it."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-forest-800 rounded-t-2xl p-5 pb-8 safe-bottom animate-fade-slide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-cream-300/20 rounded-full mx-auto mb-4" />
        <h3 className="font-serif text-lg text-cream-50 mb-4">{restaurant.name}</h3>

        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-cream-300/60">Your rating</p>
          {rating != null && (
            <span className="text-[13px] font-medium text-gold-400">{formatRating(rating)}</span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2 mb-5">
          {RATING_VALUES.map((n) => (
            <button
              key={n}
              onClick={() => setRating(n === rating ? null : n)}
              aria-label={`Rate ${n} out of 10`}
              aria-pressed={rating === n}
              className={`py-2.5 rounded-lg text-[14px] font-medium tap-highlight-none border ${
                rating != null && n <= rating
                  ? 'bg-gold-500 border-gold-500 text-forest-950'
                  : 'bg-forest-900 border-cream-300/15 text-cream-100'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Go back again?</p>
        <div className="flex gap-2 mb-5">
          {VISIT_AGAIN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setVisitAgain(visitAgain === opt.value ? null : opt.value)}
              className={`flex-1 py-2 rounded-xl text-[13px] font-medium tap-highlight-none border ${
                visitAgain === opt.value
                  ? 'bg-gold-500 text-forest-950 border-gold-500'
                  : 'bg-forest-900 text-cream-100 border-cream-300/15'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What did you think?"
          className="w-full bg-forest-900 border border-cream-300/15 rounded-xl p-3 text-sm text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50 resize-none"
        />

        {error && <p className="text-xs text-red-300 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-cream-300/20 text-cream-100 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-gold-500 text-forest-950 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

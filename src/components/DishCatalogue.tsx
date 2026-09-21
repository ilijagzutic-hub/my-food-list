'use client';

import { useState } from 'react';
import type { Dish } from '@/lib/types';
import DishThumbs, { ThumbDownIcon, ThumbUpIcon } from './DishThumbs';
import { addTriedDish } from '@/lib/actions';

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.1 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z';

/**
 * The restaurant's dish list — must-order first, then the rest — with
 * thumbs feedback and an inline "add a dish you tried" flow. Shared between
 * RestaurantCard's expanded view and the restaurant detail page so both
 * present dishes identically instead of duplicating this logic.
 *
 * `dish_status` (known_for / want_to_try / tried) exists in the schema but
 * is null on virtually every existing dish today, so it's only shown when
 * actually set — nothing here guesses or backfills a classification.
 */
export default function DishCatalogue({
  restaurantId,
  dishes,
  onDishesChange,
}: {
  restaurantId: number;
  dishes: Dish[];
  onDishesChange: (dishes: Dish[]) => void;
}) {
  const [addingDish, setAddingDish] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [savingDish, setSavingDish] = useState(false);
  const [dishError, setDishError] = useState<string | null>(null);

  const mustOrder = dishes.filter((d) => d.must_order);
  const others = dishes.filter((d) => !d.must_order);

  function updateDishLiked(dishId: number, liked: boolean | null) {
    onDishesChange(dishes.map((d) => (d.id === dishId ? { ...d, liked } : d)));
  }

  async function handleAddDish(liked: boolean | null) {
    const name = newDishName.trim();
    if (!name) return;
    setSavingDish(true);
    setDishError(null);
    try {
      const dish = await addTriedDish(restaurantId, name, liked);
      onDishesChange([...dishes, dish]);
      setNewDishName('');
      setAddingDish(false);
    } catch {
      setDishError("Couldn't save — ask Claude to check the dish write policy.");
    } finally {
      setSavingDish(false);
    }
  }

  function row(d: Dish, emphasised: boolean) {
    return (
      <div
        key={d.id}
        className={`flex items-center justify-between gap-2 mb-1.5 ${
          emphasised ? 'text-[14px] text-cream-50' : 'text-[13.5px] text-cream-300/80'
        }`}
      >
        <span className="flex items-start gap-2">
          {emphasised && (
            <svg className="mt-0.5 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="#d4af6a">
              <path d={STAR_PATH} />
            </svg>
          )}
          <span>
            {d.name}
            {d.description && <span className="text-cream-300/60"> — {d.description}</span>}
            {d.dish_status && (
              <span className="ml-1.5 text-[11px] uppercase tracking-wide text-gold-400/70">
                {d.dish_status.replace('_', ' ')}
              </span>
            )}
          </span>
        </span>
        <DishThumbs dishId={d.id} liked={d.liked} onChange={(liked) => updateDishLiked(d.id, liked)} />
      </div>
    );
  }

  return (
    <div>
      {dishes.length === 0 && !addingDish && (
        <p className="text-[13px] text-cream-300/50 mb-2">No dishes saved for this one yet.</p>
      )}
      {mustOrder.map((d) => row(d, true))}
      {others.map((d) => row(d, false))}

      <div className="mt-2">
        {addingDish ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Dish name"
              className="flex-1 min-w-0 bg-forest-900 border border-cream-300/15 rounded-lg px-3 py-2 text-[13.5px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
            />
            <button
              disabled={savingDish || !newDishName.trim()}
              onClick={(e) => {
                e.stopPropagation();
                handleAddDish(true);
              }}
              aria-label="Add and mark liked"
              className="p-2 rounded-lg bg-forest-900/60 text-gold-400 disabled:opacity-40 tap-highlight-none"
            >
              <ThumbUpIcon filled={false} />
            </button>
            <button
              disabled={savingDish || !newDishName.trim()}
              onClick={(e) => {
                e.stopPropagation();
                handleAddDish(false);
              }}
              aria-label="Add and mark didn't like"
              className="p-2 rounded-lg bg-forest-900/60 text-red-300 disabled:opacity-40 tap-highlight-none"
            >
              <ThumbDownIcon filled={false} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAddingDish(false);
                setNewDishName('');
                setDishError(null);
              }}
              aria-label="Cancel"
              className="p-2 text-cream-300/50 tap-highlight-none text-lg leading-none"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddingDish(true);
            }}
            className="text-[13px] text-gold-400/90 tap-highlight-none"
          >
            + Add a dish you tried
          </button>
        )}
        {dishError && <p className="text-xs text-red-300 mt-2">{dishError}</p>}
      </div>
    </div>
  );
}

'use client';

import type { Dish, Person } from '@/lib/types';
import { ThumbUpIcon, ThumbDownIcon } from './DishThumbs';

export const GUEST_KEY = 'guest';

export interface DraftDish {
  dishId: number;
  name: string;
  notes: string;
  feedback: Record<string, boolean>; // key: person id as string, or GUEST_KEY
}

/**
 * "What did we eat?" — dish selection plus optional per-person 👍/👎.
 * Extracted so the fast visit flow (FastVisitSheet) and the detailed one
 * (LogVisitSheet) share exactly one implementation instead of two that can
 * drift apart. Stage 3's distinction still holds here: selecting a dish
 * only records that it was eaten; a thumb is a separate, optional opinion.
 */
export default function DishFeedbackPicker({
  catalogue,
  people,
  includesGuests,
  selectedDishes,
  onToggleDish,
  onSetFeedback,
  onSetNote,
  newDishName,
  onNewDishNameChange,
  onAddNewDish,
  addingDish,
}: {
  catalogue: Dish[];
  people: Person[];
  includesGuests: boolean;
  selectedDishes: Map<number, DraftDish>;
  onToggleDish: (dish: Dish) => void;
  onSetFeedback: (dishId: number, key: string, liked: boolean) => void;
  onSetNote: (dishId: number, note: string) => void;
  newDishName: string;
  onNewDishNameChange: (value: string) => void;
  onAddNewDish: () => void;
  addingDish: boolean;
}) {
  const feedbackPeople = [
    ...people.map((p) => ({ key: String(p.id), label: p.name })),
    ...(includesGuests ? [{ key: GUEST_KEY, label: 'Guests' }] : []),
  ];

  return (
    <div>
      {catalogue.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {catalogue.map((d) => (
            <button
              key={d.id}
              onClick={() => onToggleDish(d)}
              className={`px-3 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
                selectedDishes.has(d.id)
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-900/60 border-cream-300/15 text-cream-100'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          value={newDishName}
          onChange={(e) => onNewDishNameChange(e.target.value)}
          placeholder="+ New dish"
          className="flex-1 min-w-0 bg-forest-900 border border-cream-300/15 rounded-lg px-3 py-2 text-[13.5px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
        />
        <button
          disabled={addingDish || !newDishName.trim()}
          onClick={onAddNewDish}
          className="px-3 py-2 rounded-lg bg-forest-900/60 text-gold-400 text-[13px] disabled:opacity-40 tap-highlight-none"
        >
          Add
        </button>
      </div>

      {Array.from(selectedDishes.values()).map((d) => (
        <div key={d.dishId} className="rounded-xl bg-forest-900/50 border border-cream-300/10 p-3 mb-2.5">
          <p className="text-[14px] text-cream-50 mb-2">{d.name}</p>
          {feedbackPeople.map((person) => (
            <div key={person.key} className="flex items-center justify-between py-1">
              <span className="text-[13px] text-cream-300/70">{person.label}</span>
              <span className="inline-flex items-center gap-2.5">
                <button
                  aria-label={`${person.label} liked ${d.name}`}
                  onClick={() => onSetFeedback(d.dishId, person.key, true)}
                  className={`p-0.5 tap-highlight-none ${
                    d.feedback[person.key] === true ? 'text-gold-400' : 'text-cream-300/30'
                  }`}
                >
                  <ThumbUpIcon filled={d.feedback[person.key] === true} />
                </button>
                <button
                  aria-label={`${person.label} disliked ${d.name}`}
                  onClick={() => onSetFeedback(d.dishId, person.key, false)}
                  className={`p-0.5 tap-highlight-none ${
                    d.feedback[person.key] === false ? 'text-red-300' : 'text-cream-300/30'
                  }`}
                >
                  <ThumbDownIcon filled={d.feedback[person.key] === false} />
                </button>
              </span>
            </div>
          ))}
          <input
            value={d.notes}
            onChange={(e) => onSetNote(d.dishId, e.target.value)}
            placeholder="Dish note (optional)"
            className="w-full mt-2 bg-forest-900 border border-cream-300/15 rounded-lg px-2.5 py-1.5 text-[12.5px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
          />
        </div>
      ))}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { saveVisit, addCatalogueDishForVisit } from '@/lib/visitActions';
import RatingPicker from './RatingPicker';
import { ThumbUpIcon, ThumbDownIcon } from './DishThumbs';
import type { Dish, Person, VisitAgain, VisitWithDetails, SaveVisitPayload } from '@/lib/types';

const OCCASIONS = ['Breakfast', 'Lunch', 'Dinner', 'Date night', 'Casual', 'Celebration', 'Other'];
const VISIT_AGAIN_OPTIONS: { value: VisitAgain; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];
const GUEST_KEY = 'guest';

interface DraftDish {
  dishId: number;
  name: string;
  notes: string;
  feedback: Record<string, boolean>; // key: person id as string, or GUEST_KEY
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Create or edit one visit — attendees, dishes eaten, and per-person dish
 * feedback all included. Save goes through the save_visit RPC as ONE
 * atomic write (see visitActions.saveVisit); nothing here writes to
 * restaurant_visits/visit_attendees/visit_ordered_dishes/visit_dish_feedback
 * directly.
 */
export default function LogVisitSheet({
  restaurantId,
  restaurantDishes,
  people,
  editingVisit,
  onClose,
  onSaved,
}: {
  restaurantId: number;
  restaurantDishes: Dish[];
  people: Person[];
  editingVisit?: VisitWithDetails | null;
  onClose: () => void;
  onSaved: (visitId: number) => void;
}) {
  const [visitedAt, setVisitedAt] = useState(editingVisit?.visited_at ?? todayIso());
  const [occasion, setOccasion] = useState<string | null>(editingVisit?.occasion ?? null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>(
    editingVisit?.attendeePersonIds ?? []
  );
  const [includesGuests, setIncludesGuests] = useState(editingVisit?.includes_guests ?? false);
  const [rating, setRating] = useState<number | null>(editingVisit?.overall_rating ?? null);
  const [wouldReturn, setWouldReturn] = useState<VisitAgain | null>(
    editingVisit?.would_return ?? null
  );
  const [notes, setNotes] = useState(editingVisit?.notes ?? '');

  const [catalogue, setCatalogue] = useState<Dish[]>(restaurantDishes);
  const [dishesOpen, setDishesOpen] = useState((editingVisit?.orderedDishes.length ?? 0) > 0);
  const [selectedDishes, setSelectedDishes] = useState<Map<number, DraftDish>>(() => {
    const map = new Map<number, DraftDish>();
    (editingVisit?.orderedDishes ?? []).forEach((od) => {
      const feedback: Record<string, boolean> = {};
      od.feedback.forEach((f) => {
        feedback[f.person_id == null ? GUEST_KEY : String(f.person_id)] = f.liked;
      });
      map.set(od.dish_id, { dishId: od.dish_id, name: od.dish.name, notes: od.notes || '', feedback });
    });
    return map;
  });
  const [newDishName, setNewDishName] = useState('');
  const [addingDish, setAddingDish] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = selectedPersonIds.length > 0 || includesGuests;

  function toggleAttendee(personId: number) {
    setSelectedPersonIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  }

  function toggleDish(dish: Dish) {
    setSelectedDishes((prev) => {
      const next = new Map(prev);
      if (next.has(dish.id)) {
        next.delete(dish.id);
      } else {
        next.set(dish.id, { dishId: dish.id, name: dish.name, notes: '', feedback: {} });
      }
      return next;
    });
  }

  function setDishFeedback(dishId: number, key: string, liked: boolean) {
    setSelectedDishes((prev) => {
      const next = new Map(prev);
      const draft = next.get(dishId);
      if (!draft) return prev;
      const feedback = { ...draft.feedback };
      if (feedback[key] === liked) {
        delete feedback[key]; // tapping the same verdict again clears it — back to unrated
      } else {
        feedback[key] = liked;
      }
      next.set(dishId, { ...draft, feedback });
      return next;
    });
  }

  function setDishNote(dishId: number, note: string) {
    setSelectedDishes((prev) => {
      const next = new Map(prev);
      const draft = next.get(dishId);
      if (!draft) return prev;
      next.set(dishId, { ...draft, notes: note });
      return next;
    });
  }

  async function handleAddNewDish() {
    const name = newDishName.trim();
    if (!name) return;
    setAddingDish(true);
    setError(null);
    try {
      const dish = await addCatalogueDishForVisit(restaurantId, name);
      setCatalogue((prev) => [...prev, dish]);
      setSelectedDishes((prev) => {
        const next = new Map(prev);
        next.set(dish.id, { dishId: dish.id, name: dish.name, notes: '', feedback: {} });
        return next;
      });
      setNewDishName('');
    } catch {
      setError("Couldn't add that dish — try again.");
    } finally {
      setAddingDish(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload: SaveVisitPayload = {
        visit_id: editingVisit?.id ?? null,
        restaurant_id: restaurantId,
        visited_at: visitedAt,
        occasion,
        overall_rating: rating,
        would_return: wouldReturn,
        includes_guests: includesGuests,
        notes: notes.trim() || null,
        attendee_person_ids: selectedPersonIds,
        dishes: Array.from(selectedDishes.values()).map((d) => ({
          dish_id: d.dishId,
          notes: d.notes.trim() || null,
          feedback: Object.entries(d.feedback).map(([key, liked]) => ({
            person_id: key === GUEST_KEY ? null : Number(key),
            liked,
          })),
        })),
      };
      const visitId = await saveVisit(payload);
      onSaved(visitId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this visit.");
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
        className="w-full max-w-md bg-forest-800 rounded-t-2xl p-5 pb-8 safe-bottom max-h-[88vh] overflow-y-auto animate-fade-slide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-cream-300/20 rounded-full mx-auto mb-4" />
        <h3 className="font-serif text-lg text-cream-50 mb-4">
          {editingVisit ? 'Edit visit' : 'Log a visit'}
        </h3>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Date</p>
        <input
          type="date"
          value={visitedAt}
          onChange={(e) => setVisitedAt(e.target.value)}
          className="w-full bg-forest-900 border border-cream-300/15 rounded-xl px-3 py-2.5 text-sm text-cream-50 mb-5 focus:outline-none focus:border-gold-500/50"
        />

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Who went?</p>
        <div className="flex flex-wrap gap-2 mb-1">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleAttendee(p.id)}
              aria-pressed={selectedPersonIds.includes(p.id)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
                selectedPersonIds.includes(p.id)
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-900/60 border-cream-300/15 text-cream-100'
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => setIncludesGuests((g) => !g)}
            aria-pressed={includesGuests}
            className={`px-3.5 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
              includesGuests
                ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                : 'bg-forest-900/60 border-cream-300/15 text-cream-100'
            }`}
          >
            + Guests
          </button>
        </div>
        {!canSave && (
          <p className="text-[12px] text-cream-300/50 mb-4">
            Pick at least one of Ilija, Yarra or Guests.
          </p>
        )}
        {canSave && <div className="mb-4" />}

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Occasion</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {OCCASIONS.map((o) => (
            <button
              key={o}
              onClick={() => setOccasion(occasion === o ? null : o)}
              className={`px-3 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
                occasion === o
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-900/60 border-cream-300/15 text-cream-100'
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Overall rating</p>
        <div className="mb-5">
          <RatingPicker value={rating} onChange={setRating} />
        </div>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Would you return?</p>
        <div className="flex gap-2 mb-5">
          {VISIT_AGAIN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWouldReturn(wouldReturn === opt.value ? null : opt.value)}
              className={`flex-1 py-2 rounded-xl text-[13px] font-medium tap-highlight-none border ${
                wouldReturn === opt.value
                  ? 'bg-gold-500 text-forest-950 border-gold-500'
                  : 'bg-forest-900 text-cream-100 border-cream-300/15'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setDishesOpen((o) => !o)}
          className="text-[13px] text-gold-400 tap-highlight-none mb-3"
        >
          {dishesOpen ? '▾' : '▸'} What did we eat?
          {selectedDishes.size > 0 ? ` (${selectedDishes.size})` : ''}
        </button>

        {dishesOpen && (
          <div className="mb-5">
            {catalogue.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {catalogue.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => toggleDish(d)}
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
                onChange={(e) => setNewDishName(e.target.value)}
                placeholder="+ New dish"
                className="flex-1 min-w-0 bg-forest-900 border border-cream-300/15 rounded-lg px-3 py-2 text-[13.5px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
              />
              <button
                disabled={addingDish || !newDishName.trim()}
                onClick={handleAddNewDish}
                className="px-3 py-2 rounded-lg bg-forest-900/60 text-gold-400 text-[13px] disabled:opacity-40 tap-highlight-none"
              >
                Add
              </button>
            </div>

            {Array.from(selectedDishes.values()).map((d) => (
              <div key={d.dishId} className="rounded-xl bg-forest-900/50 border border-cream-300/10 p-3 mb-2.5">
                <p className="text-[14px] text-cream-50 mb-2">{d.name}</p>
                {[...people.map((p) => ({ key: String(p.id), label: p.name })), ...(includesGuests ? [{ key: GUEST_KEY, label: 'Guests' }] : [])].map(
                  (person) => (
                    <div key={person.key} className="flex items-center justify-between py-1">
                      <span className="text-[13px] text-cream-300/70">{person.label}</span>
                      <span className="inline-flex items-center gap-2.5">
                        <button
                          aria-label={`${person.label} liked ${d.name}`}
                          onClick={() => setDishFeedback(d.dishId, person.key, true)}
                          className={`p-0.5 tap-highlight-none ${
                            d.feedback[person.key] === true ? 'text-gold-400' : 'text-cream-300/30'
                          }`}
                        >
                          <ThumbUpIcon filled={d.feedback[person.key] === true} />
                        </button>
                        <button
                          aria-label={`${person.label} disliked ${d.name}`}
                          onClick={() => setDishFeedback(d.dishId, person.key, false)}
                          className={`p-0.5 tap-highlight-none ${
                            d.feedback[person.key] === false ? 'text-red-300' : 'text-cream-300/30'
                          }`}
                        >
                          <ThumbDownIcon filled={d.feedback[person.key] === false} />
                        </button>
                      </span>
                    </div>
                  )
                )}
                <input
                  value={d.notes}
                  onChange={(e) => setDishNote(d.dishId, e.target.value)}
                  placeholder="Dish note (optional)"
                  className="w-full mt-2 bg-forest-900 border border-cream-300/15 rounded-lg px-2.5 py-1.5 text-[12.5px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
                />
              </div>
            ))}
          </div>
        )}

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Visit notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional"
          className="w-full bg-forest-900 border border-cream-300/15 rounded-xl p-3 text-sm text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50 resize-none"
        />

        {error && <p className="text-xs text-red-300 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-cream-300/20 text-cream-100 text-sm font-medium tap-highlight-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex-1 py-3 rounded-xl bg-gold-500 text-forest-950 text-sm font-semibold disabled:opacity-50 tap-highlight-none"
          >
            {saving ? 'Saving…' : 'Save visit'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { saveVisit, addCatalogueDishForVisit } from '@/lib/visitActions';
import RatingPicker from './RatingPicker';
import DishFeedbackPicker, { GUEST_KEY, type DraftDish } from './DishFeedbackPicker';
import type { Dish, Person, VisitAgain, SaveVisitPayload } from '@/lib/types';

const VISIT_AGAIN_OPTIONS: { value: VisitAgain; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Stage 6B's fast path: Who went? → Rate it → Go back? → Save, in ~10
 * seconds — everything else (dishes, per-dish feedback, a note) stays
 * optional and collapsed. Saves through the exact same save_visit RPC as
 * the detailed editor (see visitActions.saveVisit) with today's date, no
 * occasion, no guests — this is deliberately one reusable component (not a
 * second parallel implementation) used from restaurant detail,
 * RestaurantCard and Pick result cards alike.
 *
 * "More details" hands off to the full LogVisitSheet for date/occasion/
 * guests/editing — it opens fresh rather than carrying over partial
 * answers from here, a deliberate v1 simplification.
 */
export default function FastVisitSheet({
  restaurantId,
  restaurantDishes,
  people,
  onClose,
  onSaved,
  onMoreDetails,
}: {
  restaurantId: number;
  restaurantDishes: Dish[];
  people: Person[];
  onClose: () => void;
  onSaved: (visitId: number) => void;
  onMoreDetails: () => void;
}) {
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [wouldReturn, setWouldReturn] = useState<VisitAgain | null>(null);

  const [dishesOpen, setDishesOpen] = useState(false);
  const [selectedDishes, setSelectedDishes] = useState<Map<number, DraftDish>>(new Map());
  const [catalogue, setCatalogue] = useState<Dish[]>(restaurantDishes);
  const [newDishName, setNewDishName] = useState('');
  const [addingDish, setAddingDish] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allIds = people.map((p) => p.id);
  const canSave = selectedPersonIds.length > 0;

  function toggleDish(dish: Dish) {
    setSelectedDishes((prev) => {
      const next = new Map(prev);
      if (next.has(dish.id)) next.delete(dish.id);
      else next.set(dish.id, { dishId: dish.id, name: dish.name, notes: '', feedback: {} });
      return next;
    });
  }

  function setDishFeedback(dishId: number, key: string, liked: boolean) {
    setSelectedDishes((prev) => {
      const next = new Map(prev);
      const draft = next.get(dishId);
      if (!draft) return prev;
      const feedback = { ...draft.feedback };
      if (feedback[key] === liked) delete feedback[key];
      else feedback[key] = liked;
      next.set(dishId, { ...draft, feedback });
      return next;
    });
  }

  function setDishNote(dishId: number, value: string) {
    setSelectedDishes((prev) => {
      const next = new Map(prev);
      const draft = next.get(dishId);
      if (!draft) return prev;
      next.set(dishId, { ...draft, notes: value });
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
        restaurant_id: restaurantId,
        visited_at: todayIso(),
        occasion: null,
        overall_rating: rating,
        would_return: wouldReturn,
        includes_guests: false,
        notes: note.trim() || null,
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
        <h3 className="font-serif text-lg text-cream-50 mb-4">Been here?</h3>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Who went?</p>
        <div className="flex gap-2 mb-5">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPersonIds([p.id])}
              aria-pressed={selectedPersonIds.length === 1 && selectedPersonIds[0] === p.id}
              className={`flex-1 py-2.5 rounded-xl text-[14px] font-medium tap-highlight-none border ${
                selectedPersonIds.length === 1 && selectedPersonIds[0] === p.id
                  ? 'bg-gold-500 text-forest-950 border-gold-500'
                  : 'bg-forest-900 text-cream-100 border-cream-300/15'
              }`}
            >
              {p.name}
            </button>
          ))}
          {people.length > 1 && (
            <button
              onClick={() => setSelectedPersonIds(allIds)}
              aria-pressed={selectedPersonIds.length === allIds.length && allIds.every((id) => selectedPersonIds.includes(id))}
              className={`flex-1 py-2.5 rounded-xl text-[14px] font-medium tap-highlight-none border ${
                selectedPersonIds.length === allIds.length && allIds.every((id) => selectedPersonIds.includes(id))
                  ? 'bg-gold-500 text-forest-950 border-gold-500'
                  : 'bg-forest-900 text-cream-100 border-cream-300/15'
              }`}
            >
              Both
            </button>
          )}
        </div>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">How was it?</p>
        <div className="mb-5">
          <RatingPicker value={rating} onChange={setRating} />
        </div>

        <p className="text-xs uppercase tracking-wide text-cream-300/60 mb-2">Would you go back?</p>
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
          {dishesOpen ? '▾' : '▸'} + Add what we ate
          {selectedDishes.size > 0 ? ` (${selectedDishes.size})` : ''}
        </button>
        {dishesOpen && (
          <div className="mb-4">
            <DishFeedbackPicker
              catalogue={catalogue}
              people={people}
              includesGuests={false}
              selectedDishes={selectedDishes}
              onToggleDish={toggleDish}
              onSetFeedback={setDishFeedback}
              onSetNote={setDishNote}
              newDishName={newDishName}
              onNewDishNameChange={setNewDishName}
              onAddNewDish={handleAddNewDish}
              addingDish={addingDish}
            />
          </div>
        )}

        <button
          onClick={() => setNoteOpen((o) => !o)}
          className="text-[13px] text-gold-400 tap-highlight-none mb-3"
        >
          {noteOpen ? '▾' : '▸'} + Add a note
        </button>
        {noteOpen && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="w-full mb-4 bg-forest-900 border border-cream-300/15 rounded-xl px-3 py-2.5 text-[13.5px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
          />
        )}

        {!canSave && (
          <p className="text-[12px] text-cream-300/50 mb-2">Pick who went to save.</p>
        )}
        {error && <p className="text-xs text-red-300 mb-2">{error}</p>}

        <div className="flex gap-3 mt-3">
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

        <button
          onClick={onMoreDetails}
          className="w-full mt-3 py-2 text-[12.5px] text-cream-300/50 tap-highlight-none"
        >
          More details (date, occasion, guests…)
        </button>
      </div>
    </div>
  );
}

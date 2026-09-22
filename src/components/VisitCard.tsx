'use client';

import { useState } from 'react';
import { deleteVisit } from '@/lib/visitActions';
import type { Person, VisitAgain, VisitWithDetails } from '@/lib/types';

const VISIT_AGAIN_LABEL: Record<VisitAgain, string> = {
  yes: 'Would return: Yes',
  maybe: 'Would return: Maybe',
  no: 'Would return: No',
};

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function attendeeLabel(visit: VisitWithDetails, people: Person[]): string {
  const names = visit.attendeePersonIds
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];
  if (visit.includes_guests) names.push('Guests');
  return names.join(' + ') || '—';
}

export default function VisitCard({
  visit,
  people,
  expanded,
  onToggle,
  onEdit,
  onDeleted,
}: {
  visit: VisitWithDetails;
  people: Person[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteVisit(visit.id);
      onDeleted();
    } catch {
      setError("Couldn't delete this visit — try again.");
      setDeleting(false);
    }
  }

  function personLabel(key: string): string {
    if (key === 'guest') return 'Guests';
    const p = people.find((x) => x.id === Number(key));
    return p?.name || 'Someone';
  }

  return (
    <div className="rounded-xl2 bg-forest-800/60 border border-cream-300/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 tap-highlight-none"
      >
        <div className="min-w-0">
          <p className="text-[14px] text-cream-50">{formatDate(visit.visited_at)}</p>
          <p className="text-[12.5px] text-cream-300/60 truncate">
            {attendeeLabel(visit, people)}
            {visit.occasion ? ` · ${visit.occasion}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {visit.overall_rating != null && (
            <p className="text-[13px] font-medium text-gold-400">{visit.overall_rating}/10</p>
          )}
          {visit.would_return && (
            <p className="text-[11px] text-cream-300/50">{VISIT_AGAIN_LABEL[visit.would_return]}</p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-cream-300/10 animate-fade-slide">
          {visit.orderedDishes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-2">What we ordered</p>
              {visit.orderedDishes.map((od) => (
                <div key={od.id} className="mb-2.5">
                  <p className="text-[13.5px] text-cream-100">{od.dish.name}</p>
                  {od.feedback.length > 0 ? (
                    <p className="text-[12px] text-cream-300/60">
                      {od.feedback
                        .map((f) => `${personLabel(f.person_id == null ? 'guest' : String(f.person_id))} ${f.liked ? '👍' : '👎'}`)
                        .join(' · ')}
                    </p>
                  ) : (
                    <p className="text-[12px] text-cream-300/40">No one rated it</p>
                  )}
                  {od.notes && <p className="text-[12px] text-cream-300/60 mt-0.5">{od.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {visit.notes && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-1.5">Notes</p>
              <p className="text-[13.5px] text-cream-100/85 leading-relaxed">&quot;{visit.notes}&quot;</p>
            </div>
          )}

          {error && <p className="text-xs text-red-300 mt-3">{error}</p>}

          {confirmingDelete ? (
            <div className="flex items-center gap-2 mt-4">
              <p className="text-[13px] text-cream-100 flex-1">Delete this visit?</p>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 rounded-lg text-[12.5px] text-cream-100 border border-cream-300/20 tap-highlight-none"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-[12.5px] bg-red-500/80 text-forest-950 font-medium disabled:opacity-50 tap-highlight-none"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <button
                onClick={onEdit}
                className="py-2.5 rounded-lg bg-forest-900/60 text-[12.5px] text-cream-100 tap-highlight-none"
              >
                Edit visit
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="py-2.5 rounded-lg bg-forest-900/60 text-[12.5px] text-red-300 tap-highlight-none"
              >
                Delete visit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

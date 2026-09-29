'use client';

import { useState } from 'react';

export interface PickerOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Shared searchable bottom sheet — used for both "Choose an area" (66
 * suburbs) and cuisine's "More" search. One small reusable component
 * instead of two near-identical ones.
 */
export default function PickerSheet({
  open,
  title,
  options,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  if (!open) return null;

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-forest-800 rounded-t-2xl p-5 pb-8 safe-bottom max-h-[80vh] flex flex-col animate-fade-slide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-cream-300/20 rounded-full mx-auto mb-4 shrink-0" />
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="font-serif text-lg text-cream-50">{title}</h3>
          <button onClick={onClose} className="text-[13px] text-cream-300/60 tap-highlight-none">
            Close
          </button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full bg-forest-900/60 border border-cream-300/15 rounded-full px-4 py-2.5 text-[14px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50 shrink-0"
        />
        <div className="overflow-y-auto mt-3 -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-cream-300/50 text-sm text-center py-8">No matches.</p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                onClick={() => onSelect(o.value)}
                className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-left text-[14px] text-cream-100 tap-highlight-none active:bg-forest-900/40"
              >
                <span>{o.label}</span>
                {o.count != null && <span className="text-cream-300/40 text-[12px]">{o.count}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

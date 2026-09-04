'use client';

import { useState } from 'react';
import type { Coords } from '@/lib/types';
import { geocodePlace, getBrowserLocation } from '@/lib/geo';

export default function LocationInput({
  onLocationChange,
  locationLabel,
}: {
  onLocationChange: (coords: Coords | null, label: string) => void;
  locationLabel: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function useMyLocation() {
    setBusy(true);
    const coords = await getBrowserLocation();
    setBusy(false);
    if (coords) {
      onLocationChange(coords, 'Current location');
      setText('');
    } else {
      onLocationChange(null, '');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const coords = await geocodePlace(text.trim());
    setBusy(false);
    onLocationChange(coords, coords ? text.trim() : '');
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Suburb, city, or place…"
          className="flex-1 bg-forest-800/70 border border-cream-300/15 rounded-full px-4 py-2.5 text-[14px] text-cream-50 placeholder:text-cream-300/40 focus:outline-none focus:border-gold-500/50"
        />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-forest-800/70 border border-cream-300/15 text-cream-100 disabled:opacity-50"
          aria-label="Use current location"
          title="Use current location"
        >
          {busy ? '…' : '📍'}
        </button>
      </form>
      {locationLabel && (
        <p className="text-[12.5px] text-gold-400/90 px-1">Near {locationLabel}</p>
      )}
    </div>
  );
}

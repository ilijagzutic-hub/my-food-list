'use client';

export interface Filters {
  cuisines: string[];
  venueTypes: string[];
  occasions: string[];
  priorities: string[];
  status: 'Want to try' | 'Tried' | 'All';
  maxDistanceKm: number | null;
}

export const EMPTY_FILTERS: Filters = {
  cuisines: [],
  venueTypes: [],
  occasions: [],
  priorities: [],
  status: 'All',
  maxDistanceKm: null,
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Group({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="mb-5">
      <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              onClick={() => onToggle(o)}
              className={`px-3 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
                active
                  ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                  : 'bg-forest-900/60 border-cream-300/15 text-cream-100'
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FilterSheet({
  open,
  onClose,
  filters,
  setFilters,
  facets,
  hasLocation,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  facets: { cuisines: string[]; venueTypes: string[]; occasions: string[] };
  hasLocation: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-forest-800 rounded-t-2xl p-5 pb-8 safe-bottom max-h-[80vh] overflow-y-auto animate-fade-slide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-cream-300/20 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-cream-50">Filters</h3>
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-[13px] text-gold-400"
          >
            Reset
          </button>
        </div>

        <div className="mb-5">
          <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-2">Status</p>
          <div className="flex gap-2">
            {(['All', 'Want to try', 'Tried'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilters({ ...filters, status: s })}
                className={`px-3 py-1.5 rounded-full text-[13px] border tap-highlight-none ${
                  filters.status === s
                    ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                    : 'bg-forest-900/60 border-cream-300/15 text-cream-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <Group
          title="Priority"
          options={['VERY HIGH', 'HIGH', 'NORMAL', 'LOW']}
          selected={filters.priorities}
          onToggle={(v) => setFilters({ ...filters, priorities: toggle(filters.priorities, v) })}
        />

        <Group
          title="Cuisine"
          options={facets.cuisines}
          selected={filters.cuisines}
          onToggle={(v) => setFilters({ ...filters, cuisines: toggle(filters.cuisines, v) })}
        />

        <Group
          title="Occasion"
          options={facets.occasions}
          selected={filters.occasions}
          onToggle={(v) => setFilters({ ...filters, occasions: toggle(filters.occasions, v) })}
        />

        <Group
          title="Venue type"
          options={facets.venueTypes}
          selected={filters.venueTypes}
          onToggle={(v) => setFilters({ ...filters, venueTypes: toggle(filters.venueTypes, v) })}
        />

        {hasLocation && (
          <div className="mb-2">
            <p className="text-xs uppercase tracking-wide text-cream-300/50 mb-2">
              Distance{filters.maxDistanceKm ? ` — within ${filters.maxDistanceKm} km` : ''}
            </p>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={filters.maxDistanceKm ?? 50}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  maxDistanceKm:
                    Number(e.target.value) >= 50 ? null : Number(e.target.value),
                })
              }
              className="w-full accent-gold-500"
            />
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-gold-500 text-forest-950 text-sm font-semibold"
        >
          Show results
        </button>
      </div>
    </div>
  );
}

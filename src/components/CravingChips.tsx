'use client';

const CHIPS = [
  'Ramen',
  'Spicy',
  'Seafood',
  'Casual lunch',
  'Date night',
  'Thai',
  'Bakery',
  'Burgers',
  'Group dinner',
];

export default function CravingChips({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
      {CHIPS.map((c) => {
        const isActive = active.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            onClick={() => onSelect(isActive ? '' : c)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] border tap-highlight-none transition-colors ${
              isActive
                ? 'bg-gold-500 border-gold-500 text-forest-950 font-medium'
                : 'bg-forest-800/60 border-cream-300/15 text-cream-100'
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

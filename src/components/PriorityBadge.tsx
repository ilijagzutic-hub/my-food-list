import type { Priority } from '@/lib/types';

// Text-only badge — the gold star icon is reserved for Favourite, so
// priority is never shown as a star (it used to share the same icon as
// FavouriteToggle, which is what made the two concepts read as one thing).
const CONFIG: Record<string, { label: string; className: string }> = {
  'VERY HIGH': {
    label: 'Very High',
    className: 'bg-gold-500/15 text-gold-400 border-gold-500/30',
  },
  HIGH: { label: 'High', className: 'bg-cream-300/10 text-cream-100 border-cream-300/20' },
  NORMAL: { label: 'Normal', className: 'text-cream-300/60 border-cream-300/15' },
  LOW: { label: 'Low', className: 'text-cream-300/40 border-cream-300/10' },
};

export default function PriorityBadge({ priority }: { priority: Priority | null }) {
  const cfg = CONFIG[priority || 'NORMAL'] || CONFIG.NORMAL;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium uppercase tracking-wide ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

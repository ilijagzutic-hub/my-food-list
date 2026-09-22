import { parseRating, formatRating } from '@/lib/rating';

/**
 * Plain "x/10" rating display. Stage 2 used a 5-star visual here, which
 * silently made the gold star mean two different things (rating vs.
 * favourite). The star is now reserved for Favourite everywhere — this
 * component is deliberately star-free.
 */
export default function Rating({
  value,
  label,
  size = 'sm',
}: {
  value: number | string | null;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const n = parseRating(value);
  if (n == null) return null;
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-[11px] uppercase tracking-wide text-cream-300/50">{label}</span>
      )}
      <span
        className={`font-medium text-gold-400 ${size === 'md' ? 'text-[15px]' : 'text-[13px]'}`}
      >
        {formatRating(n)}
      </span>
    </div>
  );
}

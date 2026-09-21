import { useId } from 'react';

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.1 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z';

/**
 * Restaurants.rating is stored on a 0–10 scale (see DB check constraint).
 * This renders it as a 5-star visual (value / 2) alongside the raw number,
 * so the display stays elegant without silently reinterpreting the stored
 * meaning as a 5-point scale.
 */
export default function RatingStars({
  value,
  size = 14,
}: {
  value: number | null;
  size?: number;
}) {
  const uid = useId();
  if (value == null) return null;
  const outOfFive = Math.max(0, Math.min(5, value / 2));

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const fill = Math.max(0, Math.min(1, outOfFive - (n - 1)));
          return (
            <svg key={n} width={size} height={size} viewBox="0 0 24 24">
              <defs>
                <linearGradient id={`star-fill-${uid}-${n}`}>
                  <stop offset={`${fill * 100}%`} stopColor="#d4af6a" />
                  <stop offset={`${fill * 100}%`} stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d={STAR_PATH}
                fill={`url(#star-fill-${uid}-${n})`}
                stroke="#d4af6a"
                strokeOpacity={0.5}
                strokeWidth="1.4"
              />
            </svg>
          );
        })}
      </div>
      <span className="text-[12px] text-cream-300/60">{value.toFixed(1)}/10</span>
    </div>
  );
}

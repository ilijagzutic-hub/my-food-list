// The designed "no photo yet" state for a restaurant. Pure CSS + inline SVG — zero network requests,
// no layout shift, and it is also the base layer underneath every real photo (so a slow or failed image
// simply leaves this showing).
//
// Variation is deterministic: the PALETTE comes from the primary cuisine (all ramen places share a
// family, which also reads as a quiet grouping cue), and the plate-ring MOTIF position comes from the
// name, so neighbouring cards never look identical. Colours stay inside the app's forest / gold / cream
// language — it should read as an intentional tile, not an error state.

const PALETTES = [
  { from: '#1f4a2f', to: '#0f2418', accent: '#d4af6a' }, // forest + gold
  { from: '#265434', to: '#102a1b', accent: '#f2e8d0' }, // forest + cream
  { from: '#1a3a2e', to: '#0a1a12', accent: '#c19a4b' }, // deep pine + antique gold
  { from: '#2f4a2c', to: '#14261a', accent: '#d9a066' }, // moss + clay
  { from: '#1d4343', to: '#0c2121', accent: '#a9cfc0' }, // spruce + sage
  { from: '#3b3d22', to: '#1b1c0f', accent: '#d4af6a' }, // olive + gold
  { from: '#2c4a38', to: '#0f2418', accent: '#e8d9b5' }, // fern + parchment
  { from: '#3a2f24', to: '#1a130d', accent: '#c19a4b' }, // espresso + gold
];

/** FNV-1a — tiny, stable string hash (same input => same placeholder on every device). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function initialOf(name: string): string {
  const ch = Array.from(name).find((c) => /[A-Za-z0-9]/.test(c)) || name.trim().charAt(0) || '·';
  return ch.toUpperCase();
}

export default function ImagePlaceholder({
  name,
  cuisine,
  compact = false,
}: {
  name: string;
  cuisine?: string | null;
  /** Small tiles (thumbnails) show just the initial; banners also show the cuisine. */
  compact?: boolean;
}) {
  const palette = PALETTES[hash((cuisine || name).toLowerCase()) % PALETTES.length];
  const seed = hash(name.toLowerCase());
  const pick = (shift: number, mod: number) => (seed >>> shift) % mod;

  const glowX = 15 + pick(0, 70);
  const glowY = 10 + pick(5, 45);
  const cx = 28 + pick(10, 44);
  const cy = 36 + pick(15, 30);
  const r = 13 + pick(20, 9);
  const dotX = 8 + pick(24, 84);
  const dotY = 8 + pick(27, 20);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 select-none"
      style={{
        background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${palette.accent}33 0%, transparent 58%), linear-gradient(145deg, ${palette.from}, ${palette.to})`,
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke={palette.accent}
      >
        {/* "plate" rings */}
        <circle cx={cx} cy={cy} r={r} strokeOpacity="0.2" strokeWidth="0.9" />
        <circle cx={cx} cy={cy} r={r * 1.55} strokeOpacity="0.12" strokeWidth="0.7" />
        <circle cx={cx} cy={cy} r={r * 2.25} strokeOpacity="0.07" strokeWidth="0.6" />
        <circle cx={dotX} cy={dotY} r="1.6" fill={palette.accent} fillOpacity="0.28" stroke="none" />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center font-serif"
        style={{ color: palette.accent }}
      >
        <span className={compact ? 'text-[22px] leading-none' : 'text-5xl leading-none'} style={{ opacity: 0.62 }}>
          {initialOf(name)}
        </span>
        {!compact && cuisine && (
          <span className="mt-2 text-[10.5px] uppercase tracking-[0.22em] font-sans" style={{ opacity: 0.55 }}>
            {cuisine}
          </span>
        )}
      </div>
    </div>
  );
}

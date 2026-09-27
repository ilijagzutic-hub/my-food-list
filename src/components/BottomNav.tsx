'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Stage 5B: Map added now that Stage 5A has verified address-level
// coordinates for the restaurants that support it. The flex-1 layout below
// divides evenly across however many tabs exist, no other changes needed.
const TABS = [
  { href: '/', label: 'Home', icon: '🍽️' },
  { href: '/explore/', label: 'Explore', icon: '🧭' },
  { href: '/map/', label: 'Map', icon: '🗺️' },
  { href: '/my-food/', label: 'My Food', icon: '📒' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-forest-950/95 backdrop-blur border-t border-cream-300/10 safe-bottom">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] tap-highlight-none ${
                active ? 'text-gold-400' : 'text-cream-300/50'
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RestaurantDetail from '@/components/RestaurantDetail';
import BottomNav from '@/components/BottomNav';

/**
 * Fallback shell for a restaurant added via the ChatGPT/Supabase intake
 * workflow (Stage 4C) since the last deploy — output:'export' only
 * pre-builds a static file per id that existed at build time
 * (restaurant/[id]/page.tsx's generateStaticParams), so a brand-new id has
 * no file of its own yet and would otherwise 404.
 *
 * Lives at /restaurant/fallback/ rather than /restaurant/_shell/ — Next's
 * App Router treats an underscore-prefixed folder as private and excludes
 * it from routing entirely, so no page would have been built there at all.
 *
 * vercel.json rewrites any unmatched /restaurant/<id>/ request here while
 * leaving the visible URL untouched, so the id is still readable from
 * window.location. RestaurantDetail already fetches everything from
 * Supabase client-side regardless of which static shell served it, so this
 * renders identically to a "real" pre-built page once the id is parsed —
 * the only difference is which file Vercel happened to serve.
 */
export default function RestaurantFallbackShell() {
  const [id, setId] = useState<number | 'invalid' | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/\/restaurant\/(\d+)\/?$/);
    setId(match ? Number(match[1]) : 'invalid');
  }, []);

  if (id === null) return null;

  if (id === 'invalid') {
    return (
      <main className="max-w-md md:max-w-2xl lg:max-w-3xl mx-auto min-h-screen pb-24 px-4">
        <Link href="/explore/" className="text-[13px] text-cream-300/60 tap-highlight-none">
          ← Explore
        </Link>
        <p className="text-cream-300/60 text-sm py-16 text-center">Couldn&apos;t find that restaurant.</p>
        <BottomNav />
      </main>
    );
  }

  return <RestaurantDetail id={id} />;
}

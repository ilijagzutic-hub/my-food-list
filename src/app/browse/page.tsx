'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Browse was renamed to Explore in V2. This compatibility route keeps any
// old bookmark or PWA shortcut working by forwarding straight to the new
// page (query string preserved, e.g. deep links some earlier version used).
export default function BrowseRedirect() {
  const router = useRouter();

  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(`/explore/${search}`);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <p className="text-cream-300/60 text-sm">Taking you to Explore…</p>
    </main>
  );
}

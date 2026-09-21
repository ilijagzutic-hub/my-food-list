// Server component (no 'use client'): this is where generateStaticParams
// must live under `output: 'export'`, so Next knows every /restaurant/<id>/
// path to pre-render at build time. The actual page content is a client
// component that fetches live data on mount — nothing about a restaurant is
// baked into this static shell, so the detail page is always as fresh as
// Home/Explore. See the V2 feasibility report (Section 8) for the one
// accepted trade-off: a restaurant added after the last deploy has no
// static path until the next one.
import { supabase } from '@/lib/supabase';
import RestaurantDetail from '@/components/RestaurantDetail';

export async function generateStaticParams() {
  const { data, error } = await supabase.from('restaurants').select('id');
  if (error || !data) return [];
  return (data as { id: number }[]).map((r) => ({ id: String(r.id) }));
}

export default function RestaurantDetailPage({ params }: { params: { id: string } }) {
  return <RestaurantDetail id={Number(params.id)} />;
}

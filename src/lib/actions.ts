'use client';

import { supabase } from './supabase';

/**
 * Writes back to Supabase (mark tried, rating, notes). These require an
 * UPDATE row-level-security policy on `restaurants` that permits the
 * publishable/anon key to write — by default Supabase only allows what RLS
 * grants, so until that policy exists these calls will fail with a
 * permission error, which the UI surfaces rather than pretending to succeed.
 */
export async function markTried(id: number) {
  const { error } = await supabase
    .from('restaurants')
    .update({ status: 'Tried', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function markWantToTry(id: number) {
  const { error } = await supabase
    .from('restaurants')
    .update({ status: 'Want to try', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function saveRatingAndNotes(id: number, rating: number | null, notes: string) {
  const { error } = await supabase
    .from('restaurants')
    .update({
      rating,
      user_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

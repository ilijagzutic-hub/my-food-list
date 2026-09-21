'use client';

import { supabase } from './supabase';
import type { Dish, VisitAgain } from './types';

/**
 * Writes back to Supabase (mark tried, rating, notes). These require an
 * UPDATE row-level-security policy on `restaurants` that permits the
 * publishable/anon key to write — by default Supabase only allows what RLS
 * grants, so until that policy exists these calls will fail with a
 * permission error, which the UI surfaces rather than pretending to succeed.
 */
export async function markTried(id: number) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('restaurants')
    .update({ status: 'Tried', updated_at: now, last_visited_at: now })
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

/** Star rating, free-text notes, and "would I go back?" are all saved together. */
export async function saveRatingAndNotes(
  id: number,
  rating: number | null,
  notes: string,
  visitAgain: VisitAgain | null
) {
  const { error } = await supabase
    .from('restaurants')
    .update({
      rating,
      user_notes: notes || null,
      visit_again: visitAgain,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/** Thumbs up / down on an existing dish (from the original list or one you added). */
export async function setDishLiked(dishId: number, liked: boolean | null) {
  const { error } = await supabase.from('dishes').update({ liked }).eq('id', dishId);
  if (error) throw error;
}

/** Favourite is a separate, personal "saved favourite" signal — distinct from Priority. */
export async function setFavourite(id: number, isFavourite: boolean) {
  const { error } = await supabase
    .from('restaurants')
    .update({ is_favourite: isFavourite, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Add a dish you tried that wasn't already on the list, with an immediate verdict. */
export async function addTriedDish(
  restaurantId: number,
  name: string,
  liked: boolean | null
): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .insert({ restaurant_id: restaurantId, name, liked })
    .select()
    .single();
  if (error) throw error;
  return data as Dish;
}

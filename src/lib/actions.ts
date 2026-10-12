'use client';

import { supabase } from './supabase';
import type { Dish } from './types';

/**
 * Direct browser writes to Supabase. Since Stage 7A.5 these are limited to
 * the explicit personal flags (favourite, Really Want to Try) and dish
 * thumbs / added dishes. A restaurant's status, rating, visit_again and
 * last_visited_at are NOT written from the browser at all: they are derived
 * from visit history by the `save_visit` / `delete_visit` functions and the
 * restaurant_visits trigger (see visitActions.ts). `updated_at` is set by
 * the restaurants_updated_at trigger, so callers never send it.
 */

/** Thumbs up / down on an existing dish (from the original list or one you added). */
export async function setDishLiked(dishId: number, liked: boolean | null) {
  const { error } = await supabase.from('dishes').update({ liked }).eq('id', dishId);
  if (error) throw error;
}

/** Favourite is a separate, personal "saved favourite" signal — distinct from Priority. */
export async function setFavourite(id: number, isFavourite: boolean) {
  const { error } = await supabase
    .from('restaurants')
    .update({ is_favourite: isFavourite })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Stage 6B: "somewhere we particularly want to go" — a personal intent
 * signal, distinct from both Favourite (a place already liked) and
 * `priority` (catalogue/research-derived, never touched by this call).
 */
export async function setReallyWantToTry(id: number, value: boolean) {
  const { error } = await supabase
    .from('restaurants')
    .update({ really_want_to_try: value })
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

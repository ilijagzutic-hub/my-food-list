'use client';

import { supabase } from './supabase';
import type { Dish, SaveVisitPayload } from './types';

/**
 * Create or update a visit (attendees, ordered dishes, and per-person dish
 * feedback all included in `payload`) as ONE atomic operation via the
 * `save_visit` Postgres function — never as a chain of separate browser
 * writes that could partially succeed. Pass `visit_id` in the payload to
 * edit an existing visit; omit/null it to create a new one. Returns the
 * visit's id.
 */
export async function saveVisit(payload: SaveVisitPayload): Promise<number> {
  const { data, error } = await supabase.rpc('save_visit', { payload });
  if (error) throw error;
  return data as number;
}

/**
 * Delete a visit. This is a single SQL DELETE — FK cascades remove its
 * attendees and ordered dishes (which cascades their feedback), and the
 * restaurant_visits trigger recomputes the restaurant's snapshot fields,
 * all within that one statement. No RPC needed.
 */
export async function deleteVisit(visitId: number): Promise<void> {
  const { error } = await supabase.from('restaurant_visits').delete().eq('id', visitId);
  if (error) throw error;
}

/**
 * Add a dish to the catalogue from inside Log Visit. Unlike the existing
 * `addTriedDish` (DishCatalogue's "+ Add a dish you tried"), this sets no
 * `liked` value — catalogue-level liked stays a separate, untouched
 * legacy concept; the visit's opinion lives in visit_dish_feedback.
 */
export async function addCatalogueDishForVisit(restaurantId: number, name: string): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .insert({ restaurant_id: restaurantId, name })
    .select()
    .single();
  if (error) throw error;
  return data as Dish;
}

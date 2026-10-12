import { supabase } from './supabase';
import type { ImageVariant, RestaurantImageSet, RestaurantImageVariant } from './types';

/** Public Supabase Storage bucket holding the pre-resized restaurant images (Stage 7B.1). */
export const RESTAURANT_IMAGE_BUCKET = 'restaurant-images';

/**
 * The ONE place a stored path becomes a URL. The database stores bucket-relative paths only
 * (e.g. "restaurants/42/ab12cd34ef56ab78-hero.webp"), so nothing is hotlinked and a domain change
 * never leaves dead links behind. Components must not build Storage URLs themselves.
 */
export function restaurantImageUrl(storagePath: string): string {
  return supabase.storage.from(RESTAURANT_IMAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Columns fetched for primary images — explicit, so a future column never bloats the payload. */
export const RESTAURANT_IMAGE_COLUMNS =
  'restaurant_id,variant,storage_path,width,height,dominant_color,source_kind,credit,source_url,license_note';

interface RestaurantImageRow extends RestaurantImageVariant {
  restaurant_id: number;
  variant: ImageVariant;
}

/** Folds the flat primary-image rows (≤ 2 per restaurant) into restaurant_id → { thumb, hero }. */
export function groupPrimaryImages(rows: RestaurantImageRow[] | null | undefined): Map<number, RestaurantImageSet> {
  const byRestaurant = new Map<number, RestaurantImageSet>();
  (rows || []).forEach(({ restaurant_id, variant, ...rest }) => {
    if (variant !== 'thumb' && variant !== 'hero') return;
    const set = byRestaurant.get(restaurant_id) || {};
    set[variant] = rest;
    byRestaurant.set(restaurant_id, set);
  });
  return byRestaurant;
}

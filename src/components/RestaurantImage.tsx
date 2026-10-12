'use client';

import { useEffect, useRef, useState } from 'react';
import type { ImageVariant, RestaurantImageSet, RestaurantImageVariant, RestaurantWithDishes } from '@/lib/types';
import { restaurantImageUrl } from '@/lib/images';
import ImagePlaceholder from './ImagePlaceholder';

/**
 * The one restaurant-image component (Stage 7B.1).
 *
 * - Always renders a FIXED-SIZE box (pass an `aspect-*` class, or explicit w/h classes), so nothing shifts
 *   when an image arrives.
 * - The designed placeholder is the base layer. A real image fades in over it once it has loaded; if it is
 *   missing, still loading, fails, or Storage is paused/unavailable, the placeholder simply stays.
 * - `thumb` and `hero` are different stored files. A card asks for `thumb`, so it can never pull the
 *   full-size file; if the requested variant doesn't exist the placeholder is used rather than the other
 *   variant.
 * - Images are `loading="lazy"` unless `eager` (use for the first thing on a screen).
 */
export default function RestaurantImage({
  restaurant,
  variant,
  aspect = '',
  className = '',
  alt = '',
  eager = false,
  compact = false,
}: {
  restaurant: Pick<RestaurantWithDishes, 'name' | 'cuisine'> & { images?: RestaurantImageSet };
  variant: ImageVariant;
  /** Tailwind aspect-ratio class, e.g. "aspect-video". Leave empty when the box gets explicit w/h classes. */
  aspect?: string;
  className?: string;
  /** Empty = decorative (the name is already printed next to it). Pass the name for stand-alone images. */
  alt?: string;
  eager?: boolean;
  /** Small tile: placeholder shows only the initial. */
  compact?: boolean;
}) {
  const image = restaurant.images?.[variant];
  return (
    <div className={`relative overflow-hidden bg-forest-800 ${aspect} ${className}`}>
      <ImagePlaceholder name={restaurant.name} cuisine={restaurant.cuisine?.[0]} compact={compact} />
      {image && <ImageLayer key={image.storage_path} image={image} alt={alt} eager={eager} />}
    </div>
  );
}

// Keyed by storage path in the parent, so replacing a restaurant's image resets load/fail state.
function ImageLayer({ image, alt, eager }: { image: RestaurantImageVariant; alt: string; eager: boolean }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const ref = useRef<HTMLImageElement>(null);

  // A cached image can finish before React attaches onLoad.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete) setState(el.naturalWidth > 0 ? 'loaded' : 'failed');
  }, []);

  if (state === 'failed') return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export (images.unoptimized): a plain <img> is intended
    <img
      ref={ref}
      src={restaurantImageUrl(image.storage_path)}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setState('loaded')}
      onError={() => setState('failed')}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
        state === 'loaded' ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}

/** Small credit line for images we don't own (shown on the restaurant detail page). */
export function ImageCredit({ images }: { images?: RestaurantImageSet }) {
  const image = images?.hero || images?.thumb;
  if (!image || image.source_kind === 'own_photo') return null;
  return (
    <p className="text-[11px] leading-snug text-cream-300/50">
      Photo: {image.credit}
      {image.license_note ? ` · ${image.license_note}` : ''}
      {image.source_url && (
        <>
          {' · '}
          <a href={image.source_url} target="_blank" rel="noopener noreferrer" className="underline decoration-cream-300/30">
            source
          </a>
        </>
      )}
    </p>
  );
}

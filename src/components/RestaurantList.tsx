'use client';

import { useState } from 'react';
import type { RestaurantWithDishes } from '@/lib/types';
import RestaurantCard from './RestaurantCard';

export default function RestaurantList({
  restaurants,
  emptyMessage,
}: {
  restaurants: RestaurantWithDishes[];
  emptyMessage?: string;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (restaurants.length === 0) {
    return (
      <p className="text-cream-300/60 text-sm text-center py-10">
        {emptyMessage || 'Nothing matches yet — try a different search.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
      {restaurants.map((r) => (
        <RestaurantCard
          key={r.id}
          restaurant={r}
          expanded={expandedId === r.id}
          onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
        />
      ))}
    </div>
  );
}

'use client';

import Chip from './Chip';

/**
 * "Near me", "Very High" and "Something new" hand off to Explore/Home's own
 * existing behaviour, unchanged (see explore/page.tsx and search.ts's
 * somethingNew()). Date night/Casual/Quick bite now open Pick for Me
 * (Stage 6A) with that occasion pre-selected instead — asking "where
 * should we eat" is what those shortcuts actually mean, and Pick is built
 * for exactly that, where Explore is for open browsing.
 */
export default function QuickActions({ onSomethingNew }: { onSomethingNew: () => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
      <Chip href="/explore/?near=1">📍 Near me</Chip>
      <Chip href="/pick/?occasion=date_night">Date night</Chip>
      <Chip href="/pick/?occasion=casual">Casual</Chip>
      <Chip href="/pick/?occasion=quick_bite">Quick bite</Chip>
      <Chip href="/explore/?priority=VERY+HIGH">Very High</Chip>
      <Chip onClick={onSomethingNew}>🎲 Something new</Chip>
    </div>
  );
}

'use client';

import Chip from './Chip';

/**
 * Every quick action except "Something new" hands off to Explore with a
 * query string Explore already knows how to read (see explore/page.tsx) —
 * this keeps all the actual filtering logic in one place instead of
 * duplicating it between Home and Explore. "Something new" is different by
 * design (see search.ts's somethingNew()): it surfaces one specific
 * suggestion right here on Home rather than a filtered list.
 */
export default function QuickActions({ onSomethingNew }: { onSomethingNew: () => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
      <Chip href="/explore/?near=1">📍 Near me</Chip>
      <Chip href="/explore/?occasion=Date+night">Date night</Chip>
      <Chip href="/explore/?occasionGroup=casual">Casual</Chip>
      <Chip href="/explore/?occasion=Quick+meal">Quick bite</Chip>
      <Chip href="/explore/?priority=VERY+HIGH">Very High</Chip>
      <Chip onClick={onSomethingNew}>🎲 Something new</Chip>
    </div>
  );
}

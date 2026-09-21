import type { ReactNode } from 'react';

export default function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="font-serif text-[18px] text-cream-50">{title}</h2>
        {subtitle && <p className="text-[12.5px] text-cream-300/55 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

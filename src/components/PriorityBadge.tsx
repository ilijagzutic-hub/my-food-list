import type { Priority } from '@/lib/types';

const CONFIG: Record<string, { label: string; className: string }> = {
  'VERY HIGH': { label: 'Very High', className: 'text-gold-400' },
  HIGH: { label: 'High', className: 'text-cream-100' },
  NORMAL: { label: 'Normal', className: 'text-cream-300/70' },
  LOW: { label: 'Low', className: 'text-cream-300/50' },
};

export default function PriorityBadge({ priority }: { priority: Priority | null }) {
  const cfg = CONFIG[priority || 'NORMAL'] || CONFIG.NORMAL;
  const filled = priority === 'VERY HIGH' || priority === 'HIGH';
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] font-medium ${cfg.className}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.1 1.3-6.6-4.9-4.6 6.6-.7L12 2.5z" />
      </svg>
      {cfg.label}
    </span>
  );
}

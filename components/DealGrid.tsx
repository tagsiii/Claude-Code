import type { Deal } from '@/lib/types';
import { DealCard } from './DealCard';

export function DealGrid({ deals }: { deals: Deal[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  );
}

import type { Sector, LifecycleStage } from '../types';

export function formatSector(sector: Sector): string {
  const map: Record<Sector, string> = {
    strategic_infrastructure: 'Strategic Infra',
    digital_connectivity: 'Digital',
    energy: 'Energy',
    cybersecurity: 'Cybersecurity',
    other: 'Other',
  };
  return map[sector] ?? sector;
}

export function formatStage(stage: LifecycleStage): string {
  const map: Record<LifecycleStage, string> = {
    rumored: 'Rumored',
    exploratory_mou: 'MOU / Exploratory',
    negotiation: 'In Negotiation',
    signed: 'Signed',
    financing_secured: 'Financing Secured',
    under_construction: 'Under Construction',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return map[stage] ?? stage;
}

export function formatScore(score: number | null): string {
  if (score == null) return '—';
  return score.toFixed(1);
}

export function formatRom(
  valueUsd: number | null,
  min?: number | null,
  max?: number | null
): string {
  if (!valueUsd) return 'Size unknown';
  if (min && max) {
    return `${formatUsd(min)} – ${formatUsd(max)}`;
  }
  return `~${formatUsd(valueUsd)}`;
}

export function formatUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function scoreColorClass(score: number | null): string {
  if (score == null) return 'text-slate-500';
  if (score >= 70) return 'text-red-400';
  if (score >= 50) return 'text-orange-400';
  if (score >= 30) return 'text-yellow-400';
  return 'text-slate-400';
}

export function scoreBgClass(score: number | null): string {
  if (score == null) return 'bg-slate-800';
  if (score >= 70) return 'bg-red-950 border-red-900';
  if (score >= 50) return 'bg-orange-950 border-orange-900';
  if (score >= 30) return 'bg-yellow-950 border-yellow-900';
  return 'bg-slate-800 border-slate-700';
}

export function sectorColorClass(sector: Sector): string {
  const map: Record<Sector, string> = {
    strategic_infrastructure: 'bg-blue-950 text-blue-300 border-blue-800',
    digital_connectivity: 'bg-purple-950 text-purple-300 border-purple-800',
    energy: 'bg-orange-950 text-orange-300 border-orange-800',
    cybersecurity: 'bg-red-950 text-red-300 border-red-800',
    other: 'bg-slate-800 text-slate-300 border-slate-600',
  };
  return map[sector] ?? 'bg-slate-800 text-slate-300';
}

export function stageColorClass(stage: LifecycleStage): string {
  const map: Record<LifecycleStage, string> = {
    rumored: 'bg-slate-800 text-slate-400',
    exploratory_mou: 'bg-blue-950 text-blue-300',
    negotiation: 'bg-yellow-950 text-yellow-300',
    signed: 'bg-green-950 text-green-300',
    financing_secured: 'bg-emerald-950 text-emerald-300',
    under_construction: 'bg-orange-950 text-orange-300',
    completed: 'bg-slate-700 text-slate-300',
    cancelled: 'bg-red-950 text-red-500',
  };
  return map[stage] ?? 'bg-slate-800 text-slate-400';
}

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

// Text color for a composite/sub score (theme-aware).
export function scoreColorClass(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 70) return 'text-red-600 dark:text-red-400';
  if (score >= 50) return 'text-orange-600 dark:text-orange-400';
  if (score >= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

// Tinted pill (bg + text) for the score cell in the table.
export function scorePillClass(score: number | null): string {
  if (score == null) return 'bg-secondary text-muted-foreground';
  if (score >= 70) return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  if (score >= 50) return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300';
  if (score >= 30) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return 'bg-secondary text-muted-foreground';
}

// Solid fill for progress bars (works in both themes).
export function scoreBarClass(score: number | null): string {
  if (score == null) return 'bg-muted-foreground/40';
  if (score >= 70) return 'bg-red-500';
  if (score >= 50) return 'bg-orange-500';
  if (score >= 30) return 'bg-amber-500';
  return 'bg-muted-foreground/50';
}

// Subtle tinted background for the deal-detail header card.
export function scoreBgClass(score: number | null): string {
  if (score == null) return 'bg-card border-border';
  if (score >= 70) return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50';
  if (score >= 50) return 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/50';
  if (score >= 30) return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50';
  return 'bg-card border-border';
}

export function sectorColorClass(sector: Sector): string {
  const map: Record<Sector, string> = {
    strategic_infrastructure: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    digital_connectivity: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
    energy: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    cybersecurity: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    other: 'bg-secondary text-secondary-foreground',
  };
  return map[sector] ?? 'bg-secondary text-secondary-foreground';
}

export function stageColorClass(stage: LifecycleStage): string {
  const map: Record<LifecycleStage, string> = {
    rumored: 'bg-secondary text-muted-foreground',
    exploratory_mou: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    negotiation: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    signed: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
    financing_secured: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    under_construction: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    completed: 'bg-secondary text-secondary-foreground',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  };
  return map[stage] ?? 'bg-secondary text-muted-foreground';
}

// Confidence-tier accent for sources (T1 primary/official → T3 secondary).
export function tierColorClass(tier: number): string {
  if (tier === 1) return 'text-[hsl(var(--success))]';
  if (tier === 2) return 'text-primary';
  return 'text-muted-foreground';
}

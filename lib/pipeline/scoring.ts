import type { Deal, ScoreBreakdown, SubScore, LifecycleStage, Sector } from '../types';
import { getScoreWeights } from '../db/queries';

// State-actor priority: 1.0 = primary strategic competitor, lower = less concern
const ACTOR_WEIGHTS: Record<string, number> = {
  China: 1.0,
  'People\'s Republic of China': 1.0,
  PRC: 1.0,
  Russia: 1.0,
  'Russian Federation': 1.0,
  Iran: 0.85,
  'North Korea': 0.85,
  UAE: 0.70,
  Qatar: 0.65,
  'Saudi Arabia': 0.65,
  Turkey: 0.60,
};

// Sector priority order per spec
const SECTOR_SCORES: Record<Sector, number> = {
  strategic_infrastructure: 100,
  digital_connectivity: 85,
  energy: 75,
  cybersecurity: 90,
  other: 40,
};

// Lifecycle → likelihood score
const STAGE_LIKELIHOOD: Record<LifecycleStage, number> = {
  rumored: 20,
  exploratory_mou: 40,
  negotiation: 60,
  signed: 75,
  financing_secured: 85,
  under_construction: 92,
  completed: 100,
  cancelled: 0,
};

// Lifecycle → actionability (US still has runway)
const STAGE_ACTIONABILITY: Record<LifecycleStage, number> = {
  rumored: 95,
  exploratory_mou: 88,
  negotiation: 72,
  signed: 45,
  financing_secured: 25,
  under_construction: 10,
  completed: 2,
  cancelled: 0,
};

export async function scoreDeal(deal: Partial<Deal>): Promise<{
  composite: number;
  breakdown: ScoreBreakdown;
}> {
  const weights = await getScoreWeights();
  const w = Object.fromEntries(weights.map((wt) => [wt.name, wt.weight]));

  const likelihood = calcLikelihood(deal);
  const actionability = calcActionability(deal);
  const financing = calcFinancing(deal);
  const corroboration = calcCorroboration(deal);
  const strategicPriority = calcStrategicPriority(deal);

  const lw = w['likelihood'] ?? 0.3;
  const aw = w['actionability'] ?? 0.3;
  const fw = w['financing'] ?? 0.2;
  const cw = w['corroboration'] ?? 0.1;
  const sw = w['strategic_priority'] ?? 0.1;

  const composite =
    likelihood.score * lw +
    actionability.score * aw +
    financing.score * fw +
    corroboration.score * cw +
    strategicPriority.score * sw;

  const breakdown: ScoreBreakdown = {
    likelihood: { ...likelihood, weight: lw, contribution: likelihood.score * lw },
    actionability: { ...actionability, weight: aw, contribution: actionability.score * aw },
    financing: { ...financing, weight: fw, contribution: financing.score * fw },
    corroboration: { ...corroboration, weight: cw, contribution: corroboration.score * cw },
    strategic_priority: { ...strategicPriority, weight: sw, contribution: strategicPriority.score * sw },
  };

  return { composite: Math.round(composite * 10) / 10, breakdown };
}

function calcLikelihood(deal: Partial<Deal>): Omit<SubScore, 'weight' | 'contribution'> {
  const stage = deal.lifecycle_stage ?? 'rumored';
  const score = STAGE_LIKELIHOOD[stage as LifecycleStage] ?? 20;
  return {
    score,
    reasoning: `Stage "${stage}" → base likelihood ${score}/100`,
  };
}

function calcActionability(deal: Partial<Deal>): Omit<SubScore, 'weight' | 'contribution'> {
  const stage = deal.lifecycle_stage ?? 'rumored';
  let score = STAGE_ACTIONABILITY[stage as LifecycleStage] ?? 50;

  const actorWeight = deal.sponsoring_state
    ? (ACTOR_WEIGHTS[deal.sponsoring_state] ?? 0.5)
    : 0.5;

  // Higher concern actor → higher urgency to act
  score = Math.min(100, score * (0.6 + 0.4 * actorWeight));

  const parts: string[] = [`Stage "${stage}" → base ${STAGE_ACTIONABILITY[stage as LifecycleStage] ?? 50}`];
  if (deal.sponsoring_state) {
    parts.push(`actor concern factor ${actorWeight.toFixed(2)} for "${deal.sponsoring_state}"`);
  }

  return { score: Math.round(score), reasoning: parts.join('; ') };
}

function calcFinancing(deal: Partial<Deal>): Omit<SubScore, 'weight' | 'contribution'> {
  const sponsors = deal.financial_sponsors ?? [];
  if (sponsors.length === 0) {
    return { score: 15, reasoning: 'No financial sponsors identified' };
  }

  const topStatus = sponsors.reduce((best: string, s) => {
    const rank: Record<string, number> = { signed: 4, committed: 3, identified: 2, rumored: 1 };
    return (rank[s.commitment_status] ?? 0) > (rank[best] ?? 0) ? s.commitment_status : best;
  }, 'rumored');

  const scores: Record<string, number> = { signed: 95, committed: 80, identified: 55, rumored: 30 };
  const score = scores[topStatus] ?? 30;
  const sponsorNames = sponsors.map((s) => s.name).join(', ');

  return {
    score,
    reasoning: `${sponsors.length} sponsor(s) (${sponsorNames}) — highest commitment: "${topStatus}"`,
  };
}

function calcCorroboration(deal: Partial<Deal>): Omit<SubScore, 'weight' | 'contribution'> {
  const count = deal.source_count ?? 1;
  const tier = deal.source_confidence_tier ?? 3;

  let score = count === 1 ? 20 : count <= 3 ? 45 : count <= 5 ? 65 : 80;

  // Tier 1 (official) sources add significant weight
  if (tier === 1) score = Math.min(100, score + 20);
  else if (tier === 2) score = Math.min(100, score + 5);

  return {
    score,
    reasoning: `${count} source(s); best confidence tier: ${tier === 1 ? 'primary/official' : tier === 2 ? 'established press' : 'secondary'}`,
  };
}

function calcStrategicPriority(deal: Partial<Deal>): Omit<SubScore, 'weight' | 'contribution'> {
  const sectorScore = SECTOR_SCORES[(deal.sector as Sector) ?? 'other'] ?? 40;
  const actorWeight = deal.sponsoring_state
    ? (ACTOR_WEIGHTS[deal.sponsoring_state] ?? 0.5)
    : 0.5;
  const actorScore = Math.round(actorWeight * 100);
  const score = Math.round((sectorScore + actorScore) / 2);

  return {
    score,
    reasoning: `Sector "${deal.sector ?? 'other'}" priority ${sectorScore}/100; actor concern ${actorScore}/100`,
  };
}

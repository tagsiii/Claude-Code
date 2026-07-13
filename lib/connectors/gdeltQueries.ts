// GDELT query design.
//
// Old approach: long exact phrases ("railway investment", "port management
// contract"). Headlines rarely reuse our exact wording, so recall was poor —
// "Beijing backs $2B rail line to Nairobi" matched nothing.
//
// New approach — model the LANGUAGE of deal headlines instead of guessing
// phrasings. A deal headline almost always co-locates two short tokens:
//   SPONSOR (china / beijing / rosatom / uae …) near ASSET (rail / port / 5g …)
// while the connecting verb varies freely (backs, funds, wins, signs, builds).
// GDELT's near operator matches exactly that shape: near15:"china rail" hits
// any article where the two tokens appear within 15 words, in any phrasing.
//
// Three complementary layers, from broad to surgical:
//   1. Proximity sweep    — sponsor × asset token pairs (high recall)
//   2. Entity watchlist   — named policy banks / SOEs / sovereign funds
//                           (high precision; catches deals with no country word)
//   3. Instrument language — financing phrases that only appear in deal
//                           coverage, regardless of sponsor
// The LLM extraction stage is the precision filter, so the net errs toward
// recall; the scorer and dedup absorb the noise.

export const NEAR_DISTANCE = 15;

// Sponsor tokens, grouped so each query stays within GDELT's length limits.
export const SPONSOR_GROUPS: Record<string, string[]> = {
  china: ['china', 'chinese', 'beijing'],
  russia: ['russia', 'russian', 'moscow'],
  gulf: ['saudi', 'uae', 'emirati', 'qatar', 'qatari', 'dubai', 'abu dhabi'],
  other: ['turkey', 'turkish', 'iran', 'iranian'],
};

// Asset tokens — single words survive any headline phrasing around them.
export const ASSET_TOKENS = [
  'port', 'railway', 'rail', 'airport', 'highway', 'pipeline', 'refinery',
  'nuclear', 'hydropower', 'dam', 'grid', 'solar', 'lng',
  '5g', 'telecom', 'cable', 'satellite', 'datacenter',
  'lithium', 'cobalt', 'minerals', 'cybersecurity',
];

// Named actors whose appearance in ANY deal context is worth reading.
const ENTITY_GROUPS: Array<{ label: string; terms: string[] }> = [
  {
    label: 'china-finance',
    terms: [
      '"China Exim"', '"Export-Import Bank of China"', '"China Development Bank"',
      '"Silk Road Fund"', '"Belt and Road"', 'AIIB', 'Sinosure',
    ],
  },
  {
    label: 'china-soe',
    terms: [
      '"China Harbour"', '"China Harbor"', '"China Communications Construction"',
      'PowerChina', 'Sinohydro', '"State Grid"', '"China Merchants"', 'COSCO',
      'CNPC', 'Sinopec', 'CGN', 'CNNC', 'Huawei', 'ZTE',
    ],
  },
  {
    label: 'russia-gulf-entities',
    terms: [
      'Rosatom', 'Gazprom', 'Rosneft', '"Russian Railways"', 'Rostec',
      '"DP World"', '"AD Ports"', 'Mubadala', 'ADIA', '"Public Investment Fund"',
      '"ACWA Power"', 'Masdar', '"Qatar Investment Authority"',
    ],
  },
];

// Financing-instrument phrases: deal-speak that appears regardless of sponsor.
const INSTRUMENT_PHRASES = [
  '"concessional loan"', '"EPC contract"', '"build-operate-transfer"',
  '"engineering procurement construction"', '"government-to-government agreement"',
  '"sovereign guarantee"', '"debt-for-infrastructure"', '"port concession"',
];

const CLAUSES_PER_QUERY = 30; // keeps each query URL comfortably under limits

export interface GdeltQuery {
  label: string;
  query: string;
}

export function nearClause(sponsor: string, asset: string): string {
  return `near${NEAR_DISTANCE}:"${sponsor} ${asset}"`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function buildGdeltQueries(): GdeltQuery[] {
  const queries: GdeltQuery[] = [];

  // Layer 1: proximity sweep
  for (const [group, sponsors] of Object.entries(SPONSOR_GROUPS)) {
    const clauses = sponsors.flatMap((s) => ASSET_TOKENS.map((a) => nearClause(s, a)));
    chunk(clauses, CLAUSES_PER_QUERY).forEach((part, i) => {
      queries.push({
        label: `${group}-proximity-${i + 1}`,
        query: `(${part.join(' OR ')})`,
      });
    });
  }

  // Layer 2: entity watchlist
  for (const g of ENTITY_GROUPS) {
    queries.push({ label: g.label, query: `(${g.terms.join(' OR ')})` });
  }

  // Layer 3: instrument language
  queries.push({ label: 'instruments', query: `(${INSTRUMENT_PHRASES.join(' OR ')})` });

  return queries;
}

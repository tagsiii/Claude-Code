// GDELT query design.
//
// The language model: a deal headline almost always co-locates a SPONSOR token
// (china / beijing / rosatom / uae …) with an ASSET token (rail / port / 5g …)
// while the connecting verb varies freely (backs, funds, wins, signs, builds).
// GDELT's near operator matches that shape: near15:"china rail" hits any
// article where the tokens appear within 15 words, in any phrasing.
//
// Hard constraints learned from the live API (via npm run gdelt:check):
//   · Rate limit: ONE request per 5 seconds — keep total query count small
//   · Query length: long OR-chains get "query was too short or too long" —
//     keep every query compact (~<200 chars), like the historically-working set
// So instead of a full sponsor×asset cross-product, we ship a curated list of
// the highest-value pairs, grouped into a handful of short queries.
//
// Three complementary layers, from broad to surgical:
//   1. Proximity sweep    — curated sponsor×asset pairs (recall)
//   2. Entity watchlist   — named policy banks / SOEs / sovereign funds
//                           (precision; catches deals with no country word)
//   3. Instrument language — financing phrases that only appear in deal coverage
// The LLM extraction stage is the precision filter, so the net errs toward
// recall; the scorer and dedup absorb the noise.
//
// Tuning: add/remove pairs below, then validate with `npm run gdelt:check` —
// it fires every query at the live API and prints hit counts + sample titles.

export const NEAR_DISTANCE = 15;

// Curated sponsor × asset pairs, grouped so each query stays short.
export const PROXIMITY_GROUPS: Array<{ label: string; pairs: Array<[string, string]> }> = [
  {
    label: 'china-transport',
    pairs: [
      ['china', 'port'], ['china', 'railway'], ['china', 'rail'],
      ['beijing', 'port'], ['china', 'airport'], ['china', 'pipeline'],
    ],
  },
  {
    label: 'china-energy',
    pairs: [
      ['china', 'nuclear'], ['china', 'hydropower'], ['china', 'grid'],
      ['china', 'lng'], ['chinese', 'refinery'], ['china', 'dam'],
    ],
  },
  {
    label: 'china-digital-minerals',
    pairs: [
      ['china', '5g'], ['china', 'telecom'], ['china', 'cable'],
      ['china', 'lithium'], ['china', 'cobalt'], ['china', 'minerals'],
    ],
  },
  {
    label: 'russia',
    pairs: [
      ['russia', 'nuclear'], ['russia', 'pipeline'], ['russia', 'railway'],
      ['russian', 'grid'], ['russia', 'port'], ['russia', 'lng'],
    ],
  },
  {
    label: 'gulf',
    pairs: [
      ['uae', 'port'], ['saudi', 'port'], ['saudi', 'solar'],
      ['qatar', 'lng'], ['uae', 'datacenter'], ['saudi', '5g'],
    ],
  },
  {
    label: 'turkey-iran',
    pairs: [
      ['turkey', 'railway'], ['turkish', 'port'], ['turkey', 'airport'],
      ['iran', 'pipeline'], ['iran', 'port'], ['iranian', 'gas'],
    ],
  },
];

// Named actors whose appearance in ANY deal context is worth reading.
// Split into short queries to respect the length limit.
const ENTITY_GROUPS: Array<{ label: string; terms: string[] }> = [
  {
    label: 'china-finance',
    terms: ['"China Exim"', '"China Development Bank"', '"Silk Road Fund"', '"Belt and Road"', 'AIIB'],
  },
  {
    label: 'china-soe',
    terms: ['"China Harbour"', '"China Merchants"', '"State Grid"', 'PowerChina', 'Sinohydro', 'COSCO', 'Huawei'],
  },
  {
    label: 'russia-gulf-entities',
    terms: ['Rosatom', 'Gazprom', '"Russian Railways"', '"DP World"', 'Mubadala', '"ACWA Power"', 'Masdar'],
  },
];

// Financing-instrument phrases: deal-speak that appears regardless of sponsor.
const INSTRUMENT_PHRASES = [
  '"concessional loan"', '"EPC contract"', '"build-operate-transfer"',
  '"port concession"', '"sovereign guarantee"',
];

export interface GdeltQuery {
  label: string;
  query: string;
}

export function nearClause(sponsor: string, asset: string): string {
  return `near${NEAR_DISTANCE}:"${sponsor} ${asset}"`;
}

export function buildGdeltQueries(): GdeltQuery[] {
  const queries: GdeltQuery[] = [];

  // Layer 1: proximity sweep
  for (const g of PROXIMITY_GROUPS) {
    const clauses = g.pairs.map(([s, a]) => nearClause(s, a));
    queries.push({ label: g.label, query: `(${clauses.join(' OR ')})` });
  }

  // Layer 2: entity watchlist
  for (const g of ENTITY_GROUPS) {
    queries.push({ label: g.label, query: `(${g.terms.join(' OR ')})` });
  }

  // Layer 3: instrument language
  queries.push({ label: 'instruments', query: `(${INSTRUMENT_PHRASES.join(' OR ')})` });

  return queries;
}

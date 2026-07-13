import { isLikelySameDeal, titleSimilarity, mergeCandidateIntoDeal } from '../lib/pipeline/deduplication.ts';
import { normalizeCandidate, normalizeSector, normalizeStage, parseUsd, normalizeKeyDates } from '../lib/pipeline/normalize.ts';
import { resolveSort, sanitizeSearch } from '../lib/db/queries.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('── Dedup: distinct deals must NOT merge ──');
{
  // The user's bug: two different facilities, same country+sector, similar titles.
  const port = { title: 'China-funded Port Expansion, Colombo, Sri Lanka', subsector: 'port', sponsoring_state: 'China' };
  const airport = { title: 'China-funded Airport Expansion, Colombo, Sri Lanka', subsector: 'airport', sponsoring_state: 'China' };
  const v = isLikelySameDeal(port, airport as never);
  check('port vs airport (subsectors differ) → no merge', !v.match, `sim=${v.similarity.toFixed(2)}`);

  // Same pair but subsector missing on one side — facility tokens must catch it.
  const portNoSub = { ...port, subsector: null };
  const v2 = isLikelySameDeal(portNoSub as never, airport as never);
  check('port vs airport (null subsector, facility tokens) → no merge', !v2.match, `sim=${v2.similarity.toFixed(2)}`);

  // Different sponsors, similar title.
  const ru = { title: 'Nuclear power plant construction, El Dabaa, Egypt', subsector: null, sponsoring_state: 'Russia' };
  const cn = { title: 'Nuclear power plant project, El Dabaa, Egypt', subsector: null, sponsoring_state: 'China' };
  const v3 = isLikelySameDeal(ru as never, cn as never);
  check('same plant name, different sponsors → no merge', !v3.match, `sim=${v3.similarity.toFixed(2)}`);
}

console.log('── Dedup: the same deal rephrased MUST still merge ──');
{
  const a = { title: 'China Exim-Financed Port Expansion, Dar es Salaam, Tanzania', subsector: 'port', sponsoring_state: 'China' };
  const b = { title: 'Dar es Salaam Port Expansion (China Exim Bank), Tanzania', subsector: 'port', sponsoring_state: 'China' };
  const v = isLikelySameDeal(a, b as never);
  check('same deal, two phrasings → merge', v.match, `sim=${v.similarity.toFixed(2)}`);

  const c = { title: 'Hambantota Port Phase II Expansion, Sri Lanka', subsector: 'port', sponsoring_state: null };
  const d = { title: 'Hambantota Port Phase II Expansion Project, Sri Lanka', subsector: null, sponsoring_state: 'China' };
  const v2 = isLikelySameDeal(c as never, d as never);
  check('near-identical titles, one missing sponsor/subsector → merge', v2.match, `sim=${v2.similarity.toFixed(2)}`);
}

console.log('── Normalization: LLM output → schema-safe values ──');
{
  check("sector 'Strategic Infrastructure' → strategic_infrastructure", normalizeSector('Strategic Infrastructure') === 'strategic_infrastructure');
  check("sector 'Energy' → energy", normalizeSector('Energy') === 'energy');
  check("sector 'telecom' → digital_connectivity", normalizeSector('telecom') === 'digital_connectivity');
  check("sector 'transport' → strategic_infrastructure", normalizeSector('transport') === 'strategic_infrastructure');
  check("sector garbage → other", normalizeSector('weird-value-42') === 'other');

  check("stage 'MOU' → exploratory_mou", normalizeStage('MOU') === 'exploratory_mou');
  check("stage 'Under Construction' → under_construction", normalizeStage('Under Construction') === 'under_construction');
  check("stage 'in talks' → negotiation", normalizeStage('in talks') === 'negotiation');
  check("stage 'financing agreement signed' → financing_secured", normalizeStage('financing agreement signed') === 'financing_secured');
  check("stage 'Signed' → signed", normalizeStage('Signed') === 'signed');
  check("stage garbage → rumored", normalizeStage('???') === 'rumored');

  check("parseUsd 450000000 → 450000000", parseUsd(450000000) === 450000000);
  check("parseUsd '$1.2 billion' → 1200000000", parseUsd('$1.2 billion') === 1_200_000_000);
  check("parseUsd '450M' → 450000000", parseUsd('450M') === 450_000_000);
  check("parseUsd '1,200,000,000' → 1200000000", parseUsd('1,200,000,000') === 1_200_000_000);
  check("parseUsd 'unknown' → null", parseUsd('unknown') === null);
  check("parseUsd -5 → null", parseUsd(-5) === null);

  const kd = normalizeKeyDates([
    { date: '2024', description: 'MOU signed' },
    { date: '2024-06', description: 'Groundbreaking' },
    { date: '2024-06-05T00:00:00Z', description: 'Loan agreement' },
    { date: 'June 2024', description: 'dropped — unparseable' },
    { date: '2024-01-01', description: '' }, // dropped — no description
  ]);
  check('key_dates: YYYY → YYYY-01-01', kd[0]?.date === '2024-01-01');
  check('key_dates: YYYY-MM → YYYY-MM-01', kd[1]?.date === '2024-06-01');
  check('key_dates: ISO timestamp → date part', kd[2]?.date === '2024-06-05');
  check('key_dates: invalid entries dropped', kd.length === 3, `got ${kd.length}`);

  const cand = normalizeCandidate({
    title: '  Port deal  ',
    sector: 'Energy & Power',
    lifecycle_stage: 'Talks ongoing',
    rom_value_usd: '2.5bn',
    financial_sponsors: [
      { name: 'China Exim Bank', type: 'Policy Bank', country: 'China', commitment_status: 'Committed' },
      { name: '', type: 'soe', country: 'China', commitment_status: 'signed' }, // dropped — no name
    ],
    confidence: 7, // clamped
  } as never);
  check('candidate: title trimmed', cand.title === 'Port deal');
  check('candidate: sector coerced', cand.sector === 'energy');
  check('candidate: stage coerced', cand.lifecycle_stage === 'negotiation');
  check('candidate: rom string parsed', cand.rom_value_usd === 2_500_000_000);
  check('candidate: sponsor status lowercased', cand.financial_sponsors[0]?.commitment_status === 'committed');
  check('candidate: sponsor type coerced', cand.financial_sponsors[0]?.type === 'policy_bank');
  check('candidate: nameless sponsor dropped', cand.financial_sponsors.length === 1);
  check('candidate: confidence clamped to 1', cand.confidence === 1);
}

console.log('── Sorting + search hardening ──');
{
  check('valid sort column kept', resolveSort({ sort_by: 'last_updated_at' }).column === 'last_updated_at');
  check('invalid sort column → composite_score', resolveSort({ sort_by: 'title;DROP TABLE deals' as never }).column === 'composite_score');
  check('sort_dir asc honored', resolveSort({ sort_by: 'first_seen_at', sort_dir: 'asc' }).ascending === true);
  check('sort_dir default desc', resolveSort({}).ascending === false);
  check('search commas/parens stripped', sanitizeSearch('port, energy (China)') === 'port energy China');
  check('search percent stripped', sanitizeSearch('100% done') === '100 done');
}


// ─── Running-tab simulation: the analyst workflow end-to-end (logic layer) ──────
// Simulates uploading two documents whose deals overlap, using the REAL decision
// functions (normalizeCandidate → isLikelySameDeal → mergeCandidateIntoDeal), and
// asserts the tab ends up with the right rows — the exact scenario that failed.
{
  console.log('── Running-tab simulation: two overlapping documents ──');

  interface TabDeal {
    id: string; title: string; subsector: string | null; sponsoring_state: string | null;
    host_country: string | null; sector: string; lifecycle_stage: string;
    lifecycle_reasoning?: string | null; rom_value_usd: number | null; rom_basis?: string | null;
    financial_sponsors: Array<{ name: string }>; source_count: number;
  }

  const tab: TabDeal[] = [];
  let nextId = 1;

  function simulateIngest(rawCandidates: unknown[]): { created: number; updated: number } {
    let created = 0, updated = 0;
    for (const raw of rawCandidates) {
      const c = normalizeCandidate(raw as never);
      if (!c.title) continue;
      const pool = tab.filter(
        (d) => d.sector === c.sector && (!c.host_country || !d.host_country || d.host_country === c.host_country)
      );
      let best: { deal: TabDeal; sim: number } | null = null;
      for (const d of pool) {
        const v = isLikelySameDeal(c, d as never);
        if (v.match && (!best || v.similarity > best.sim)) best = { deal: d, sim: v.similarity };
      }
      if (best) {
        const merged = mergeCandidateIntoDeal(best.deal as never, c);
        Object.assign(best.deal, merged);
        best.deal.source_count++;
        updated++;
      } else {
        tab.push({
          id: String(nextId++), title: c.title, subsector: c.subsector,
          sponsoring_state: c.sponsoring_state, host_country: c.host_country,
          sector: c.sector, lifecycle_stage: c.lifecycle_stage,
          rom_value_usd: c.rom_value_usd, financial_sponsors: c.financial_sponsors,
          source_count: 1,
        });
        created++;
      }
    }
    return { created, updated };
  }

  // Document 1: three distinct deals.
  const doc1 = simulateIngest([
    { title: 'China-funded Port Expansion, Colombo, Sri Lanka', sector: 'strategic_infrastructure', subsector: 'port', sponsoring_state: 'China', host_country: 'Sri Lanka', lifecycle_stage: 'negotiation' },
    { title: 'Huawei 5G National Rollout, Bangladesh', sector: 'Digital Connectivity', subsector: '5G network', sponsoring_state: 'China', host_country: 'Bangladesh', lifecycle_stage: 'MOU' },
    { title: 'Standard Gauge Railway Extension, Kenya', sector: 'strategic_infrastructure', subsector: 'rail', sponsoring_state: 'China', host_country: 'Kenya', lifecycle_stage: 'signed' },
  ]);
  check('doc 1: all three deals created', doc1.created === 3 && doc1.updated === 0, JSON.stringify(doc1));

  // Document 2: one NEW deal in the same city/sector (the old bug swallowed this),
  // one re-report of an existing deal with a stage upgrade, one unrelated new deal.
  const doc2 = simulateIngest([
    { title: 'China-funded Airport Expansion, Colombo, Sri Lanka', sector: 'strategic_infrastructure', subsector: 'airport', sponsoring_state: 'China', host_country: 'Sri Lanka', lifecycle_stage: 'rumored' },
    { title: 'Colombo Port Expansion Project (China), Sri Lanka', sector: 'strategic_infrastructure', subsector: 'port', sponsoring_state: 'China', host_country: 'Sri Lanka', lifecycle_stage: 'Signed', rom_value_usd: '$1.4 billion' },
    { title: 'Rosatom Nuclear Power Plant, El Dabaa, Egypt', sector: 'energy', subsector: 'nuclear power', sponsoring_state: 'Russia', host_country: 'Egypt', lifecycle_stage: 'under construction' },
  ]);
  check('doc 2: airport + nuclear created, port updated', doc2.created === 2 && doc2.updated === 1, JSON.stringify(doc2));
  check('tab has 5 distinct deals', tab.length === 5, `got ${tab.length}`);

  const port = tab.find((d) => d.subsector === 'port')!;
  check('port deal stage upgraded negotiation → signed', port.lifecycle_stage === 'signed', port.lifecycle_stage);
  check('port deal value filled from re-report ($1.4B parsed)', port.rom_value_usd === 1_400_000_000, String(port.rom_value_usd));
  check('port deal source count incremented', port.source_count === 2, String(port.source_count));

  // Re-analyzing the SAME document must not duplicate anything (idempotence).
  const rerun = simulateIngest([
    { title: 'China-funded Airport Expansion, Colombo, Sri Lanka', sector: 'strategic_infrastructure', subsector: 'airport', sponsoring_state: 'China', host_country: 'Sri Lanka', lifecycle_stage: 'rumored' },
  ]);
  check('re-analyze same doc: no duplicate rows', rerun.created === 0 && rerun.updated === 1 && tab.length === 5, JSON.stringify(rerun));
}

// ─── Every sort option offered in the UI must pass the server whitelist ────────
{
  console.log('── UI sort options accepted by server ──');
  // Values from DashboardControls SORT_OPTIONS — if someone adds an option there
  // without whitelisting it in resolveSort, this fails.
  for (const v of ['composite_score', 'last_updated_at', 'first_seen_at', 'rom_value_usd']) {
    check(`sort option '${v}' accepted`, resolveSort({ sort_by: v as never }).column === v);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

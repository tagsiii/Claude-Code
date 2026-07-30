// Data-quality vetting tests: independent-source counting, syndication
// collapse, quality grading, the review gate, and provenance stamping.

import {
  registrableDomain, countIndependentSources, normalizeHeadline, dedupeSyndicated,
  computeQualityGrade, autoReviewStatus, stampProvenance, sourceLabel,
} from '../lib/pipeline/quality.ts';
import type { Deal } from '../lib/types.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('── Registrable domains + independence ──');
{
  check('www stripped', registrableDomain('https://www.reuters.com/article/x') === 'reuters.com');
  check('subdomains collapse', registrableDomain('https://news.energy.example.com/a') === 'example.com');
  check('two-part TLD kept', registrableDomain('https://www.telegraph.co.uk/x') === 'telegraph.co.uk');
  check('uploads are their own source', registrableDomain('upload://doc-123').startsWith('upload://'));

  check('same outlet twice = 1 independent source',
    countIndependentSources(['https://reuters.com/a', 'https://www.reuters.com/b']) === 1);
  check('different outlets counted',
    countIndependentSources(['https://reuters.com/a', 'https://ft.com/b', 'upload://d1']) === 3);
}

console.log('── Syndicated-copy collapse ──');
{
  const same = normalizeHeadline('China Exim funds $1.2B port — Business Daily');
  const alsoSame = normalizeHeadline('china exim funds $1.2b port | The Standard');
  check('headline normalization matches across outlets', same === alsoSame);

  const articles = [
    { title: 'China Exim funds $1.2B port expansion in Tanzania', url: 'https://outlet-a.com/1' },
    { title: 'China Exim funds $1.2B port expansion in Tanzania', url: 'https://outlet-b.com/2' }, // copy
    { title: 'China Exim funds $1.2B port expansion in Tanzania', url: 'https://outlet-a.com/3' }, // same outlet, keep
    { title: 'Russia signs nuclear MOU with Egypt', url: 'https://outlet-b.com/4' },
  ];
  const out = dedupeSyndicated(articles);
  check('cross-outlet copy dropped', out.length === 3 && !out.some((a) => a.url.endsWith('/2')));
  check('same-outlet repeat kept (may be an update)', out.some((a) => a.url.endsWith('/3')));
  check('distinct stories kept', out.some((a) => a.url.endsWith('/4')));
}

console.log('── Quality grade (documented point system) ──');
{
  const rich = computeQualityGrade({
    financial_sponsors: [{ name: 'China Exim' }] as never,
    rom_value_usd: 1_200_000_000,
    location_precision: 'facility',
    source_confidence_tier: 2,
    xref_cn_ref: '35756',
    is_confirmed: true,
  } as Partial<Deal>, 3);
  check('full evidence → A (12 pts)', rich.grade === 'A' && rich.components.points === 12);

  const thin = computeQualityGrade({}, 1);
  check('bare rumor → D (0 pts)', thin.grade === 'D' && thin.components.points === 0);

  const mid = computeQualityGrade({
    rom_value_usd: 50_000_000, source_confidence_tier: 2,
  } as Partial<Deal>, 2);
  check('value + 2 outlets + tier2 → 5 pts = C', mid.grade === 'C' && mid.components.points === 5);

  const bGrade = computeQualityGrade({
    financial_sponsors: [{ name: 'X' }] as never, rom_value_usd: 10, source_confidence_tier: 2,
  } as Partial<Deal>, 2);
  check('sponsor + value + 2 outlets + tier2 → 7 pts = B', bGrade.grade === 'B' && bGrade.components.points === 7);
}

console.log('── Review gate ──');
{
  check('tier-1 documents always approved', autoReviewStatus('D', 1, 1, false) === 'approved');
  check('grade D → pending', autoReviewStatus('D', 2, 2, true) === 'pending');
  check('single anonymous unconfirmed source → pending', autoReviewStatus('C', 3, 1, false) === 'pending');
  check('confirmed single source passes', autoReviewStatus('C', 3, 1, true) === 'approved');
  check('two outlets at grade C pass', autoReviewStatus('C', 3, 2, false) === 'approved');
  check('grade B always passes (non-D, multi/tier2)', autoReviewStatus('B', 2, 1, false) === 'approved');
}

console.log('── Provenance ──');
{
  const p1 = stampProvenance(null, ['rom_value_usd', 'lifecycle_stage'], 'reuters.com', '2026-07-30');
  check('fields stamped', p1.rom_value_usd?.source === 'reuters.com' && p1.lifecycle_stage?.date === '2026-07-30');
  const p2 = stampProvenance(p1, ['lifecycle_stage'], 'ft.com', '2026-08-01');
  check('newer assertion overwrites, others kept',
    p2.lifecycle_stage?.source === 'ft.com' && p2.rom_value_usd?.source === 'reuters.com');
  check('source label for articles is the outlet', sourceLabel({ url: 'https://www.ft.com/content/abc' }) === 'ft.com');
  check('source label for documents names the file',
    sourceLabel({ url: 'upload://x', title: 'briefing.docx' }) === 'document: briefing.docx');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

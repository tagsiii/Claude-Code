// Live GDELT query checker — run with:  npm run gdelt:check
//
// Probes every query the scanner will actually use against the real GDELT API
// (no key needed) over a 7-day window, and prints hit counts + sample headlines
// per query. Use it to eyeball whether the net is catching the deals you care
// about, and to spot rejected queries after editing gdeltQueries.ts.
//
// GDELT allows ONE request per 5 seconds, so this takes ~1 minute to run.

import { buildGdeltQueries } from '../lib/connectors/gdeltQueries.ts';

const API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const SPACING_MS = 5500;

const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const end = new Date();
const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

const isRateLimitText = (t: string) => /limit requests|rate limit/i.test(t);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
let totalHits = 0;
const seen = new Set<string>();
const queries = buildGdeltQueries();

console.log(`Probing ${queries.length} queries (~${Math.ceil((queries.length * SPACING_MS) / 1000)}s at GDELT's 1-per-5s rate limit)…\n`);

for (const { label, query } of queries) {
  const params = new URLSearchParams({
    query,
    mode: 'artlist',
    format: 'json',
    maxrecords: '100',
    sort: 'DateDesc',
    startdatetimelocal: fmt(start),
    enddatetimelocal: fmt(end),
  });

  try {
    let text = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${API}?${params}`, {
        headers: { 'User-Agent': 'EconomicStatecraftMonitor/1.0' },
      });
      text = await res.text();
      if (isRateLimitText(text) && attempt === 0) {
        await sleep(SPACING_MS + 1500);
        continue;
      }
      break;
    }

    let articles: Array<{ url: string; title: string }> = [];
    try {
      articles = JSON.parse(text).articles ?? [];
    } catch {
      failures++;
      console.log(`✗ ${label}: REJECTED — ${text.slice(0, 140).replace(/\s+/g, ' ')}`);
      await sleep(SPACING_MS);
      continue;
    }
    const fresh = articles.filter((a) => a.url && !seen.has(a.url));
    fresh.forEach((a) => seen.add(a.url));
    totalHits += articles.length;
    console.log(`✓ ${label}: ${articles.length} hits (${fresh.length} unique new)`);
    for (const a of fresh.slice(0, 3)) {
      console.log(`    · ${(a.title ?? '').slice(0, 110)}`);
    }
  } catch (err) {
    failures++;
    console.log(`✗ ${label}: fetch failed — ${err instanceof Error ? err.message : err}`);
  }
  await sleep(SPACING_MS);
}

console.log(`\n${seen.size} unique articles across all queries (${totalHits} total hits), ${failures} failed queries`);
if (failures > 0) {
  console.log('Failed queries above were rejected by GDELT — fix them in lib/connectors/gdeltQueries.ts');
  process.exit(1);
}

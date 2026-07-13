// Live GDELT query checker — run with:  npm run gdelt:check
//
// Probes every query the scanner will actually use against the real GDELT API
// (no key needed) over a 7-day window, and prints hit counts + sample headlines
// per query. Use it to eyeball whether the net is catching the deals you care
// about, and to spot rejected queries after editing gdeltQueries.ts.

import { buildGdeltQueries } from '../lib/connectors/gdeltQueries.ts';

const API = 'https://api.gdeltproject.org/api/v2/doc/doc';

const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const end = new Date();
const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

let failures = 0;
let totalHits = 0;
const seen = new Set<string>();

for (const { label, query } of buildGdeltQueries()) {
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
    const res = await fetch(`${API}?${params}`, {
      headers: { 'User-Agent': 'EconomicStatecraftMonitor/1.0' },
    });
    const text = await res.text();
    let articles: Array<{ url: string; title: string }> = [];
    try {
      articles = JSON.parse(text).articles ?? [];
    } catch {
      failures++;
      console.log(`✗ ${label}: REJECTED — ${text.slice(0, 140).replace(/\s+/g, ' ')}`);
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
  await new Promise((r) => setTimeout(r, 800));
}

console.log(`\n${seen.size} unique articles across all queries (${totalHits} total hits), ${failures} failed queries`);
if (failures > 0) {
  console.log('Failed queries above were REJECTED by GDELT — fix their syntax in lib/connectors/gdeltQueries.ts');
  process.exit(1);
}

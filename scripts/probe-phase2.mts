// Phase 2 source reconnaissance — run with: npm run probe:phase2
//
// Checks reachability and captures format samples for every Phase-2 data
// source (DFC, USTDA, EXIM, MCC, World Bank, PPI, OECD, IATI, Marine Regions,
// AidData). Prints a compact report to paste back to the developer; response
// bodies are saved under data/probes/ (gitignored) for reference.
// Read-only GETs, one per host, no keys required.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Target {
  key: string;
  url: string;
  note: string;
}

const TARGETS: Target[] = [
  { key: 'wb-projects-api', url: 'https://search.worldbank.org/api/v3/projects?format=json&rows=2', note: 'World Bank Projects API' },
  { key: 'wb-projects-api-v2', url: 'https://api.worldbank.org/v2/country?format=json&per_page=2', note: 'World Bank API base (sanity)' },
  { key: 'ppi', url: 'https://ppi.worldbank.org/en/ppi', note: 'PPI portal (bulk download is manual)' },
  { key: 'dfc-data', url: 'https://www.dfc.gov/our-impact/active-projects', note: 'DFC active projects page (look for data link)' },
  { key: 'ustda-wpjson', url: 'https://www.ustda.gov/wp-json/wp/v2/posts?per_page=2', note: 'USTDA WordPress JSON feed (press releases)' },
  { key: 'exim-open', url: 'https://www.exim.gov/open', note: 'EXIM open-data page' },
  { key: 'mcc-data', url: 'https://data.mcc.gov/evaluations/index.php/catalog', note: 'MCC open data catalog' },
  { key: 'adb-projects', url: 'https://www.adb.org/projects', note: 'ADB projects (API discovery)' },
  { key: 'oecd-sdmx', url: 'https://sdmx.oecd.org/public/rest/dataflow/OECD.DCD.FSD?format=json', note: 'OECD SDMX (CRS aggregates)' },
  { key: 'iati', url: 'https://api.iatistandard.org/datastore/activity/select?q=*:*&rows=1', note: 'IATI datastore (may require free key)' },
  { key: 'marineregions', url: 'https://www.marineregions.org/downloads.php', note: 'Marine Regions EEZ download page' },
  { key: 'aiddata-github', url: 'https://raw.githubusercontent.com/aiddata/gcdf-geospatial-data/main/README.md', note: 'AidData GCDF repo' },
];

const outDir = resolve(process.cwd(), 'data/probes');
mkdirSync(outDir, { recursive: true });

function extractDataLinks(html: string): string[] {
  const links = new Set<string>();
  const re = /href=["']([^"']+\.(?:csv|xlsx|xls|json|geojson|zip)[^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && links.size < 12) links.add(m[1]);
  return [...links];
}

for (const t of TARGETS) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(t.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EconomicStatecraftMonitor/1.0)', Accept: '*/*' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    const body = await res.text();
    const ct = res.headers.get('content-type') ?? '?';
    writeFileSync(resolve(outDir, `${t.key}.txt`), body.slice(0, 200_000));

    console.log(`\n■ ${t.key} — ${t.note}`);
    console.log(`  ${res.status} ${ct.split(';')[0]}  (${body.length} bytes)`);
    if (ct.includes('json')) {
      console.log(`  json head: ${body.slice(0, 220).replace(/\s+/g, ' ')}`);
    } else if (ct.includes('html')) {
      const dataLinks = extractDataLinks(body);
      if (dataLinks.length) console.log(`  data links found:\n    ${dataLinks.slice(0, 8).join('\n    ')}`);
      else console.log(`  html page, no direct data-file links visible`);
    } else {
      console.log(`  head: ${body.slice(0, 160).replace(/\s+/g, ' ')}`);
    }
  } catch (err) {
    console.log(`\n■ ${t.key} — ${t.note}`);
    console.log(`  FAILED: ${err instanceof Error ? err.message : err}`);
  }
  await new Promise((r) => setTimeout(r, 1200));
}

console.log('\nDone. Paste everything above back into the session. Full bodies are in data/probes/ if needed.');

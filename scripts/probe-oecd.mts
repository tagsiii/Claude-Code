// Discovers the current OECD SDMX identifiers for the CRS (Creditor Reporting
// System) dataset. v2: prints RAW evidence (content type, response sample,
// tag shapes, CRS mentions in context) instead of parsing with assumptions —
// the first version assumed a structure the API doesn't use and printed
// nothing. No database access, no AI tokens.
//
//   npm run probe:oecd

const BASE = 'https://sdmx.oecd.org/public/rest';

async function get(url: string, timeoutMs = 120_000): Promise<{ status: number; type: string; text: string } | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.sdmx.structure+xml;version=2.1, application/xml, */*' },
    });
    clearTimeout(t);
    return { status: res.status, type: res.headers.get('content-type') ?? '?', text: await res.text() };
  } catch (err) {
    console.log(`  fetch failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// Every place a pattern appears, with surrounding context — raw, no assumptions.
function contexts(text: string, re: RegExp, span: number, max: number): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = g.exec(text)) !== null && out.length < max) {
    out.push(clean(text.slice(Math.max(0, m.index - span), m.index + span)));
    g.lastIndex = m.index + span; // skip ahead so overlapping hits don't repeat
  }
  return out;
}

console.log('── 1. Catalog for agency OECD.DCD.FSD ──');
{
  const res = await get(`${BASE}/dataflow/OECD.DCD.FSD`);
  if (res) {
    console.log(`  HTTP ${res.status} · content-type: ${res.type} · ${res.text.length} bytes`);
    console.log(`  first 350 chars: ${clean(res.text.slice(0, 350))}`);
    console.log('  --- how Dataflow entries look (first 6 opening tags) ---');
    for (const c of contexts(res.text, /<[\w:]*Dataflow\b/i, 260, 6)) console.log(`  ${c}`);
    console.log('  --- every mention of CRS/Creditor (first 10, with context) ---');
    const hits = contexts(res.text, /CRS|creditor/i, 160, 10);
    if (hits.length === 0) console.log('  (none in this catalog)');
    for (const c of hits) console.log(`  ${c}`);
  }
}

console.log('\n── 2. CRS/Creditor mentions across the FULL catalog (all agencies) ──');
{
  const res = await get(`${BASE}/dataflow/all`, 240_000);
  if (res) {
    console.log(`  HTTP ${res.status} · content-type: ${res.type} · ${res.text.length} bytes`);
    const hits = contexts(res.text, /DSD_CRS|DF_CRS|creditor reporting/i, 200, 10);
    if (hits.length === 0) {
      console.log('  no DSD_CRS/DF_CRS/"creditor reporting" anywhere; loose "CRS" hits:');
      for (const c of contexts(res.text, /\bCRS\b/, 160, 8)) console.log(`  ${c}`);
    }
    for (const c of hits) console.log(`  ${c}`);
  }
}

console.log('\n── 3. Direct data-query attempts (1 observation each; status + head) ──');
for (const flowRef of [
  'OECD.DCD.FSD,DSD_CRS@DF_CRS,1.3',
  'OECD.DCD.FSD,DSD_CRS@DF_CRS',      // unpinned version
  'OECD.DCD.FSD,DSD_CRS@DF_CRS,+',    // SDMX "latest"
]) {
  const url = `${BASE}/data/${flowRef}/all?lastNObservations=1&format=csvfilewithlabels`;
  const res = await get(url);
  if (res) console.log(`  ${flowRef} → HTTP ${res.status}: ${clean(res.text.slice(0, 160))}`);
  await new Promise((r) => setTimeout(r, 1200));
}

console.log('\nPaste ALL of the output above back into the chat.');

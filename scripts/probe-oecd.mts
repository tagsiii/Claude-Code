// Discovers the current OECD SDMX identifiers for the CRS (Creditor Reporting
// System) dataset. The data URL embeds agency/dataflow/version, and OECD bumps
// these between releases — when sync:oecd starts 404ing, run this and paste
// the output so the loader can be re-pointed at the real current identifiers.
// No database access, no AI tokens: three plain HTTPS requests.
//
//   npm run probe:oecd

const BASE = 'https://sdmx.oecd.org/public/rest';

async function get(url: string, timeoutMs = 90_000): Promise<{ status: number; text: string } | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    return { status: res.status, text: await res.text() };
  } catch (err) {
    console.log(`  fetch failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function printDataflows(xml: string, filter: RegExp): number {
  // <str:Dataflow id="DF_CRS" agencyID="OECD.DCD.FSD" version="1.4" ...>
  //   <com:Name xml:lang="en">Creditor Reporting System</com:Name>
  const re = /<str(?:ucture)?:Dataflow\b[^>]*\bid="([^"]+)"[^>]*\bagencyID="([^"]+)"[^>]*\bversion="([^"]+)"[^>]*>([\s\S]{0,600}?)<\/str(?:ucture)?:Dataflow>|<str(?:ucture)?:Dataflow\b[^>]*\bagencyID="([^"]+)"[^>]*\bid="([^"]+)"[^>]*\bversion="([^"]+)"[^>]*>([\s\S]{0,600}?)<\/str(?:ucture)?:Dataflow>/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(xml)) !== null) {
    const id = m[1] ?? m[6];
    const agency = m[2] ?? m[5];
    const version = m[3] ?? m[7];
    const body = m[4] ?? m[8] ?? '';
    const name = body.match(/<com(?:mon)?:Name[^>]*xml:lang="en"[^>]*>([^<]+)</)?.[1]
      ?? body.match(/<com(?:mon)?:Name[^>]*>([^<]+)</)?.[1] ?? '';
    if (!filter.test(`${id} ${name}`)) continue;
    console.log(`  dataflow: agency=${agency}  id=${id}  version=${version}  name="${name}"`);
    count++;
  }
  return count;
}

console.log('── 1. Dataflows under agency OECD.DCD.FSD (development finance) ──');
{
  const res = await get(`${BASE}/dataflow/OECD.DCD.FSD`);
  if (res) {
    console.log(`  HTTP ${res.status}, ${res.text.length} bytes`);
    if (res.status === 200) {
      const n = printDataflows(res.text, /CRS|creditor/i);
      if (n === 0) {
        console.log('  (no CRS-named dataflows — all flows under this agency:)');
        printDataflows(res.text, /./);
      }
    } else {
      console.log(`  body: ${res.text.slice(0, 300).replace(/\s+/g, ' ')}`);
    }
  }
}

console.log('\n── 2. CRS dataflows across ALL agencies (fallback search) ──');
{
  const res = await get(`${BASE}/dataflow/all`, 180_000);
  if (res) {
    console.log(`  HTTP ${res.status}, ${res.text.length} bytes`);
    if (res.status === 200) {
      const n = printDataflows(res.text, /\bCRS\b|creditor reporting/i);
      if (n === 0) console.log('  no dataflow mentioning CRS anywhere');
    } else {
      console.log(`  body: ${res.text.slice(0, 300).replace(/\s+/g, ' ')}`);
    }
  }
}

console.log('\n── 3. Dimension order of DSD_CRS (needed to build the data key) ──');
{
  const res = await get(`${BASE}/datastructure/OECD.DCD.FSD/DSD_CRS?references=none`);
  if (res) {
    console.log(`  HTTP ${res.status}`);
    if (res.status === 200) {
      // <str:Dimension id="DONOR" position="1"> …
      const dims: Array<{ id: string; pos: number }> = [];
      const re = /<str(?:ucture)?:Dimension\b[^>]*\bid="([^"]+)"[^>]*\bposition="(\d+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(res.text)) !== null) dims.push({ id: m[1], pos: Number(m[2]) });
      dims.sort((a, b) => a.pos - b.pos);
      console.log(`  key order: ${dims.map((d) => d.id).join('.')}`);
      const time = res.text.match(/<str(?:ucture)?:TimeDimension\b[^>]*\bid="([^"]+)"/)?.[1];
      if (time) console.log(`  time dimension: ${time}`);
    } else {
      console.log(`  body: ${res.text.slice(0, 300).replace(/\s+/g, ' ')}`);
    }
  }
}

console.log('\nPaste ALL of the output above back into the chat.');

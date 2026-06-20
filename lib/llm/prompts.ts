export const DEAL_EXTRACTION_SYSTEM = `You are a senior economic statecraft analyst at a US policy institution. Your task is to analyze news article titles and identify DISTINCT, SPECIFIC cross-border transactions where a state or state-backed entity uses economic tools to advance geopolitical influence.

Priority sectors (in order):
1. Strategic infrastructure: ports, rail, airports, logistics hubs, special economic zones
2. Digital connectivity: 5G/telecom, data centers, subsea/terrestrial cables, satellite stations, smart-city systems
3. Energy & electricity: generation, grids/transmission, nuclear, LNG terminals, pipelines, critical-mineral processing
4. Cybersecurity of critical infrastructure: national networks, SCADA/OT, surveillance systems, sovereign cloud

Focus on state-backed actors: China (policy banks: China Exim Bank, CDB; SOEs; Silk Road Fund), Russia (Gazprom, Rosatom), Gulf sovereign funds (ADIA, QIA, PIF, Mubadala), and other state-controlled entities.

DATA INTEGRITY RULES — CRITICAL:
- Never fabricate deals, sponsors, figures, or quotes
- Only extract deals that are clearly and specifically described in the provided titles
- Mark everything uncertain as "unconfirmed"
- If a field cannot be determined from the titles, use null
- Distinguish "reported" from "confirmed"

Return a JSON array. Each element is a distinct deal with this schema:
{
  "title": "Descriptive deal name (e.g., 'China Exim-Financed Port Expansion, Dar es Salaam, Tanzania')",
  "sponsoring_state": "Country name or null",
  "host_country": "Country where deal occurs or null",
  "host_region": "Africa|South Asia|Southeast Asia|Central Asia|Pacific|Latin America|MENA|Europe|Other or null",
  "sector": "strategic_infrastructure|digital_connectivity|energy|cybersecurity|other",
  "subsector": "More specific (e.g., 'port', '5G network', 'nuclear power') or null",
  "lifecycle_stage": "rumored|exploratory_mou|negotiation|signed|financing_secured|under_construction",
  "lifecycle_reasoning": "1-sentence explanation citing specific language from the articles",
  "rom_value_usd": integer in USD or null,
  "rom_basis": "How you estimated the value, or null",
  "sponsoring_entities": [{"name": "...", "type": "policy_bank|soe|sovereign_fund|commercial|unknown", "country": "...", "commitment_status": "rumored|identified|committed|signed"}],
  "financial_sponsors": [same schema as sponsoring_entities],
  "is_confirmed": false,
  "confidence": 0.0-1.0,
  "source_urls": ["url1", "url2"],
  "key_dates": [{"date": "YYYY-MM-DD or YYYY-MM or YYYY", "description": "event"}]
}

Return ONLY valid JSON array. No markdown, no explanation outside the JSON.`;

export const DEAL_SUMMARY_SYSTEM = `You are a senior economic statecraft analyst. You are writing a detailed brief on a specific cross-border infrastructure or technology transaction for a US policy analyst.

DATA INTEGRITY RULES — CRITICAL:
- Every factual claim must be traceable to one of the provided sources
- Cite sources inline as [Source N] where N is the source number
- If a fact is uncertain, say "reportedly" or "unconfirmed"
- Do not extrapolate beyond what the sources say
- If information is absent, note it as "not yet publicly disclosed"

Write in clear, direct prose. No bullet points in summaries. Professional analytical style.`;

export function buildExtractionPrompt(articles: Array<{ url: string; title: string; published_at: string | null }>): string {
  const lines = articles
    .map((a, i) => `[${i + 1}] ${a.title} | ${a.published_at?.slice(0, 10) ?? 'undated'} | ${a.url}`)
    .join('\n');
  return `Analyze these ${articles.length} news article titles and extract distinct economic statecraft transactions:\n\n${lines}`;
}

export function buildSummaryPrompt(
  dealTitle: string,
  hostCountry: string,
  sponsoringState: string | null,
  sector: string,
  sources: Array<{ url: string; title: string | null; published_at: string | null }>
): string {
  const sourceList = sources
    .map((s, i) => `[Source ${i + 1}] "${s.title ?? 'Untitled'}" — ${s.url} (${s.published_at?.slice(0, 10) ?? 'undated'})`)
    .join('\n');

  return `
DEAL: ${dealTitle}
HOST COUNTRY: ${hostCountry}
SPONSORING STATE: ${sponsoringState ?? 'Unknown'}
SECTOR: ${sector}

SOURCES:
${sourceList}

Write the following (return as JSON with keys "executive_summary" and "us_diplomatic_context"):

1. executive_summary: A one-paragraph executive summary (150-250 words) of the transaction. Include what is known about the deal structure, the sponsoring entity, the strategic significance, and the host country context. Cite sources inline as [Source N]. End with a note on what remains unconfirmed.

2. us_diplomatic_context: A one-paragraph summary (100-200 words) of recent US diplomatic relations with ${hostCountry} and the current state of bilateral ties. Include any relevant US engagement on infrastructure, development finance, or the relevant sector. Cite sources where available; note where this is based on general knowledge of bilateral relations.

Return ONLY valid JSON.`;
}

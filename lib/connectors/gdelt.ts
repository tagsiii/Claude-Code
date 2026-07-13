import { BaseConnector, ConnectorOptions } from './base';
import { buildGdeltQueries } from './gdeltQueries';
import type { RawArticle } from '../types';

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Safety valve: proximity queries are intentionally broad; cap total volume so
// a hot news week can't explode LLM cost downstream.
const MAX_ARTICLES = 900;

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

export class GdeltConnector extends BaseConnector {
  readonly name = 'gdelt';
  readonly displayName = 'GDELT Global News';

  isAvailable(): boolean {
    return true; // no API key required
  }

  async fetchArticles(opts: ConnectorOptions = {}): Promise<RawArticle[]> {
    const lookback = opts.lookbackDays ?? 7;
    const articles: RawArticle[] = [];
    const seen = new Set<string>();
    this.warnings = [];

    const end = new Date();
    const start = new Date(end.getTime() - lookback * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    const queries = buildGdeltQueries();

    for (const { label, query } of queries) {
      try {
        const params = new URLSearchParams({
          query,
          mode: 'artlist',
          format: 'json',
          maxrecords: '100',
          sort: 'DateDesc',
          startdatetimelocal: fmt(start),
          enddatetimelocal: fmt(end),
        });

        const res = await fetch(`${GDELT_DOC_API}?${params}`, {
          headers: { 'User-Agent': 'EconomicStatecraftMonitor/1.0' },
          next: { revalidate: 0 },
        });

        const text = await res.text();
        if (!res.ok) {
          this.warnings.push(`${label}: HTTP ${res.status} — ${text.slice(0, 120)}`);
          continue;
        }

        // GDELT reports query-syntax errors as plain text with HTTP 200 —
        // a JSON parse failure here means the query was rejected, not empty.
        let json: { articles?: GdeltArticle[] };
        try {
          json = JSON.parse(text);
        } catch {
          this.warnings.push(`${label}: query rejected — ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
          continue;
        }

        for (const a of json.articles ?? []) {
          if (!a.url || seen.has(a.url)) continue;
          seen.add(a.url);
          articles.push({
            url: a.url,
            title: a.title ?? '',
            published_at: parseGdeltDate(a.seendate),
            source_country: a.sourcecountry ?? null,
            language: a.language ?? null,
            domain: a.domain ?? null,
            connector: 'gdelt',
            confidence_tier: 2,
          });
        }

        await this.delay(500); // be respectful to GDELT
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.warnings.push(`${label}: ${msg}`.slice(0, 160));
      }
    }

    // Every single query failed → the net is broken, not the news cycle quiet.
    if (articles.length === 0 && this.warnings.length === queries.length && queries.length > 0) {
      throw new Error(`GDELT: all ${queries.length} queries failed — first: ${this.warnings[0]}`);
    }

    return articles.length > MAX_ARTICLES ? articles.slice(0, MAX_ARTICLES) : articles;
  }
}

function parseGdeltDate(raw: string): string | null {
  // GDELT format: "20240615T120000Z" or "20240615120000"
  if (!raw) return null;
  const cleaned = raw.replace('T', '').replace('Z', '');
  if (cleaned.length < 14) return null;
  const year = cleaned.slice(0, 4);
  const month = cleaned.slice(4, 6);
  const day = cleaned.slice(6, 8);
  const hour = cleaned.slice(8, 10);
  const min = cleaned.slice(10, 12);
  return `${year}-${month}-${day}T${hour}:${min}:00Z`;
}

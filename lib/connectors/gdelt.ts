import { BaseConnector, ConnectorOptions } from './base';
import type { RawArticle } from '../types';

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Searches targeting economic statecraft transactions in priority sectors
const QUERY_GROUPS = [
  // Strategic infrastructure
  '"port investment" OR "port development" OR "port concession" OR "port management contract"',
  '"railway investment" OR "rail construction" OR "airport construction" OR "logistics hub" OR "special economic zone"',
  // Digital connectivity
  '"5G contract" OR "5G network" OR "subsea cable" OR "submarine cable" OR "fiber optic network" OR "data center investment"',
  '"telecom infrastructure" OR "satellite ground station" OR "smart city" OR "digital infrastructure"',
  // Energy
  '"power plant investment" OR "energy infrastructure" OR "electricity grid" OR "nuclear power plant" OR "LNG terminal"',
  '"oil pipeline" OR "gas pipeline" OR "transmission line" OR "critical minerals" OR "mining investment"',
  // State actor keywords
  '"Belt and Road" OR "BRI" OR "China Exim Bank" OR "China Development Bank" OR "Silk Road Fund"',
  '"Rosatom" OR "Gazprom" OR "Russian investment" OR "AIIB" OR "NDB" project',
  '"sovereign wealth fund" infrastructure OR "state-owned enterprise" infrastructure OR "concessional loan"',
  // Geopolitical framing
  '"strategic infrastructure" investment OR "economic statecraft" OR "debt trap" OR "influence" investment',
];

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
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

    const end = new Date();
    const start = new Date(end.getTime() - lookback * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:T]/g, '').slice(0, 14);

    for (const query of QUERY_GROUPS) {
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

        if (!res.ok) continue;

        const json: GdeltResponse = await res.json();
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
      } catch {
        // continue on per-query errors
      }
    }

    return articles;
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

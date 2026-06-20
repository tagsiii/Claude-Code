import { BaseConnector, ConnectorOptions } from './base';
import type { RawArticle } from '../types';

const NEWSAPI_URL = 'https://newsapi.org/v2/everything';

const QUERIES = [
  'China infrastructure investment developing countries',
  'Belt and Road Initiative port energy deal',
  '5G telecom contract Africa Asia Pacific',
  'nuclear power plant investment contract',
  'submarine cable data center investment',
  'sovereign fund strategic infrastructure',
  'Russia energy pipeline investment',
];

interface NewsApiArticle {
  url: string;
  title: string;
  publishedAt: string;
  source: { name: string; id: string | null };
}

interface NewsApiResponse {
  articles?: NewsApiArticle[];
  status: string;
  message?: string;
}

export class NewsApiConnector extends BaseConnector {
  readonly name = 'newsapi';
  readonly displayName = 'NewsAPI';

  isAvailable(): boolean {
    return !!process.env.NEWSAPI_KEY;
  }

  async fetchArticles(opts: ConnectorOptions = {}): Promise<RawArticle[]> {
    const key = process.env.NEWSAPI_KEY;
    if (!key) return [];

    const articles: RawArticle[] = [];
    const seen = new Set<string>();
    const lookback = opts.lookbackDays ?? 7;
    const from = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    for (const q of QUERIES) {
      try {
        const params = new URLSearchParams({
          q,
          from,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: '20',
          apiKey: key,
        });

        const res = await fetch(`${NEWSAPI_URL}?${params}`);
        if (!res.ok) continue;

        const json: NewsApiResponse = await res.json();
        if (json.status !== 'ok') continue;

        for (const a of json.articles ?? []) {
          if (!a.url || seen.has(a.url)) continue;
          seen.add(a.url);
          articles.push({
            url: a.url,
            title: a.title ?? '',
            published_at: a.publishedAt ?? null,
            source_country: null,
            language: 'en',
            domain: a.source?.name ?? null,
            connector: 'newsapi',
            confidence_tier: 2,
          });
        }

        await this.delay(1000); // NewsAPI rate limit: 100 req/day on free tier
      } catch {
        // continue on per-query errors
      }
    }

    return articles;
  }
}

import { getConnectorConfigs, markConnectorRunComplete, createIngestLog, updateIngestLog } from '../db/queries';
import { getConnectorByName } from '../connectors';
import { extractDealsFromArticles } from '../llm/analyze';
import { upsertSource } from '../db/queries';
import { ingestCandidate, type IngestSourceRef } from './ingestCandidate';
import type { IngestResult, RawArticle, DealCandidate } from '../types';

export interface RunOptions {
  connectorNames?: string[]; // if omitted, runs all enabled
  lookbackDays?: number;
  skipLlm?: boolean;
}

export async function runIngestionPipeline(opts: RunOptions = {}): Promise<IngestResult[]> {
  const configs = await getConnectorConfigs();
  const enabledConfigs = configs.filter((c) =>
    c.enabled && (opts.connectorNames ? opts.connectorNames.includes(c.name) : true)
  );

  const results: IngestResult[] = [];

  for (const config of enabledConfigs) {
    const connector = getConnectorByName(config.name);
    if (!connector || !connector.isAvailable()) continue;

    const logId = await createIngestLog(config.name);
    const t0 = Date.now();
    let dealsCreated = 0;
    let dealsUpdated = 0;
    let dealsFound = 0;

    try {
      // 1. Fetch raw articles
      const articles: RawArticle[] = await connector.fetchArticles({
        lookbackDays: opts.lookbackDays ?? 7,
      });

      // 2. Persist all sources first (for auditability regardless of LLM result)
      const sourcesByUrl = new Map<string, IngestSourceRef>();
      for (const article of articles) {
        try {
          const source = await upsertSource({
            url: article.url,
            title: article.title || null,
            published_at: article.published_at,
            connector: article.connector,
            confidence_tier: article.confidence_tier,
          });
          sourcesByUrl.set(article.url, {
            id: source.id,
            url: article.url,
            title: article.title || null,
            published_at: article.published_at,
          });
        } catch {
          // skip duplicate or errored source
        }
      }

      if (opts.skipLlm) {
        await updateIngestLog(logId, {
          status: 'success',
          deals_found: 0,
          deals_created: 0,
          deals_updated: 0,
        });
        results.push(connector.buildResult(0, 0, 0, Date.now() - t0));
        continue;
      }

      // 3. LLM: extract deal candidates from article titles
      const candidates: DealCandidate[] = await extractDealsFromArticles(articles);
      dealsFound = candidates.length;

      // 4. Process each candidate through the shared running-tab pipeline.
      // Collect (don't swallow) per-candidate failures — a vanished deal with
      // no trace is undebuggable.
      const candidateErrors: string[] = [];
      for (const candidate of candidates) {
        try {
          const outcome = await ingestCandidate(candidate, {
            sourcesByUrl,
            sourceConfidenceTier: 2,
            generateSummaries: true,
          });
          if (outcome === 'created') dealsCreated++;
          else if (outcome === 'updated') dealsUpdated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          candidateErrors.push(`${candidate.title || 'untitled'}: ${msg}`.slice(0, 200));
        }
      }

      await markConnectorRunComplete(config.name);
      await updateIngestLog(logId, {
        status: 'success',
        deals_found: dealsFound,
        deals_created: dealsCreated,
        deals_updated: dealsUpdated,
        ...(candidateErrors.length > 0
          ? { metadata: { candidate_errors: candidateErrors.slice(0, 12) } }
          : {}),
      });

      results.push(connector.buildResult(dealsFound, dealsCreated, dealsUpdated, Date.now() - t0));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateIngestLog(logId, { status: 'error', error_message: message });
      results.push(connector.buildResult(dealsFound, dealsCreated, dealsUpdated, Date.now() - t0, message));
    }
  }

  return results;
}

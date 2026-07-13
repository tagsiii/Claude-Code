import type { RawArticle, DealCandidate, IngestResult } from '../types';

export interface ConnectorOptions {
  lookbackDays?: number;
}

export abstract class BaseConnector {
  abstract readonly name: string;
  abstract readonly displayName: string;

  abstract isAvailable(): boolean;
  abstract fetchArticles(opts: ConnectorOptions): Promise<RawArticle[]>;

  // Non-fatal problems from the last fetch (e.g. one of several queries was
  // rejected). Runner records these in the ingest log so a partially-broken
  // net is visible instead of silently shrinking coverage.
  protected warnings: string[] = [];
  getWarnings(): string[] {
    return this.warnings;
  }

  protected delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  buildResult(
    found: number,
    created: number,
    updated: number,
    durationMs: number,
    error?: string
  ): IngestResult {
    return {
      connector: this.name,
      deals_found: found,
      deals_created: created,
      deals_updated: updated,
      duration_ms: durationMs,
      error,
    };
  }
}

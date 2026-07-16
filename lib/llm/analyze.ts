import { callClaude, isLlmAvailable } from './client';
import {
  DEAL_EXTRACTION_SYSTEM,
  DEAL_SUMMARY_SYSTEM,
  DEAL_ENRICHMENT_SYSTEM,
  DOCUMENT_EXTRACTION_SYSTEM,
  buildExtractionPrompt,
  buildSummaryPrompt,
  buildEnrichmentPrompt,
  buildDocumentExtractionPrompt,
} from './prompts';
import type { RawArticle, DealCandidate } from '../types';

const BATCH_SIZE = 60; // articles per LLM call
const DOC_CHUNK_CHARS = 12000; // ~3k tokens of document text per LLM call
const MAX_DOC_CHUNKS = 8; // cap cost/time on very large documents

export interface ExtractionResult {
  candidates: DealCandidate[];
  // Non-fatal LLM/batch failures — surfaced in the ingest log so a scan that
  // partially failed is distinguishable from a genuinely quiet news cycle.
  errors: string[];
}

export async function extractDealsFromArticles(
  articles: RawArticle[]
): Promise<ExtractionResult> {
  if (!isLlmAvailable() || articles.length === 0) return { candidates: [], errors: [] };

  const allCandidates: DealCandidate[] = [];
  const errors: string[] = [];
  let batchCount = 0;

  // Process in batches to stay within token limits
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    batchCount++;
    try {
      const prompt = buildExtractionPrompt(batch);
      const response = await callClaude(DEAL_EXTRACTION_SYSTEM, prompt, 8000);

      const parsed = parseJsonSafely<DealCandidate[]>(response);
      if (Array.isArray(parsed)) {
        // Attach source URLs from the batch for each candidate
        for (const candidate of parsed) {
          // Resolve source URLs: the LLM cites URLs from the batch
          const validUrls = (candidate.source_urls ?? []).filter((url: string) =>
            batch.some((a) => a.url === url)
          );
          candidate.source_urls = validUrls.length > 0
            ? validUrls
            : batch.slice(0, 2).map((a) => a.url); // fallback to first 2 in batch
          allCandidates.push(candidate);
        }
      } else {
        errors.push(`batch ${batchCount}: LLM returned unparseable output`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`batch ${batchCount}: ${msg}`.slice(0, 200));
    }

    // Avoid hammering the API between batches
    if (i + BATCH_SIZE < articles.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // If EVERY batch failed, the scan didn't observe a quiet world — it broke.
  // Fail loudly so the run is marked as an error, not "0 deals found".
  if (allCandidates.length === 0 && errors.length === batchCount && batchCount > 0) {
    throw new Error(`AI extraction failed for all ${batchCount} batch(es) — ${errors[0]}`);
  }

  return { candidates: allCandidates, errors };
}

// Extract deal candidates from a full uploaded document's text.
// Chunks large documents and de-duplicates candidates by title across chunks.
export async function extractDealsFromDocument(
  filename: string,
  text: string,
  notes?: string | null
): Promise<ExtractionResult> {
  if (!isLlmAvailable() || !text.trim()) return { candidates: [], errors: [] };

  const chunks = chunkText(text, DOC_CHUNK_CHARS).slice(0, MAX_DOC_CHUNKS);
  const bySignature = new Map<string, DealCandidate>();
  const errors: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const prompt = buildDocumentExtractionPrompt(filename, chunks[i], notes, {
        index: i + 1,
        total: chunks.length,
      });
      const response = await callClaude(DOCUMENT_EXTRACTION_SYSTEM, prompt, 8000);
      const parsed = parseJsonSafely<DealCandidate[]>(response);
      if (Array.isArray(parsed)) {
        for (const candidate of parsed) {
          if (!candidate?.title || !candidate?.sector) continue;
          candidate.source_urls = []; // the document itself is the source
          const sig = `${candidate.title.toLowerCase().trim()}|${candidate.host_country ?? ''}`;
          if (!bySignature.has(sig)) bySignature.set(sig, candidate);
        }
      } else {
        errors.push(`chunk ${i + 1}/${chunks.length}: LLM returned unparseable output`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`chunk ${i + 1}/${chunks.length}: ${msg}`.slice(0, 200));
    }
    if (i + 1 < chunks.length) await new Promise((r) => setTimeout(r, 1500));
  }

  if (bySignature.size === 0 && errors.length === chunks.length && chunks.length > 0) {
    throw new Error(`AI extraction failed for all ${chunks.length} chunk(s) — ${errors[0]}`);
  }

  return { candidates: [...bySignature.values()], errors };
}

function chunkText(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const chunks: string[] = [];
  // Prefer to break on paragraph boundaries near the chunk size.
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const nl = text.lastIndexOf('\n', end);
      if (nl > start + size * 0.5) end = nl;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

// Read the full text of source article(s) about ONE deal and extract concrete
// facts (sponsors, values, stage, countries) as a candidate-shaped object that
// merges onto the deal through the standard running-tab path.
export async function extractDealFacts(
  dealTitle: string,
  articles: Array<{ url: string; text: string }>
): Promise<Partial<DealCandidate> | null> {
  if (!isLlmAvailable() || articles.length === 0) return null;
  try {
    const prompt = buildEnrichmentPrompt(dealTitle, articles);
    const response = await callClaude(DEAL_ENRICHMENT_SYSTEM, prompt, 2048);
    return parseJsonSafely<Partial<DealCandidate>>(response);
  } catch {
    return null; // enrichment is best-effort
  }
}

export async function generateDealSummary(
  dealTitle: string,
  hostCountry: string,
  sponsoringState: string | null,
  sector: string,
  sources: Array<{ url: string; title: string | null; published_at: string | null; excerpt?: string | null }>
): Promise<{ executive_summary: string; us_diplomatic_context: string } | null> {
  if (!isLlmAvailable() || sources.length === 0) return null;

  try {
    const prompt = buildSummaryPrompt(dealTitle, hostCountry, sponsoringState, sector, sources);
    const response = await callClaude(DEAL_SUMMARY_SYSTEM, prompt, 2048);
    const parsed = parseJsonSafely<{ executive_summary: string; us_diplomatic_context: string }>(response);
    if (parsed?.executive_summary && parsed?.us_diplomatic_context) return parsed;
  } catch {
    // fall through
  }
  return null;
}

export async function inferLifecycleStage(
  dealTitle: string,
  articleTitles: string[],
  currentStage: string
): Promise<{ stage: string; reasoning: string } | null> {
  if (!isLlmAvailable()) return null;

  const systemPrompt = `You are an economic statecraft analyst. Infer the most likely current lifecycle stage of a cross-border infrastructure deal based on article titles and the typical progression of such deals.

Lifecycle stages (in order):
- rumored: Speculation, analyst commentary, no official confirmation
- exploratory_mou: Feasibility studies, MOU signed, official talks announced
- negotiation: Active contract negotiation, terms being finalized
- signed: Contract/agreement formally signed
- financing_secured: Loan agreement signed, funds committed by lender
- under_construction: Construction/implementation actively underway
- completed: Project complete and operational
- cancelled: Deal collapsed or officially cancelled

Consider: language used in headlines (e.g., "signs deal" → signed; "breaks ground" → under_construction; "in talks" → negotiation; "eyes deal" → rumored/exploratory). Weight recent articles more heavily.

Return JSON: {"stage": "lifecycle_stage_value", "reasoning": "1-2 sentence explanation citing specific language"}`;

  const userMessage = `Deal: ${dealTitle}
Current stage: ${currentStage}
Recent article titles:
${articleTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  try {
    const response = await callClaude(systemPrompt, userMessage, 512);
    return parseJsonSafely<{ stage: string; reasoning: string }>(response);
  } catch {
    return null;
  }
}

function parseJsonSafely<T>(text: string): T | null {
  try {
    // Strip markdown code blocks if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract JSON array or object from mixed text
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]) as T; } catch { /* ignore */ }
    }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]) as T; } catch { /* ignore */ }
    }
    return null;
  }
}

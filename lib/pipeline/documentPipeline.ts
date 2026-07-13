import { upsertSource, updateDocument, getDocumentById } from '../db/queries';
import { extractDealsFromDocument } from '../llm/analyze';
import { ingestCandidate, type IngestSourceRef } from './ingestCandidate';
import type { DocumentRecord } from '../types';

export interface DocumentAnalysisResult {
  found: number;
  created: number;
  updated: number;
}

// Run an already-parsed uploaded document through the shared running-tab pipeline.
// The document becomes a tier-1 (primary) source, so any deal it corroborates gains
// both a linked source and a corroboration-score boost.
export async function analyzeDocument(docId: string): Promise<DocumentAnalysisResult> {
  const doc = await getDocumentById(docId);
  if (!doc) throw new Error('Document not found');
  if (!doc.parsed_text || !doc.parsed_text.trim()) {
    throw new Error('Document has no extracted text to analyze');
  }

  await updateDocument(doc.id, { status: 'analyzing', error_message: null });

  try {
    // Ensure the document has a backing source row (idempotent on synthetic URL).
    const source = await upsertSource({
      url: `upload://${doc.id}`,
      title: doc.filename,
      published_at: doc.created_at,
      connector: 'upload',
      confidence_tier: 1, // analyst-provided primary material
    });
    const pinned: IngestSourceRef = {
      id: source.id,
      url: source.url,
      title: doc.filename,
      published_at: doc.created_at,
    };
    if (doc.source_id !== source.id) {
      await updateDocument(doc.id, { source_id: source.id });
    }

    const candidates = await extractDealsFromDocument(doc.filename, doc.parsed_text, doc.notes);

    let created = 0;
    let updated = 0;
    for (const candidate of candidates) {
      try {
        const outcome = await ingestCandidate(candidate, {
          pinnedSources: [pinned],
          sourceConfidenceTier: 1,
          generateSummaries: true,
        });
        if (outcome === 'created') created++;
        else if (outcome === 'updated') updated++;
      } catch {
        // skip failed candidate
      }
    }

    const result: DocumentAnalysisResult = { found: candidates.length, created, updated };
    await updateDocument(doc.id, {
      status: 'analyzed',
      deals_found: result.found,
      deals_created: result.created,
      deals_updated: result.updated,
      analyzed_at: new Date().toISOString(),
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateDocument(doc.id, { status: 'error', error_message: message });
    throw err;
  }
}

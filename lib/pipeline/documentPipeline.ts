import {
  upsertSource,
  updateDocument,
  getDocumentById,
  createIngestLog,
  updateIngestLog,
} from '../db/queries';
import { extractDealsFromDocument } from '../llm/analyze';
import { ingestCandidate, type IngestSourceRef } from './ingestCandidate';

export interface DocumentAnalysisResult {
  found: number;
  created: number;
  updated: number;
  failed: number;
}

// Run an already-parsed uploaded document through the shared running-tab pipeline.
// The document becomes a tier-1 (primary) source, so any deal it corroborates gains
// both a linked source and a corroboration-score boost. Each analysis also writes an
// ingest_logs entry (connector: 'upload') so it appears in Pipeline History with any
// per-candidate failures recorded in metadata — nothing fails silently.
export async function analyzeDocument(docId: string): Promise<DocumentAnalysisResult> {
  const doc = await getDocumentById(docId);
  if (!doc) throw new Error('Document not found');
  if (!doc.parsed_text || !doc.parsed_text.trim()) {
    throw new Error('Document has no extracted text to analyze');
  }

  await updateDocument(doc.id, { status: 'analyzing', error_message: null });
  const logId = await createIngestLog('upload');

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
    const candidateErrors: string[] = [];
    for (const candidate of candidates) {
      try {
        const outcome = await ingestCandidate(candidate, {
          pinnedSources: [pinned],
          sourceConfidenceTier: 1,
          generateSummaries: true,
        });
        if (outcome === 'created') created++;
        else if (outcome === 'updated') updated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        candidateErrors.push(`${candidate.title || 'untitled'}: ${msg}`.slice(0, 200));
      }
    }

    const result: DocumentAnalysisResult = {
      found: candidates.length,
      created,
      updated,
      failed: candidateErrors.length,
    };

    await updateIngestLog(logId, {
      status: 'success',
      deals_found: result.found,
      deals_created: created,
      deals_updated: updated,
      metadata: {
        document_id: doc.id,
        filename: doc.filename,
        ...(candidateErrors.length > 0 ? { candidate_errors: candidateErrors.slice(0, 12) } : {}),
      },
    });

    await updateDocument(doc.id, {
      status: 'analyzed',
      deals_found: result.found,
      deals_created: result.created,
      deals_updated: result.updated,
      analyzed_at: new Date().toISOString(),
      error_message:
        candidateErrors.length > 0
          ? `${candidateErrors.length} of ${candidates.length} candidates failed — see Config → Pipeline History`
          : null,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateIngestLog(logId, {
      status: 'error',
      error_message: message,
      metadata: { document_id: docId },
    });
    await updateDocument(doc.id, { status: 'error', error_message: message });
    throw err;
  }
}

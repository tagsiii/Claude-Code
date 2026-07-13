import { DocumentUploadPanel } from '@/components/DocumentUploadPanel';
import { isLlmAvailable } from '@/lib/llm/client';

export const dynamic = 'force-dynamic';

export default function DocumentsPage() {
  const llmAvailable = isLlmAvailable();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Documents</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload Word, Excel, PDF, or text files. Each document is parsed, then fed through the same
          extraction pipeline as the news connectors — creating new deals or enriching existing ones as a
          tier-1 (primary) source.
        </p>
      </div>

      {!llmAvailable && (
        <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-3 text-yellow-300 text-sm">
          <span className="font-semibold">⚠ ANTHROPIC_API_KEY not set</span>
          <span className="text-yellow-500"> — you can upload and store files, but the Analyze step needs the API key to extract deals.</span>
        </div>
      )}

      <DocumentUploadPanel />
    </div>
  );
}

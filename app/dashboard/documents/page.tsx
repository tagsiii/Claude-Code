import { DocumentUploadPanel } from '@/components/DocumentUploadPanel';
import { isLlmAvailable } from '@/lib/llm/client';

export const dynamic = 'force-dynamic';

export default function DocumentsPage() {
  const llmAvailable = isLlmAvailable();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload Word, Excel, PDF, or text files. Each document is parsed, then fed through the same
          extraction pipeline as the news connectors — creating new deals or enriching existing ones as a
          tier-1 (primary) source.
        </p>
      </div>

      {!llmAvailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="font-semibold">ANTHROPIC_API_KEY not set</span>
          <span className="opacity-80"> — you can upload and store files, but the Analyze step needs the API key to extract deals.</span>
        </div>
      )}

      <DocumentUploadPanel />
    </div>
  );
}

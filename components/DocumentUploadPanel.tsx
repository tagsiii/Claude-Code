'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DocRow {
  id: string;
  filename: string;
  kind: string;
  byte_size: number;
  status: string;
  error_message: string | null;
  char_count: number;
  page_count: number | null;
  deals_found: number;
  deals_created: number;
  deals_updated: number;
  created_at: string;
  analyzed_at: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  uploaded: 'bg-secondary text-muted-foreground',
  parsing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  parsed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  analyzing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  analyzed: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const KIND_ICON: Record<string, string> = {
  word: '📄',
  excel: '📊',
  pdf: '📕',
  csv: '📈',
  text: '📝',
  other: '📎',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentUploadPanel() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh while any document is still parsing or analyzing, so the status
  // flips to 'analyzed' / 'error' on its own when the server finishes — no reload needed.
  useEffect(() => {
    const inProgress = docs.some((d) => d.status === 'analyzing' || d.status === 'parsing');
    if (!inProgress) return;
    const timer = setInterval(() => {
      void load();
    }, 4000);
    return () => clearInterval(timer);
  }, [docs, load]);

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (notes.trim()) fd.append('notes', notes.trim());
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (data.error) setError(`Stored, but parsing failed: ${data.error}`);
      setNotes('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((f) => void upload(f));
  }

  async function analyze(id: string) {
    setBusyId(id);
    setError('');
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, status: 'analyzing' } : x)));
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      await load();
      router.refresh(); // refresh dashboard deal counts
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function download(id: string) {
    const res = await fetch(`/api/documents/${id}`);
    const data = await res.json();
    if (data.url) window.open(data.url, '_blank');
  }

  async function remove(id: string) {
    if (!confirm('Delete this document and its stored file? Deals it created will remain.')) return;
    setBusyId(id);
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50 bg-card'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="text-3xl mb-2 text-muted-foreground">⬆</div>
        <p className="text-foreground font-medium text-sm">
          {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
        </p>
        <p className="text-muted-foreground text-xs mt-1">Word, Excel, PDF, CSV, or text — up to 25 MB each</p>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Optional note (context passed to the analyzer)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Internal briefing on Sri Lanka port financing"
          className="mt-1 w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
        />
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">{error}</div>}

      {/* Document list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Uploaded documents {docs.length > 0 && <span className="text-muted-foreground">({docs.length})</span>}
        </h3>
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center border border-border rounded-xl">
            No documents yet. Upload a file to feed it into the transaction tracker.
          </div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 shadow-card"
            >
              <span className="text-xl shrink-0">{KIND_ICON[d.kind] ?? '📎'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-medium truncate">{d.filename}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[d.status] ?? 'bg-secondary text-muted-foreground'} ${
                      d.status === 'analyzing' || d.status === 'parsing' ? 'animate-pulse' : ''
                    }`}
                  >
                    {d.status === 'analyzing' ? 'analyzing…' : d.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatBytes(d.byte_size)}
                  {d.page_count ? ` · ${d.page_count} pg` : ''}
                  {d.char_count ? ` · ${d.char_count.toLocaleString()} chars` : ''}
                  {d.status === 'analyzed' && (
                    <span className="text-[hsl(var(--success))]">
                      {' '}· {d.deals_created} new, {d.deals_updated} updated ({d.deals_found} found)
                    </span>
                  )}
                  {d.error_message && <span className="text-destructive"> · {d.error_message.slice(0, 60)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {['parsed', 'analyzed', 'error', 'analyzing'].includes(d.status) && (
                  <button
                    onClick={() => analyze(d.id)}
                    disabled={busyId === d.id || d.status === 'analyzing'}
                    className="text-xs px-3 py-1 rounded-full bg-primary hover:opacity-90 text-primary-foreground font-medium disabled:opacity-50 transition-opacity"
                  >
                    {busyId === d.id || d.status === 'analyzing' ? '…' : d.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                  </button>
                )}
                <button
                  onClick={() => download(d.id)}
                  className="text-xs w-7 h-7 rounded-full bg-secondary hover:bg-border text-foreground transition-colors"
                  title="Download original"
                >
                  ↓
                </button>
                <button
                  onClick={() => remove(d.id)}
                  disabled={busyId === d.id}
                  className="text-xs w-7 h-7 rounded-full bg-secondary hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

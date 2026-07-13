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
  uploaded: 'bg-slate-700 text-slate-300',
  parsing: 'bg-blue-900 text-blue-300',
  parsed: 'bg-indigo-900 text-indigo-300',
  analyzing: 'bg-blue-900 text-blue-300',
  analyzed: 'bg-green-900 text-green-300',
  error: 'bg-red-900 text-red-300',
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
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-950/40' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
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
        <div className="text-3xl mb-2">⬆</div>
        <p className="text-slate-200 font-medium text-sm">
          {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
        </p>
        <p className="text-slate-500 text-xs mt-1">Word, Excel, PDF, CSV, or text — up to 25 MB each</p>
      </div>

      <div>
        <label className="text-xs text-slate-500">Optional note (context passed to the analyzer)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Internal briefing on Sri Lanka port financing"
          className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      {error && <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</div>}

      {/* Document list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">
          Uploaded documents {docs.length > 0 && <span className="text-slate-600">({docs.length})</span>}
        </h3>
        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="text-slate-600 text-sm py-6 text-center border border-slate-800 rounded-lg">
            No documents yet. Upload a file to feed it into the transaction tracker.
          </div>
        ) : (
          docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3"
            >
              <span className="text-xl shrink-0">{KIND_ICON[d.kind] ?? '📎'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-200 text-sm font-medium truncate">{d.filename}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[d.status] ?? 'bg-slate-700 text-slate-300'}`}>
                    {d.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {formatBytes(d.byte_size)}
                  {d.page_count ? ` · ${d.page_count} pg` : ''}
                  {d.char_count ? ` · ${d.char_count.toLocaleString()} chars` : ''}
                  {d.status === 'analyzed' && (
                    <span className="text-green-500">
                      {' '}· {d.deals_created} new, {d.deals_updated} updated ({d.deals_found} found)
                    </span>
                  )}
                  {d.error_message && <span className="text-red-500"> · {d.error_message.slice(0, 60)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {['parsed', 'analyzed', 'error', 'analyzing'].includes(d.status) && (
                  <button
                    onClick={() => analyze(d.id)}
                    disabled={busyId === d.id || d.status === 'analyzing'}
                    className="text-xs px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
                  >
                    {busyId === d.id || d.status === 'analyzing' ? '…' : d.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                  </button>
                )}
                <button
                  onClick={() => download(d.id)}
                  className="text-xs px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Download original"
                >
                  ↓
                </button>
                <button
                  onClick={() => remove(d.id)}
                  disabled={busyId === d.id}
                  className="text-xs px-2 py-1 rounded-md bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-red-300 disabled:opacity-50"
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

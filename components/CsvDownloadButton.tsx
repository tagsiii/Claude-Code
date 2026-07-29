'use client';

// Client-side CSV download for the Gaps tables — the rows are already on the
// page, so no extra API round-trip is needed.

interface Props {
  filename: string;
  csv: string;
}

export function CsvDownloadButton({ filename, csv }: Props) {
  function download() {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      onClick={download}
      className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1 hover:bg-secondary transition-colors"
    >
      Export CSV
    </button>
  );
}

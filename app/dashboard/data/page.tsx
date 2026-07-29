import { DataBrowser } from '@/components/DataBrowser';

export const dynamic = 'force-dynamic';

// Raw-data browser: every dataset behind the app, in a filterable grid.
export default function DataPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Data</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse every dataset behind the monitor. Click a column to sort, type in the boxes
          under headers to filter (numbers accept <code className="font-mono">&gt;5</code>,{' '}
          <code className="font-mono">&lt;100</code>, <code className="font-mono">5..100</code>),
          and export the filtered view as CSV.
        </p>
      </div>
      <DataBrowser />
    </div>
  );
}

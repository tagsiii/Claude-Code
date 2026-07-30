'use client';

// Approve/Reject controls for deals in the review queue. Rejection keeps the
// row (hidden) so re-reported junk dedupes against it instead of returning.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReviewPanel({ dealId, note }: { dealId: string; note?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState('');

  async function decide(status: 'approved' | 'rejected') {
    setBusy(status);
    setError('');
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: status }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      router.push('/dashboard?review=pending');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(null);
    }
  }

  return (
    <div className="card p-5 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
      <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-2">
        Awaiting Review
      </div>
      <p className="text-sm text-foreground/85 mb-3">
        {note
          ? note
          : 'This deal entered the queue because its evidence is thin (single outlet, low quality grade). Approve to add it to the main table; reject to hide it — rejected deals also block re-reported copies.'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => decide('approved')}
          disabled={busy !== null}
          className="text-sm px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy === 'approved' ? 'Approving…' : 'Approve'}
        </button>
        <button
          onClick={() => decide('rejected')}
          disabled={busy !== null}
          className="text-sm px-4 py-2 rounded-full border border-border text-foreground font-medium hover:bg-secondary disabled:opacity-50"
        >
          {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
      {error && <div className="text-xs text-destructive mt-2">{error}</div>}
    </div>
  );
}

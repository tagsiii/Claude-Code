'use client';

// Manual field editing for a deal. Edits are provenance-stamped as
// "manual edit", rescored, and logged on the timeline.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Deal } from '@/lib/types';

const SECTORS = ['strategic_infrastructure', 'digital_connectivity', 'energy', 'cybersecurity', 'other'];
const STAGES = ['rumored', 'exploratory_mou', 'negotiation', 'signed', 'financing_secured', 'under_construction', 'completed', 'cancelled'];
const REGIONS = ['Africa', 'South Asia', 'Southeast Asia', 'Central Asia', 'Pacific', 'Latin America', 'MENA', 'Europe', 'Other'];

export function EditDealPanel({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({
    title: deal.title ?? '',
    host_country: deal.host_country ?? '',
    host_region: deal.host_region ?? '',
    sponsoring_state: deal.sponsoring_state ?? '',
    sector: deal.sector ?? 'other',
    subsector: deal.subsector ?? '',
    lifecycle_stage: deal.lifecycle_stage ?? 'rumored',
    rom_value_usd: deal.rom_value_usd != null ? String(deal.rom_value_usd) : '',
    is_confirmed: deal.is_confirmed ?? false,
    status: deal.status ?? 'active',
  });

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      const value = form.rom_value_usd.replace(/[,$\s]/g, '');
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ...form,
            rom_value_usd: value ? Number(value) : null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setMsg(data.changed?.length ? `✓ Saved: ${data.changed.join(', ')}` : 'No changes');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setMsg(`⚠ ${e instanceof Error ? e.message : 'Save failed'}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          ✎ Edit deal
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    );
  }

  const label = 'text-xs text-muted-foreground';
  const input =
    'w-full bg-secondary/60 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40';

  return (
    <div className="card p-5 space-y-3 w-full">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit Deal</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <div className={label}>Title</div>
          <input className={input} value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div>
          <div className={label}>Host country</div>
          <input className={input} value={form.host_country} onChange={(e) => set('host_country', e.target.value)} />
        </div>
        <div>
          <div className={label}>Region</div>
          <select className={input} value={form.host_region} onChange={(e) => set('host_region', e.target.value)}>
            <option value="">—</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <div className={label}>Sponsoring state</div>
          <input className={input} value={form.sponsoring_state} onChange={(e) => set('sponsoring_state', e.target.value)} />
        </div>
        <div>
          <div className={label}>Sector</div>
          <select className={input} value={form.sector} onChange={(e) => set('sector', e.target.value)}>
            {SECTORS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <div className={label}>Subsector</div>
          <input className={input} value={form.subsector} onChange={(e) => set('subsector', e.target.value)} />
        </div>
        <div>
          <div className={label}>Stage</div>
          <select className={input} value={form.lifecycle_stage} onChange={(e) => set('lifecycle_stage', e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <div className={label}>Value (USD)</div>
          <input className={input} placeholder="e.g. 1200000000" value={form.rom_value_usd} onChange={(e) => set('rom_value_usd', e.target.value)} />
        </div>
        <div className="flex items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.is_confirmed} onChange={(e) => set('is_confirmed', e.target.checked)} />
            Confirmed
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.status === 'archived'} onChange={(e) => set('status', e.target.checked ? 'archived' : 'active')} />
            Archive (hide from all views)
          </label>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void save()}
          disabled={busy}
          className="text-sm px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-sm px-4 py-2 rounded-full border border-border text-foreground hover:bg-secondary"
        >
          Cancel
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Edits are recorded on the timeline, stamped as manual provenance, and the score recalculates.
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';

// Config-page card: shows whether email is configured and sends a test brief.
export function EmailTestPanel({ configured }: { configured: boolean }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  async function sendTest() {
    setSending(true);
    setResult('');
    try {
      const res = await fetch('/api/email/send', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setResult(
          `✓ Sent to ${data.sent_to} — ${data.deal_count} deal(s)` +
            (data.white_space_changes ? `, ${data.white_space_changes} white-space change(s)` : '')
        );
      } else {
        setResult(`⚠ ${data.reason ?? data.error ?? 'Send failed'}`);
      }
    } catch {
      setResult('⚠ Request failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Daily email brief</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {configured
            ? 'Email is configured. The brief sends automatically at 06:00 UTC once deployed; use the button to send one now.'
            : 'Not configured — add RESEND_API_KEY and EMAIL_TO to .env.local, then restart the app.'}
        </p>
      </div>
      <button
        onClick={sendTest}
        disabled={sending || !configured}
        className="text-sm px-4 py-2 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {sending ? 'Sending…' : 'Send test brief'}
      </button>
      {result && <div className="text-xs text-muted-foreground">{result}</div>}
    </div>
  );
}

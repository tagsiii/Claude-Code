'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/utils/format';

// Relative times drift between server render and client hydration ("39m ago" on
// the server vs "40m ago" a minute later on the client), which React reports as
// a hydration mismatch. Suppress the warning for this one text node, re-render
// on mount with the client clock, and tick every minute so it stays fresh.
export function TimeAgo({ iso }: { iso: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    setTick(1);
    const timer = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatRelativeTime(iso)}
    </time>
  );
}

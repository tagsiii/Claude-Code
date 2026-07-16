'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Next.js's client router serves cached page payloads on navigation (including
// prefetched ones), which can show stale data — empty pipeline history, missing
// new deals — until a hard refresh. This re-fetches server data on every route
// change and whenever the tab regains focus, so pages are always current.
export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    router.refresh();
  }, [pathname, router]);

  useEffect(() => {
    const onFocus = () => router.refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}

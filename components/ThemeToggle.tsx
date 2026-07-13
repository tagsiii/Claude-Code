'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const ORDER: Theme[] = ['system', 'light', 'dark'];

function apply(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as Theme | null) ?? 'system';
    setTheme(saved);
    setMounted(true);
  }, []);

  // Keep 'system' in sync with OS changes while selected.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    localStorage.setItem('theme', next);
    apply(next);
  }

  // Avoid hydration mismatch — render a stable placeholder until mounted.
  const label = !mounted ? '·' : theme === 'system' ? '◐' : theme === 'light' ? '☀' : '☾';

  return (
    <button
      onClick={cycle}
      title={`Theme: ${theme} (click to change)`}
      aria-label={`Theme: ${theme}. Click to change.`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm"
    >
      {label}
    </button>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'D' },
  { href: '/weekly', label: 'Weekly Schedule', icon: 'W' },
  { href: '/builder', label: 'Schedule Builder', icon: 'B' },
  { href: '/roster', label: 'Crew Roster', icon: 'R' },
  { href: '/qualifications', label: 'Qualifications', icon: 'Q' },
  { href: '/dashboard', label: 'Readiness', icon: 'X' },
  { href: '/training', label: 'Training Tracker', icon: 'T' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen flex-shrink-0" style={{ background: '#001f3f' }}>
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-bold text-white tracking-wide">NavSked</h1>
        <p className="text-xs mt-1" style={{ color: '#C5A648' }}>
          Flight Schedule Manager
        </p>
      </div>
      <nav className="mt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-white/15 text-white border-l-3 border-amber-400'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white border-l-3 border-transparent'
              }`}
            >
              <span
                className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold ${
                  isActive ? 'bg-amber-500 text-navy-900' : 'bg-white/10 text-gray-300'
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="absolute bottom-0 left-0 w-56 p-4 border-t border-white/10">
        <p className="text-xs text-gray-400">VP-10 Red Lancers</p>
        <p className="text-xs text-gray-500">NAS Jacksonville</p>
      </div>
    </aside>
  );
}

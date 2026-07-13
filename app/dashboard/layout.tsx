import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-[#070d18]">
      {/* Top nav */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-slow" />
              <span className="text-green-400 text-xs font-mono tracking-widest">LIVE</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <Link href="/dashboard" className="text-slate-100 font-semibold text-sm tracking-tight">
              Economic Statecraft Monitor
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/documents"
              className="text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
            >
              Documents
            </Link>
            <Link
              href="/dashboard/config"
              className="text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
            >
              Config
            </Link>
            <span className="text-slate-600 text-xs hidden sm:block">{session.user?.email}</span>
            <SignOutButton />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}

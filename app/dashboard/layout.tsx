import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from '@/components/SignOutButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AutoRefresh } from '@/components/AutoRefresh';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-background">
      <AutoRefresh />
      {/* Top nav — frosted material */}
      <nav className="material sticky top-0 z-50 border-b border-border">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="font-semibold text-[15px] tracking-tight text-foreground">
              Economic Statecraft Monitor
            </Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <NavLink href="/dashboard/activity">Activity</NavLink>
            <NavLink href="/dashboard/documents">Documents</NavLink>
            <NavLink href="/dashboard/config">Config</NavLink>
            <div className="mx-1 h-5 w-px bg-border hidden sm:block" />
            <ThemeToggle />
            <span className="text-muted-foreground text-xs hidden md:block ml-1">{session.user?.email}</span>
            <SignOutButton />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-secondary transition-colors"
    >
      {children}
    </Link>
  );
}

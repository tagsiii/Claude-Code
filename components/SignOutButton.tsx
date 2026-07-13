'use client';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-muted-foreground hover:text-foreground text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-secondary transition-colors"
    >
      Sign out
    </button>
  );
}

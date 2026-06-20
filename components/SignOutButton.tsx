'use client';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
    >
      Sign out
    </button>
  );
}

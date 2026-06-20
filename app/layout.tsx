import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Economic Statecraft Monitor',
  description: 'Live tracking of state-backed cross-border economic transactions',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

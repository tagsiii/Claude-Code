import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Economic Statecraft Monitor',
  description: 'Live tracking of state-backed cross-border economic transactions',
  robots: { index: false, follow: false },
};

// Applied before paint to avoid a flash of the wrong theme. Reads the saved
// preference ('light' | 'dark' | 'system'); 'system' follows the OS setting.
const themeScript = `
(function(){try{
  var t = localStorage.getItem('theme');
  var dark = t === 'dark' || ((!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

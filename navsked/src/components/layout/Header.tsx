'use client';

export default function Header() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="h-12 flex items-center justify-between px-6 border-b" style={{ borderColor: '#dee2e6', background: '#ffffff' }}>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-600">{today}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs px-2 py-1 rounded font-medium" style={{ background: '#001f3f', color: '#C5A648' }}>
          INTERMEDIATE PHASE (R+8)
        </span>
        <span className="text-sm text-gray-600">OPSO View</span>
      </div>
    </header>
  );
}

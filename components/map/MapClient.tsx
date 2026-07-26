'use client';

// MapLibre/deck.gl touch the DOM at import time — must never render on the
// server. This thin wrapper exists because `ssr: false` is only allowed in
// client components under the app router.

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="card h-[68vh] min-h-[440px] animate-pulse" />,
});

export function MapClient() {
  return <MapView />;
}

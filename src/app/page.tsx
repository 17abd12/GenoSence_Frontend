'use client';

import dynamic from 'next/dynamic';

// Leaflet must be loaded client-side only (it references window/document)
const MapComponent = dynamic(() => import('./components/DashboardAnalyticsMap'), {
  ssr: false,
  loading: () => (
    <div className="map-loading-placeholder">
      <div className="spinner" />
      <p>Initialising map…</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="page-root">
      <MapComponent />
    </main>
  );
}

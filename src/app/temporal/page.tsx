'use client';
import dynamic from 'next/dynamic';

const TemporalAnalysis = dynamic(() => import('../components/TemporalAnalysis'), {
  ssr: false,
  loading: () => (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#f8fafc', color: '#475569', fontSize: 16 }}>
      <div>Loading Temporal Analysis…</div>
    </div>
  ),
});

export default function TemporalPage() {
  return <TemporalAnalysis />;
}

'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

console.log('Using backend API at:', API);
type AnyRecord = Record<string, unknown>;

function fmt(v: unknown, d = 3): string {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toFixed(d);
}

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setData(null); setError(null);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url]);
  return { data, loading, error };
}

/* ── charts ──────────────────────────────────────────────────── */
function HBar({ data, labelKey, valueKey, color = '#2563eb', title }: {
  data: AnyRecord[]; labelKey: string; valueKey: string; color?: string; title: string;
}) {
  const maxAbs = Math.max(...data.map(d => Math.abs(Number(d[valueKey]) || 0)), 0.001);
  const w = 540, h = Math.max(140, data.length * 26 + 50);
  const pl = 140, pr = 60, pt = 32, pb = 16;
  const uw = w - pl - pr; const uh = h - pt - pb;
  const zero = pl + uw / 2; const lh = uh / Math.max(data.length, 1);
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
      <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{title}</p>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
        <text x={zero} y={pt - 8} textAnchor="middle" fontSize={9} fill="#94a3b8">← Negative | Positive →</text>
        <line x1={zero} y1={pt} x2={zero} y2={h - pb} stroke="#e2e8f0" strokeDasharray="3,3" />
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const bw = (Math.abs(val) / maxAbs) * (uw / 2);
          const y = pt + lh * i + lh * 0.1; const bh = lh * 0.7;
          const barColor = val >= 0 ? '#16a34a' : '#ef4444';
          return (
            <g key={i}>
              <text x={pl - 8} y={y + bh / 2 + 4} textAnchor="end" fontSize={10} fill="#475569">
                {String(d[labelKey]).slice(0, 18)}
              </text>
              <rect x={val >= 0 ? zero : zero - bw} y={y} width={Math.max(2, bw)} height={bh}
                rx={4} fill={barColor} opacity={0.85} />
              <text x={val >= 0 ? zero + bw + 6 : zero - bw - 6} y={y + bh / 2 + 4}
                textAnchor={val >= 0 ? 'start' : 'end'} fontSize={9} fill="#64748b">{fmt(val, 4)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ScatterPred({ data }: { data: AnyRecord[] }) {
  const xs = data.map(d => Number(d.actual_yield) || 0);
  const ys = data.map(d => Number(d.predicted_yield) || 0);
  const allVals = [...xs, ...ys]; const minV = Math.min(...allVals); const maxV = Math.max(...allVals);
  const w = 440, h = 280, pl = 52, pr = 20, pt = 20, pb = 40;
  const uw = w - pl - pr; const uh = h - pt - pb;
  const scX = (v: number) => pl + ((v - minV) / (maxV - minV || 1)) * uw;
  const scY = (v: number) => pt + (1 - (v - minV) / (maxV - minV || 1)) * uh;
  const colorMap: Record<string, string> = { Low: '#f59e0b', Medium: '#14b8a6', High: '#2563eb' };
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
      <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Actual vs Predicted Yield</p>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
        {/* 1:1 line */}
        <line x1={scX(minV)} y1={scY(minV)} x2={scX(maxV)} y2={scY(maxV)} stroke="#e2e8f0" strokeDasharray="4,3" strokeWidth={1.5} />
        <line x1={pl} y1={pt} x2={pl} y2={h - pb} stroke="#94a3b8" />
        <line x1={pl} y1={h - pb} x2={w - pr} y2={h - pb} stroke="#94a3b8" />
        <text x={pl + uw / 2} y={h - 6} textAnchor="middle" fontSize={10} fill="#64748b">Actual Yield</text>
        <text x={pl - 38} y={pt + uh / 2} transform={`rotate(-90 ${pl - 38} ${pt + uh / 2})`} textAnchor="middle" fontSize={10} fill="#64748b">Predicted</text>
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const v = minV + (maxV - minV) * t;
          return (
            <g key={t}>
              <text x={scX(v)} y={h - pb + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{fmt(v, 1)}</text>
              <text x={pl - 6} y={scY(v) + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{fmt(v, 1)}</text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <circle key={i} cx={scX(Number(d.actual_yield))} cy={scY(Number(d.predicted_yield))} r={4}
            fill={colorMap[String(d.Yield_Class)] ?? '#64748b'} opacity={0.82} stroke="#fff" strokeWidth={0.8} />
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b', marginTop: 8 }}>
        {Object.entries(colorMap).map(([k, c]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} />{k}
          </span>
        ))}
      </div>
    </div>
  );
}

function DataTable({ rows, cols, limit = 10 }: { rows: AnyRecord[]; cols: string[]; limit?: number }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rows.length / limit);
  const shown = rows.slice(page * limit, (page + 1) * limit);
  if (!rows.length) return <p style={{ color: '#94a3b8', fontSize: 12 }}>No data</p>;
  const yieldClassColor: Record<string, string> = { High: '#16a34a', Medium: '#d97706', Low: '#dc2626' };
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {cols.map(c => <th key={c} style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, textAlign: 'left', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                {cols.map(c => (
                  <td key={c} style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9', color: c === 'Yield_Class' ? (yieldClassColor[String(row[c])] ?? '#0f172a') : '#0f172a', fontWeight: c === 'Yield_Class' ? 700 : 400 }}>
                    {typeof row[c] === 'number' ? fmt(row[c], 3) : String(row[c] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, justifyContent: 'center', maxWidth: '100%' }}>
          {Array.from({ length: pages }).map((_, p) => (
            <button key={p} onClick={() => setPage(p)} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 6, border: '1px solid', borderColor: page === p ? '#2563eb' : '#e5e7eb', background: page === p ? '#2563eb' : '#fff', color: page === p ? '#fff' : '#374151', cursor: 'pointer' }}>{p + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────── */
function YieldPredictionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [effectiveSessionId, setEffectiveSessionId] = useState<string | null>(sessionId);
  const urlSuffix = effectiveSessionId ? `?session_id=${effectiveSessionId}` : '';

  useEffect(() => {
    if (sessionId) {
      setEffectiveSessionId(sessionId);
      return;
    }

    let cancelled = false;
    const loadLatest = async () => {
      try {
        const res = await fetch(`${API}/user/last-upload/info`, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setEffectiveSessionId(null);
          }
          return;
        }
        const data = await res.json() as { session_id?: string | null };
        if (!cancelled) {
          setEffectiveSessionId(data.session_id ?? null);
        }
      } catch {
        if (!cancelled) {
          setEffectiveSessionId(null);
        }
      }
    };

    loadLatest();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const { data, loading, error } = useFetch<{
    predictions: AnyRecord[];
    feature_importances: AnyRecord[];
    feature_null_summary?: AnyRecord[];
    r2: number | null;
    n_plots: number;
    n_genotypes: number;
    model_used?: string;
    has_actual_yield?: boolean;
    message?: string;
  }>(`${API}/yield-prediction${urlSuffix}`);

  const [filterClass, setFilterClass] = useState<string>('all');

  const allowedYieldClasses = useMemo(() => new Set(['High', 'Medium', 'Low']), []);

  const visiblePredictions = useMemo(() => {
    if (!data?.predictions) return [];
    return data.predictions.filter(row => allowedYieldClasses.has(String(row.Yield_Class)));
  }, [data, allowedYieldClasses]);

  const filteredPredictions = useMemo(() => {
    if (!visiblePredictions.length) return [];
    if (filterClass === 'all') return visiblePredictions;
    return visiblePredictions.filter(r => String(r.Yield_Class) === filterClass);
  }, [filterClass, visiblePredictions]);

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    paddingBottom: 60,
  };

  const cardStyle: React.CSSProperties = {
    background: '#ffffff', borderRadius: 14, padding: 24,
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)', marginBottom: 20,
  };

  return (
    <div style={pageStyle}>
      {/* Topbar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Yield Prediction</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {effectiveSessionId ? `Session: ${effectiveSessionId.slice(0, 8)}…` : 'Sample data'}
              {data?.model_used ? ` · Model: ${data.model_used.startsWith('ols') ? 'OLS Regression' : 'SVR (Combined)'}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push('/')} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#0f172a', padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ← Home
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#64748b', fontSize: 14 }}>Running yield prediction model…</p>
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 20 }}>
            <p style={{ color: '#dc2626', fontWeight: 700 }}>Error: {error}</p>
            <p style={{ color: '#374151', fontSize: 12, marginTop: 8 }}>Make sure the backend is running at {API}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Plots', value: String(data.n_plots ?? data.predictions?.length ?? 0), color: '#16a34a' },
                { label: 'Genotypes', value: String(data.n_genotypes ?? 0), color: '#ea580c' },
                { label: 'Model R²', value: data.r2 !== null ? `${(data.r2 * 100).toFixed(1)}%` : '—', color: '#2563eb' },
                { label: 'Features Used', value: String(data.feature_importances?.length ?? 0), color: '#7c3aed' },
                { label: 'Dataset', value: sessionId ? 'Custom Upload' : 'Sample Data', color: '#d97706' },
              ].map(s => (
                <div key={s.label} style={{ background: '#ffffff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', borderLeft: `4px solid ${s.color}` }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {data.message && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ color: '#92400e', fontSize: 13 }}>{data.message}</p>
              </div>
            )}
            {!data.has_actual_yield && (
              <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <p style={{ color: '#1e40af', fontSize: 13, fontWeight: 600 }}>No Yield column detected</p>
                <p style={{ color: '#1e3a8a', fontSize: 12, marginTop: 4 }}>Predictions are generated using the model, but accuracy (R²) and Actual vs Predicted charts cannot be displayed.</p>
              </div>
            )}

            {data.predictions?.length > 0 && (
              <>
                {/* Charts row */}
                <div style={{ display: 'grid', gridTemplateColumns: data.has_actual_yield ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
                  {data.has_actual_yield && <ScatterPred data={data.predictions} />}
                  {data.feature_importances?.length > 0 && (
                    <HBar data={data.feature_importances.slice(0, 12)} labelKey="feature" valueKey="coefficient"
                      title="Feature Coefficients (normalised)" />
                  )}
                </div>

                {/* Predictions table */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Per-Plot Predictions</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['all', 'High', 'Medium', 'Low'].map(c => (
                        <button key={c} onClick={() => setFilterClass(c)} style={{
                          padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          border: `1px solid ${filterClass === c ? '#2563eb' : '#e5e7eb'}`,
                          background: filterClass === c ? '#2563eb' : '#fff',
                          color: filterClass === c ? '#fff' : '#374151',
                        }}>{c}</button>
                      ))}
                    </div>
                  </div>
                  <DataTable rows={filteredPredictions} cols={['plot_id', 'genotype', 'Yield_Class', 'actual_yield', 'predicted_yield']} />
                </div>

                {/* Bottom Row: Feature Null Summary & Importances */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {data.feature_null_summary && data.feature_null_summary.length > 0 && (
                    <div style={cardStyle}>
                      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Feature Data Quality</h2>
                      <DataTable rows={data.feature_null_summary} cols={['feature', 'null_count', 'null_pct', 'note']} limit={15} />
                      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
                        Features with missing values are filled with column means before prediction.
                      </p>
                    </div>
                  )}

                  {data.feature_importances?.length > 0 && (
                    <div style={cardStyle}>
                      <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Feature Importances (Top 15)</h2>
                      <DataTable rows={data.feature_importances} cols={['feature', 'coefficient']} limit={15} />
                      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
                        {data.model_used?.startsWith('svr') ? 'Absolute feature deviations used as proxy for SVR importance.' : 'Coefficients from normalised OLS regression.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function YieldPredictionPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#f8fafc', color: '#475569', fontSize: 16 }}>
        <div>Loading Yield Prediction…</div>
      </div>
    }>
      <YieldPredictionContent />
    </Suspense>
  );
}

'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

type AnyRecord = Record<string, unknown>;

// ─── tiny helpers ─────────────────────────────────────────────────────────────
function fmt(v: unknown, d = 2): string {
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
    const run = async () => {
      setLoading(true);
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(r.statusText);
        const d: T = await r.json();
        if (!cancelled) { setData(d); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false); }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [url]);
  return { data, loading, error };
}

// ─── SVG bar chart ─────────────────────────────────────────────────────────────
function BarChart({ data, xKey, yKey, colorMap }: {
  data: AnyRecord[]; xKey: string; yKey: string;
  colorMap?: Record<string, string>;
}) {
  const w = 500, h = 240, pad = { l: 50, r: 20, t: 20, b: 90 };
  const uw = w - pad.l - pad.r;
  const uh = h - pad.t - pad.b;
  const maxY = Math.max(...data.map(d => Number(d[yKey]) || 0), 1);
  const bw = (uw / data.length) * 0.65;
  const COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#a855f7', '#ef4444', '#10b981'];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={h - pad.b} stroke="#cbd5e1" />
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#cbd5e1" />
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = pad.t + uh * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.l - 4} y1={y} x2={pad.l} y2={y} stroke="#cbd5e1" />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#64748b">{fmt(maxY * t, 1)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = pad.l + (uw / data.length) * i + (uw / data.length) * 0.175;
        const val = Number(d[yKey]) || 0;
        const barH = (val / maxY) * uh;
        const color = colorMap?.[String(d[xKey])] ?? COLORS[i % COLORS.length];
        return (
          <g key={i}>
            <rect x={x} y={pad.t + uh - barH} width={bw} height={barH} rx={4} fill={color} opacity={0.85} />
            <text x={x + bw / 2} y={h - pad.b + 12} textAnchor="end" fontSize={10} fill="#64748b" transform={`rotate(-45 ${x + bw / 2} ${h - pad.b + 12})`}>
              {String(d[xKey]).length > 20 ? String(d[xKey]).slice(0, 18) + '…' : String(d[xKey])}
            </text>
            <text x={x + bw / 2} y={pad.t + uh - barH - 4} textAnchor="middle" fontSize={9} fill="#64748b">{fmt(val, 1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── horizontal bar chart (for correlation) ────────────────────────────────────
function HBarChart({ data, labelKey, valueKey }: { data: AnyRecord[]; labelKey: string; valueKey: string }) {
  const w = 500, h = Math.max(160, data.length * 22 + 40), pad = { l: 130, r: 60, t: 20, b: 20 };
  const uw = w - pad.l - pad.r;
  const uh = h - pad.t - pad.b;
  const maxAbs = Math.max(...data.map(d => Math.abs(Number(d[valueKey]) || 0)), 0.01);
  const zero = pad.l + uw / 2;
  const lh = uh / Math.max(data.length, 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={zero} y1={pad.t} x2={zero} y2={h - pad.b} stroke="#cbd5e1" strokeDasharray="3,3" />
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const bw = (Math.abs(val) / maxAbs) * (uw / 2);
        const y = pad.t + lh * i + lh * 0.15;
        const bh = lh * 0.7;
        const color = val >= 0 ? '#3b82f6' : '#ef4444';
        return (
          <g key={i}>
            <text x={pad.l - 6} y={y + bh / 2 + 4} textAnchor="end" fontSize={9} fill="#64748b">
              {String(d[labelKey]).slice(0, 16)}
            </text>
            <rect x={val >= 0 ? zero : zero - bw} y={y} width={bw} height={bh} rx={3} fill={color} opacity={0.8} />
            <text x={val >= 0 ? zero + bw + 4 : zero - bw - 4} y={y + bh / 2 + 4}
              textAnchor={val >= 0 ? 'start' : 'end'} fontSize={9} fill="#64748b">{fmt(val, 3)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── simple data table ─────────────────────────────────────────────────────────
function DataTable({
  rows,
  cols,
  limit = 5,
  sortKey,
  sortDir = 'desc',
  sortAbs = false,
}: {
  rows: AnyRecord[];
  cols: string[];
  limit?: number;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  sortAbs?: boolean;
}) {
  if (!rows.length) return <p style={{ color: '#64748b', fontSize: 12 }}>No data</p>;
  const sorted = sortKey
    ? [...rows].sort((a, b) => {
      const av = Number(a[sortKey]);
      const bv = Number(b[sortKey]);
      const na = isNaN(av) ? 0 : (sortAbs ? Math.abs(av) : av);
      const nb = isNaN(bv) ? 0 : (sortAbs ? Math.abs(bv) : bv);
      return sortDir === 'asc' ? na - nb : nb - na;
    })
    : rows;
  const shown = sorted.slice(0, limit);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {cols.map(c => <th key={c} style={{ padding: '6px 10px', color: '#475569', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              {cols.map(c => (
                <td key={c} style={{ padding: '5px 10px', color: '#0f172a', borderBottom: '1px solid #e5e7eb' }}>
                  {typeof row[c] === 'number' ? fmt(row[c], 3) : String(row[c] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── card wrapper ──────────────────────────────────────────────────────────────
function Card({ title, subtitle, children, badge }: {
  title: string; subtitle?: string; children: React.ReactNode; badge?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, marginBottom: 20, overflow: 'hidden', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)' }}>
      <div style={{ padding: '14px 18px', borderBottom: collapsed ? 'none' : '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</span>
            {badge && <span style={{ background: '#e0f2fe', color: '#075985', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{badge}</span>}
          </div>
          {subtitle && <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{subtitle}</p>}
        </div>
        <span style={{ color: '#94a3b8', fontSize: 18 }}>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && <div style={{ padding: '16px 18px' }}>{children}</div>}
    </div>
  );
}

function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) return <p style={{ color: '#64748b', fontSize: 12 }}>Loading…</p>;
  if (error) return <p style={{ color: '#ef4444', fontSize: 12 }}>Error: {error}</p>;
  return null;
}

function NoData({ message = 'No data available for this dataset.' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 16px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
      <span style={{ fontSize: 22 }}>📭</span>
      <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{message}</p>
    </div>
  );
}

// ─── 4A Stability ──────────────────────────────────────────────────────────────
function StabilitySection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ summary: AnyRecord[]; category_counts: AnyRecord[] }>(`${API}/temporal/stability${qs}`);
  const COLOR_MAP: Record<string, string> = {
    'Low variation (<10%)': '#10b981',
    'Moderate variation (10–25%)': '#f59e0b',
    'High variation (>25%)': '#ef4444',
  };
  return (
    <Card title="4A · Stability Classification (CV-Based)" subtitle="Genotype yield stability by coefficient of variation" badge="ANOVA">
      <LoadState loading={loading} error={error} />
      {data && (
        !data.category_counts?.length
          ? <NoData message="No stability data — upload a CSV with Yield column to enable this analysis." />
          : (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>
              <div>
                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Genotype count per stability class</p>
                <BarChart data={data.category_counts} xKey="cv_category" yKey="count" colorMap={COLOR_MAP} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>Summary table (CV%)</p>
                <DataTable rows={data.summary} cols={['genotype', 'mean_yield', 'cv', 'cv_category']} sortKey="cv" />
              </div>
            </div>
          )
      )}
    </Card>
  );
}

// ─── 4B Yield Class ────────────────────────────────────────────────────────────
function YieldClassSection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{
    thresholds: { t33: number; t66: number };
    distribution: AnyRecord[];
    genotype_table: AnyRecord[];
  }>(`${API}/temporal/yield-class${qs}`);
  const COLOR_MAP: Record<string, string> = { Low: '#ef4444', Medium: '#f59e0b', High: '#10b981' };
  return (
    <Card title="4B · Yield Class Distribution" subtitle="Tertile-based low / medium / high yield classes on stable genotypes">
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            {['t33', 't66'].map(k => (
              <div key={k} style={{ background: '#ffffff', borderRadius: 8, padding: '8px 14px', border: '1px solid #e5e7eb' }}>
                <span style={{ color: '#64748b', fontSize: 11 }}>{k === 't33' ? 'Low / Medium threshold' : 'Medium / High threshold'}</span>
                <strong style={{ display: 'block', color: '#2563eb', fontSize: 17, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {fmt(data.thresholds[k as 't33' | 't66'], 2)}
                </strong>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>
            <BarChart data={data.distribution} xKey="Yield_Class" yKey="count" colorMap={COLOR_MAP} />
            <DataTable rows={data.genotype_table} cols={['genotype', 'Yield', 'Yield_Class']} sortKey="Yield" />
          </div>
        </>
      )}
    </Card>
  );
}

// ─── 4D Tukey ──────────────────────────────────────────────────────────────────
function TukeySection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ tukey: AnyRecord[] }>(`${API}/temporal/tukey${qs}`);
  return (
    <Card title="4D · Significant Features (ANOVA)" subtitle="Features significantly different across yield classes (p < 0.05)" badge="ANOVA">
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>
            <BarChart data={data.tukey.slice(0, 12)} xKey="feature" yKey="sig_count" />
            <DataTable rows={data.tukey} cols={['feature', 'p_value', 'sig_count', 'significant_pairs']} sortKey="sig_count" />
          </div>
        </>
      )}
    </Card>
  );
}

// ─── 4E Correlation ────────────────────────────────────────────────────────────
function CorrelationSection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ correlations: AnyRecord[] }>(`${API}/temporal/correlation${qs}`);
  return (
    <Card title="4E · Pearson / Spearman Correlation with Yield" subtitle="Top feature-yield correlations ranked by |Pearson r|">
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>
            <HBarChart data={data.correlations} labelKey="feature" valueKey="pearson_r" />
            <DataTable rows={data.correlations} cols={['feature', 'pearson_r', 'pearson_p', 'spearman_r', 'spearman_p']} sortKey="pearson_r" sortAbs />
          </div>
        </>
      )}
    </Card>
  );
}

// ─── 4F Growth / Senescence ────────────────────────────────────────────────────
function GrowthSenescenceSection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ rates: AnyRecord[]; features: string[] }>(`${API}/temporal/growth-senescence${qs}`);
  const [rateType, setRateType] = useState<'growth' | 'senescence'>('growth');
  const [selFeature, setSelFeature] = useState<string>('');

  const featureList = useMemo(() => data?.features ?? [], [data]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (featureList.length && !selFeature) { setTimeout(() => setSelFeature(featureList[0]), 0); } }, [featureList]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.rates.filter(r => r.rate_type === rateType && r.feature === selFeature);
  }, [data, rateType, selFeature]);

  const byClass = useMemo(() => {
    const acc: Record<string, number[]> = {};
    filtered.forEach(r => {
      const k = String(r.Yield_Class);
      if (!acc[k]) acc[k] = [];
      if (r.rate_value !== null) acc[k].push(Number(r.rate_value));
    });
    return Object.entries(acc).map(([Yield_Class, vals]) => ({
      Yield_Class,
      avg_rate: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
    }));
  }, [filtered]);

  const COLOR_MAP: Record<string, string> = { Low: '#ef4444', Medium: '#f59e0b', High: '#10b981' };
  return (
    <Card title="4F · Growth & Senescence Rates by Yield Class" subtitle="Mean delta-VI/day grouped by class">
      <LoadState loading={loading} error={error} />
      {data && (
        data.rates.length === 0
          ? <NoData message="No timestamp data available — upload per-timestamp CSVs (Reflectance Maps or Temporal CSV mode) to enable growth & senescence analysis." />
          : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                {(['growth', 'senescence'] as const).map(t => (
                  <button key={t} onClick={() => setRateType(t)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: rateType === t ? '#2563eb' : '#ffffff', borderColor: rateType === t ? '#2563eb' : '#e5e7eb', color: rateType === t ? '#ffffff' : '#0f172a' }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
                <select value={selFeature} onChange={e => setSelFeature(e.target.value)}
                  style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
                  {featureList.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <BarChart data={byClass} xKey="Yield_Class" yKey="avg_rate" colorMap={COLOR_MAP} />
            </>
          )
      )}
    </Card>
  );
}

// ─── 4G Phenology ─────────────────────────────────────────────────────────────
function PhenologySection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ records: AnyRecord[]; features: string[]; metrics: string[] }>(`${API}/temporal/phenology${qs}`);
  const [metric, setMetric] = useState('peak');
  const [selFeat, setSelFeat] = useState('');

  const featureList2 = useMemo(() => data?.features ?? [], [data]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (featureList2.length && !selFeat) { setTimeout(() => setSelFeat(featureList2[0]), 0); } }, [featureList2]);

  const byClass = useMemo(() => {
    if (!data) return [];
    const filtered = data.records.filter(r => r.metric === metric && r.feature === selFeat);
    const acc: Record<string, number[]> = {};
    filtered.forEach(r => {
      const k = String(r.Yield_Class);
      if (!acc[k]) acc[k] = [];
      if (r.value !== null) acc[k].push(Number(r.value));
    });
    return Object.entries(acc).map(([Yield_Class, vals]) => ({
      Yield_Class,
      mean_value: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
    }));
  }, [data, metric, selFeat]);

  const COLOR_MAP: Record<string, string> = { Low: '#ef4444', Medium: '#f59e0b', High: '#10b981' };
  return (
    <Card title="4G · Phenology Features" subtitle="Peak · Time-to-Peak · StayGreen AUC · Senescence Duration">
      <LoadState loading={loading} error={error} />
      {data && (
        data.records.length === 0
          ? <NoData message="No timestamp data available — upload per-timestamp CSVs to enable phenology analysis." />
          : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                <select value={metric} onChange={e => setMetric(e.target.value)}
                  style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
                  {data.metrics.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={selFeat} onChange={e => setSelFeat(e.target.value)}
                  style={{ background: '#ffffff', color: '#0f172a', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
                  {featureList2.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <BarChart data={byClass} xKey="Yield_Class" yKey="mean_value" colorMap={COLOR_MAP} />
            </>
          )
      )}
    </Card>
  );
}

// ─── 4I Interpretation ────────────────────────────────────────────────────────
function InterpretationSection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ interpretations: AnyRecord[] }>(`${API}/temporal/interpretation${qs}`);
  return (
    <Card title="4I · Feature Biological Interpretation" subtitle="Significant features and their agronomic meaning">
      <LoadState loading={loading} error={error} />
      {data && <DataTable rows={data.interpretations} cols={['feature', 'p_value', 'mean_high', 'mean_low', 'effect_direction', 'biological_reason']} sortKey="mean_high" />}
    </Card>
  );
}

// ─── 4K Outliers ──────────────────────────────────────────────────────────────
function OutlierHeatmap({ data }: { data: AnyRecord[] }) {
  if (!data || data.length === 0) return <NoData message="No outliers found" />;

  const genotypes = Array.from(new Set(data.map(d => String(d.genotype)))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const features = Array.from(new Set(data.map(d => String(d.Feature)))).sort();

  const map: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const g = String(d.genotype);
    const f = String(d.Feature);
    if (!map[g]) map[g] = {};
    map[g][f] = Number(d.Z_score);
  });

  const maxAbsZ = Math.max(0.1, ...data.map(d => Math.abs(Number(d.Z_score))));

  return (
    <div style={{ marginTop: 26, display: 'flex', overflowX: 'auto', paddingBottom: 64, paddingRight: 16 }}>
      {/* Y Axis (Genotypes) */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 8, paddingTop: 16, gap: 1 }}>
        {genotypes.map(g => (
          <div key={g} style={{ height: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
            {g}
          </div>
        ))}
        {/* Placeholder to match X axis height */}
        <div style={{ height: 180 }}></div>
      </div>

      {/* Plot Area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#f8fafc', padding: 16, borderRadius: 4, border: '1px solid #e5e7eb' }}>
          {genotypes.map(g => (
            <div key={g} style={{ display: 'flex', height: 20, gap: 1 }}>
              {features.map(f => {
                const z = map[g]?.[f];
                let bg = 'transparent';
                if (z !== undefined) {
                  const intensity = Math.min(1, Math.abs(z) / maxAbsZ);
                  bg = z > 0 ? `rgba(220, 38, 38, ${intensity * 0.8 + 0.2})` : `rgba(37, 99, 235, ${intensity * 0.8 + 0.2})`;
                }
                return (
                  <div key={f} title={`Genotype: ${g}\nFeature: ${f}\nZ-Score: ${z?.toFixed(3) || 'N/A'}`} style={{ flex: 1, minWidth: 28, height: '100%', backgroundColor: bg, borderRadius: 1 }} />
                );
              })}
            </div>
          ))}
        </div>

        {/* X Axis (Features) */}
        <div style={{ display: 'flex', gap: 1, marginTop: 8, paddingLeft: 16, paddingRight: 16 }}>
          {features.map(f => (
            <div key={f} style={{ flex: 1, minWidth: 28, position: 'relative' }}>
              <div style={{ position: 'absolute', transform: 'translateX(-50%) rotate(-45deg)', transformOrigin: 'top center', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', top: 0, left: '50%' }}>
                {f.length > 25 ? f.slice(0, 23) + '…' : f}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color Scale Legend */}
      <div style={{ marginLeft: 32, display: 'flex', alignItems: 'center', height: Math.max(100, genotypes.length * 16) }}>
        <div style={{ height: '100%', width: 12, background: 'linear-gradient(to top, rgba(37, 99, 235, 1), rgba(37, 99, 235, 0.2) 45%, transparent 50%, rgba(220, 38, 38, 0.2) 55%, rgba(220, 38, 38, 1))', borderRadius: 2 }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', marginLeft: 8, fontSize: 10, color: '#64748b' }}>
          <span>{maxAbsZ.toFixed(1)}</span>
          <span>0.0</span>
          <span>-{maxAbsZ.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

function OutliersSection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ outliers: AnyRecord[]; heatmap: AnyRecord[]; available_yield_classes: string[] }>(`${API}/temporal/outliers${qs}`);
  const [selClass, setSelClass] = useState<string>('all');

  const filtered = useMemo(() => {
    if (!data) return [];
    if (selClass === 'all') return data.outliers;
    return data.outliers.filter(r => r.Yield_Class === selClass);
  }, [data, selClass]);

  return (
    <Card title="4K · Genotype Outlier Z-Scores (|Z| > 2)" subtitle="Features where genotypes deviate significantly from class mean">
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {['all', ...data.available_yield_classes].map(c => (
              <button key={c} onClick={() => setSelClass(c)}
                style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600, background: selClass === c ? '#2563eb' : '#ffffff', borderColor: selClass === c ? '#2563eb' : '#e5e7eb', color: selClass === c ? '#ffffff' : '#0f172a' }}>
                {c}
              </button>
            ))}
          </div>
          <OutlierHeatmap data={filtered} />
        </>
      )}
    </Card>
  );
}

function HeatmapTable({ data }: { data: AnyRecord[] }) {
  if (!data || data.length === 0) return null;

  // Pivot data: Feature_Category vs Yield_Class
  const rowsMap: Record<string, Record<string, number>> = {};
  const yieldClasses = new Set<string>();

  data.forEach(d => {
    const fc = String(d.Feature_Category);
    const yc = String(d.Yield_Class);
    const z = Number(d.Mean_Abs_Z);
    if (!rowsMap[fc]) rowsMap[fc] = {};
    rowsMap[fc][yc] = z;
    yieldClasses.add(yc);
  });

  const yLabels = Object.keys(rowsMap).sort();
  const xLabels = ['High', 'Medium', 'Low'].filter(c => yieldClasses.has(c));
  if (xLabels.length === 0) Array.from(yieldClasses).forEach(c => xLabels.push(c));

  const maxZ = Math.max(0.01, ...data.map(d => Number(d.Mean_Abs_Z) || 0));

  return (
    <div style={{ marginTop: 16, display: 'flex', overflowX: 'auto', paddingBottom: 16 }}>
      {/* Y Axis Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30 }}>
        <div style={{ transform: 'rotate(-90deg)', fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
          Feature_Category
        </div>
      </div>

      {/* Y Axis Labels */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 12, justifyContent: 'flex-start', gap: 2 }}>
        {yLabels.map((y, i) => (
          <div key={`${y}-${i}`} style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: 11, color: '#64748b' }}>
            {y}
          </div>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 2 }}>
          {yLabels.map((y, i) => (
            <div key={`row-${i}`} style={{ display: 'flex', height: 32, gap: 2 }}>
              {xLabels.map(col => {
                const val = rowsMap[y][col];
                const isVal = val !== undefined && !isNaN(val);
                const intensity = isVal ? Math.min(1, val / maxZ) : 0;
                const bgColor = isVal ? `rgba(220, 38, 38, ${intensity * 0.85 + 0.15})` : '#ffffff';
                const color = intensity > 0.4 ? '#fff' : '#1e293b';
                return (
                  <div key={col} title={`${y} - ${col}: ${isVal ? val.toFixed(2) : 'N/A'}`} style={{ flex: 1, backgroundColor: bgColor, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, borderRadius: 2, minWidth: 80, border: isVal ? 'none' : '1px solid #e5e7eb' }}>
                    {isVal ? val.toFixed(2) : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* X Axis Labels */}
        <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
          {xLabels.map(col => (
            <div key={col} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
              {col}
            </div>
          ))}
        </div>
      </div>

      {/* Color Scale Legend */}
      <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ height: '100%', minHeight: 120, width: 12, background: 'linear-gradient(to top, rgba(220, 38, 38, 0.1), rgba(220, 38, 38, 1))', borderRadius: 2 }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', minHeight: 120, marginLeft: 6, fontSize: 10, color: '#64748b' }}>
          <span>{maxZ.toFixed(1)}</span>
          <span style={{ paddingBottom: 28 }}>0.0</span>
        </div>
      </div>
    </div>
  );
}

// ─── 4L Category Summary ──────────────────────────────────────────────────────
function CategorySummarySection({ qs = '' }: { qs?: string }) {
  const { data, loading, error } = useFetch<{ category_summary: AnyRecord[]; heatmap_matrix: AnyRecord[] }>(`${API}/temporal/category-summary${qs}`);
  return (
    <Card title="4L · Category-Level Summary" subtitle="Yield Class × Feature Category outlier analysis">
      <LoadState loading={loading} error={error} />
      {data && (
        <>
          <DataTable rows={data.category_summary} cols={['Yield_Class', 'Feature_Category', 'Num_Genotypes', 'Num_Features', 'Mean_Abs_Z']} sortKey="Mean_Abs_Z" />
          {data.heatmap_matrix.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 13, color: '#0f172a', fontWeight: 600, marginBottom: 8 }}>Feature Category × Yield Class — Mean |Z|</p>
              <HeatmapTable data={data.heatmap_matrix} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TemporalAnalysis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [effectiveSessionId, setEffectiveSessionId] = useState<string | null>(sessionId);
  const qs = effectiveSessionId ? `?session_id=${effectiveSessionId}` : '';

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

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🌾</span>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#0f172a', fontSize: 14 }}>Temporal Analysis</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {effectiveSessionId ? `Session: ${effectiveSessionId.slice(0, 8)}… — custom upload` : 'SBZ Genotype Phenology — runtime computed'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => router.push('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#0f172a', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ← Home
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        <StabilitySection qs={qs} />
        <YieldClassSection qs={qs} />
        <TukeySection qs={qs} />
        <CorrelationSection qs={qs} />
        <PhenologySection qs={qs} />
        <InterpretationSection qs={qs} />
        <OutliersSection qs={qs} />
        <CategorySummarySection qs={qs} />
      </div>
    </div>
  );
}

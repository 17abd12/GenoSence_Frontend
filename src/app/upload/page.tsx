'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/* ── tiny helpers ─────────────────────────────────────────────── */
type UploadMode = 'reflectance' | 'temporal-csv' | 'csv-only' | 'shapefile-only';

interface SessionResult {
  session_id: string;
  message: string;
  timestamp_count?: number;
  timestamp_labels?: string[];
  processed_timestamps?: number;
  errors?: string[];
  warnings?: string[];
  has_shapefile?: boolean;
  has_yield?: boolean;
  row_count?: number;
  column_count?: number;
}

/* ── dropzone ────────────────────────────────────────────────── */
function Dropzone({
  label, accept, multiple, files, onChange, hint,
}: {
  label: string; accept: string; multiple?: boolean;
  files: File[]; onChange: (f: File[]) => void; hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    onChange(multiple ? dropped : [dropped[0]]);
  }, [multiple, onChange]);

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
          borderRadius: 12, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? '#eff6ff' : '#f8fafc',
          transition: 'all 0.2s',
        }}
      >
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }}
          onChange={e => onChange(Array.from(e.target.files ?? []))} />
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>Upload files</div>
        {files.length === 0 ? (
          <>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Drop files here or click to browse</p>
            {hint && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>{hint}</p>}
          </>
        ) : (
          <div>
            {files.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: '#0f172a', padding: '2px 0' }}>
                {f.name} <span style={{ color: '#94a3b8' }}>({(f.size / 1024).toFixed(0)} KB)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── band config ─────────────────────────────────────────────── */
function BandConfig({ bands, onChange }: { bands: Record<string, number>; onChange: (k: string, v: number) => void }) {
  const fields = [
    { key: 'band_red', label: 'Red band index (RGB)' },
    { key: 'band_green', label: 'Green band index (RGB)' },
    { key: 'band_blue', label: 'Blue band index (RGB)' },
    { key: 'band_nir', label: 'NIR band index (NIR image)' },
    { key: 'band_rededge', label: 'Red-edge band index (NIR image)' },
  ];
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Band Settings</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {fields.map(f => (
          <label key={f.key} style={{ fontSize: 12, color: '#374151' }}>
            {f.label}
            <input type="number" min={1} max={10} value={bands[f.key]}
              onChange={e => onChange(f.key, parseInt(e.target.value) || 1)}
              style={{ display: 'block', marginTop: 4, width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 12 }} />
          </label>
        ))}
      </div>
    </div>
  );
}

/* ── timestamp row ───────────────────────────────────────────── */
function TimestampInput({ value, onChange, index }: { value: string; onChange: (v: string) => void; index: number }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={`Timestamp ${index + 1} label`}
      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 12 }} />
  );
}

/* ── main page ───────────────────────────────────────────────── */
export default function UploadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>('reflectance');
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (!cancelled) {
          setIsAuthed(res.ok);
          setAuthReady(true);
        }
      } catch {
        if (!cancelled) {
          setIsAuthed(false);
          setAuthReady(true);
        }
      }
    };
    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mode A – reflectance maps
  const [rgbFiles, setRgbFiles] = useState<File[]>([]);
  const [nirFiles, setNirFiles] = useState<File[]>([]);
  const [shapefileA, setShapefileA] = useState<File[]>([]);
  const [bands, setBands] = useState<Record<string, number>>({ band_red: 1, band_green: 2, band_blue: 3, band_nir: 1, band_rededge: 2 });
  const [tsLabels, setTsLabels] = useState<string[]>(Array(12).fill('').map((_, i) => `TS-${i + 1}`));

  // Mode B – temporal CSVs
  const [temporalCsv, setTemporalCsv] = useState<File[]>([]);
  const [tsCsvs, setTsCsvs] = useState<File[]>([]);
  const [shapefileB, setShapefileB] = useState<File[]>([]);

  // Mode C – single CSV only
  const [singleCsv, setSingleCsv] = useState<File[]>([]);
  const [shapefileC, setShapefileC] = useState<File[]>([]);

  // Mode D – shapefile only
  const [shapefileD, setShapefileD] = useState<File[]>([]);
  const previewMapRef = useRef<HTMLDivElement>(null);
  const previewMapInstanceRef = useRef<unknown>(null);

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const handleBandChange = (k: string, v: number) => setBands(b => ({ ...b, [k]: v }));

  const handleUploadReflectance = async () => {
    if (!isAuthed) {
      setError('Please sign in to upload files.');
      return;
    }
    if (rgbFiles.length === 0 || nirFiles.length === 0 || shapefileA.length === 0) {
      setError('Please upload RGB images, NIR images, and a GeoJSON shapefile.'); return;
    }
    if (rgbFiles.length !== nirFiles.length) {
      setError('RGB and NIR image counts must match.'); return;
    }
    setUploading(true); setError(null); setResult(null);

    const fd = new FormData();
    rgbFiles.forEach(f => fd.append('rgb_images', f));
    nirFiles.forEach(f => fd.append('nir_images', f));
    fd.append('shapefile_json', shapefileA[0]);
    Object.entries(bands).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append('timestamps', tsLabels.slice(0, rgbFiles.length).join(','));

    try {
      const res = await fetch(`${API}/upload/reflectance-maps`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      sessionStorage.setItem('session_id', data.session_id);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleUploadCSVsOnly = async () => {
    if (!isAuthed) {
      setError('Please sign in to upload files.');
      return;
    }
    if (singleCsv.length === 0) {
      setError('Please upload your temporal feature CSV.'); return;
    }
    setUploading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('temporal_csv', singleCsv[0]);
    if (shapefileC.length > 0) fd.append('shapefile_json', shapefileC[0]);
    try {
      const res = await fetch(`${API}/upload/temporal-csv-only`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      sessionStorage.setItem('session_id', data.session_id);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };


  // Render preview map when a shapefile is selected in Mode D
  useEffect(() => {
    if (mode !== 'shapefile-only' || shapefileD.length === 0 || !previewMapRef.current) return;
    const file = shapefileD[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const geojson = JSON.parse(e.target?.result as string);
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        const container = previewMapRef.current!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = container as any;
        if (c._leaflet_id) { delete c._leaflet_id; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (previewMapInstanceRef.current) { (previewMapInstanceRef.current as any).remove(); previewMapInstanceRef.current = null; }
        const map = L.map(container, { zoomControl: true, preferCanvas: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
        const layer = L.geoJSON(geojson, { style: { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.35, weight: 1.5 } }).addTo(map);
        const bounds = layer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
        previewMapInstanceRef.current = map;
      } catch { /* invalid geojson */ }
    };
    reader.readAsText(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapefileD, mode]);

  const handleUploadShapefileOnly = async () => {
    if (!isAuthed) { setError('Please sign in to upload files.'); return; }
    if (shapefileD.length === 0) { setError('Please upload a GeoJSON shapefile.'); return; }
    setUploading(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('shapefile_json', shapefileD[0]);
    try {
      const res = await fetch(`${API}/upload/shapefile-only`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      sessionStorage.setItem('session_id', data.session_id);
      setResult({ ...data, message: data.message });
    } catch (e) { setError(String(e)); }
    finally { setUploading(false); }
  };

  const handleUploadCSVs = async () => {
    if (!isAuthed) {
      setError('Please sign in to upload files.');
      return;
    }
    if (temporalCsv.length === 0 || tsCsvs.length === 0) {
      setError('Please upload the temporal feature CSV and at least one timestamp CSV.'); return;
    }
    setUploading(true); setError(null); setResult(null);

    const fd = new FormData();
    fd.append('temporal_csv', temporalCsv[0]);
    tsCsvs.forEach(f => fd.append('timestamp_csvs', f));
    if (shapefileB.length > 0) fd.append('shapefile_json', shapefileB[0]);

    try {
      const res = await fetch(`${API}/upload/temporal-csvs`, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      sessionStorage.setItem('session_id', data.session_id);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };


  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', background: '#f8fafc',
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: '0 0 60px',
  };

  const cardStyle: React.CSSProperties = {
    background: '#ffffff', borderRadius: 16, padding: 28, boxShadow: '0 12px 32px rgba(15, 23, 42, 0.08)', marginBottom: 20,
  };

  return (
    <div style={containerStyle}>
      {/* Top bar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#0f172a', fontSize: 15 }}>Upload Reflectance Map & Shapefile</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Upload field data to run analysis on your own dataset</div>
          </div>
        </div>
        <button onClick={() => router.push('/')} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#0f172a', padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ← Home
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
        {authReady && !isAuthed && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#92400e', marginBottom: 10 }}>
              Please sign in to upload files. Sample data remains available on the dashboard.
            </p>
            <button onClick={() => router.push('/signin')} style={{ background: '#ffffff', border: '1px solid #fdba74', borderRadius: 8, color: '#92400e', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Sign in
            </button>
          </div>
        )}
        {/* Mode selector */}
        <div style={{ ...cardStyle, padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Choose Upload Mode</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {([
              { id: 'csv-only', title: 'Upload Single CSV', desc: 'One CSV with PLOT_ID + genotype (and optionally Yield + VI features). SVR model auto-predicts Yield if missing.' },
              { id: 'shapefile-only', title: '🗺 Visualize Shapefile', desc: 'Upload a GeoJSON shapefile and instantly preview all plot polygons on an interactive map. No CSV needed.' },
              { id: 'reflectance', title: 'Reflectance Maps + Shapefile', desc: 'Upload 12 RGB & NIR reflectance maps with band settings and a GeoJSON shapefile. VI statistics computed automatically.' },
              { id: 'temporal-csv', title: 'Temporal Feature CSV + Timestamp CSVs', desc: 'Upload a temporal dataset CSV and up to 12 per-timestamp pixel CSVs. VIs computed from raw band values.' },
            ] as {id: UploadMode; title: string; desc: string}[]).map(opt => (
              <button key={opt.id} onClick={() => setMode(opt.id)} style={{
                padding: '16px 18px', textAlign: 'left', border: `2px solid ${mode === opt.id ? '#2563eb' : '#e2e8f0'}`,
                borderRadius: 12, cursor: 'pointer', background: mode === opt.id ? '#eff6ff' : '#ffffff',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{opt.title}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mode D – shapefile only */}
        {mode === 'shapefile-only' && (
          <div style={cardStyle}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
              Visualize Shapefile on Map
            </h2>
            <Dropzone label="Shapefile as GeoJSON" accept=".geojson,.json" multiple={false}
              files={shapefileD} onChange={setShapefileD}
              hint="Upload a .geojson file — plots will appear on the preview map below." />
            {shapefileD.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Map Preview</p>
                <div ref={previewMapRef} style={{ height: 380, borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', background: '#f1f5f9' }} />
              </div>
            )}
            <InfoBox>
              <strong>How it works:</strong> Your shapefile polygons are rendered on a satellite/OSM map.
              After clicking <em>Save &amp; View on Dashboard</em>, you can view the plots on the full dashboard map with alignment controls.
            </InfoBox>
            <button onClick={handleUploadShapefileOnly} disabled={uploading} style={primaryBtn}>
              {uploading ? 'Uploading…' : 'Save & View on Dashboard'}
            </button>
          </div>
        )}

        {/* Mode C – single CSV */}
        {mode === 'csv-only' && (
          <div style={cardStyle}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
              Single Temporal CSV Upload
            </h2>

            <Dropzone label="Temporal Feature CSV" accept=".csv" multiple={false}
              files={singleCsv} onChange={setSingleCsv}
              hint="Required columns: PLOT_ID, genotype. Optional: Yield, VI features (_mean, _std, etc.)" />

            <Dropzone label="Shapefile as GeoJSON (optional)" accept=".geojson,.json" multiple={false}
              files={shapefileC} onChange={setShapefileC}
              hint="Optional — needed for map highlighting." />

            <InfoBox>
              <strong>Smart Yield Handling:</strong> If your CSV already has a <code>Yield</code> column,
              it will be used directly for analysis and model evaluation.
              If <code>Yield</code> is absent, the backend SVR model (<code>svr_combined.pkl</code>) will automatically
              predict yield from your VI features.
            </InfoBox>

            <button onClick={handleUploadCSVsOnly} disabled={uploading} style={primaryBtn}>
              {uploading ? 'Processing…' : 'Upload CSV'}
            </button>
          </div>
        )}

        {/* Mode A */}
        {mode === 'reflectance' && (
          <div style={cardStyle}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
              Reflectance Maps Upload
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Dropzone label="RGB Reflectance Maps (×12)" accept=".tif,.tiff,.png,.jpg" multiple
                files={rgbFiles} onChange={setRgbFiles}
                hint="One RGB image per timestamp (up to 12)" />
              <Dropzone label="NIR Reflectance Maps (×12)" accept=".tif,.tiff,.png,.jpg" multiple
                files={nirFiles} onChange={setNirFiles}
                hint="One NIR image per timestamp (up to 12)" />
            </div>

            <Dropzone label="Shapefile as GeoJSON" accept=".geojson,.json" multiple={false}
              files={shapefileA} onChange={setShapefileA}
              hint="PLOT_ID field must end with genotype number e.g. *_*_12" />

            <BandConfig bands={bands} onChange={handleBandChange} />

            <div style={{ background: '#f1f5f9', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Timestamp Labels ({rgbFiles.length} detected)</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {Array.from({ length: Math.max(rgbFiles.length, 1) }).map((_, i) => (
                  <TimestampInput key={i} index={i} value={tsLabels[i] ?? `TS-${i + 1}`}
                    onChange={v => setTsLabels(prev => { const n = [...prev]; n[i] = v; return n; })} />
                ))}
              </div>
            </div>

            <InfoBox>
              <strong>VI formulas applied:</strong> NDRE, MTCI, NDVI, NDWI, MSI, WI, SAVI, EVI, EXG, CIgreen, NDCI, PSRI, SIPI.
              Statistics (sum, count, mean, median, std, var, min, max) computed per PLOT_ID per timestamp.
              Map highlights will appear when shapefile is present.
            </InfoBox>

            <button onClick={handleUploadReflectance} disabled={uploading} style={primaryBtn}>
              {uploading ? 'Processing…' : 'Upload and Compute VI Statistics'}
            </button>
          </div>
        )}

        {/* Mode B */}
        {mode === 'temporal-csv' && (
          <div style={cardStyle}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>
              Temporal Feature CSV Upload
            </h2>

            <Dropzone label="Main Temporal Feature CSV" accept=".csv" multiple={false}
              files={temporalCsv} onChange={setTemporalCsv}
              hint="Required columns: PLOT_ID, genotype. Other columns (Yield, VIs, etc.) are optional." />

            <Dropzone label="Per-Timestamp Pixel CSVs (×12)" accept=".csv" multiple
              files={tsCsvs} onChange={setTsCsvs}
              hint="Each CSV needs: PLOT_ID, NIR, Red, Green, Blue, Rededge. VIs computed automatically." />

            <Dropzone label="Shapefile as GeoJSON (optional)" accept=".geojson,.json" multiple={false}
              files={shapefileB} onChange={setShapefileB}
              hint="Optional — needed for map highlighting. PLOT_ID should end with genotype number." />

            <InfoBox>
              <strong>How it works:</strong> Each timestamp CSV's pixel values (NIR, Red, Green, Blue, Rededge) are used to compute 13 VIs per pixel.
              Results are aggregated per PLOT_ID as STATS (mean, std, etc.). The main temporal CSV drives stability, yield class, and correlation analyses.
              Only PLOT_ID and genotype are required in the temporal CSV — Yield and other columns are used if present.
            </InfoBox>

            <button onClick={handleUploadCSVs} disabled={uploading} style={primaryBtn}>
              {uploading ? 'Processing…' : 'Upload and Compute VI Statistics'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 16, marginTop: 16 }}>
            <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 20, marginTop: 16 }}>
            <p style={{ color: '#16a34a', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Upload successful</p>
            <p style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Session ID: <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{result.session_id}</code></p>
            {result.row_count !== undefined && <p style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Rows: {result.row_count} · Columns: {result.column_count}</p>}
            {result.has_yield !== undefined && (
              <p style={{ fontSize: 12, color: result.has_yield ? '#16a34a' : '#d97706', marginBottom: 4 }}>
                {result.has_yield ? 'Yield column found — using actual values.' : 'No Yield column — SVR model will predict yield.'}
              </p>
            )}
            {result.timestamp_count !== undefined && <p style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Timestamps processed: {result.timestamp_count}</p>}
            {result.processed_timestamps !== undefined && <p style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>Timestamps processed: {result.processed_timestamps}</p>}
            {result.errors && result.errors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {result.errors.map((e, i) => <p key={i} style={{ fontSize: 11, color: '#dc2626' }}>{e}</p>)}
              </div>
            )}
            {result.warnings && result.warnings.length > 0 && (
              <div style={{ marginTop: 8, background: '#fef3c7', padding: 8, borderRadius: 6, border: '1px solid #fde68a' }}>
                <p style={{ fontSize: 11, color: '#b45309', fontWeight: 700, marginBottom: 4 }}>Warnings:</p>
                {result.warnings.map((w, i) => <p key={i} style={{ fontSize: 11, color: '#92400e' }}>{w}</p>)}
              </div>
            )}
            <p style={{ fontSize: 12, color: '#374151', marginTop: 8 }}>{result.message}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={() => router.push(`/?session_id=${result.session_id}`)} style={{ ...primaryBtn, margin: 0 }}>
                View on Dashboard
              </button>
              <button onClick={() => router.push(`/temporal?session_id=${result.session_id}`)} style={{ ...secondaryBtn }}>
                Temporal Analysis
              </button>
              <button onClick={() => router.push(`/yield-prediction?session_id=${result.session_id}`)} style={{ ...secondaryBtn }}>
                Yield Prediction
              </button>
              <button onClick={() => router.push('/assistant')} style={{ ...secondaryBtn, background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                🤖 Ask Assistant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 12, color: '#1e40af', lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '14px 24px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  border: 'none', borderRadius: 10, color: '#ffffff', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', marginTop: 4, transition: 'opacity 0.2s',
};

const secondaryBtn: React.CSSProperties = {
  padding: '10px 20px', background: '#ffffff', border: '1px solid #d1d5db',
  borderRadius: 8, color: '#374151', fontSize: 12, fontWeight: 600,
  cursor: 'pointer',
};

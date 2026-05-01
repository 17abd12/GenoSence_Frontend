'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ── Types ──────────────────────────────────────────────────── */
interface PlotProperties {
  plot_id: string;
  experiment: string;
}
interface GeoJSONData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: PlotProperties;
    geometry: { type: 'Polygon'; coordinates: number[][][] };
  }>;
}

/* ── Style helpers ──────────────────────────────────────────── */
const HIGHLIGHT_COLOR = '#39d353';   // bright green — visible on satellite
const HOVER_COLOR     = '#fbbf24';   // amber

/** ON  → green fill + border.
 *  OFF → fully invisible; plots vanish, just satellite beneath. */
function getStyle(highlighted: boolean) {
  if (!highlighted) {
    return { color: 'transparent', weight: 0, fillColor: 'transparent', fillOpacity: 0, opacity: 0 };
  }
  return { color: HIGHLIGHT_COLOR, weight: 2, fillColor: HIGHLIGHT_COLOR, fillOpacity: 0.40, opacity: 0.9 };
}

/* ── Component ──────────────────────────────────────────────── */
export default function MapComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const hlRef = useRef(true);

  const [highlighted, setHighlighted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [plotCount, setPlotCount] = useState(0);
  const [hovered, setHovered] = useState<PlotProperties | null>(null);

  useEffect(() => { hlRef.current = highlighted; }, [highlighted]);

  /* ── Init map ───────────────────────────────────────────── */
  useEffect(() => {
    let dead = false;

    async function init() {
      const L = (await import('leaflet')).default;
      if (dead || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [33.6730, 73.1316],
        zoom: 17,
        zoomControl: false,
        preferCanvas: true,
      });

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      /* Satellite tiles — ESRI World Imagery (free, no API key) */
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 19,
          maxNativeZoom: 19,
        }
      ).addTo(map);

      mapRef.current = map;

      /* Load plots */
      let data: GeoJSONData;
      try {
        data = await (await fetch('/plots.geojson')).json();
      } catch (e) {
        console.error('Failed to load plots.geojson', e);
        return;
      }
      if (dead) return;

      setPlotCount(data.features.length);

      const geoLayer = L.geoJSON(data as GeoJSON.FeatureCollection, {
        style: () => getStyle(hlRef.current),
        onEachFeature(feature, layer) {
          const p = feature.properties as PlotProperties;

          layer.bindTooltip(
            `<div class="tt-inner"><span class="tt-id">Plot #${p.plot_id}</span><span class="tt-exp">${p.experiment}</span></div>`,
            { sticky: true, className: 'map-tooltip', opacity: 1 }
          );

          layer.on('mouseover', (e: L.LeafletMouseEvent) => {
            if (dead || !hlRef.current) return;   // no hover when highlights off
            setHovered(p);
            (e.target as L.Path).setStyle({ color: HOVER_COLOR, fillColor: HOVER_COLOR, fillOpacity: 0.55, weight: 2, opacity: 1 });
            (e.target as L.Path).bringToFront();
          });
          layer.on('mouseout', (e: L.LeafletMouseEvent) => {
            if (dead) return;
            setHovered(null);
            (e.target as L.Path).setStyle(getStyle(hlRef.current));
          });
        },
      }).addTo(map);

      layerRef.current = geoLayer;

      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });

      if (!dead) setLoaded(true);
    }

    init();
    return () => {
      dead = true;
      (mapRef.current as L.Map | null)?.remove();
      mapRef.current = null;
    };
  }, []);

  /* ── Handlers ───────────────────────────────────────────── */
  const handleToggle = useCallback(() => {
    const next = !highlighted;
    setHighlighted(next);
    hlRef.current = next;
    (layerRef.current as L.GeoJSON | null)?.eachLayer(l => (l as L.Path).setStyle(getStyle(next)));
  }, [highlighted]);

  const handleFocus = useCallback(() => {
    const map = mapRef.current as L.Map | null;
    const layer = layerRef.current as L.GeoJSON | null;
    if (!map || !layer) return;
    const b = layer.getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [30, 30], animate: true });
  }, []);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="db-root">

      {/* ══ Top bar ══════════════════════════════════════════ */}
      <div className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-logo">🌾</span>
          <div>
            <h1 className="db-title">Agricultural Plot Dashboard</h1>
            <p className="db-meta">
              {loaded
                ? `${plotCount} field plots  ·  WGS 84 / UTM Zone 43N  ·  Satellite Imagery`
                : 'Initialising…'}
            </p>
          </div>
        </div>
        <div className="db-topbar-right">
          {hovered && highlighted && (
            <div className="db-probe">
              <span className="db-probe-label">Plot #{hovered.plot_id}</span>
              {hovered.experiment && <><span className="db-probe-sep">|</span><span className="db-probe-exp">{hovered.experiment}</span></>}
            </div>
          )}
        </div>
      </div>

      {/* ══ Body: map + sidebar ═══════════════════════════════ */}
      <div className="db-body">

        {/* Map column */}
        <div className="db-map-col">
          {/* Map controls bar — sits above the map */}
          <div className="db-mapbar">
            <div className="db-mapbar-left">
              <span className="db-mapbar-label">Field Plots</span>
              <span className="db-mapbar-count">{loaded ? plotCount : '—'}</span>
            </div>
            <div className="db-mapbar-right">
              <button id="btn-focus" className="db-btn" onClick={handleFocus}>
                ⊕ Focus
              </button>
              <button
                id="btn-toggle"
                className={`db-btn db-btn-toggle ${highlighted ? 'is-on' : 'is-off'}`}
                onClick={handleToggle}
              >
                <span className="db-toggle-dot" />
                {highlighted ? 'Highlights ON' : 'Highlights OFF'}
              </button>
            </div>
          </div>

          {/* Map */}
          <div className="db-map-wrap">
            {!loaded && (
              <div className="db-loader">
                <div className="db-spinner" />
                <p>Loading satellite imagery &amp; plots…</p>
              </div>
            )}
            <div ref={containerRef} className="db-map" />
          </div>

          {/* Map legend */}
          <div className="db-legend-bar">
            {highlighted ? (
              <>
                <span className="db-leg"><span className="db-leg-swatch" style={{ background: HIGHLIGHT_COLOR }} />Highlighted plots</span>
                <span className="db-leg"><span className="db-leg-swatch" style={{ background: HOVER_COLOR }} />Hovered</span>
                <span className="db-leg-hint">Hover a plot to inspect · Click to pin</span>
              </>
            ) : (
              <span className="db-leg-hint">Highlights off — satellite view only</span>
            )}
          </div>
        </div>

        {/* ── Right sidebar – reserved for charts ─────────── */}
        <aside className="db-sidebar">
          <div className="db-sidebar-section">
            <p className="db-sidebar-section-title">Yield Overview</p>
            <div className="db-chart-placeholder">
              <span className="db-placeholder-icon">📊</span>
              <span>Chart coming soon</span>
            </div>
          </div>

          <div className="db-sidebar-section">
            <p className="db-sidebar-section-title">Experiment Breakdown</p>
            <div className="db-chart-placeholder">
              <span className="db-placeholder-icon">🥧</span>
              <span>Chart coming soon</span>
            </div>
          </div>

          <div className="db-sidebar-section">
            <p className="db-sidebar-section-title">Growth Metrics</p>
            <div className="db-chart-placeholder tall">
              <span className="db-placeholder-icon">📈</span>
              <span>Chart coming soon</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

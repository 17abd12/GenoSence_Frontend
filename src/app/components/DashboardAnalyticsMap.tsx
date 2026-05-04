'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GeoJSON, Map as LeafletMap, Path } from 'leaflet';

type AnalysisMode = 'feature' | 'genotype' | 'yield-variation';
type FeatureKey =
  | 'fractional_cover_max_increase'
  | 'fractional_cover_max_decrease'
  | 'Yield'
  | 'Max_Height'
  | 'GNDVI_mean_senescence_rate'
  | 'RECI_mean_senescence_rate'
  | 'SR_mean_senescence_rate'
  | 'NDREI_mean_senescence_rate'
  | 'ALS_mean'
  | 'CIgreen_mean'
  | 'EVI_mean'
  | 'EXG_mean'
  | 'LPT_70_mean'
  | 'MSI_mean'
  | 'MTCI_mean'
  | 'NDCI_mean'
  | 'NDRE_mean'
  | 'NDVI_mean'
  | 'NDWI_mean'
  | 'PSRI_mean'
  | 'SAVI_mean'
  | 'SIPI_mean'
  | 'WALS_mean'
  | 'WI_mean'
  | 'average_height_m_mean'
  | 'fractional_cover_mean';

type FeaturePalette = 'blue-green-red' | 'blue-teal-amber';

type PlotProperties = {
  plot_id: string;
  experiment: string;
  genotype: number;
  Yield: number;
  Max_Height: number;
} & Record<FeatureKey, number>;

type PlotFeature = {
  type: 'Feature';
  properties: PlotProperties;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
};

type PlotCollection = {
  type: 'FeatureCollection';
  features: PlotFeature[];
};

type TemporalRecord = {
  plotId: string;
  experiment: string;
  genotype: number;
  values: Record<FeatureKey, number>;
};

type YieldBand = 'Low' | 'Medium' | 'High';

type ScatterPoint = {
  x: number;
  y: number;
  band: YieldBand;
};

type GenotypePoint = {
  genotype: number;
  meanYield: number;
  cv: number;
  band: 'Low' | 'Moderate' | 'High';
};

const FEATURE_OPTIONS: FeatureKey[] = [
  'fractional_cover_max_increase',
  'fractional_cover_max_decrease',
  'Yield',
  'Max_Height',
  'GNDVI_mean_senescence_rate',
  'RECI_mean_senescence_rate',
  'SR_mean_senescence_rate',
  'NDREI_mean_senescence_rate',
  'ALS_mean',
  'CIgreen_mean',
  'EVI_mean',
  'EXG_mean',
  'LPT_70_mean',
  'MSI_mean',
  'MTCI_mean',
  'NDCI_mean',
  'NDRE_mean',
  'NDVI_mean',
  'NDWI_mean',
  'PSRI_mean',
  'SAVI_mean',
  'SIPI_mean',
  'WALS_mean',
  'WI_mean',
  'average_height_m_mean',
  'fractional_cover_mean'
];

const FEATURE_LABELS: Record<FeatureKey, string> = {
  fractional_cover_max_increase: 'Fractional cover increase',
  fractional_cover_max_decrease: 'Fractional cover decrease',
  Yield: 'Yield',
  Max_Height: 'Max height',
  GNDVI_mean_senescence_rate: 'GNDVI senescence',
  RECI_mean_senescence_rate: 'RECI senescence',
  SR_mean_senescence_rate: 'SR senescence',
  NDREI_mean_senescence_rate: 'NDREI senescence',
  ALS_mean: 'ALS Mean',
  CIgreen_mean: 'CIgreen Mean',
  EVI_mean: 'EVI Mean',
  EXG_mean: 'EXG Mean',
  LPT_70_mean: 'LPT 70 Mean',
  MSI_mean: 'MSI Mean',
  MTCI_mean: 'MTCI Mean',
  NDCI_mean: 'NDCI Mean',
  NDRE_mean: 'NDRE Mean',
  NDVI_mean: 'NDVI Mean',
  NDWI_mean: 'NDWI Mean',
  PSRI_mean: 'PSRI Mean',
  SAVI_mean: 'SAVI Mean',
  SIPI_mean: 'SIPI Mean',
  WALS_mean: 'WALS Mean',
  WI_mean: 'WI Mean',
  average_height_m_mean: 'Average Height Mean',
  fractional_cover_mean: 'Fractional Cover Mean'
};

const HOVER_COLOR = '#fbbf24';
const GREEN_FILL = '#4ade80';
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

console.log(BACKEND_BASE_URL);
const HIDDEN_STYLE = {
  color: 'transparent',
  fillColor: 'transparent',
  fillOpacity: 0,
  opacity: 0,
  weight: 0,
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text: string) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [] as Record<string, string>[];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });

    return record;
  });
}

function toNumber(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value ?? NaN);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

function quantile(values: number[], fraction: number) {
  if (values.length === 0) {
    return Number.NaN;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return sorted[lower];
  }

  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function mean(values: number[]) {
  if (values.length === 0) {
    return Number.NaN;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function normalize(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (max <= min) {
    return 0.5;
  }

  return clamp((value - min) / (max - min));
}

function heatColor(value: number, palette: FeaturePalette) {
  const clamped = clamp(value);

  if (palette === 'blue-green-red') {
    const hue = clamped < 0.5
      ? 220 - (220 - 120) * (clamped / 0.5)
      : 120 - 120 * ((clamped - 0.5) / 0.5);
    return `hsl(${hue} 82% 48%)`;
  }

  const hue = 220 - 220 * clamped;
  const lightness = 56 - 10 * clamp(Math.abs(clamped - 0.5) * 2);
  return `hsl(${hue} 84% ${lightness}%)`;
}

function paletteGradient(palette: FeaturePalette) {
  if (palette === 'blue-green-red') {
    return 'linear-gradient(90deg, #2563eb 0%, #22c55e 50%, #ef4444 100%)';
  }

  return 'linear-gradient(90deg, #2563eb 0%, #14b8a6 50%, #f59e0b 100%)';
}

function blueColor(value: number) {
  const lightness = 80 - 42 * clamp(value);
  return `hsl(214 80% ${lightness}%)`;
}

function readFeatureValue(plot: PlotProperties, featureKey: FeatureKey) {
  return plot[featureKey];
}

function isEligibleGenotype(_genotype: number) {
  // Always returns true — all plots (sample data and user-uploaded shapefiles) are rendered.
  // Genotype filtering for the dropdown uses Number.isFinite in availableGenotypes.
  return true;
}

function getYieldBand(value: number, thresholds: [number, number]): YieldBand {
  if (value <= thresholds[0]) {
    return 'Low';
  }

  if (value <= thresholds[1]) {
    return 'Medium';
  }

  return 'High';
}

function parseTemporalData(csvText: string) {
  return parseCsv(csvText)
    .map((row) => {
      const plotId = String(row.PLOT_ID ?? row.plot_id ?? row.Plot_ID ?? '').trim();
      let genotype = toNumber(row.genotype);
      const experiment = String(row.experiment ?? '').trim();

      if (!Number.isFinite(genotype) && plotId.includes('_')) {
        const parsed = Number(plotId.split('_').pop());
        if (Number.isFinite(parsed)) {
          genotype = parsed;
        }
      }

      if (!plotId || !Number.isFinite(genotype)) {
        return null;
      }

      const values = FEATURE_OPTIONS.reduce((accumulator, featureKey) => {
        accumulator[featureKey] = toNumber(row[featureKey]);
        return accumulator;
      }, {} as Record<FeatureKey, number>);

      return {
        plotId,
        experiment,
        genotype,
        values,
      } satisfies TemporalRecord;
    })
    .filter((record): record is TemporalRecord => record !== null);
}

function mergePlotData(geometry: PlotCollection, temporalRecords: TemporalRecord[]) {
  const temporalByPlotId = new Map(temporalRecords.map((record) => [record.plotId, record]));

  const mergedFeatures = geometry.features
    .map((feature) => {
      // Support both lowercase (sample data) and uppercase (user-uploaded shapefiles) property keys
      const rawProps = feature.properties as Record<string, unknown>;
      const plotId = String(
        rawProps.plot_id ?? rawProps.PLOT_ID ?? rawProps.Plot_ID ?? ''
      ).trim();
      const experiment = String(rawProps.experiment ?? rawProps.EXPERIMENT ?? '').trim();
      const lookupKey = experiment || plotId;
      const temporal = temporalByPlotId.get(lookupKey) ?? temporalByPlotId.get(plotId);

      if (!plotId) {
        return null;
      }

      // If there's no matching temporal record (e.g. uploaded shapefile-only),
      // still render the plot using properties from the shapefile itself.
      let genotype: number = Number.NaN;
      if (temporal) {
        genotype = temporal.genotype;
      } else {
        // Try to derive genotype from the shapefile properties
        const rawGenotype = rawProps.genotype ?? rawProps.GENOTYPE;
        if (rawGenotype !== undefined && rawGenotype !== null && rawGenotype !== '') {
          genotype = Number(rawGenotype);
        } else if (plotId.includes('_')) {
          const parsed = Number(plotId.split('_').pop());
          if (Number.isFinite(parsed)) genotype = parsed;
        }
      }

      const properties: PlotProperties = {
        ...feature.properties,
        ...(temporal?.values ?? {}),
        plot_id: plotId,
        experiment: temporal?.experiment || experiment || '',
        genotype,
      };

      return {
        ...feature,
        properties,
      };
    })
    .filter((feature): feature is PlotFeature => feature !== null);

  return {
    type: 'FeatureCollection',
    features: mergedFeatures,
  } as PlotCollection;
}

function getPlotStyle(options: {
  plot: PlotProperties;
  analysisMode: AnalysisMode;
  highlighted: boolean;
  selectedFeature: FeatureKey;
  selectedGenotype: string;
  featureRange: [number, number];
  genotypeVariationRange: [number, number];
  genotypeVariationById: Map<number, number>;
  palette: FeaturePalette;
}) {
  const { plot, analysisMode, highlighted, selectedFeature, selectedGenotype, featureRange, genotypeVariationById, genotypeVariationRange, palette } = options;
  // isEligibleGenotype now always returns true — all plots (sample & uploaded) are rendered
  const visible = highlighted && isEligibleGenotype(plot.genotype) && (selectedGenotype === 'all' || String(plot.genotype) === selectedGenotype);

  if (!visible) {
    return HIDDEN_STYLE;
  }

  if (analysisMode === 'genotype') {
    return {
      color: GREEN_FILL,
      fillColor: GREEN_FILL,
      fillOpacity: 0.62,
      opacity: 0.95,
      weight: 1.4,
    };
  }

  if (analysisMode === 'yield-variation') {
    const variation = genotypeVariationById.get(plot.genotype) ?? 0;
    const normalized = normalize(variation, genotypeVariationRange[0], genotypeVariationRange[1]);
    const color = blueColor(normalized);

    return {
      color,
      fillColor: color,
      fillOpacity: 0.68,
      opacity: 0.95,
      weight: 1.4,
    };
  }

  const value = readFeatureValue(plot, selectedFeature);
  const normalized = normalize(value, featureRange[0], featureRange[1]);
  const color = heatColor(normalized, palette);

  return {
    color,
    fillColor: color,
    fillOpacity: 0.68,
    opacity: 0.95,
    weight: 1.4,
  };
}

function buildYieldVariationMap(records: PlotProperties[]) {
  const grouped = new Map<number, number[]>();

  records.forEach((record) => {
    const bucket = grouped.get(record.genotype) ?? [];
    bucket.push(record.Yield);
    grouped.set(record.genotype, bucket);
  });

  const variationByGenotype = new Map<number, number>();

  grouped.forEach((values, genotype) => {
    const average = mean(values);
    const variation = average === 0 ? standardDeviation(values) : standardDeviation(values) / Math.abs(average);
    variationByGenotype.set(genotype, variation);
  });

  const variations = Array.from(variationByGenotype.values());
  const min = variations.length ? Math.min(...variations) : 0;
  const max = variations.length ? Math.max(...variations) : 1;

  return {
    variationByGenotype,
    variationRange: [min, max] as [number, number],
  };
}

function FeatureBoxplot({
  records,
  feature,
  yieldThresholds,
  actions,
  isExpanded,
}: {
  records: PlotProperties[];
  feature: FeatureKey;
  yieldThresholds: [number, number];
  actions?: React.ReactNode;
  isExpanded?: boolean;
}) {
  const groups = useMemo(() => {
    const low: number[] = [];
    const medium: number[] = [];
    const high: number[] = [];

    records.forEach((record) => {
      const value = readFeatureValue(record, feature);
      const band = getYieldBand(record.Yield, yieldThresholds);

      if (!Number.isFinite(value)) {
        return;
      }

      if (band === 'Low') {
        low.push(value);
      } else if (band === 'Medium') {
        medium.push(value);
      } else {
        high.push(value);
      }
    });

    return [
      { label: 'Low', values: low, color: '#f59e0b' },
      { label: 'Medium', values: medium, color: '#14b8a6' },
      { label: 'High', values: high, color: '#2563eb' },
    ];
  }, [feature, records, yieldThresholds]);

  const allValues = groups.flatMap((group) => group.values);
  const minValue = allValues.length ? Math.min(...allValues) : 0;
  const maxValue = allValues.length ? Math.max(...allValues) : 1;
  const width = 520;
  const height = 220;
  const left = 58;
  const right = 24;
  const top = 24;
  const bottom = 40;
  const laneWidth = (width - left - right) / groups.length;
  const usableHeight = height - top - bottom;
  const scaleY = (value: number) => {
    const res = top + (1 - normalize(value, minValue, maxValue)) * usableHeight;
    return isNaN(res) ? top + usableHeight : res;
  };
  const scaleX = (index: number) => left + laneWidth * index + laneWidth / 2;

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <p className="db-chart-title">{FEATURE_LABELS[feature]} by yield class</p>
          <p className="db-chart-note">Box summary for low, medium, and high yield bands.</p>
        </div>
        {actions && <div className="db-chart-actions">{actions}</div>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="db-chart-svg" style={{ overflow: 'visible' }}>
        <line x1={left} y1={top} x2={left} y2={height - bottom} className="db-chart-axis" />
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="db-chart-axis" />
        {isExpanded && (
          <>
            <text x={left - 42} y={top + usableHeight / 2} transform={`rotate(-90 ${left - 42} ${top + usableHeight / 2})`} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              {FEATURE_LABELS[feature]}
            </text>
            <text x={left + (width - left - right) / 2} y={height - 2} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              Yield Class
            </text>
          </>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const value = minValue + (maxValue - minValue) * tick;
          const y = scaleY(value);
          return (
            <g key={tick}>
              <line x1={left - 6} y1={y} x2={left} y2={y} className="db-chart-tick" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="db-chart-label">
                {formatNumber(value, 1)}
              </text>
            </g>
          );
        })}
        {groups.map((group, index) => {
          const values = [...group.values].sort((a, b) => a - b);

          if (values.length === 0) {
            return (
              <g key={group.label} transform={`translate(${scaleX(index)}, 0)`}>
                <text x={0} y={height - 16} textAnchor="middle" className="db-chart-label">
                  {group.label}
                </text>
              </g>
            );
          }

          const q1 = quantile(values, 0.25);
          const median = quantile(values, 0.5);
          const q3 = quantile(values, 0.75);
          const low = values[0];
          const high = values[values.length - 1];
          const x = scaleX(index);
          const boxWidth = Math.max(24, laneWidth * 0.4);

          return (
            <g key={group.label}>
              <line x1={x} x2={x} y1={scaleY(low)} y2={scaleY(high)} className="db-chart-whisker" />
              <rect
                x={x - boxWidth / 2}
                y={scaleY(q3)}
                width={boxWidth}
                height={Math.max(2, scaleY(q1) - scaleY(q3))}
                rx={6}
                className="db-chart-box"
                style={{ fill: group.color, stroke: group.color }}
              />
              <line x1={x - boxWidth / 2} x2={x + boxWidth / 2} y1={scaleY(median)} y2={scaleY(median)} className="db-chart-median" />
              <circle cx={x} cy={scaleY(low)} r={3.5} className="db-chart-dot" style={{ fill: group.color }} />
              <circle cx={x} cy={scaleY(high)} r={3.5} className="db-chart-dot" style={{ fill: group.color }} />
              <text x={x} y={height - 16} textAnchor="middle" className="db-chart-label">
                {group.label}
              </text>
            </g>
          );
        })}
      </svg>
      {isExpanded && (
        <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px', margin: '0 16px 12px', display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '13px', color: '#cbd5e1' }}>
          <span><strong style={{ color: '#fff' }}>X-axis:</strong> Yield Class</span>
          <span><strong style={{ color: '#fff' }}>Y-axis:</strong> {FEATURE_LABELS[feature]}</span>
        </div>
      )}
      <div className="db-mini-legend">
        <span><i className="db-mini-dot low" />Low</span>
        <span><i className="db-mini-dot med" />Medium</span>
        <span><i className="db-mini-dot high" />High</span>
      </div>
    </div>
  );
}

function ScatterPlot({
  records,
  feature,
  yieldThresholds,
  actions,
  isExpanded,
}: {
  records: PlotProperties[];
  feature: FeatureKey;
  yieldThresholds: [number, number];
  actions?: React.ReactNode;
  isExpanded?: boolean;
}) {
  const points = useMemo(() => {
    return records
      .map((record) => {
        const x = readFeatureValue(record, feature);
        const y = record.Yield;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        return {
          x,
          y,
          band: getYieldBand(y, yieldThresholds),
        } satisfies ScatterPoint;
      })
      .filter((point): point is ScatterPoint => point !== null);
  }, [feature, records, yieldThresholds]);

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const minX = xValues.length ? Math.min(...xValues) : 0;
  const maxX = xValues.length ? Math.max(...xValues) : 1;
  const minY = yValues.length ? Math.min(...yValues) : 0;
  const maxY = yValues.length ? Math.max(...yValues) : 1;
  const width = 520;
  const height = 220;
  const left = 54;
  const right = 22;
  const top = 22;
  const bottom = 36;
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;

  const xScale = (value: number) => {
    const res = left + normalize(value, minX, maxX) * usableWidth;
    return isNaN(res) ? left : res;
  };
  const yScale = (value: number) => {
    const res = top + (1 - normalize(value, minY, maxY)) * usableHeight;
    return isNaN(res) ? top + usableHeight : res;
  };

  const trendLines = ['Low', 'Medium', 'High'].map((band) => {
    const bandPoints = points.filter((point) => point.band === band);

    if (bandPoints.length < 2) {
      return null;
    }

    const xMean = mean(bandPoints.map((point) => point.x));
    const yMean = mean(bandPoints.map((point) => point.y));
    const numerator = bandPoints.reduce((total, point) => total + (point.x - xMean) * (point.y - yMean), 0);
    const denominator = bandPoints.reduce((total, point) => total + (point.x - xMean) ** 2, 0);

    if (denominator === 0) {
      return null;
    }

    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;
    const startY = slope * minX + intercept;
    const endY = slope * maxX + intercept;

    return {
      band,
      x1: xScale(minX),
      y1: yScale(startY),
      x2: xScale(maxX),
      y2: yScale(endY),
    };
  }).filter((line) => line !== null) as Array<{ band: string; x1: number; y1: number; x2: number; y2: number }>;

  const palette: Record<YieldBand, string> = {
    Low: '#f59e0b',
    Medium: '#14b8a6',
    High: '#2563eb',
  };

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <p className="db-chart-title">{FEATURE_LABELS[feature]} vs yield</p>
          <p className="db-chart-note">Scatter cloud with per-band trend lines.</p>
        </div>
        {actions && <div className="db-chart-actions">{actions}</div>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="db-chart-svg" style={{ overflow: 'visible' }}>
        <line x1={left} y1={top} x2={left} y2={height - bottom} className="db-chart-axis" />
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="db-chart-axis" />
        {isExpanded && (
          <>
            <text x={left - 42} y={top + usableHeight / 2} transform={`rotate(-90 ${left - 42} ${top + usableHeight / 2})`} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              Yield (kg/ha)
            </text>
            <text x={left + usableWidth / 2} y={height - 2} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              {FEATURE_LABELS[feature]}
            </text>
          </>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const xValue = minX + (maxX - minX) * tick;
          const x = xScale(xValue);
          return (
            <g key={tick}>
              <line x1={x} y1={height - bottom} x2={x} y2={height - bottom + 6} className="db-chart-tick" />
              <text x={x} y={height - 10} textAnchor="middle" className="db-chart-label">
                {formatNumber(xValue, 1)}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const yValue = minY + (maxY - minY) * tick;
          const y = yScale(yValue);
          return (
            <g key={tick}>
              <line x1={left - 6} y1={y} x2={left} y2={y} className="db-chart-tick" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="db-chart-label">
                {formatNumber(yValue, 1)}
              </text>
            </g>
          );
        })}
        {points.map((point, index) => (
          <circle
            key={`${point.band}-${index}`}
            cx={xScale(point.x)}
            cy={yScale(point.y)}
            r={4}
            className="db-chart-point"
            style={{ fill: palette[point.band], opacity: 0.82 }}
          />
        ))}
        {trendLines.map((line) => (
          <line
            key={line.band}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="db-chart-trend"
            style={{ stroke: palette[line.band as YieldBand] }}
          />
        ))}
      </svg>
      {isExpanded && (
        <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px', margin: '0 16px 12px', display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '13px', color: '#cbd5e1' }}>
          <span><strong style={{ color: '#fff' }}>X-axis:</strong> {FEATURE_LABELS[feature]}</span>
          <span><strong style={{ color: '#fff' }}>Y-axis:</strong> Yield (kg/ha)</span>
        </div>
      )}
      <div className="db-mini-legend">
        <span><i className="db-mini-dot low" />Low</span>
        <span><i className="db-mini-dot med" />Medium</span>
        <span><i className="db-mini-dot high" />High</span>
      </div>
    </div>
  );
}

function YieldVariationBars({
  variationByGenotype,
  actions,
  isExpanded,
}: {
  variationByGenotype: Map<number, number>;
  actions?: React.ReactNode;
  isExpanded?: boolean;
}) {
  const ranked = Array.from(variationByGenotype.entries()).sort((left, right) => right[1] - left[1]);
  const topItems = ranked.slice(0, 7);
  const maxValue = Math.max(0.001, topItems.length ? Math.max(...topItems.map((entry) => entry[1] || 0)) : 1);
  const width = 520;
  const height = 220;
  const left = 82;
  const right = 22;
  const top = 20;
  const bottom = 24;
  const laneHeight = (height - top - bottom) / Math.max(1, topItems.length);
  const barHeight = Math.min(20, laneHeight * 0.56);

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <p className="db-chart-title">Yield variation by genotype</p>
          <p className="db-chart-note">Higher variation is rendered in deeper blue.</p>
        </div>
        {actions && <div className="db-chart-actions">{actions}</div>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="db-chart-svg" style={{ overflow: 'visible' }}>
        {isExpanded && (
          <>
            <text x={left - 42} y={top + (height - top - bottom) / 2} transform={`rotate(-90 ${left - 42} ${top + (height - top - bottom) / 2})`} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              Genotype
            </text>
            <text x={left + (width - left - right) / 2} y={height - 2} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              Yield Variation (CV Ratio)
            </text>
          </>
        )}
        {topItems.map(([genotype, variation], index) => {
          const laneTop = top + laneHeight * index;
          const laneCenter = laneTop + laneHeight / 2;
          const safeVar = isNaN(variation) ? 0 : variation;
          const barWidth = (safeVar / maxValue) * (width - left - right);
          const safeBarWidth = isNaN(barWidth) ? 0 : barWidth;
          const shade = blueColor(safeVar / maxValue);

          return (
            <g key={genotype}>
              <text x={left - 10} y={laneCenter + 4} textAnchor="end" className="db-chart-label">
                G{genotype}
              </text>
              <rect
                x={left}
                y={laneCenter - barHeight / 2}
                width={Math.max(2, safeBarWidth)}
                height={barHeight}
                rx={999}
                className="db-chart-bar"
                style={{ fill: shade }}
              />
              <text x={left + safeBarWidth + 8} y={laneCenter + 4} className="db-chart-value">
                {formatNumber(safeVar, 2)}
              </text>
            </g>
          );
        })}
      </svg>
      {isExpanded && (
        <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px', margin: '0 16px 12px', display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '13px', color: '#cbd5e1' }}>
          <span><strong style={{ color: '#fff' }}>X-axis:</strong> Yield Variation (CV Ratio)</span>
          <span><strong style={{ color: '#fff' }}>Y-axis:</strong> Genotype</span>
        </div>
      )}
      <div className="db-mini-legend">
        <span><i className="db-mini-dot blue" />Variation scale</span>
      </div>
    </div>
  );
}

function GenotypeStabilityScatter({
  records,
  actions,
  isExpanded,
}: {
  records: PlotProperties[];
  actions?: React.ReactNode;
  isExpanded?: boolean;
}) {
  const points = useMemo<GenotypePoint[]>(() => {
    const grouped = new Map<number, number[]>();

    records.forEach((record) => {
      if (!Number.isFinite(record.Yield)) return;
      const bucket = grouped.get(record.genotype) ?? [];
      bucket.push(record.Yield);
      grouped.set(record.genotype, bucket);
    });

    return Array.from(grouped.entries()).map(([genotype, yields]) => {
      const average = mean(yields);
      const deviation = standardDeviation(yields);
      const cv = average === 0 ? 0 : (deviation / Math.abs(average)) * 100;
      const band = cv > 25 ? 'High' : cv >= 10 ? 'Moderate' : 'Low';

      return {
        genotype,
        meanYield: average,
        cv,
        band,
      } satisfies GenotypePoint;
    });
  }, [records]);

  const xValues = points.map((point) => point.meanYield);
  const yValues = points.map((point) => point.cv);
  const minX = xValues.length ? Math.min(...xValues) : 0;
  const maxX = xValues.length ? Math.max(...xValues) : 1;
  const minY = 0;
  const maxY = 100;
  
  const avgYield = xValues.length ? mean(xValues) : 0;
  const avgCV = yValues.length ? mean(yValues) : 0;

  const width = 520;
  const height = 230;
  const left = 54;
  const right = 22;
  const top = 24;
  const bottom = 36;
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;
  
  const xScale = (value: number) => {
    const res = left + normalize(value, minX, maxX) * usableWidth;
    return isNaN(res) ? left : res;
  };
  const yScale = (value: number) => {
    const res = top + (1 - normalize(value, minY, maxY)) * usableHeight;
    return isNaN(res) ? top + usableHeight : res;
  };

  const palette: Record<GenotypePoint['band'], string> = {
    Low: '#38bdf8',
    Moderate: '#fb923c',
    High: '#a855f7',
  };

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <p className="db-chart-title">Genotype stability map</p>
          <p className="db-chart-note">CV% vs mean yield quadrant analysis.</p>
        </div>
        {actions && <div className="db-chart-actions">{actions}</div>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="db-chart-svg" style={{ overflow: 'visible' }}>
        <line x1={left} y1={top} x2={left} y2={height - bottom} className="db-chart-axis" />
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="db-chart-axis" />
        
        {points.length > 0 && (
          <>
            <line x1={xScale(avgYield)} y1={top} x2={xScale(avgYield)} y2={height - bottom} style={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <line x1={left} y1={yScale(avgCV)} x2={width - right} y2={yScale(avgCV)} style={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
            
            <text x={left + 6} y={top + 14} className="db-chart-label" style={{ fill: '#64748b', fontSize: '10px' }}>Poor performers</text>
            <text x={width - right - 6} y={top + 14} textAnchor="end" className="db-chart-label" style={{ fill: '#64748b', fontSize: '10px' }}>High potential</text>
            <text x={left + 6} y={height - bottom - 6} className="db-chart-label" style={{ fill: '#64748b', fontSize: '10px' }}>Consistent, underperforming</text>
            <text x={width - right - 6} y={height - bottom - 6} textAnchor="end" className="db-chart-label" style={{ fill: '#38bdf8', fontSize: '10px', fontWeight: 'bold' }}>Stable Stars</text>
          </>
        )}

        {isExpanded && (
          <>
            <text x={left - 42} y={top + usableHeight / 2} transform={`rotate(-90 ${left - 42} ${top + usableHeight / 2})`} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              CV% (Coefficient of Variation)
            </text>
            <text x={left + usableWidth / 2} y={height - 2} textAnchor="middle" className="db-chart-label" style={{ fill: '#94a3b8', fontWeight: 'bold' }}>
              Mean Yield (kg/ha)
            </text>
          </>
        )}
        
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const xValue = minX + (maxX - minX) * tick;
          const x = xScale(xValue);
          return (
            <g key={tick}>
              <line x1={x} y1={height - bottom} x2={x} y2={height - bottom + 6} className="db-chart-tick" />
              <text x={x} y={height - 10} textAnchor="middle" className="db-chart-label">
                {formatNumber(xValue, 1)}
              </text>
            </g>
          );
        })}
        
        {[0, 20, 40, 60, 80, 100].map((yValue) => {
          const y = yScale(yValue);
          return (
            <g key={yValue}>
              <line x1={left - 6} y1={y} x2={left} y2={y} className="db-chart-tick" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="db-chart-label">
                {yValue}
              </text>
            </g>
          );
        })}
        
        {points.map((point) => (
          <g key={point.genotype}>
            <circle
              cx={xScale(point.meanYield)}
              cy={yScale(point.cv)}
              r={5}
              className="db-chart-point"
              style={{ fill: palette[point.band], opacity: 0.9, cursor: 'pointer' }}
            >
              <title>{`Genotype ${point.genotype}\nYield: ${formatNumber(point.meanYield, 1)} kg/ha\nCV: ${formatNumber(point.cv, 1)}%`}</title>
            </circle>
          </g>
        ))}
      </svg>
      {isExpanded && (
        <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px', margin: '0 16px 12px', display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '13px', color: '#cbd5e1' }}>
          <span><strong style={{ color: '#fff' }}>X-axis:</strong> Mean Yield (kg/ha)</span>
          <span><strong style={{ color: '#fff' }}>Y-axis:</strong> CV% (Coefficient of Variation)</span>
        </div>
      )}
      <div className="db-mini-legend">
        <span><i className="db-mini-dot" style={{ background: palette.Low }} />Low variation (&lt;10%)</span>
        <span><i className="db-mini-dot" style={{ background: palette.Moderate }} />Moderate (10-25%)</span>
        <span><i className="db-mini-dot" style={{ background: palette.High }} />High (&gt;25%)</span>
      </div>
    </div>
  );
}

function PerformanceBars({
  records,
  mode,
  actions,
}: {
  records: PlotProperties[];
  mode: 'top' | 'bottom';
  actions?: React.ReactNode;
}) {
  const stats = useMemo(() => {
    const grouped = new Map<number, number[]>();

    records.forEach((record) => {
      const bucket = grouped.get(record.genotype) ?? [];
      bucket.push(record.Yield);
      grouped.set(record.genotype, bucket);
    });

    return Array.from(grouped.entries()).map(([genotype, yields]) => ({
      genotype,
      meanYield: mean(yields),
    }));
  }, [records]);

  const sorted = stats.sort((left, right) => right.meanYield - left.meanYield);
  const entries = mode === 'top' ? sorted.slice(0, 6) : sorted.slice(-6).reverse();
  const maxValue = entries.length ? Math.max(...entries.map((entry) => entry.meanYield)) : 1;
  const width = 520;
  const height = 210;
  const left = 86;
  const right = 22;
  const top = 18;
  const bottom = 24;
  const laneHeight = (height - top - bottom) / Math.max(1, entries.length);
  const barHeight = Math.min(18, laneHeight * 0.6);
  const barColor = mode === 'top' ? '#16a34a' : '#ef4444';

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <p className="db-chart-title">{mode === 'top' ? 'Top performer genotypes' : 'Bottom performer genotypes'}</p>
          <p className="db-chart-note">Mean yield ranked by genotype.</p>
        </div>
        {actions && <div className="db-chart-actions">{actions}</div>}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="db-chart-svg">
        {entries.map((entry, index) => {
          const laneTop = top + laneHeight * index;
          const laneCenter = laneTop + laneHeight / 2;
          const barWidth = (entry.meanYield / maxValue) * (width - left - right);

          return (
            <g key={entry.genotype}>
              <text x={left - 10} y={laneCenter + 4} textAnchor="end" className="db-chart-label">
                G{entry.genotype}
              </text>
              <rect
                x={left}
                y={laneCenter - barHeight / 2}
                width={Math.max(2, barWidth)}
                height={barHeight}
                rx={999}
                className="db-chart-bar"
                style={{ fill: barColor }}
              />
              <text x={left + barWidth + 8} y={laneCenter + 4} className="db-chart-value">
                {formatNumber(entry.meanYield, 2)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TimeSeriesLineChart({
  seriesData,
  labels,
  selectedGenotype,
  selectedFeature,
  actions,
  isExpanded,
}: {
  seriesData: any[];
  labels: string[];
  selectedGenotype: string;
  selectedFeature: string;
  actions?: React.ReactNode;
  isExpanded?: boolean;
}) {
  const plots = useMemo(() => {
    if (selectedGenotype === 'all') return [];
    const baseFeature = selectedFeature.replace('_mean', '');
    return seriesData.filter((d) => String(d.genotype) === selectedGenotype && d.feature === baseFeature);
  }, [seriesData, selectedGenotype, selectedFeature]);

  if (selectedGenotype === 'all' || plots.length === 0) {
    return (
      <div className="db-chart-card">
        <div className="db-chart-head">
          <div>
            <p className="db-chart-title">Time Series</p>
            <p className="db-chart-note">Select a genotype to view over time.</p>
          </div>
        </div>
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13, textAlign: 'center', padding: '0 20px' }}>
          {selectedGenotype === 'all' ? 'Please select a specific genotype on the map or filter to view time series.' : 'No time series data available for this feature and genotype.'}
        </div>
      </div>
    );
  }

  const allValues = plots.flatMap((p) => p.values.filter((v: any) => v !== null && v !== undefined));
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const paddedMin = minVal - (maxVal - minVal) * 0.1;
  const paddedMax = maxVal + (maxVal - minVal) * 0.1;
  
  const width = isExpanded ? 800 : 520;
  const height = isExpanded ? 400 : 220;
  const left = 54;
  const right = 22;
  const top = 24;
  const bottom = 48;
  const usableWidth = width - left - right;
  const usableHeight = height - top - bottom;

  const nLabels = labels.length;
  const xScale = (i: number) => left + (i / Math.max(1, nLabels - 1)) * usableWidth;
  const yScale = (v: number) => {
    if (paddedMax === paddedMin) return top + usableHeight / 2;
    return top + (1 - (v - paddedMin) / (paddedMax - paddedMin)) * usableHeight;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  return (
    <div className="db-chart-card">
      <div className="db-chart-head">
        <div>
          <p className="db-chart-title">{FEATURE_LABELS[selectedFeature as FeatureKey] || selectedFeature} over time</p>
          <p className="db-chart-note">Genotype {selectedGenotype} ({plots.length} plot{plots.length !== 1 ? 's' : ''})</p>
        </div>
        {actions && <div className="db-chart-actions">{actions}</div>}
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="db-chart-svg" style={{ overflow: 'visible', minWidth: width }}>
          <line x1={left} y1={top} x2={left} y2={height - bottom} className="db-chart-axis" />
          <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="db-chart-axis" />
          
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const yValue = paddedMin + (paddedMax - paddedMin) * tick;
            const y = yScale(yValue);
            return (
              <g key={tick}>
                <line x1={left - 6} y1={y} x2={left} y2={y} className="db-chart-tick" />
                <line x1={left} y1={y} x2={width - right} y2={y} style={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '2 4' }} />
                <text x={left - 10} y={y + 4} textAnchor="end" className="db-chart-label">
                  {formatNumber(yValue, 2)}
                </text>
              </g>
            );
          })}
          
          {labels.map((lbl, i) => {
            const x = xScale(i);
            return (
              <g key={i}>
                <line x1={x} y1={height - bottom} x2={x} y2={height - bottom + 6} className="db-chart-tick" />
                <text x={x} y={height - bottom + 16} textAnchor={isExpanded ? 'middle' : 'end'} transform={isExpanded ? '' : `rotate(-45 ${x} ${height - bottom + 16})`} className="db-chart-label" style={{ fontSize: 9 }}>
                  {lbl}
                </text>
              </g>
            );
          })}
          
          {plots.map((p, idx) => {
            const color = COLORS[idx % COLORS.length];
            const pts = p.values.map((v: number | null, i: number) => v !== null && v !== undefined ? [xScale(i), yScale(v)] : null);
            
            const segments = [];
            let currentSegment = [];
            for (let i=0; i<pts.length; i++) {
              if (pts[i]) currentSegment.push(pts[i]);
              else if (currentSegment.length > 0) { segments.push(currentSegment); currentSegment = []; }
            }
            if (currentSegment.length > 0) segments.push(currentSegment);

            return (
              <g key={p.plot_id}>
                {segments.map((seg, sIdx) => {
                  const d = `M ${seg.map((pt: any) => `${pt[0]},${pt[1]}`).join(' L ')}`;
                  return <path key={sIdx} d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.7} />;
                })}
                {pts.map((pt: any, i: number) => pt && (
                  <circle key={i} cx={pt[0]} cy={pt[1]} r={3} fill={color} opacity={0.9}>
                    <title>{`Plot ${p.plot_id} - ${labels[i]}: ${formatNumber(p.values[i], 3)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      {isExpanded && (
        <div style={{ padding: '8px 12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px', margin: '0 16px 12px', display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '13px', color: '#cbd5e1' }}>
          <span><strong style={{ color: '#fff' }}>X-axis:</strong> Timepoint</span>
          <span><strong style={{ color: '#fff' }}>Y-axis:</strong> {FEATURE_LABELS[selectedFeature as FeatureKey] || selectedFeature}</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardAnalyticsMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<GeoJSON | null>(null);
  const hoveredLayerRef = useRef<Path | null>(null);
  const initRef = useRef(false);

  const [loaded, setLoaded] = useState(false);
  const [plotCount, setPlotCount] = useState(0);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('feature');
  const [selectedFeature, setSelectedFeature] = useState<FeatureKey>('fractional_cover_max_increase');
  const [featurePalette, setFeaturePalette] = useState<FeaturePalette>('blue-green-red');
  const [selectedGenotype, setSelectedGenotype] = useState<string>('all');
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [plots, setPlots] = useState<PlotProperties[]>([]);
  const [hovered, setHovered] = useState<PlotProperties | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uavExpanded, setUavExpanded] = useState(false);
  const [leftMenuExpanded, setLeftMenuExpanded] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  // Time Series State
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
  const [timestampLabels, setTimestampLabels] = useState<string[]>([]);
  const [effectiveSessionId, setEffectiveSessionId] = useState<string | null>(null);

  const router = useRouter();

  const exportTemporalTables = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/temporal/export`);
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `temporal_export_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Export failed');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadUser = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/auth/me`, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setCurrentUser(null);
            setAuthReady(true);
          }
          return;
        }
        const data = await res.json() as { user?: { name: string; email: string } };
        if (!cancelled) {
          setCurrentUser(data.user ?? null);
          setAuthReady(true);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthReady(true);
        }
      }
    };
    loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${BACKEND_BASE_URL}/user/reset-upload`, { method: 'POST', credentials: 'include' }).catch(() => {});
      await fetch(`${BACKEND_BASE_URL}/auth/signout`, { method: 'POST', credentials: 'include' });
      window.location.reload();
    } finally {
      setCurrentUser(null);
    }
  }, []);

  const handleResetData = useCallback(async () => {
    try {
      await fetch(`${BACKEND_BASE_URL}/user/reset-upload`, { method: 'POST', credentials: 'include' });
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset user data', err);
    }
  }, []);

  const requireAuth = useCallback((action: () => void) => {
    if (!currentUser) {
      router.push('/signin');
      return;
    }
    action();
  }, [currentUser, router]);

  const UAV_DATES = useMemo(() => [
    'Nov 17 2023', 'Nov 24 2023', 'Dec 01 2023', 'Dec 21 2023', 'Dec 29 2023',
    'Jan 05 2024', 'Jan 12 2024', 'Jan 19 2024', 'Jan 26 2024', 'Feb 02 2024',
    'Feb 16 2024', 'Feb 23 2024', 'Feb 29 2024', 'Mar 29 2024', 'Apr 04 2024', 'Apr 22 2024'
  ], []);

  const expandAction = useCallback((chartId: string) => (
    <button className="db-text-button" onClick={() => setExpandedChart(current => current === chartId ? null : chartId)}>
      ⛶ Expand
    </button>
  ), []);

  useEffect(() => {
    let cancelled = false;
    const loadTimeSeries = async () => {
      try {
        const infoRes = await fetch(`${BACKEND_BASE_URL}/user/last-upload/info`, { credentials: 'include' });
        let sid = null;
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          sid = infoData.session_id;
        }
        if (!cancelled) setEffectiveSessionId(sid);
        
        let labels = [...UAV_DATES];
        if (sid) {
          const sessRes = await fetch(`${BACKEND_BASE_URL}/session/${sid}/info`);
          if (sessRes.ok) {
            const sessData = await sessRes.json();
            if (sessData.timestamp_labels && sessData.timestamp_labels.length > 0) {
              labels = sessData.timestamp_labels;
            }
          }
        }
        if (!cancelled) setTimestampLabels(labels);
        
        const qs = sid ? `?session_id=${sid}` : '';
        const tsRes = await fetch(`${BACKEND_BASE_URL}/temporal/time-series${qs}`);
        if (tsRes.ok) {
          const tsData = await tsRes.json();
          if (!cancelled) setTimeSeriesData(tsData.series || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadTimeSeries();
    return () => { cancelled = true; };
  }, [UAV_DATES]);

  const availableGenotypes = useMemo(() => {
    // Exclude NaN entries — these come from uploaded shapefiles where the PLOT_ID
    // does not end in a numeric genotype code. They are still rendered on the map
    // but would break the genotype dropdown selector.
    return Array.from(new Set(plots.map((plot) => plot.genotype)))
      .filter((genotype) => Number.isFinite(genotype))
      .sort((left, right) => left - right);
  }, [plots]);

  const visiblePlots = useMemo(() => {
    // isEligibleGenotype is always true, so all plots are visible by default.
    // When a specific genotype is selected we match by value (NaN plots stay
    // visible under the 'all' selection but are excluded from a numeric filter).
    return plots.filter((plot) => {
      if (selectedGenotype === 'all') {
        return true;
      }
      return String(plot.genotype) === selectedGenotype;
    });
  }, [plots, selectedGenotype]);

  const visibleCount = visiblePlots.length;

  const visibleYieldValues = useMemo(() => visiblePlots.map((plot) => plot.Yield).filter(Number.isFinite), [visiblePlots]);
  const yieldThresholds = useMemo(() => {
    if (visibleYieldValues.length === 0) {
      return [0, 0] as [number, number];
    }
    return [quantile(visibleYieldValues, 0.33), quantile(visibleYieldValues, 0.66)] as [number, number];
  }, [visibleYieldValues]);

  const selectedFeatureValues = useMemo(() => {
    return visiblePlots
      .map((plot) => readFeatureValue(plot, selectedFeature))
      .filter(Number.isFinite);
  }, [selectedFeature, visiblePlots]);

  const featureRange = useMemo(() => {
    if (selectedFeatureValues.length === 0) {
      return [0, 1] as [number, number];
    }
    return [Math.min(...selectedFeatureValues), Math.max(...selectedFeatureValues)] as [number, number];
  }, [selectedFeatureValues]);

  const variationState = useMemo(() => buildYieldVariationMap(visiblePlots), [visiblePlots]);

  const selectedFeatureValue = hovered ? readFeatureValue(hovered, selectedFeature) : Number.NaN;

  const updateLayerStyles = useCallback(() => {
    if (!layerRef.current) {
      return;
    }

    layerRef.current.eachLayer((leafletLayer) => {
      const plotLayer = leafletLayer as Path & { feature?: { properties?: PlotProperties } };
      const plot = plotLayer.feature?.properties;
      if (!plot) {
        return;
      }

      plotLayer.setStyle(
        getPlotStyle({
          plot,
          analysisMode,
          highlighted: true,
          selectedFeature,
          selectedGenotype,
          featureRange,
          genotypeVariationById: variationState.variationByGenotype,
          genotypeVariationRange: variationState.variationRange,
          palette: featurePalette,
        })
      );
    });
  }, [analysisMode, featurePalette, featureRange, selectedFeature, selectedGenotype, variationState]);

  useEffect(() => {
    updateLayerStyles();
  }, [updateLayerStyles]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!containerRef.current || mapRef.current || initRef.current) {
        return;
      }

      initRef.current = true;

      const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (container._leaflet_id) {
        delete container._leaflet_id;
      }

      const L = (await import('leaflet')).default;
      const samplePlotsUrl = `${BACKEND_BASE_URL}/samples/plots.geojson`;
      const sampleTemporalUrl = `${BACKEND_BASE_URL}/samples/temporalDataSet.csv`;
      const userPlotsUrl = `${BACKEND_BASE_URL}/user/last-upload/geojson`;
      const userTemporalUrl = `${BACKEND_BASE_URL}/user/last-upload/temporal-csv`;

      let plotResponse: Response | null = null;
      let csvResponse: Response | null = null;

      try {
        [plotResponse, csvResponse] = await Promise.all([
          fetch(userPlotsUrl, { credentials: 'include' }),
          fetch(userTemporalUrl, { credentials: 'include' }),
        ]);
      } catch {
        plotResponse = null;
        csvResponse = null;
      }

      if (!plotResponse?.ok) {
        plotResponse = await fetch(samplePlotsUrl);
      }

      if (!csvResponse?.ok) {
        csvResponse = await fetch(sampleTemporalUrl);
      }

      if (!plotResponse.ok) {
        throw new Error('Could not load plot geometry.');
      }

      if (!csvResponse.ok) {
        throw new Error('Could not load temporal dataset.');
      }

      const geometry = (await plotResponse.json()) as PlotCollection;

      // Automatically calibrate the GeoJSON points to align with Esri satellite imagery
      // This default offset corrects the right/down misalignment seen on the basemap
      const AUTO_LAT_OFFSET = 0.000016; // Shift North
      const AUTO_LNG_OFFSET = -0.000032; // Shift West

      geometry.features.forEach(feature => {
        feature.geometry.coordinates.forEach(ring => {
          ring.forEach(coord => {
            coord[0] += AUTO_LNG_OFFSET;
            coord[1] += AUTO_LAT_OFFSET;
          });
        });
      });
      const temporalText = await csvResponse.text();
      const temporalRecords = parseTemporalData(temporalText);
      const merged = mergePlotData(geometry, temporalRecords);

      if (!isMounted) {
        return;
      }

      const map = L.map(containerRef.current, {
        center: [33.673, 73.1316],
        zoom: 17,
        zoomControl: false,
        preferCanvas: true,
      });

      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxNativeZoom: 19,
          maxZoom: 19,
        }
      ).addTo(map);

      const geoLayer = L.geoJSON(merged, {
        style: (feature) => {
          const plot = feature?.properties as PlotProperties | undefined;
          if (!plot) {
            return HIDDEN_STYLE;
          }

          return getPlotStyle({
            plot,
            analysisMode,
            highlighted: true,
            selectedFeature,
            selectedGenotype,
            featureRange,
            genotypeVariationById: variationState.variationByGenotype,
            genotypeVariationRange: variationState.variationRange,
            palette: featurePalette,
          });
        },
        onEachFeature(feature: PlotFeature, layer) {
          const plot = feature.properties as PlotProperties;
          const plotLayer = layer as Path & {
            bindTooltip: (html: string, options?: { sticky?: boolean; className?: string; opacity?: number }) => void;
            on: (eventName: string, handler: () => void) => void;
          };

          plotLayer.bindTooltip(
            `<div class="tt-inner"><span class="tt-id">Plot #${plot.plot_id}</span><span class="tt-exp">Genotype ${plot.genotype} · ${FEATURE_LABELS[selectedFeature]}</span></div>`,
            { sticky: true, className: 'map-tooltip', opacity: 1 }
          );

          plotLayer.on('mouseover', () => {
            if (!isMounted || !mapRef.current) {
              return;
            }

            hoveredLayerRef.current = plotLayer;
            setHovered(plot);
            plotLayer.setStyle({ color: HOVER_COLOR, fillColor: HOVER_COLOR, fillOpacity: 0.82, opacity: 1, weight: 2.4 });
            plotLayer.bringToFront();
          });

          plotLayer.on('mouseout', () => {
            if (!isMounted) {
              return;
            }

            if (hoveredLayerRef.current === plotLayer) {
              hoveredLayerRef.current = null;
            }

            setHovered(null);
            plotLayer.setStyle(
              getPlotStyle({
                plot,
                analysisMode,
                highlighted: true,
                selectedFeature,
                selectedGenotype,
                featureRange,
                genotypeVariationById: variationState.variationByGenotype,
                genotypeVariationRange: variationState.variationRange,
                palette: featurePalette,
              })
            );
          });

          plotLayer.on('click', () => {
            setSelectedGenotype(String(plot.genotype));
            setAnalysisMode('genotype');
          });
        },
      }).addTo(map);

      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      mapRef.current = map;
      layerRef.current = geoLayer;
      setPlots(
        merged.features.map((feature) => ({
          ...feature.properties,
        }))
      );
      setPlotCount(merged.features.length);
      setLoaded(true);
    }

    init().catch((error) => {
      console.error(error);
      setLoadError(error instanceof Error ? error.message : 'Unable to load map data.');
      initRef.current = false;
    });

    return () => {
      isMounted = false;
      hoveredLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      initRef.current = false;
      if (containerRef.current) {
        const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number };
        if (container._leaflet_id) {
          delete container._leaflet_id;
        }
      }
    };
  }, []);

  useEffect(() => {
    updateLayerStyles();
  }, [updateLayerStyles]);

  const handleFocus = useCallback(() => {
    const map = mapRef.current;
    const layer = layerRef.current;

    if (!map || !layer) {
      return;
    }

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], animate: true });
    }
  }, []);

  const handleToggleHighlights = useCallback(() => {
    setSelectedGenotype('all');
    setAnalysisMode('feature');
  }, []);

  const handleModeChange = useCallback((mode: AnalysisMode) => {
    setAnalysisMode(mode);
  }, []);

  const handleFeatureChange = useCallback((feature: FeatureKey) => {
    setSelectedFeature(feature);
    setAnalysisMode('feature');
  }, []);

  const handleGenotypeChange = useCallback((genotype: string) => {
    setSelectedGenotype(genotype);
    setAnalysisMode('genotype');
  }, []);

  const toggleChart = useCallback((chartId: string) => {
    setExpandedChart((current) => (current === chartId ? null : chartId));
  }, []);

  const shiftLayer = useCallback((latOffset: number, lngOffset: number) => {
    if (!layerRef.current) return;

    layerRef.current.eachLayer((leafletLayer) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const path = leafletLayer as any;
      if (typeof path.getLatLngs === 'function' && typeof path.setLatLngs === 'function') {
        const latlngs = path.getLatLngs();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shiftRecursive = (coords: any) => {
          if (Array.isArray(coords)) {
            for (let i = 0; i < coords.length; i++) {
              shiftRecursive(coords[i]);
            }
          } else if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
            coords.lat += latOffset;
            coords.lng += lngOffset;
          }
        };

        shiftRecursive(latlngs);
        path.setLatLngs(latlngs);
      }
    });
  }, []);

  return (
    <div className="db-root dashboard-shell">
      {comingSoonFeature && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setComingSoonFeature(null)}>
          <div style={{ backgroundColor: '#1e293b', padding: '32px', borderRadius: '12px', textAlign: 'center', border: '1px solid #3b82f6', color: 'white', maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: 'bold' }}>{comingSoonFeature}</h2>
            <p style={{ color: '#94a3b8', marginBottom: '24px', lineHeight: '1.5' }}>This feature is currently under development and will be available in a future update.</p>
            <button className="db-btn" style={{ padding: '12px 24px', fontSize: '16px' }} onClick={() => setComingSoonFeature(null)}>Got it</button>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', left: leftMenuExpanded ? 0 : '-280px', top: '70px', bottom: 0, width: '280px',
        backgroundColor: '#ffffff', borderRight: '1px solid #e5e7eb', transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1000, display: 'flex', flexDirection: 'column', boxShadow: leftMenuExpanded ? '4px 0 15px rgba(15, 23, 42, 0.12)' : 'none'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Advanced Tools</h3>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { label: 'Upload Reflectance Map & Shapefile', route: '/upload' },
            { label: 'Temporal Analysis', route: '/temporal' },
            { label: 'Yield Prediction', route: '/yield-prediction' },
            { label: 'AI Chat Assistant', route: '/assistant' },
            { label: 'Export Tables & Data', route: null },
          ].map(({ label, route }) => (
            <button
              key={label}
              style={{ padding: '14px 16px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#0f172a', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => {
                if (label === 'Upload Reflectance Map & Shapefile' || label === 'AI Chat Assistant') {
                  requireAuth(() => {
                    if (route) { router.push(route); }
                  });
                  return;
                }
                if (route) { router.push(route); return; }
                if (label === 'Export Tables & Data') { exportTemporalTables(); return; }
              }}
              onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseOut={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >
              <span>{label}</span>
              <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>OPEN →</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setLeftMenuExpanded(!leftMenuExpanded)}
        style={{
          position: 'absolute', left: leftMenuExpanded ? '280px' : 0, top: '50%', transform: 'translateY(-50%)',
          backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '24px 8px',
          borderTopRightRadius: '8px', borderBottomRightRadius: '8px', cursor: 'pointer',
          zIndex: 999, transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '2px 0 8px rgba(15, 23, 42, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        title={leftMenuExpanded ? 'Close Menu' : 'Open Tools Menu'}
      >
        {leftMenuExpanded ? '◀' : '▶'}
      </button>
      {expandedChart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }} onClick={() => setExpandedChart(null)}>
          <div style={{ backgroundColor: '#0f172a', width: '100%', maxWidth: '1000px', borderRadius: '12px', padding: '24px', position: 'relative', border: '1px solid #334155' }} onClick={(e) => e.stopPropagation()}>
            <button style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer', zIndex: 10 }} onClick={() => setExpandedChart(null)}>✕ Close</button>
            {expandedChart === 'feature-boxplot' && <FeatureBoxplot records={visiblePlots} feature={selectedFeature} yieldThresholds={yieldThresholds} />}
            {expandedChart === 'scatter-plot' && <ScatterPlot records={visiblePlots} feature={selectedFeature} yieldThresholds={yieldThresholds} />}
            {expandedChart === 'yield-variation' && <YieldVariationBars variationByGenotype={variationState.variationByGenotype} />}
            {expandedChart === 'genotype-stability' && <GenotypeStabilityScatter records={visiblePlots} />}
            {expandedChart === 'time-series' && <TimeSeriesLineChart seriesData={timeSeriesData} labels={timestampLabels} selectedGenotype={selectedGenotype} selectedFeature={selectedFeature} isExpanded={true} />}
          </div>
        </div>
      )}
      <div className="db-topbar">
        <div className="db-topbar-left">
          <span className="db-logo">🌾</span>
          <div>
            <h1 className="db-title">Agricultural Plot Dashboard</h1>
            <p className="db-meta">
              {loaded
                ? 'Agricultural plot performance analytics and satellite mapping'
                : loadError ?? 'Loading plot geometry and temporal data...'}
            </p>
          </div>
        </div>
        <div className="db-topbar-right">
          {hovered && (
            <div className="db-probe">
              <span className="db-probe-label">Plot #{hovered.plot_id}</span>
              <span className="db-probe-chip">G{hovered.genotype}</span>
              <span className="db-probe-sep">|</span>
              <span className="db-probe-exp">{FEATURE_LABELS[selectedFeature]} {formatNumber(selectedFeatureValue, 2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
            {!authReady ? null : currentUser ? (
              <>
                <span style={{ fontSize: 12, color: '#475569' }}>{currentUser.name || currentUser.email}</span>
                <button className="db-btn" type="button" onClick={handleResetData} title="Clear your uploaded data and view sample data">Load Sample Data</button>
                <button className="db-btn" type="button" onClick={handleLogout}>Logout</button>
              </>
            ) : (
              <>
                <button className="db-btn" type="button" onClick={() => router.push('/signin')}>Sign in</button>
                <button className="db-btn" type="button" onClick={() => router.push('/signup')}>Sign up</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="db-body">
        <div className="db-map-col">
          <div className="db-mapbar">
            <div className="db-mapbar-left">
              <span className="db-mapbar-label">Field plots</span>
            </div>
            <div className="db-mapbar-right">
              <button id="btn-focus" className="db-btn" onClick={handleFocus} type="button">
                ⊕ Focus
              </button>
              <button id="btn-toggle" className="db-btn db-btn-toggle is-on" onClick={handleToggleHighlights} type="button">
                <span className="db-toggle-dot" />
                Reset filters
              </button>
            </div>
          </div>

          <div className="db-map-wrap">
            {!loaded && !loadError && (
              <div className="db-loader">
                <div className="db-spinner" />
                <p>Loading satellite imagery and plot analytics...</p>
              </div>
            )}
            {loadError && (
              <div className="db-loader db-loader-error">
                <div className="db-loader-title">Data source unavailable</div>
                <p>{loadError}</p>
              </div>
            )}
            <div ref={containerRef} className="db-map" />
          </div>

          <div className="db-legend-bar">
            {analysisMode === 'feature' && (
              <>
                <span className="db-leg">
                  <span className="db-leg-gradient feature" />
                  {FEATURE_LABELS[selectedFeature]}
                </span>
                <span className="db-leg-hint">Heat map for genotypes above 3</span>
              </>
            )}
            {analysisMode === 'genotype' && (
              <>
                <span className="db-leg">
                  <span className="db-leg-swatch" style={{ background: GREEN_FILL }} />
                  Selected genotype
                </span>
                <span className="db-leg-hint">Click a plot to isolate its genotype</span>
              </>
            )}
            {analysisMode === 'yield-variation' && (
              <>
                <span className="db-leg">
                  <span className="db-leg-gradient blue" />
                  Yield variation by genotype
                </span>
                <span className="db-leg-hint">Deeper blue means higher variation</span>
              </>
            )}
          </div>
        </div>

        <aside className="db-sidebar">
          <section className="db-sidebar-section">
            <div className="db-section-head">
              <div>
                <p className="db-sidebar-section-title">Analysis mode</p>
                <h2 className="db-section-title">Map controls</h2>
              </div>
              <span className="db-section-badge">{analysisMode.replace('-', ' ')}</span>
            </div>
            <div className="db-select-row">
              <label className="db-select-label" htmlFor="analysis-mode">Analysis</label>
              <select
                id="analysis-mode"
                className="db-select"
                value={analysisMode}
                onChange={(event) => handleModeChange(event.target.value as AnalysisMode)}
              >
                <option value="feature">Feature heat map</option>
                <option value="genotype">Genotype focus</option>
                <option value="yield-variation">Yield variation</option>
              </select>
            </div>
            <div className="db-stat-grid">

              <div className="db-stat-card">
                <span className="db-stat-label">Genotypes</span>
                <strong>{availableGenotypes.length}</strong>
              </div>
            </div>
          </section>

          <section className="db-sidebar-section">
            <div className="db-section-head">
              <div>
                <p className="db-sidebar-section-title">Calibration</p>
                <h2 className="db-section-title">Align Plots</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', maxWidth: '120px', margin: '0 auto', textAlign: 'center' }}>
              <div />
              <button className="db-btn" onClick={() => shiftLayer(0.000005, 0)} type="button">↑</button>
              <div />
              <button className="db-btn" onClick={() => shiftLayer(0, -0.000005)} type="button">←</button>
              <button className="db-btn" onClick={() => shiftLayer(-0.000005, 0)} type="button">↓</button>
              <button className="db-btn" onClick={() => shiftLayer(0, 0.000005)} type="button">→</button>
            </div>
            <p className="db-sidebar-section-title" style={{ textAlign: 'center', marginTop: '8px' }}>Nudge to align with satellite</p>
          </section>

          <section className="db-sidebar-section">
            <div className="db-section-head">
              <div>
                <p className="db-sidebar-section-title">Genotype filter</p>
                <h2 className="db-section-title">Only genotype numbers greater than 3</h2>
              </div>
              <button className="db-text-button" type="button" onClick={() => handleGenotypeChange('all')}>
                Reset
              </button>
            </div>
            <div className="db-select-row">
              <label className="db-select-label" htmlFor="genotype-select">Genotype</label>
              <select
                id="genotype-select"
                className="db-select"
                value={selectedGenotype}
                onChange={(event) => handleGenotypeChange(event.target.value)}
              >
                <option value="all">All eligible</option>
                {availableGenotypes.map((genotype) => (
                  <option key={genotype} value={String(genotype)}>
                    G{genotype}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="db-sidebar-section">
            <div className="db-section-head">
              <div>
                <p className="db-sidebar-section-title">Feature selection</p>
                <h2 className="db-section-title">Mean and trend metrics</h2>
              </div>
            </div>
            <div className="db-select-row">
              <label className="db-select-label" htmlFor="feature-select">Feature</label>
              <select
                id="feature-select"
                className="db-select"
                value={selectedFeature}
                onChange={(event) => handleFeatureChange(event.target.value as FeatureKey)}
              >
                {FEATURE_OPTIONS.map((feature) => (
                  <option key={feature} value={feature}>
                    {FEATURE_LABELS[feature]}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="db-sidebar-section">
            <div className="db-section-head">
              <div>
                <p className="db-sidebar-section-title">Color Scheme</p>
                <h2 className="db-section-title">Map palette</h2>
              </div>
            </div>
            <div className="db-select-row">
              <select
                className="db-select"
                value={featurePalette}
                onChange={(event) => setFeaturePalette(event.target.value as FeaturePalette)}
              >
                <option value="blue-green-red">Blue-Green-Red (Default)</option>
                <option value="blue-teal-amber">Blue-Teal-Amber (High Contrast)</option>
              </select>
            </div>
          </section>

          <section className="db-sidebar-section">
            <FeatureBoxplot records={visiblePlots} feature={selectedFeature} yieldThresholds={yieldThresholds} actions={expandAction('feature-boxplot')} />
          </section>

          <section className="db-sidebar-section">
            <ScatterPlot records={visiblePlots} feature={selectedFeature} yieldThresholds={yieldThresholds} actions={expandAction('scatter-plot')} />
          </section>

          <section className="db-sidebar-section">
            <GenotypeStabilityScatter records={visiblePlots} actions={expandAction('genotype-stability')} />
          </section>

          <section className="db-sidebar-section">
            <TimeSeriesLineChart seriesData={timeSeriesData} labels={timestampLabels} selectedGenotype={selectedGenotype} selectedFeature={selectedFeature} actions={expandAction('time-series')} />
          </section>

          <section className="db-sidebar-section">
            <YieldVariationBars variationByGenotype={variationState.variationByGenotype} actions={expandAction('yield-variation')} />
          </section>

          <section className="db-sidebar-section db-sidebar-section-last">
            <div className="db-section-head" onClick={() => setUavExpanded(!uavExpanded)} style={{ cursor: 'pointer' }}>
              <div>
                <h2 className="db-section-title">UAV Timestamps</h2>
                <p className="db-sidebar-section-title">Static timeline dates</p>
              </div>
              <button className="db-text-button" type="button">
                {uavExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>
            {uavExpanded && (
              <div style={{ display: 'grid', gap: '8px', marginTop: '16px' }}>
                {UAV_DATES.map((date) => (
                  <div key={date} style={{ padding: '8px', borderBottom: '1px solid #334155', color: '#000000', fontSize: '14px' }}>
                    {date}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

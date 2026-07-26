'use client';

// Interactive map: MapLibre basemap (Carto raster, theme-aware) + deck.gl
// overlays. Deals come from /api/map/deals (live, filter-aware); reference
// layers (CN projects, US activity, facilities, cables, EEZ, countries) are
// static GeoJSON files pre-exported to Supabase Storage by `npm run
// export:tiles` — heavy geometry never transits a serverless function.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map as MaplibreMap, NavigationControl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
import type { PickingInfo, Layer } from '@deck.gl/core';
import type { FeatureCollection as GeoJsonFC } from 'geojson';
import {
  scoreFillColor, dealRadiusPx, isApproximate, cnRadiusPx, choroplethColor,
  CN_POINT_COLOR, US_POINT_COLOR, US_LEADING_COLOR, FACILITY_COLOR,
  CABLE_COLOR, EEZ_LINE_COLOR, CHORO_BUCKETS, basemapStyle, LAYER_FILES,
  type RGBA,
} from '@/lib/geo/mapStyle';
import { formatUsd, formatScore, formatStage } from '@/lib/utils/format';
import type { LifecycleStage } from '@/lib/types';

type GeoFeature = {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
};
type FC = { type: 'FeatureCollection'; features: GeoFeature[] };

const EMPTY_FC: FC = { type: 'FeatureCollection', features: [] };

interface Toggles {
  deals: boolean;
  cn: boolean;
  us: boolean;
  facilities: boolean;
  cables: boolean;
  eez: boolean;
  choropleth: boolean;
}

const DEFAULT_TOGGLES: Toggles = {
  deals: true, cn: true, us: true, facilities: false, cables: true, eez: false, choropleth: false,
};

interface Popup {
  x: number;
  y: number;
  kind: 'deal' | 'cn' | 'us' | 'facility' | 'cable';
  props: Record<string, unknown>;
}

export default function MapView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const layerCache = useRef<Record<string, FC | Record<string, { usd: number; count: number }> | null>>({});

  const [layersBase, setLayersBase] = useState<string | null>(null);
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES);
  const [dealFc, setDealFc] = useState<FC>(EMPTY_FC);
  const [counts, setCounts] = useState<{ total: number; located: number }>({ total: 0, located: 0 });
  const [popup, setPopup] = useState<Popup | null>(null);
  const [missingLayers, setMissingLayers] = useState<string[]>([]);
  const [dark, setDark] = useState(false);
  const [, bumpVersion] = useState(0); // re-render when a cached layer arrives

  const paramString = searchParams.toString();

  // ── Map + overlay lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const isDark = document.documentElement.classList.contains('dark');
    setDark(isDark);

    const map = new MaplibreMap({
      container: containerRef.current,
      style: basemapStyle(isDark) as unknown as StyleSpecification,
      center: [30, 12],
      zoom: 1.7,
      minZoom: 1,
      maxZoom: 14,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);

    mapRef.current = map;
    overlayRef.current = overlay;

    // Follow the app's theme toggle (ThemeToggle flips the `dark` class on <html>).
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains('dark');
      setDark((prev) => {
        if (prev !== nowDark) {
          map.setStyle(basemapStyle(nowDark) as unknown as StyleSpecification);
        }
        return nowDark;
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // ── Config (where the static layers live) ───────────────────────────────
  useEffect(() => {
    fetch('/api/map/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.layersBase) setLayersBase(j.layersBase); })
      .catch(() => {});
  }, []);

  // ── Live deal points, following the table's filters ─────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/map/deals?${paramString}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setDealFc(j.geojson ?? EMPTY_FC);
        setCounts({ total: j.total ?? 0, located: j.located ?? 0 });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [paramString]);

  // ── Static reference layers, fetched lazily per toggle ──────────────────
  useEffect(() => {
    if (!layersBase) return;
    const wanted: Array<[keyof typeof LAYER_FILES, boolean]> = [
      ['cnProjects', toggles.cn],
      ['usActivity', toggles.us],
      ['facilities', toggles.facilities],
      ['cables', toggles.cables],
      ['eez', toggles.eez],
      ['countries', toggles.choropleth],
      ['cnCountrySums', toggles.choropleth],
    ];
    for (const [key, on] of wanted) {
      if (!on || key in layerCache.current) continue;
      layerCache.current[key] = null; // in flight
      fetch(`${layersBase}/${LAYER_FILES[key]}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j) => {
          layerCache.current[key] = j;
          bumpVersion((v) => v + 1);
        })
        .catch(() => {
          delete layerCache.current[key];
          setMissingLayers((m) => (m.includes(key) ? m : [...m, key]));
        });
    }
  }, [layersBase, toggles]);

  // ── Interactions ────────────────────────────────────────────────────────
  const applyCountryFilter = useCallback(
    (iso3: string) => {
      const params = new URLSearchParams(paramString);
      params.set('host_country', iso3);
      router.push(`/dashboard/map?${params.toString()}`);
    },
    [paramString, router]
  );

  const onDeckClick = useCallback(
    (info: PickingInfo, kind: Popup['kind'] | 'country') => {
      if (!info.object) { setPopup(null); return; }
      if (kind === 'country') {
        const iso3 = (info.object as GeoFeature).properties?.iso3;
        if (typeof iso3 === 'string') applyCountryFilter(iso3);
        return;
      }
      const props = (info.object as GeoFeature).properties ?? {};
      setPopup({ x: info.x, y: info.y, kind, props });
    },
    [applyCountryFilter]
  );

  // ── deck.gl layers ──────────────────────────────────────────────────────
  const deckLayers = useMemo(() => {
    const cache = layerCache.current;
    const layers: Layer[] = [];

    if (toggles.choropleth && cache.countries && cache.cnCountrySums) {
      const sums = cache.cnCountrySums as Record<string, { usd: number; count: number }>;
      layers.push(
        new GeoJsonLayer({
          id: 'choropleth',
          data: cache.countries as unknown as GeoJsonFC,
          pickable: true,
          stroked: true,
          filled: true,
          getFillColor: (f) =>
            choroplethColor(sums[String((f as GeoFeature).properties?.iso3)]?.usd),
          getLineColor: dark ? [255, 255, 255, 25] : [0, 0, 0, 20],
          getLineWidth: 1,
          lineWidthUnits: 'pixels',
          onClick: (info) => onDeckClick(info, 'country'),
        })
      );
    }

    if (toggles.eez && cache.eez) {
      layers.push(
        new GeoJsonLayer({
          id: 'eez',
          data: cache.eez as unknown as GeoJsonFC,
          stroked: true,
          filled: false,
          getLineColor: EEZ_LINE_COLOR,
          getLineWidth: 1,
          lineWidthUnits: 'pixels',
        })
      );
    }

    if (toggles.cables && cache.cables) {
      layers.push(
        new GeoJsonLayer({
          id: 'cables',
          data: cache.cables as unknown as GeoJsonFC,
          pickable: true,
          stroked: true,
          filled: false,
          getLineColor: CABLE_COLOR,
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          onClick: (info) => onDeckClick(info, 'cable'),
        })
      );
    }

    if (toggles.facilities && cache.facilities) {
      layers.push(
        new ScatterplotLayer({
          id: 'facilities',
          data: (cache.facilities as FC).features,
          pickable: true,
          getPosition: (f: GeoFeature) => (f.geometry.coordinates as [number, number]),
          getFillColor: FACILITY_COLOR,
          getRadius: 2,
          radiusUnits: 'pixels',
          onClick: (info) => onDeckClick(info, 'facility'),
        })
      );
    }

    if (toggles.cn && cache.cnProjects) {
      layers.push(
        new ScatterplotLayer({
          id: 'cn-projects',
          data: (cache.cnProjects as FC).features,
          pickable: true,
          getPosition: (f: GeoFeature) => (f.geometry.coordinates as [number, number]),
          getFillColor: CN_POINT_COLOR,
          getRadius: (f: GeoFeature) => cnRadiusPx(f.properties?.usd as number | null),
          radiusUnits: 'pixels',
          onClick: (info) => onDeckClick(info, 'cn'),
        })
      );
    }

    if (toggles.us && cache.usActivity) {
      layers.push(
        new ScatterplotLayer({
          id: 'us-activity',
          data: (cache.usActivity as FC).features,
          pickable: true,
          getPosition: (f: GeoFeature) => (f.geometry.coordinates as [number, number]),
          getFillColor: (f: GeoFeature) =>
            (f.properties?.leading ? US_LEADING_COLOR : US_POINT_COLOR),
          getRadius: 3.5,
          radiusUnits: 'pixels',
          onClick: (info) => onDeckClick(info, 'us'),
        })
      );
    }

    if (toggles.deals) {
      layers.push(
        new ScatterplotLayer({
          id: 'deals',
          data: dealFc.features,
          pickable: true,
          stroked: true,
          filled: true,
          getPosition: (f: GeoFeature) => (f.geometry.coordinates as [number, number]),
          // Country-centroid deals render hollow — honest about precision.
          getFillColor: (f: GeoFeature): RGBA => {
            const c = scoreFillColor(f.properties?.score as number | null);
            return isApproximate(f.properties?.precision as string | null)
              ? [c[0], c[1], c[2], 0]
              : c;
          },
          getLineColor: (f: GeoFeature): RGBA => {
            const c = scoreFillColor(f.properties?.score as number | null);
            return [c[0], c[1], c[2], 255];
          },
          getRadius: (f: GeoFeature) => dealRadiusPx(f.properties?.value as number | null),
          radiusUnits: 'pixels',
          lineWidthMinPixels: 1.5,
          onClick: (info) => onDeckClick(info, 'deal'),
        })
      );
    }

    return layers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggles, dealFc, dark, onDeckClick, layerCache.current.cnProjects, layerCache.current.usActivity, layerCache.current.facilities, layerCache.current.cables, layerCache.current.eez, layerCache.current.countries, layerCache.current.cnCountrySums]);

  useEffect(() => {
    overlayRef.current?.setProps({
      layers: deckLayers,
      getCursor: ({ isHovering, isDragging }) =>
        isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab',
    });
  }, [deckLayers]);

  const toggle = (key: keyof Toggles) =>
    setToggles((t) => ({ ...t, [key]: !t[key] }));

  return (
    <div className="space-y-3">
      {/* Layer toggles + counts */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <TogglePill label="Deals" on={toggles.deals} onClick={() => toggle('deals')} swatch={[249, 115, 22, 255]} />
        <TogglePill label="Chinese projects" on={toggles.cn} onClick={() => toggle('cn')} swatch={CN_POINT_COLOR} />
        <TogglePill label="US activity" on={toggles.us} onClick={() => toggle('us')} swatch={US_POINT_COLOR} />
        <TogglePill label="Cables" on={toggles.cables} onClick={() => toggle('cables')} swatch={CABLE_COLOR} />
        <TogglePill label="Ports & terminals" on={toggles.facilities} onClick={() => toggle('facilities')} swatch={FACILITY_COLOR} />
        <TogglePill label="EEZ" on={toggles.eez} onClick={() => toggle('eez')} swatch={EEZ_LINE_COLOR} />
        <TogglePill label="CN $ by country" on={toggles.choropleth} onClick={() => toggle('choropleth')} swatch={[124, 58, 237, 200]} />
        <span className="ml-auto text-muted-foreground">
          {counts.located} of {counts.total} filtered deal{counts.total !== 1 ? 's' : ''} located
        </span>
      </div>

      {missingLayers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Missing map layer{missingLayers.length > 1 ? 's' : ''}: {missingLayers.join(', ')} — run{' '}
          <code className="font-mono">npm run export:tiles</code> after loading reference data
          (and run <code className="font-mono">lib/db/geo3.sql</code> in Supabase first).
        </div>
      )}

      {/* Map canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm">
        <div ref={containerRef} className="h-[68vh] min-h-[440px] w-full" />

        {popup && (
          <MapPopup popup={popup} onClose={() => setPopup(null)} />
        )}

        {toggles.choropleth && (
          <div className="absolute bottom-3 left-3 rounded-xl border border-border bg-card/90 backdrop-blur px-3 py-2 text-[11px] space-y-1">
            <div className="font-medium text-foreground">Chinese commitments (cumulative)</div>
            {CHORO_BUCKETS.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: rgbaCss(b.color) }}
                />
                {b.label}
              </div>
            ))}
            <div className="text-muted-foreground/70 pt-0.5">Click a country to filter deals</div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Hollow rings are country-level estimates (no precise site known). Dot size scales with
        reported value. Click any point for details; click a shaded country to filter the deal list.
      </p>
    </div>
  );
}

function rgbaCss(c: RGBA): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] / 255).toFixed(2)})`;
}

function TogglePill({
  label, on, onClick, swatch,
}: { label: string; on: boolean; onClick: () => void; swatch: RGBA }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors ${
        on
          ? 'border-border bg-card text-foreground'
          : 'border-transparent bg-secondary/60 text-muted-foreground hover:text-foreground'
      }`}
    >
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${on ? '' : 'opacity-30'}`}
        style={{ backgroundColor: rgbaCss(swatch) }}
      />
      {label}
    </button>
  );
}

function MapPopup({ popup, onClose }: { popup: Popup; onClose: () => void }) {
  const p = popup.props;
  // Keep the card inside the canvas: flip when close to the right/top edge.
  const style: React.CSSProperties = {
    left: Math.max(8, popup.x - 130),
    top: popup.y + 14,
  };
  return (
    <div
      className="absolute z-10 w-[260px] rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg p-3 text-xs animate-fade-in"
      style={style}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Close"
      >
        ✕
      </button>
      {popup.kind === 'deal' && (
        <div className="space-y-1.5 pr-4">
          <div className="font-medium text-foreground leading-snug">{String(p.title ?? '')}</div>
          <div className="text-muted-foreground">
            Score {formatScore((p.score as number) ?? null)}
            {p.stage ? ` · ${formatStage(p.stage as LifecycleStage)}` : ''}
            {typeof p.value === 'number' && p.value > 0 ? ` · ${formatUsd(p.value as number)}` : ''}
          </div>
          {p.precision === 'country_centroid' && (
            <div className="text-muted-foreground/70">Approximate (country-level) location</div>
          )}
          <a href={`/dashboard/deals/${p.id}`} className="inline-block text-primary hover:underline font-medium">
            View deal →
          </a>
        </div>
      )}
      {popup.kind === 'cn' && (
        <div className="space-y-1.5 pr-4">
          <div className="font-medium text-foreground leading-snug">{String(p.title ?? '')}</div>
          <div className="text-muted-foreground">
            Chinese state-backed project
            {typeof p.usd === 'number' && p.usd > 0 ? ` · ${formatUsd(p.usd as number)}` : ''}
            {p.year ? ` · ${p.year}` : ''}
          </div>
          {p.status ? <div className="text-muted-foreground/70">{String(p.status)}</div> : null}
        </div>
      )}
      {popup.kind === 'us' && (
        <div className="space-y-1.5 pr-4">
          <div className="font-medium text-foreground leading-snug">{String(p.name ?? '')}</div>
          <div className="text-muted-foreground">
            {String(p.agency ?? 'US agency')}
            {typeof p.usd === 'number' && p.usd > 0 ? ` · ${formatUsd(p.usd as number)}` : ''}
          </div>
          {p.leading ? (
            <div className="text-sky-600 dark:text-sky-400">Leading indicator (early positioning)</div>
          ) : null}
        </div>
      )}
      {popup.kind === 'facility' && (
        <div className="space-y-1 pr-4">
          <div className="font-medium text-foreground leading-snug">{String(p.name ?? '')}</div>
          <div className="text-muted-foreground">{String(p.ftype ?? 'facility')}{p.iso3 ? ` · ${p.iso3}` : ''}</div>
        </div>
      )}
      {popup.kind === 'cable' && (
        <div className="space-y-1 pr-4">
          <div className="font-medium text-foreground leading-snug">{String(p.name ?? '')}</div>
          <div className="text-muted-foreground">Submarine cable{p.rfs ? ` · RFS ${p.rfs}` : ''}</div>
        </div>
      )}
    </div>
  );
}

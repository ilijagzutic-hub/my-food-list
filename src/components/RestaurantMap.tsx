'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L, { type LatLngBounds, type LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RankedRestaurant } from '@/lib/search';
import type { Coords } from '@/lib/types';
import MapPopupCard from './MapPopupCard';

// Loaded via next/dynamic({ ssr:false }) from the Map page — Leaflet touches
// `window`/`document` at import time, which would crash Next's build-time
// prerender of the (otherwise ordinary) client page around it.

const SYDNEY_FALLBACK: LatLngTuple = [-33.8688, 151.2093];

function markerIcon(status: string | null, isFavourite: boolean) {
  const tried = status === 'Tried';
  const star = isFavourite
    ? `<span style="position:absolute;top:-6px;right:-7px;font-size:11px;line-height:1;color:#fffdf8;text-shadow:0 0 2px #0a1a12,0 0 3px #0a1a12;">★</span>`
    : '';
  return L.divIcon({
    html: `<div style="position:relative;width:20px;height:20px;">
      <div style="width:20px;height:20px;border-radius:50%;
        background:${tried ? '#c19a4b' : 'rgba(21,50,31,0.92)'};
        border:2px solid ${tried ? '#a67f38' : '#d4af6a'};
        box-shadow:0 1px 3px rgba(10,26,18,0.45);"></div>
      ${star}
    </div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

const USER_ICON = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid #fffdf8;box-shadow:0 0 0 6px rgba(59,130,246,0.25);"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** Exact-duplicate coordinates (a real, if small, share of the venues — e.g.
 * a food court) are nudged into a tiny circle so every marker stays
 * independently tappable, without pulling in a full clustering library for
 * what's currently 2-3 restaurants at a handful of points. */
function withOffsets(restaurants: RankedRestaurant[]): Map<number, LatLngTuple> {
  const groups = new Map<string, RankedRestaurant[]>();
  restaurants.forEach((r) => {
    const key = `${r.latitude!.toFixed(6)},${r.longitude!.toFixed(6)}`;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  });
  const positions = new Map<number, LatLngTuple>();
  groups.forEach((group) => {
    if (group.length === 1) {
      positions.set(group[0].id, [group[0].latitude!, group[0].longitude!]);
      return;
    }
    const angleStep = (2 * Math.PI) / group.length;
    const radius = 0.00015; // ~15-17m at this latitude — enough to separate pins, not enough to mislead
    group.forEach((r, i) => {
      const angle = i * angleStep;
      positions.set(r.id, [
        r.latitude! + radius * Math.sin(angle),
        r.longitude! + radius * Math.cos(angle),
      ]);
    });
  });
  return positions;
}

function FitToData({ restaurants, skip }: { restaurants: RankedRestaurant[]; skip: boolean }) {
  const map = useMap();
  const didFit = useRef(false);

  useEffect(() => {
    // Skipped when a focus id is present (Stage 6A's "Show on map") —
    // FocusOnRestaurant owns the initial view in that case instead.
    if (didFit.current || restaurants.length === 0 || skip) return;
    didFit.current = true;
    // The list genuinely includes a handful of overseas restaurants (real
    // trips, real addresses) alongside ~100+ Sydney-area ones. Framing the
    // full set on first load would zoom out to a world view and bury the
    // cluster you'd actually use "Near Me" against day to day — so the
    // initial fit prefers the domestic cluster (using the data's own
    // `country` field, not a hardcoded region) and falls back to
    // everything only if that subset is empty. Overseas restaurants are
    // still on the map, just reachable by zooming/panning out.
    const domestic = restaurants.filter((r) => !r.country || r.country.toLowerCase() === 'australia');
    const pool = domestic.length > 0 ? domestic : restaurants;
    const bounds = L.latLngBounds(pool.map((r) => [r.latitude!, r.longitude!] as LatLngTuple));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [restaurants, map, skip]);

  return null;
}

/** Stage 6A "Show on map": centres on one restaurant and opens its popup,
 * reusing the Map infrastructure rather than a separate mini-map. */
function FocusOnRestaurant({
  restaurants,
  focusId,
  markerRefs,
}: {
  restaurants: RankedRestaurant[];
  focusId: number | null;
  markerRefs: React.MutableRefObject<Map<number, L.Marker>>;
}) {
  const map = useMap();
  const didFocus = useRef<number | null>(null);

  useEffect(() => {
    if (focusId == null || didFocus.current === focusId) return;
    const r = restaurants.find((x) => x.id === focusId);
    if (!r || r.latitude == null || r.longitude == null) return;
    didFocus.current = focusId;
    map.setView([r.latitude, r.longitude], 16, { animate: true });
    // The marker needs a beat to exist/attach before openPopup() works.
    const t = setTimeout(() => markerRefs.current.get(focusId)?.openPopup(), 120);
    return () => clearTimeout(t);
  }, [focusId, restaurants, map, markerRefs]);

  return null;
}

function FlyToUser({ coords }: { coords: Coords | null }) {
  const map = useMap();
  const flownFor = useRef<string | null>(null);

  useEffect(() => {
    if (!coords) return;
    const key = `${coords.lat},${coords.lon}`;
    if (flownFor.current === key) return;
    flownFor.current = key;
    map.flyTo([coords.lat, coords.lon], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [coords, map]);

  return null;
}

function BoundsWatcher({ onChange }: { onChange: (bounds: LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds()),
    zoomend: () => onChange(map.getBounds()),
  });
  useEffect(() => {
    onChange(map.getBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function RestaurantMap({
  restaurants,
  userCoords,
  onBoundsChange,
  focusId = null,
}: {
  restaurants: RankedRestaurant[];
  userCoords: Coords | null;
  onBoundsChange: (bounds: LatLngBounds) => void;
  focusId?: number | null;
}) {
  const positions = useMemo(() => withOffsets(restaurants), [restaurants]);
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());

  return (
    <MapContainer
      center={SYDNEY_FALLBACK}
      zoom={12}
      scrollWheelZoom
      // Leaflet's tile fade-in animation left loaded tiles stuck at
      // opacity:0 here (visible as an all-green map with only markers) —
      // a known fragile interaction between the fade animation's own
      // opacity scheduling and an immediate programmatic fitBounds() right
      // after mount (see FitToData). Tiles snapping in crisply, with no
      // fade, sidesteps it entirely and is a perfectly normal look.
      fadeAnimation={false}
      className="w-full h-full"
      style={{ background: '#15321f' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToData restaurants={restaurants} skip={focusId != null} />
      <FlyToUser coords={userCoords} />
      <BoundsWatcher onChange={onBoundsChange} />
      <FocusOnRestaurant restaurants={restaurants} focusId={focusId} markerRefs={markerRefs} />

      {userCoords && (
        <Marker position={[userCoords.lat, userCoords.lon]} icon={USER_ICON} />
      )}

      {restaurants.map((r) => {
        const pos = positions.get(r.id);
        if (!pos) return null;
        return (
          <Marker
            key={r.id}
            position={pos}
            icon={markerIcon(r.status, r.is_favourite)}
            ref={(m) => {
              if (m) markerRefs.current.set(r.id, m);
              else markerRefs.current.delete(r.id);
            }}
          >
            <Popup>
              <MapPopupCard restaurant={r} />
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

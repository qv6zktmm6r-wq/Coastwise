import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlannedRoute, RouteCoordinate } from '@/lib/route-coach';

export function RouteMap({ route, currentPosition }: { route: PlannedRoute; currentPosition?: RouteCoordinate | null }) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const positionMarker = useRef<L.CircleMarker | null>(null);
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!host.current || map.current) return;
    map.current = L.map(host.current, {
      zoomControl: false,
      attributionControl: true,
      zoomSnap: 0.5,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map.current);
    L.control.zoom({ position: 'bottomright' }).addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) map.current?.removeLayer(layer);
    });
    const points = route.coordinates.map(([longitude, latitude]) => L.latLng(latitude, longitude));
    if (points.length === 0) {
      if (route.origin[0] !== 0 || route.origin[1] !== 0) {
        map.current.setView([route.origin[1], route.origin[0]], 16);
      }
      return;
    }
    const casing = L.polyline(points, { color: '#ffffff', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map.current);
    L.polyline(points, { color: '#0a84ff', weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map.current);
    L.circleMarker([route.origin[1], route.origin[0]], { radius: 8, color: '#ffffff', fillColor: '#0a84ff', fillOpacity: 1, weight: 3 }).addTo(map.current);
    const finish = points[points.length - 1];
    if (points.length > 1) {
      L.circleMarker(finish, { radius: 7, color: '#ffffff', fillColor: '#17202b', fillOpacity: 1, weight: 3 }).addTo(map.current);
      map.current.fitBounds(casing.getBounds(), { padding: [32, 32], animate: !reduceMotion() });
    } else {
      map.current.setView(points[0], 16, { animate: !reduceMotion() });
    }
  }, [route]);

  useEffect(() => {
    if (!map.current || !currentPosition) return;
    positionMarker.current?.remove();
    positionMarker.current = L.circleMarker([currentPosition[1], currentPosition[0]], {
      radius: 9,
      color: '#fff',
      fillColor: '#2477c9',
      fillOpacity: 1,
      weight: 3,
    }).addTo(map.current);
    map.current.panTo([currentPosition[1], currentPosition[0]], { animate: !reduceMotion(), duration: reduceMotion() ? 0 : 0.5 });
  }, [currentPosition]);

  return <div ref={host} className="h-[280px] w-full overflow-hidden rounded-2xl bg-[hsl(var(--muted))] md:h-[340px]" role="img" aria-label="Practice route map" />;
}
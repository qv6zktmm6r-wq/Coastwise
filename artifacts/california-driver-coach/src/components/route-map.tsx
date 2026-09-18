import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlannedRoute, RouteCoordinate } from '@/lib/route-coach';

export function RouteMap({ route, currentPosition }: { route: PlannedRoute; currentPosition?: RouteCoordinate | null }) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const positionMarker = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!host.current || map.current) return;
    map.current = L.map(host.current, { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
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
    const line = L.polyline(points, { color: '#e86c4a', weight: 6, opacity: 0.92, lineCap: 'round' }).addTo(map.current);
    L.circleMarker([route.origin[1], route.origin[0]], { radius: 8, color: '#f8c56d', fillColor: '#244b42', fillOpacity: 1, weight: 3 }).addTo(map.current);
    map.current.fitBounds(line.getBounds(), { padding: [28, 28] });
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
    map.current.panTo([currentPosition[1], currentPosition[0]], { animate: true, duration: 0.5 });
  }, [currentPosition]);

  return <div ref={host} className="h-[280px] w-full overflow-hidden rounded-2xl bg-[hsl(var(--muted))] md:h-[340px]" aria-label="Practice route map" />;
}
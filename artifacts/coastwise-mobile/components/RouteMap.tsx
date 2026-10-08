import { memo, useMemo } from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors } from '@/theme';
import type { PlannedRoute } from '@/lib/route-planner';

type RouteMapProps = {
  route: PlannedRoute;
  height: number;
  /** Keeps the map centered on the driver during a drive. */
  follow?: boolean;
};

export const RouteMap = memo(function RouteMap({ route, height, follow = false }: RouteMapProps) {
  const path = useMemo(
    () => route.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })),
    [route],
  );
  const region = useMemo(() => {
    const latitudes = path.map((point) => point.latitude);
    const longitudes = path.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.005, (maxLat - minLat) * 1.35),
      longitudeDelta: Math.max(0.005, (maxLon - minLon) * 1.35),
    };
  }, [path]);
  const start = { latitude: route.origin[1], longitude: route.origin[0] };

  return (
    <View style={{ height, borderRadius: 20, overflow: 'hidden' }}>
      <MapView
        key={`${route.coordinates.length}-${route.distanceMeters}`}
        style={{ flex: 1 }}
        initialRegion={region}
        showsUserLocation
        followsUserLocation={follow}
        showsPointsOfInterests={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        scrollEnabled={!follow}
        zoomEnabled={!follow}
        rotateEnabled={!follow}
        accessibilityLabel={follow ? 'Map of the practice route, following your position' : 'Map of the practice route'}
      >
        <Polyline coordinates={path} strokeColor={colors.primary} strokeWidth={5} lineCap="round" lineJoin="round" />
        <Marker coordinate={start} title="Start and finish" pinColor={colors.primary} />
      </MapView>
    </View>
  );
});

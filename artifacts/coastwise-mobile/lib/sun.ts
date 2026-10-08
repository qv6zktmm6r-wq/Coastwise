const J2000 = 2451545.0;
const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JULIAN = 2440587.5;
const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

export type SunTimes = { sunrise: number; sunset: number } | { polar: 'day' | 'night' };

/**
 * Sunrise and sunset (epoch ms) for the solar day closest to `at`, using the standard
 * sunrise equation. Accurate to a few minutes, which is enough to log night practice.
 * Runs entirely on the device.
 */
export function sunTimes(at: number, latitude: number, longitude: number): SunTimes {
  const julian = at / MS_PER_DAY + UNIX_EPOCH_JULIAN;
  const day = Math.round(julian - J2000 + longitude / 360);
  const meanSolarNoon = day - longitude / 360;
  const anomaly = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const center = 1.9148 * Math.sin(toRadians(anomaly))
    + 0.02 * Math.sin(toRadians(2 * anomaly))
    + 0.0003 * Math.sin(toRadians(3 * anomaly));
  const eclipticLongitude = (anomaly + center + 180 + 102.9372) % 360;
  const transit = J2000 + meanSolarNoon
    + 0.0053 * Math.sin(toRadians(anomaly))
    - 0.0069 * Math.sin(toRadians(2 * eclipticLongitude));
  const declination = Math.asin(Math.sin(toRadians(eclipticLongitude)) * Math.sin(toRadians(23.4397)));
  const cosHourAngle = (Math.sin(toRadians(-0.833)) - Math.sin(toRadians(latitude)) * Math.sin(declination))
    / (Math.cos(toRadians(latitude)) * Math.cos(declination));
  if (cosHourAngle < -1) return { polar: 'day' };
  if (cosHourAngle > 1) return { polar: 'night' };
  const halfDay = toDegrees(Math.acos(cosHourAngle)) / 360;
  const toEpoch = (julianDate: number) => (julianDate - UNIX_EPOCH_JULIAN) * MS_PER_DAY;
  return { sunrise: toEpoch(transit - halfDay), sunset: toEpoch(transit + halfDay) };
}

export function isAfterDark(at: number, latitude: number, longitude: number) {
  const times = sunTimes(at, latitude, longitude);
  if ('polar' in times) return times.polar === 'night';
  return at < times.sunrise || at >= times.sunset;
}

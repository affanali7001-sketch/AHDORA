/**
 * Qibla — pure bearing / distance maths.
 *
 * No invented constants: the Kaaba's coordinates (21.4225° N,
 * 39.8262° E) are fixed and well-known, and the bearing uses the
 * standard great-circle initial-bearing formula. Nothing here
 * touches the network, sensors, or storage, so it is trivially
 * testable — see the sanity check in the module docs below.
 *
 * Sanity check (run the functions, don't trust memory):
 *   New Delhi  (28.6139, 77.2090)  -> bearing ~266.6°, ~3,835 km
 *   London     (51.5074, -0.1278)  -> bearing ~119.0°, ~4,794 km
 *   Makkah     (21.4225, 39.8262)  -> bearing 0°, 0 km (you are there)
 */

/** Kaaba, Masjid al-Haram, Makkah — fixed, well-known coordinates. */
export const KAABA_LATITUDE = 21.4225;
export const KAABA_LONGITUDE = 39.8262;

/** Mean Earth radius used for the great-circle distance. */
export const EARTH_RADIUS_KM = 6371;

export type Coordinates = { latitude: number; longitude: number };

export type QiblaResult = {
  /** Degrees clockwise from true north, 0–360. */
  bearing: number;
  /** Great-circle distance to the Kaaba, in kilometres. */
  distanceKm: number;
};

/** Normalise any angle to the 0–360 range. */
export function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** True for finite coordinates inside the valid lat/lng ranges. */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Qibla bearing from `from` to the Kaaba: the initial bearing of
 * the great-circle route, in degrees clockwise from true north.
 * Standard formula: θ = atan2(sin Δλ · cos φ2,
 *   cos φ1 · sin φ2 − sin φ1 · cos φ2 · cos Δλ).
 */
export function qiblaBearing(from: Coordinates): number {
  const phi1 = toRad(from.latitude);
  const phi2 = toRad(KAABA_LATITUDE);
  const deltaLambda = toRad(KAABA_LONGITUDE - from.longitude);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return normalizeDegrees(toDeg(Math.atan2(y, x)));
}

/**
 * Great-circle (haversine) distance from `from` to the Kaaba, km.
 */
export function distanceToKaabaKm(from: Coordinates): number {
  const phi1 = toRad(from.latitude);
  const phi2 = toRad(KAABA_LATITUDE);
  const deltaPhi = toRad(KAABA_LATITUDE - from.latitude);
  const deltaLambda = toRad(KAABA_LONGITUDE - from.longitude);
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Bearing + distance together for one pair of coordinates. */
export function qiblaInfo(from: Coordinates): QiblaResult {
  return { bearing: qiblaBearing(from), distanceKm: distanceToKaabaKm(from) };
}

/**
 * Device heading (degrees clockwise from magnetic north) from a
 * raw magnetometer reading, for a phone held flat, screen up.
 *
 * Derivation: in device coordinates x points right and y points
 * along the top of the phone. If the phone's top points at azimuth
 * θ, the magnetic-north vector has components Bx = −B·sin θ and
 * By = B·cos θ, so θ = atan2(−x, y).
 *
 * This is a MAGNETIC heading. The Qibla bearing above is from
 * TRUE north; the difference is the local magnetic declination,
 * which this app does not correct (no declination model is
 * bundled) — the screen says so honestly.
 */
export function headingFromMagnetometer(x: number, y: number): number {
  return normalizeDegrees(toDeg(Math.atan2(-x, y)));
}

/**
 * Rotation (degrees) to apply to a compass dial drawn with north
 * at the top, so the dial's north points at real north for the
 * current device heading. Negative = counter-clockwise.
 */
export function dialRotationDeg(heading: number): number {
  return -normalizeDegrees(heading);
}

/**
 * How far the user still has to turn to face the Qibla, clockwise
 * from the direction the phone currently points: 0 means facing
 * the Qibla, 90 means turn right 90°, 270 means turn left 90°.
 */
export function degreesToQibla(heading: number, bearing: number): number {
  return normalizeDegrees(bearing - heading);
}

/** True when the heading is within `tolerance` degrees of the bearing. */
export function isFacingQibla(
  heading: number,
  bearing: number,
  tolerance = 5,
): boolean {
  const rel = degreesToQibla(heading, bearing);
  return rel <= tolerance || rel >= 360 - tolerance;
}

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

/** 16-wind compass point for a bearing, e.g. 266.6° -> 'W'. */
export function compassPoint(deg: number): string {
  const index = Math.round(normalizeDegrees(deg) / 22.5) % 16;
  return COMPASS_POINTS[index];
}

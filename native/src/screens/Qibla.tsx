/**
 * Qibla — live compass to the Kaaba.
 *
 * - Bearing + distance come from src/lib/qibla.ts, computed from
 *   REAL coordinates only: the device GPS fix, or latitude /
 *   longitude the user types themselves. Nothing is invented.
 * - The app's saved profile stores a city NAME only (see
 *   ProfileForm in src/lib/apiCore.ts) — no coordinates are stored
 *   anywhere — so the manual fields start BLANK. The prayer city
 *   is shown as context text only, never as a coordinate source.
 * - Heading comes from the magnetometer (expo-sensors). When the
 *   device has no magnetometer, the screen says so and shows the
 *   bearing + distance statically — never a fake live dial.
 * - The magnetometer gives a MAGNETIC heading while the Qibla
 *   bearing is from TRUE north; the difference is the local
 *   magnetic declination, which is not corrected (no declination
 *   model is bundled) and is disclosed on screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Svg, Circle, G, Line, Text as SvgText } from 'react-native-svg';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import { C, F, L, S, T } from '../lib/theme';
import { Card, Field, Input, PillButton } from '../components/ui';
import { loadProfileWithCompletion } from '../lib/apiCore';
import {
  compassPoint,
  degreesToQibla,
  dialRotationDeg,
  headingFromMagnetometer,
  isFacingQibla,
  isValidCoordinate,
  qiblaInfo,
  type Coordinates,
} from '../lib/qibla';

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    locating: string;
    permissionTitle: string;
    permissionBody: string;
    useMyLocation: string;
    openSettings: string;
    refreshLocation: string;
    manualTitle: string;
    manualBody: string;
    latitude: string;
    longitude: string;
    latitudePlaceholder: string;
    longitudePlaceholder: string;
    applyCoords: string;
    invalidCoords: string;
    noSensorTitle: string;
    noSensorBody: string;
    noLocationTitle: string;
    noLocationBody: string;
    facingQibla: string;
    turnRight: (n: number) => string;
    turnLeft: (n: number) => string;
    bearingLabel: string;
    distanceLabel: string;
    headingLabel: string;
    sourceGps: string;
    sourceManual: string;
    sourceCoords: (lat: number, lng: number) => string;
    prayerCity: (city: string) => string;
    holdFlat: string;
    magneticNote: string;
    qiblaMarker: string;
    facingYou: string;
    locationFailed: string;
  }
> = {
  en: {
    title: 'Qibla Compass',
    subtitle: 'Find the direction of the Kaaba from where you are.',
    locating: 'Finding your location…',
    permissionTitle: 'Location needed for the Qibla direction',
    permissionBody:
      'We need your location only to work out the Qibla direction from where you are. Your location never leaves your phone.',
    useMyLocation: 'Use my location',
    openSettings: 'Open settings',
    refreshLocation: 'Refresh location',
    manualTitle: 'Or type your coordinates',
    manualBody:
      'No coordinates are saved for your prayer city, so type your latitude and longitude yourself — for example from a map app.',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudePlaceholder: 'e.g. 28.6139',
    longitudePlaceholder: 'e.g. 77.2090',
    applyCoords: 'Show Qibla direction',
    invalidCoords:
      'Those coordinates look wrong — latitude must be −90 to 90 and longitude −180 to 180.',
    noSensorTitle: 'This phone has no compass sensor',
    noSensorBody:
      'Your phone has no magnetometer, so the dial cannot turn live. The Qibla bearing and distance below are still correct for your location — use them with a physical compass.',
    noLocationTitle: 'No location yet',
    noLocationBody:
      'Allow location access, or type your coordinates below, to see the Qibla direction.',
    facingQibla: 'MashaAllah — you are facing the Qibla',
    turnRight: (n) => `Turn right ${n}°`,
    turnLeft: (n) => `Turn left ${n}°`,
    bearingLabel: 'Qibla bearing',
    distanceLabel: 'Distance to Makkah',
    headingLabel: 'You are facing',
    sourceGps: 'From your GPS location',
    sourceManual: 'From coordinates you typed',
    sourceCoords: (lat, lng) =>
      `${lat.toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`,
    prayerCity: (city) => `Prayer city: ${city}`,
    holdFlat: 'Hold the phone flat, screen up, away from metal objects.',
    magneticNote:
      'The dial follows magnetic north; the Qibla bearing is from true north, so a small difference (magnetic declination) is normal where you are.',
    qiblaMarker: 'Qibla',
    facingYou: 'You',
    locationFailed: 'Could not get your location. Check that location is turned on and try again.',
  },
  hi: {
    title: 'Qibla Compass',
    subtitle: 'Tum jahan ho, wahan se Kaaba ki disha pata karo.',
    locating: 'Tumhari location dhoondh rahe hain…',
    permissionTitle: 'Qibla disha ke liye location chahiye',
    permissionBody:
      'Location sirf isliye chahiye taaki tum jahan ho, wahan se Qibla ki disha nikaal sakein. Tumhari location phone se bahar kabhi nahi jaati.',
    useMyLocation: 'Meri location use karo',
    openSettings: 'Settings kholo',
    refreshLocation: 'Location phir se lo',
    manualTitle: 'Ya apne coordinates likho',
    manualBody:
      'Tumhare prayer city ke coordinates save nahi hain, isliye latitude aur longitude khud likho — jaise kisi map app se dekh kar.',
    latitude: 'Latitude',
    longitude: 'Longitude',
    latitudePlaceholder: 'e.g. 28.6139',
    longitudePlaceholder: 'e.g. 77.2090',
    applyCoords: 'Qibla disha dikhao',
    invalidCoords:
      'Ye coordinates galat lag rahe hain — latitude −90 se 90 aur longitude −180 se 180 ke beech honi chahiye.',
    noSensorTitle: 'Is phone mein compass sensor nahi hai',
    noSensorBody:
      'Tumhare phone mein magnetometer nahi hai, isliye dial live nahi ghumega. Neeche di gayi Qibla bearing aur doori tumhari location ke liye phir bhi sahi hai — inhe kisi physical compass ke saath use karo.',
    noLocationTitle: 'Abhi koi location nahi hai',
    noLocationBody:
      'Qibla disha dekhne ke liye location ki permission do, ya neeche apne coordinates likho.',
    facingQibla: 'MashAllah — tum Qibla ki taraf ho',
    turnRight: (n) => `Daayein ${n}° ghumo`,
    turnLeft: (n) => `Baayein ${n}° ghumo`,
    bearingLabel: 'Qibla bearing',
    distanceLabel: 'Makkah se doori',
    headingLabel: 'Tum is taraf ho',
    sourceGps: 'Tumhari GPS location se',
    sourceManual: 'Tumhare likhe coordinates se',
    sourceCoords: (lat, lng) =>
      `${lat.toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`,
    prayerCity: (city) => `Prayer city: ${city}`,
    holdFlat: 'Phone ko seedha (flat) rakho, screen upar, metal cheezon se door.',
    magneticNote:
      'Dial magnetic north ko follow karta hai; Qibla bearing true north se hai, isliye thoda farq (magnetic declination) normal hai.',
    qiblaMarker: 'Qibla',
    facingYou: 'Tum',
    locationFailed:
      'Location nahi mil payi. Check karo location on hai, phir dobara try karo.',
  },
};

type LocationState = 'loading' | 'ready' | 'denied' | 'failed';
type SensorState = 'checking' | 'available' | 'unavailable';
type CoordSource = 'gps' | 'manual';

const DIAL_SIZE = 280;
const DIAL_C = DIAL_SIZE / 2;
const DIAL_R = 128;

/** GPS fix, with a 10 s timeout falling back to the last known fix. */
async function getDeviceCoords(): Promise<Coordinates | null> {
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 10000);
  });
  const current = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    timeout,
  ]);
  if (current) {
    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
  }
  const last = await Location.getLastKnownPositionAsync();
  if (!last) return null;
  return { latitude: last.coords.latitude, longitude: last.coords.longitude };
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-IN')} km`;
}

export default function QiblaScreen({ lang, user }: ScreenProps) {
  const s = STRINGS[lang];
  const [locationState, setLocationState] = useState<LocationState>('loading');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [gpsCoords, setGpsCoords] = useState<Coordinates | null>(null);
  const [gpsPlace, setGpsPlace] = useState('');
  const [manualCoords, setManualCoords] = useState<Coordinates | null>(null);
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [manualError, setManualError] = useState('');
  const [sensorState, setSensorState] = useState<SensorState>('checking');
  const [heading, setHeading] = useState<number | null>(null);
  const [prayerCity, setPrayerCity] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  /** Smoothed heading (circular lerp) — the raw sensor jitters. */
  const smoothHeading = useRef<number | null>(null);
  const mounted = useRef(true);

  // Effective coordinates: the GPS fix wins; manual entry is the
  // fallback when there is no fix. Never invented, never guessed.
  const coords = gpsCoords ?? manualCoords;
  const coordSource: CoordSource = gpsCoords ? 'gps' : 'manual';
  const info = coords ? qiblaInfo(coords) : null;

  const requestLocation = useCallback(async () => {
    setLocationState('loading');
    try {
      const { status, canAskAgain: askAgain } =
        await Location.requestForegroundPermissionsAsync();
      if (!mounted.current) return;
      setCanAskAgain(askAgain);
      if (status !== 'granted') {
        setLocationState('denied');
        return;
      }
      const fix = await getDeviceCoords();
      if (!mounted.current) return;
      if (!fix) {
        setLocationState('failed');
        return;
      }
      setGpsCoords(fix);
      setLocationState('ready');
      // Best-effort place name for the fix; coordinates alone are
      // enough, so a failed reverse-geocode changes nothing.
      try {
        const [place] = await Location.reverseGeocodeAsync(fix);
        if (mounted.current && place) {
          const parts = [place.city, place.region, place.country].filter(Boolean);
          setGpsPlace(parts.join(', '));
        }
      } catch {
        // Keep the coordinates; the place name is a nicety.
      }
    } catch {
      if (mounted.current) setLocationState('failed');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Prayer city name only — context text, never coordinates: the
    // profile stores no latitude/longitude (see apiCore.ts).
    void loadProfileWithCompletion(user?.name ?? '')
      .then((result) => {
        if (mounted.current && result.profile?.city) {
          setPrayerCity(result.profile.city);
        }
      })
      .catch(() => undefined);
    void requestLocation();
    return () => {
      mounted.current = false;
    };
  }, [requestLocation, user?.name]);

  // Magnetometer: subscribe once; unsubscribe on unmount so it
  // never drains battery after leaving the screen.
  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let active = true;
    void (async () => {
      let available = false;
      try {
        available = await Magnetometer.isAvailableAsync();
      } catch {
        available = false;
      }
      if (!active) return;
      if (!available) {
        setSensorState('unavailable');
        return;
      }
      setSensorState('available');
      Magnetometer.setUpdateInterval(100);
      subscription = Magnetometer.addListener(({ x, y }) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (x === 0 && y === 0) return;
        const raw = headingFromMagnetometer(x, y);
        const prev = smoothHeading.current;
        if (prev === null) {
          smoothHeading.current = raw;
          setHeading(raw);
          return;
        }
        // Circular lerp (handles the 359° -> 0° wrap) + jitter gate.
        const diff = ((raw - prev + 540) % 360) - 180;
        const next = (prev + diff * 0.25 + 360) % 360;
        smoothHeading.current = next;
        if (Math.abs(diff) >= 0.5) setHeading(next);
      });
    })();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  function applyManualCoords(): void {
    const lat = Number(latText.trim());
    const lng = Number(lngText.trim());
    if (!isValidCoordinate(lat, lng)) {
      setManualError(s.invalidCoords);
      return;
    }
    setManualError('');
    setManualCoords({ latitude: lat, longitude: lng });
    // A manual fix does not clear a GPS fix; GPS stays the source
    // whenever one exists.
  }

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    await requestLocation();
    setRefreshing(false);
  }

  const facing = info !== null && heading !== null && isFacingQibla(heading, info.bearing);
  const relative =
    info !== null && heading !== null ? degreesToQibla(heading, info.bearing) : null;
  const turnText =
    relative === null
      ? ''
      : relative <= 5 || relative >= 355
        ? s.facingQibla
        : relative < 180
          ? s.turnRight(Math.round(relative))
          : s.turnLeft(Math.round(360 - relative));

  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  const cardinals: { label: string; angle: number }[] = [
    { label: 'N', angle: 0 },
    { label: 'E', angle: 90 },
    { label: 'S', angle: 180 },
    { label: 'W', angle: 270 },
  ];

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.title}</Text>
      <Text style={[T.sub, { marginBottom: 14 }]}>{s.subtitle}</Text>

      {prayerCity ? <Text style={styles.cityLine}>{s.prayerCity(prayerCity)}</Text> : null}

      {locationState === 'loading' ? (
        <Card>
          <ActivityIndicator color={C.teal} />
          <Text style={[T.note, { marginTop: 10 }]}>{s.locating}</Text>
        </Card>
      ) : null}

      {locationState === 'denied' || locationState === 'failed' ? (
        <Card>
          <Text style={T.cardTitle}>{s.permissionTitle}</Text>
          <Text style={[T.cardBody, { marginTop: 6 }]}>
            {locationState === 'failed' ? s.locationFailed : s.permissionBody}
          </Text>
          <View style={{ marginTop: 14 }}>
            <PillButton
              label={s.useMyLocation}
              variant="primary"
              block
              onPress={() => void requestLocation()}
            />
            {!canAskAgain ? (
              <PillButton
                label={s.openSettings}
                variant="ghost"
                block
                onPress={() => void Linking.openSettings()}
              />
            ) : null}
          </View>
        </Card>
      ) : null}

      {sensorState === 'unavailable' ? (
        <Card>
          <Text style={T.cardTitle}>{s.noSensorTitle}</Text>
          <Text style={[T.cardBody, { marginTop: 6 }]}>{s.noSensorBody}</Text>
        </Card>
      ) : null}

      {info ? (
        <View>
          {/* Compass dial. The whole dial rotates by -heading so its
              north points at real north; the Qibla marker sits at
              the bearing on the dial. When there is no live heading
              the dial stays still (rotation 0) — a static display,
              never a fake live one. */}
          <View style={styles.dialWrap}>
            <Text style={styles.topMarker}>▲</Text>
            <Text style={styles.topLabel}>{s.facingYou}</Text>
            <View style={styles.dialBox}>
            <Svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}>
              <Circle
                cx={DIAL_C}
                cy={DIAL_C}
                r={DIAL_R + 10}
                fill={C.white}
                stroke={C.line}
                strokeWidth={1.5}
              />
              <G
                rotation={heading !== null ? dialRotationDeg(heading) : 0}
                origin={`${DIAL_C}, ${DIAL_C}`}
              >
                {ticks.map((angle) => {
                  const rad = (angle * Math.PI) / 180;
                  const major = angle % 90 === 0;
                  const r1 = DIAL_R - (major ? 16 : 9);
                  return (
                    <Line
                      key={angle}
                      x1={DIAL_C + r1 * Math.sin(rad)}
                      y1={DIAL_C - r1 * Math.cos(rad)}
                      x2={DIAL_C + DIAL_R * Math.sin(rad)}
                      y2={DIAL_C - DIAL_R * Math.cos(rad)}
                      stroke={major ? C.teal700 : C.muted}
                      strokeWidth={major ? 2.5 : 1.2}
                    />
                  );
                })}
                {cardinals.map(({ label, angle }) => {
                  const rad = (angle * Math.PI) / 180;
                  return (
                    <SvgText
                      key={label}
                      x={DIAL_C + (DIAL_R - 32) * Math.sin(rad)}
                      y={DIAL_C - (DIAL_R - 32) * Math.cos(rad) + 6}
                      fontSize={18}
                      fontWeight="800"
                      fill={label === 'N' ? C.red : C.teal900}
                      textAnchor="middle"
                    >
                      {label}
                    </SvgText>
                  );
                })}
                {/* Qibla marker: peach line + dot at the bearing. */}
                <Line
                  x1={DIAL_C}
                  y1={DIAL_C}
                  x2={DIAL_C + (DIAL_R - 4) * Math.sin((info.bearing * Math.PI) / 180)}
                  y2={DIAL_C - (DIAL_R - 4) * Math.cos((info.bearing * Math.PI) / 180)}
                  stroke={C.peachMid}
                  strokeWidth={3}
                />
                <Circle
                  cx={DIAL_C + (DIAL_R - 14) * Math.sin((info.bearing * Math.PI) / 180)}
                  cy={DIAL_C - (DIAL_R - 14) * Math.cos((info.bearing * Math.PI) / 180)}
                  r={11}
                  fill={C.peachMid}
                />
                <SvgText
                  x={DIAL_C + (DIAL_R - 14) * Math.sin((info.bearing * Math.PI) / 180)}
                  y={DIAL_C - (DIAL_R - 14) * Math.cos((info.bearing * Math.PI) / 180) + 4}
                  fontSize={11}
                  fontWeight="800"
                  fill={C.peachText}
                  textAnchor="middle"
                >
                  Q
                </SvgText>
              </G>
              <Circle cx={DIAL_C} cy={DIAL_C} r={4} fill={C.teal900} />
            </Svg>
            <View style={styles.dialCentre} pointerEvents="none">
              <Text style={styles.bearingBig}>
                {info.bearing.toFixed(1)}°
              </Text>
              <Text style={styles.bearingPoint}>{compassPoint(info.bearing)}</Text>
              <Text style={styles.qiblaLabel}>{s.qiblaMarker}</Text>
            </View>
            </View>
          </View>

          {heading !== null ? (
            <View style={[styles.turnBanner, facing && styles.turnBannerOn]}>
              <Text style={[styles.turnText, facing && styles.turnTextOn]}>{turnText}</Text>
            </View>
          ) : null}

          <Card>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{s.bearingLabel}</Text>
              <Text style={styles.statValue}>
                {info.bearing.toFixed(1)}° {compassPoint(info.bearing)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{s.distanceLabel}</Text>
              <Text style={styles.statValue}>{formatKm(info.distanceKm)}</Text>
            </View>
            <View style={[styles.statRow, styles.statRowLast]}>
              <Text style={styles.statLabel}>{s.headingLabel}</Text>
              <Text style={styles.statValue}>
                {heading === null
                  ? '—'
                  : `${heading.toFixed(0)}° ${compassPoint(heading)}`}
              </Text>
            </View>
            <Text style={[T.note, { textAlign: 'left', marginTop: 12 }]}>
              {coordSource === 'gps' ? s.sourceGps : s.sourceManual}
              {' · '}
              {s.sourceCoords(coords!.latitude, coords!.longitude)}
              {gpsPlace && coordSource === 'gps' ? ` · ${gpsPlace}` : ''}
            </Text>
          </Card>

          <Text style={T.note}>{s.holdFlat}</Text>
          <Text style={T.note}>{s.magneticNote}</Text>

          {gpsCoords ? (
            <View style={{ marginTop: 12 }}>
              <PillButton
                label={s.refreshLocation}
                variant="ghost"
                block
                busy={refreshing}
                onPress={() => void handleRefresh()}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <Card>
          <Text style={T.cardTitle}>{s.noLocationTitle}</Text>
          <Text style={[T.cardBody, { marginTop: 6 }]}>{s.noLocationBody}</Text>
        </Card>
      )}

      {/* Manual coordinates — always available as the fallback, and
          the only path when location permission is denied. Fields
          start blank: no coordinates are stored for the prayer city. */}
      <Field label={s.manualTitle}>
        <Text style={[T.cardBody, { marginBottom: 10 }]}>{s.manualBody}</Text>
        <Input
          value={latText}
          onChangeText={setLatText}
          placeholder={s.latitudePlaceholder}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={s.latitude}
        />
        <Input
          value={lngText}
          onChangeText={setLngText}
          placeholder={s.longitudePlaceholder}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={s.longitude}
        />
        {manualError ? <Text style={T.error}>{manualError}</Text> : null}
        <View style={{ marginTop: 10 }}>
          <PillButton
            label={s.applyCoords}
            variant="peach"
            block
            onPress={applyManualCoords}
          />
        </View>
      </Field>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cityLine: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '700',
    color: C.teal700,
    marginBottom: 12,
  },
  dialWrap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  dialBox: {
    position: 'relative',
    width: DIAL_SIZE,
    height: DIAL_SIZE,
  },
  topMarker: {
    fontSize: 16,
    color: C.teal900,
    marginBottom: 0,
  },
  topLabel: {
    fontFamily: F.sans,
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
    marginBottom: 4,
  },
  dialCentre: {
    position: 'absolute',
    top: DIAL_SIZE / 2 - 52,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bearingBig: {
    fontFamily: F.sans,
    fontSize: 34,
    fontWeight: '800',
    color: C.teal900,
    lineHeight: 38,
  },
  bearingPoint: {
    fontFamily: F.sans,
    fontSize: 13,
    fontWeight: '800',
    color: C.muted,
  },
  qiblaLabel: {
    fontFamily: F.sans,
    fontSize: 12,
    fontWeight: '700',
    color: C.peachInk,
    marginTop: 2,
  },
  turnBanner: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: S.radius,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: S.gap,
    alignItems: 'center',
  },
  turnBannerOn: {
    backgroundColor: C.peach,
    borderColor: C.peachMid,
  },
  turnText: {
    fontFamily: F.sans,
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'center',
  },
  turnTextOn: { color: C.peachText },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  statRowLast: { borderBottomWidth: 0 },
  statLabel: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '700',
    color: C.muted,
  },
  statValue: {
    fontFamily: F.sans,
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
});

/**
 * Mosque finder — real OpenStreetMap data via the live API
 * (GET /api/mosques/search + /near-me). Search by city, or use
 * the profile city ("Near me", needs login + a saved city).
 * Phone / website are shown ONLY when OpenStreetMap provides
 * them. The public Overpass instance can take ~35 s, so a slow
 * search shows an honest waiting note and a timeout is reported
 * with a retry — never a fake or empty result.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import type { AppLanguage } from '../lib/strings';
import {
  fetchNearMeMosques,
  searchMosques,
  type Mosque,
  type MosqueSearchResponse,
} from '../lib/apiWorship';

/** Ice White / Deep Teal / Soft Peach — the AHDORA palette. No gold. */
const C = {
  ice: '#F5F7F6',
  white: '#FFFFFF',
  ink: '#0E1A17',
  muted: '#687A75',
  teal950: '#06231F',
  teal900: '#0A352F',
  teal: '#0B4F4A',
  teal2: '#0F766E',
  peach: '#FFD9BE',
  peach2: '#FFF1E3',
  peachDeep: '#B45309',
  red: '#E11D2E',
  line: '#E6ECE9',
};

const STRINGS: Record<
  AppLanguage,
  {
    title: string;
    subtitle: string;
    cityLabel: string;
    cityPlaceholder: string;
    countryPlaceholder: string;
    radiusLabel: string;
    km: string;
    search: string;
    nearMe: string;
    searching: string;
    searchingNote: string;
    noCity: string;
    loadFailed: string;
    retry: string;
    noResults: string;
    resultsFor: string;
    distance: string;
    directions: string;
    phone: string;
    website: string;
    source: string;
  }
> = {
  en: {
    title: 'Mosque Finder',
    subtitle: 'Find nearby mosques from OpenStreetMap.',
    cityLabel: 'City',
    cityPlaceholder: 'e.g. Pune',
    countryPlaceholder: 'Country (optional)',
    radiusLabel: 'Radius',
    km: 'km',
    search: 'Search mosques',
    nearMe: 'Near my city',
    searching: 'Searching…',
    searchingNote: 'OpenStreetMap can be slow — this can take up to ~35 seconds.',
    noCity: 'Enter a city name first.',
    loadFailed: 'Mosques load nahi ho paye.',
    retry: 'Dobara try karo',
    noResults: 'Is jagah ke aas-paas koi mosque nahi mili.',
    resultsFor: 'mosques found',
    distance: 'away',
    directions: 'Directions →',
    phone: 'Phone',
    website: 'Website',
    source: 'Source',
  },
  hi: {
    title: 'Mosque Finder',
    subtitle: 'Aas-paas ki masjidein OpenStreetMap se dhoondho.',
    cityLabel: 'Sheher',
    cityPlaceholder: 'jaise Pune',
    countryPlaceholder: 'Country (optional)',
    radiusLabel: 'Radius',
    km: 'km',
    search: 'Masjidein dhoondho',
    nearMe: 'Mere sheher ke paas',
    searching: 'Dhoondh rahe hain…',
    searchingNote: 'OpenStreetMap slow ho sakta hai — isme ~35 second tak lag sakte hain.',
    noCity: 'Pehle sheher ka naam likho.',
    loadFailed: 'Masjidein load nahi ho paye.',
    retry: 'Dobara try karo',
    noResults: 'Is jagah ke aas-paas koi masjid nahi mili.',
    resultsFor: 'masjidein mili',
    distance: 'door',
    directions: 'Directions →',
    phone: 'Phone',
    website: 'Website',
    source: 'Source',
  },
};

const RADII = [5, 10, 25] as const;

export default function MosqueScreen({ lang }: ScreenProps) {
  const s = STRINGS[lang];
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('India');
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MosqueSearchResponse | null>(null);

  async function run(promise: Promise<MosqueSearchResponse>): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await promise;
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  function onSearch(): void {
    if (!city.trim()) {
      setError(s.noCity);
      return;
    }
    void run(searchMosques(city.trim(), country.trim() || 'India', radiusKm));
  }

  function onNearMe(): void {
    void run(fetchNearMeMosques());
  }

  function openDirections(m: Mosque): void {
    void Linking.openURL(m.directionsUrl);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.subtitle}</Text>

      <Text style={styles.label}>{s.cityLabel}</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder={s.cityPlaceholder}
        placeholderTextColor={C.muted}
        autoCapitalize="words"
        autoCorrect={false}
        onSubmitEditing={onSearch}
      />
      <TextInput
        style={styles.input}
        value={country}
        onChangeText={setCountry}
        placeholder={s.countryPlaceholder}
        placeholderTextColor={C.muted}
        autoCapitalize="words"
        autoCorrect={false}
      />

      <Text style={styles.label}>
        {s.radiusLabel}: {radiusKm} {s.km}
      </Text>
      <View style={styles.radiusRow}>
        {RADII.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRadiusKm(r)}
            style={[styles.radiusChip, radiusKm === r && styles.radiusChipOn]}
            accessibilityRole="button"
          >
            <Text
              style={[styles.radiusChipText, radiusKm === r && styles.radiusChipTextOn]}
            >
              {r} {s.km}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onSearch}
        disabled={loading}
        style={[styles.primaryBtn, loading && styles.btnDisabled]}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={C.white} />
        ) : (
          <Text style={styles.primaryBtnText}>{s.search}</Text>
        )}
      </Pressable>
      <Pressable
        onPress={onNearMe}
        disabled={loading}
        style={[styles.peachBtn, loading && styles.btnDisabled]}
        accessibilityRole="button"
      >
        <Text style={styles.peachBtnText}>{s.nearMe}</Text>
      </Pressable>

      {loading ? (
        <View style={styles.waitBox}>
          <ActivityIndicator color={C.teal} />
          <Text style={styles.waitText}>{s.searching}</Text>
          <Text style={styles.waitNote}>{s.searchingNote}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            onPress={onSearch}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {result && !loading && !error ? (
        <>
          <Text style={styles.resultLine}>
            {result.count} {s.resultsFor}
            {result.place ? ` · ${result.place}` : result.city ? ` · ${result.city}` : ''}
          </Text>
          {result.note ? <Text style={styles.note}>{result.note}</Text> : null}
          {result.mosques.length === 0 ? (
            <Text style={styles.note}>{s.noResults}</Text>
          ) : (
            result.mosques.map((m) => (
              <View key={m.id} style={styles.card}>
                <Text style={styles.mosqueName}>{m.name}</Text>
                <Text style={styles.mosqueMeta}>
                  {m.distanceKm} {s.km} {s.distance}
                </Text>
                {m.address ? <Text style={styles.address}>{m.address}</Text> : null}
                {m.phone ? (
                  <Text style={styles.contact}>
                    {s.phone}: {m.phone}
                  </Text>
                ) : null}
                {m.website ? (
                  <Text style={styles.contact}>
                    {s.website}: {m.website}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => openDirections(m)}
                  style={styles.dirBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.dirBtnText}>{s.directions}</Text>
                </Pressable>
              </View>
            ))
          )}
          <Text style={styles.tinyNote}>
            {s.source}: {result.source}
          </Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: C.ice },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginTop: 4, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 6 },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    marginBottom: 12,
  },
  radiusRow: { flexDirection: 'row', marginBottom: 16 },
  radiusChip: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: C.white,
  },
  radiusChipOn: { backgroundColor: C.teal950, borderColor: C.teal950 },
  radiusChipText: { fontSize: 14, fontWeight: '700', color: C.ink },
  radiusChipTextOn: { color: C.white },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  peachBtn: {
    backgroundColor: C.peach,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  peachBtnText: { color: C.peachDeep, fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
  waitBox: { alignItems: 'center', marginVertical: 20 },
  waitText: { fontSize: 15, fontWeight: '700', color: C.ink, marginTop: 10 },
  waitNote: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 6 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 14,
  },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  resultLine: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 12 },
  note: { fontSize: 14, lineHeight: 21, color: C.muted, marginBottom: 12 },
  mosqueName: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 4 },
  mosqueMeta: { fontSize: 13, fontWeight: '700', color: C.teal2, marginBottom: 6 },
  address: { fontSize: 14, lineHeight: 20, color: C.muted, marginBottom: 6 },
  contact: { fontSize: 13, color: C.muted, marginBottom: 4 },
  dirBtn: { marginTop: 8, alignSelf: 'flex-start' },
  dirBtnText: { color: C.teal2, fontWeight: '700', fontSize: 14 },
  tinyNote: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 6 },
});

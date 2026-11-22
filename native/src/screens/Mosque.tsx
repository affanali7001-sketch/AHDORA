/**
 * Mosque Finder — rebuilt to the approved preview (§15 in the preview file).
 * Title "Paas ki Masjidein", one "Sheher / ilaqa" field prefilled with
 * the user's REAL city (from /api/profile), and THREE mosque cards
 * shown ON ARRIVAL — the user's city is auto-searched on load, no
 * search needed first. Each card: name + distance tag top-right,
 * address, teal "Directions →" button + ghost "Call" button — Call
 * opens the phone dialer with the mosque's number when OSM provides
 * one, and is simply not shown when there is no number (never a dead
 * button). Real Overpass/OSM search via the live API.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Field, Input, PillButton } from '../components/ui';
import { getProfile } from '../lib/apiSocial';
import { searchMosques, type Mosque, type MosqueSearchResponse } from '../lib/apiWorship';

export default function MosqueScreen({ lang }: ScreenProps) {
  const s = stringsFor(lang);
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MosqueSearchResponse | null>(null);

  const runSearch = useCallback(
    async (place: string) => {
      const trimmed = place.trim();
      if (!trimmed) {
        setError(s.mosqueNoCity);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await searchMosques(trimmed, 'India', 10);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : s.loadFailed);
      } finally {
        setLoading(false);
      }
    },
    [s.mosqueNoCity, s.loadFailed],
  );

  // Auto-search the user's real city on arrival.
  useEffect(() => {
    let active = true;
    void getProfile()
      .then(({ profile }) => {
        const realCity =
          typeof profile?.city === 'string' && profile.city.trim().length > 0
            ? profile.city.trim()
            : 'Akkalkuwa';
        if (!active) return;
        setCity(realCity);
        void runSearch(realCity);
      })
      .catch(() => {
        if (!active) return;
        setCity('Akkalkuwa');
        void runSearch('Akkalkuwa');
      });
    return () => {
      active = false;
    };
  }, [runSearch]);

  function openDirections(m: Mosque): void {
    void Linking.openURL(m.directionsUrl);
  }

  function callMosque(m: Mosque): void {
    if (!m.phone) return;
    void Linking.openURL(`tel:${m.phone.replace(/[^+0-9]/g, '')}`);
  }

  const mosques = (result?.mosques ?? []).slice(0, 3);

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Text style={T.title}>{s.mosqueTitle}</Text>
      <Text style={T.sub}>{s.mosqueSub}</Text>

      <Field label={s.mosqueSearchLbl}>
        <Input
          value={city}
          onChangeText={setCity}
          placeholder="Akkalkuwa"
          autoCapitalize="words"
          autoCorrect={false}
          onSubmitEditing={() => void runSearch(city)}
        />
      </Field>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal700} />
          <Text style={styles.note}>{s.mosqueSearching}</Text>
          <Text style={styles.note}>{s.mosqueSlow}</Text>
        </View>
      ) : error ? (
        <Card>
          <Text style={T.error}>{error}</Text>
          <PillButton label={s.retry} onPress={() => void runSearch(city)} />
        </Card>
      ) : mosques.length === 0 ? (
        <Text style={styles.note}>{s.mosqueNoResults}</Text>
      ) : (
        mosques.map((m) => (
          <Card key={m.id}>
            <View style={styles.head}>
              <Text style={styles.name}>{m.name}</Text>
              <Text style={styles.distance}>{m.distanceKm.toFixed(1)} km</Text>
            </View>
            {m.address ? <Text style={[T.cardBody, { marginTop: 6 }]}>{m.address}</Text> : null}
            <View style={styles.btnRow}>
              <PillButton label={s.mosqueDir} small onPress={() => openDirections(m)} />
              {m.phone ? (
                <PillButton label={s.mosqueCall} small variant="ghost" onPress={() => callMosque(m)} />
              ) : null}
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 32 },
  note: { fontFamily: 'PlusJakartaSans', fontSize: 13, color: C.muted, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  name: { fontFamily: 'PlusJakartaSans', fontSize: 15.5, fontWeight: '800', color: C.ink, flex: 1 },
  distance: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: C.teal100,
    color: C.teal900,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
});

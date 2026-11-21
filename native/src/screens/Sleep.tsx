/**
 * Sleep — sleep schedule display + block-settings UI ONLY.
 *
 * Schedule comes from the live profile (GET /api/profile:
 * sleepStartTime, sleepEndTime, sleepReminder). The blocking toggles
 * are settings UI only: real app blocking needs native Android
 * modules and a real APK — it CANNOT run inside Expo Go, and this
 * screen says that plainly. Nothing here blocks any app.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { getProfile } from '../lib/apiSocial';

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

const STR = {
  en: {
    back: '← Back',
    title: 'Sleep',
    sub: 'Your sleep schedule from your profile, and optional app-blocking settings.',
    schedule: 'Your sleep schedule',
    sleepAt: 'Sleep at',
    wakeAt: 'Wake up at',
    reminder: 'Sleep reminder',
    notSet: 'Not set yet',
    setInOnboarding: 'Set it in onboarding',
    edit: 'Change sleep time',
    blocking: 'Sleep-time app blocking',
    blockingNote:
      'This is settings UI only. Real app blocking needs native Android modules and a real APK — it cannot run inside Expo Go, so nothing is blocked here.',
    blockAll: 'Block apps at sleep time',
    blockAllSub: 'When sleep time comes, show a warning first, then block apps.',
    warnFirst: 'Warn 5 minutes before blocking',
    warnFirstSub: '“Close in 5 min or we will close it” — like Digital Wellbeing.',
    allowYoutube: 'Allow YouTube at sleep time',
    allowYoutubeSub: 'YouTube stays open even when other apps are blocked.',
    callsAlways: 'Calls & emergency access always stay open. No uninstall lock, no forced lock-in.',
    localNote:
      'These toggles are saved on this phone only for now — they are not sent to the server yet.',
    loading: 'Loading your sleep schedule…',
    retry: 'Retry',
    on: 'On',
    off: 'Off',
  },
  hi: {
    back: '← Wapas',
    title: 'Sleep',
    sub: 'Aapke profile se aapka sleep schedule, aur optional app-blocking settings.',
    schedule: 'Aapka sleep schedule',
    sleepAt: 'Sone ka time',
    wakeAt: 'Uthne ka time',
    reminder: 'Sleep reminder',
    notSet: 'Abhi set nahi hai',
    setInOnboarding: 'Onboarding me set karo',
    edit: 'Sleep time badlo',
    blocking: 'Sleep-time app blocking',
    blockingNote:
      'Ye sirf settings UI hai. Asli app blocking ke liye native Android modules aur real APK chahiye — Expo Go me ye chal nahi sakta, isliye yahan kuch block nahi hota.',
    blockAll: 'Sleep time par apps block karo',
    blockAllSub: 'Sleep time aate hi pehle warning dikhao, phir apps block karo.',
    warnFirst: 'Block karne se 5 minute pehle warn karo',
    warnFirstSub: '“5 min me band karo, warna hum band kar denge” — jaise Digital Wellbeing.',
    allowYoutube: 'Sleep time par YouTube chalne do',
    allowYoutubeSub: 'Baaki apps block hone par bhi YouTube khula rahega.',
    callsAlways: 'Calls aur emergency access hamesha khule rehte hain. Koi uninstall lock nahi, koi zabardasti nahi.',
    localNote:
      'Ye toggles abhi sirf is phone par save hote hain — server par nahi bheje jaate.',
    loading: 'Aapka sleep schedule load ho raha hai…',
    retry: 'Dobara try karo',
    on: 'On',
    off: 'Off',
  },
} as const;

export default function SleepScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sleepStart, setSleepStart] = useState<string | null>(null);
  const [sleepEnd, setSleepEnd] = useState<string | null>(null);
  const [reminder, setReminder] = useState(false);

  // Settings UI only — local state, not persisted to the server yet.
  const [blockAll, setBlockAll] = useState(false);
  const [warnFirst, setWarnFirst] = useState(true);
  const [allowYoutube, setAllowYoutube] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { profile } = await getProfile();
      setSleepStart(typeof profile?.sleepStartTime === 'string' ? profile.sleepStartTime : null);
      setSleepEnd(typeof profile?.sleepEndTime === 'string' ? profile.sleepEndTime : null);
      setReminder(profile?.sleepReminder === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRow = (
    label: string,
    sub: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.line, true: C.teal }}
        thumbColor={C.white}
      />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.sub}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
          <Text style={styles.note}>{s.loading}</Text>
        </View>
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{s.schedule}</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>{s.sleepAt}</Text>
              <Text style={styles.timeValue}>{sleepStart ?? s.notSet}</Text>
            </View>
            <View style={styles.timeBox}>
              <Text style={styles.timeLabel}>{s.wakeAt}</Text>
              <Text style={styles.timeValue}>{sleepEnd ?? s.notSet}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {s.reminder}: {reminder ? s.on : s.off}
          </Text>
          <Pressable
            onPress={() => goTo('onboarding')}
            style={styles.peachBtn}
            accessibilityRole="button"
          >
            <Text style={styles.peachBtnText}>{s.edit}</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.sectionTitle}>{s.blocking}</Text>
      <Text style={styles.note}>{s.blockingNote}</Text>
      <View style={styles.card}>
        {toggleRow(s.blockAll, s.blockAllSub, blockAll, setBlockAll)}
        {toggleRow(s.warnFirst, s.warnFirstSub, warnFirst, setWarnFirst)}
        {toggleRow(s.allowYoutube, s.allowYoutubeSub, allowYoutube, setAllowYoutube)}
        <Text style={styles.meta}>{s.callsAlways}</Text>
      </View>
      <Text style={styles.note}>{s.localNote}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 20, lineHeight: 20 },
  center: { alignItems: 'center', paddingVertical: 40 },
  note: { fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 19 },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 12 },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timeBox: {
    flex: 1,
    backgroundColor: C.peach2,
    borderRadius: 16,
    padding: 14,
  },
  timeLabel: { fontSize: 12, fontWeight: '700', color: C.peachDeep },
  timeValue: { fontSize: 22, fontWeight: '800', color: C.ink, marginTop: 4 },
  meta: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  peachBtn: {
    backgroundColor: C.peach,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peachBtnText: { color: C.peachDeep, fontSize: 16, fontWeight: '800' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: C.ink },
  toggleSub: { fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 18 },
});

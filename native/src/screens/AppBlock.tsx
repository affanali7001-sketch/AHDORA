/**
 * AppBlock — DEMO UI ONLY.
 *
 * Two demos, nothing real is blocked:
 *  1. Namaz lock screen — "all apps blocked until you pray", with the
 *     "Haan, maine namaz padh li" unlock button (unlocks only the demo).
 *  2. Sleep 5-minute warning — a countdown demo of the warning shown
 *     before sleep-time blocking starts.
 *
 * Real blocking needs native Android modules and a real APK — it
 * CANNOT run inside Expo Go. This screen says that on the screen.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';

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
    title: 'App Blocking',
    demoBadge: 'DEMO ONLY — nothing is really blocked',
    demoNote:
      'Real app blocking needs native Android modules and a real APK. It cannot run inside Expo Go, so this screen only shows how it will look.',
    namazTitle: 'Namaz time — apps locked',
    namazBody:
      'All apps are blocked until you pray. Finish your namaz, then tap below to unlock.',
    unlock: 'Haan, maine namaz padh li',
    unlockedTitle: 'Unlocked — demo only',
    unlockedBody: 'In the real app this unlocks all apps after you confirm your prayer.',
    lockAgain: 'Lock again (demo)',
    sleepTitle: 'Sleep-time warning',
    sleepBody: 'Sleep time is coming. You have 5 minutes to finish up — then apps will be blocked.',
    startDemo: 'Start 5-minute warning demo',
    closeNow: 'Close now (demo)',
    timeLeft: 'Time left before blocking',
    warningDone: 'Warning over — in the real app, apps would be blocked now.',
  },
  hi: {
    back: '← Wapas',
    title: 'App Blocking',
    demoBadge: 'SIRF DEMO — kuch bhi asli me block nahi hai',
    demoNote:
      'Asli app blocking ke liye native Android modules aur real APK chahiye. Expo Go me ye chal nahi sakta, isliye ye screen sirf dikhati hai ki ye kaisa lagega.',
    namazTitle: 'Namaz ka time — apps locked',
    namazBody:
      'Saare apps band hain jab tak aap namaz na padh lein. Namaz poori karke neeche dabao to unlock hoga.',
    unlock: 'Haan, maine namaz padh li',
    unlockedTitle: 'Unlock ho gaya — sirf demo',
    unlockedBody: 'Asli app me namaz confirm karne par saare apps unlock honge.',
    lockAgain: 'Dobara lock karo (demo)',
    sleepTitle: 'Sleep-time warning',
    sleepBody: 'Sone ka time aa raha hai. 5 minute bache hain — phir apps block ho jayenge.',
    startDemo: '5-minute warning demo shuru karo',
    closeNow: 'Abhi band karo (demo)',
    timeLeft: 'Block hone se pehle bacha time',
    warningDone: 'Warning khatam — asli app me ab apps block ho jate.',
  },
} as const;

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AppBlockScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [locked, setLocked] = useState(true);
  const [warningRunning, setWarningRunning] = useState(false);
  const [warningSeconds, setWarningSeconds] = useState(300);

  useEffect(() => {
    if (!warningRunning) return;
    if (warningSeconds <= 0) {
      setWarningRunning(false);
      return;
    }
    const id = setInterval(() => setWarningSeconds((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [warningRunning, warningSeconds]);

  function startWarning() {
    setWarningSeconds(300);
    setWarningRunning(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.badge}>{s.demoBadge}</Text>
      <Text style={styles.sub}>{s.demoNote}</Text>

      {locked ? (
        <View style={styles.lockCard}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>{s.namazTitle}</Text>
          <Text style={styles.lockBody}>{s.namazBody}</Text>
          <Pressable
            onPress={() => setLocked(false)}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{s.unlock}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{s.unlockedTitle}</Text>
          <Text style={styles.cardBody}>{s.unlockedBody}</Text>
          <Pressable
            onPress={() => setLocked(true)}
            style={styles.peachBtn}
            accessibilityRole="button"
          >
            <Text style={styles.peachBtnText}>{s.lockAgain}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{s.sleepTitle}</Text>
        <Text style={styles.cardBody}>{s.sleepBody}</Text>
        {warningRunning || warningSeconds < 300 ? (
          <>
            <Text style={styles.countLabel}>{s.timeLeft}</Text>
            <Text style={styles.countdown}>{formatCountdown(warningSeconds)}</Text>
            {warningSeconds === 0 ? <Text style={styles.cardBody}>{s.warningDone}</Text> : null}
            <Pressable
              onPress={() => {
                setWarningRunning(false);
                setWarningSeconds(300);
              }}
              style={styles.peachBtn}
              accessibilityRole="button"
            >
              <Text style={styles.peachBtnText}>{s.closeNow}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={startWarning}
            style={styles.primaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{s.startDemo}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: C.peachDeep,
    backgroundColor: C.peach2,
    borderWidth: 1,
    borderColor: C.peach,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    overflow: 'hidden',
  },
  sub: { fontSize: 14, color: C.muted, marginTop: 12, marginBottom: 20, lineHeight: 20 },
  lockCard: {
    backgroundColor: C.teal950,
    borderRadius: 26,
    padding: 26,
    alignItems: 'center',
    marginBottom: 16,
  },
  lockEmoji: { fontSize: 44, marginBottom: 12 },
  lockTitle: { color: C.white, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  lockBody: { color: '#B8CFCB', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 20 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 8 },
  cardBody: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 14 },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  peachBtn: {
    backgroundColor: C.peach,
    borderRadius: 999,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  peachBtnText: { color: C.peachDeep, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  countLabel: { fontSize: 13, fontWeight: '700', color: C.muted, textAlign: 'center' },
  countdown: { fontSize: 56, fontWeight: '800', color: C.teal900, textAlign: 'center', marginVertical: 6 },
});

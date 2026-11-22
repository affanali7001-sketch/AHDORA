/**
 * Welcome screen (preview §2) — Salam + AHDORA meaning as plain rows
 * (no card, no heading, no circles) + one "Shuru karein" button.
 * The preview shows no language toggle here — language lives on the
 * Language screen, which runs before this one.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { MEANING, stringsFor } from '../lib/strings';
import { DARK, useAppTheme } from '../lib/appTheme';
import { C, F, L, T } from '../lib/theme';
import { PillButton } from '../components/ui';
import TutorialVideo from '../components/TutorialVideo';
import { SIGNUP_VIDEO_URL } from '../lib/videos';

export default function WelcomeScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const th = useAppTheme();
  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      {th.splashGreeting ? (
        <View>
          <Text style={[styles.arabic, th.dark && styles.accentDark]}>{s.salamArabic}</Text>
          <Text style={[styles.salam, th.dark && styles.textDark]}>{s.salam}</Text>
        </View>
      ) : null}

      <Text style={[T.eyebrow, styles.eyebrow, th.dark && styles.mutedDark]}>{s.eyebrow}</Text>
      <Text style={[styles.title, th.dark && styles.textDark]}>{s.welTitle}</Text>
      <Text style={[styles.sub, th.dark && styles.mutedDark]}>{s.welSub}</Text>

      <View style={styles.meaning}>
        {MEANING.map((m) => (
          <View key={`${m.letter}-${m.word}`} style={styles.meaningRow}>
            <Text style={[styles.meaningLetter, th.dark && styles.accentDark]}>{m.letter}</Text>
            <Text style={[styles.meaningDash, th.dark && styles.mutedDark]}>—</Text>
            <Text style={[styles.meaningWord, th.dark && styles.mutedDark]}>{m.word}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 26 }}>
        <PillButton label={s.welBtn} onPress={() => goTo('login')} block />
      </View>
      <Text style={[T.note, styles.note]}>{s.welNote}</Text>

      <TutorialVideo
        url={SIGNUP_VIDEO_URL}
        title={s.welSignupVideoT}
        note={s.welSignupVideoS}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  arabic: {
    fontFamily: F.arabic,
    fontSize: 26,
    color: C.teal700,
    marginTop: 8,
    marginBottom: 2,
  },
  salam: {
    fontFamily: F.sans,
    fontSize: 31,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.5,
  },
  eyebrow: { marginTop: 14 },
  title: {
    fontFamily: F.sans,
    fontSize: 24,
    fontWeight: '800',
    color: C.ink,
    marginTop: 8,
    marginBottom: 4,
  },
  sub: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
  },
  meaning: { marginTop: 18 },
  meaningRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 5,
  },
  meaningLetter: {
    fontFamily: F.sans,
    fontSize: 19,
    fontWeight: '800',
    color: C.teal500,
    width: 20,
  },
  meaningDash: { fontFamily: F.sans, fontSize: 16.5, color: C.muted },
  meaningWord: { fontFamily: F.sans, fontSize: 16.5, color: C.muted },
  note: { marginTop: 12 },
  textDark: { color: DARK.text },
  mutedDark: { color: DARK.muted },
  accentDark: { color: DARK.accent },
});

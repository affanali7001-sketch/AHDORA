/**
 * Language screen (preview §1) — the FIRST screen of the app.
 * Pick English or Hinglish; the Quran always carries both translations.
 * Reached from Profile later, picking a language returns there.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { C, F, L } from '../lib/theme';
import { Card } from '../components/ui';

export default function LanguageScreen({ lang, user, onLang, goTo }: ScreenProps) {
  const s = stringsFor(lang);

  function pick(next: AppLanguage) {
    onLang(next);
    goTo(user ? 'profile' : 'welcome');
  }

  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      <Text style={styles.arabic}>{s.salamArabic}</Text>
      <Text style={styles.title}>{s.langTitle}</Text>
      <Text style={styles.sub}>{s.langSub}</Text>

      <View style={styles.options}>
        <Pressable
          onPress={() => pick('en')}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>English</Text>
            <Text style={styles.optionDesc}>{s.langEnglishDesc}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
        <Pressable
          onPress={() => pick('hi')}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Hinglish</Text>
            <Text style={styles.optionDesc}>{s.langHinglishDesc}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      </View>

      <Card style={styles.noteCard}>
        <Text style={styles.noteText}>{s.langNote}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  arabic: {
    fontFamily: F.arabic,
    fontSize: 24,
    color: C.teal700,
    marginTop: 6,
    marginBottom: 2,
  },
  title: {
    fontFamily: F.sans,
    fontSize: 26,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  sub: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
    marginTop: 6,
  },
  options: { marginTop: 22, gap: 12, marginBottom: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  optionText: { flex: 1 },
  optionTitle: { fontFamily: F.sans, fontSize: 17, fontWeight: '800', color: C.ink },
  optionDesc: { fontFamily: F.sans, fontSize: 12.5, color: C.muted, marginTop: 2 },
  arrow: { fontFamily: F.sans, fontSize: 17, fontWeight: '800', color: C.ink, marginLeft: 12 },
  noteCard: { backgroundColor: C.peach, borderColor: C.peach, marginBottom: 0 },
  noteText: {
    fontFamily: F.sans,
    fontSize: 13.5,
    lineHeight: 22,
    color: C.peachInk,
  },
});

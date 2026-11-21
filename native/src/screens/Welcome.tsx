/**
 * Welcome screen — Salam + the AHDORA meaning + language selector.
 * Look refreshed to the approved preview design; behaviour unchanged.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { MEANING, stringsFor, type AppLanguage } from '../lib/strings';
import { C, L, S, T } from '../lib/theme';
import { PillButton } from '../components/ui';

export function LanguageToggle({
  lang,
  onLang,
}: {
  lang: AppLanguage;
  onLang: (l: AppLanguage) => void;
}) {
  return (
    <View style={styles.langRow}>
      <Pressable
        onPress={() => onLang('en')}
        style={[styles.langBtn, lang === 'en' && styles.langBtnOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: lang === 'en' }}
      >
        <Text style={[styles.langText, lang === 'en' && styles.langTextOn]}>English</Text>
      </Pressable>
      <Pressable
        onPress={() => onLang('hi')}
        style={[styles.langBtn, lang === 'hi' && styles.langBtnOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: lang === 'hi' }}
      >
        <Text style={[styles.langText, lang === 'hi' && styles.langTextOn]}>Hinglish</Text>
      </Pressable>
    </View>
  );
}

export default function WelcomeScreen({ lang, onLang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const [signupNote, setSignupNote] = useState(false);
  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      <Text style={styles.salamArabic}>{s.salamArabic}</Text>
      <Text style={styles.salam}>{s.salam}</Text>

      <Text style={[T.eyebrow, styles.eyebrow]}>{s.eyebrow}</Text>
      <Text style={styles.title}>{s.welcomeTitle}</Text>
      <Text style={styles.sub}>{s.welcomeSub}</Text>

      <View style={styles.meaningCard}>
        <Text style={styles.meaningTitle}>{s.meaningTitle}</Text>
        {MEANING.map((m) => (
          <View key={`${m.letter}-${m.word}`} style={styles.meaningRow}>
            <View style={styles.meaningLetter}>
              <Text style={styles.meaningLetterText}>{m.letter}</Text>
            </View>
            <Text style={styles.meaningDash}>—</Text>
            <Text style={styles.meaningWord}>{m.word}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.langLabel}>{s.languageLabel}</Text>
      <LanguageToggle lang={lang} onLang={onLang} />

      <PillButton label={`${s.logIn} →`} onPress={() => goTo('login')} />
      <PillButton
        label={s.createAccount}
        variant="peach"
        onPress={() => setSignupNote(true)}
      />
      {signupNote && <Text style={T.note}>{s.signupLater}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  salamArabic: {
    fontSize: 26,
    color: C.teal,
    textAlign: 'center',
    marginBottom: 6,
  },
  salam: {
    fontSize: 22,
    fontWeight: '800',
    color: C.teal900,
    textAlign: 'center',
    marginBottom: 26,
  },
  eyebrow: { textAlign: 'center', marginBottom: 8 },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 15,
    color: C.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  meaningCard: {
    backgroundColor: C.white,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  meaningTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: C.muted,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  meaningRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  meaningLetter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaningLetterText: { color: C.white, fontSize: 17, fontWeight: '800' },
  meaningDash: { color: C.muted, marginHorizontal: 12, fontSize: 15 },
  meaningWord: { fontSize: 18, fontWeight: '700', color: C.ink },
  langLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
    textAlign: 'center',
    marginBottom: 8,
  },
  langRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    padding: 4,
    marginBottom: 24,
  },
  langBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  langBtnOn: { backgroundColor: C.teal950 },
  langText: { fontSize: 14, fontWeight: '700', color: C.muted },
  langTextOn: { color: C.white },
});

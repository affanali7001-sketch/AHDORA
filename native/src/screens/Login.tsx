/**
 * Login screen — logic UNCHANGED from the verified Phase 1 flow:
 * calls login() from api.ts (CSRF + manual cookie jar), clears the
 * password on success, surfaces the server's error message.
 * Only the look was refreshed to the preview design.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { login } from '../lib/api';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { PillButton } from '../components/ui';

export default function LoginScreen({ lang, goTo, onLoginSuccess }: ScreenProps) {
  const s = stringsFor(lang);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError(s.requestFailed);
      return;
    }
    setBusy(true);
    try {
      const user = await login(cleanEmail, password);
      setPassword('');
      onLoginSuccess(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('welcome')} accessibilityRole="button">
        <Text style={styles.back}>← {s.back}</Text>
      </Pressable>

      <Text style={styles.salamArabic}>{s.salamArabic}</Text>
      <Text style={styles.salam}>{s.salam}</Text>
      <Text style={styles.title}>{s.loginTitle}</Text>
      <Text style={styles.sub}>{s.loginSub}</Text>

      <Text style={T.label}>{s.email}</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={s.emailPlaceholder}
        placeholderTextColor={C.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!busy}
      />

      <Text style={T.label}>{s.password}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={C.muted}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          editable={!busy}
          onSubmitEditing={submit}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button">
          <Text style={styles.showToggle}>{showPassword ? s.hide : s.show}</Text>
        </Pressable>
      </View>

      {error ? <Text style={T.error}>{error}</Text> : null}

      <View style={{ marginTop: 16 }}>
        <PillButton label={`${s.logIn} →`} onPress={submit} disabled={busy} busy={busy} />
      </View>
      {busy ? <Text style={T.note}>{s.loggingIn}</Text> : null}

      <Text style={styles.forgot}>{s.forgot}</Text>
      <Text style={T.note}>{s.forgotSub}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: { fontSize: 15, fontWeight: '700', color: C.teal, marginBottom: 20 },
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
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    marginBottom: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.ink },
  showToggle: { color: C.teal, fontWeight: '700', fontSize: 14, marginLeft: 8 },
  forgot: {
    fontSize: 14,
    fontWeight: '700',
    color: C.teal,
    textAlign: 'center',
    marginTop: 20,
  },
});

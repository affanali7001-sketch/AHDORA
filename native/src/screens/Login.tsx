/**
 * Login screen (preview §3) — segmented Log in / Create account tabs,
 * email + password, peach note. Logic UNCHANGED from the verified
 * Phase 1 flow: login() from api.ts (CSRF + manual cookie jar).
 *
 * "Password bhool gaye?" opens a real reset flow in this same screen:
 * POST /api/auth/forgot-password (see api/src/routes/auth.ts) and the
 * server's own reply is shown verbatim — no fake "sent" claim. The
 * reset link itself goes to the user's email and opens the web app,
 * where the token is redeemed (POST /api/auth/reset-password).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { apiFetch, login } from '../lib/api';
import { stringsFor } from '../lib/strings';
import { C, F, L, T } from '../lib/theme';
import { Card, Field, Input, PillButton, SegmentedControl } from '../components/ui';

type Mode = 'login' | 'reset';

export default function LoginScreen({ lang, goTo, onLoginSuccess }: ScreenProps) {
  const s = stringsFor(lang);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState<string | null>(null);

  async function submitLogin() {
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

  async function submitReset() {
    if (busy) return;
    setError(null);
    setResetSent(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError(s.requestFailed);
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        sent?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.sent) {
        throw new Error(
          typeof data.error === 'string' && data.error.length > 0
            ? data.error
            : s.requestFailed,
        );
      }
      // The server's own words, verbatim — it answers the same way
      // whether or not the email exists (no account enumeration).
      setResetSent(
        typeof data.message === 'string' && data.message.length > 0
          ? data.message
          : s.requestFailed,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : s.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={L.scrollNoNav} showsVerticalScrollIndicator={false}>
      <Text style={styles.arabic}>{s.salamArabic}</Text>
      <Text style={styles.salam}>{s.salam}</Text>
      <Text style={styles.welcome}>
        {mode === 'reset' ? s.resetTitle : s.loginWelcome}
      </Text>
      <Text style={styles.sub}>{mode === 'reset' ? s.resetSub : s.loginSub}</Text>

      {mode === 'login' ? (
        <>
          <SegmentedControl
            options={[
              { label: s.loginTab, value: 'login' },
              { label: s.signupTab, value: 'signup' },
            ]}
            value="login"
            onChange={(v) => {
              if (v === 'signup') goTo('signup');
            }}
          />

          <Field label={s.email}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder={s.emailPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
            />
          </Field>
          <Field label={s.password}>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              editable={!busy}
              onSubmitEditing={submitLogin}
            />
          </Field>

          {error ? <Text style={T.error}>{error}</Text> : null}

          <View style={{ marginTop: 20 }}>
            <PillButton
              label={s.loginBtn}
              onPress={submitLogin}
              disabled={busy}
              busy={busy}
              block
            />
          </View>
          {busy ? <Text style={T.note}>{s.loggingIn}</Text> : null}

          <Pressable
            onPress={() => {
              setMode('reset');
              setError(null);
              setResetSent(null);
            }}
            accessibilityRole="button"
            style={styles.forgotWrap}
          >
            <Text style={styles.forgot}>{s.forgot}</Text>
          </Pressable>

          <Card style={styles.noteCard}>
            <Text style={styles.noteText}>{s.loginNote}</Text>
          </Card>
        </>
      ) : (
        <>
          <Field label={s.email}>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder={s.emailPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
            />
          </Field>

          {error ? <Text style={T.error}>{error}</Text> : null}
          {resetSent ? (
            <Card style={styles.noteCard}>
              <Text style={styles.noteText}>{resetSent}</Text>
            </Card>
          ) : null}

          <View style={{ marginTop: 20 }}>
            <PillButton
              label={s.resetBtn}
              onPress={submitReset}
              disabled={busy}
              busy={busy}
              block
            />
          </View>
          {busy ? <Text style={T.note}>{s.resetSending}</Text> : null}

          <Pressable
            onPress={() => {
              setMode('login');
              setError(null);
              setResetSent(null);
            }}
            accessibilityRole="button"
            style={styles.forgotWrap}
          >
            <Text style={styles.forgot}>{s.resetBack}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  arabic: {
    fontFamily: F.arabic,
    fontSize: 23,
    color: C.teal700,
    marginTop: 4,
    marginBottom: 2,
  },
  salam: {
    fontFamily: F.sans,
    fontSize: 27,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.5,
  },
  welcome: {
    fontFamily: F.sans,
    fontSize: 21,
    fontWeight: '800',
    color: C.ink,
    marginTop: 10,
    marginBottom: 4,
  },
  sub: {
    fontFamily: F.sans,
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
  },
  forgotWrap: { alignItems: 'center', marginTop: 16, marginBottom: 4 },
  forgot: {
    fontFamily: F.sans,
    fontSize: 14,
    fontWeight: '800',
    color: C.teal700,
    padding: 10,
  },
  noteCard: { backgroundColor: C.peach, borderColor: C.peach, marginBottom: 0 },
  noteText: {
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 21,
    color: C.peachInk,
  },
});

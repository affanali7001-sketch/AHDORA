/**
 * Signup screen — real account creation against the live API.
 * Mirrors Login.tsx: calls signup() from api.ts (CSRF + manual
 * cookie jar), surfaces the server's error message. The server
 * requires name 2–60 chars and password 12–128 chars, so the
 * form says so upfront and validates client-side. On success the
 * user is logged in immediately and routed to onboarding.
 *
 * After a successful signup the notification-permission prompt is
 * shown (in-app explanation, then the system dialog) — but only when
 * the OS dialog can still be shown and this user has never been
 * asked before (see src/lib/notificationPrompt.ts). When permission
 * is blocked so the dialog cannot appear again, the Settings card
 * is shown instead. It never blocks signup and is never re-asked.
 */
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { signup, type AuthUser } from '../lib/api';
import {
  allowNotificationsAfterAuth,
  isNotificationPermissionBlocked,
  openNotificationSettingsAfterAuth,
  shouldAskNotificationPermission,
  skipNotificationsAfterAuth,
} from '../lib/notificationPrompt';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, PillButton } from '../components/ui';

export default function SignupScreen({ lang, goTo, onLoginSuccess }: ScreenProps) {
  const s = stringsFor(lang);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Post-signup notification prompt — same rule as Login: the new
  // user is held here until they answer (allow / not now), only
  // when the OS dialog can still be shown and this user has
  // never been asked before (see src/lib/notificationPrompt.ts).
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  // Blocked state: permission denied and the OS dialog will not
  // appear again — show the Settings card (open Settings / not
  // now) instead of the ask card, once per user.
  const [showNotifBlocked, setShowNotifBlocked] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  // When the keyboard opens over the password fields, scroll the
  // form so the focused field stays visible (the user reported the
  // password field hiding behind the keyboard, 2026-11-22).
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  function scrollPasswordIntoView() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }

  async function submit() {
    if (busy) return;
    setError(null);
    setNotice(null);
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (cleanName.length < 2) {
      setError(s.fullName);
      return;
    }
    if (!cleanEmail || !password) {
      setError(s.requestFailed);
      return;
    }
    if (password.length < 12) {
      setError(s.passwordHint);
      return;
    }
    // Confirmation password: the password is entered twice at signup
    // (the user asked where the confirmation is, 2026-11-22) and
    // both entries must match, so a typo cannot lock the user out.
    if (password !== confirmPassword) {
      setError(s.passwordsNoMatch);
      return;
    }
    setBusy(true);
    try {
      const result = await signup(cleanName, cleanEmail, password);
      setPassword('');
      setConfirmPassword('');
      if (result.notice) setNotice(result.notice);
      // Ask for notification permission right after signup — but
      // only when the OS dialog can still be shown and this user has
      // not been asked / denied before. When permission is blocked
      // (the dialog will not appear again), show the Settings card
      // instead. Otherwise go straight in; the prompt must never
      // block or repeat.
      if (await shouldAskNotificationPermission(result.user.id)) {
        setPendingUser(result.user);
        setShowNotifPrompt(true);
      } else if (await isNotificationPermissionBlocked(result.user.id)) {
        setPendingUser(result.user);
        setShowNotifBlocked(true);
      } else {
        onLoginSuccess(result.user);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : s.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function allowNotifications() {
    if (!pendingUser || promptBusy) return;
    setPromptBusy(true);
    await allowNotificationsAfterAuth(pendingUser.id);
    setPromptBusy(false);
    onLoginSuccess(pendingUser);
  }

  async function skipNotifications() {
    if (!pendingUser || promptBusy) return;
    setPromptBusy(true);
    await skipNotificationsAfterAuth(pendingUser.id);
    setPromptBusy(false);
    onLoginSuccess(pendingUser);
  }

  async function openNotifSettings() {
    if (!pendingUser || promptBusy) return;
    setPromptBusy(true);
    await openNotificationSettingsAfterAuth(pendingUser.id);
    setPromptBusy(false);
    onLoginSuccess(pendingUser);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={L.scrollNoNav}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => goTo('welcome')} accessibilityRole="button">
        <Text style={styles.back}>← {s.back}</Text>
      </Pressable>

      <Text style={styles.salamArabic}>{s.salamArabic}</Text>
      <Text style={styles.salam}>{s.salam}</Text>
      <Text style={styles.title}>{s.signupTitle}</Text>
      <Text style={styles.sub}>{s.signupSub}</Text>

      {showNotifPrompt && pendingUser ? (
        <Card>
          <Text style={T.cardTitle}>{s.notifPromptT}</Text>
          <Text style={[T.cardBody, { marginTop: 6 }]}>{s.notifPromptB}</Text>
          <View style={{ marginTop: 14 }}>
            <PillButton
              label={s.notifPromptAllow}
              onPress={() => void allowNotifications()}
              disabled={promptBusy}
              busy={promptBusy}
              block
            />
          </View>
          <View style={{ marginTop: 10 }}>
            <PillButton
              label={s.notifPromptLater}
              variant="ghost"
              onPress={() => void skipNotifications()}
              disabled={promptBusy}
              block
            />
          </View>
        </Card>
      ) : showNotifBlocked && pendingUser ? (
        <Card>
          <Text style={T.cardTitle}>{s.notifBlockedT}</Text>
          <Text style={[T.cardBody, { marginTop: 6 }]}>{s.notifBlockedB}</Text>
          <View style={{ marginTop: 14 }}>
            <PillButton
              label={s.notifBlockedOpen}
              onPress={() => void openNotifSettings()}
              disabled={promptBusy}
              busy={promptBusy}
              block
            />
          </View>
          <View style={{ marginTop: 10 }}>
            <PillButton
              label={s.notifPromptLater}
              variant="ghost"
              onPress={() => void skipNotifications()}
              disabled={promptBusy}
              block
            />
          </View>
        </Card>
      ) : (
        <>
          <Text style={T.label}>{s.fullName}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={s.namePlaceholder}
        placeholderTextColor={C.muted}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="name"
        editable={!busy}
      />

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
          placeholder="••••••••••••"
          placeholderTextColor={C.muted}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          editable={!busy}
          onFocus={scrollPasswordIntoView}
          onSubmitEditing={submit}
        />
        <Pressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button">
          <Text style={styles.showToggle}>{showPassword ? s.hide : s.show}</Text>
        </Pressable>
      </View>
      <Text style={T.note}>{s.passwordHint}</Text>

      <Text style={T.label}>{s.confirmPassword}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••••••"
          placeholderTextColor={C.muted}
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password-new"
          editable={!busy}
          onFocus={scrollPasswordIntoView}
          onSubmitEditing={submit}
        />
        <Pressable onPress={() => setShowConfirmPassword((v) => !v)} accessibilityRole="button">
          <Text style={styles.showToggle}>{showConfirmPassword ? s.hide : s.show}</Text>
        </Pressable>
      </View>

      {error ? <Text style={T.error}>{error}</Text> : null}
      {notice ? <Text style={T.note}>{notice}</Text> : null}

      <View style={{ marginTop: 16 }}>
        <PillButton label={`${s.createAccount} →`} onPress={submit} disabled={busy} busy={busy} />
      </View>
      {busy ? <Text style={T.note}>{s.creatingAccount}</Text> : null}

      <Pressable onPress={() => goTo('login')} accessibilityRole="button">
        <Text style={styles.loginLink}>{s.alreadyHaveAccount}</Text>
      </Pressable>
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 8,
  },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.ink },
  showToggle: { color: C.teal, fontWeight: '700', fontSize: 14, marginLeft: 8 },
  loginLink: {
    fontSize: 14,
    fontWeight: '700',
    color: C.teal,
    textAlign: 'center',
    marginTop: 20,
  },
});

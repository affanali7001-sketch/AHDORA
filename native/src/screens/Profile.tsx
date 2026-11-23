/**
 * Profile — rebuilt to the approved preview (§24 in the preview file).
 * Top row: 58px teal avatar + name + "Diploma CS · 4th Semester ·
 * Akkalkuwa" (REAL, from the user's profile — parts that are missing
 * are simply left out, never invented). No email, no verified line,
 * no dark card. Peach "Edit profile" → Onboarding, ghost "Namaz ke
 * time badlo" → Prayer. Settings card: Uninstall protection (a REAL
 * setting saved on the phone, with an honest note that actually
 * stopping an uninstall needs the native module), Language (→
 * language screen), Notifications (→ Notifications), Password badlo
 * (REAL — POST /api/auth/forgot-password sends the reset link to the
 * user's own email and shows the real response). Points & badges card
 * with REAL server points. Soft red-text Log out. The delete note
 * opens a REAL export/delete section: data export (GET
 * /api/auth/export, shared as a file) and account deletion (DELETE
 * /api/auth/account with password confirmation, then logout).
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { apiFetch, changePassword } from '../lib/api';
import type { ScreenProps } from '../lib/nav';
import { stringsFor, type AppLanguage } from '../lib/strings';
import { loadMinimal, saveMinimal } from '../lib/minimal';
import {
  DARK,
  setAnimationsPref,
  setHomeGreetingPref,
  setSplashGreetingPref,
  setThemePref,
  useAppTheme,
  type ThemePref,
} from '../lib/appTheme';
import { C, L, T } from '../lib/theme';
import { Card, Input, PillButton, SegmentedControl, Switch } from '../components/ui';
import TutorialVideo from '../components/TutorialVideo';
import { HOW_TO_USE_VIDEO_URL } from '../lib/videos';
import { getNotificationPermissionDetail } from '../lib/prayerNotifications';
import {
  getProfile,
  rewardsSummary,
  type ProfileData,
  type RewardsSummary,
} from '../lib/apiSocial';

const UNINSTALL_KEY = '@ahdora/profile/uninstallProtection';

/** Local strings for the Minimal toggle (Tasbeeh pattern — strings.ts untouched). */
const STRINGS: Record<AppLanguage, { minimalT: string; minimalS: string }> = {
  en: {
    minimalT: 'Minimal today view',
    minimalS: 'Home shows only the next prayer and today’s prayer times — no tiles, no summary.',
  },
  hi: {
    minimalT: 'Minimal aaj ka view',
    minimalS: 'Home par sirf agli namaz aur aaj ke namaz ke time dikhenge — na tiles, na summary.',
  },
};

function profileStr(profile: ProfileData | null, key: string): string {
  if (!profile) return '';
  const value = profile[key];
  return typeof value === 'string' ? value : '';
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/** "Class 8" for a school student, "4th Semester" for a college student — never a bare number. */
function eduDetail(profile: ProfileData | null): string {
  const classYear = profileStr(profile, 'classYear').trim();
  if (classYear) {
    const n = Number(classYear);
    return Number.isInteger(n) ? `Class ${n}` : classYear;
  }
  const semester = profileStr(profile, 'semester').trim();
  if (semester) {
    const n = Number(semester);
    return Number.isInteger(n) ? `${ordinal(n)} Semester` : semester;
  }
  return '';
}

export default function ProfileScreen({ lang, goTo, user, onLogout }: ScreenProps) {
  const s = stringsFor(lang);
  const ms = STRINGS[lang];
  const th = useAppTheme();
  const uid = user?.id ?? 'anon';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [uninstall, setUninstall] = useState(false);
  const [minimal, setMinimal] = useState(false);
  // Live notification-permission state for the Notifications row:
  // when permission is missing the row says so honestly, so the
  // user knows tapping it is the way to turn alerts on.
  const [notifPermOff, setNotifPermOff] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetNote, setResetNote] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passNote, setPassNote] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteNote, setDeleteNote] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportNote, setExportNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [prof, rw, stored, minimalStored, permDetail] = await Promise.all([
        getProfile(),
        rewardsSummary(),
        AsyncStorage.getItem(UNINSTALL_KEY),
        loadMinimal(uid),
        getNotificationPermissionDetail(),
      ]);
      setProfile(prof.profile);
      setRewards(rw);
      if (stored !== null) setUninstall(stored === 'true');
      setMinimal(minimalStored);
      setNotifPermOff(permDetail.status !== 'granted');
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleUninstall(value: boolean) {
    setUninstall(value);
    try {
      await AsyncStorage.setItem(UNINSTALL_KEY, value ? 'true' : 'false');
    } catch {
      // Kept in memory for this session; the note below stays honest.
    }
  }

  async function toggleMinimal(value: boolean) {
    setMinimal(value);
    await saveMinimal(uid, value);
  }

  async function sendResetLink() {
    if (!user?.email || resetBusy) return;
    setResetBusy(true);
    setResetNote('');
    setError('');
    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: unknown; message?: unknown };
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : s.errorGeneric);
      }
      setResetNote(s.pfResetSent);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setResetBusy(false);
    }
  }

  async function changePass() {
    if (!oldPass || !newPass || passBusy) return;
    setPassBusy(true);
    setPassNote('');
    setError('');
    try {
      await changePassword(oldPass, newPass);
      setOldPass('');
      setNewPass('');
      setPassNote(s.pfPassChanged);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setPassBusy(false);
    }
  }

  async function exportData() {
    if (exportBusy) return;
    setExportBusy(true);
    setExportNote('');
    setError('');
    try {
      const response = await apiFetch('/api/auth/export', { method: 'GET' });
      const text = await response.text();
      if (!response.ok) {
        const data = JSON.parse(text || '{}') as { error?: unknown };
        throw new Error(typeof data.error === 'string' ? data.error : s.errorGeneric);
      }
      await Share.share({ message: text, title: 'ahdora-export.json' });
      setExportNote(s.pfExportDone);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteAccount() {
    if (!deletePassword || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteNote('');
    setError('');
    try {
      const response = await apiFetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!response.ok && response.status !== 204) {
        const data = (await response.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof data.error === 'string' ? data.error : s.errorGeneric);
      }
      await onLogout();
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setDeleteBusy(false);
    }
  }

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const subParts = [
    profileStr(profile, 'course'),
    eduDetail(profile),
    profileStr(profile, 'city'),
  ].filter((v) => v.length > 0);

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      {/* Identity row — no email, no verified line, no dark card */}
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.h2, th.dark && styles.textDark]}>{user?.name ?? ''}</Text>
          {subParts.length > 0 ? (
            <Text style={[T.sub, th.dark && styles.mutedDark]}>{subParts.join(' · ')}</Text>
          ) : null}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={C.teal700} style={{ marginVertical: 24 }} />
      ) : (
        <View>
          {error ? <Text style={T.error}>{error}</Text> : null}

          <PillButton label={s.pfEdit} variant="peach" block onPress={() => goTo('onboarding')} />
          <PillButton label={s.pfNamazEdit} variant="ghost" block onPress={() => goTo('prayer')} />

          {/* Settings */}
          <Card style={th.dark ? styles.cardDark : undefined}>
            <Text style={[T.cardTitle, th.dark && styles.textDark]}>{s.pfSettings}</Text>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.pfUninstallT}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{s.pfUninstallS}</Text>
              </View>
              <Switch value={uninstall} onValueChange={(v) => void toggleUninstall(v)} />
            </View>
            <Text style={[styles.honestNote, th.dark && styles.mutedDark]}>{s.pfUninstallNote}</Text>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{ms.minimalT}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{ms.minimalS}</Text>
              </View>
              <Switch value={minimal} onValueChange={(v) => void toggleMinimal(v)} />
            </View>
            {/* Display — theme, animations, greetings */}
            <Text style={[styles.sectionLabel, th.dark && styles.textDark]}>{s.setDisplay}</Text>
            <View style={[styles.row, styles.columnRow, th.dark && styles.rowDark]}>
              <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.setTheme}</Text>
              <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{s.setThemeSub}</Text>
              <SegmentedControl<ThemePref>
                options={[
                  { label: s.setThemeLight, value: 'light' },
                  { label: s.setThemeSystem, value: 'system' },
                  { label: s.setThemeDark, value: 'dark' },
                ]}
                value={th.pref}
                onChange={(v) => setThemePref(uid, v)}
              />
            </View>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.setAnim}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{s.setAnimSub}</Text>
              </View>
              <Switch value={th.animations} onValueChange={(v) => setAnimationsPref(uid, v)} />
            </View>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.setSplash}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{s.setSplashSub}</Text>
              </View>
              <Switch value={th.splashGreeting} onValueChange={(v) => setSplashGreetingPref(uid, v)} />
            </View>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.setHomeGreet}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{s.setHomeGreetSub}</Text>
              </View>
              <Switch value={th.homeGreeting} onValueChange={(v) => setHomeGreetingPref(uid, v)} />
            </View>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.pfLangT}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>
                  {lang === 'hi' ? 'Abhi: Hinglish · Badalne ke liye dabao.' : 'Currently: English · Tap to change.'}
                </Text>
              </View>
              <PillButton label={s.pfLangBtn} small variant="ghost" onPress={() => goTo('language')} />
            </View>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.pfNotifT}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>
                  {notifPermOff ? s.ntPermOff : s.pfNotifS}
                </Text>
              </View>
              <PillButton label={s.pfOpen} small variant="ghost" onPress={() => goTo('notifications')} />
            </View>
            <View style={[styles.row, th.dark && styles.rowDark]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.pfSupportT}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{s.pfSupportS}</Text>
              </View>
              <PillButton label={s.pfSupportBtn} small variant="ghost" onPress={() => goTo('support')} />
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, th.dark && styles.textDark]}>{s.pfPassT}</Text>
                <Text style={[styles.rowSub, th.dark && styles.mutedDark]}>{s.pfPassS}</Text>
              </View>
              <PillButton
                label={s.pfPassOpen}
                small
                variant="ghost"
                onPress={() => setShowPass((v) => !v)}
              />
            </View>
            {resetNote ? <Text style={styles.okNote}>{resetNote}</Text> : null}
          </Card>

          {/* Change password — old + new password, no reset link as
              the main flow. The "Forget password" link under the old
              password sends the reset email instead. */}
          {showPass ? (
            <Card style={th.dark ? styles.cardDark : undefined}>
              <Text style={[T.cardBody, { marginBottom: 12 }, th.dark && styles.mutedDark]}>
                {s.pfPassS}
              </Text>
              <Input
                value={oldPass}
                onChangeText={setOldPass}
                placeholder={s.pfPassOldPh}
                secureTextEntry
              />
              <Pressable
                onPress={() => void sendResetLink()}
                disabled={resetBusy}
                accessibilityRole="button"
              >
                <Text style={styles.forgotLink}>{s.pfPassForgot}</Text>
              </Pressable>
              {resetNote ? <Text style={styles.okNote}>{resetNote}</Text> : null}
              <Input
                value={newPass}
                onChangeText={setNewPass}
                placeholder={s.pfPassNewPh}
                secureTextEntry
                style={{ marginTop: 10 }}
              />
              <View style={{ marginTop: 12 }}>
                <PillButton
                  label={s.pfPassChangeBtn}
                  variant="primary"
                  block
                  onPress={() => void changePass()}
                  disabled={!oldPass || !newPass || passBusy}
                  busy={passBusy}
                />
              </View>
              {passNote ? <Text style={styles.okNote}>{passNote}</Text> : null}
            </Card>
          ) : null}

          {/* Points & badges — real server totals */}
          <Card style={th.dark ? styles.cardDark : undefined}>
            <Text style={[T.cardTitle, th.dark && styles.textDark]}>{s.pfPoints}</Text>
            <Text style={[T.cardBody, { marginTop: 6, lineHeight: 26 }, th.dark && styles.mutedDark]}>
              ⭐ {rewards ? rewards.total : '—'} points
              {rewards && rewards.badges.length > 0 ? ` · 🏅 ${rewards.badges[0].title}` : ''}
            </Text>
            {rewards && rewards.badges.length === 0 ? (
              <Text style={[T.cardBody, { marginTop: 2 }, th.dark && styles.mutedDark]}>{s.pfNoBadges}</Text>
            ) : null}
            <Text style={[T.cardBody, { marginTop: 6 }, th.dark && styles.mutedDark]}>{s.pfPointsNote}</Text>
          </Card>

          {/* Log out — soft button, red text */}
          <Pressable
            onPress={async () => {
              if (loggingOut) return;
              setLoggingOut(true);
              try {
                await onLogout();
              } finally {
                setLoggingOut(false);
              }
            }}
            disabled={loggingOut}
            style={({ pressed }) => [
              styles.logoutBtn,
              th.dark && styles.logoutBtnDark,
              (loggingOut || pressed) && styles.logoutBtnDisabled,
            ]}
            accessibilityRole="button"
          >
            {loggingOut ? (
              <ActivityIndicator color={C.red} />
            ) : (
              <Text style={styles.logoutText}>{s.pfLogout}</Text>
            )}
          </Pressable>

          {/* Account delete — a VISIBLE button next to Log out, not a
              tiny note. The user (2026-11-22) only saw Log out and
              asked where permanent delete is — it was hidden behind
              a small muted text link. Tapping opens the real
              export + password-confirm delete section below. */}
          <Pressable
            onPress={() => setShowDelete((v) => !v)}
            style={({ pressed }) => [
              styles.logoutBtn,
              styles.deleteBtn,
              th.dark && styles.deleteBtnDark,
              pressed && styles.logoutBtnDisabled,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.deleteBtnText}>{s.pfDeleteOpen}</Text>
          </Pressable>
          {showDelete ? (
            <Card style={th.dark ? styles.cardDark : undefined}>
              <Text style={[T.cardBody, { marginBottom: 12 }, th.dark && styles.mutedDark]}>
                {s.pfDeleteHint}
              </Text>
              <PillButton
                label={s.pfExportBtn}
                variant="ghost"
                block
                onPress={() => void exportData()}
                disabled={exportBusy}
                busy={exportBusy}
              />
              {exportNote ? <Text style={styles.okNote}>{exportNote}</Text> : null}
              <Input
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder={s.password}
                secureTextEntry
                style={{ marginTop: 8 }}
              />
              <PillButton
                label={s.pfDeleteBtn}
                variant="soft"
                block
                onPress={() => void deleteAccount()}
                disabled={!deletePassword || deleteBusy}
                busy={deleteBusy}
              />
              {deleteNote ? <Text style={styles.okNote}>{deleteNote}</Text> : null}
            </Card>
          ) : null}

          <TutorialVideo
            url={HOW_TO_USE_VIDEO_URL}
            title={s.pfHowToT}
            note={s.pfHowToS}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.teal700, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans', fontSize: 23, fontWeight: '800', color: C.white },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  rowDark: { borderBottomColor: DARK.border },
  columnRow: { flexDirection: 'column', alignItems: 'stretch' },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.muted,
    marginTop: 18,
    marginBottom: 2,
  },
  cardDark: { backgroundColor: DARK.card, borderColor: DARK.border },
  textDark: { color: DARK.text },
  mutedDark: { color: DARK.muted },
  logoutBtnDark: { backgroundColor: DARK.card, borderColor: DARK.border },
  deleteBtnDark: { backgroundColor: DARK.card, borderColor: C.red },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink },
  rowSub: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 2 },
  honestNote: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 8 },
  okNote: { fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '700', color: C.teal500, marginTop: 8, lineHeight: 18 },
  forgotLink: {
    fontFamily: 'PlusJakartaSans',
    fontSize: 13,
    fontWeight: '700',
    color: C.teal700,
    marginTop: 8,
    textAlign: 'left',
  },
  logoutBtn: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  logoutBtnDisabled: { opacity: 0.55 },
  logoutText: { fontFamily: 'PlusJakartaSans', fontSize: 15, fontWeight: '800', color: C.red },
  deleteNote: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 18 },
  deleteBtn: { marginTop: 0, borderColor: C.red, backgroundColor: '#FDF0ED' },
  deleteBtnText: { fontFamily: 'PlusJakartaSans', fontSize: 15, fontWeight: '800', color: C.red },
});

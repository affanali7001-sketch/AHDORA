/**
 * Profile — rebuilt to the approved preview (§24 in the preview file).
 * Top row: 58px teal avatar + name + "Diploma CS · 4th Semester ·
 * Akkalkuwa" (REAL, from the user's profile — parts that are missing
 * are simply left out, never invented). No email, no verified line,
 * no dark card. Peach "Edit profile" → Onboarding, ghost "Namaz ke
 * time badlo" → Prayer. Settings card: Uninstall protection (REAL
 * Device Admin — the switch shows the live admin state from
 * DevicePolicyManager and tapping it opens Android's own activation
 * screen; it never was, and never pretends to be, a saved flag), Language (→
 * language screen), Notifications (→ Notifications), Password badlo
 * (REAL — POST /api/auth/forgot-password sends the reset link to the
 * user's own email and shows the real response). Points & badges card
 * with REAL server points. Soft red-text Log out. The delete note
 * opens a REAL export/delete section: data export (GET
 * /api/auth/export, shared as a file) and account deletion (DELETE
 * /api/auth/account with password confirmation, then logout).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { apiFetch, changePassword } from '../lib/api';
import { isDeviceAdminActive, isDeviceAdminAvailable, openDeviceAdminSecuritySettings, requestDeviceAdminActivation } from '../lib/deviceAdmin';
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
  loadCachedProfile,
  rewardsSummary,
  type ProfileData,
  type RewardsSummary,
} from '../lib/apiSocial';

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
  /** True when the profile shown is the last saved copy because the
      server refresh failed — the note under the error says so. */
  const [profileCached, setProfileCached] = useState(false);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [uninstall, setUninstall] = useState(false);
  // False in Expo Go / on iOS, where the native admin module does
  // not exist — the switch is then disabled and the note says so.
  const [adminAvailable, setAdminAvailable] = useState(false);
  // Set when the system activation screen could not be opened at
  // all — the switch then shows this honest error + a retry and a
  // Security-settings fallback, instead of silently doing nothing.
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  /** True after the first load finished — later reloads (e.g. coming
      back from the system activation screen) must NOT flash the whole
      screen to a spinner: that flash is exactly what the user saw as
      "sirf refresh ho raha hai" when the toggle did nothing. */
  const loadedOnce = useRef(false);
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
    // Only the FIRST load shows the full-screen spinner; later
    // reloads update the rows silently (see loadedOnce above).
    const first = !loadedOnce.current;
    if (first) {
      setLoading(true);
      setError('');
    }
    // 2026-11-23 (Run #48): the uninstall toggle sat DEAD on the
    // phone even though every permission was granted — because this
    // load() awaited getProfile() in the same Promise.all as the
    // Device Admin check. When the profile fetch failed (the
    // intermittent "Request failed" — see Problem 2), the whole
    // Promise.all rejected, setAdminAvailable() never ran, the
    // switch stayed disabled and showed "Needs the installed APK"
    // on a real APK. The toggle must NEVER depend on the server:
    // the local, on-device checks run first, in their own block,
    // so a failing network call cannot disable them.
    try {
      const [adminActive, minimalStored, permDetail] = await Promise.all([
        isDeviceAdminActive(),
        loadMinimal(uid),
        getNotificationPermissionDetail(),
      ]);
      setAdminAvailable(isDeviceAdminAvailable());
      setUninstall(adminActive);
      setMinimal(minimalStored);
      setNotifPermOff(permDetail.status !== 'granted');
    } catch {
      // Even if a local check throws, report the module's real
      // availability so the switch is not left disabled by default.
      setAdminAvailable(isDeviceAdminAvailable());
    }
    // The server data is independent: a failure here blanks only
    // the profile/rewards rows, never the Settings toggles above.
    // And even those rows fall back to the last saved profile copy
    // (2026-11-23, Run #48: the intermittent "Request failed" left
    // the subtitle blank) — shown with a "refresh failed" note,
    // never as if it were fresh server data.
    try {
      const [prof, rw] = await Promise.all([getProfile(), rewardsSummary()]);
      setProfile(prof.profile);
      setProfileCached(false);
      setRewards(rw);
      // The switch shows the REAL Device Admin state, never a saved
      // flag: true only while AHDORA is an active device admin.
      // (The old AsyncStorage flag '@ahdora/profile/uninstallProtection'
      // did nothing at all — it is no longer read or written. A stale
      // value left on the phone from an older build is inert.)
      if (first) setError('');
    } catch (e) {
      const cached = await loadCachedProfile();
      if (cached?.profile) {
        setProfile(cached.profile);
        setProfileCached(true);
      }
      if (first) setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      if (first) {
        loadedOnce.current = true;
        setLoading(false);
      }
    }
  }, [s.errorGeneric, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  // The toggle opens Android Settings, where the user activates (or
  // deactivates) the admin and comes back. Re-check the real admin
  // state every time the app comes back to the foreground — the
  // AppBlock screen uses this same pattern for its permissions.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  /**
   * The switch shows the REAL native state and never flips itself:
   * tapping it opens Android's own device-admin screen, where the
   * user taps Activate (or Deactivate when it is already on).
   * Android never lets an app activate an admin silently. The
   * switch updates when the app comes back (see the AppState
   * listener). Turning OFF also goes through that system screen on
   * purpose — a one-tap off inside the app would make the
   * protection meaningless. In Expo Go the module is missing and
   * this is a no-op.
   *
   * 2026-11-23 fix: the old call was fire-and-forget and returned
   * nothing, so when the system screen failed to open the toggle
   * just sat there while load() flashed the screen — "sirf refresh
   * ho raha hai". Now the native call reports whether the screen
   * actually opened; on failure the error + retry + Security
   * settings fallback are shown below the switch instead of a
   * dead toggle.
   */
  async function toggleUninstall() {
    if (adminBusy) return;
    setAdminBusy(true);
    setAdminError(null);
    try {
      const res = await requestDeviceAdminActivation();
      if (!res.opened) {
        setAdminError(
          res.error === 'receiver-missing' ? s.pfUninstallNoReceiver : s.pfUninstallFailed,
        );
        return;
      }
      // The system screen opened; the AppState listener re-reads
      // the real state when the user comes back. Re-check once
      // more after a short delay in case the return was fast.
      setTimeout(() => {
        void load();
      }, 1200);
    } finally {
      setAdminBusy(false);
    }
  }

  async function openAdminSecuritySettings() {
    await openDeviceAdminSecuritySettings();
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
          {profileCached ? (
            <Text style={[styles.honestNote, th.dark && styles.mutedDark]}>
              {s.pfCachedNote}
            </Text>
          ) : null}

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
              <Switch
                value={uninstall}
                disabled={!adminAvailable || adminBusy}
                onValueChange={() => void toggleUninstall()}
              />
            </View>
            <Text
              style={[
                uninstall && adminAvailable ? styles.okNote : styles.honestNote,
                th.dark && styles.mutedDark,
              ]}
            >
              {adminAvailable
                ? uninstall
                  ? s.pfUninstallOn
                  : s.pfUninstallOff
                : s.pfUninstallNeedApk}
            </Text>
            {adminError ? (
              <View>
                <Text style={[T.error, { marginTop: 8 }]}>{adminError}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <PillButton
                    label={s.pfUninstallRetry}
                    small
                    onPress={() => void toggleUninstall()}
                    disabled={adminBusy}
                  />
                  <PillButton
                    label={s.pfUninstallOpenSecurity}
                    small
                    variant="ghost"
                    onPress={() => void openAdminSecuritySettings()}
                  />
                </View>
              </View>
            ) : null}
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

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
import { apiFetch } from '../lib/api';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, Input, PillButton, Switch } from '../components/ui';
import TutorialVideo from '../components/TutorialVideo';
import { HOW_TO_USE_VIDEO_URL } from '../lib/videos';
import {
  getProfile,
  rewardsSummary,
  type ProfileData,
  type RewardsSummary,
} from '../lib/apiSocial';

const UNINSTALL_KEY = '@ahdora/profile/uninstallProtection';

function profileStr(profile: ProfileData | null, key: string): string {
  if (!profile) return '';
  const value = profile[key];
  return typeof value === 'string' ? value : '';
}

export default function ProfileScreen({ lang, goTo, user, onLogout }: ScreenProps) {
  const s = stringsFor(lang);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [uninstall, setUninstall] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetNote, setResetNote] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
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
      const [prof, rw, stored] = await Promise.all([
        getProfile(),
        rewardsSummary(),
        AsyncStorage.getItem(UNINSTALL_KEY),
      ]);
      setProfile(prof.profile);
      setRewards(rw);
      if (stored !== null) setUninstall(stored === 'true');
    } catch (e) {
      setError(e instanceof Error ? e.message : s.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [s.errorGeneric]);

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
    profileStr(profile, 'semester'),
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
          <Text style={T.h2}>{user?.name ?? ''}</Text>
          {subParts.length > 0 ? <Text style={T.sub}>{subParts.join(' · ')}</Text> : null}
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
          <Card>
            <Text style={T.cardTitle}>{s.pfSettings}</Text>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{s.pfUninstallT}</Text>
                <Text style={styles.rowSub}>{s.pfUninstallS}</Text>
              </View>
              <Switch value={uninstall} onValueChange={(v) => void toggleUninstall(v)} />
            </View>
            <Text style={styles.honestNote}>{s.pfUninstallNote}</Text>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{s.pfLangT}</Text>
                <Text style={styles.rowSub}>
                  {lang === 'hi' ? 'Abhi: Hinglish · Badalne ke liye dabao.' : 'Currently: English · Tap to change.'}
                </Text>
              </View>
              <PillButton label={s.pfLangBtn} small variant="ghost" onPress={() => goTo('language')} />
            </View>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{s.pfNotifT}</Text>
                <Text style={styles.rowSub}>{s.pfNotifS}</Text>
              </View>
              <PillButton label={s.pfOpen} small variant="ghost" onPress={() => goTo('notifications')} />
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{s.pfPassT}</Text>
                <Text style={styles.rowSub}>{s.pfPassS}</Text>
              </View>
              <PillButton
                label={s.pfPassBtn}
                small
                variant="ghost"
                onPress={() => void sendResetLink()}
                disabled={resetBusy}
                busy={resetBusy}
              />
            </View>
            {resetNote ? <Text style={styles.okNote}>{resetNote}</Text> : null}
          </Card>

          {/* Points & badges — real server totals */}
          <Card>
            <Text style={T.cardTitle}>{s.pfPoints}</Text>
            <Text style={[T.cardBody, { marginTop: 6, lineHeight: 26 }]}>
              ⭐ {rewards ? rewards.total : '—'} points
              {rewards && rewards.badges.length > 0 ? ` · 🏅 ${rewards.badges[0].title}` : ''}
            </Text>
            {rewards && rewards.badges.length === 0 ? (
              <Text style={[T.cardBody, { marginTop: 2 }]}>{s.pfNoBadges}</Text>
            ) : null}
            <Text style={[T.cardBody, { marginTop: 6 }]}>{s.pfPointsNote}</Text>
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

          {/* Account delete — real export + delete */}
          <Pressable onPress={() => setShowDelete((v) => !v)} accessibilityRole="button">
            <Text style={styles.deleteNote}>{s.pfDelete}</Text>
          </Pressable>
          {showDelete ? (
            <Card>
              <Text style={[T.cardBody, { marginBottom: 12 }]}>{s.pfDeleteHint}</Text>
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
  rowText: { flex: 1 },
  rowLabel: { fontFamily: 'PlusJakartaSans', fontSize: 14.5, fontWeight: '700', color: C.ink },
  rowSub: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 2 },
  honestNote: { fontFamily: 'PlusJakartaSans', fontSize: 12.5, color: C.muted, lineHeight: 18, marginTop: 8 },
  okNote: { fontFamily: 'PlusJakartaSans', fontSize: 13, fontWeight: '700', color: C.teal500, marginTop: 8, lineHeight: 18 },
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
});

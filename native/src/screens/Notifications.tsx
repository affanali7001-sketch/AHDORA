/**
 * Notifications — list + settings from the live API.
 * GET /api/notifications, POST /api/notifications/:id/read,
 * POST /api/notifications/read-all, DELETE /api/notifications/:id,
 * GET/PUT /api/notifications/settings (categories + quiet hours).
 * Only the user's own notifications are ever returned by the server.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import {
  deleteNotification,
  getNotificationSettings,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationSettings,
  type AppNotification,
  type NotificationCategories,
  type NotificationSettings,
} from '../lib/apiSocial';

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
    title: 'Notifications',
    sub: 'Your notifications, in Hinglish, driving action. Unread first, newest first.',
    noNotifications: 'No notifications yet. Prayer, study, sleep and challenge reminders will appear here.',
    markAllRead: 'Mark all as read',
    unread: 'unread',
    settings: 'Notification settings',
    categories: 'Categories',
    prayer: 'Prayer',
    study: 'Study',
    sleep: 'Sleep',
    challenge: 'Challenge',
    friend: 'Friend',
    system: 'System',
    quietHours: 'Quiet hours',
    quietStart: 'Start (HH:MM)',
    quietEnd: 'End (HH:MM)',
    quietHint: 'Leave both empty for no quiet hours.',
    save: 'Save settings',
    saved: 'Settings saved.',
    loading: 'Loading notifications…',
    retry: 'Retry',
    delete: 'Delete',
  },
  hi: {
    back: '← Wapas',
    title: 'Notifications',
    sub: 'Aapki notifications, Hinglish me, action ke liye. Pehle unread, phir newest.',
    noNotifications: 'Abhi koi notification nahi hai. Namaz, study, sleep aur challenge ke reminders yahan aayenge.',
    markAllRead: 'Sab ko read mark karo',
    unread: 'unread',
    settings: 'Notification settings',
    categories: 'Categories',
    prayer: 'Namaz',
    study: 'Study',
    sleep: 'Sleep',
    challenge: 'Challenge',
    friend: 'Dost',
    system: 'System',
    quietHours: 'Quiet hours',
    quietStart: 'Shuru (HH:MM)',
    quietEnd: 'Khatam (HH:MM)',
    quietHint: 'Dono khaali chhodo to koi quiet hours nahi.',
    save: 'Settings save karo',
    saved: 'Settings save ho gayi.',
    loading: 'Notifications load ho rahi hain…',
    retry: 'Dobara try karo',
    delete: 'Delete',
  },
} as const;

const CATEGORY_KEYS: (keyof NotificationCategories)[] = [
  'prayer',
  'study',
  'sleep',
  'challenge',
  'friend',
  'system',
];

export default function NotificationsScreen({ lang, goTo }: ScreenProps) {
  const s = STR[lang];
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, prefs] = await Promise.all([listNotifications(), getNotificationSettings()]);
      setItems(list.notifications);
      setUnread(list.unread);
      setSettings(prefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    }
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    }
  }

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function saveSettings() {
    if (!settings || saving) return;
    setSaving(true);
    setSavedNote(false);
    setError(null);
    try {
      await updateNotificationSettings({
        categories: settings.categories,
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
      });
      setSavedNote(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={styles.title}>{s.title}</Text>
      <Text style={styles.sub}>{s.sub}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} />
          <Text style={styles.note}>{s.loading}</Text>
        </View>
      ) : error && items.length === 0 && !settings ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.primaryBtn} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{s.retry}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {unread > 0 ? (
            <View style={styles.unreadRow}>
              <Text style={styles.unreadText}>
                {unread} {s.unread}
              </Text>
              <Pressable onPress={() => void markAllRead()} accessibilityRole="button">
                <Text style={styles.markAll}>{s.markAllRead}</Text>
              </Pressable>
            </View>
          ) : null}

          {items.length === 0 ? (
            <Text style={styles.empty}>{s.noNotifications}</Text>
          ) : (
            items.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => {
                  if (!n.read) void markRead(n.id);
                }}
                accessibilityRole="button"
              >
                <View style={[styles.notifCard, !n.read && styles.notifUnread]}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  <Text style={styles.notifBody}>{n.body}</Text>
                  <Text style={styles.notifMeta}>
                    {n.type} · {new Date(n.createdAt).toLocaleString()}
                  </Text>
                  <Pressable
                    onPress={() => void remove(n.id)}
                    disabled={busyId === n.id}
                    accessibilityRole="button"
                  >
                    <Text style={styles.delete}>{s.delete}</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}

          {settings ? (
            <>
              <Text style={styles.sectionTitle}>{s.settings}</Text>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>{s.categories}</Text>
                {CATEGORY_KEYS.map((key) => (
                  <View key={key} style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>{s[key]}</Text>
                    <Switch
                      value={settings.categories[key]}
                      onValueChange={(v) =>
                        setSettings({
                          ...settings,
                          categories: { ...settings.categories, [key]: v },
                        })
                      }
                      trackColor={{ false: C.line, true: C.teal }}
                      thumbColor={C.white}
                    />
                  </View>
                ))}
                <Text style={[styles.cardLabel, styles.quietLabel]}>{s.quietHours}</Text>
                <View style={styles.quietRow}>
                  <TextInput
                    style={styles.quietInput}
                    value={settings.quietHoursStart}
                    onChangeText={(v) => setSettings({ ...settings, quietHoursStart: v })}
                    placeholder={s.quietStart}
                    placeholderTextColor={C.muted}
                    autoCapitalize="none"
                    maxLength={5}
                  />
                  <TextInput
                    style={styles.quietInput}
                    value={settings.quietHoursEnd}
                    onChangeText={(v) => setSettings({ ...settings, quietHoursEnd: v })}
                    placeholder={s.quietEnd}
                    placeholderTextColor={C.muted}
                    autoCapitalize="none"
                    maxLength={5}
                  />
                </View>
                <Text style={styles.hint}>{s.quietHint}</Text>
                <Pressable
                  onPress={() => void saveSettings()}
                  style={[styles.primaryBtn, saving && styles.btnDisabled]}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  {saving ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.primaryBtnText}>{s.save}</Text>
                  )}
                </Pressable>
                {savedNote ? <Text style={styles.saved}>{s.saved}</Text> : null}
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 40 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: C.muted, marginTop: 6, marginBottom: 20, lineHeight: 20 },
  center: { alignItems: 'center', paddingVertical: 40 },
  note: { fontSize: 13, color: C.muted, marginTop: 10, textAlign: 'center' },
  error: { color: C.red, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  empty: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 8, marginBottom: 12 },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.line,
    padding: 20,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: C.teal,
    borderRadius: 999,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
  unreadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  unreadText: { fontSize: 14, fontWeight: '800', color: C.teal900 },
  markAll: { fontSize: 14, fontWeight: '800', color: C.teal2 },
  notifCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
  },
  notifUnread: { borderColor: C.teal, borderLeftWidth: 4 },
  notifTitle: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4 },
  notifBody: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 6 },
  notifMeta: { fontSize: 12, color: C.muted, marginBottom: 8 },
  delete: { color: C.red, fontSize: 13, fontWeight: '700' },
  cardLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: C.muted, textTransform: 'uppercase', marginBottom: 8 },
  quietLabel: { marginTop: 16 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: C.ink },
  quietRow: { flexDirection: 'row', gap: 10 },
  quietInput: {
    flex: 1,
    backgroundColor: C.ice,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
  },
  hint: { fontSize: 12, color: C.muted, marginTop: 8, marginBottom: 8 },
  saved: { fontSize: 13, color: C.teal, fontWeight: '700', textAlign: 'center', marginTop: 10 },
});

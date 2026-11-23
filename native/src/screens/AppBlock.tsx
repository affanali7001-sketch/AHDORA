/**
 * AppBlock — REAL app blocking (native Android, real APK only).
 *
 * Controls the AHDORA blocker:
 *  - The three permissions the blocker needs (Accessibility service,
 *    Usage Access, "Display over other apps") with buttons that open
 *    the exact Android Settings screens to grant them.
 *  - Master on/off, prayer-time blocking (all apps until "Haan, maine
 *    namaz padh li"), sleep blocking (only the apps the user picks,
 *    after a 5-minute warning), and a YouTube exemption.
 *  - An app picker (launchable apps from the phone) for sleep blocking.
 *
 * The native side is an Accessibility Service (AhdoraBlockService) plus
 * the AhdoraBlock inline module; both share SharedPreferences
 * ("ahdora_block"). The service enforces blocking even when the app
 * is closed. Calls and emergency are never blocked.
 *
 * In Expo Go the native module does not exist — this screen says so
 * plainly instead of pretending to block.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScreenProps } from '../lib/nav';
import { stringsFor } from '../lib/strings';
import { C, L, T } from '../lib/theme';
import { Card, EmptyState, PillButton, SectionTitle, Switch } from '../components/ui';
import {
  confirmPrayer,
  DEFAULT_APP_BLOCK_CONFIG,
  getAppBlockStatus,
  getInstalledApps,
  isAppBlockAvailable,
  loadAppBlockConfig,
  normalizeHHmm,
  openAccessibilitySettings,
  openOverlaySettings,
  openUsageAccessSettings,
  saveAppBlockConfig,
  syncScheduleFromServer,
  type AppBlockConfig,
  type AppBlockStatus,
  type InstalledApp,
} from '../lib/appBlock';

function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function todayKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** The prayer whose lock window covers right now, or null. */
function currentPrayerLock(config: AppBlockConfig, now: Date): string | null {
  if (!config.blocking_enabled || !config.prayer_block_enabled) return null;
  if (config.prayer_times.length === 0) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = todayKey(now);
  for (let i = 0; i < config.prayer_times.length; i++) {
    const name = config.prayer_names[i] ?? 'Namaz';
    if (config.prayed[name] === today) continue;
    const start = toMinutes(normalizeHHmm(config.prayer_times[i]));
    if (start === null) continue;
    const end = start + (config.prayer_grace_min || 30);
    if (nowMin >= start && nowMin < end) return name;
  }
  return null;
}

/** Minutes until sleep starts (0..1439), or null when not applicable. */
function minutesUntilSleep(config: AppBlockConfig, now: Date): number | null {
  if (!config.blocking_enabled || !config.sleep_block_enabled) return null;
  const start = toMinutes(normalizeHHmm(config.sleep_start));
  if (start === null) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const diff = (start - nowMin + 1440) % 1440;
  return diff;
}

function PermRow({
  title,
  sub,
  granted,
  grantedLabel,
  notGrantedLabel,
  openLabel,
  onOpen,
}: {
  title: string;
  sub: string;
  granted: boolean;
  grantedLabel: string;
  notGrantedLabel: string;
  openLabel: string;
  onOpen: () => void;
}) {
  return (
    <View style={styles.permRow}>
      <View style={styles.permText}>
        <Text style={styles.permTitle}>{title}</Text>
        <Text style={styles.permSub}>{sub}</Text>
        <Text style={[styles.permState, granted ? styles.permOk : styles.permBad]}>
          {granted ? `✓ ${grantedLabel}` : `✕ ${notGrantedLabel}`}
        </Text>
      </View>
      {!granted ? (
        <PillButton label={openLabel} onPress={onOpen} variant="peach" small />
      ) : null}
    </View>
  );
}

export default function AppBlockScreen({ lang, goTo }: ScreenProps) {
  const s = stringsFor(lang);
  const available = isAppBlockAvailable();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AppBlockStatus | null>(null);
  const [config, setConfig] = useState<AppBlockConfig>({ ...DEFAULT_APP_BLOCK_CONFIG });
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [unlockedMsg, setUnlockedMsg] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Tick so the prayer-lock card / sleep warning appear when their time comes.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!available) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const [cfg, st, installed] = await Promise.all([
        loadAppBlockConfig(),
        getAppBlockStatus(),
        getInstalledApps(),
      ]);
      let merged = cfg ?? { ...DEFAULT_APP_BLOCK_CONFIG };
      // Pull today's prayer times + sleep window from the server so the
      // service can enforce blocking even when the app is closed.
      const synced = await syncScheduleFromServer(merged);
      if (synced) merged = synced;
      if (!mounted.current) return;
      setConfig(merged);
      setStatus(st);
      setApps(installed ?? []);
    } catch {
      if (mounted.current) setErrorMsg(s.errorGeneric);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [available, s.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  // The permission buttons open Android Settings, where the user
  // grants the permission and comes back. Before this, the screen
  // kept showing the OLD status (e.g. "not granted") until the
  // user tapped Refresh by hand — it looked as if granting had
  // done nothing. Re-check permissions and re-sync the config
  // every time the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const lockedPrayer = useMemo(() => currentPrayerLock(config, now), [config, now]);
  const sleepIn = useMemo(() => minutesUntilSleep(config, now), [config, now]);
  const sleepWarning = sleepIn !== null && sleepIn > 0 && sleepIn <= 5;

  const blockedSet = useMemo(() => new Set(config.blocked_packages), [config.blocked_packages]);

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? apps.filter(
          (a) =>
            a.label.toLowerCase().includes(q) ||
            a.packageName.toLowerCase().includes(q)
        )
      : apps;
    return list.slice(0, 120);
  }, [apps, query]);

  function toggleBlocked(pkg: string) {
    setSavedMsg(null);
    setConfig((c) => {
      const set = new Set(c.blocked_packages);
      if (set.has(pkg)) set.delete(pkg);
      else set.add(pkg);
      return { ...c, blocked_packages: [...set] };
    });
  }

  async function onSave() {
    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);
    const synced = await syncScheduleFromServer(config);
    const toSave = synced ?? config;
    const ok = await saveAppBlockConfig(toSave);
    if (ok) {
      setConfig(toSave);
      setSavedMsg(s.abSaved);
      // Keep the permission rows truthful after a save (the user
      // may have granted something in Settings just before this).
      const st = await getAppBlockStatus();
      if (st) setStatus(st);
    } else {
      setErrorMsg(s.abSaveFailed);
    }
    setSaving(false);
  }

  async function onUnlock() {
    if (!lockedPrayer) return;
    const ok = await confirmPrayer(lockedPrayer);
    if (!ok) {
      setErrorMsg(s.abSaveFailed);
      return;
    }
    setUnlockedMsg(s.abUnlocked);
    const cfg = await loadAppBlockConfig();
    if (cfg) setConfig(cfg);
  }

  if (loading) {
    return (
      <View style={[L.safe, styles.center]}>
        <ActivityIndicator size="large" color={C.teal} />
        <Text style={T.sub}>{s.loading}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={L.scroll} showsVerticalScrollIndicator={false}>
      <Pressable onPress={() => goTo('dashboard')} accessibilityRole="button">
        <Text style={styles.back}>{s.back}</Text>
      </Pressable>
      <Text style={T.title}>{s.abTitle}</Text>
      <Text style={T.sub}>{s.abSub}</Text>

      {!available ? (
        <Card style={styles.warnCard}>
          <Text style={styles.warnText}>{s.abNotAvailable}</Text>
        </Card>
      ) : (
        <>
          {errorMsg ? <Text style={T.error}>{errorMsg}</Text> : null}
          {savedMsg ? <Text style={styles.savedText}>{savedMsg}</Text> : null}

          {lockedPrayer ? (
            <Card style={styles.lockCard}>
              <Text style={styles.lockTitle}>{s.abCurrentPrayer}</Text>
              <Text style={styles.lockBody}>
                {lockedPrayer} — {s.abCurrentPrayerSub}
              </Text>
              <PillButton label={s.abUnlock} onPress={onUnlock} variant="primary" block />
              {unlockedMsg ? <Text style={styles.savedText}>{unlockedMsg}</Text> : null}
            </Card>
          ) : null}

          {sleepWarning ? (
            <Card style={styles.warnCard}>
              <Text style={styles.warnText}>
                {s.abSleepTitle} — {sleepIn} min
              </Text>
              <Text style={styles.warnSub}>{s.abSleepSub}</Text>
            </Card>
          ) : null}

          <SectionTitle title={s.abPermissionsTitle} />
          <Card>
            <PermRow
              title={s.abPermAccessibility}
              sub={s.abPermAccessibilitySub}
              granted={status?.accessibility === true}
              grantedLabel={s.abGranted}
              notGrantedLabel={s.abNotGranted}
              openLabel={s.abOpenSettings}
              onOpen={() => {
                openAccessibilitySettings();
              }}
            />
            <View style={styles.divider} />
            <PermRow
              title={s.abPermUsage}
              sub={s.abPermUsageSub}
              granted={status?.usageAccess === true}
              grantedLabel={s.abGranted}
              notGrantedLabel={s.abNotGranted}
              openLabel={s.abOpenSettings}
              onOpen={() => {
                openUsageAccessSettings();
              }}
            />
            <View style={styles.divider} />
            <PermRow
              title={s.abPermOverlay}
              sub={s.abPermOverlaySub}
              granted={status?.overlay === true}
              grantedLabel={s.abGranted}
              notGrantedLabel={s.abNotGranted}
              openLabel={s.abOpenSettings}
              onOpen={() => {
                openOverlaySettings();
              }}
            />
            <PillButton
              label={s.abRefresh}
              onPress={() => void load()}
              variant="ghost"
              small
              style={{ marginTop: 12 }}
            />
          </Card>

          <SectionTitle title={s.abMaster} />
          <Card>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>{s.abMaster}</Text>
                <Text style={styles.toggleSub}>{s.abMasterSub}</Text>
              </View>
              <Switch
                value={config.blocking_enabled}
                onValueChange={(v) => {
                  setSavedMsg(null);
                  setConfig((c) => ({ ...c, blocking_enabled: v }));
                }}
              />
            </View>
          </Card>

          <SectionTitle title={s.abPrayerTitle} />
          <Card>
            <Text style={T.cardBody}>{s.abPrayerSub}</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>
                  {config.prayer_block_enabled ? s.abPrayerOn : s.abPrayerOff}
                </Text>
              </View>
              <Switch
                value={config.prayer_block_enabled}
                onValueChange={(v) => {
                  setSavedMsg(null);
                  setConfig((c) => ({ ...c, prayer_block_enabled: v }));
                }}
              />
            </View>
            <Text style={styles.miniLabel}>{s.abPrayerTimes}</Text>
            {config.prayer_times.length > 0 ? (
              config.prayer_times.map((t, i) => (
                <Text key={`${config.prayer_names[i] ?? i}-${t}`} style={styles.timeRow}>
                  {config.prayer_names[i] ?? 'Namaz'} — {t}
                </Text>
              ))
            ) : (
              <Text style={T.cardBody}>{s.abPrayerTimesMissing}</Text>
            )}
          </Card>

          <SectionTitle title={s.abSleepTitle} />
          <Card>
            <Text style={T.cardBody}>{s.abSleepSub}</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>
                  {config.sleep_block_enabled ? s.abSleepOn : s.abSleepOff}
                </Text>
              </View>
              <Switch
                value={config.sleep_block_enabled}
                onValueChange={(v) => {
                  setSavedMsg(null);
                  setConfig((c) => ({ ...c, sleep_block_enabled: v }));
                }}
              />
            </View>
            <Text style={styles.miniLabel}>{s.abSleepWindow}</Text>
            {config.sleep_start && config.sleep_end ? (
              <Text style={styles.timeRow}>
                {config.sleep_start} — {config.sleep_end}
              </Text>
            ) : (
              <Text style={T.cardBody}>{s.abSleepWindowMissing}</Text>
            )}
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>{s.abYoutube}</Text>
                <Text style={styles.toggleSub}>{s.abYoutubeSub}</Text>
              </View>
              <Switch
                value={config.youtube_allowed}
                onValueChange={(v) => {
                  setSavedMsg(null);
                  setConfig((c) => ({ ...c, youtube_allowed: v }));
                }}
              />
            </View>
          </Card>

          <SectionTitle
            title={`${s.abPickTitle} (${config.blocked_packages.length})`}
          />
          <Card>
            <Text style={T.cardBody}>{s.abPickSub}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={s.abSearchApps}
              placeholderTextColor={C.muted}
              style={styles.search}
            />
            {filteredApps.length === 0 ? (
              <EmptyState title={s.abPickEmpty} />
            ) : (
              filteredApps.map((a) => {
                const blocked = blockedSet.has(a.packageName);
                return (
                  <Pressable
                    key={a.packageName}
                    onPress={() => toggleBlocked(a.packageName)}
                    style={styles.appRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: blocked }}
                  >
                    <View style={styles.appText}>
                      <Text style={styles.appLabel}>{a.label}</Text>
                      <Text style={styles.appPkg}>{a.packageName}</Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        blocked ? styles.checkboxOn : styles.checkboxOff,
                      ]}
                    >
                      {blocked ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </Card>

          <PillButton
            label={saving ? s.saving : s.abSave}
            onPress={onSave}
            variant="primary"
            block
            busy={saving}
            disabled={saving}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  back: { fontSize: 16, fontWeight: '700', color: C.teal, marginBottom: 16 },
  warnCard: { backgroundColor: C.peach2, borderColor: C.peach, marginTop: 16 },
  warnText: { fontSize: 15, fontWeight: '700', color: C.peachDeep, lineHeight: 21 },
  warnSub: { fontSize: 14, color: C.muted, lineHeight: 20, marginTop: 6 },
  savedText: { fontSize: 14, fontWeight: '700', color: C.teal, marginTop: 12 },
  lockCard: { backgroundColor: C.teal950, borderColor: C.teal950, marginTop: 16 },
  lockTitle: { color: C.white, fontSize: 20, fontWeight: '800' },
  lockBody: { color: '#B8CFCB', fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 16 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  permText: { flex: 1 },
  permTitle: { fontSize: 15, fontWeight: '800', color: C.ink },
  permSub: { fontSize: 13, color: C.muted, lineHeight: 18, marginTop: 2 },
  permState: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  permOk: { color: C.teal2 },
  permBad: { color: C.red },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  toggleText: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '800', color: C.ink },
  toggleSub: { fontSize: 13, color: C.muted, lineHeight: 18, marginTop: 2 },
  miniLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: C.muted, marginTop: 14 },
  timeRow: { fontSize: 15, color: C.ink, marginTop: 6, fontWeight: '600' },
  search: {
    backgroundColor: C.ice,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.ink,
    marginTop: 12,
    marginBottom: 6,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  appText: { flex: 1 },
  appLabel: { fontSize: 15, fontWeight: '700', color: C.ink },
  appPkg: { fontSize: 12, color: C.muted, marginTop: 2 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.teal, borderColor: C.teal },
  checkboxOff: { backgroundColor: C.white, borderColor: C.line },
  checkMark: { color: C.white, fontSize: 15, fontWeight: '800' },
});

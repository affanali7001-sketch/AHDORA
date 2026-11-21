import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  ChevronLeft,
  Flag,
  Moon,
  MoonStar,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import './NotificationsScreen.css';
import {
  clearAllNotifications,
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from '../lib/notificationsApi.js';
import NotificationSettingsPanel from './NotificationSettings';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';

const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  prayer: MoonStar,
  study: BookOpen,
  sleep: Moon,
  challenge: Flag,
  friend: Users,
  system: Bell,
};

function formatTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Notifications — full screen (preview #18, dark).
 *
 * Mirrors the old topbar dropdown's logic exactly: same API calls
 * (fetchNotifications / markNotificationRead / deleteNotification /
 * markAllNotificationsRead / clearAllNotifications), same two-step
 * confirm for Clear all, same optimistic dismiss. The notification
 * title/body are rendered EXACTLY as stored from the server — the
 * missed-prayer Quranic teaching (Quran 2:238 + Bukhari 552/553 for
 * Asr, 19:59 + 74:42-43 for Fajr) is server-generated and is never
 * hardcoded into this UI.
 *
 * The settings panel below the list is the existing
 * NotificationSettingsPanel (categories + quiet hours), unchanged.
 */
export default function NotificationsScreen({
  onBack,
  onNotify,
  guestMode,
  onChanged,
  language,
}: {
  onBack: () => void;
  onNotify: (message: string) => void;
  guestMode: boolean;
  /** Called after any mutation so the caller can refresh its own badge/list. */
  onChanged?: () => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'read-all' | 'clear-all' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(async () => {
    if (guestMode) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      const [list, unread] = await Promise.all([
        fetchNotifications(1, 20),
        fetchUnreadCount(),
      ]);
      setNotifications(list.notifications);
      setUnreadCount(unread);
    } catch {
      // The list stays empty rather than showing invented alerts.
    } finally {
      setLoading(false);
    }
  }, [guestMode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function changed() {
    onChanged?.();
  }

  async function markRead(item: AppNotification) {
    if (item.read) return;
    setNotifications((list) =>
      list.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(item.id);
      changed();
    } catch {
      onNotify(s.notifications.markReadFailed);
      await refresh();
    }
  }

  async function dismiss(item: AppNotification) {
    const wasUnread = !item.read;
    setNotifications((list) => list.filter((n) => n.id !== item.id));
    if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await deleteNotification(item.id);
      changed();
    } catch {
      onNotify(s.notifications.deleteFailed);
      await refresh();
    }
  }

  async function markAllRead() {
    if (busy) return;
    setBusy('read-all');
    try {
      await markAllNotificationsRead();
      await refresh();
      changed();
    } catch {
      onNotify(s.notifications.markAllFailed);
    } finally {
      setBusy(null);
    }
  }

  async function clearAll() {
    if (busy) return;
    setBusy('clear-all');
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      setConfirmClear(false);
      onNotify(s.notifications.cleared);
      changed();
    } catch {
      onNotify(s.notifications.clearFailed);
    } finally {
      setBusy(null);
    }
  }

  const subtitle =
    unreadCount > 0 ? s.notifications.subtitleNew(unreadCount) : s.notifications.subtitleNone;

  return (
    <section className="notifications-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.notifications.title}</h4>
          <div className="asub">{subtitle}</div>
        </div>
      </div>

      <div className="acard notifications-list-card">
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button type="button" disabled={busy !== null} onClick={markAllRead}>
              {busy === 'read-all' ? s.notifications.marking : s.notifications.markAllRead}
            </button>
          )}
          {notifications.length > 0 &&
            (confirmClear ? (
              <button type="button" disabled={busy === 'clear-all'} onClick={clearAll}>
                {busy === 'clear-all' ? s.notifications.clearing : s.notifications.confirmClear}
              </button>
            ) : (
              <button type="button" disabled={busy !== null} onClick={() => setConfirmClear(true)}>
                {s.notifications.clearAll}
              </button>
            ))}
        </div>

        {guestMode ? (
          <p className="onboarding-help">{s.notifications.guestText}</p>
        ) : loading ? (
          <p className="onboarding-help">{s.notifications.loading}</p>
        ) : notifications.length === 0 ? (
          <p className="onboarding-help">
            {s.notifications.empty}
          </p>
        ) : (
          <div>
            {notifications.map((item) => {
              const Icon = TYPE_ICONS[item.type] ?? Bell;
              return (
                <div
                  key={item.id}
                  className={`nrow ${item.read ? 'nrow-read' : 'nrow-unread'}`}
                >
                  <span className="ndot">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <button
                    type="button"
                    className="nrow-body"
                    onClick={() => markRead(item)}
                    aria-label={s.notifications.markReadAria(item.title)}
                  >
                    <b>{item.title}</b>
                    <span className="mut">{item.body}</span>
                  </button>
                  <span className="nt">{formatTime(item.createdAt)}</span>
                  <button
                    type="button"
                    className="nx"
                    aria-label={s.notifications.removeAria(item.title)}
                    title={s.notifications.removeTitle}
                    onClick={() => dismiss(item)}
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="acard">
        <h5>{s.notifications.settingsTitle}</h5>
        <NotificationSettingsPanel onNotify={onNotify} language={language} />
      </div>
    </section>
  );
}

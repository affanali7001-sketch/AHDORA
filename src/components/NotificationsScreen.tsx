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
}: {
  onBack: () => void;
  onNotify: (message: string) => void;
  guestMode: boolean;
  /** Called after any mutation so the caller can refresh its own badge/list. */
  onChanged?: () => void;
}) {
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
      onNotify('Could not mark as read.');
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
      onNotify('Notification delete nahi ho payi.');
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
      onNotify('Could not mark all as read.');
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
      onNotify('Saari notifications hata di gayi.');
      changed();
    } catch {
      onNotify('Clear nahi ho paya. Dobara try karo.');
    } finally {
      setBusy(null);
    }
  }

  const subtitle =
    unreadCount > 0 ? `${unreadCount} nayi · sab Hinglish me` : 'Koi nayi nahi · sab Hinglish me';

  return (
    <section className="notifications-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label="Wapas jao">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>Notifications</h4>
          <div className="asub">{subtitle}</div>
        </div>
      </div>

      <div className="acard notifications-list-card">
        <div className="notifications-actions">
          {unreadCount > 0 && (
            <button type="button" disabled={busy !== null} onClick={markAllRead}>
              {busy === 'read-all' ? 'Marking…' : 'Mark all read'}
            </button>
          )}
          {notifications.length > 0 &&
            (confirmClear ? (
              <button type="button" disabled={busy === 'clear-all'} onClick={clearAll}>
                {busy === 'clear-all' ? 'Clearing…' : 'Pakka saaf karein?'}
              </button>
            ) : (
              <button type="button" disabled={busy !== null} onClick={() => setConfirmClear(true)}>
                Clear all
              </button>
            ))}
        </div>

        {guestMode ? (
          <p className="onboarding-help">Notifications dekhne ke liye sign in karo.</p>
        ) : loading ? (
          <p className="onboarding-help">Notifications load ho rahi hain…</p>
        ) : notifications.length === 0 ? (
          <p className="onboarding-help">
            Abhi koi notification nahi hai. Namaz, padhai, neend aur challenge ki notifications
            yahan dikhengi.
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
                    aria-label={`${item.title} — padha hua mark karo`}
                  >
                    <b>{item.title}</b>
                    <span className="mut">{item.body}</span>
                  </button>
                  <span className="nt">{formatTime(item.createdAt)}</span>
                  <button
                    type="button"
                    className="nx"
                    aria-label={`"${item.title}" notification hatao`}
                    title="Hatao"
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
        <h5>Kis cheez ki notification chahiye?</h5>
        <NotificationSettingsPanel onNotify={onNotify} />
      </div>
    </section>
  );
}

import { apiFetch } from './http.js';
export type NotificationType =
  | 'prayer'
  | 'study'
  | 'sleep'
  | 'challenge'
  | 'friend'
  | 'system';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  refType: string;
  refId: string;
  read: boolean;
  createdAt: string;
};

export type NotificationSettings = {
  categories: Record<NotificationType, boolean>;
  quietHoursStart: string;
  quietHoursEnd: string;
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  prayer: 'Namaz',
  study: 'Padhai',
  sleep: 'Neend',
  challenge: 'Challenge',
  friend: 'Dost',
  system: 'System',
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Notifications request failed. Please try again.',
    );
  }

  return data as T;
}

export async function fetchNotifications(
  page = 1,
  limit = 20,
): Promise<{
  notifications: AppNotification[];
  page: number;
  limit: number;
  total: number;
  unread: number;
}> {
  return request<{
    notifications: AppNotification[];
    page: number;
    limit: number;
    total: number;
    unread: number;
  }>(`/api/notifications?page=${page}&limit=${limit}`);
}

export async function fetchUnreadCount(): Promise<number> {
  const result = await request<{ unread: number }>('/api/notifications/unread-count');
  return result.unread ?? 0;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const result = await request<{ notification: AppNotification }>(
    `/api/notifications/${id}/read`,
    { method: 'POST' },
  );
  return result.notification;
}

export async function markAllNotificationsRead(): Promise<void> {
  await request('/api/notifications/read-all', { method: 'POST' });
}

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  const result = await request<{ settings: NotificationSettings }>(
    '/api/notifications/settings',
  );
  return result.settings;
}

export async function saveNotificationSettings(
  settings: Partial<NotificationSettings> & {
    categories?: Partial<Record<NotificationType, boolean>>;
  },
): Promise<NotificationSettings> {
  const result = await request<{ settings: NotificationSettings }>(
    '/api/notifications/settings',
    { method: 'PUT', body: JSON.stringify(settings) },
  );
  return result.settings;
}

import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import {
  fetchNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
  type NotificationType,
} from '../lib/notificationsApi';
import type { AppLanguage } from '../lib/language';
import { notificationTypeLabel, stringsFor } from '../lib/strings';

/**
 * Notification preferences (Profile & settings).
 *
 * Categories switched off never create a notification. Quiet hours
 * (profile timezone) never delete anything: notifications created
 * during quiet hours are still stored, they are just not pushed live
 * over the socket — the user sees them when they open the app.
 * There is no scheduled/push reminder system: nothing here claims a
 * prayer reminder will arrive while the app is closed.
 */
export default function NotificationSettingsPanel({
  onNotify,
  language,
}: {
  onNotify: (message: string) => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    fetchNotificationSettings()
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : s.notificationSettings.loadFailed);
      });
    return () => {
      active = false;
    };
  }, []);

  function toggleCategory(type: NotificationType) {
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        categories: { ...current.categories, [type]: !current.categories[type] },
      };
    });
    setDirty(true);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveNotificationSettings({
        categories: settings.categories,
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
      });
      setSettings(saved);
      setDirty(false);
      onNotify(s.notificationSettings.saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : s.notificationSettings.saveFailed;
      setError(message);
      onNotify(message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) {
    return <p className="form-error">{error}</p>;
  }
  if (!settings) {
    return <p className="onboarding-help">{s.notificationSettings.loading}</p>;
  }

  const quietSet = settings.quietHoursStart !== '' || settings.quietHoursEnd !== '';

  return (
    <div className="notification-settings">
      <div className="notification-settings-head">
        <span className="setting-icon">
          <Bell size={17} />
        </span>
        <div>
          <strong>{s.notificationSettings.title}</strong>
          <span>{s.notificationSettings.intro}</span>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="notification-categories">
        {(Object.keys(s.notificationSettings.typeLabels) as NotificationType[]).map((type) => (
          <label className="notification-toggle" key={type}>
            <span>{notificationTypeLabel(type, language)}</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.categories[type]}
              aria-label={`${notificationTypeLabel(type, language)} notifications`}
              className={`toggle-switch ${settings.categories[type] ? 'toggle-on' : ''}`}
              onClick={() => toggleCategory(type)}
            >
              <span />
            </button>
          </label>
        ))}
      </div>
      <div className="quiet-hours">
        <strong>{s.notificationSettings.quietTitle}</strong>
        <span>
          {s.notificationSettings.quietText}
        </span>
        <div className="quiet-hours-inputs">
          <label>
            {s.notificationSettings.from}
            <input
              className="form-input"
              type="time"
              value={settings.quietHoursStart}
              onChange={(e) => {
                setSettings({ ...settings, quietHoursStart: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          <label>
            {s.notificationSettings.to}
            <input
              className="form-input"
              type="time"
              value={settings.quietHoursEnd}
              onChange={(e) => {
                setSettings({ ...settings, quietHoursEnd: e.target.value });
                setDirty(true);
              }}
            />
          </label>
          {quietSet && (
            <button
              className="outline-button"
              type="button"
              onClick={() => {
                setSettings({ ...settings, quietHoursStart: '', quietHoursEnd: '' });
                setDirty(true);
              }}
            >
              {s.notificationSettings.clearQuiet}
            </button>
          )}
        </div>
      </div>
      <p className="onboarding-help">
        {s.notificationSettings.pushNote}
      </p>
      <button className="primary-button" type="button" disabled={!dirty || saving} onClick={save}>
        <Check size={15} /> {saving ? s.notificationSettings.saving : s.notificationSettings.save}
      </button>
    </div>
  );
}

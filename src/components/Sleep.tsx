import { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, Moon, ShieldCheck, Sun } from 'lucide-react';
import { sleepDurationLabel } from '../types/profile';
import { formatTime12h } from '../App';
import NotificationSettingsPanel from './NotificationSettings';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';

const SOCIAL_APPS = ['Instagram', 'Facebook', 'Snapchat', 'WhatsApp', 'Telegram', 'X'];

type SleepReminders = { before30: boolean; wake: boolean; nudge: boolean };
const REMINDER_DEFAULTS: SleepReminders = { before30: true, wake: true, nudge: false };
const REMINDER_STORAGE_KEY = 'ahdora-sleep-reminders';

function loadReminders(): SleepReminders {
  try {
    const stored = JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY) ?? '{}') as Partial<SleepReminders>;
    return { ...REMINDER_DEFAULTS, ...stored };
  } catch {
    return REMINDER_DEFAULTS;
  }
}

/**
 * Sleep — preview #14 (light). The sleep-window editor, social-app
 * chips, YouTube toggle and save flow moved here from Focus, unchanged
 * (same onSaveFocus props, same MongoDB save). Plus the 3-column
 * header (sleep time | duration "schedule ke hisab se" | wake time),
 * the reminder toggles, and the sleep-dua card.
 *
 * Honesty rules kept here, per the spec:
 * - The duration is the configured SCHEDULE, never actual sleep.
 * - There is no "so gaya / uth gaya" record anywhere, so there are no
 *   weekly "schedule follow" bars — the section is an empty state,
 *   never fabricated bars.
 * - The three reminder switches below are device-local only (there is
 *   no backend field for them): they persist in this browser and do
 *   not send a reminder while the app is closed. The real, server-side
 *   notification categories (including Neend) live in the
 *   NotificationSettingsPanel below them — that is the backend field.
 * - The sleep dua is the verified /api/duas entry 'sone-se-pehle'
 *   (Sahih al-Bukhari 6324); its Hinglish tarjuma is shown as stored.
 */
export default function Sleep({
  sleepStartTime,
  sleepEndTime,
  onSleepChange,
  onSaveFocus,
  focusSaving,
  focusEnabled,
  setFocusEnabled,
  youtubeAllowed,
  setYoutubeAllowed,
  onNotify,
  onBack,
  onOpenGuidance,
  guestMode,
  language,
}: {
  sleepStartTime: string;
  sleepEndTime: string;
  /** Edit the sleep window; saved to MongoDB by onSaveFocus. */
  onSleepChange: (start: string, end: string) => void;
  /** Saves the sleep window; true when it landed. */
  onSaveFocus: () => Promise<boolean>;
  focusSaving: boolean;
  focusEnabled: boolean;
  setFocusEnabled: (value: boolean) => void;
  youtubeAllowed: boolean;
  setYoutubeAllowed: (value: boolean) => void;
  onNotify: (message: string) => void;
  onBack: () => void;
  onOpenGuidance: (tab: 'quran' | 'duas' | 'hijri' | 'mosques') => void;
  guestMode: boolean;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const sleepStart = formatTime12h(sleepStartTime || '22:00');
  const sleepEnd = formatTime12h(sleepEndTime || '04:00');
  const sleepDuration = sleepDurationLabel(sleepStartTime || '22:00', sleepEndTime || '04:00');
  const [socialApps, setSocialApps] = useState<string[]>([...SOCIAL_APPS]);
  // Persistent confirmation, same as Focus had: the toast alone was
  // missed whenever the save was slow. 'idle' = nothing to report yet.
  const [saveResult, setSaveResult] = useState<'idle' | 'saved' | 'error'>('idle');
  const [reminders, setReminders] = useState<SleepReminders>(loadReminders);

  useEffect(() => {
    try {
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    } catch {
      // A reminder switch that cannot persist locally still toggles
      // for this visit; the save failure is never shown as data.
    }
  }, [reminders]);

  async function handleSaveClick() {
    const ok = await onSaveFocus();
    setSaveResult(ok ? 'saved' : 'error');
  }

  function handleSleepChange(start: string, end: string) {
    // A new edit makes the old confirmation stale — clear it.
    setSaveResult('idle');
    onSleepChange(start, end);
  }

  function toggleReminder(key: keyof SleepReminders) {
    setReminders((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const reminderRows: { key: keyof SleepReminders; title: string; sub: string }[] = [
    { key: 'before30', title: s.sleep.reminderBefore, sub: s.sleep.reminderBeforeSub },
    { key: 'wake', title: s.sleep.reminderWake, sub: s.sleep.reminderWakeSub(sleepEnd) },
    { key: 'nudge', title: s.sleep.reminderNudge, sub: s.sleep.reminderNudgeSub },
  ];

  return (
    <section className="sleep-screen">
      <div className="apphead">
        <button type="button" className="aback" onClick={onBack} aria-label={s.common.back}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h4>{s.sleep.title}</h4>
          <div className="asub">{s.sleep.sub}</div>
        </div>
      </div>

      <div className="acard-l sleep-head3">
        <div>
          <div className="sleep-head3-ic">🌙</div>
          <b>{sleepStart}</b>
          <div className="mut">{s.sleep.bedtime}</div>
        </div>
        <div className="sleep-head3-mid">
          <div className="sleep-head3-kul">{s.sleep.totalSleep}</div>
          <b>{sleepDuration || '—'}</b>
          <div className="mut">{s.sleep.asPerSchedule}</div>
        </div>
        <div>
          <div className="sleep-head3-ic">☀️</div>
          <b>{sleepEnd}</b>
          <div className="mut">{s.sleep.wakeTime}</div>
        </div>
      </div>

      <div className="acard-l">
        <h5>{s.sleep.changeTime}</h5>
        <div className="sleep-window">
          <div className="sleep-time">
            <Moon size={19} />
            <span>{s.sleep.start}</span>
            <strong>{sleepStart}</strong>
          </div>
          <div className="sleep-duration">
            <div className="sleep-line" />
            <span>{sleepDuration ? s.sleep.protected(sleepDuration) : s.sleep.protectedOnly}</span>
            <div className="sleep-line" />
          </div>
          <div className="sleep-time">
            <Sun size={19} />
            <span>{s.sleep.end}</span>
            <strong>{sleepEnd}</strong>
          </div>
        </div>

        <div className="onboarding-two-col" style={{ marginTop: 14 }}>
          <div>
            <label className="field-label">{s.sleep.startLabel}</label>
            <input className="form-input" type="time" value={sleepStartTime || '22:00'} onChange={(e) => handleSleepChange(e.target.value, sleepEndTime || '04:00')} />
          </div>
          <div>
            <label className="field-label">{s.sleep.endLabel}</label>
            <input className="form-input" type="time" value={sleepEndTime || '04:00'} onChange={(e) => handleSleepChange(sleepStartTime || '22:00', e.target.value)} />
          </div>
        </div>

        <div className="focus-setting-row">
          <div>
            <strong>{s.sleep.focusTitle}</strong>
            <small>{s.sleep.focusText}</small>
          </div>
          <button
            className={`toggle ${focusEnabled ? 'toggle-on' : ''}`}
            aria-label={s.sleep.focusToggleAria}
            onClick={() => setFocusEnabled(!focusEnabled)}
          >
            <i />
          </button>
        </div>

        <button className="primary-button" disabled={focusSaving} onClick={() => void handleSaveClick()}>
          {focusSaving ? s.sleep.saving : s.sleep.saveSchedule}
        </button>
        {saveResult === 'saved' && (
          <p className="onboarding-help" role="status">{s.sleep.saved(sleepStart, sleepEnd)}</p>
        )}
        {saveResult === 'error' && (
          <p className="salah-error" role="status">{s.sleep.saveFailed}</p>
        )}
        <p className="onboarding-help">{s.sleep.saveNote}</p>
      </div>

      <div className="acard-l">
        <div className="focus-setting-head">
          <div>
            <strong>{s.sleep.restrictTitle}</strong>
            <small>{s.sleep.restrictText}</small>
          </div>
          <span>{s.sleep.selectedCount(socialApps.length)}</span>
        </div>

        <div className="app-chip-list">
          {SOCIAL_APPS.map((app) => (
            <button
              key={app}
              type="button"
              className={socialApps.includes(app) ? 'app-chip blocked' : 'app-chip'}
              onClick={() => setSocialApps((prev) => prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app])}
            >
              <span className="app-chip-dot" />
              {app}
              {socialApps.includes(app) && <span>✓</span>}
            </button>
          ))}
        </div>

        <div className="focus-setting-row">
          <div>
            <strong>{s.sleep.youtubeTitle}</strong>
            <small>{s.sleep.youtubeText}</small>
          </div>
          <button
            className={`toggle ${youtubeAllowed ? 'toggle-on' : ''}`}
            onClick={() => setYoutubeAllowed(!youtubeAllowed)}
            aria-label={s.sleep.youtubeAria}
          >
            <i />
          </button>
        </div>

        <div className="focus-setting-row">
          <div>
            <strong>{s.sleep.callsTitle}</strong>
            <small>{s.sleep.callsText}</small>
          </div>
          <span className="always-allowed"><ShieldCheck size={13} /> {s.sleep.allowed}</span>
        </div>
      </div>

      <div className="acard-l">
        <h5>{s.sleep.weekTitle}</h5>
        <p className="onboarding-help">
          {s.sleep.weekText}
        </p>
      </div>

      <div className="acard-l">
        <h5>{s.sleep.remindersTitle}</h5>
        {reminderRows.map((row) => (
          <div className="setrow" key={row.key}>
            <div>{row.title}<small>{row.sub}</small></div>
            <button
              type="button"
              className={`tgl ${reminders[row.key] ? '' : 'off'}`}
              role="switch"
              aria-checked={reminders[row.key]}
              aria-label={row.title}
              onClick={() => toggleReminder(row.key)}
            />
          </div>
        ))}
        <p className="onboarding-help">
          {s.sleep.remindersNote}
        </p>
        {guestMode ? (
          <p className="onboarding-help">{s.sleep.signInNotifications}</p>
        ) : (
          <NotificationSettingsPanel onNotify={onNotify} language={language} />
        )}
      </div>

      <div className="acard-l">
        <h5>{s.sleep.duaTitle}</h5>
        <div className="sleep-dua-arab">بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا</div>
        <p className="mut" style={{ margin: '5px 0 0' }}>
          <i>Bismika Allaahumma amootu wa ahyaa.</i> — "Ae Allah! Tere naam se main sota hoon
          (neend ek chhoti si maut hai) aur Tere hi naam se jaagta hoon." (Sahih al-Bukhari 6324)
        </p>
        <button type="button" className="text-button" onClick={() => onOpenGuidance('duas')}>
          <BookOpen size={14} /> {s.sleep.duaButton}
        </button>
      </div>

      <div className="acard-l">
        <p className="mut" style={{ margin: 0 }}>
          {s.sleep.footerNote}
        </p>
      </div>
    </section>
  );
}

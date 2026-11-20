import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/http.js';
import {
  emptyPrayerSettings,
  fetchPrayerSettings,
  fetchPrayerTimes,
  savePrayerSettings,
  type PrayerSettings,
  type PrayerTimesResponse,
} from '../lib/prayerApi.js';

const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type Prayer = typeof prayerNames[number];
type Status = 'pending' | 'prayed' | 'qaza' | 'missed';
type PrayerEntry = {
  status: Status;
  wasMissed: boolean;
  missedAt: string | null;
  autoMissed: boolean;
};
type PrayerRecord = Record<Prayer, PrayerEntry>;

const emptyEntry: PrayerEntry = {
  status: 'pending',
  wasMissed: false,
  missedAt: null,
  autoMissed: false,
};

const emptyRecord: PrayerRecord = {
  Fajr: { ...emptyEntry },
  Dhuhr: { ...emptyEntry },
  Asr: { ...emptyEntry },
  Maghrib: { ...emptyEntry },
  Isha: { ...emptyEntry },
};

function toEntry(value: unknown): PrayerEntry {
  const entry = (value ?? {}) as Partial<PrayerEntry>;
  return {
    status: entry.status ?? 'pending',
    wasMissed: entry.wasMissed ?? false,
    missedAt: entry.missedAt ?? null,
    autoMissed: entry.autoMissed ?? false,
  };
}

/** Honest label: a Qaza keeps its original miss visible, never erased.
 * A prayer recorded as prayed is labelled "Prayed" — never "was
 * missed earlier" (P13): the select's own "Prayed on time" status
 * must not carry a contradictory miss label. Miss history itself is
 * still preserved in the record (wasMissed/missedAt) for Qaza. */
function statusLabel(entry: PrayerEntry): string {
  const base = entry.status[0].toUpperCase() + entry.status.slice(1);
  if (entry.status === 'missed' && entry.autoMissed) {
    return 'Missed — auto-marked after deadline';
  }
  if (entry.status === 'qaza' && entry.wasMissed) {
    return 'Qaza (was missed)';
  }
  return base;
}

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type Props = {
  onNotify: (message: string) => void;
};

export default function SalahTracker({ onNotify }: Props) {
  const today = dateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [records, setRecords] = useState<Record<string, PrayerRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Prayer | null>(null);
  const [error, setError] = useState('');

  // Prayer times for the selected date (today only — Aladhan returns
  // today's times, so showing them for a past date would be wrong).
  // A failed load never blocks the tracker: statuses still save.
  const [times, setTimes] = useState<PrayerTimesResponse | null>(null);
  const [timesNote, setTimesNote] = useState('');

  // Manual per-prayer times: the user's own overrides, saved per user.
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [draftSettings, setDraftSettings] = useState<PrayerSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingTimes, setSavingTimes] = useState(false);
  const [timesMessage, setTimesMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    apiFetch(`/api/salah/calendar/${month}`)
      .then(async response => {
        if (!response.ok) {
          if (response.status === 401) throw new Error('Login required to view your saved Salah records.');
          throw new Error('Salah records could not be loaded.');
        }
        return response.json();
      })
      .then(data => {
        if (!active) return;
        const monthRecords: Record<string, PrayerRecord> = {};

        for (const day of data.days ?? []) {
          monthRecords[day.date] = Object.fromEntries(
            prayerNames.map(name => [name, toEntry(day.prayers?.[name])]),
          ) as PrayerRecord;
        }

        setRecords(previous => {
          const otherMonths = Object.fromEntries(
            Object.entries(previous).filter(([date]) => !date.startsWith(month)),
          );
          return { ...otherMonths, ...monthRecords };
        });
      })
      .catch(err => {
        if (active) setError(err.message || 'Could not load Salah records.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [month]);

  // Today's prayer times (with the manual/calculated source per prayer).
  useEffect(() => {
    if (selectedDate !== today) {
      setTimes(null);
      setTimesNote('');
      return;
    }
    let active = true;
    setTimesNote('');
    fetchPrayerTimes(selectedDate)
      .then(data => {
        if (active) {
          setTimes(data);
          // Manual fallback (P2/P6): Aladhan failed but manual times
          // are being served — say so instead of showing nothing.
          if (data.aladhanFailed && data.notice) setTimesNote(data.notice);
        }
      })
      .catch(err => {
        if (active) {
          setTimes(null);
          setTimesNote(err instanceof Error ? err.message : 'Prayer times load nahi ho paye.');
        }
      });
    return () => { active = false; };
  }, [selectedDate, today]);

  async function openTimeEditor() {
    if (showTimeEditor) {
      setShowTimeEditor(false);
      return;
    }
    setShowTimeEditor(true);
    setTimesMessage('');
    if (draftSettings) return;
    setSettingsLoading(true);
    try {
      setDraftSettings(await fetchPrayerSettings());
    } catch (err) {
      setTimesMessage(err instanceof Error ? err.message : 'Prayer settings load nahi ho paye.');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveTimes() {
    if (!draftSettings) return;
    setSavingTimes(true);
    setTimesMessage('');
    try {
      await savePrayerSettings(draftSettings);
      setTimesMessage('Namaz ke time save ho gaye.');
      onNotify('Namaz ke time save ho gaye.');
      if (selectedDate === today) {
        fetchPrayerTimes(selectedDate)
          .then(setTimes)
          .catch(() => undefined);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Prayer times save nahi ho paye.';
      setTimesMessage(message);
      onNotify(message);
    } finally {
      setSavingTimes(false);
    }
  }

  const selected = records[selectedDate] ?? emptyRecord;

  async function updateStatus(prayer: Prayer, status: Status) {
    if (selectedDate > today) {
      onNotify('Future dates cannot be marked.');
      return;
    }

    setSaving(prayer);
    setError('');

    try {
      // State-changing request: must go through apiFetch so the
      // X-CSRF-Token header is attached (the server rejects raw
      // fetch() mutations with "Invalid CSRF token").
      const response = await apiFetch(`/api/salah/day/${selectedDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prayer, status }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Salah status could not be saved.');
      }

      const savedRecord = Object.fromEntries(
        prayerNames.map(name => [
          name,
          data.prayers?.[name]
            ? toEntry(data.prayers[name])
            : (name === prayer ? { ...toEntry(selected[name]), status } : selected[name]),
        ]),
      ) as PrayerRecord;

      setRecords(previous => ({ ...previous, [selectedDate]: savedRecord }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed.';
      setError(message);
      onNotify(message);
    } finally {
      setSaving(null);
    }
  }

  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(year, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();

  const calendarCells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const totals = useMemo(() => {
    const result: Record<Status, number> = {
      prayed: 0, qaza: 0, missed: 0, pending: 0,
    };

    Object.entries(records)
      .filter(([date]) => date.startsWith(month))
      .forEach(([, record]) => {
        prayerNames.forEach(name => result[record[name].status]++);
      });

    return result;
  }, [records, month]);

  const monthTitle = new Date(year, monthNumber - 1, 1).toLocaleDateString(
    'en-IN', { month: 'long', year: 'numeric' },
  );

  function moveMonth(direction: number) {
    const next = new Date(year, monthNumber - 1 + direction, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  return (
    <section className="panel salah-tracker">
      <div className="salah-head">
        <div>
          <span className="eyebrow">PRIVATE WORSHIP RECORD</span>
          <h3>Your Salah calendar</h3>
          <p>Track each prayer honestly. Only your account can access these records.</p>
        </div>
        <span className="salah-sync account"><ShieldCheck size={13} /> {monthTitle} · this month</span>
      </div>

      <div className="salah-summary">
        {(['prayed', 'qaza', 'missed', 'pending'] as Status[]).map(status => (
          <div className="salah-stat" key={status}>
            <strong>{totals[status]}</strong>
            <span>{status[0].toUpperCase() + status.slice(1)}</span>
          </div>
        ))}
      </div>

      {error && <p className="salah-error">{error}</p>}
      {loading && <p className="salah-loading">Loading your saved prayer records...</p>}

      <div className="salah-layout">
        <div className="salah-calendar-wrap">
          <div className="salah-month">
            <button onClick={() => moveMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={17} />
            </button>
            <strong>{monthTitle}</strong>
            <button
              onClick={() => moveMonth(1)}
              disabled={`${year}-${String(monthNumber).padStart(2, '0')}` >= today.slice(0, 7)}
              aria-label="Next month"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="salah-calendar">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <span className="weekday" key={day}>{day}</span>
            ))}

            {calendarCells.map((day, index) => {
              if (!day) return <span key={`blank-${index}`} />;

              const key = `${month}-${String(day).padStart(2, '0')}`;
              const record = records[key] ?? emptyRecord;
              const values = prayerNames.map(name => record[name].status);
              const allPrayed = values.every(value => value === 'prayed');
              const hasMissed = values.includes('missed');
              const hasQaza = values.includes('qaza');
              const hasPrayed = values.includes('prayed');

              return (
                <button
                  key={key}
                  className={`salah-day ${selectedDate === key ? 'selected' : ''} ${key === today ? 'today' : ''}`}
                  onClick={() => setSelectedDate(key)}
                  disabled={key > today}
                  aria-label={`${key}: ${values.join(', ')}`}
                >
                  <b>{day}</b>
                  <i className={
                    hasMissed ? 'has-missed'
                    : hasQaza ? 'has-qaza'
                    : allPrayed ? 'all-prayed'
                    : hasPrayed ? 'some-prayed'
                    : ''
                  } />
                </button>
              );
            })}
          </div>

          <div className="salah-legend">
            <span><i className="all-prayed" /> Prayed</span>
            <span><i className="has-qaza" /> Qaza</span>
            <span><i className="has-missed" /> Missed</span>
          </div>
        </div>

        <div className="salah-day-detail">
          <div className="salah-detail-title">
            <div>
              <span className="eyebrow">SELECTED DATE</span>
              <h4>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
              )}</h4>
            </div>
            <span>{prayerNames.filter(name => selected[name].status === 'prayed').length}/5 prayed</span>
          </div>

          {prayerNames.map(prayer => (
            <div className="salah-prayer-row" key={prayer}>
              <div>
                <strong>{prayer}</strong>
                {selectedDate === today && times && (
                  <small>
                    {times.perPrayer[prayer].source === 'unavailable'
                      ? 'Time set nahi hai — neeche manual time set karo'
                      : (
                        <>
                          {times.perPrayer[prayer].time}
                          {' · '}
                          {times.perPrayer[prayer].source === 'manual' ? 'Manual time' : 'Calculated time'}
                          {times.perPrayer[prayer].deadline && (
                            <>
                              {' · deadline '}
                              {times.perPrayer[prayer].deadline}
                            </>
                          )}
                        </>
                      )}
                  </small>
                )}
                <small>{statusLabel(selected[prayer])}</small>
              </div>
              <select
                value={selected[prayer].status}
                disabled={saving !== null || selectedDate > today || loading}
                onChange={event => updateStatus(prayer, event.target.value as Status)}
                aria-label={`${prayer} status`}
              >
                <option value="pending">Not recorded</option>
                <option value="prayed">Prayed on time</option>
                <option value="qaza">Prayed Qaza</option>
                <option value="missed">Missed</option>
              </select>
            </div>
          ))}

          {selectedDate === today && timesNote && (
            <p className="salah-loading">{timesNote}</p>
          )}

          <div className="salah-time-editor">
            <button className="text-button" type="button" onClick={openTimeEditor} disabled={settingsLoading}>
              {showTimeEditor ? 'Time editor band karo' : 'Apni namaz ka time khud set karo'}
            </button>
            {showTimeEditor && (
              <div>
                <p className="salah-private-note">
                  Har namaz ka time khud set kar sakte ho — jo time yahan save karoge,
                  wahi tracker me aur reminders me use hoga. Khali chhodo to Aladhan ka
                  calculated time use hoga. Deadline khali ho to agle namaz ka time
                  deadline hota hai (Isha ke liye 23:59).
                </p>
                {settingsLoading && <p className="salah-loading">Prayer settings load ho rahe hain...</p>}
                {draftSettings && prayerNames.map(prayer => (
                  <div className="salah-prayer-row" key={`edit-${prayer}`}>
                    <div>
                      <strong>{prayer}</strong>
                      <label className="field-label">
                        <input
                          type="checkbox"
                          checked={draftSettings[prayer].reminder}
                          onChange={event => setDraftSettings(previous => previous && ({
                            ...previous,
                            [prayer]: { ...previous[prayer], reminder: event.target.checked },
                          }))}
                        />
                        {' '}Reminder
                      </label>
                    </div>
                    <div>
                      <label className="field-label">Time
                        <input
                          className="form-input"
                          type="time"
                          value={draftSettings[prayer].timeOverride}
                          onChange={event => setDraftSettings(previous => previous && ({
                            ...previous,
                            [prayer]: { ...previous[prayer], timeOverride: event.target.value },
                          }))}
                          aria-label={`${prayer} manual time`}
                        />
                      </label>
                      <label className="field-label">Deadline
                        <input
                          className="form-input"
                          type="time"
                          value={draftSettings[prayer].endTime}
                          onChange={event => setDraftSettings(previous => previous && ({
                            ...previous,
                            [prayer]: { ...previous[prayer], endTime: event.target.value },
                          }))}
                          aria-label={`${prayer} deadline`}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {timesMessage && <p className="salah-loading">{timesMessage}</p>}
                {draftSettings && (
                  <div>
                    <button className="primary-button" type="button" onClick={saveTimes} disabled={savingTimes}>
                      {savingTimes ? 'Save ho raha hai...' : 'Namaz ke time save karo'}
                    </button>
                    {' '}
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setDraftSettings(emptyPrayerSettings())}
                      disabled={savingTimes}
                    >
                      Sab calculated time par wapas
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="salah-private-note">
            Your worship history is private. A status changes when you select and save it — except a prayer
            left unrecorded past its deadline plus 5 minutes, which is marked missed automatically and can
            still be corrected to Qaza afterwards. A Qaza keeps its original miss visible.
          </p>
        </div>
      </div>
    </section>
  );
}
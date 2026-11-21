import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/http.js';
import type { AppLanguage } from '../lib/language';
import { stringsFor, type Strings } from '../lib/strings';
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
function statusLabel(entry: PrayerEntry, s: Strings): string {
  if (entry.status === 'missed' && entry.autoMissed) {
    return s.salahCalendar.statusMissedAuto;
  }
  if (entry.status === 'qaza' && entry.wasMissed) {
    return s.salahCalendar.statusQazaWasMissed;
  }
  return s.salahCalendar[
    entry.status === 'pending'
      ? 'statusPending'
      : entry.status === 'prayed'
        ? 'statusPrayed'
        : entry.status === 'qaza'
          ? 'statusQaza'
          : 'statusMissed'
  ];
}

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type Props = {
  onNotify: (message: string) => void;
  language: AppLanguage;
  /** Phase 17: open with the manual time editor already expanded
   * (used by the Dashboard / Deen "edit prayer times" entries). */
  startEditorOpen?: boolean;
};

export default function SalahTracker({ onNotify, language, startEditorOpen = false }: Props) {
  const s = stringsFor(language);
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
  const [showTimeEditor, setShowTimeEditor] = useState(startEditorOpen);
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
          if (response.status === 401) throw new Error(s.salahCalendar.loginRequired);
          throw new Error(s.salahCalendar.loadFailed);
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
        if (active) setError(err.message || s.salahCalendar.loadFailedShort);
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
          setTimesNote(err instanceof Error ? err.message : s.salahCalendar.timesLoadFailed);
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
      setTimesMessage(err instanceof Error ? err.message : s.salahCalendar.settingsLoadFailed);
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
      setTimesMessage(s.salahCalendar.timesSaved);
      onNotify(s.salahCalendar.timesSaved);
      if (selectedDate === today) {
        fetchPrayerTimes(selectedDate)
          .then(setTimes)
          .catch(() => undefined);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : s.salahCalendar.timesSaveFailed;
      setTimesMessage(message);
      onNotify(message);
    } finally {
      setSavingTimes(false);
    }
  }

  const selected = records[selectedDate] ?? emptyRecord;

  async function updateStatus(prayer: Prayer, status: Status) {
    if (selectedDate > today) {
      onNotify(s.salahCalendar.futureCannotMark);
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
        throw new Error(data.error || s.salahCalendar.statusSaveFailed);
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
      const message = err instanceof Error ? err.message : s.salahCalendar.saveFailed;
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

  // Month-summary card (preview #6 "Is mahine ka haal"): on-time %
  // is prayed-on-time out of all recorded prayers; qaza counts as
  // recorded but not on time. Nothing is shown until a prayer is
  // actually recorded — never a fake %.
  const recorded = totals.prayed + totals.qaza + totals.missed;
  const onTimePct = recorded > 0 ? Math.round((totals.prayed / recorded) * 100) : null;
  const monthShort = new Date(year, monthNumber - 1, 1).toLocaleDateString(
    'en-IN', { month: 'short' },
  );
  const summaryRange = month === today.slice(0, 7)
    ? `1 – ${Number(today.slice(8, 10))} ${monthShort}`
    : `1 – ${daysInMonth} ${monthShort}`;

  function moveMonth(direction: number) {
    const next = new Date(year, monthNumber - 1 + direction, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
  }

  return (
    <section className="sc-salah">
      <div className="sc-head">
        <span className="eyebrow">{s.salahCalendar.eyebrow}</span>
        <h3>{s.salahCalendar.heading}</h3>
        <p>{s.salahCalendar.intro}</p>
        <span className="salah-sync"><ShieldCheck size={13} /> {s.salahCalendar.syncLine(monthTitle)}</span>
      </div>

      {error && <p className="salah-error">{error}</p>}
      {loading && <p className="salah-loading">{s.salahCalendar.loadingRecords}</p>}

      <div className="acard-l">
        <div className="salah-month">
          <button className="sbtn gh" onClick={() => moveMonth(-1)} aria-label={s.hijri.prevMonth}>
            <ChevronLeft size={17} />
          </button>
          <strong>{monthTitle}</strong>
          <button
            className="sbtn gh"
            onClick={() => moveMonth(1)}
            disabled={`${year}-${String(monthNumber).padStart(2, '0')}` >= today.slice(0, 7)}
            aria-label={s.hijri.nextMonth}
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="cal">
          {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
            <span className="dow" key={day}>{day}</span>
          ))}

          {calendarCells.map((day, index) => {
            if (!day) return <span key={`blank-${index}`} />;

            const key = `${month}-${String(day).padStart(2, '0')}`;
            const record = records[key] ?? emptyRecord;
            const values = prayerNames.map(name => record[name].status);
            const allPrayed = values.every(value => value === 'prayed');
            const missedCount = values.filter(value => value === 'missed').length;
            const qazaCount = values.filter(value => value === 'qaza').length;
            // Preview legend: teal = sab padhi, peach-deep = kuch
            // miss / qaza, red = zyada miss (3 ya zyada).
            const dotClass = allPrayed
              ? 'dt-teal'
              : missedCount >= 3
                ? 'dt-red'
                : missedCount > 0 || qazaCount > 0
                  ? 'dt-peach'
                  : '';

            return (
              <button
                key={key}
                className={`d ${selectedDate === key ? 'selected' : ''} ${key === today ? 'today' : ''} ${key > today ? 'fut' : ''}`}
                onClick={() => setSelectedDate(key)}
                disabled={key > today}
                aria-label={`${key}: ${values.join(', ')}`}
              >
                {day}
                {dotClass && <i className={`dt ${dotClass}`} />}
              </button>
            );
          })}
        </div>

        <div className="legend">
          <span><i className="lg-teal" /> {s.salahCalendar.legendAll}</span>
          <span><i className="lg-peach" /> {s.salahCalendar.legendSome}</span>
          <span><i className="lg-red" /> {s.salahCalendar.legendMany}</span>
        </div>
      </div>

      <div className="acard-l">
        <h5>{s.salahCalendar.monthSummary(summaryRange)}</h5>
        {onTimePct === null ? (
          <p className="mut">{s.salahCalendar.monthEmpty}</p>
        ) : (
          <>
            <div className="statrow">{s.salahCalendar.onTime} <span>{onTimePct}%</span></div>
            <div className="prog"><i style={{ width: `${onTimePct}%` }} /></div>
          </>
        )}
        <div className="kpis">
          <div className="kpi"><b>{recorded}</b><span>{s.salahCalendar.totalPrayers}</span></div>
          <div className="kpi"><b className="kpi-red">{totals.missed}</b><span>{s.salahCalendar.miss}</span></div>
          <div className="kpi"><b>{totals.qaza}</b><span>{s.salahCalendar.qazaPrayed}</span></div>
        </div>
        <p className="mut">{s.salahCalendar.tapDayHint}</p>
      </div>

      <div className="acard-l">
        <div className="salah-detail-title">
          <div>
            <span className="eyebrow">SELECTED DATE</span>
            <h4>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
              'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
            )}</h4>
          </div>
          <span>{s.salahCalendar.prayedOf(prayerNames.filter(name => selected[name].status === 'prayed').length)}</span>
        </div>

        {prayerNames.map(prayer => (
          <div className="salah-prayer-row" key={prayer}>
            <div>
              <strong>{prayer}</strong>
              {selectedDate === today && times && (
                <small>
                  {times.perPrayer[prayer].source === 'unavailable'
                    ? s.salahCalendar.timeNotSet
                    : (
                      <>
                        {times.perPrayer[prayer].time}
                        {' · '}
                        {times.perPrayer[prayer].source === 'manual' ? s.salahCalendar.manualTime : s.salahCalendar.calculatedTime}
                        {times.perPrayer[prayer].deadline && (
                          <>
                            {' · '}{s.salahCalendar.deadline} 
                            {times.perPrayer[prayer].deadline}
                          </>
                        )}
                      </>
                    )}
                </small>
              )}
              <small>{statusLabel(selected[prayer], s)}</small>
            </div>
            <select
              className="form-input"
              value={selected[prayer].status}
              disabled={saving !== null || selectedDate > today || loading}
              onChange={event => updateStatus(prayer, event.target.value as Status)}
              aria-label={`${prayer} status`}
            >
              <option value="pending">{s.salahCalendar.optionNotRecorded}</option>
              <option value="prayed">{s.salahCalendar.optionPrayedOnTime}</option>
              <option value="qaza">{s.salahCalendar.optionPrayedQaza}</option>
              <option value="missed">{s.salahCalendar.optionMissed}</option>
            </select>
          </div>
        ))}

        {selectedDate === today && timesNote && (
          <p className="salah-loading">{timesNote}</p>
        )}

        <div className="salah-time-editor">
          <button className="text-button" type="button" onClick={openTimeEditor} disabled={settingsLoading}>
            {showTimeEditor ? s.salahCalendar.closeTimeEditor : s.salahCalendar.openTimeEditor}
          </button>
          {showTimeEditor && (
            <div>
              <p className="salah-private-note">
                {s.salahCalendar.timeEditorNote}
              </p>
              {settingsLoading && <p className="salah-loading">{s.salahCalendar.settingsLoading}</p>}
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
                      {' '}{s.salahCalendar.reminder}
                    </label>
                  </div>
                  <div>
                    <label className="field-label">{s.salahCalendar.timeLabel}
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
                    <label className="field-label">{s.salahCalendar.deadlineLabel}
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
                    {savingTimes ? s.salahCalendar.savingTimes : s.salahCalendar.saveTimes}
                  </button>
                  {' '}
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setDraftSettings(emptyPrayerSettings())}
                    disabled={savingTimes}
                  >
                    {s.salahCalendar.resetCalculated}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="salah-private-note">
          {s.salahCalendar.privacyNote}
        </p>
      </div>

      <p className="salah-private-note">
        <CalendarDays size={13} /> {s.salahCalendar.calendarNote}
      </p>
    </section>
  );
}

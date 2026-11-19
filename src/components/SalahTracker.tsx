import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';

const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type Prayer = typeof prayerNames[number];
type Status = 'pending' | 'prayed' | 'qaza' | 'missed';
type PrayerRecord = Record<Prayer, Status>;

const emptyRecord: PrayerRecord = {
  Fajr: 'pending',
  Dhuhr: 'pending',
  Asr: 'pending',
  Maghrib: 'pending',
  Isha: 'pending',
};

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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetch(`/api/salah/calendar/${month}`, {
      credentials: 'include',
    })
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
            prayerNames.map(name => [name, day.prayers?.[name]?.status ?? 'pending']),
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

  const selected = records[selectedDate] ?? emptyRecord;

  async function updateStatus(prayer: Prayer, status: Status) {
    if (selectedDate > today) {
      onNotify('Future dates cannot be marked.');
      return;
    }

    setSaving(prayer);
    setError('');

    try {
      const response = await fetch(`/api/salah/day/${selectedDate}`, {
        method: 'PUT',
        credentials: 'include',
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
          data.prayers?.[name]?.status ?? (name === prayer ? status : selected[name]),
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
        prayerNames.forEach(name => result[record[name]]++);
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
        <span className="salah-sync account"><ShieldCheck size={13} /> Account records</span>
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
              const values = Object.values(record);
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
            <span>{prayerNames.filter(name => selected[name] === 'prayed').length}/5 prayed</span>
          </div>

          {prayerNames.map(prayer => (
            <div className="salah-prayer-row" key={prayer}>
              <div>
                <strong>{prayer}</strong>
                <small>{selected[prayer][0].toUpperCase() + selected[prayer].slice(1)}</small>
              </div>
              <select
                value={selected[prayer]}
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

          <p className="salah-private-note">
            Your worship history is private. A status changes only when you select and save it.
          </p>
        </div>
      </div>
    </section>
  );
}
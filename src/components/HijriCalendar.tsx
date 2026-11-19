import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchHijriMonth,
  fetchHijriSettings,
  fetchHijriToday,
  setHijriOffset,
  type HijriMonth,
  type HijriToday,
} from '../lib/hijriApi';

/**
 * Hijri calendar. Every date comes from Aladhan (Umm al-Qura
 * calendar); Ramadan/Eid markers come only from the upstream
 * per-day holiday lists. The day adjustment is the user's own
 * setting for local moon-sighting differences.
 */
export default function HijriCalendar({
  onNotify,
  guestMode,
}: {
  onNotify: (message: string) => void;
  guestMode: boolean;
}) {
  const [today, setToday] = useState<HijriToday | null>(null);
  const [month, setMonth] = useState<HijriMonth | null>(null);
  const [offset, setOffset] = useState(0);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthNumber, setMonthNumber] = useState(() => new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextYear: number, nextMonth: number) => {
    setLoading(true);
    setError('');
    try {
      const [todayData, monthData, settings] = await Promise.all([
        fetchHijriToday(),
        fetchHijriMonth(nextYear, nextMonth),
        guestMode ? Promise.resolve(null) : fetchHijriSettings(),
      ]);
      setToday(todayData);
      setMonth(monthData);
      if (settings) setOffset(settings.hijriDayOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hijri calendar could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [guestMode]);

  useEffect(() => {
    load(year, monthNumber);
  }, [load, year, monthNumber]);

  function shiftMonth(delta: number) {
    let nextMonth = monthNumber + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setMonthNumber(nextMonth);
    setYear(nextYear);
  }

  async function changeOffset(next: number) {
    if (guestMode) {
      onNotify('Sign in to save a Hijri day adjustment.');
      return;
    }
    setOffset(next);
    try {
      await setHijriOffset(next);
      await load(year, monthNumber);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Adjustment could not be saved.');
    }
  }

  const firstDay = month?.days[0]?.gregorian.date ?? '';
  const firstWeekday = firstDay ? new Date(`${firstDay}T12:00:00Z`).getUTCDay() : 0;
  const blanks = Array.from({ length: firstWeekday }, (_, index) => index);

  return (
    <section className="hijri-calendar">
      <div className="quran-browser-head">
        <div>
          <span className="eyebrow">HIJRI CALENDAR</span>
          <h3>Islamic dates</h3>
          {today && (
            <p>
              Today: {today.hijri.day} {today.hijri.month.en} {today.hijri.year} AH ·{' '}
              {today.gregorian.date}
              {today.hijri.holidays.length > 0 && (
                <> · {today.hijri.holidays.join(', ')}</>
              )}
            </p>
          )}
          {month && <p className="quran-source-line">Source: {month.source}</p>}
        </div>
        <CalendarDays size={22} />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="hijri-controls">
        <div className="hijri-nav">
          <button className="icon-button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={18} />
          </button>
          <strong>
            {month?.hijriMonths.join(' / ') ?? ''} · {year}
          </strong>
          <button className="icon-button" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
        <label className="field-label">
          Moon-sighting adjustment
          <select
            className="form-input"
            value={offset}
            onChange={(event) => changeOffset(Number(event.target.value))}
          >
            <option value={-2}>−2 days</option>
            <option value={-1}>−1 day</option>
            <option value={0}>No adjustment</option>
            <option value={1}>+1 day</option>
            <option value={2}>+2 days</option>
          </select>
        </label>
      </div>

      {month && (
        <p className="quran-source-line">{month.convention}</p>
      )}

      {loading ? (
        <p className="empty-note">Loading…</p>
      ) : month ? (
        <div className="hijri-grid" role="grid" aria-label="Hijri calendar month">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day} className="hijri-weekday">
              {day}
            </span>
          ))}
          {blanks.map((index) => (
            <span key={`blank-${index}`} className="hijri-cell blank" />
          ))}
          {month.days.map((day) => (
            <div
              key={day.gregorian.date}
              className={`hijri-cell ${day.isToday ? 'is-today' : ''} ${day.hijri.holidays.length > 0 ? 'has-holiday' : ''}`}
            >
              <strong>{Number(day.gregorian.date.slice(8, 10))}</strong>
              <span>
                {day.hijri.day} {day.hijri.month.en}
              </span>
              {day.hijri.holidays.length > 0 && (
                <small>{day.hijri.holidays.join(', ')}</small>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-note">No calendar data for this month.</p>
      )}
    </section>
  );
}

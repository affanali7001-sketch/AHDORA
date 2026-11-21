import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';
import {
  fetchHijriMonth,
  fetchHijriSettings,
  fetchHijriToday,
  setHijriOffset,
  type HijriMonth,
  type HijriToday,
} from '../lib/hijriApi';

type UpcomingOccasion = {
  key: 'ramadan' | 'fitr' | 'adha';
  label: string;
  icon: string;
  hijriLabel: string;
  gregorianLabel: string;
};

/**
 * Hijri calendar. Every date comes from Aladhan (Umm al-Qura
 * calendar); Ramadan/Eid markers come only from the upstream
 * per-day holiday lists. The day adjustment is the user's own
 * setting for local moon-sighting differences.
 *
 * Layout (preview #7, dark): centred "AAJ KI HIJRI TAARIKH"
 * today card on top, month grid (Hijri day big, Gregorian small
 * below), upcoming-occasions card. The occasions are NOT
 * hardcoded: they are found by scanning the same Aladhan month
 * data forward (1 Ramadan, 1 Shawwal, 10 Dhul-Hijjah) and are
 * labelled `andaaz`, because the real date depends on moon
 * sighting. If the scan finds nothing, the card is hidden.
 */
export default function HijriCalendar({
  onNotify,
  guestMode,
  language,
}: {
  onNotify: (message: string) => void;
  guestMode: boolean;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [today, setToday] = useState<HijriToday | null>(null);
  const [month, setMonth] = useState<HijriMonth | null>(null);
  const [offset, setOffset] = useState(0);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [monthNumber, setMonthNumber] = useState(() => new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [occasions, setOccasions] = useState<UpcomingOccasion[] | null>(null);

  // The three calls load independently: a failing /today (or
  // settings) must never blank the month grid — each was a single
  // Promise.all failure away from "No calendar data for this month."
  // Only a failed month load is a calendar error.
  const load = useCallback(async (nextYear: number, nextMonth: number) => {
    setLoading(true);
    setError('');
    const [todayResult, monthResult, settingsResult] = await Promise.allSettled([
      fetchHijriToday(),
      fetchHijriMonth(nextYear, nextMonth),
      guestMode ? Promise.resolve(null) : fetchHijriSettings(),
    ]);
    if (todayResult.status === 'fulfilled') {
      setToday(todayResult.value);
    } else {
      setToday(null);
    }
    if (monthResult.status === 'fulfilled') {
      setMonth(monthResult.value);
    } else {
      setMonth(null);
      setError(
        monthResult.reason instanceof Error
          ? monthResult.reason.message
          : s.hijri.loadFailed,
      );
    }
    if (settingsResult.status === 'fulfilled' && settingsResult.value) {
      setOffset(settingsResult.value.hijriDayOffset);
    }
    setLoading(false);
  }, [guestMode]);

  useEffect(() => {
    load(year, monthNumber);
  }, [load, year, monthNumber]);

  // Upcoming occasions from the SAME Aladhan month data: scan
  // forward month by month (at most 14) until 1 Ramadan, 1 Shawwal
  // and 10 Dhul-Hijjah are all found. Sequential with early exit,
  // failure-tolerant — if the scan fails, the card simply stays
  // hidden instead of showing invented dates.
  useEffect(() => {
    let active = true;
    (async () => {
      const found: UpcomingOccasion[] = [];
      const has = (key: UpcomingOccasion['key']) => found.some((item) => item.key === key);
      const now = new Date();
      for (let i = 0; i < 14 && found.length < 3; i++) {
        const probe = new Date(now.getFullYear(), now.getMonth() + i, 1);
        let monthData: HijriMonth;
        try {
          monthData = await fetchHijriMonth(probe.getFullYear(), probe.getMonth() + 1);
        } catch {
          break;
        }
        if (!active) return;
        for (const day of monthData.days) {
          const hijriMonth = Number(day.hijri.month.number);
          const hijriDay = Number(day.hijri.day);
          const gregorianLabel = new Date(`${day.gregorian.date}T12:00:00`).toLocaleDateString(
            'en-IN', { day: 'numeric', month: 'short', year: 'numeric' },
          );
          if (hijriMonth === 9 && hijriDay === 1 && !has('ramadan')) {
            found.push({
              key: 'ramadan',
              label: s.hijri.ramadan,
              icon: '🌙',
              hijriLabel: s.hijri.ramadanLabel(day.hijri.year),
              gregorianLabel,
            });
          }
          if (hijriMonth === 10 && hijriDay === 1 && !has('fitr')) {
            found.push({
              key: 'fitr',
              label: s.hijri.fitr,
              icon: '🎉',
              hijriLabel: s.hijri.fitrLabel(day.hijri.year),
              gregorianLabel,
            });
          }
          if (hijriMonth === 12 && hijriDay === 10 && !has('adha')) {
            found.push({
              key: 'adha',
              label: s.hijri.adha,
              icon: '🕋',
              hijriLabel: s.hijri.adhaLabel(day.hijri.year),
              gregorianLabel,
            });
          }
          if (found.length >= 3) break;
        }
      }
      if (active) setOccasions(found);
    })();
    return () => { active = false; };
  }, []);

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
      onNotify(s.hijri.signInAdjustment);
      return;
    }
    const previous = offset;
    setOffset(next);
    try {
      await setHijriOffset(next);
      await load(year, monthNumber);
    } catch (err) {
      // Roll the dropdown back: the saved value did not change.
      setOffset(previous);
      onNotify(err instanceof Error ? err.message : s.hijri.adjustmentFailed);
    }
  }

  // Distinct Ramadan/Eid (and other) markers in the viewed month,
  // from the upstream per-day holiday lists only — nothing invented.
  const monthHolidays = month
    ? [...new Set(month.days.flatMap((day) => day.hijri.holidays))]
    : [];

  const firstDay = month?.days[0]?.gregorian.date ?? '';
  const firstWeekday = firstDay ? new Date(`${firstDay}T12:00:00Z`).getUTCDay() : 0;
  const blanks = Array.from({ length: firstWeekday }, (_, index) => index);

  const todayGregorian = today
    ? new Date(`${today.gregorian.date}T12:00:00`)
    : null;
  const todayGregorianLabel = todayGregorian
    ? todayGregorian.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const todayWeekday = todayGregorian
    ? todayGregorian.toLocaleDateString('en-IN', { weekday: 'long' })
    : '';

  const monthRange = month && month.days.length > 0
    ? (() => {
        const first = new Date(`${month.days[0].gregorian.date}T12:00:00`);
        const last = new Date(`${month.days[month.days.length - 1].gregorian.date}T12:00:00`);
        const firstShort = first.toLocaleDateString('en-IN', { month: 'short' });
        const lastShort = last.toLocaleDateString('en-IN', { month: 'short' });
        return firstShort === lastShort
          ? `${firstShort} ${year}`
          : `${firstShort} – ${lastShort} ${year}`;
      })()
    : '';

  return (
    <section className="sc-hijri">
      <div className="quran-browser-head">
        <div>
          <span className="eyebrow">{s.hijri.eyebrow}</span>
          <h3>{s.hijri.title}</h3>
          {month && <p className="quran-source-line">Source: {month.source}</p>}
        </div>
        <span className="iconbtn"><CalendarDays size={18} /></span>
      </div>

      {error && <p className="form-error">{error}</p>}

      {today && (
        <div className="acard sc-today-card">
          <div className="sc-today-label">{s.hijri.todayLabel}</div>
          <div className="sc-today-date">
            {today.hijri.day} {today.hijri.month.en}
            <br />
            {today.hijri.year} AH
          </div>
          <div className="mut">
            {todayGregorianLabel}
            {todayWeekday ? ` · ${todayWeekday}` : ''}
            {today.hijri.holidays.length > 0 && (
              <> · {today.hijri.holidays.join(', ')}</>
            )}
          </div>
        </div>
      )}

      <div className="acard">
        <div className="hijri-controls">
          <div className="hijri-nav">
            <button className="icon-button" aria-label={s.hijri.prevMonth} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={18} />
            </button>
            <strong>
              {month?.hijriMonths.join(' / ') ?? ''}
            </strong>
            <button className="icon-button" aria-label={s.hijri.nextMonth} onClick={() => shiftMonth(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          {monthRange && <span className="mut" style={{ marginTop: 0 }}>{monthRange}</span>}
        </div>
        <label className="field-label" style={{ marginTop: '10px' }}>
          {s.hijri.adjustmentLabel}
          <select
            className="form-input"
            value={offset}
            onChange={(event) => changeOffset(Number(event.target.value))}
          >
            <option value={-2}>{s.hijri.minusTwo}</option>
            <option value={-1}>{s.hijri.minusOne}</option>
            <option value={0}>{s.hijri.noAdjustment}</option>
            <option value={1}>{s.hijri.plusOne}</option>
            <option value={2}>{s.hijri.plusTwo}</option>
          </select>
        </label>

        {month && (
          <p className="quran-source-line">{month.convention}</p>
        )}
        {month && monthHolidays.length > 0 && (
          <p className="quran-source-line">
            {s.hijri.thisMonth(monthHolidays.join(', '))}
          </p>
        )}

        {loading ? (
          <p className="empty-note">{s.hijri.loading}</p>
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
                <strong>{day.hijri.day}</strong>
                <span>
                  {Number(day.gregorian.date.slice(8, 10))}{' '}
                  {new Date(`${day.gregorian.date}T12:00:00`).toLocaleDateString(
                    'en-IN', { month: 'short' },
                  )}
                </span>
                {day.hijri.holidays.length > 0 && (
                  <small>{day.hijri.holidays.join(', ')}</small>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-note">{s.hijri.noData}</p>
        )}
      </div>

      {occasions && occasions.length > 0 && (
        <div className="acard">
          <h5>{s.hijri.upcoming}</h5>
          {occasions.map((occasion) => (
            <div className="srow" key={occasion.key}>
              <span className="snum2">{occasion.icon}</span>
              <div>
                {occasion.label}
                <small>{occasion.hijriLabel}</small>
              </div>
              <b className="sc-occasion-right">{occasion.gregorianLabel}</b>
            </div>
          ))}
          <p className="mut">
            {s.hijri.occasionsNote}
          </p>
        </div>
      )}
    </section>
  );
}

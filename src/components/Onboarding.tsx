import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Moon } from 'lucide-react';
import type { UserProfile } from '../types/profile';

const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="16" fill="%23d9b36c"/%3E%3Cpath d="M16 45 32 15l16 30h-8l-3.2-7H27.2L24 45h-8Zm14-14-2.8 6h5.6L30 31Z" fill="%23343d35"/%3E%3C/svg%3E';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Props = {
  user: UserProfile;
  onChange: (user: UserProfile) => void;
  onComplete: () => Promise<void>;
};

export default function Onboarding({ user, onChange, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    onChange({ ...user, [field]: value });
    setError('');
  };

  const steps = useMemo(() => [
    { title: 'Personal information', text: 'Your account details are already connected.' },
    { title: 'Education', text: 'Tell us what you are learning.' },
    { title: 'College schedule', text: 'Add the days and hours you are unavailable.' },
    { title: 'Study schedule', text: 'Set a realistic daily learning rhythm.' },
    { title: 'Prayer and sleep', text: 'Personalise your daily worship and rest settings.' },
  ], []);

  function validateCurrentStep() {
    if (step === 1 && (!user.education || !user.course.trim() || !user.semester.trim() || !user.subjects.trim())) {
      return 'Please complete your education details.';
    }
    if (step === 2 && (!user.collegeStart || !user.collegeEnd || user.collegeDays.length === 0)) {
      return 'Add college hours and at least one college day.';
    }
    if (step === 3 && (!user.studyStart || !user.studyEnd || !user.dailyStudyTarget || user.preferredStudyDays.length === 0)) {
      return 'Add study hours, a daily target, and preferred study days.';
    }
    if (step === 4 && !user.city.trim()) return 'Please enter your city.';
    return '';
  }

  function next(e?: FormEvent) {
    e?.preventDefault();
    const validation = validateCurrentStep();
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const validation = validateCurrentStep();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function toggleDay(field: 'collegeDays' | 'weeklyOffDays' | 'preferredStudyDays', day: string) {
    const selected = user[field];
    update(field, selected.includes(day) ? selected.filter((item) => item !== day) : [...selected, day]);
  }

  return (
    <div className="auth-screen onboarding-screen">
      <div className="auth-card onboarding-card" style={{ maxWidth: 620 }}>
        <div className="auth-brand"><img src={logo} alt="AHDORA" /><span>AHDORA</span></div>
        <div className="auth-heading">
          <span className="eyebrow">STEP {step + 1} OF {steps.length}</span>
          <h1>{steps[step].title}</h1>
          <p>{steps[step].text}</p>
        </div>

        <div className="progress-track" aria-label={`Onboarding step ${step + 1} of ${steps.length}`}>
          <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        {step === 0 && (
          <div>
            <label className="field-label">Full name</label>
            <input className="form-input" value={user.name} readOnly />
            <label className="field-label">Email address</label>
            <input className="form-input" value={user.email} readOnly />
            <p className="onboarding-help">These values come from your authenticated account and cannot be changed here.</p>
          </div>
        )}

        {step === 1 && (
          <div>
            <label className="field-label">Education level</label>
            <select className="form-input" value={user.education} onChange={(e) => update('education', e.target.value)}>
              <option value="">Select education level</option>
              <option>School</option><option>Diploma / Polytechnic</option><option>Undergraduate degree</option>
              <option>Postgraduate degree</option><option>Competitive exam preparation</option><option>Other</option>
            </select>
            <label className="field-label">Course / programme</label>
            <input className="form-input" value={user.course} onChange={(e) => update('course', e.target.value)} />
            <label className="field-label">College / institute</label>
            <input className="form-input" value={user.collegeName} onChange={(e) => update('collegeName', e.target.value)} />
            <div className="onboarding-two-col">
              <div><label className="field-label">Class / year</label><input className="form-input" value={user.classYear} onChange={(e) => update('classYear', e.target.value)} /></div>
              <div><label className="field-label">Semester</label><input className="form-input" value={user.semester} onChange={(e) => update('semester', e.target.value)} /></div>
            </div>
            <label className="field-label">Branch</label>
            <input className="form-input" value={user.branch} onChange={(e) => update('branch', e.target.value)} />
            <label className="field-label">Subjects (comma separated)</label>
            <textarea className="form-input onboarding-textarea" value={user.subjects} onChange={(e) => update('subjects', e.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="onboarding-two-col">
              <div><label className="field-label">College starts</label><input className="form-input" type="time" value={user.collegeStart} onChange={(e) => update('collegeStart', e.target.value)} /></div>
              <div><label className="field-label">College ends</label><input className="form-input" type="time" value={user.collegeEnd} onChange={(e) => update('collegeEnd', e.target.value)} /></div>
            </div>
            <label className="field-label">College days</label>
            <DayPicker selected={user.collegeDays} onToggle={(day) => toggleDay('collegeDays', day)} />
            <label className="field-label">Weekly off days</label>
            <DayPicker selected={user.weeklyOffDays} onToggle={(day) => toggleDay('weeklyOffDays', day)} />
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="onboarding-two-col">
              <div><label className="field-label">Study starts</label><input className="form-input" type="time" value={user.studyStart} onChange={(e) => update('studyStart', e.target.value)} /></div>
              <div><label className="field-label">Study ends</label><input className="form-input" type="time" value={user.studyEnd} onChange={(e) => update('studyEnd', e.target.value)} /></div>
            </div>
            <label className="field-label">Daily study target</label>
            <select className="form-input" value={user.dailyStudyTarget} onChange={(e) => update('dailyStudyTarget', e.target.value)}>
              <option value="">Select target</option><option>30 minutes</option><option>1 hour</option><option>2 hours</option><option>3 hours</option><option>4+ hours</option>
            </select>
            <label className="field-label">Preferred study days</label>
            <DayPicker selected={user.preferredStudyDays} onToggle={(day) => toggleDay('preferredStudyDays', day)} />
          </div>
        )}

        {step === 4 && (
          <div>
            <label className="field-label">Your city</label>
            <input className="form-input" value={user.city} onChange={(e) => update('city', e.target.value)} placeholder="e.g. Pune, Maharashtra" />
            <label className="field-label">Prayer time calculation method</label>
            <select className="form-input" value={user.calculationMethod} onChange={(e) => update('calculationMethod', e.target.value)}>
              <option>University of Islamic Sciences, Karachi</option><option>Muslim World League</option><option>Egyptian General Authority</option><option>Umm al-Qura University, Makkah</option><option>ISNA</option>
            </select>
            <label className="field-label">Asr calculation</label>
            <select className="form-input" value={user.asrMethod} onChange={(e) => update('asrMethod', e.target.value)}>
              <option value="Hanafi">Hanafi</option><option value="Shafi">Shafi</option>
            </select>
            <label className="field-label">Preferred bedtime</label>
            <div className="sleep-choice-grid">
              {(['22:00', '23:00'] as const).map((time) => (
                <label className={`sleep-choice ${user.sleepTime === time ? 'selected' : ''}`} key={time}>
                  <input type="radio" name="sleepTime" value={time} checked={user.sleepTime === time} onChange={() => update('sleepTime', time)} />
                  <Moon size={20} /><strong>{time === '22:00' ? '10:00 PM' : '11:00 PM'}</strong><span>Sleep time</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p style={{ color: '#c45b52', fontSize: 13, marginTop: 12 }}>{error}</p>}
        <form onSubmit={step === steps.length - 1 ? submit : next} className="onboarding-actions">
          {step > 0 && <button type="button" className="outline-button" onClick={() => { setStep((current) => current - 1); setError(''); }}><ArrowLeft size={15} /> Back</button>}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Saving profile...' : step === steps.length - 1 ? 'Complete setup' : 'Continue'} <ArrowRight size={16} />
          </button>
        </form>
        <p className="onboarding-help">Your profile is saved to your private AHDORA account.</p>
      </div>
    </div>
  );
}

function DayPicker({ selected, onToggle }: { selected: string[]; onToggle: (day: string) => void }) {
  return (
    <div className="day-picker">
      {days.map((day) => <button type="button" key={day} className={selected.includes(day) ? 'selected' : ''} onClick={() => onToggle(day)}>{day.slice(0, 3)}</button>)}
    </div>
  );
}

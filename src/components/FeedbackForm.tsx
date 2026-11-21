import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../lib/http.js';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';

/**
 * Feedback & complaint form (Profile → Help & support, footer).
 *
 * Saves to the backend (POST /api/feedback — backend track) and confirms
 * in Hinglish. Nothing is faked: if the endpoint is missing or the save
 * fails, the user sees the real error instead of a success message.
 *
 * Assumed endpoint contract (see report if the backend track has not
 * shipped it yet):
 *   POST /api/feedback
 *   Body: { "type": "feedback" | "complaint", "subject": string, "message": string }
 *   Success: 201 { "message": string, "feedback": { "id": string, "type": string,
 *     "subject": string, "message": string, "status": string, "createdAt": string } }
 *   Auth: signed-in session (cookie); per-user — a user only ever sees
 *   their own submissions.
 */

export type FeedbackType = 'feedback' | 'complaint';

async function submitFeedback(input: {
  type: FeedbackType;
  subject: string;
  message: string;
}, fallback: string): Promise<void> {
  const response = await apiFetch('/api/feedback', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : fallback,
    );
  }
}

export default function FeedbackForm({
  onClose,
  onNotify,
  language,
}: {
  onClose: () => void;
  onNotify: (message: string) => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
  const [type, setType] = useState<FeedbackType>('feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!subject.trim() || !message.trim()) {
      setError(s.feedback.bothRequired);
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 3) {
      setError(s.feedback.tooShort);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await submitFeedback({ type, subject: subject.trim(), message: message.trim() }, s.feedback.saveFailedRetry);
      setSent(true);
      onNotify(type === 'complaint' ? s.feedback.complaintThanks : s.feedback.feedbackThanks);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.feedback.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">{s.feedback.eyebrow}</span>
            <h3>{s.feedback.title}</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={s.feedback.closeAria}>
            <X size={18} />
          </button>
        </div>
        {sent ? (
          <>
            <p className="onboarding-help" style={{ fontSize: 14, lineHeight: 1.6 }}>
              {type === 'complaint' ? s.feedback.complaintThanks : s.feedback.feedbackThanks}
            </p>
            <button className="primary-button full-width" type="button" onClick={onClose}>
              {s.feedback.okay}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="field-label">{s.feedback.aboutLabel}</label>
            <div className="timer-presets" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={type === 'feedback' ? 'preset-selected' : ''}
                onClick={() => setType('feedback')}
              >
                {s.feedback.feedbackType}
              </button>
              <button
                type="button"
                className={type === 'complaint' ? 'preset-selected' : ''}
                onClick={() => setType('complaint')}
              >
                {s.feedback.complaintType}
              </button>
            </div>
            <label className="field-label">{s.feedback.subject}</label>
            <input
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={type === 'complaint' ? s.feedback.subjectComplaintPlaceholder : s.feedback.subjectFeedbackPlaceholder}
              maxLength={140}
            />
            <label className="field-label">{s.feedback.message}</label>
            <textarea
              className="form-input form-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={s.feedback.messagePlaceholder}
              rows={5}
              maxLength={2000}
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            <button className="primary-button full-width" type="submit" disabled={busy} style={{ marginTop: 12 }}>
              {busy ? s.feedback.sending : s.feedback.send}
            </button>
            <p className="modal-note">
              {s.feedback.privateNote}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

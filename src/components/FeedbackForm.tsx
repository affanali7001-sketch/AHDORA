import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../lib/http.js';

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
}): Promise<void> {
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
        : 'Feedback save nahi ho paya. Dobara try karo.',
    );
  }
}

export default function FeedbackForm({
  onClose,
  onNotify,
}: {
  onClose: () => void;
  onNotify: (message: string) => void;
}) {
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
      setError('Subject aur message dono likhna zaroori hai.');
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 3) {
      setError('Subject aur message kam se kam 3 characters ke hone chahiye.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await submitFeedback({ type, subject: subject.trim(), message: message.trim() });
      setSent(true);
      onNotify(
        type === 'complaint'
          ? 'Shukriya! Aapki shikayat mil gayi, hum jald dekhenge.'
          : 'Shukriya! Aapka feedback mil gaya.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Feedback save nahi ho paya.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">HELP & SUPPORT</span>
            <h3>Feedback ya shikayat bhejo</h3>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close feedback form">
            <X size={18} />
          </button>
        </div>
        {sent ? (
          <>
            <p className="onboarding-help" style={{ fontSize: 14, lineHeight: 1.6 }}>
              {type === 'complaint'
                ? 'Shukriya! Aapki shikayat mil gayi, hum jald dekhenge.'
                : 'Shukriya! Aapka feedback mil gaya.'}
            </p>
            <button className="primary-button full-width" type="button" onClick={onClose}>
              Theek hai
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="field-label">Kis baare me hai?</label>
            <div className="timer-presets" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className={type === 'feedback' ? 'preset-selected' : ''}
                onClick={() => setType('feedback')}
              >
                Feedback
              </button>
              <button
                type="button"
                className={type === 'complaint' ? 'preset-selected' : ''}
                onClick={() => setType('complaint')}
              >
                Shikayat
              </button>
            </div>
            <label className="field-label">Subject</label>
            <input
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={type === 'complaint' ? 'e.g. Namaz ka time galat dikh raha hai' : 'e.g. App me ye feature chahiye'}
              maxLength={140}
            />
            <label className="field-label">Message</label>
            <textarea
              className="form-input form-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Detail me likho — kya hua, kab hua, kya expect kar rahe the?"
              rows={5}
              maxLength={2000}
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
            <button className="primary-button full-width" type="submit" disabled={busy} style={{ marginTop: 12 }}>
              {busy ? 'Bhej rahe hain…' : 'Bhejo'}
            </button>
            <p className="modal-note">
              Ye sirf aapke account se juda hoga — koi aur user ise nahi dekh sakta.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

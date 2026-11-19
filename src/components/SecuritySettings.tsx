import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/http.js';

/**
 * Privacy & security panel (Profile → Privacy & security).
 *
 * Change password, active sessions (list + revoke), data export, and
 * account deletion. Deletion is explicit: it lists the consequences
 * upfront, needs the password AND a confirm checkbox, and the backend
 * deletes the user and every record that belongs to them.
 */

type SessionRow = {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed. Please try again.');
  }
  return data as T;
}

export default function SecuritySettings({
  onNotify,
  emailVerified,
  onAccountDeleted,
}: {
  onNotify: (message: string) => void;
  emailVerified: boolean;
  onAccountDeleted: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsError, setSessionsError] = useState('');

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function loadSessions() {
    try {
      const data = await request<{ sessions: SessionRow[] }>('/api/auth/sessions');
      setSessions(data.sessions);
      setSessionsError('');
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : 'Sessions could not be loaded.');
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordMessage('');
    if (newPassword.length < 12) {
      setPasswordMessage('New password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      await request<{ changed: boolean }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordMessage('Password changed. All other sessions were signed out.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await loadSessions();
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : 'Password could not be changed.');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleRevokeSession(id: string) {
    try {
      await request<null>(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      onNotify('Session revoked.');
      await loadSessions();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Session could not be revoked.');
    }
  }

  async function handleExport() {
    try {
      const response = await apiFetch('/api/auth/export');
      if (!response.ok) throw new Error('Export failed. Please try again.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ahdora-export.json';
      link.click();
      URL.revokeObjectURL(url);
      onNotify('Your data export was downloaded.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Export failed. Please try again.');
    }
  }

  async function handleResendVerification() {
    try {
      const result = await request<{ sent?: boolean; alreadyVerified?: boolean }>('/api/auth/verify-email', {
        method: 'POST',
      });
      onNotify(result.alreadyVerified ? 'Your email is already verified.' : 'Verification email sent. Check your inbox.');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Could not send the verification email.');
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    if (!deleteConfirmed) {
      setDeleteError('Tick the confirmation box first.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Enter your password to confirm deletion.');
      return;
    }
    setDeleteBusy(true);
    try {
      await request<null>('/api/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      onAccountDeleted();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Account could not be deleted.');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="security-settings">
      <p className="onboarding-help">
        Email: {emailVerified ? 'verified' : 'not verified yet.'}
        {!emailVerified && (
          <>
            {' '}
            <button type="button" className="text-button" onClick={handleResendVerification}>
              Resend verification email
            </button>
          </>
        )}
      </p>

      <h4>Change password</h4>
      <form onSubmit={handleChangePassword}>
        <label className="field-label">Current password</label>
        <input
          className="form-input"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <label className="field-label">New password</label>
        <input
          className="form-input"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Minimum 12 characters"
          autoComplete="new-password"
          required
        />
        <label className="field-label">Confirm new password</label>
        <input
          className="form-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        {passwordMessage && <p className="onboarding-help">{passwordMessage}</p>}
        <button type="submit" className="primary-button" disabled={passwordBusy}>
          {passwordBusy ? 'Please wait...' : 'Change password'}
        </button>
      </form>

      <h4>Active sessions</h4>
      {sessionsError ? (
        <p className="onboarding-help">{sessionsError}</p>
      ) : sessions.length === 0 ? (
        <p className="onboarding-help">No active sessions found.</p>
      ) : (
        <div className="session-list">
          {sessions.map((session) => (
            <div key={session.id} className="session-row">
              <div>
                <strong>{session.current ? 'This device' : 'Other device'}</strong>
                <small>{session.userAgent ?? 'Unknown browser'}</small>
                <small>
                  Signed in {new Date(session.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' · '}expires {new Date(session.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </small>
              </div>
              {!session.current && (
                <button type="button" className="outline-button" onClick={() => void handleRevokeSession(session.id)}>
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <h4>Your data</h4>
      <p className="onboarding-help">Download a JSON copy of everything stored under your account (no passwords or session tokens included).</p>
      <button type="button" className="outline-button" onClick={() => void handleExport()}>
        Download my data
      </button>

      <h4 className="danger-text">Delete account</h4>
      <p className="onboarding-help">
        This permanently deletes your account and ALL of its data: profile, Salah records, study subjects/tasks/sessions,
        challenges and their progress, friends and requests, points and badges, notifications, and Quran bookmarks/history.
        Challenges you created stay only when other people still take part in them. This cannot be undone.
      </p>
      <label className="field-label">Your password</label>
      <input
        className="form-input"
        type="password"
        value={deletePassword}
        onChange={(e) => setDeletePassword(e.target.value)}
        autoComplete="current-password"
        placeholder="Enter your password to confirm"
      />
      <label className="check-row">
        <input
          type="checkbox"
          checked={deleteConfirmed}
          onChange={(e) => setDeleteConfirmed(e.target.checked)}
        />
        <span>I understand this deletes everything permanently.</span>
      </label>
      {deleteError && <p className="danger-text">{deleteError}</p>}
      <button
        type="button"
        className="outline-button danger-button"
        disabled={deleteBusy || !deleteConfirmed}
        onClick={() => void handleDeleteAccount()}
      >
        {deleteBusy ? 'Deleting...' : 'Delete my account permanently'}
      </button>
    </div>
  );
}

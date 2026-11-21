import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/http.js';
import PasswordField from './PasswordField.js';
import type { AppLanguage } from '../lib/language';
import { stringsFor } from '../lib/strings';

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
  language,
}: {
  onNotify: (message: string) => void;
  emailVerified: boolean;
  onAccountDeleted: () => void;
  language: AppLanguage;
}) {
  const s = stringsFor(language);
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
      setSessionsError(error instanceof Error ? error.message : s.security.sessionsFailed);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordMessage('');
    if (newPassword.length < 12) {
      setPasswordMessage(s.security.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(s.security.passwordsMismatch);
      return;
    }
    setPasswordBusy(true);
    try {
      await request<{ changed: boolean }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordMessage(s.security.passwordChanged);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await loadSessions();
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : s.security.passwordChangeFailed);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleRevokeSession(id: string) {
    try {
      await request<null>(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      onNotify(s.security.sessionRevoked);
      await loadSessions();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.security.sessionRevokeFailed);
    }
  }

  async function handleExport() {
    try {
      const response = await apiFetch('/api/auth/export');
      if (!response.ok) throw new Error(s.security.exportFailed);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ahdora-export.json';
      link.click();
      URL.revokeObjectURL(url);
      onNotify(s.security.exportDownloaded);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.security.exportFailed);
    }
  }

  async function handleResendVerification() {
    try {
      const result = await request<{ sent?: boolean; alreadyVerified?: boolean }>('/api/auth/verify-email', {
        method: 'POST',
      });
      onNotify(result.alreadyVerified ? s.security.emailAlreadyVerified : s.security.verificationEmailSent);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : s.security.verificationEmailFailed);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    if (!deleteConfirmed) {
      setDeleteError(s.security.deleteNeedsConfirm);
      return;
    }
    if (!deletePassword) {
      setDeleteError(s.security.deleteNeedsPassword);
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
      setDeleteError(error instanceof Error ? error.message : s.security.deleteFailed);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="security-settings">
      <p className="onboarding-help">
        Email: {emailVerified ? s.security.emailVerified : s.security.emailNotVerified}
        {!emailVerified && (
          <>
            {' '}
            <button type="button" className="text-button" onClick={handleResendVerification}>
              {s.security.resendVerification}
            </button>
          </>
        )}
      </p>

      <h4>{s.security.changePassword}</h4>
      <form onSubmit={handleChangePassword}>
        <label className="field-label">{s.security.currentPassword}</label>
        <PasswordField
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
          required
        />
        <label className="field-label">{s.security.newPassword}</label>
        <PasswordField
          value={newPassword}
          onChange={setNewPassword}
          placeholder={s.security.newPasswordPlaceholder}
          autoComplete="new-password"
          required
        />
        <label className="field-label">{s.security.confirmNewPassword}</label>
        <PasswordField
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          required
        />
        {passwordMessage && <p className="onboarding-help">{passwordMessage}</p>}
        <button type="submit" className="primary-button" disabled={passwordBusy}>
          {passwordBusy ? s.security.pleaseWait : s.security.changePasswordButton}
        </button>
      </form>

      <h4>{s.security.activeSessions}</h4>
      {sessionsError ? (
        <p className="onboarding-help">{sessionsError}</p>
      ) : sessions.length === 0 ? (
        <p className="onboarding-help">{s.security.noSessions}</p>
      ) : (
        <div className="session-list">
          {sessions.map((session) => (
            <div key={session.id} className="session-row">
              <div>
                <strong>{session.current ? s.security.thisDevice : s.security.otherDevice}</strong>
                <small>{session.userAgent ?? s.security.unknownBrowser}</small>
                <small>
                  {s.security.sessionDates(
                    new Date(session.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                    new Date(session.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                  )}
                </small>
              </div>
              {!session.current && (
                <button type="button" className="outline-button" onClick={() => void handleRevokeSession(session.id)}>
                  {s.security.revoke}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <h4>{s.security.yourData}</h4>
      <p className="onboarding-help">{s.security.exportText}</p>
      <button type="button" className="outline-button" onClick={() => void handleExport()}>
        {s.security.downloadData}
      </button>

      <h4 className="danger-text">{s.security.deleteAccount}</h4>
      <p className="onboarding-help">
        {s.security.deleteText}
      </p>
      <label className="field-label">{s.security.yourPassword}</label>
      <PasswordField
        value={deletePassword}
        onChange={setDeletePassword}
        autoComplete="current-password"
        placeholder={s.security.deletePasswordPlaceholder}
      />
      <label className="check-row">
        <input
          type="checkbox"
          checked={deleteConfirmed}
          onChange={(e) => setDeleteConfirmed(e.target.checked)}
        />
        <span>{s.security.deleteConsent}</span>
      </label>
      {deleteError && <p className="danger-text">{deleteError}</p>}
      <button
        type="button"
        className="outline-button danger-button"
        disabled={deleteBusy || !deleteConfirmed}
        onClick={() => void handleDeleteAccount()}
      >
        {deleteBusy ? s.security.deleting : s.security.deleteButton}
      </button>
    </div>
  );
}

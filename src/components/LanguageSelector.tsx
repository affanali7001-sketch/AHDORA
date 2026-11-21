import { useState } from 'react';
import { Check, Globe } from 'lucide-react';
import AhdoraLogo from './AhdoraLogo';
import {
  LANGUAGE_SCREEN,
  pickText,
  type AppLanguage,
} from '../lib/language';

/**
 * First-open language screen (preview section #language).
 * Shown only when no language choice is stored yet; after choosing,
 * the parent stores the choice and moves on. Default selection is
 * Hinglish, matching the preview.
 */
export default function LanguageSelector({
  onConfirm,
}: {
  onConfirm: (language: AppLanguage) => void;
}) {
  const [selected, setSelected] = useState<AppLanguage>('hi');
  const title = pickText(LANGUAGE_SCREEN.title, selected);

  const options: { id: AppLanguage; name: string; detail: string }[] = [
    { id: 'en', name: LANGUAGE_SCREEN.english.name, detail: LANGUAGE_SCREEN.english.detail },
    { id: 'hi', name: LANGUAGE_SCREEN.hinglish.name, detail: LANGUAGE_SCREEN.hinglish.detail },
  ];

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <AhdoraLogo size={42} />
          <span>AHDORA</span>
        </div>

        <div style={{ textAlign: 'center', paddingTop: 18 }}>
          <Globe size={52} strokeWidth={1.6} style={{ color: 'var(--teal-600)' }} aria-hidden="true" />
          <div className="auth-heading" style={{ margin: '14px 0 0' }}>
            <h1 style={{ margin: '8px 0 0' }}>{title.primary}</h1>
            <p className="bilingual-secondary bilingual-secondary-large">{title.secondary}</p>
            <p style={{ marginTop: 10 }}>{LANGUAGE_SCREEN.description}</p>
          </div>
        </div>

        <div className="lang-options" role="radiogroup" aria-label="Language">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected === option.id}
              className={`lang-option ${selected === option.id ? 'selected' : ''}`}
              onClick={() => setSelected(option.id)}
            >
              <span className={`lang-tick ${selected === option.id ? 'on' : ''}`} aria-hidden="true">
                {selected === option.id && <Check size={13} strokeWidth={3} />}
              </span>
              <span>
                <b>{option.name}</b>
                <small>{option.detail}</small>
              </span>
            </button>
          ))}
        </div>

        <p className="lang-status" aria-live="polite">
          {LANGUAGE_SCREEN.status[selected]}
        </p>

        <button
          type="button"
          className="primary-button full-width"
          style={{ marginTop: 18 }}
          onClick={() => onConfirm(selected)}
        >
          {LANGUAGE_SCREEN.continueLabel}
        </button>

        <div className="auth-notice">
          <Globe size={15} />
          <span>{LANGUAGE_SCREEN.note}</span>
        </div>
      </div>

      <div className="auth-bottom">AHDORA <span>·</span> Deen, Ilm &amp; Discipline</div>
    </div>
  );
}

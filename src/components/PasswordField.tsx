import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password input with a show/hide eye toggle, so the user can see what
 * they typed. Inline styles only — the premium theme in styles.css is
 * owned by a later phase, so no new classes are introduced here.
 */
export default function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        className="form-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        style={{ paddingRight: 42 }}
      />
      <button
        type="button"
        aria-label={show ? 'Password chhupao' : 'Password dikhao'}
        title={show ? 'Password chhupao' : 'Password dikhao'}
        onClick={() => setShow((current) => !current)}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 0,
          padding: 4,
          cursor: 'pointer',
          color: 'inherit',
          opacity: 0.75,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

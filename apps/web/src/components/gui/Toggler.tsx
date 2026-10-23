'use client';

import './Toggler.scss';

interface TogglerProps {
  checked?: boolean;
  disabled?: boolean;
  label?: string;
  onChange?: () => void;
  title?: string;
}

// A switch: a hidden checkbox and the <i> track (web/src/components/Gui/Forms/Toggler).
export function Toggler({ checked = false, disabled, label, onChange, title }: TogglerProps) {
  return (
    <label className="toggler" title={title}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onChange?.()} />
      <i />
      {label ? <span className="toggler__label">{label}</span> : null}
    </label>
  );
}

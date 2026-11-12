import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { money, moneyInputValue, parseMoneyInput, type Pence } from './money';

/** A money figure with tabular numbers and a screen-reader friendly label. */
export function Amount({ p, pennies, className = '', label }: { p: Pence; pennies?: boolean; className?: string; label?: string }) {
  const text = money(p, { pennies });
  return (
    <span className={`amount ${className}`} aria-label={label ? `${label}: ${text}` : undefined}>
      {text}
    </span>
  );
}

export function MoneyField({ label, value, onChange, hint, autoFocus, big, id: idProp, invalid }: { label: string; value: Pence | null; onChange: (p: Pence | null) => void; hint?: string; autoFocus?: boolean; big?: boolean; id?: string; invalid?: boolean }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [text, setText] = useState(moneyInputValue(value));
  const [bad, setBad] = useState(false);
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      if (parseMoneyInput(text) !== value) setText(moneyInputValue(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`field ${big ? 'field-big' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {hint && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      <div className="money-input">
        <span aria-hidden="true">£</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={bad || invalid || undefined}
          value={text}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const p = parseMoneyInput(t);
            const isBad = t.trim() !== '' && p === null;
            setBad(isBad);
            last.current = p;
            if (!isBad) onChange(p);
          }}
        />
      </div>
      {bad && <p className="error" role="alert">Use numbers only, like 25 or 25.50</p>}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, autoFocus }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function DateField({ label, value, onChange, hint, min }: { label: string; value: string | null; onChange: (s: string | null) => void; hint?: string; min?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p className="hint">{hint}</p>}
      <input id={id} type="date" value={value ?? ''} min={min} onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}

export function Choice<T extends string>({ legend, options, value, onChange }: { legend: string; options: { value: T; label: string; hint?: string }[]; value: T | null; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="choices">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={`choice ${value === o.value ? 'is-on' : ''}`}>
          <input type="radio" name={name} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            <strong>{o.label}</strong>
            {o.hint && <small>{o.hint}</small>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (b: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <label htmlFor={id}>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </label>
      <button id={id} type="button" role="switch" aria-checked={checked} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch-knob" aria-hidden="true" />
        <span className="switch-text">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

export function Modal({ title, onClose, children, labelledBy }: { title: string; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('h2')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id} ref={ref}>
        <h2 id={id} tabIndex={-1}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${pct}%`}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

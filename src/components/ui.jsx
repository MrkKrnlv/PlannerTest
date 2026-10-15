import { useEffect, useRef } from 'react';
import { IconClose } from './Icons.jsx';

export function Segmented({ value, onChange, options, label, size }) {
  return (
    <div className={`segmented ${size === 's' ? 'segmented-s' : ''}`} role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Meter({ label, value, max, text, tone }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  const over = value > max;
  return (
    <div className="meter" data-over={over || undefined} data-tone={tone}>
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-text">{text}</span>
      </div>
      <div className="meter-track">
        <span className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Модальное окно на <dialog>: снизу на телефоне, по центру на десктопе */
export function Sheet({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            <h2 className="sheet-title">{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
              <IconClose />
            </button>
          </div>
          {children}
          {footer && <div className="sheet-actions">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export const Dot = ({ color }) => <span className="dot" data-color={color || undefined} aria-hidden="true" />;

export function Scale({ value, onChange, label, low, high }) {
  return (
    <div className="scale" role="radiogroup" aria-label={label}>
      <span className="scale-label">{label}</span>
      <div className="scale-dots">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label}: ${n} из 5`}
            data-on={value >= n || undefined}
            onClick={() => onChange(value === n ? null : n)}
          />
        ))}
      </div>
      <span className="scale-ends muted small">{value ? `${value}/5` : `${low} — ${high}`}</span>
    </div>
  );
}

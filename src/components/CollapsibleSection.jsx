import { useState } from 'react'

// Wraps a form section in collapsible chrome: a clickable header bar (key chip +
// title + chevron) that toggles visibility of the body. Defaults to expanded.
// The header `key`/`title`/`hint` are passed as props; the section body is
// rendered as children. Centralizing this keeps collapse behavior identical
// across every section.
export default function CollapsibleSection({ keyLabel, title, hint, children }) {
  const [open, setOpen] = useState(true)

  return (
    <section className={`field${open ? '' : ' field--collapsed'}`}>
      <button
        type="button"
        className="field__bar"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="field__headings">
          <span className="field__key">{keyLabel}</span>
          <span className="field__title">{title}</span>
        </span>
        <svg
          className="field__chev"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="field__body">
          {hint && <p className="field__hint">{hint}</p>}
          {children}
        </div>
      )}
    </section>
  )
}

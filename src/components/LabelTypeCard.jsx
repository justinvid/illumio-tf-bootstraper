import { useState } from 'react'
import { BUILTIN_LABEL_KEYS } from '../lib/hcl.js'

// A single committed label type (dimension) with view and in-place edit modes.
// Edits flow straight to the parent via onChange, keeping the stable `id` — and
// therefore the Terraform resource address and PCE HREF — untouched.
export default function LabelTypeCard({ item, keyTaken, onChange, onRemove }) {
  const [editing, setEditing] = useState(false)

  function setField(field, value) {
    onChange({ ...item, [field]: value })
  }

  const trimmedKey = item.key.trim()
  const duplicate = trimmedKey && keyTaken(trimmedKey, item.id)
  const builtin = BUILTIN_LABEL_KEYS.includes(trimmedKey.toLowerCase())

  if (!editing) {
    return (
      <li className="iplist">
        <div className="iplist__head">
          <div className="iplist__ident">
            <span className="iplist__name">{item.displayName || <em>(no display name)</em>}</span>
            <span className="iplist__addr">illumio-core_label_type.{item.id}</span>
          </div>
          <div className="iplist__actions">
            <button className="iplist__edit" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="chip__remove"
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${item.displayName}`}
            >
              ×
            </button>
          </div>
        </div>
        <div className="wl-meta">
          <span className="wl-tag">key · {item.key}</span>
        </div>
      </li>
    )
  }

  return (
    <li className="iplist iplist--editing">
      <div className="iplist__head">
        <input
          className="field__input"
          type="text"
          value={item.displayName}
          onChange={(e) => setField('displayName', e.target.value)}
          placeholder="Display name — e.g. Tier"
          autoComplete="off"
          spellCheck="false"
          aria-label="Display name"
        />
        <button className="iplist__edit" type="button" onClick={() => setEditing(false)}>
          Done
        </button>
      </div>

      <span className="iplist__addr iplist__addr--edit">
        illumio-core_label_type.{item.id} · address stays fixed while editing
      </span>

      <div className="wl-fields">
        <input
          className="field__input"
          type="text"
          value={item.key}
          onChange={(e) => setField('key', e.target.value)}
          placeholder="Key — e.g. tier"
          autoComplete="off"
          spellCheck="false"
          aria-label="Label key"
        />
      </div>

      {duplicate && (
        <p className="field__error">Another label type already uses the key “{trimmedKey}”.</p>
      )}
      {builtin && (
        <p className="field__hint">
          “{trimmedKey}” is a built-in dimension — it already exists in every PCE and can’t be
          created.
        </p>
      )}
    </li>
  )
}

import { useState } from 'react'

// A single label (key + value) with view and in-place edit modes. Editing the
// key or value keeps the stable `id` — and therefore the Terraform resource
// address and PCE HREF — untouched. Click to edit; Enter saves, Esc cancels.
export default function LabelChip({ item, keyOptions, pairTaken, onChange, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draftKey, setDraftKey] = useState(item.key)
  const [draftValue, setDraftValue] = useState(item.value)
  const [error, setError] = useState('')

  function startEdit() {
    setDraftKey(item.key)
    setDraftValue(item.value)
    setError('')
    setEditing(true)
  }

  function commit() {
    const nextValue = draftValue.trim()
    if (!nextValue) {
      setError('Value required')
      return
    }
    if (pairTaken(draftKey, nextValue, item.id)) {
      setError('Already exists')
      return
    }
    onChange({ ...item, key: draftKey, value: nextValue })
    setError('')
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
    setError('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (editing) {
    // Include the current key even if it's a dimension no longer in the options,
    // so editing never silently drops it.
    const options = keyOptions.some((o) => o.key === draftKey)
      ? keyOptions
      : [{ key: draftKey, label: draftKey }, ...keyOptions]

    return (
      <li className={`chip chip--editing${error ? ' chip--error' : ''}`}>
        <div className="chip__editrow">
          <select
            className="chip__select"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            aria-label="Label dimension"
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.key}
              </option>
            ))}
          </select>
          <input
            className="chip__input"
            value={draftValue}
            autoFocus
            onChange={(e) => {
              setDraftValue(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
            aria-label="Label value"
          />
          <button className="chip__icon" type="button" onClick={commit} aria-label="Save">
            ✓
          </button>
          <button className="chip__icon" type="button" onClick={cancel} aria-label="Cancel">
            ×
          </button>
        </div>
        <span className="chip__addr">illumio-core_label.{item.id}</span>
        {error && <span className="chip__err">{error}</span>}
      </li>
    )
  }

  return (
    <li className="chip" title={`illumio-core_label.${item.id}`}>
      <button className="chip__value chip__value--pair" type="button" onClick={startEdit}>
        <span className="chip__key">{item.key}</span>
        {item.value}
      </button>
      <button
        className="chip__remove"
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.key} ${item.value}`}
      >
        ×
      </button>
    </li>
  )
}

import { useState } from 'react'
import CollapsibleSection from './CollapsibleSection.jsx'
import LabelTypeCard from './LabelTypeCard.jsx'
import { BUILTIN_LABEL_KEYS, uniqueId } from '../lib/hcl.js'

// Collects custom label types (dimensions) — each a key plus a display name —
// into a list. New types are entered in a draft and committed; committed types
// are edited in place via LabelTypeCard, preserving their stable id.
// Lifts the items to the parent via `items` / `onChange`.
export default function LabelTypeInput({ items, onChange }) {
  const [key, setKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  function addType() {
    const nextKey = key.trim()
    const nextName = displayName.trim()
    if (!nextKey || !nextName) return

    if (keyTaken(nextKey)) {
      setError(`A label type with key "${nextKey}" already exists.`)
      return
    }

    const id = uniqueId(nextKey, items.map((it) => it.id).filter(Boolean))
    onChange([...items, { id, key: nextKey, displayName: nextName }])
    setKey('')
    setDisplayName('')
    setError('')
  }

  function updateItem(index, updated) {
    onChange(items.map((it, i) => (i === index ? updated : it)))
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  // True if some type (other than exceptId) already uses this key.
  function keyTaken(candidate, exceptId) {
    const lower = candidate.toLowerCase()
    return items.some((it) => it.id !== exceptId && it.key.trim().toLowerCase() === lower)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addType()
    }
  }

  const builtinWarning = BUILTIN_LABEL_KEYS.includes(key.trim().toLowerCase())

  return (
    <CollapsibleSection
      keyLabel="illumio-core_label_type"
      title="Label Types"
      hint={
        <>
          Custom label dimensions. The four built-ins (<code>role</code>, <code>app</code>,{' '}
          <code>env</code>, <code>loc</code>) already exist — define only your own here.
        </>
      }
    >
      <div className="field__entry field__entry--col">
        <input
          className="field__input"
          type="text"
          placeholder="Key — e.g. tier"
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
          aria-label="Label key"
        />
        <div className="field__row">
          <input
            className="field__input"
            type="text"
            placeholder="Display name — e.g. Tier"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
            aria-label="Display name"
          />
          <button
            className="field__add"
            type="button"
            onClick={addType}
            disabled={!key.trim() || !displayName.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {error && <p className="field__error">{error}</p>}
      {!error && builtinWarning && (
        <p className="field__hint">
          “{key.trim()}” is a built-in dimension — creating it as a label type will conflict with
          the PCE.
        </p>
      )}

      {items.length > 0 ? (
        <ul className="iplists">
          {items.map((item, index) => (
            <LabelTypeCard
              key={item.id}
              item={item}
              keyTaken={keyTaken}
              onChange={(updated) => updateItem(index, updated)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ul>
      ) : (
        <p className="field__empty">No custom label types yet.</p>
      )}
    </CollapsibleSection>
  )
}

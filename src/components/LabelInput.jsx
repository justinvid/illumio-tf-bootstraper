import { useMemo, useState } from 'react'
import CollapsibleSection from './CollapsibleSection.jsx'
import LabelChip from './LabelChip.jsx'
import { BUILTIN_LABEL_TYPES, ENV_LABEL_KEY, uniqueId } from '../lib/hcl.js'

// Builds the selectable dimension options: the four built-ins first, then any
// custom label types defined elsewhere (de-duped by key).
function buildKeyOptions(labelTypes) {
  const options = BUILTIN_LABEL_TYPES.map((t) => ({ key: t.key, label: `${t.display} (${t.key})` }))
  const seen = new Set(BUILTIN_LABEL_TYPES.map((t) => t.key))
  for (const t of labelTypes) {
    const key = t.key.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    options.push({ key, label: `${t.displayName.trim() || key} (${key})` })
  }
  return options
}

// Collects labels — each a dimension key plus a value — as { id, key, value }
// items. Each becomes an illumio-core_label resource; the stable id is the
// Terraform local name, so editing key/value is an in-place update (HREF kept).
// Lifts the items to the parent via `items` / `onChange`.
export default function LabelInput({ items, labelTypes, onChange }) {
  const [draftKey, setDraftKey] = useState(ENV_LABEL_KEY)
  const [draftValue, setDraftValue] = useState('')
  const [error, setError] = useState('')

  const keyOptions = useMemo(() => buildKeyOptions(labelTypes), [labelTypes])

  function addLabel() {
    const value = draftValue.trim()
    if (!value) return

    if (pairTaken(draftKey, value)) {
      setError(`"${draftKey}: ${value}" is already in the list.`)
      return
    }

    const id = uniqueId(
      `${draftKey}_${value}`,
      items.map((it) => it.id).filter(Boolean),
    )
    onChange([...items, { id, key: draftKey, value }])
    setDraftValue('')
    setError('')
  }

  function updateItem(index, updated) {
    onChange(items.map((it, i) => (i === index ? updated : it)))
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  // True if some item (other than exceptId) already uses this key+value pair.
  function pairTaken(key, value, exceptId) {
    const k = key.toLowerCase()
    const v = value.toLowerCase()
    return items.some(
      (it) => it.id !== exceptId && it.key.toLowerCase() === k && it.value.trim().toLowerCase() === v,
    )
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addLabel()
    }
  }

  return (
    <CollapsibleSection
      keyLabel="illumio-core_label"
      title="Labels"
      hint={
        <>
          A dimension and a value (e.g. <code>env: PROD</code>). Pick a built-in dimension or one of
          your custom label types. Click a label to edit it.
        </>
      }
    >
      <div className="field__entry">
        <select
          className="field__select"
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
          aria-label="Label dimension"
        >
          {keyOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          className="field__input"
          type="text"
          placeholder="Value — e.g. PROD, web, US"
          value={draftValue}
          onChange={(e) => {
            setDraftValue(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
          aria-label="Label value"
        />
        <button className="field__add" type="button" onClick={addLabel} disabled={!draftValue.trim()}>
          Add
        </button>
      </div>

      {error && <p className="field__error">{error}</p>}

      {items.length > 0 ? (
        <ul className="chips">
          {items.map((item, index) => (
            <LabelChip
              key={item.id}
              item={item}
              keyOptions={keyOptions}
              pairTaken={pairTaken}
              onChange={(updated) => updateItem(index, updated)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ul>
      ) : (
        <p className="field__empty">No labels yet.</p>
      )}
    </CollapsibleSection>
  )
}

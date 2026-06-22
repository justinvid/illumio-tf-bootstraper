import { useState } from 'react'
import CollapsibleSection from './CollapsibleSection.jsx'
import IpListCard from './IpListCard.jsx'
import { uniqueId } from '../lib/hcl.js'

// Collects IP Lists — each a name plus one or more CIDR blocks / address ranges —
// into a list. New lists are staged in a draft before being committed; committed
// lists are edited in place via IpListCard, preserving their stable id.
// Lifts the committed items to the parent via `items` / `onChange`.
export default function IpListInput({ items, onChange }) {
  const [name, setName] = useState('')
  const [rangeDraft, setRangeDraft] = useState('')
  const [ranges, setRanges] = useState([])
  const [error, setError] = useState('')

  function addRange() {
    const next = rangeDraft.trim()
    if (!next) return
    if (ranges.some((r) => r.toLowerCase() === next.toLowerCase())) {
      setError(`"${next}" is already in this list.`)
      return
    }
    setRanges([...ranges, next])
    setRangeDraft('')
    setError('')
  }

  function removeRange(index) {
    setRanges(ranges.filter((_, i) => i !== index))
  }

  function addItem() {
    const nextName = name.trim()
    // Fold in a range that was typed but not yet staged with "+".
    const pending = rangeDraft.trim()
    const allRanges = pending && !ranges.includes(pending) ? [...ranges, pending] : ranges
    if (!nextName || allRanges.length === 0) return

    // IP List names map to PCE objects, which must be unique.
    const exists = items.some((it) => it.name.toLowerCase() === nextName.toLowerCase())
    if (exists) {
      setError(`An IP List named "${nextName}" already exists.`)
      return
    }

    // Assign a stable Terraform local name once, here at creation time.
    const id = uniqueId(nextName, items.map((it) => it.id).filter(Boolean))
    onChange([...items, { id, name: nextName, ranges: allRanges }])
    setName('')
    setRangeDraft('')
    setRanges([])
    setError('')
  }

  function updateItem(index, updated) {
    onChange(items.map((it, i) => (i === index ? updated : it)))
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  // True if some *other* committed list already uses this name (case-insensitive).
  function nameTaken(candidate, exceptId) {
    const lower = candidate.toLowerCase()
    return items.some((it) => it.id !== exceptId && it.name.trim().toLowerCase() === lower)
  }

  function handleRangeKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addRange()
    }
  }

  const canAddRange = rangeDraft.trim().length > 0
  const canAddItem = name.trim() && (ranges.length > 0 || rangeDraft.trim())

  return (
    <CollapsibleSection
      keyLabel="illumio-core_ip_list"
      title="IP Lists"
      hint={
        <>
          A name and one or more CIDR blocks (<code>10.0.0.0/8</code>) or address ranges (
          <code>10.0.0.1 - 10.0.0.20</code>).
        </>
      }
    >
      <div className="field__entry field__entry--col">
        <input
          className="field__input"
          type="text"
          placeholder="Name — e.g. Corp Net"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError('')
          }}
          autoComplete="off"
          spellCheck="false"
          aria-label="IP List name"
        />

        <div className="field__row">
          <input
            className="field__input"
            type="text"
            placeholder="CIDR or range — add one or more"
            value={rangeDraft}
            onChange={(e) => {
              setRangeDraft(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={handleRangeKeyDown}
            autoComplete="off"
            spellCheck="false"
            aria-label="CIDR block or address range"
          />
          <button
            className="field__add field__add--icon"
            type="button"
            onClick={addRange}
            disabled={!canAddRange}
            aria-label="Add range to this list"
          >
            +
          </button>
        </div>

        {ranges.length > 0 && (
          <ul className="chips chips--draft">
            {ranges.map((range, index) => (
              <li className="chip" key={`${range}-${index}`}>
                <span className="chip__meta">{range}</span>
                <button
                  className="chip__remove"
                  type="button"
                  onClick={() => removeRange(index)}
                  aria-label={`Remove ${range}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          className="field__add field__add--block"
          type="button"
          onClick={addItem}
          disabled={!canAddItem}
        >
          Add IP List
        </button>
      </div>

      {error && <p className="field__error">{error}</p>}

      {items.length > 0 ? (
        <ul className="iplists">
          {items.map((item, index) => (
            <IpListCard
              key={item.id}
              item={item}
              nameTaken={nameTaken}
              onChange={(updated) => updateItem(index, updated)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ul>
      ) : (
        <p className="field__empty">No IP Lists yet.</p>
      )}
    </CollapsibleSection>
  )
}

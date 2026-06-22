import { useState } from 'react'

// A single committed IP List with view and in-place edit modes.
// Edits (rename, add/remove ranges) flow straight to the parent via onChange,
// keeping the stable `id` — and therefore the Terraform resource address and
// PCE HREF — untouched.
export default function IpListCard({ item, nameTaken, onChange, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [rangeDraft, setRangeDraft] = useState('')
  const [error, setError] = useState('')

  function rename(value) {
    onChange({ ...item, name: value })
  }

  function addRange() {
    const next = rangeDraft.trim()
    if (!next) return
    if (item.ranges.some((r) => r.toLowerCase() === next.toLowerCase())) {
      setError(`"${next}" is already in this list.`)
      return
    }
    onChange({ ...item, ranges: [...item.ranges, next] })
    setRangeDraft('')
    setError('')
  }

  function removeRange(index) {
    onChange({ ...item, ranges: item.ranges.filter((_, i) => i !== index) })
  }

  function handleRangeKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addRange()
    }
  }

  const trimmedName = item.name.trim()
  const duplicate = trimmedName && nameTaken(trimmedName, item.id)

  if (!editing) {
    return (
      <li className="iplist">
        <div className="iplist__head">
          <div className="iplist__ident">
            <span className="iplist__name">{item.name || <em>(unnamed)</em>}</span>
            <span className="iplist__addr">illumio-core_ip_list.{item.id}</span>
          </div>
          <div className="iplist__actions">
            <button className="iplist__edit" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="chip__remove"
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${item.name}`}
            >
              ×
            </button>
          </div>
        </div>
        <ul className="iplist__ranges">
          {item.ranges.map((range, i) => (
            <li className="range-chip" key={`${range}-${i}`}>
              {range}
            </li>
          ))}
        </ul>
      </li>
    )
  }

  return (
    <li className="iplist iplist--editing">
      <div className="iplist__head">
        <input
          className="field__input"
          type="text"
          value={item.name}
          onChange={(e) => rename(e.target.value)}
          placeholder="Name"
          autoComplete="off"
          spellCheck="false"
          aria-label="IP List name"
        />
        <button className="iplist__edit" type="button" onClick={() => setEditing(false)}>
          Done
        </button>
      </div>

      <span className="iplist__addr iplist__addr--edit">
        illumio-core_ip_list.{item.id} · address stays fixed while editing
      </span>

      {duplicate && (
        <p className="field__error">
          Another IP List is named “{trimmedName}”. PCE names should be unique.
        </p>
      )}

      {item.ranges.length > 0 && (
        <ul className="chips chips--draft">
          {item.ranges.map((range, index) => (
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

      <div className="field__row">
        <input
          className="field__input"
          type="text"
          placeholder="Add a CIDR or range"
          value={rangeDraft}
          onChange={(e) => {
            setRangeDraft(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={handleRangeKeyDown}
          autoComplete="off"
          spellCheck="false"
          aria-label="Add CIDR block or address range"
        />
        <button
          className="field__add field__add--icon"
          type="button"
          onClick={addRange}
          disabled={!rangeDraft.trim()}
          aria-label="Add range to this list"
        >
          +
        </button>
      </div>

      {error && <p className="field__error">{error}</p>}
    </li>
  )
}

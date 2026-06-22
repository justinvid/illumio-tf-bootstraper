import { useState } from 'react'

// Stages workload interfaces (name + address) into a list. Self-contained:
// holds its own draft inputs, validates duplicate interface names, and reports
// committed changes via onAdd / onRemove. Used by both the create form and the
// in-place edit card so the two stay consistent.
export default function InterfaceEditor({ interfaces, onAdd, onRemove }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  function add() {
    const nextName = name.trim()
    const nextAddress = address.trim()
    // The provider requires a name on each interfaces block; address is optional.
    if (!nextName) return

    if (interfaces.some((i) => i.name.toLowerCase() === nextName.toLowerCase())) {
      setError(`Interface "${nextName}" already exists.`)
      return
    }

    onAdd({ name: nextName, address: nextAddress })
    setName('')
    setAddress('')
    setError('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="iface">
      <div className="field__row">
        <input
          className="field__input"
          type="text"
          placeholder="Interface name — eth0"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
          aria-label="Interface name"
        />
        <input
          className="field__input"
          type="text"
          placeholder="Address — 10.0.1.20"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
          aria-label="Interface address"
        />
        <button
          className="field__add field__add--icon"
          type="button"
          onClick={add}
          disabled={!name.trim()}
          aria-label="Add interface"
        >
          +
        </button>
      </div>

      {error && <p className="field__error">{error}</p>}

      {interfaces.length > 0 && (
        <ul className="chips chips--draft">
          {interfaces.map((iface, index) => (
            <li className="chip" key={`${iface.name}-${index}`}>
              <span className="chip__meta">
                {iface.name || '—'}
                {iface.address ? ` · ${iface.address}` : ''}
              </span>
              <button
                className="chip__remove"
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove interface ${iface.name || iface.address}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useState } from 'react'
import CollapsibleSection from './CollapsibleSection.jsx'
import InterfaceEditor from './InterfaceEditor.jsx'
import WorkloadCard from './WorkloadCard.jsx'
import { uniqueId } from '../lib/hcl.js'

// Collects unmanaged workloads — each a name plus optional hostname and
// interfaces — into a list. New workloads are staged in a draft, then
// committed; committed workloads are edited in place via WorkloadCard, which
// preserves their stable id. Lifts items to the parent via `items` / `onChange`.
export default function WorkloadInput({ items, onChange }) {
  const [name, setName] = useState('')
  const [hostname, setHostname] = useState('')
  const [interfaces, setInterfaces] = useState([])
  const [error, setError] = useState('')

  function addInterface(iface) {
    setInterfaces([...interfaces, iface])
  }

  function removeInterface(index) {
    setInterfaces(interfaces.filter((_, i) => i !== index))
  }

  function addWorkload() {
    const nextName = name.trim()
    if (!nextName || interfaces.length === 0) return

    if (nameTaken(nextName)) {
      setError(`A workload named "${nextName}" already exists.`)
      return
    }

    const id = uniqueId(nextName, items.map((it) => it.id).filter(Boolean))
    onChange([...items, { id, name: nextName, hostname: hostname.trim(), interfaces }])
    setName('')
    setHostname('')
    setInterfaces([])
    setError('')
  }

  function updateItem(index, updated) {
    onChange(items.map((it, i) => (i === index ? updated : it)))
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  // True if some workload (other than exceptId) already uses this name.
  function nameTaken(candidate, exceptId) {
    const lower = candidate.toLowerCase()
    return items.some((it) => it.id !== exceptId && it.name.trim().toLowerCase() === lower)
  }

  function handleNameKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addWorkload()
    }
  }

  return (
    <CollapsibleSection
      keyLabel="illumio-core_unmanaged_workload"
      title="Unmanaged Workloads"
      hint="A name, optional hostname, plus any network interfaces."
    >
      <div className="field__entry field__entry--col">
        <input
          className="field__input"
          type="text"
          placeholder="Name — e.g. web01"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={handleNameKeyDown}
          autoComplete="off"
          spellCheck="false"
          aria-label="Workload name"
        />

        <input
          className="field__input"
          type="text"
          placeholder="Hostname (optional)"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          autoComplete="off"
          spellCheck="false"
          aria-label="Workload hostname"
        />

        <InterfaceEditor interfaces={interfaces} onAdd={addInterface} onRemove={removeInterface} />

        {name.trim() && interfaces.length === 0 && (
          <p className="field__hint">Add at least one interface to enable this workload.</p>
        )}

        <button
          className="field__add field__add--block"
          type="button"
          onClick={addWorkload}
          disabled={!name.trim() || interfaces.length === 0}
        >
          Add Workload
        </button>
      </div>

      {error && <p className="field__error">{error}</p>}

      {items.length > 0 ? (
        <ul className="iplists">
          {items.map((item, index) => (
            <WorkloadCard
              key={item.id}
              item={item}
              nameTaken={nameTaken}
              onChange={(updated) => updateItem(index, updated)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </ul>
      ) : (
        <p className="field__empty">No workloads yet.</p>
      )}
    </CollapsibleSection>
  )
}

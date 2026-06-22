import { useState } from 'react'
import InterfaceEditor from './InterfaceEditor.jsx'

// A single committed unmanaged workload with view and in-place edit modes.
// Edits flow straight to the parent via onChange, keeping the stable `id` — and
// therefore the Terraform resource address and PCE HREF — untouched.
export default function WorkloadCard({ item, nameTaken, onChange, onRemove }) {
  const [editing, setEditing] = useState(false)

  function setField(field, value) {
    onChange({ ...item, [field]: value })
  }

  function addInterface(iface) {
    onChange({ ...item, interfaces: [...item.interfaces, iface] })
  }

  function removeInterface(index) {
    onChange({ ...item, interfaces: item.interfaces.filter((_, i) => i !== index) })
  }

  const trimmedName = item.name.trim()
  const duplicate = trimmedName && nameTaken(trimmedName, item.id)

  if (!editing) {
    return (
      <li className="iplist">
        <div className="iplist__head">
          <div className="iplist__ident">
            <span className="iplist__name">{item.name || <em>(unnamed)</em>}</span>
            <span className="iplist__addr">illumio-core_unmanaged_workload.{item.id}</span>
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

        {item.hostname && (
          <div className="wl-meta">
            <span className="wl-tag">host · {item.hostname}</span>
          </div>
        )}

        {item.interfaces.length > 0 && (
          <ul className="iplist__ranges">
            {item.interfaces.map((iface, i) => (
              <li className="range-chip" key={`${iface.name}-${i}`}>
                {iface.name || '—'}
                {iface.address ? ` · ${iface.address}` : ''}
              </li>
            ))}
          </ul>
        )}
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
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Name"
          autoComplete="off"
          spellCheck="false"
          aria-label="Workload name"
        />
        <button className="iplist__edit" type="button" onClick={() => setEditing(false)}>
          Done
        </button>
      </div>

      <span className="iplist__addr iplist__addr--edit">
        illumio-core_unmanaged_workload.{item.id} · address stays fixed while editing
      </span>

      {duplicate && (
        <p className="field__error">
          Another workload is named “{trimmedName}”. Workload names should be unique.
        </p>
      )}

      <div className="wl-fields">
        <input
          className="field__input"
          type="text"
          value={item.hostname}
          onChange={(e) => setField('hostname', e.target.value)}
          placeholder="Hostname (optional)"
          autoComplete="off"
          spellCheck="false"
          aria-label="Workload hostname"
        />
      </div>

      <InterfaceEditor
        interfaces={item.interfaces}
        onAdd={addInterface}
        onRemove={removeInterface}
      />
    </li>
  )
}

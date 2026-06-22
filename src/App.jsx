import { useMemo, useRef, useState } from 'react'
import ProviderConfig from './components/ProviderConfig.jsx'
import EyeIcon from './components/EyeIcon.jsx'
import LabelTypeInput from './components/LabelTypeInput.jsx'
import LabelInput from './components/LabelInput.jsx'
import IpListInput from './components/IpListInput.jsx'
import WorkloadInput from './components/WorkloadInput.jsx'
import { generateHcl, generateTfvars, usesTfvars, TFVARS_FILENAME } from './lib/hcl.js'
import { parseHcl, parseTfvars, isTfvarsFile } from './lib/importHcl.js'

// Builds the short status line shown after an import.
function summarizeImport(tf, tfvars) {
  const parts = []
  if (tf) {
    const counts = [
      [tf.labelTypes.length, 'label type'],
      [tf.labels.length, 'label'],
      [tf.ipLists.length, 'IP list'],
      [tf.unmanagedWorkloads.length, 'workload'],
    ]
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}${n === 1 ? '' : 's'}`)
    parts.push(counts.length ? `Loaded ${counts.join(', ')}` : 'Loaded provider config')
  }
  if (tfvars) parts.push('applied credentials')
  return { error: false, text: parts.length ? `Imported — ${parts.join('; ')}.` : 'Nothing to import.' }
}

// Left blank so the placeholders (which describe each field and show the
// default) stay visible; generateHcl fills in defaults (org_id 1, placeholder
// host) when these are empty.
const DEFAULT_PROVIDER = {
  pceHost: '',
  orgId: '',
  credentialMode: 'variables',
  apiUsername: '',
  apiSecret: '',
}

export default function App() {
  const [provider, setProvider] = useState(DEFAULT_PROVIDER)
  const [labelTypes, setLabelTypes] = useState([])
  const [labels, setLabels] = useState([])
  const [ipLists, setIpLists] = useState([])
  const [unmanagedWorkloads, setUnmanagedWorkloads] = useState([])
  const [activeFile, setActiveFile] = useState(0)
  const [copied, setCopied] = useState(false)
  const [revealSecret, setRevealSecret] = useState(false)
  const [importStatus, setImportStatus] = useState(null)
  const importInputRef = useRef(null)

  // The output is one or more files: the resources HCL always, plus an
  // illumio.auto.tfvars holding the credential values when in Variables mode.
  // `content` is the real file (copy/download); `display` is what the preview
  // shows — identical except the tfvars secret can be masked.
  const files = useMemo(() => {
    const list = [
      {
        name: 'illumio-resources.tf',
        content: generateHcl({ provider, labelTypes, labels, ipLists, unmanagedWorkloads }),
      },
    ]
    if (usesTfvars(provider)) {
      list.push({
        name: TFVARS_FILENAME,
        content: generateTfvars(provider),
        display: generateTfvars(provider, { maskSecret: !revealSecret }),
        maskable: true,
      })
    }
    return list
  }, [provider, labelTypes, labels, ipLists, unmanagedWorkloads, revealSecret])

  // Clamp the active tab in case the tfvars file just disappeared (mode switch).
  const active = files[Math.min(activeFile, files.length - 1)]

  async function copyActive() {
    try {
      await navigator.clipboard.writeText(active.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  function downloadActive() {
    const blob = new Blob([active.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = active.name
    a.click()
    URL.revokeObjectURL(url)
  }

  // Loads an existing .tf (and/or .auto.tfvars) back into the editor. A .tf
  // replaces every resource section and the provider config; a .tfvars supplies
  // the credential values. Either or both may be selected.
  async function importFiles(fileList) {
    const picked = Array.from(fileList)
    if (picked.length === 0) return

    let tf = null
    let tfvars = null
    try {
      for (const file of picked) {
        const text = await file.text()
        if (isTfvarsFile(file.name, text)) tfvars = parseTfvars(text)
        else tf = parseHcl(text)
      }
    } catch {
      setImportStatus({ error: true, text: 'Could not read the selected file(s).' })
      return
    }

    if (tf) {
      setLabelTypes(tf.labelTypes)
      setLabels(tf.labels)
      setIpLists(tf.ipLists)
      setUnmanagedWorkloads(tf.unmanagedWorkloads)
    }
    setProvider((prev) => {
      let next = prev
      if (tf?.provider) {
        next = {
          ...next,
          ...tf.provider,
          // Keep existing creds unless the .tf carried inline ones.
          apiUsername: tf.provider.apiUsername || next.apiUsername,
          apiSecret: tf.provider.apiSecret || next.apiSecret,
        }
      }
      if (tfvars) {
        next = {
          ...next,
          apiUsername: tfvars.apiUsername || next.apiUsername,
          apiSecret: tfvars.apiSecret || next.apiSecret,
        }
      }
      return next
    })
    setActiveFile(0)
    setImportStatus(summarizeImport(tf, tfvars))
  }

  function onImportChange(e) {
    importFiles(e.target.files)
    e.target.value = '' // allow re-selecting the same file
  }

  return (
    <div className="shell">
      <div className="grain" aria-hidden="true" />

      <header className="masthead">
        <div className="masthead__mark">
          <span className="masthead__dot" />
          illumio · terraform init
        </div>
        <h1 className="masthead__title">Illumio Terraform Bootstrapper</h1>
        <p className="masthead__sub">
          Compose <code>illumio-core</code> resources, then export ready-to-apply HCL.
        </p>

        <div className="masthead__tools">
          <button
            className="import-btn"
            type="button"
            onClick={() => importInputRef.current?.click()}
          >
            Import existing files
          </button>
          {importStatus && (
            <span className={`import-status${importStatus.error ? ' import-status--error' : ''}`}>
              {importStatus.text}
            </span>
          )}
          <input
            ref={importInputRef}
            type="file"
            accept=".tf,.tfvars"
            multiple
            hidden
            onChange={onImportChange}
          />
        </div>
      </header>

      <main className="workspace">
        <div className="panel panel--form">
          <ProviderConfig value={provider} onChange={setProvider} />
          <LabelTypeInput items={labelTypes} onChange={setLabelTypes} />
          <LabelInput items={labels} labelTypes={labelTypes} onChange={setLabels} />
          <IpListInput items={ipLists} onChange={setIpLists} />
          <WorkloadInput items={unmanagedWorkloads} onChange={setUnmanagedWorkloads} />
        </div>

        <div className="panel panel--output">
          <div className="output__bar">
            <div className="output__tabs" role="tablist" aria-label="Output files">
              {files.map((file, i) => (
                <button
                  key={file.name}
                  type="button"
                  role="tab"
                  aria-selected={file === active}
                  className={`output__tab${file === active ? ' output__tab--active' : ''}`}
                  onClick={() => setActiveFile(i)}
                >
                  {file.name}
                </button>
              ))}
            </div>
            <div className="output__actions">
              {active.maskable && (
                <button
                  className="output__btn output__btn--icon"
                  type="button"
                  onClick={() => setRevealSecret((r) => !r)}
                  aria-pressed={revealSecret}
                  aria-label={revealSecret ? 'Hide secret' : 'Reveal secret'}
                  title={revealSecret ? 'Hide secret' : 'Reveal secret'}
                >
                  <EyeIcon off={revealSecret} />
                </button>
              )}
              <button className="output__btn" type="button" onClick={copyActive}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="output__btn" type="button" onClick={downloadActive}>
                Download
              </button>
            </div>
          </div>
          <pre className="output__code">
            <code>{active.display ?? active.content}</code>
          </pre>
        </div>
      </main>
    </div>
  )
}

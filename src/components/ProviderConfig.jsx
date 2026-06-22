import { useState } from 'react'
import CollapsibleSection from './CollapsibleSection.jsx'
import EyeIcon from './EyeIcon.jsx'
import { PCE_HOST_PLACEHOLDER } from '../lib/hcl.js'

const CREDENTIAL_OPTIONS = [
  { value: 'variables', label: 'Variables' },
  { value: 'env', label: 'Environment' },
]

const MODE_HELP = {
  variables:
    'Provider references var.* with sensitive variable blocks. The key you enter below is written to a separate illumio.auto.tfvars file (auto-loaded by Terraform) — keep that file out of source control.',
  env: 'Credentials are read from ILLUMIO_API_KEY_USERNAME / ILLUMIO_API_KEY_SECRET at apply time. Nothing sensitive is written to any file.',
}

// Singleton configuration for the terraform{} and provider "illumio-core" blocks.
// Edits flow live to the parent via `value` / `onChange`.
export default function ProviderConfig({ value, onChange }) {
  const [showSecret, setShowSecret] = useState(false)

  function setField(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue })
  }

  const mode = value.credentialMode

  return (
    <CollapsibleSection
      keyLabel="terraform · provider"
      title="Provider"
      hint={
        <>
          Connection to your PCE — emitted as the <code>terraform</code> and{' '}
          <code>provider "illumio-core"</code> blocks at the top of the file.
        </>
      }
    >
      <div className="field__entry field__entry--col">
        <input
          className="field__input"
          type="text"
          placeholder={`PCE host — ${PCE_HOST_PLACEHOLDER}`}
          value={value.pceHost}
          onChange={(e) => setField('pceHost', e.target.value)}
          autoComplete="off"
          spellCheck="false"
          aria-label="PCE host"
        />

        <input
          className="field__input"
          type="text"
          inputMode="numeric"
          placeholder="Org ID — 1"
          value={value.orgId}
          onChange={(e) => setField('orgId', e.target.value)}
          autoComplete="off"
          spellCheck="false"
          aria-label="Organization ID"
        />

        <div className="cred">
          <span className="cred__label">Credentials</span>
          <div className="segmented" role="group" aria-label="Credential handling">
            {CREDENTIAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`segmented__btn${mode === opt.value ? ' segmented__btn--active' : ''}`}
                onClick={() => setField('credentialMode', opt.value)}
                aria-pressed={mode === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="cred__help">{MODE_HELP[mode]}</p>
        </div>

        {mode === 'variables' && (
          <div className="wl-fields">
            <input
              className="field__input"
              type="text"
              placeholder="API key username — api_xxxxxxxx"
              value={value.apiUsername}
              onChange={(e) => setField('apiUsername', e.target.value)}
              autoComplete="off"
              spellCheck="false"
              aria-label="API key username"
            />
            <div className="secret">
              <input
                className="field__input"
                type={showSecret ? 'text' : 'password'}
                placeholder="API secret"
                value={value.apiSecret}
                onChange={(e) => setField('apiSecret', e.target.value)}
                autoComplete="off"
                aria-label="API secret"
              />
              <button
                type="button"
                className="secret__toggle"
                onClick={() => setShowSecret((s) => !s)}
                aria-pressed={showSecret}
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                title={showSecret ? 'Hide secret' : 'Show secret'}
              >
                <EyeIcon off={showSecret} />
              </button>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

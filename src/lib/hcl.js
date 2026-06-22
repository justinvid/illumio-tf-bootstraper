// Generates Illumio Core Terraform (HCL) from collected inputs.
//
// Each input section maps to an illumio-core resource type:
//   - Label Types          -> illumio-core_label_type         (key + display_name)
//   - Environment values   -> illumio-core_label              (key = "env", value = ...)
//   - IP Lists             -> illumio-core_ip_list            (name + ip_ranges block)
//   - Unmanaged Workloads  -> illumio-core_unmanaged_workload (name + interfaces block)

export const ENV_LABEL_KEY = 'env'

// The label dimensions that exist in every PCE and cannot be (re)created — a
// label_type resource for one of these would conflict with the built-in.
export const BUILTIN_LABEL_TYPES = [
  { key: 'role', display: 'Role' },
  { key: 'app', display: 'Application' },
  { key: 'env', display: 'Environment' },
  { key: 'loc', display: 'Location' },
]

export const BUILTIN_LABEL_KEYS = BUILTIN_LABEL_TYPES.map((t) => t.key)

// Turns an arbitrary string into a safe Terraform resource identifier.
// Terraform identifiers must start with a letter/underscore and contain only
// letters, digits, underscores, and hyphens. We normalize to lowercase snake_case.
export function toResourceName(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'resource'
}

// Mints a unique resource identifier from `source`, suffixing (_2, _3, ...)
// until it no longer collides with anything in `taken`. Used once at creation
// to assign an IP List its stable Terraform local name.
export function uniqueId(source, taken = []) {
  const base = toResourceName(source)
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

// Escapes a string for use inside an HCL double-quoted literal.
function escapeHcl(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// Renders a value as a quoted HCL string literal.
function q(value) {
  return `"${escapeHcl(value)}"`
}

// Aligns [key, rhs] entries so the `=` signs line up. `rhs` is the already-
// rendered right-hand side (quoted string, number, var reference, etc.).
function alignBlock(entries, indent = '  ') {
  const width = entries.reduce((max, [key]) => Math.max(max, key.length), 0)
  return entries.map(([key, rhs]) => `${indent}${key.padEnd(width)} = ${rhs}`)
}

// Builds a single illumio-core_label resource block.
export function labelResource(localName, key, value) {
  return [
    `resource "illumio-core_label" "${localName}" {`,
    `  key   = "${escapeHcl(key)}"`,
    `  value = "${escapeHcl(value)}"`,
    `}`,
  ].join('\n')
}

// Builds a single illumio-core_label_type resource block — a custom label
// dimension (e.g. key = "tier", display_name = "Tier").
export function labelTypeResource(localName, key, displayName) {
  return [
    `resource "illumio-core_label_type" "${localName}" {`,
    ...alignAssignments([
      ['key', key],
      ['display_name', displayName],
    ]),
    `}`,
  ].join('\n')
}

// Splits a CIDR/range entry into the from_ip/to_ip pair illumio expects.
// A dash denotes an address range ("10.0.0.1 - 10.0.0.20"); anything else
// (a single address or a CIDR like "10.0.0.0/8") is a lone from_ip.
export function parseIpEntry(raw) {
  const value = String(raw).trim()
  const dash = value.indexOf('-')
  if (dash !== -1) {
    return {
      from_ip: value.slice(0, dash).trim(),
      to_ip: value.slice(dash + 1).trim(),
    }
  }
  return { from_ip: value }
}

// Builds a single illumio-core_ip_list resource block. Each entry in `ranges`
// (a CIDR or "from - to" address range) becomes its own ip_ranges block.
export function ipListResource(localName, name, ranges) {
  const lines = [`resource "illumio-core_ip_list" "${localName}" {`, `  name = "${escapeHcl(name)}"`]

  for (const raw of ranges) {
    const { from_ip, to_ip } = parseIpEntry(raw)
    if (!from_ip) continue
    lines.push(`  ip_ranges {`)
    lines.push(`    from_ip = "${escapeHcl(from_ip)}"`)
    if (to_ip) {
      lines.push(`    to_ip   = "${escapeHcl(to_ip)}"`)
    }
    lines.push(`  }`)
  }

  lines.push(`}`)
  return lines.join('\n')
}

// Formats [key, value] pairs as aligned quoted-string assignments, skipping
// pairs whose value is empty.
function alignAssignments(pairs, indent = '  ') {
  const present = pairs.filter(([, value]) => String(value).trim() !== '')
  return alignBlock(
    present.map(([key, value]) => [key, q(value)]),
    indent,
  )
}

// Builds a single illumio-core_unmanaged_workload resource block. Each interface
// (name + address) becomes its own interfaces block.
export function unmanagedWorkloadResource(localName, workload) {
  const lines = [`resource "illumio-core_unmanaged_workload" "${localName}" {`]

  lines.push(
    ...alignAssignments([
      ['name', workload.name],
      ['hostname', workload.hostname],
    ]),
  )

  for (const iface of workload.interfaces ?? []) {
    const block = alignAssignments(
      [
        ['name', iface.name],
        ['address', iface.address],
      ],
      '    ',
    )
    if (block.length === 0) continue
    lines.push(``, `  interfaces {`, ...block, `  }`)
  }

  lines.push(`}`)
  return lines.join('\n')
}

export const PROVIDER_SOURCE = 'illumio/illumio-core'
export const PCE_HOST_PLACEHOLDER = 'https://pce.example.com:8443'
export const CREDENTIAL_MODES = ['variables', 'env']
// Named *.auto.tfvars so Terraform auto-loads it. A plain custom name like
// "illumio.tfvars" is NOT auto-loaded and would require -var-file on every run.
export const TFVARS_FILENAME = 'illumio.auto.tfvars'

const API_USERNAME_VAR = 'illumio_api_username'
const API_SECRET_VAR = 'illumio_api_secret'

// A sensitive string variable declaration.
function sensitiveVariable(name) {
  return [`variable "${name}" {`, `  type      = string`, `  sensitive = true`, `}`].join('\n')
}

// Builds the terraform{} required_providers block plus the provider "illumio-core"
// block. Returns an array of HCL sections (the variable blocks come last when the
// credentials are sourced from Terraform variables).
//
// credentialMode controls how api_username / api_secret are supplied:
//   'variables' -> reference var.* and emit sensitive variable blocks (default);
//                  the values live in a separate .tfvars file (see generateTfvars)
//   'env'       -> omit them; the provider reads ILLUMIO_API_KEY_* from the env
export function providerSections(provider = {}) {
  const { pceHost = '', orgId = '', credentialMode = 'variables' } = provider

  const host = pceHost.trim() || PCE_HOST_PLACEHOLDER
  const org = String(orgId).trim() || '1'

  // No version constraint — Terraform resolves the latest. Pin manually if needed.
  const terraformBlock = [
    `terraform {`,
    `  required_providers {`,
    `    illumio-core = {`,
    `      source = ${q(PROVIDER_SOURCE)}`,
    `    }`,
    `  }`,
    `}`,
  ].join('\n')

  const args = [
    ['pce_host', q(host)],
    ['org_id', org],
  ]
  const variableBlocks = []

  if (credentialMode === 'variables') {
    args.push(['api_username', `var.${API_USERNAME_VAR}`])
    args.push(['api_secret', `var.${API_SECRET_VAR}`])
    variableBlocks.push(sensitiveVariable(API_USERNAME_VAR), sensitiveVariable(API_SECRET_VAR))
  }

  const providerLines = [`provider "illumio-core" {`, ...alignBlock(args)]
  if (credentialMode === 'env') {
    providerLines.push(
      ``,
      `  # api_username and api_secret are read from the environment:`,
      `  #   ILLUMIO_API_KEY_USERNAME / ILLUMIO_API_KEY_SECRET`,
    )
  }
  providerLines.push(`}`)

  return [terraformBlock, providerLines.join('\n'), ...variableBlocks]
}

// Whether a .tfvars file is relevant for the given provider config.
export function usesTfvars(provider = {}) {
  return (provider.credentialMode ?? 'variables') === 'variables'
}

// Builds the .tfvars file holding the sensitive credential values that
// back the var.* references in the provider block. Kept in a separate file so
// it can be git-ignored and never committed.
//
// With { maskSecret: true } the api_secret value is replaced by bullets — for
// on-screen preview only. The real value is still needed for copy/download, so
// callers pass maskSecret: false there.
export function generateTfvars(provider = {}, { maskSecret = false } = {}) {
  const { apiUsername = '', apiSecret = '' } = provider
  const secret = apiSecret.trim()
  const secretRhs = maskSecret && secret ? q('••••••••••••') : q(secret)
  return [
    `# Sensitive credentials for the illumio-core provider.`,
    `# Keep this file out of source control (add it to .gitignore).`,
    ``,
    ...alignBlock(
      [
        [API_USERNAME_VAR, q(apiUsername.trim())],
        [API_SECRET_VAR, secretRhs],
      ],
      '',
    ),
    ``,
  ].join('\n')
}

// Builds the full HCL document from all collected inputs.
//   config.provider:           { pceHost, orgId, credentialMode,
//                                apiUsername, apiSecret }     (terraform + provider blocks)
//   config.labelTypes:         { id, key, displayName }[]                   (label dimension)
//   config.labels:             { id, key, value }[]                        (label value)
//   config.ipLists:            { id, name, ranges: [] }[]                   (name + CIDR/ranges)
//   config.unmanagedWorkloads: { id, name, hostname,
//                                interfaces: [{ name, address }] }[]
//
// Each resource item's `id` is its Terraform local resource name and is held
// stable across edits, so renaming (or changing sub-blocks) is an in-place
// update in Terraform — the PCE-assigned HREF is preserved rather than recreated.
export function generateHcl({
  provider,
  labelTypes = [],
  labels = [],
  ipLists = [],
  unmanagedWorkloads = [],
} = {}) {
  const sections = []

  // The terraform/provider scaffold always leads the file when configured.
  if (provider) {
    sections.push(...providerSections(provider))
  }

  // Label dimensions come before the labels and workloads that use them.
  const types = labelTypes
    .map((t) => ({ id: t.id, key: t.key.trim(), displayName: t.displayName.trim() }))
    .filter((t) => t.key && t.displayName)
  if (types.length > 0) {
    const blocks = types.map((t) =>
      labelTypeResource(t.id || toResourceName(t.key), t.key, t.displayName),
    )
    sections.push(blocks.join('\n\n'))
  }

  const labelValues = labels
    .map((l) => ({ id: l.id, key: (l.key ?? ENV_LABEL_KEY).trim(), value: l.value.trim() }))
    .filter((l) => l.key && l.value)
  if (labelValues.length > 0) {
    // Use the stable id as the local name; fall back to a key/value slug only
    // for items created before ids existed.
    const blocks = labelValues.map((l) =>
      labelResource(l.id || toResourceName(`${l.key}_${l.value}`), l.key, l.value),
    )
    sections.push(blocks.join('\n\n'))
  }

  const lists = ipLists
    .map((l) => ({
      id: l.id,
      name: l.name.trim(),
      ranges: (l.ranges ?? []).map((r) => r.trim()).filter(Boolean),
    }))
    .filter((l) => l.name && l.ranges.length > 0)
  if (lists.length > 0) {
    // Use the stable id as the local name; fall back to a name-derived slug
    // only for items created before ids existed.
    const blocks = lists.map((list) =>
      ipListResource(list.id || toResourceName(list.name), list.name, list.ranges),
    )
    sections.push(blocks.join('\n\n'))
  }

  const workloads = unmanagedWorkloads
    .map((w) => ({
      id: w.id,
      name: (w.name ?? '').trim(),
      hostname: (w.hostname ?? '').trim(),
      interfaces: (w.interfaces ?? [])
        .map((i) => ({ name: (i.name ?? '').trim(), address: (i.address ?? '').trim() }))
        .filter((i) => i.name),
    }))
    .filter((w) => w.name)
  if (workloads.length > 0) {
    const blocks = workloads.map((w) =>
      unmanagedWorkloadResource(w.id || toResourceName(w.name), w),
    )
    sections.push(blocks.join('\n\n'))
  }

  if (sections.length === 0) {
    return '# Add an environment, IP List, or workload to generate Illumio resources.'
  }

  return sections.join('\n\n') + '\n'
}

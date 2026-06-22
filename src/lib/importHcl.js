// Parses generated Illumio HCL (and the matching .tfvars) back into the app's
// state shapes, so an existing illumio-resources.tf can be re-loaded for editing.
//
// The parser is brace-aware and tuned to this tool's own output, but tolerant of
// whitespace and hand-edits. Crucially, each resource's Terraform local name is
// read back as its stable `id`, so a re-export keeps the same resource addresses
// (and therefore the PCE HREFs). See [[href-stability-stable-ids]].

import { PCE_HOST_PLACEHOLDER } from './hcl.js'

// Finds brace-delimited blocks at the top level of `text`, returning each
// block's leading keyword, any quoted labels, and its inner body. Nested blocks
// are skipped over (recurse into a body with another findBlocks call).
function findBlocks(text) {
  const blocks = []
  const re = /([A-Za-z_][\w-]*)((?:[ \t]+"[^"]*")*)[ \t]*\{/g
  let m
  while ((m = re.exec(text)) !== null) {
    const open = re.lastIndex - 1
    let depth = 0
    let i = open
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}' && --depth === 0) break
    }
    blocks.push({
      keyword: m[1],
      labels: [...m[2].matchAll(/"([^"]*)"/g)].map((x) => x[1]),
      body: text.slice(open + 1, i),
    })
    re.lastIndex = i + 1
  }
  return blocks
}

// Returns the scalar `key = value` assignments directly inside a block body,
// ignoring nested blocks (everything at brace depth >= 1) and full-line comments.
function parseAttrs(body) {
  let clean = ''
  let depth = 0
  for (const ch of body) {
    if (ch === '{') depth++
    else if (ch === '}') depth = Math.max(0, depth - 1)
    else if (depth === 0) clean += ch
  }
  clean = clean.replace(/^[ \t]*#.*$/gm, '')

  const attrs = {}
  const re = /([A-Za-z_]\w*)[ \t]*=[ \t]*([^\n]+)/g
  let m
  while ((m = re.exec(clean)) !== null) {
    attrs[m[1]] = m[2].trim()
  }
  return attrs
}

// Unwraps an HCL double-quoted string literal; returns '' for anything else
// (var references, numbers, missing values).
function rhsString(rhs) {
  if (!rhs) return ''
  const m = /^"((?:[^"\\]|\\.)*)"/.exec(rhs.trim())
  return m ? m[1].replace(/\\(.)/g, '$1') : ''
}

function blankIfDefault(value, def) {
  return value === def ? '' : value
}

// Parses an illumio-resources.tf document. Returns provider config plus the
// resource lists, keyed exactly as the app's state expects.
export function parseHcl(text) {
  const result = {
    provider: null,
    labelTypes: [],
    labels: [],
    ipLists: [],
    unmanagedWorkloads: [],
  }

  let providerAttrs = null

  for (const block of findBlocks(text)) {
    // The terraform{} block is ignored — we no longer model a version constraint.
    if (block.keyword === 'provider' && block.labels[0] === 'illumio-core') {
      providerAttrs = parseAttrs(block.body)
    } else if (block.keyword === 'resource') {
      const [type, localName] = block.labels
      const attrs = parseAttrs(block.body)

      if (type === 'illumio-core_label_type') {
        result.labelTypes.push({
          id: localName,
          key: rhsString(attrs.key),
          displayName: rhsString(attrs.display_name),
        })
      } else if (type === 'illumio-core_label') {
        result.labels.push({
          id: localName,
          key: rhsString(attrs.key),
          value: rhsString(attrs.value),
        })
      } else if (type === 'illumio-core_ip_list') {
        const ranges = findBlocks(block.body)
          .filter((c) => c.keyword === 'ip_ranges')
          .map((c) => {
            const ia = parseAttrs(c.body)
            const from = rhsString(ia.from_ip)
            const to = rhsString(ia.to_ip)
            return to ? `${from} - ${to}` : from
          })
          .filter(Boolean)
        result.ipLists.push({ id: localName, name: rhsString(attrs.name), ranges })
      } else if (type === 'illumio-core_unmanaged_workload') {
        const interfaces = findBlocks(block.body)
          .filter((c) => c.keyword === 'interfaces')
          .map((c) => {
            const ia = parseAttrs(c.body)
            return { name: rhsString(ia.name), address: rhsString(ia.address) }
          })
          .filter((i) => i.name)
        result.unmanagedWorkloads.push({
          id: localName,
          name: rhsString(attrs.name),
          hostname: rhsString(attrs.hostname),
          interfaces,
        })
      }
    }
  }

  if (providerAttrs) {
    const a = providerAttrs
    const rawUser = a.api_username ?? ''
    let credentialMode = 'env'
    let apiUsername = ''
    let apiSecret = ''
    if (rawUser) {
      credentialMode = 'variables'
      if (!rawUser.startsWith('var.')) {
        // An older inline-style file: lift the literal creds into Variables mode.
        apiUsername = rhsString(rawUser)
        apiSecret = rhsString(a.api_secret)
      }
    }
    result.provider = {
      pceHost: blankIfDefault(rhsString(a.pce_host), PCE_HOST_PLACEHOLDER),
      orgId: blankIfDefault((a.org_id ?? '').replace(/^"|"$/g, ''), '1'),
      credentialMode,
      apiUsername,
      apiSecret,
    }
  }

  return result
}

// Parses an illumio.auto.tfvars file for the credential values.
export function parseTfvars(text) {
  const attrs = {}
  const re = /^[ \t]*([A-Za-z_]\w*)[ \t]*=[ \t]*"((?:[^"\\]|\\.)*)"/gm
  let m
  while ((m = re.exec(text)) !== null) {
    attrs[m[1]] = m[2].replace(/\\(.)/g, '$1')
  }
  return {
    apiUsername: attrs.illumio_api_username ?? '',
    apiSecret: attrs.illumio_api_secret ?? '',
  }
}

// Classifies a file by name/content as a tfvars credential file vs a .tf doc.
export function isTfvarsFile(name, text) {
  if (name.endsWith('.tfvars')) return true
  return !/\b(resource|provider)\b/.test(text) && /illumio_api_/.test(text)
}

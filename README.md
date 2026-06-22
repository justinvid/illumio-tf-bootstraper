# Illumio Terraform Bootstrapper

A single-page web app that builds [Illumio Core](https://registry.terraform.io/providers/illumio/illumio-core/latest)
Terraform (HCL) configuration from simple form inputs. Compose your provider
connection, label types, labels, IP lists, and unmanaged workloads, then export
ready-to-apply `.tf` and `.tfvars` files. Existing files can also be imported back
in for editing.

It runs entirely in the browser — nothing you enter (including credentials) ever
leaves your machine.

## Features

- **Provider block** — `terraform` + `provider "illumio-core"` config (PCE host,
  org ID, credential handling). No version is pinned, so Terraform resolves the
  latest provider; pin manually in the file if you need to.
- **Credentials** — choose *Variables* (writes a separate `illumio.auto.tfvars`)
  or *Environment* (reads `ILLUMIO_API_KEY_USERNAME` / `ILLUMIO_API_KEY_SECRET`
  at apply time, nothing sensitive written to disk).
- **Resources** — custom label types (`illumio-core_label_type`), labels
  (`illumio-core_label`, any dimension), IP lists (`illumio-core_ip_list`), and
  unmanaged workloads (`illumio-core_unmanaged_workload`).
- **Stable resource addresses** — editing a resource keeps its Terraform local
  name fixed, so the PCE-assigned HREF survives `terraform apply`.
- **Import** — load an existing `illumio-resources.tf` (and/or
  `illumio.auto.tfvars`) to keep editing it.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer (20 LTS recommended) and npm.

## Install

```bash
npm install
```

## Build and run (production)

Build the optimized static bundle into `dist/`:

```bash
npm run build
```

Then serve that build locally with Vite's preview server:

```bash
npm run preview
```

This serves the production bundle at <http://localhost:4173>. Useful flags:

```bash
npm run preview -- --port 8080   # change the port
npm run preview -- --host        # expose on your LAN (e.g. http://<your-ip>:4173)
```

### Serving the build elsewhere

`dist/` is a self-contained static site with no server-side requirements, so you
can host it with any static file server or hosting provider. For example:

```bash
npx serve dist
# or
python3 -m http.server --directory dist 8080
```

## Development

For a hot-reloading dev server (not for production use):

```bash
npm run dev
```

This serves the app at <http://localhost:5173>.

## Using the generated files

The output panel produces up to two files:

- **`illumio-resources.tf`** — the provider config and all resources.
- **`illumio.auto.tfvars`** — your API key and secret (only in *Variables*
  credential mode). The `.auto.tfvars` name is auto-loaded by Terraform, so no
  `-var-file` flag is needed.

Copy or download both into a working directory, then:

```bash
terraform init
terraform plan
terraform apply
```

> **Keep `illumio.auto.tfvars` out of source control** — it contains your API
> secret. Add it to your `.gitignore`.

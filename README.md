[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/opencontrolplane-headlamp-plugin)](https://artifacthub.io/packages/search?repo=opencontrolplane-headlamp-plugin)

# opencontrolplane-headlamp-plugin

A [Headlamp™](https://headlamp.dev) plugin for OpenControlPlane: hides the sidebar and top bar, expands the main content to full viewport, and auto-redirects the cluster root page.

## What it does

- Injects CSS to hide all navigation chrome (app bar, drawer, sidebar footer)
- Re-applies styles on every SPA route change via `MutationObserver`

## Development

### Prerequisites

- Node.js >= 18
- npm
- `kind`, `kubectl`, `helm` (for local cluster)

```bash
npm install
```

### Local dev cluster (kind)

The cluster setup and plugin iteration is managed centrally from the `ui-frontend` repo. Both this plugin and the crossplane plugin are built and synced together.

**Every time you change plugin code** (builds + hot-syncs all local plugins into the pod, no restart needed):

```bash
# from ui-frontend/ or from this repo
task update
```

**One-time setup** (creates the kind cluster, deploys Headlamp with latest ArtifactHub plugin releases, port-forwards to `localhost:8090`):
```bash
# from ui-frontend/ or from this repo
task dev
```

Then hard-refresh the browser (`Cmd+Shift+R`) to pick up the new build.

## Release

Trigger a release via the [GitHub Actions release workflow](../../actions/workflows/release.yml) by clicking **Run workflow** and entering the semver version (e.g. `v1.0.0`). The workflow:

- Creates a git tag
- Builds the plugin and uploads `main.js` + a `headlamp-opencontrolplane-<version>.tar.gz` as GitHub Release assets
- Updates `artifacthub/<version>/artifacthub-pkg.yml` with the correct checksum and commits it

Once published, the plugin is installable via Headlamp's plugin manager using its ArtifactHub URL.

### Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/openmcp-project/opencontrolplane-headlamp-plugin/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](https://github.com/openmcp-project/.github/blob/main/CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/openmcp-project/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing
Copyright © Linux Foundation Europe. OpenControlPlane is a project of NeoNephos Foundation. For applicable policies including privacy policy, terms of use and trademark usage guidelines, please see https://linuxfoundation.eu. Linux is a registered trademark of Linus Torvalds.
Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/openmcp-project/opencontrolplane-headlamp-plugin).

<p align="center"><img alt="NeoNephos foundation logo" src="https://raw.githubusercontent.com/neonephos/.github/refs/heads/main/assets/logo.svg" width="400"/></p>

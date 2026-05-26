# headlamp-kiosk-plugin

A [Headlamp™](https://headlamp.dev) plugin that enables kiosk mode: hides the sidebar and top bar, expands the main content to full viewport, and auto-redirects the cluster root page.

## What it does

- Injects CSS to hide all navigation chrome (app bar, drawer, sidebar footer)
- Re-applies styles on every SPA route change via `MutationObserver`

## Development

### Prerequisites

- Node.js >= 18
- npm

```bash
npm install
```

### Run in dev mode

```bash
npm start
```

### Build

```bash
npm run build
# Output: dist/main.js
```

## Local dev cluster (kind)

Two scripts live in `setup/`:

**First time (or full rebuild):**
```bash
./setup/setup-headlamp-dev.sh
```
Creates a kind cluster called `plugin-dev`, builds this plugin, deploys Headlamp via Helm with all plugin volume mounts pre-declared, and starts a port-forward on `http://localhost:8090`.

**Iterating (build → apply → restart):**
```bash
./setup/apply-plugin.sh
```
Rebuilds this plugin, updates its ConfigMap in the running cluster, restarts the pod, and re-establishes the port-forward. The cluster and Helm release are not touched.

The crossplane plugin has its own equivalent apply script in its repo — both push into the same `plugin-dev` cluster without interfering with each other.

**Prerequisites:** `kind`, `kubectl`, `helm`, `npm`, `curl`

## Deploy to a cluster via ConfigMap

1. Build the plugin:

```bash
npm run build
```

2. Create or update the ConfigMap:

```bash
kubectl create configmap kiosk-plugin \
  --from-file=main.js=dist/main.js \
  -n headlamp --dry-run=client -o yaml | kubectl apply -f -
```

3. Mount the ConfigMap into your Headlamp deployment (add to your values):

```yaml
volumes:
  - name: kiosk-plugin
    configMap:
      name: kiosk-plugin
volumeMounts:
  - name: kiosk-plugin
    mountPath: /headlamp/plugins/kiosk-mode/main.js
    subPath: main.js
```

4. To iterate: rebuild, re-apply the ConfigMap, then restart the pod:

```bash
npm run build
kubectl create configmap kiosk-plugin \
  --from-file=main.js=dist/main.js \
  -n headlamp --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment headlamp -n headlamp
```

> **Tip:** Kiosk mode hides all nav, making it hard to navigate during dev. To disable it temporarily, delete the ConfigMap and restart the pod.

## Release

Push a semver tag to trigger the GitHub Actions release workflow:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds the plugin and publishes `main.js` as a GitHub Release asset.

### Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/openmcp-project/kiosk-headlamp-plugin/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](https://github.com/openmcp-project/.github/blob/main/CONTRIBUTING.md).

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/openmcp-project/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing
Copyright © Linux Foundation Europe. OpenControlPlane is a project of NeoNephos Foundation. For applicable policies including privacy policy, terms of use and trademark usage guidelines, please see https://linuxfoundation.eu. Linux is a registered trademark of Linus Torvalds.
Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/openmcp-project/kiosk-headlamp-plugin).

<p align="center"><img alt="NeoNephos foundation logo" src="https://raw.githubusercontent.com/neonephos/.github/refs/heads/main/assets/logo.svg" width="400"/></p>

# headlamp-kiosk-plugin

A [Headlamp™](https://headlamp.dev) plugin that enables kiosk mode: hides the sidebar and top bar, expands the main content to full viewport, and auto-redirects the cluster root to the Flux overview page.

## What it does

- Injects CSS to hide all navigation chrome (app bar, drawer, sidebar footer)
- Re-applies styles on every SPA route change via `MutationObserver`
- Redirects `/c/<cluster>` → `/c/<cluster>/flux/overview` once the Flux plugin has registered its routes

## Development

### Prerequisites

- Node.js >= 18
- npm

### Install dependencies

```bash
npm install
```

### Run in dev mode (hot-reload against a running Headlamp)

```bash
npm start
```

### Build for production

```bash
npm run build
# Output: dist/main.js
```

### Test locally in-cluster

1. Build the plugin:

```bash
npm run build
```

2. Create a ConfigMap from the build output:

```bash
kubectl create configmap headlamp-kiosk-plugin \
  --from-file=main.js=dist/main.js \
  --from-file=package.json=package.json \
  -n headlamp --dry-run=client -o yaml | kubectl apply -f -
```

3. Install (or upgrade) Headlamp mounting the ConfigMap as a plugin volume. Add these overrides to your local `values.local.yaml`:

```yaml
headlamp:
  volumes:
    - name: kiosk-plugin
      configMap:
        name: headlamp-kiosk-plugin
  volumeMounts:
    - name: kiosk-plugin
      mountPath: /headlamp/user-plugins/headlamp-kiosk/main.js
      subPath: main.js
    - name: kiosk-plugin
      mountPath: /headlamp/user-plugins/headlamp-kiosk/package.json
      subPath: package.json
```

```bash
helm upgrade --install headlamp ../headlamp-deployment/helm/ \
  -n headlamp --create-namespace \
  -f ../headlamp-deployment/helm/values.yaml \
  -f values.local.yaml
```

4. To iterate: rebuild, re-apply the ConfigMap, then restart the pod:

```bash
npm run build
kubectl create configmap headlamp-kiosk-plugin \
  --from-file=main.js=dist/main.js \
  --from-file=package.json=package.json \
  -n headlamp --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment headlamp -n headlamp
```

> **Tip:** Kiosk mode hides all nav, making it hard to navigate during dev. To disable it temporarily, delete the ConfigMap and restart — or just skip the volume mount in your local values.

## Release

Releases are automated via GitHub Actions (`.github/workflows/release.yml`).

Push a semver tag to trigger a build and publish a GitHub Release with the plugin tarball:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow produces `headlamp-kiosk.tar.gz` containing `main.js` and `package.json`.

## Consuming in the deployment chart

In `headlamp-deployment` set:

```yaml
headlamp:
  pluginsManager:
    configContent: |
      plugins:
        - name: headlamp-kiosk
          source: https://github.com/<your-org>/headlamp-kiosk-plugin/releases/latest/download/headlamp-kiosk.tar.gz
```

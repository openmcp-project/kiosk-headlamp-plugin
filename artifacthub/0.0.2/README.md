# OpenControlPlane — Headlamp Plugin

A [Headlamp](https://headlamp.dev) plugin for OpenControlPlane: hides navigation chrome, adds a Control Plane Overview page, and applies Fiori styling.

## What it does

- Hides the sidebar, app bar, and all navigation chrome
- Expands the main content area to full viewport
- Auto-redirects the cluster root page
- Re-applies styles on every SPA route change via `MutationObserver`
- Uses the SAP UI5 / Fiori color scheme
- Adds a Control Plane Overview page with component status and Crossplane providers

## Installation

Install via Headlamp's built-in plugin manager by searching for **OpenControlPlane** on [ArtifactHub](https://artifacthub.io/packages/headlamp/opencontrolplane-headlamp-plugin/opencontrolplane).

## Manual deploy via ConfigMap

1. Download `main.js` from the [latest release](https://github.com/openmcp-project/opencontrolplane-headlamp-plugin/releases).

2. Create the ConfigMap:

   ```bash
   kubectl create configmap ocp-plugin \
     --from-file=main.js=main.js \
     -n headlamp --dry-run=client -o yaml | kubectl apply -f -
   ```

3. Mount it into your Headlamp deployment:

   ```yaml
   volumes:
     - name: ocp-plugin
       configMap:
         name: ocp-plugin
   volumeMounts:
     - name: ocp-plugin
       mountPath: /headlamp/plugins/opencontrolplane/main.js
       subPath: main.js
   ```

## Support & Contributing

Bug reports and feature requests via [GitHub Issues](https://github.com/openmcp-project/opencontrolplane-headlamp-plugin/issues).
Contributions welcome — see the [Contribution Guidelines](https://github.com/openmcp-project/.github/blob/main/CONTRIBUTING.md).

## License

Copyright © Linux Foundation Europe. See [LICENSE](https://github.com/openmcp-project/opencontrolplane-headlamp-plugin/blob/main/LICENSE).

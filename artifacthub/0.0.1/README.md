# Kiosk Mode — Headlamp Plugin

A [Headlamp](https://headlamp.dev) plugin that enables kiosk mode for embedded or display use cases.

## What it does

- Hides the sidebar, app bar, and all navigation chrome
- Expands the main content area to full viewport
- Auto-redirects the cluster root page
- Re-applies styles on every SPA route change via `MutationObserver`
- Uses the SAP UI5 color scheme

## Installation

Install via Headlamp's built-in plugin manager by searching for **Kiosk Mode** on [ArtifactHub](https://artifacthub.io/packages/headlamp/kiosk-headlamp-plugin/headlamp_kiosk).

## Manual deploy via ConfigMap

1. Download `main.js` from the [latest release](https://github.com/openmcp-project/kiosk-headlamp-plugin/releases).

2. Create the ConfigMap:

   ```bash
   kubectl create configmap kiosk-plugin \
     --from-file=main.js=main.js \
     -n headlamp --dry-run=client -o yaml | kubectl apply -f -
   ```

3. Mount it into your Headlamp deployment:

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

## Support & Contributing

Bug reports and feature requests via [GitHub Issues](https://github.com/openmcp-project/kiosk-headlamp-plugin/issues).
Contributions welcome — see the [Contribution Guidelines](https://github.com/openmcp-project/.github/blob/main/CONTRIBUTING.md).

## License

Copyright © Linux Foundation Europe. See [LICENSE](https://github.com/openmcp-project/kiosk-headlamp-plugin/blob/main/LICENSE).

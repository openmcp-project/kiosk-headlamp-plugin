#!/usr/bin/env bash
set -euo pipefail

# One-time cluster bootstrap. Sets up a kind cluster called 'plugin-dev' and
# deploys Headlamp with volume mounts for all known plugins pre-declared.
#
# For day-to-day iteration (rebuild + re-apply this plugin only) use:
#   ./apply-plugin.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CLUSTER_NAME="plugin-dev"
NAMESPACE="headlamp"
HEADLAMP_VERSION="0.42.0"
PORT=8090

CLUSTER_CREATED=false

cleanup() {
  echo ""
  echo "✗ Setup failed — cleaning up..."
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
  if $CLUSTER_CREATED; then
    echo "→ deleting kind cluster '${CLUSTER_NAME}'..."
    kind delete cluster --name "$CLUSTER_NAME" 2>/dev/null || true
  fi
}
trap cleanup ERR

# ── Prerequisites ─────────────────────────────────────────────────────────────
for cmd in kind kubectl helm npm curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

# ── Build this plugin ─────────────────────────────────────────────────────────
echo "→ building kiosk plugin..."
(cd "$REPO_DIR" && npm install && npm run build)

# ── Kind cluster ──────────────────────────────────────────────────────────────
if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "✓ kind cluster '${CLUSTER_NAME}' already exists"
else
  echo "→ creating kind cluster '${CLUSTER_NAME}'..."
  kind create cluster --name "$CLUSTER_NAME"
  CLUSTER_CREATED=true
fi

kubectl config use-context "kind-${CLUSTER_NAME}"

# ── Namespace ─────────────────────────────────────────────────────────────────
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# ── Plugin ConfigMaps ─────────────────────────────────────────────────────────
echo "→ applying kiosk plugin ConfigMap..."
kubectl create configmap kiosk-plugin \
  --from-file=main.js="${REPO_DIR}/dist/main.js" \
  -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Apply the crossplane plugin ConfigMap if it has been built by its own repo.
# To build it: in headlamp-plugin-crossplane run its build/apply script.
CROSSPLANE_CM="${SCRIPT_DIR}/configmap-crossplane-plugin.yaml"
if [[ -f "$CROSSPLANE_CM" ]]; then
  echo "→ applying crossplane plugin ConfigMap from ${CROSSPLANE_CM}..."
  kubectl apply -f "$CROSSPLANE_CM"
else
  echo "  (skipping crossplane plugin — ${CROSSPLANE_CM} not found)"
  echo "  To include it: copy or symlink the generated configmap-crossplane-plugin.yaml here."
fi

# ── Headlamp via Helm ─────────────────────────────────────────────────────────
helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/ --force-update &>/dev/null

echo "→ deploying Headlamp ${HEADLAMP_VERSION}..."
helm upgrade --install headlamp headlamp/headlamp \
  --version "$HEADLAMP_VERSION" \
  --namespace "$NAMESPACE" \
  --values - \
  --wait --timeout 300s <<'EOF'
replicaCount: 1
config:
  pluginsDir: /headlamp/plugins
  watchPlugins: false
  extraArgs:
    - -enable-dynamic-clusters
    - -session-ttl=86400
    - -in-cluster-context-name=main
initContainers:
  - name: flux-plugin
    image: ghcr.io/headlamp-k8s/headlamp-plugin-flux:latest
    imagePullPolicy: Always
    command:
      - /bin/sh
      - -c
      - mkdir -p /headlamp/plugins && cp -r /plugins/* /headlamp/plugins/
    volumeMounts:
      - name: headlamp-plugins
        mountPath: /headlamp/plugins
volumeMounts:
  - name: headlamp-plugins
    mountPath: /headlamp/plugins
  - name: kiosk-plugin
    mountPath: /headlamp/plugins/kiosk-mode/main.js
    subPath: main.js
  - name: crossplane-plugin
    mountPath: /headlamp/plugins/headlamp-crossplane/main.js
    subPath: main.js
volumes:
  - name: headlamp-plugins
    emptyDir: {}
  - name: kiosk-plugin
    configMap:
      name: kiosk-plugin
  - name: crossplane-plugin
    configMap:
      name: headlamp-crossplane-plugin
      optional: true
EOF

# ── Restart pod ───────────────────────────────────────────────────────────────
echo "→ restarting Headlamp pod..."
kubectl rollout restart deployment headlamp -n "$NAMESPACE"
kubectl rollout status deployment headlamp -n "$NAMESPACE" --timeout=120s

# ── Port-forward ──────────────────────────────────────────────────────────────
if lsof -ti :"$PORT" &>/dev/null; then
  echo "→ stopping existing process on port ${PORT}..."
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
fi

echo "→ starting port-forward on http://localhost:${PORT}..."
kubectl port-forward svc/headlamp "$PORT":80 -n "$NAMESPACE" &>/tmp/headlamp-portforward.log &
PF_PID=$!

for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/" | grep -qE "^(200|301|302)"; then
    break
  fi
  sleep 1
done

echo ""
echo "✓ Headlamp is running at http://localhost:${PORT}/"
echo "  Port-forward PID: ${PF_PID} (logged to /tmp/headlamp-portforward.log)"
echo "  To stop: kill ${PF_PID}"

#!/usr/bin/env bash
set -euo pipefail

# Fast iteration: rebuild the kiosk plugin and push it into the running
# plugin-dev cluster. Does not touch Helm or the cluster setup.
# Run setup-headlamp-dev.sh first if the cluster doesn't exist yet.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CLUSTER_NAME="plugin-dev"
NAMESPACE="headlamp"
PORT=8090

# ── Sanity check ──────────────────────────────────────────────────────────────
if ! kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "error: kind cluster '${CLUSTER_NAME}' does not exist." >&2
  echo "       Run ./setup-headlamp-dev.sh first." >&2
  exit 1
fi

kubectl config use-context "kind-${CLUSTER_NAME}"

# ── Build ─────────────────────────────────────────────────────────────────────
echo "→ building kiosk plugin..."
(cd "$REPO_DIR" && npm run build)

# ── Update ConfigMap ──────────────────────────────────────────────────────────
echo "→ updating ConfigMap..."
kubectl create configmap kiosk-plugin \
  --from-file=main.js="${REPO_DIR}/dist/main.js" \
  -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# ── Restart pod ───────────────────────────────────────────────────────────────
echo "→ restarting Headlamp pod..."
kubectl rollout restart deployment headlamp -n "$NAMESPACE"
kubectl rollout status deployment headlamp -n "$NAMESPACE" --timeout=60s

# ── Re-establish port-forward (pod restart closes the old one) ────────────────
if lsof -ti :"$PORT" &>/dev/null; then
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
fi

kubectl port-forward svc/headlamp "$PORT":80 -n "$NAMESPACE" &>/tmp/headlamp-portforward.log &
PF_PID=$!

for i in $(seq 1 20); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/" | grep -qE "^(200|301|302)"; then
    break
  fi
  sleep 1
done

echo ""
echo "✓ plugin updated — http://localhost:${PORT}/"
echo "  Port-forward PID: ${PF_PID} (logged to /tmp/headlamp-portforward.log)"
echo "  To stop: kill ${PF_PID}"

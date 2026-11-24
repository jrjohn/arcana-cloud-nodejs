#!/usr/bin/env bash
# Start a new Node.js service product from this repo's full layered skeleton.
#
#   tools/new-app.sh billing ~/Documents/projects/billing
#
# Copies the committed tree (git archive HEAD), so the new product keeps AGENTS.md,
# CLAUDE.md, tools/ (scaffolding + hook + arch-check), the Jenkinsfile and the arch-qube
# gate. Copying a few src/ folders into a fresh `npm init` loses all of that (AGENTS.md §1).
#
# No --no-demo option: the template has no demo-only module. User + Auth (+ OAuthToken) are
# the authentication the HTTP API, middleware, events and gRPC protos are built on, and the
# User feature is the worked example tools/new-feature.sh copies.
set -euo pipefail

[ $# -eq 2 ] || { echo "usage: $0 <app-name> <dest-dir>" >&2; exit 1; }
APP="$1"
DEST="$2"
[[ "$APP" =~ ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ ]] || { echo "app-name: lower-case letters/digits, words joined by '-' (it becomes the npm package, image and CI names)" >&2; exit 1; }
case "$APP" in arcana|arcana-cloud-nodejs|node-app) echo "app-name must differ from the template's own names" >&2; exit 1 ;; esac
[ ! -e "$DEST" ] || { echo "$DEST already exists — refusing to overwrite" >&2; exit 1; }
command -v perl >/dev/null || { echo "perl is required" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
git -C "$ROOT" diff --quiet HEAD -- AGENTS.md tools/ || echo "note: uncommitted changes in AGENTS.md/tools are NOT copied (git archive HEAD)" >&2

mkdir -p "$DEST"
git -C "$ROOT" archive HEAD | tar -x -C "$DEST"
SRC_SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
APP_US="$(printf '%s' "$APP" | tr '-' '_')"
cd "$DEST"

# ---- Product identity. Every place the template name is load-bearing:
#  1. npm package name arcana-cloud-nodejs (package.json, package-lock.json), Sonar key/name.
#  2. Jenkins APP_NAME / image "node-app", unit-test container node-app-test-*.
#  3. Per-host CI names: compose projects/containers/networks arcana-ci-node-*, the layered
#     lock ci-nodejs-layered, arch-qube container arcana-arch-qube-node-*, kind clusters
#     arcana-ci-node-* + namespace arcana-ci-kind-node-grpc, and the Jenkins post step that
#     deletes EVERY kind cluster matching "arcana-ci" — two products on one Jenkins host
#     must not share (or delete) each other's.
#  4. Deployment service/image names arcana-node-{controller,service,repository},
#     arcana-cloud-node, and the database name arcana_cloud (+ arcana_cloud_test).
# Not renamed on purpose: the gRPC proto package `arcana` (wire contract), arcana.boo (the
# registry / arch-qube image host), DB users/passwords, and the shared lock ci-kind-global.
# tools/ is excluded: these scripts describe the template and must keep working in the product.
TEXT_FILES="$(grep -rIl -e arcana -e node-app -e ci-nodejs . --exclude-dir=.git --exclude-dir=tools --exclude=CHANGELOG.md || true)"
printf '%s\n' "$TEXT_FILES" | xargs perl -pi -e "
    s/arcana-cloud-nodejs/${APP}/g;
    s/arcana-ci-kind-node-grpc/${APP}-ci-kind-grpc/g;
    s/arcana-ci-node-/${APP}-ci-/g;
    s/grep arcana-ci\\b/grep ${APP}-ci-/g;
    s/arcana-arch-qube-node-/${APP}-arch-qube-/g;
    s/\\bci-nodejs-layered\\b/${APP}-ci-layered/g;
    s/\\bnode-app\\b/${APP}/g;
    s/arcana-node-(controller|service|repository)/${APP}-\$1/g;
    s/arcana-cloud-node\\b/${APP}/g;
    s/\\barcana_cloud(?=\\b|_test)/${APP_US}/g;
"
LEFT="$(grep -rInE --exclude-dir=.git --exclude-dir=tools --exclude=CHANGELOG.md 'arcana-cloud-nodejs|\bnode-app\b|arcana-ci-node|arcana-arch-qube-node|arcana-node-|\barcana_cloud\b|grep arcana-ci\b' . || true)"
if [ -n "$LEFT" ]; then
    echo "new-app: template identities still present after rename:" >&2
    printf '%s\n' "$LEFT" | head >&2
    exit 1
fi

# ---- Fresh history: version 0.1.0, empty changelog.
rm -f CHANGELOG.md
printf '{\n  ".": "0.1.0"\n}\n' > .release-please-manifest.json
perl -0pi -e "s/(\"name\": \"${APP}\",\n\\s*\"version\": \")[^\"]+\"/\${1}0.1.0\"/g" package.json package-lock.json

cat >> AGENTS.md <<EOT

## Origin

Created from arcana-cloud-nodejs @ \`${SRC_SHA}\` by \`tools/new-app.sh\` (package, image, CI,
Sonar and database names renamed to \`${APP}\`). The layers, rules and definition of done
above apply unchanged. Remove template features you do not need through \`src/di/container.ts\`
and \`src/app.ts\`, not by flattening.
EOT

git init -q
tools/install-hooks.sh >/dev/null
git add -A
# --no-verify only for this import commit: every file counts as "added" here, so the hook
# would judge the template's own root files (src/app.ts, src/config.ts, src/index.ts,
# src/container.ts) and nested dirs (src/grpc/generated…) as new flat files. The template
# itself passes arch-check; every later commit in the product goes through the hook.
git -c user.name="${GIT_AUTHOR_NAME:-new-app}" -c user.email="${GIT_AUTHOR_EMAIL:-new-app@localhost}" \
    commit -q --no-verify -m "chore: start ${APP} from arcana-cloud-nodejs ${SRC_SHA}"

echo "created $DEST (${APP}) from arcana-cloud-nodejs ${SRC_SHA}; hooks: $(git config core.hooksPath)"
echo "next: cd $DEST && npm ci --legacy-peer-deps && npx prisma generate && tools/new-feature.sh <Name>"

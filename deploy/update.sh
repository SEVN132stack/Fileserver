#!/usr/bin/env bash
# Update-script voor een bare-metal/NAS-installatie met systemd.
# Maakt eerst een back-up, haalt de nieuwste code op, installeert dependencies
# en herstart de service. Rolt terug bij een mislukte start.
set -euo pipefail

SERVICE="${SERVICE:-fileserver}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

cd "$APP_DIR"
echo "==> Update in $APP_DIR (branch $BRANCH)"

PREV=$(git rev-parse HEAD)
echo "==> Huidige versie: $PREV"

echo "==> Back-up maken vóór update"
node -e "import('./src/config.js').then(async()=>{const {makeBackup}=await import('./src/backup.js');await makeBackup();console.log('back-up ok');})" || echo "waarschuwing: back-up mislukt"

echo "==> Nieuwste code ophalen"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> Dependencies installeren"
npm ci --omit=dev

echo "==> Service herstarten"
sudo systemctl restart "$SERVICE"

sleep 3
if systemctl is-active --quiet "$SERVICE"; then
  echo "==> Update geslaagd. Nieuwe versie: $(git rev-parse HEAD)"
else
  echo "!! Service startte niet — terugrollen naar $PREV"
  git reset --hard "$PREV"
  npm ci --omit=dev
  sudo systemctl restart "$SERVICE"
  echo "!! Teruggerold."
  exit 1
fi

#!/usr/bin/env bash
# Gefaseerde update voor een bare-metal/NAS-installatie met systemd (v3.45).
#
#  1. back-up maken;
#  2. nieuwe code klaarzetten in een aparte map (git worktree) + dependencies;
#  3. schaduw-instantie van de NIEUWE versie starten op een losse poort met een
#     tijdelijke kopie van de datastores en een zelftest draaien
#     (scripts/shadow-check.mjs) — de draaiende service merkt hier niets van;
#  4. alleen als de schaduw slaagt: overschakelen en de service herstarten;
#  5. na de herstart /health en /ready controleren; zo niet: automatisch terug.
#
# Opties (omgevingsvariabelen): SERVICE, BRANCH, APP_DIR, SHADOW_PORT,
# SKIP_SHADOW=1 (niet aanbevolen), DRY_RUN=1 (alleen stap 1-3, niet overschakelen),
# DEPLOY_FULL_BACKUP=1 (volledige ZIP van de opslag i.p.v. alleen de datastores),
# DEPLOY_BACKUP_KEEP=N (aantal lichte deploy-back-ups bewaren, standaard 10).
set -euo pipefail

SERVICE="${SERVICE:-fileserver}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SHADOW_PORT="${SHADOW_PORT:-18080}"
STAGING="$APP_DIR/.update-staging"

cd "$APP_DIR"
echo "==> Gefaseerde update in $APP_DIR (branch $BRANCH)"

PREV=$(git rev-parse HEAD)
echo "==> Huidige versie: $PREV"

cleanup_staging() {
  if [ -d "$STAGING" ]; then
    git worktree remove --force "$STAGING" 2>/dev/null || rm -rf "$STAGING"
  fi
  git worktree prune 2>/dev/null || true
}
trap cleanup_staging EXIT

# Datamap van de echte installatie (DATA_DIR uit .env, anders de app-map).
DATA_DIR_REAL="$APP_DIR"
if [ -f "$APP_DIR/.env" ] && grep -q '^DATA_DIR=' "$APP_DIR/.env"; then
  DATA_DIR_REAL=$(grep '^DATA_DIR=' "$APP_DIR/.env" | tail -n 1 | cut -d= -f2-)
fi

echo "==> [1/5] Back-up maken"
if [ "${DEPLOY_FULL_BACKUP:-0}" = "1" ]; then
  # Volledige ZIP van de opslag (traag en groot bij veel data).
  node -e "import('./src/config.js').then(async()=>{const {makeBackup}=await import('./src/backup.js');await makeBackup();console.log('back-up ok');})" || echo "waarschuwing: back-up mislukt"
else
  # Lichte back-up: alleen de datastores die een code-update kan raken
  # (gebruikers, instellingen, sleutels, audit-log). De bestanden in de opslag
  # verandert een update niet; die vallen onder de geplande volledige back-up.
  BK_DIR=$(grep '^BACKUP_DIR=' "$APP_DIR/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- || true)
  BK_DIR="${BK_DIR:-backups}"; case "$BK_DIR" in /*) ;; *) BK_DIR="$APP_DIR/$BK_DIR" ;; esac
  mkdir -p "$BK_DIR"
  BK_FILE="$BK_DIR/deploy-$(date -u +%Y-%m-%dT%H-%M-%SZ)-${PREV:0:7}.tar.gz"
  (
    cd "$DATA_DIR_REAL"
    files=()
    for f in *.json .env host.key audit.log audit.log.chain authorized_keys; do
      case "$f" in package.json|package-lock.json|shadow-report.json) continue ;; esac
      [ -e "$f" ] && files+=("$f")
    done
    umask 077
    tar -czf "$BK_FILE" "${files[@]}"
  ) && echo "back-up ok: $BK_FILE ($(du -h "$BK_FILE" | cut -f1))" || echo "waarschuwing: back-up mislukt"
  # Laatste ${DEPLOY_BACKUP_KEEP:-10} deploy-back-ups bewaren.
  ls -1t "$BK_DIR"/deploy-*.tar.gz 2>/dev/null | tail -n +"$(( ${DEPLOY_BACKUP_KEEP:-10} + 1 ))" | xargs -r rm -f
fi

echo "==> [2/5] Nieuwe code klaarzetten"
git fetch origin "$BRANCH"
NEXT=$(git rev-parse "origin/$BRANCH")
if [ "$NEXT" = "$PREV" ]; then
  echo "==> Al up-to-date ($NEXT)."
  exit 0
fi
cleanup_staging
git worktree add --detach "$STAGING" "$NEXT"
(cd "$STAGING" && npm ci --omit=dev)

if [ "${SKIP_SHADOW:-0}" = "1" ]; then
  echo "!! [3/5] Schaduwtest OVERGESLAGEN (SKIP_SHADOW=1)"
else
  echo "==> [3/5] Schaduw-instantie van $NEXT testen op poort $SHADOW_PORT"
  if ! node "$STAGING/scripts/shadow-check.mjs" --dir "$STAGING" --data "$DATA_DIR_REAL" --port "$SHADOW_PORT" > "$APP_DIR/shadow-report.json"; then
    echo "!! Schaduwtest mislukt — er wordt NIET overgeschakeld. De huidige versie blijft draaien."
    echo "!! Rapport: $APP_DIR/shadow-report.json"
    exit 1
  fi
  echo "==> Schaduwtest geslaagd (rapport: $APP_DIR/shadow-report.json)"
fi

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "==> DRY_RUN: niet overgeschakeld."
  exit 0
fi

echo "==> [4/5] Overschakelen naar $NEXT"
git reset --hard "$NEXT"
npm ci --omit=dev
sudo systemctl restart "$SERVICE"

echo "==> [5/5] Controle na herstart"
PORT=$(grep '^WEB_PORT=' "$APP_DIR/.env" 2>/dev/null | tail -n 1 | cut -d= -f2-)
PORT="${PORT:-8080}"
healthy=0
for _ in $(seq 1 20); do
  sleep 1
  if systemctl is-active --quiet "$SERVICE" && curl -fsk "http://127.0.0.1:$PORT/ready" > /dev/null 2>&1; then
    healthy=1
    break
  fi
done
if [ "$healthy" = "1" ]; then
  echo "==> Update geslaagd. Nieuwe versie: $(git rev-parse HEAD)"
else
  echo "!! Nieuwe versie niet gezond — terugrollen naar $PREV"
  git reset --hard "$PREV"
  npm ci --omit=dev
  sudo systemctl restart "$SERVICE"
  echo "!! Teruggerold."
  exit 1
fi

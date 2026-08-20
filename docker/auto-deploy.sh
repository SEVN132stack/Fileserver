#!/usr/bin/env bash
# Haalt nieuwe commits van de default branch op en rolt ze uit door lokaal te
# bouwen — geen registry, geen Watchtower, geen GitHub-runner.
#
# Waarom niet via een image uit GHCR: die pijplijn had een GitHub-hosted runner
# nodig om te bouwen en te pushen, en dat is precies het verbruik waar we
# vanaf wilden. De bron blijft GitHub (git), alleen het bouwen gebeurt hier.
#
# Crontab (voorbeeld, elk uur op :20):
#   20 * * * * /pad/naar/Fileserver/docker/auto-deploy.sh >> /var/log/fileserver-deploy.log 2>&1
#
# Gebruik:
#   bash docker/auto-deploy.sh              normale run
#   bash docker/auto-deploy.sh --dry-run    alleen melden wat 'ie zou doen
#   bash docker/auto-deploy.sh --negeer-ci  CI-poort overslaan
#
# Vangrails:
#   - draait nooit twee keer tegelijk (flock)
#   - weigert bij lokale wijzigingen in getrackte bestanden
#   - weigert als de historie uiteen is gelopen (geen force)
#   - rolt alleen commits uit waarvan de CI groen is
#   - controleert na afloop of de app antwoordt
set -uo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAK="${DEPLOY_TAK:-main}"
LOCK="/var/lock/fileserver-deploy.lock"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1:8080/}"

cd "$APP_ROOT" || exit 1

DRY=0; NEGEER_CI=0
for ARG in "$@"; do
    case "$ARG" in
        --dry-run)   DRY=1 ;;
        --negeer-ci) NEGEER_CI=1 ;;
    esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Eén tegelijk ──
exec 9>"$LOCK"
flock -n 9 || { log "Andere deploy draait nog — overgeslagen."; exit 0; }

# ── Nieuwe commits? ──
git fetch origin "$TAK" -q 2>/dev/null || { log "git fetch mislukt."; exit 1; }
AANTAL=$(git rev-list --count "HEAD..origin/${TAK}")
[ "$AANTAL" -eq 0 ] && { log "Geen nieuwe commits op origin/${TAK} — niets te doen."; exit 0; }

# ── Vangrails vóór we iets aanraken ──
TAK_NU=$(git rev-parse --abbrev-ref HEAD)
[ "$TAK_NU" != "$TAK" ] && { log "Werkmap staat op '${TAK_NU}', niet op '${TAK}' — afgebroken."; exit 1; }

VUIL=$(git status --porcelain --untracked-files=no)
if [ -n "$VUIL" ]; then
    log "Lokale wijzigingen in getrackte bestanden — afgebroken:"
    printf '%s\n' "$VUIL" | head -10
    exit 1
fi

if [ "$(git rev-list --count "origin/${TAK}"..HEAD)" -gt 0 ]; then
    log "Historie uiteengelopen met origin/${TAK} — fast-forward kan niet; afgebroken."
    exit 1
fi

# ── CI-poort ───────────────────────────────────────────────────────────────
# Rolt alleen uit wat de CI groen heeft bevonden.
#
#   groen  alles klaar en geslaagd        → uitrollen
#   rood   minstens één failure/cancelled → afbreken
#   bezig  loopt nog                      → stil overslaan, volgende tick
#   geen   niets gevonden                 → zie CI_POORT (soepel|streng)
#
# Twee bronnen, in deze volgorde:
#   1. de Checks-API   (fine-grained token met Checks: read)
#   2. de Actions-API  (fine-grained token met Actions: read)
# Welke van de twee je token mag, hangt af van wat GitHub in jouw
# tokeninstellingen aanbiedt; de eerste die antwoordt wint. Geeft de ene een
# 403, dan wordt de andere geprobeerd in plaats van meteen op te geven.
API_CODE=0
_api() {
    local pad="$1" tmp code
    tmp="$(mktemp)"
    code=$(curl -s -o "$tmp" -w '%{http_code}' --max-time 20 \
        -H "Authorization: Bearer ${CI_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/${CI_REPO}/${pad}")
    API_CODE="$code"
    cat "$tmp"; rm -f "$tmp"
}

_classificeer() {
    python3 - "$1" <<'PYEOF'
import json, sys
try:
    d = json.loads(sys.argv[1])
except Exception:
    print("geen"); raise SystemExit

items = d.get("check_runs")
if items is None:
    items = d.get("workflow_runs") or []

if not items:
    print("geen")
elif any(i.get("status") != "completed" for i in items):
    print("bezig")
elif any(i.get("conclusion") not in ("success", "neutral", "skipped") for i in items):
    print("rood")
else:
    print("groen")
PYEOF
}

ci_stand() {
    local sha="$1" uit stand
    CI_TOKEN=$(grep -E '^\s*DEPLOY_GITHUB_TOKEN\s*=' "${APP_ROOT}/.env" 2>/dev/null |
               head -1 | cut -d= -f2- | tr -d ' "'"'"'')
    [ -z "$CI_TOKEN" ] && { echo "geen"; return; }

    CI_REPO=$(git config --get remote.origin.url |
              sed -E 's#^.*github\.com[:/]##; s#\.git$##')
    [ -z "$CI_REPO" ] && { echo "geen"; return; }

    uit=$(_api "commits/${sha}/check-runs?per_page=100")
    if [ "$API_CODE" = "200" ]; then
        stand=$(_classificeer "$uit")
        [ "$stand" != "geen" ] && { echo "$stand"; return; }
    fi

    uit=$(_api "actions/runs?head_sha=${sha}&per_page=100")
    if [ "$API_CODE" = "200" ]; then
        _classificeer "$uit"; return
    fi

    echo "geen"
}

DOEL_SHA=$(git rev-parse "origin/${TAK}")
CI_POORT=$(grep -E '^\s*CI_POORT\s*=' "${APP_ROOT}/.env" 2>/dev/null |
           head -1 | cut -d= -f2- | tr -d ' "'"'"'')
CI_POORT="${CI_POORT:-soepel}"

if [ "$NEGEER_CI" = "0" ]; then
    case "$(ci_stand "$DOEL_SHA")" in
        groen) log "CI groen voor ${DOEL_SHA:0:8}." ;;
        bezig) log "CI draait nog voor ${DOEL_SHA:0:8} — volgende tick pakt het op."; exit 0 ;;
        rood)  log "CI is rood voor ${DOEL_SHA:0:8} — deploy afgebroken."; exit 1 ;;
        geen)
            if [ "$CI_POORT" = "streng" ]; then
                log "Geen CI-run gevonden voor ${DOEL_SHA:0:8} en CI_POORT=streng — afgebroken."
                exit 1
            fi
            log "Geen CI-run gevonden voor ${DOEL_SHA:0:8} (CI_POORT=soepel) — toch uitrollen."
            ;;
    esac
fi

COMMITS=$(git log --no-merges --format='• %h %s' HEAD.."origin/${TAK}" | head -10)

if [ "$DRY" = "1" ]; then
    log "[dry-run] zou ${AANTAL} commit(s) uitrollen:"
    printf '%s\n' "$COMMITS"
    exit 0
fi

log "${AANTAL} nieuwe commit(s) op origin/${TAK} — uitrollen."
printf '%s\n' "$COMMITS"

if ! git merge --ff-only "origin/${TAK}" -q; then
    log "Fast-forward mislukt — er is niets uitgerold."
    exit 1
fi

# ── Bouwen en starten ──
# --pull houdt de base-images vers; zonder dat blijft een oude FROM-laag
# hangen tot iemand er handmatig achteraan gaat.
log "Image bouwen..."
if ! docker compose build --pull; then
    log "Build mislukt — containers draaien nog op de vorige versie."
    exit 1
fi

log "Containers herstarten..."
if ! docker compose up -d; then
    log "compose up mislukt."
    exit 1
fi

# ── Controle achteraf ──
log "Wachten tot de app antwoordt (${HEALTH_URL})..."
for i in $(seq 1 30); do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo 000)
    case "$CODE" in
        2*|3*) log "App antwoordt (HTTP ${CODE}) — deploy klaar op $(git rev-parse --short=8 HEAD)."; exit 0 ;;
    esac
    sleep 2
done

log "App antwoordt niet na 60s (laatste code: ${CODE}) — CONTROLEER DIT."
log "Terugrollen kan met: git reset --hard HEAD~1 && docker compose up -d --build"
exit 1

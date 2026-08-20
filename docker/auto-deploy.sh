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
# Rolt alleen uit wat de CI groen heeft bevonden. De CI draait op de
# self-hosted runner, dus dat kost geen Actions-minuten.
#
#   groen  alle check-runs klaar en geslaagd  → uitrollen
#   rood   minstens één failure/cancelled     → afbreken
#   bezig  checks lopen nog                   → stil overslaan, volgende tick
#   geen   geen check-run gevonden            → zie CI_POORT (soepel|streng)
#
# Token uit .env: DEPLOY_GITHUB_TOKEN, fine-grained met Contents + Checks: read.
ci_stand() {
    local sha="$1" token uit repo
    token=$(grep -E '^\s*DEPLOY_GITHUB_TOKEN\s*=' "${APP_ROOT}/.env" 2>/dev/null |
            head -1 | cut -d= -f2- | tr -d ' "'"'"'')
    [ -z "$token" ] && { echo "geen"; return; }

    repo=$(git config --get remote.origin.url |
           sed -E 's#^.*github\.com[:/]##; s#\.git$##')
    [ -z "$repo" ] && { echo "geen"; return; }

    uit=$(curl -fsS --max-time 20 \
        -H "Authorization: Bearer ${token}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100" 2>/dev/null) \
        || { echo "geen"; return; }

    python3 - "$uit" <<'PYEOF'
import json, sys
try:
    runs = json.loads(sys.argv[1]).get("check_runs", [])
except Exception:
    print("geen"); raise SystemExit
if not runs:
    print("geen")
elif any(r.get("status") != "completed" for r in runs):
    print("bezig")
elif any(r.get("conclusion") not in ("success", "neutral", "skipped") for r in runs):
    print("rood")
else:
    print("groen")
PYEOF
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

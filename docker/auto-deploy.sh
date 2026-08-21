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

# Meldingen naar Discord. Ontbreekt de webhook in .env, dan doet meld niets.
# shellcheck source=/dev/null
. "${APP_ROOT}/docker/meld.sh"
APP_NAAM="$(basename "$APP_ROOT")"

DRY=0; NEGEER_CI=0
for ARG in "$@"; do
    case "$ARG" in
        --dry-run)   DRY=1 ;;
        --negeer-ci) NEGEER_CI=1 ;;
    esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ── Eén tegelijk ──
# Vast pad voor het API-antwoord van de CI-poort: ci_stand draait in een
# subshell en kan het pad dus niet terugmelden.
CI_ANTWOORD="$(mktemp)"
trap 'rm -f "$CI_ANTWOORD"' EXIT

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
#   1. de Checks-API   (token met Checks: read)
#   2. de Actions-API  (token met Actions: read)
# Welke van de twee je token mag verschilt per token; de eerste die antwoordt
# wint. Een 403 op de ene is dus geen stille uitschakeling van de poort.
#
# _api schrijft het antwoord naar een bestand en geeft de HTTP-code terug via
# stdout. Niet via een globale variabele: de aanroep gebeurt in $( ), dus in
# een subshell, en een toekenning daarbinnen bereikt de aanroeper nooit.
_api() {
    local pad="$1" doel="$2"
    curl -s -o "$doel" -w '%{http_code}' --max-time 20 \
        -H "Authorization: Bearer ${CI_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/${CI_REPO}/${pad}"
}

_classificeer() {
    python3 - "$1" <<'PYEOF'
import json, sys
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
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
    local sha="$1" tmp code stand
    # `\S` na het =: een lege regel (zoals in .env.example) telt niet mee.
    # En `tail -1`: staat een sleutel twee keer in .env, dan wint de laatste —
    # zoals ook gebeurt wanneer een .env wordt ingelezen. Met head -1 won de
    # oudste regel, wat precies de verkeerde is als je onderaan iets toevoegt.
    CI_TOKEN=$(grep -E '^\s*DEPLOY_GITHUB_TOKEN\s*=\s*\S' "${APP_ROOT}/.env" 2>/dev/null |
               tail -1 | cut -d= -f2- | tr -d ' "'"'"'')
    [ -z "$CI_TOKEN" ] && { echo "geen"; return; }

    CI_REPO=$(git config --get remote.origin.url |
              sed -E 's#^.*github\.com[:/]##; s#\.git$##')
    [ -z "$CI_REPO" ] && { echo "geen"; return; }

    # Schrijft naar het pad dat bovenin het script is vastgelegd, niet naar
    # een eigen mktemp: ci_stand draait in $( ), dus een pad dat hier wordt
    # bedacht bereikt de aanroeper nooit. Het bestand zelf wel — daarom leest
    # ci_samenvatting straks hetzelfde antwoord zonder tweede API-aanroep.
    tmp="$CI_ANTWOORD"

    code=$(_api "commits/${sha}/check-runs?per_page=100" "$tmp")
    if [ "$code" = "200" ]; then
        stand=$(_classificeer "$tmp")
        [ "$stand" != "geen" ] && { echo "$stand"; return; }
    fi

    code=$(_api "actions/runs?head_sha=${sha}&per_page=100" "$tmp")
    if [ "$code" = "200" ]; then
        _classificeer "$tmp"; return
    fi

    echo "geen"
}

# ── CI-samenvatting ────────────────────────────────────────────────────────
# Wat de CI voor deze commit heeft gecontroleerd, voor in de melding. Gebruikt
# het antwoord dat ci_stand al ophaalde; alleen bij de Actions-API is er één
# extra aanroep nodig, want die geeft de run maar niet de losse jobs.
#
# Zonder deze regels zegt een melding wel "CI groen", maar niet waarop —
# en juist bij rood wil je zien wélke job faalde.
_ci_auth() {
    CI_TOKEN=$(grep -E '^\s*DEPLOY_GITHUB_TOKEN\s*=\s*\S' "${APP_ROOT}/.env" 2>/dev/null |
               tail -1 | cut -d= -f2- | tr -d ' "'"'"'')
    CI_REPO=$(git config --get remote.origin.url |
              sed -E 's#^.*github\.com[:/]##; s#\.git$##')
}

_ci_formatteer() {
    python3 - "$1" <<'PYEOF'
import json, sys
from datetime import datetime

TEKEN = {"success": "✓", "failure": "✗", "cancelled": "⊘", "skipped": "–",
         "neutral": "–", "timed_out": "⏱", "action_required": "!"}

def duur(a, b):
    if not a or not b:
        return ""
    try:
        d = datetime.fromisoformat(b.replace("Z", "+00:00")) - datetime.fromisoformat(a.replace("Z", "+00:00"))
    except ValueError:
        return ""
    s = int(d.total_seconds())
    if s <= 0:
        return ""
    return f" ({s}s)" if s < 90 else f" ({s // 60}m{s % 60:02d})"

try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
except Exception:
    raise SystemExit

items = d.get("check_runs")
if items is None:
    items = d.get("jobs") or d.get("workflow_runs") or []

print("\n".join(
    f"{TEKEN.get(i.get('conclusion') or i.get('status') or '?', '•')} {i.get('name', '?')}"
    f"{duur(i.get('started_at') or i.get('run_started_at'), i.get('completed_at') or i.get('updated_at'))}"
    for i in items
))
PYEOF
}

ci_samenvatting() {
    [ -s "$CI_ANTWOORD" ] || return 0
    # Token en repo opnieuw bepalen: ci_stand zette ze in een subshell, dus
    # hier zijn ze leeg. Zonder dit valt de jobs-aanroep terug op een 401 en
    # zie je alleen "CI" in plaats van de losse jobs.
    _ci_auth

    # De Actions-API geeft de run, niet de jobs. Eén extra aanroep levert de
    # namen op; lukt dat niet, dan blijft de regel van de run zelf staan.
    if grep -q '"workflow_runs"' "$CI_ANTWOORD" 2>/dev/null; then
        local rid jobs
        rid=$(python3 -c "import json,sys;r=json.load(open(sys.argv[1])).get('workflow_runs') or [];print(r[0]['id'] if r else '')" "$CI_ANTWOORD" 2>/dev/null)
        if [ -n "$rid" ]; then
            jobs="$(mktemp)"
            if [ "$(_api "actions/runs/${rid}/jobs?per_page=100" "$jobs")" = "200" ]; then
                _ci_formatteer "$jobs"; rm -f "$jobs"; return 0
            fi
            rm -f "$jobs"
        fi
    fi
    _ci_formatteer "$CI_ANTWOORD"
}

DOEL_SHA=$(git rev-parse "origin/${TAK}")
CI_POORT=$(grep -E '^\s*CI_POORT\s*=\s*\S' "${APP_ROOT}/.env" 2>/dev/null |
           tail -1 | cut -d= -f2- | tr -d ' "'"'"'')
CI_POORT="${CI_POORT:-soepel}"

if [ "$NEGEER_CI" = "0" ]; then
    case "$(ci_stand "$DOEL_SHA")" in
        groen) log "CI groen voor ${DOEL_SHA:0:8}." ;;
        bezig) log "CI draait nog voor ${DOEL_SHA:0:8} — volgende tick pakt het op."; exit 0 ;;
        rood)
            log "CI is rood voor ${DOEL_SHA:0:8} — deploy afgebroken."
            meld "🚫 ${APP_NAAM}: deploy geblokkeerd — CI rood" \
                "Commit ${DOEL_SHA:0:8} haalde de CI niet, dus er is niets uitgerold.

$(ci_samenvatting)" "$KLEUR_ROOD"
            exit 1
            ;;
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
CI_UITSLAG="$(ci_samenvatting)"
meld "🚀 ${APP_NAAM}: deploy gestart (${AANTAL} commit(s))" \
    "Nieuw op ${TAK}:

${COMMITS}

De CI controleerde:
${CI_UITSLAG:-(geen uitslag opgehaald)}

Bouwen, herstarten en daarna de rooktest." "$KLEUR_BLAUW"
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
#
# De buildoutput gaat naar een eigen bestand. In het deploy-log stond anders
# honderden regels buildkit-uitvoer tussen de vier regels die je wilt lezen,
# en dan is niet meer te zien wat er wanneer is uitgerold. Bij een fout worden
# de laatste regels alsnog in het deploy-log herhaald, zodat je voor de
# diagnose niet twee bestanden nodig hebt.
BUILD_LOG="${DEPLOY_BUILD_LOG:-/var/log/$(basename "$APP_ROOT" | tr "[:upper:]" "[:lower:]")-build.log}"
log "Image bouwen (uitvoer in ${BUILD_LOG})..."
if ! docker compose build --pull >>"$BUILD_LOG" 2>&1; then
    log "Build mislukt — containers draaien nog op de vorige versie. Laatste regels:"
    tail -20 "$BUILD_LOG" | sed 's/^/    /'
    meld "❌ ${APP_NAAM}: build mislukt" \
        "De containers draaien nog op de vorige versie; er is niets vervangen.

Laatste regels staan in ${BUILD_LOG}." "$KLEUR_ROOD"
    exit 1
fi

log "Containers herstarten..."
if ! docker compose up -d >>"$BUILD_LOG" 2>&1; then
    log "compose up mislukt. Laatste regels:"
    tail -20 "$BUILD_LOG" | sed 's/^/    /'
    meld "❌ ${APP_NAAM}: containers starten mislukt" \
        "compose up gaf een fout. Laatste regels staan in ${BUILD_LOG}." "$KLEUR_ROOD"
    exit 1
fi

# ── Controle achteraf ──
log "Wachten tot de app antwoordt (${HEALTH_URL})..."
LEEFT=0
for i in $(seq 1 30); do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo 000)
    case "$CODE" in
        2*|3*) LEEFT=1; break ;;
    esac
    sleep 2
done

HUIDIG="$(git rev-parse --short=8 HEAD)"

if [ "$LEEFT" = "0" ]; then
    log "App antwoordt niet na 60s (laatste code: ${CODE}) — CONTROLEER DIT."
    log "Terugrollen: git reset --hard HEAD~1 && docker compose up -d --build"
    meld "❌ ${APP_NAAM}: app antwoordt niet" \
        "Na de deploy van ${HUIDIG} gaf ${HEALTH_URL} 60 seconden lang geen antwoord (laatste code: ${CODE}).

Terugrollen: `git reset --hard HEAD~1 && docker compose up -d --build`" "$KLEUR_ROOD"
    exit 1
fi

log "App antwoordt (HTTP ${CODE})."

# De rooktest is de echte poort: HTTP 200 zegt alleen dat er iets luistert, niet
# dat de app werkt.
if [ -x "${APP_ROOT}/docker/smoke.sh" ]; then
    log "Rooktest draaien..."
    ROOK="$(bash "${APP_ROOT}/docker/smoke.sh" 2>&1)"
    ROOK_RC=$?
    printf '%s\n' "$ROOK" | sed 's/^/    /'
    # Kleurcodes eruit: Discord toont die anders letterlijk.
    ROOK_KAAL="$(printf '%s' "$ROOK" | sed -e 's/\x1b\[[0-9;]*m//g')"
    if [ "$ROOK_RC" -ne 0 ]; then
        log "Rooktest gezakt — deploy staat wel live. CONTROLEER DIT."
        meld "⚠️ ${APP_NAAM}: rooktest gezakt na deploy" \
            "Commit ${HUIDIG} staat live en de app antwoordt, maar de rooktest is niet groen.

\`\`\`
${ROOK_KAAL}
\`\`\`" "$KLEUR_ORANJE"
        exit 1
    fi
    log "Rooktest groen."
    meld "✅ ${APP_NAAM}: deploy klaar" \
        "Commit ${HUIDIG} staat live, app antwoordt (HTTP ${CODE}) en de rooktest is groen.

De CI controleerde:
${CI_UITSLAG:-(geen uitslag opgehaald)}

\`\`\`
${ROOK_KAAL}
\`\`\`" "$KLEUR_GROEN"
else
    meld "✅ ${APP_NAAM}: deploy klaar" \
        "Commit ${HUIDIG} staat live en de app antwoordt (HTTP ${CODE}). Geen rooktest aanwezig." "$KLEUR_GROEN"
fi

log "Deploy klaar op ${HUIDIG}."
exit 0

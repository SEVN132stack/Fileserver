#!/usr/bin/env bash
# Rooktest: in een paar seconden vaststellen dat de app na een deploy echt
# leeft. Draait tegen de draaiende container, niet tegen een checkout.
#
# Exitcode 0 = alles groen. De deploy gebruikt dat als blokkade.
#
# Gebruik: bash docker/smoke.sh
set -uo pipefail

APP_URL="${SMOKE_URL:-http://127.0.0.1:8080}"
SFTP_HOST="${SMOKE_SFTP_HOST:-127.0.0.1}"
SFTP_PORT="${SMOKE_SFTP_PORT:-2222}"
CONTAINER="${SMOKE_CONTAINER:-fileserver}"
FOUTEN=0

groen() { printf '  \033[0;32m✓\033[0m %s\n' "$1"; }
rood()  { printf '  \033[0;31m✗\033[0m %s\n' "$1"; FOUTEN=$((FOUTEN + 1)); }

http() {
    local code
    code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 "${APP_URL}$1" 2>/dev/null)
    [ -z "$code" ] && code=000
    if printf '%s' "$2" | tr '|' '\n' | grep -qx "$code"; then
        groen "$3 (HTTP $code)"
    else
        rood "$3 — HTTP $code (verwacht $2)"
    fi
}

echo "Rooktest ${APP_URL}"

# 1. /health is de enige route die vóór de auth- en geo-filters komt, dus die
#    bewijst dat het proces zelf leeft.
http "/health" "200" "Health-endpoint"

# 2. De web-UI staat er wel achter: een 200 of een redirect naar login is goed,
#    een 500 niet.
http "/" "200|302|401" "Web-UI"

# 3. /ready hoort pas 200 te geven als de app klaar is met opstarten.
http "/ready" "200|503" "Readiness-endpoint"

# 4. Versie uit /health: bewijst dat het antwoord echte JSON is en niet een
#    foutpagina van een proxy die toevallig 200 geeft.
VERSIE=$(curl -sk --max-time 10 "${APP_URL}/health" 2>/dev/null |
         sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
if [ -n "$VERSIE" ]; then
    groen "Versie gemeld: ${VERSIE}"
else
    rood "Geen versie in /health — antwoord is geen geldige JSON"
fi

# 5. SFTP luistert. De web-UI kan prima werken terwijl de SSH-server niet
#    opkomt, en dan is de helft van de app stuk.
if timeout 5 bash -c "</dev/tcp/${SFTP_HOST}/${SFTP_PORT}" 2>/dev/null; then
    groen "SFTP-poort ${SFTP_PORT} open"
else
    rood "SFTP-poort ${SFTP_PORT} niet bereikbaar"
fi

# 6. Container draait en is gezond. "Up" alleen is niet genoeg: dat geldt ook
#    voor een container die elke tien seconden herstart.
STAAT=$(docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}n.v.t.{{end}}' "$CONTAINER" 2>/dev/null)
[ -z "$STAAT" ] && STAAT="ontbreekt"
case "$STAAT" in
    running/healthy|running/n.v.t.) groen "Container ${CONTAINER} (${STAAT})" ;;
    *) rood "Container ${CONTAINER} — ${STAAT}" ;;
esac

echo
if [ "$FOUTEN" -eq 0 ]; then
    echo "Rooktest groen."
    exit 0
fi
echo "Rooktest: ${FOUTEN} controle(s) gezakt."
exit 1

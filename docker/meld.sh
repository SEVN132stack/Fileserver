# ============================================================================
# Discord-webhook helper — POSIX sh.
#
# Gebruik:  . "$(dirname "$0")/meld.sh"
#           meld "Titel" "Regel 1\nRegel 2" "$KLEUR_ROOD"
#
# De URL komt uit DISCORD_WEBHOOK_URL in de .env van de app. Elke app heeft
# een eigen webhook: één kanaal met vier apps door elkaar leest niet, en je
# wilt een zorgportaal-melding niet tussen de mediaserver-ruis kwijtraken.
#
# Ontbreekt de webhook, dan doet meld niets. Meldingen zijn een extraatje;
# een deploy mag er niet op stuklopen.
# ============================================================================

KLEUR_GROEN=3066993
KLEUR_ROOD=15158332
KLEUR_ORANJE=15105570
KLEUR_BLAUW=3447003

_MELD_ROOT="${APP_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL:-$(grep -hm1 '^DISCORD_WEBHOOK_URL=' "${_MELD_ROOT}/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")}"

meld() {
    [ -z "$DISCORD_WEBHOOK" ] && return 0
    _m_titel=$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    _m_desc=$(printf '%s' "$2" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    _m_kleur="${3:-$KLEUR_GROEN}"
    curl -sf -m 15 -H 'Content-Type: application/json' \
        -d "{\"embeds\":[{\"title\":\"${_m_titel}\",\"description\":\"${_m_desc}\",\"color\":${_m_kleur}}]}" \
        "$DISCORD_WEBHOOK" >/dev/null 2>&1 || true
}

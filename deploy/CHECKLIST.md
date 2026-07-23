# Deploy-checklist — `transfer.zepta-nas.nl`

Praktische checklist voor een veilige productie-deploy achter Caddy (TLS-terminatie).
Doorloop de stappen; de aanbevolen `.env` staat onderaan.

## 1. Vooraf

- [ ] Node.js 22 geïnstalleerd (`node -v`).
- [ ] Aparte, niet-root systeemgebruiker voor de service.
- [ ] DNS: `transfer.zepta-nas.nl` wijst naar de NAS.
- [ ] Poorten: 443 (Caddy) open naar buiten; **8080 (web) niet** rechtstreeks open;
      2222 (SFTP) alleen open als je SFTP van buitenaf wilt.

## 2. At-rest-encryptie (aanbevolen, buiten de app)

- [ ] Opslagvolume versleuteld met **LUKS** (of eCryptfs/gocryptfs voor één map).
      Zie `deploy/at-rest-encryption.md`. Zet daarna `STORAGE_DIR` naar het gemounte volume.

## 3. Geheimen

- [ ] `AUTH_PASS` en `SESSION_SECRET` sterk en uniek (of via `*_FILE`/systemd-credentials —
      zie `deploy/secrets.md`).
- [ ] `.env` staat op mode `600` en **nooit** in git (staat al in `.gitignore`).
- [ ] Brevo/VirusTotal-sleutels alleen in `.env`.

## 4. TLS via Caddy

- [ ] `Caddyfile` (zie `deploy/Caddyfile`) reverse-proxyt naar `127.0.0.1:8080`.
- [ ] In `.env`: `TLS_ENABLED=false` (Caddy termineert TLS) **en** `COOKIE_SECURE=true`
      (anders mist de sessie-cookie de Secure-vlag) **en** `TRUST_PROXY=1`.
- [ ] `APP_BASE_URL=https://transfer.zepta-nas.nl` (voor reset-links).
- [ ] `WEBAUTHN_RP_ID=transfer.zepta-nas.nl` en `WEBAUTHN_ORIGIN=https://transfer.zepta-nas.nl`
      als je passkeys wilt.

## 5. Beveiliging aanzetten

- [ ] `SESSION_BIND=ua` (bindt de cookie aan de browser; `both` logt mobiele gebruikers
      uit bij een IP-wissel — `ua` is de veilige middenweg).
- [ ] `REAUTH_WINDOW_MS=300000` (step-up voor gevoelige beheeracties — staat al aan).
- [ ] `REQUIRE_2FA=admin` (of `all`) — 2FA server-side afgedwongen.
- [ ] `MAX_UPLOAD_BYTES` instellen (bijv. 5 GB) tegen schijf-vol.
- [ ] `PASSWORD_HIBP=true` — gelekte wachtwoorden weigeren (vereist uitgaand HTTPS).
- [ ] Optioneel `DLP_ACTION=flag` — gevoelige data in uploads markeren.
- [ ] Optioneel break-glass: `BREAKGLASS_USER`/`BREAKGLASS_PASSWORD` (lang, uniek, offline bewaard).
- [ ] Rate-limits ruim instellen: `API_RATE_MAX=600`, `DOWNLOAD_RATE_MAX=120` (per minuut).

## 6. Back-up & onderhoud

- [ ] `BACKUP_INTERVAL_MINUTES` > 0, `BACKUP_PASSWORD` gezet (versleutelde ZIP),
      en `BACKUP_UPLOAD_CMD` voor een off-site kopie (zie `deploy/offsite-backup.md`).
- [ ] `BACKUP_RESTORE_TEST=true` — valideert de back-up echt na afloop.
- [ ] `ALERT_EMAIL` gezet — je krijgt mail bij schijf vol, mislukte back-up, DLP,
      break-glass, ransomware-detectie, config-drift.
- [ ] `CONFIG_DRIFT_INTERVAL=15` — alarm bij handmatig geknoei in de databestanden.
- [ ] `INTEGRITY_INTERVAL_HOURS=24` — periodieke bestandsintegriteitscontrole.
- [ ] Prometheus: zet `METRICS_TOKEN` als `/metrics` extern bereikbaar is
      (anders lekken gebruikersnamen niet, maar het endpoint is dan open).

## 7. Als service draaien

- [ ] `deploy/fileserver.service` (systemd) geïnstalleerd en `enable --now`.
- [ ] Updaten met `deploy/update.sh` (back-up → pull → `npm ci` → herstart, met rollback).
- [ ] Of Docker: `docker-compose.yml` (Watchtower werkt de image automatisch bij).

## 8. Na de eerste start controleren

- [ ] Inloggen op `https://transfer.zepta-nas.nl` werkt (admin).
- [ ] `https://transfer.zepta-nas.nl/health` geeft `status: ok`; `/ready` geeft `ready: true`.
- [ ] 2FA/passkey inschrijven voor de admin.
- [ ] Admin-dashboard → **Onderhoud** en **Rapportage** doorlopen (status, back-up-verificatie,
      audit-log verifiëren).
- [ ] Een testupload + deel-link + SFTP-verbinding uitproberen.

---

## Aanbevolen `.env` (productie achter Caddy)

```dotenv
# Basis
AUTH_USER=admin
AUTH_PASS=<sterk-uniek-wachtwoord>
SESSION_SECRET=<32+ willekeurige bytes>
STORAGE_DIR=/srv/fileserver-data/storage   # op LUKS-volume
APP_BASE_URL=https://transfer.zepta-nas.nl

# Netwerk / proxy / TLS (Caddy termineert TLS)
WEB_HOST=127.0.0.1
TLS_ENABLED=false
COOKIE_SECURE=true
TRUST_PROXY=1

# Beveiliging
SESSION_BIND=ua
REAUTH_WINDOW_MS=300000
REQUIRE_2FA=admin
PASSWORD_HIBP=true
MAX_UPLOAD_BYTES=5368709120
API_RATE_MAX=600
DOWNLOAD_RATE_MAX=120
DLP_ACTION=flag
# BREAKGLASS_USER=noodadmin
# BREAKGLASS_PASSWORD=<lang-uniek-offline-bewaard>

# Passkeys (optioneel)
WEBAUTHN_RP_ID=transfer.zepta-nas.nl
WEBAUTHN_ORIGIN=https://transfer.zepta-nas.nl

# Back-up & onderhoud
BACKUP_INTERVAL_MINUTES=1440
BACKUP_PASSWORD=<sterk-uniek-wachtwoord>
BACKUP_RESTORE_TEST=true
BACKUP_UPLOAD_CMD=rclone copy b2:zepta-nas-backups/fileserver
ALERT_EMAIL=troy.janssens.it@gmail.com
CONFIG_DRIFT_INTERVAL=15
INTEGRITY_INTERVAL_HOURS=24

# E-mail (Brevo) — vul je eigen sleutel in
BREVO_API_KEY=<brevo-key>
BREVO_FROM=no-reply@zepta-nas.nl

# Antivirus (als ClamAV geïnstalleerd is)
CLAMSCAN=clamdscan
FRESHCLAM_INTERVAL_HOURS=24
AV_SCAN_INTERVAL_HOURS=168

# Metrics (zet een token als /metrics extern bereikbaar is)
METRICS_TOKEN=<willekeurig-token>
```

> Alle overige opties staan standaard uit; bovenstaande is een veilige,
> onderhoudsarme basis. Pas quota (`DEFAULT_QUOTA`) en limieten aan naar wens.

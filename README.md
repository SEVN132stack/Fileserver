# SFTP Fileserver

Een fileserver die dezelfde bestanden aanbiedt via **SFTP**, een **web UI** en
**WebDAV**. Wat je via één kanaal uploadt, zie je in de andere — alles werkt op
één gedeelde opslag, met een eigen, geïsoleerde map (home) per gebruiker.

> 📋 De volledige functie- en ideeënlijst staat in **[OPTIONS.md](OPTIONS.md)**.

## Functies

**Toegang**
- 🔐 SFTP-server (`ssh2`) — wachtwoord én SSH key-authenticatie.
- 🌐 Web UI met loginpagina, sessies en uitloggen.
- 🗄️ WebDAV-endpoint (`/webdav`) om als netwerkschijf te koppelen.

**Accounts & beveiliging**
- 👥 Meerdere gebruikers met eigen home-map.
- 🎚️ Rollen: `admin`, `user`, `readonly`.
- 🔑 Twee-factor-authenticatie (TOTP).
- 🔒 Optioneel HTTPS met auto-gegenereerd self-signed certificaat.
- 🛡️ Brute-force-bescherming + persistente IP-bans.
- 📦 Quota per gebruiker.
- 📝 Audit-log van alle acties.
- 🔐 Geheimen (wachtwoorden, keys, sessie-secret) altijd in `.env`.

**Bestandsbeheer**
- ⬆️ Uploaden (drag & drop, mappen, voortgangsbalk), ⬇️ downloaden.
- 👁️ Preview van afbeeldingen, tekst, code en PDF + ✎ tekst-editor in de browser.
- 🗜️ ZIP-download van mappen en van een selectie (bulk).
- ✅ Bulk-acties (meerdere bestanden selecteren).
- 🔗 Publieke deel-links met vervaldatum en/of wachtwoord.
- 🗑️ Prullenbak met herstellen.
- 🤝 Gedeelde mappen tussen gebruikers.
- 🔎 Zoeken, sorteren, thumbnails.

**Comfort & beheer**
- 🛠️ Admin-dashboard (gebruikers, IP-bans, audit-log).
- 🌓 Licht/donker-thema en taal NL/EN.
- 📱 Installeerbare PWA.
- 🔔 Webhook-notificaties.
- 🐳 Docker + 🧩 systemd-service + ✅ CI-tests.

## Vereisten

- Node.js 18+ (of Docker). Ontwikkeld/getest op Node 22.

## Installatie & starten

```bash
npm install
npm start
```

Bij de eerste start worden automatisch aangemaakt: `.env` (met een willekeurig
wachtwoord én sessie-secret), `users.json`, `host.key` en de opslagmap. Deze
staan allemaal in `.gitignore`.

- **Web UI:** http://localhost:8080 (of `https://` met TLS)
- **SFTP:** `sftp -P 2222 admin@localhost`
- **WebDAV:** `http://localhost:8080/webdav`

## Met Docker

```bash
docker compose up --build
```

## Tests

```bash
npm test
```

Draait een geïntegreerde testsuite (login, 2FA, rollen, quota, prullenbak,
deel-links, bulk-ZIP, SFTP). Draait ook automatisch via GitHub Actions (CI).

## Gebruikers beheren

Via het admin-dashboard (`/admin.html`) of de CLI:

```bash
npm run user add <gebruiker> <wachtwoord> [rol] [quota-bytes]
npm run user passwd <gebruiker> <nieuw-wachtwoord>
npm run user role <gebruiker> <admin|user|readonly>
npm run user quota <gebruiker> <bytes>
npm run user del <gebruiker>
npm run user list
```

### SSH key-authenticatie

Leg de publieke sleutel in `authorized_keys/<gebruiker>`:

```bash
mkdir -p authorized_keys
cat ~/.ssh/id_ed25519.pub >> authorized_keys/admin
sftp -P 2222 -i ~/.ssh/id_ed25519 admin@localhost
```

## Configuratie

Alle geheimen en instellingen leven in **`.env`** (kopieer `.env.example`).
Belangrijkste variabelen:

| Variabele              | Standaard          | Omschrijving                              |
| ---------------------- | ------------------ | ----------------------------------------- |
| `WEB_PORT` / `SFTP_PORT` | `8080` / `2222`  | Poorten van web UI en SFTP                |
| `STORAGE_DIR`          | `./storage`        | Map met de per-gebruiker home-mappen      |
| `AUTH_USER` / `AUTH_PASS` | `admin` / *(gen.)* | Standaardgebruiker (eerste start)      |
| `SESSION_SECRET`       | *(gegenereerd)*    | Geheim voor sessie-cookies                |
| `TLS_ENABLED`          | `false`            | HTTPS voor de web UI                       |
| `WEBDAV_ENABLED`       | `true`             | WebDAV-endpoint aan/uit                    |
| `DEFAULT_QUOTA`        | `0`                | Standaardquota per gebruiker (bytes, 0=∞) |
| `WEBHOOK_URL`          | *(leeg)*           | Webhook voor notificaties                 |
| `RATE_MAX_ATTEMPTS`    | `5`                | Mislukte logins voor blokkade             |
| `TRASH_NAME`           | `.trash`           | Naam van de prullenbak-map                |

Zie `.env.example` voor de volledige lijst (o.a. `USERS_FILE`,
`AUTHORIZED_KEYS_DIR`, `AUDIT_LOG`, `BANS_FILE`, `SHARES_FILE`, `TLS_CERT/KEY`).

## API (web)

Endpoints vereisen een sessie-cookie of Basic Auth; alles is gescoped op de
home-map van de gebruiker.

| Methode | Endpoint | Omschrijving |
| ------- | -------- | ------------ |
| `POST` | `/api/login` · `/api/logout` | In-/uitloggen (sessie) |
| `GET`  | `/api/whoami` | Gebruiker, rol, quota, gedeelde mappen |
| `GET`  | `/api/list` | Map tonen (`path,sort,order,q`) |
| `GET`  | `/api/download` · `/api/preview` · `/api/zip` | Downloaden / inline / map als ZIP |
| `POST` | `/api/bulkzip` | Selectie als ZIP (`{paths}`) |
| `POST` | `/api/upload` · `/api/save` | Uploaden / bestand opslaan |
| `POST` | `/api/mkdir` · `/api/rename` · `/api/delete` | Map / hernoemen / naar prullenbak |
| `GET`/`POST` | `/api/trash` · `/api/restore` · `/api/trash/empty` | Prullenbak |
| `POST`/`GET`/`DELETE` | `/api/share` · `/api/shares` · `/api/share/:t` | Deel-links |
| `GET`  | `/api/shared/list` · `/api/shared/download` | Met mij gedeelde mappen |
| `POST` | `/api/2fa/setup` · `/enable` · `/disable` | 2FA |
| `GET`/`POST` | `/api/meta` · `/api/favorites` | Tags/commentaar/favorieten |
| `GET`  | `/api/thumb` | Thumbnail van een afbeelding |
| `POST`/`DELETE`/`GET` | `/api/grant` · `/api/grants` | Map delen met een gebruiker |
| `GET`/`POST` | `/api/shared/list·download·upload·mkdir·delete` | Gedeelde mappen |
| `GET`/`POST` | `/api/versions` · `/api/version/restore·download` | Versiegeschiedenis |
| `GET`/`POST` | `/api/sync/signature` · `/api/sync/apply` | Delta-sync |
| `GET`/`POST`/`DELETE` | `/api/keys/pubkey` · `/api/keyring` | E2E-sleutelbeheer |
| `POST` | `/api/reset/request` · `/api/reset/confirm` | Wachtwoord-reset (geen auth) |
| `*`    | `/api/admin/*` | Beheer, incl. `/overview`, `/shares`, `/backup` (alleen admin) |
| `*`    | `/webdav/*` · `/tus/*` | WebDAV / tus resumable uploads |
| `GET`  | `/metrics` | Prometheus-metrics |
| `GET`  | `/s/:token` | Publieke deel-link (geen auth) |

## Publiek gebruik: reverse proxy + echt certificaat

Voor gebruik buiten je eigen netwerk zet je de fileserver achter een reverse
proxy met een geldig (gratis) TLS-certificaat. De app draait dan gewoon op HTTP
achter de proxy — laat `TLS_ENABLED=false` en laat de proxy TLS afhandelen.

**Caddy (eenvoudigst, automatisch Let's Encrypt):** zie `deploy/Caddyfile`.
Vervang de domeinnaam en draai `caddy run`. Caddy regelt certificaat + verlenging.

**Nginx (met certbot):** zie `deploy/nginx.conf`.

```bash
sudo certbot --nginx -d files.voorbeeld.nl
```

Beide configuraties geven het echte client-IP door (voor rate limiting/bans),
staan grote uploads toe en laten SSE (realtime updates) en WebDAV correct door.

## Extra functies (v3.1)

- **Hervatbare uploads:** grote bestanden (>8 MB) worden in stukken geüpload en
  hervatten automatisch na een onderbreking.
- **Realtime updates:** de UI ververst vanzelf bij wijzigingen (ook via SFTP/WebDAV).
- **Bandbreedtelimiet:** per gebruiker instelbaar in het admin-dashboard.
- **Antivirus (optioneel):** zet `CLAMSCAN` naar het pad van `clamdscan`/`clamscan`.
- **SSO (optioneel):** vul de `OIDC_*`-variabelen in voor OpenID Connect-login.
- **Off-site backup (optioneel):** `POST_UPLOAD_CMD="aws s3 cp"` kopieert elke
  upload naar bijvoorbeeld een S3-bucket.
- **Talen:** NL / EN / DE / FR (schakelbaar rechtsboven).
- **Prullenbak** telt mee in de gebruikte opslag; leeg hem om ruimte vrij te maken.

## Admin-dashboard (v3.5)

Beheerders vinden op `/admin.html` een overzicht met stat-kaarten (gebruikers,
opslag, uploads/downloads, logins, actieve realtime-clients, deel-links,
quarantaine, IP-bans, back-ups), status-badges (HTTPS/WebDAV/SSO/antivirus) en
recente activiteit, plus panelen om gebruikers, IP-bans, quarantaine, deel-links
(met downloadtellingen) en back-ups te beheren. Het dashboard toont **grafieken**
(bar chart + live sparklines) en ververst **live via SSE** (`/api/admin/events`)
bij nieuwe activiteit.

### E-mail testen

```bash
npm run sendmail jij@voorbeeld.nl
```

Verstuurt een testmail met de huidige `.env`-configuratie (Brevo/SMTP) en toont
welke verzendmethode is gebruikt.

Verder in v3.5:

- **Delta-sync in de web UI:** knop ⟳ per bestand werkt een bestaand bestand
  efficiënt bij (de browser berekent de rsync-delta en stuurt alleen het verschil).
- **VirusTotal-upload:** met `VT_UPLOAD=true` worden bij VT onbekende bestanden
  geüpload en geanalyseerd.

## Extra functies (v3.4)

- **Echte rsync-delta:** overeenkomende blokken worden op willekeurige byte-offsets
  herkend (rollende checksum), dus invoegen/verwijderen in grote bestanden is efficiënt.
- **Automatische E2E-sleutelrotatie:** map-sleutels hebben een versie; met
  `KEY_ROTATE_DAYS` melden verlopen sleutels zich en roteert de client ze.
- **Deel-links met downloadlimiet:** stel naast vervaltijd/wachtwoord een maximaal
  aantal downloads in.
- **Antivirus met meerdere engines:** ClamAV én VirusTotal (`VT_API_KEY`, hash-lookup).
- **Screenshots:** `npm run screenshot <map>` genereert afbeeldingen van de web UI.

## Extra functies (v3.3)

- **Delta-sync (rsync-achtig):** alleen gewijzigde blokken worden verstuurd
  (`/api/sync/signature` + `/api/sync/apply`) — efficiënt voor grote bestanden die
  vaak wijzigen.
- **Antivirus-quarantaine:** besmette uploads gaan in quarantaine i.p.v. weigeren;
  beheerders geven ze vrij of wissen ze in het dashboard.
- **Notificaties bij delen:** webhook + e-mail bij aanmaken en downloaden van deel-links.
- **Versiegeschiedenis per bestand:** vorige versies worden bewaard bij overschrijven
  (knop 🕘), los van de prullenbak.
- **E2E-sleutelbeheer:** per-map sleutels (RSA-gewrapt per gebruiker), deelbaar met
  anderen — geen wachtwoord meer nodig per bestand.
- **Grafana + Prometheus:** kant-en-klaar dashboard (`deploy/grafana-dashboard.json`)
  en scrapevoorbeeld (`deploy/prometheus.yml`).

### E-mail via Brevo

Twee opties (zie `.env.example`):

1. **Brevo API (aanbevolen):** zet `BREVO_API_KEY` en `BREVO_FROM`. E-mail loopt dan
   via de transactionele API van Brevo.
2. **Brevo SMTP-relay:** `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_USER=<login>`,
   `SMTP_PASS=<SMTP-key>`.

Zonder configuratie wordt de resetlink in de serverconsole gelogd.

**Aandachtspunten voor bezorging (Brevo):**

- De server moet **uitgaand poort 587** (of 465) open hebben. In sommige
  gehoste/sandbox-omgevingen is SMTP geblokkeerd; op een eigen server/NAS werkt het.
- Gebruik als afzender bij voorkeur een **adres op je eigen domein** (bijv.
  `no-reply@zepta-nas.nl`) en verifieer dat in Brevo met **SPF/DKIM**. Een
  `@gmail.com`-afzender via Brevo wordt door Gmail's DMARC vaak geweigerd of als
  spam gemarkeerd.
- Zet `APP_BASE_URL` op je publieke adres (bijv. `https://transfer.zepta-nas.nl`)
  zodat reset-links naar de juiste host wijzen.

## Extra functies (v3.2)

- **Wachtwoord-reset via e-mail:** "Wachtwoord vergeten?" op de loginpagina.
  Stel `SMTP_*` in; zonder SMTP wordt de resetlink in de console gelogd.
- **Gedeelde mappen met schrijfrechten:** deel een map met een gebruiker via de
  knop 👥, kies alleen-lezen of lezen+schrijven.
- **Tags, commentaar en favorieten:** via de knop 🏷 per bestand.
- **Thumbnails:** afbeeldingen krijgen gecachete miniaturen (via `sharp`).
- **End-to-end-versleuteling:** vink "🔒 Versleutel uploads" aan; bestanden worden
  in de browser versleuteld (AES-GCM) en met 🔓 weer ontsleuteld. De server ziet
  alleen cijfertekst.
- **tus-protocol** (`/tus`) voor hervatbare, zeer grote overdrachten met standaard
  tus-clients (Uppy, tus-js-client).
- **Prometheus-metrics** op `/metrics` (optioneel `METRICS_TOKEN`).
- **Back-ups:** automatische planner (`BACKUP_INTERVAL_MINUTES`) met retentie
  (`BACKUP_KEEP`), plus handmatige back-up in het admin-dashboard.

## Tests (browser)

```bash
npm run test:e2e   # Playwright-browsertest (Chromium)
```

## Deploy (systemd)

Zie `deploy/fileserver.service`. Pas `User` en `WorkingDirectory` aan, plaats
het bestand in `/etc/systemd/system/`, dan:

```bash
sudo systemctl enable --now fileserver
```

## Beveiligingsnotities

- Zet `TLS_ENABLED=true` of gebruik een reverse proxy met een geldig certificaat buiten je eigen netwerk.
- Rate limiting werkt per IP; achter een proxy moet `X-Forwarded-For` correct doorgegeven worden (`trust proxy` staat aan).
- Deel `.env`, `users.json` en `host.key` nooit; ze staan in `.gitignore`.

## Licentie

MIT

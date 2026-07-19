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
| `*`    | `/api/admin/*` | Beheer (alleen admin) |
| `*`    | `/webdav/*` | WebDAV |
| `GET`  | `/s/:token` | Publieke deel-link (geen auth) |

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

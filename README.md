# SFTP Fileserver

Een fileserver die dezelfde bestanden aanbiedt via **SFTP** én via een **web UI**.
Wat je via SFTP uploadt, zie je direct in de browser en andersom — beide werken op
één gedeelde opslag, met een eigen map (home) per gebruiker.

## Functies

- 🔐 **SFTP-server** (op basis van [`ssh2`](https://github.com/mscdex/ssh2)) — verbind met elke SFTP-client (FileZilla, WinSCP, `sftp` CLI, ...).
- 🌐 **Web UI** — uploaden (met voortgangsbalk en drag & drop), downloaden, preview, hernoemen, mappen aanmaken en verwijderen.
- 👥 **Meerdere gebruikers** — elke gebruiker heeft een eigen, geïsoleerde home-map.
- 🔑 **SSH key-authenticatie** — inloggen op SFTP met een publieke sleutel naast wachtwoord.
- 🔒 **HTTPS** — optioneel TLS voor de web UI, met automatisch gegenereerd self-signed certificaat.
- 🛡️ **Brute-force-bescherming** — rate limiting op mislukte logins (web én SFTP).
- 📝 **Audit-log** — elke upload, download, verwijdering en login wordt gelogd.
- 🗜️ **ZIP-download** — download een hele map als ZIP-archief.
- 👁️ **Preview** — bekijk afbeeldingen, tekst, code en PDF's in de browser.
- 🔎 **Zoeken & sorteren** in de web UI.
- 🔐 **Geheimen in `.env`** — wachtwoorden en keys staan nooit in de broncode.
- 🚫 **Path-traversal-beveiliging** — gebruikers blijven binnen hun eigen home-map.
- 🐳 **Docker** — draai alles met één commando.

## Vereisten

- Node.js 18 of hoger (of Docker).

## Installatie

```bash
git clone <repo-url>
cd Fileserver
npm install
```

## Starten

```bash
npm start
```

Bij de eerste start worden automatisch aangemaakt:

- een `.env`-bestand met een **willekeurig gegenereerd wachtwoord** (eenmalig in de console getoond);
- `users.json` met de standaardgebruiker;
- een SSH host key (`host.key`);
- de opslagmap (`storage/`).

`.env`, `users.json`, `host.key`, `audit.log`, `authorized_keys/` en `tls/` staan
in `.gitignore` en worden dus **nooit** gecommit.

Na het starten:

- **Web UI:** http://localhost:8080 (of `https://` als TLS aan staat)
- **SFTP:** `sftp -P 2222 admin@localhost`

## Met Docker

```bash
docker compose up --build
```

Alle data (opslag, keys, gebruikers) leeft in een volume onder `/data`.

## Gebruikers beheren

```bash
npm run user add <gebruiker> <wachtwoord> [home-map]   # gebruiker toevoegen
npm run user passwd <gebruiker> <nieuw-wachtwoord>     # wachtwoord wijzigen
npm run user del <gebruiker>                           # gebruiker verwijderen
npm run user list                                      # gebruikers tonen
```

Wachtwoorden worden gehasht met scrypt opgeslagen in `users.json`.

### SSH key-authenticatie

Leg de publieke sleutel van een gebruiker in `authorized_keys/<gebruiker>`
(zelfde formaat als een OpenSSH `authorized_keys`-regel):

```bash
mkdir -p authorized_keys
cat ~/.ssh/id_ed25519.pub >> authorized_keys/admin
```

Daarna kun je inloggen zonder wachtwoord:

```bash
sftp -P 2222 -i ~/.ssh/id_ed25519 admin@localhost
```

## Configuratie

Alle geheimen (wachtwoorden, keys) en instellingen leven in **`.env`** — nooit in
de broncode. Kopieer `.env.example` naar `.env`, of laat de applicatie bij de
eerste start automatisch een `.env` met een sterk willekeurig wachtwoord aanmaken.

```bash
cp .env.example .env
```

Beschikbare variabelen:

| Variabele              | Standaard          | Omschrijving                                   |
| ---------------------- | ------------------ | ---------------------------------------------- |
| `WEB_PORT`             | `8080`             | Poort van de web UI                            |
| `WEB_HOST`             | `0.0.0.0`          | Host/interface van de web UI                   |
| `SFTP_PORT`            | `2222`             | Poort van de SFTP-server                       |
| `SFTP_HOST`            | `0.0.0.0`          | Host/interface van de SFTP-server              |
| `STORAGE_DIR`          | `./storage`        | Map met de per-gebruiker home-mappen           |
| `HOST_KEY_PATH`        | `./host.key`       | Pad naar de SSH host key                       |
| `USERS_FILE`           | `./users.json`     | Bestand met gebruikers (gehashte wachtwoorden) |
| `AUTHORIZED_KEYS_DIR`  | `./authorized_keys`| Map met per-gebruiker publieke SSH-sleutels    |
| `AUDIT_LOG`            | `./audit.log`      | Pad naar het audit-log                         |
| `AUTH_USER`            | `admin`            | Standaardgebruiker (voor eerste start)         |
| `AUTH_PASS`            | *(gegenereerd)*    | Wachtwoord van de standaardgebruiker           |
| `TLS_ENABLED`          | `false`            | HTTPS voor de web UI aan/uit                   |
| `TLS_CERT` / `TLS_KEY` | `./tls/...`        | Pad naar certificaat en sleutel                |
| `RATE_MAX_ATTEMPTS`    | `5`                | Max mislukte logins voor blokkade              |
| `RATE_WINDOW_MS`       | `60000`            | Tijdvenster voor het tellen (ms)               |
| `RATE_BLOCK_MS`        | `300000`           | Duur van de blokkade (ms)                      |

> **Belangrijk:** wijzig `AUTH_PASS` (en bij voorkeur `AUTH_USER`) in `.env`
> voordat je dit op een netwerk beschikbaar maakt. Deel `.env` nooit en commit het niet.

Variabelen op de commandline winnen van `.env`. Voorbeeld:

```bash
TLS_ENABLED=true WEB_PORT=9443 npm start
```

## Projectstructuur

```
src/
  env.js        # Laadt/genereert .env (secrets nooit in code)
  config.js     # Instellingen
  util.js       # Opslag + SSH host key
  paths.js      # Path-traversal-beveiliging (per home-map)
  users.js      # Gebruikers, wachtwoord-hashing, SSH-keys
  usercli.js    # CLI om gebruikers te beheren
  ratelimit.js  # Brute-force-bescherming
  audit.js      # Audit-log
  tls.js        # TLS-certificaat (self-signed)
  web.js        # Express web UI + REST API
  sftp.js       # SFTP-server (ssh2)
  server.js     # Startpunt
public/
  index.html    # Frontend van de web UI
Dockerfile, docker-compose.yml
```

## API (web)

Alle endpoints vereisen HTTP Basic Auth. Alles is gescoped op de home-map van de gebruiker.

| Methode | Endpoint         | Omschrijving                                   |
| ------- | ---------------- | ---------------------------------------------- |
| `GET`   | `/api/whoami`    | Huidige gebruiker                              |
| `GET`   | `/api/list`      | Lijst van een map (`?path=&sort=&order=&q=`)   |
| `GET`   | `/api/download`  | Download een bestand (`?path=`)                |
| `GET`   | `/api/preview`   | Toon een bestand inline (`?path=`)             |
| `GET`   | `/api/zip`       | Download een map als ZIP (`?path=`)            |
| `POST`  | `/api/upload`    | Upload bestanden (`?path=`, multipart)         |
| `POST`  | `/api/mkdir`     | Maak een map (`{path, name}`)                  |
| `POST`  | `/api/rename`    | Hernoem/verplaats (`{from, to}`)               |
| `POST`  | `/api/delete`    | Verwijder bestand/map (`{path}`)               |

## Beveiligingsnotities

- Zet `TLS_ENABLED=true` of gebruik een reverse proxy met een geldig certificaat als je dit buiten je eigen netwerk aanbiedt.
- Het self-signed certificaat is prima voor lokaal/intern gebruik; browsers tonen wel een waarschuwing.
- Rate limiting werkt per IP; achter een reverse proxy moet `X-Forwarded-For` correct worden doorgegeven (de app vertrouwt de proxy via `trust proxy`).

## Licentie

MIT

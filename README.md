# SFTP Fileserver

Een fileserver die dezelfde bestanden aanbiedt via **SFTP** én via een **web UI**.
Wat je via SFTP uploadt, zie je direct in de browser en andersom — beide werken op
één gedeelde opslagmap.

## Functies

- 🔐 **SFTP-server** (op basis van [`ssh2`](https://github.com/mscdex/ssh2)) — verbind met elke SFTP-client (FileZilla, WinSCP, `sftp` CLI, ...).
- 🌐 **Web UI** — uploaden (ook via drag & drop), downloaden, mappen aanmaken en bestanden verwijderen vanuit de browser.
- 📁 **Gedeelde opslag** — SFTP en web UI gebruiken exact dezelfde map.
- 🛡️ **Authenticatie** — één gebruikersnaam/wachtwoord voor zowel SFTP als de web UI (HTTP Basic Auth).
- 🚫 **Path-traversal-beveiliging** — gebruikers kunnen niet buiten de opslagmap komen.

## Vereisten

- Node.js 18 of hoger.

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

- een `.env`-bestand met een **willekeurig gegenereerd wachtwoord** (dit wordt één keer in de console getoond);
- een SSH host key (`host.key`);
- een opslagmap (`storage/`).

`.env` en `host.key` staan in `.gitignore` en worden dus **nooit** gecommit.

Na het starten:

- **Web UI:** http://localhost:8080
- **SFTP:** `sftp -P 2222 admin@localhost`

## Configuratie

Alle geheimen (wachtwoorden, keys) en instellingen leven in **`.env`** — nooit in
de broncode. Kopieer `.env.example` naar `.env` om zelf waarden in te vullen, of
laat de applicatie bij de eerste start automatisch een `.env` met een sterk
willekeurig wachtwoord aanmaken.

```bash
cp .env.example .env
# pas AUTH_USER / AUTH_PASS aan
```

Beschikbare variabelen:

| Variabele      | Standaard              | Omschrijving                          |
| -------------- | ---------------------- | ------------------------------------- |
| `WEB_PORT`     | `8080`                 | Poort van de web UI                   |
| `WEB_HOST`     | `0.0.0.0`              | Host/interface van de web UI          |
| `SFTP_PORT`    | `2222`                 | Poort van de SFTP-server              |
| `SFTP_HOST`    | `0.0.0.0`              | Host/interface van de SFTP-server     |
| `STORAGE_DIR`  | `./storage`            | Map waarin bestanden worden opgeslagen |
| `HOST_KEY_PATH`| `./host.key`           | Pad naar de SSH host key              |
| `AUTH_USER`    | `admin`                | Gebruikersnaam                        |
| `AUTH_PASS`    | `changeme`             | Wachtwoord                            |

> **Belangrijk:** wijzig `AUTH_PASS` (en bij voorkeur `AUTH_USER`) in `.env`
> voordat je dit op een netwerk beschikbaar maakt. Deel `.env` nooit en commit het niet.

Variabelen die je op de commandline meegeeft, winnen van `.env`. Voorbeeld:

```bash
WEB_PORT=9000 npm start
```

## Voorbeeld: bestand uploaden via SFTP CLI

```bash
sftp -P 2222 admin@localhost
# wachtwoord: changeme
sftp> put lokaal-bestand.txt
sftp> ls
```

Het bestand verschijnt daarna direct in de web UI.

## Projectstructuur

```
src/
  env.js      # Laadt/genereert .env (wachtwoorden & keys nooit in code)
  config.js   # Instellingen (poorten, opslag, auth)
  util.js     # Opslag, host key, path-traversal-beveiliging
  web.js      # Express web UI + REST API
  sftp.js     # SFTP-server (ssh2)
  server.js   # Startpunt: start beide servers
public/
  index.html  # Frontend van de web UI
```

## API (web)

Alle endpoints vereisen HTTP Basic Auth.

| Methode | Endpoint         | Omschrijving                          |
| ------- | ---------------- | ------------------------------------- |
| `GET`   | `/api/list`      | Lijst van een map (`?path=/`)         |
| `GET`   | `/api/download`  | Download een bestand (`?path=/x.txt`) |
| `POST`  | `/api/upload`    | Upload bestanden (`?path=/`, multipart) |
| `POST`  | `/api/mkdir`     | Maak een map (`{path, name}`)         |
| `POST`  | `/api/delete`    | Verwijder bestand/map (`{path}`)      |

## Beveiligingsnotities

- Gebruik dit achter een reverse proxy met TLS als je het buiten je eigen netwerk aanbiedt; de web UI gebruikt standaard HTTP.
- Er is één gedeeld account. Voor meerdere gebruikers met eigen mappen is uitbreiding nodig.

## Licentie

MIT

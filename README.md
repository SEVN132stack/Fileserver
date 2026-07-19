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

Bij de eerste start wordt automatisch een SSH host key (`host.key`) en een
opslagmap (`storage/`) aangemaakt.

Na het starten:

- **Web UI:** http://localhost:8080
- **SFTP:** `sftp -P 2222 admin@localhost`

## Configuratie

Alles is instelbaar via omgevingsvariabelen:

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

> **Belangrijk:** wijzig `AUTH_PASS` (en bij voorkeur `AUTH_USER`) voordat je dit
> op een netwerk beschikbaar maakt.

Voorbeeld:

```bash
AUTH_USER=troy AUTH_PASS=een-sterk-wachtwoord WEB_PORT=9000 npm start
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

# Changelog

Alle noemenswaardige wijzigingen aan dit project worden in dit bestand bijgehouden.

Het formaat is gebaseerd op [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/),
en dit project volgt [Semantic Versioning](https://semver.org/lang/nl/).

## [2.0.0] - 2026-07-19

### Toegevoegd

- **Meerdere gebruikers** met een eigen, geïsoleerde home-map per gebruiker
  (`users.json`, wachtwoorden gehasht met scrypt) en een CLI om ze te beheren
  (`npm run user add|passwd|del|list`).
- **SSH key-authenticatie** voor SFTP via `authorized_keys/<gebruiker>`.
- **HTTPS** voor de web UI (`TLS_ENABLED`), met automatisch gegenereerd
  self-signed certificaat.
- **Brute-force-bescherming** (rate limiting) op mislukte logins van web en SFTP.
- **Audit-log**: uploads, downloads, verwijderingen, hernoemingen en logins
  worden gelogd naar `audit.log`.
- **ZIP-download** van hele mappen (`/api/zip`).
- **Preview** in de browser voor afbeeldingen, tekst, code en PDF (`/api/preview`).
- **Hernoemen/verplaatsen** vanuit de web UI (`/api/rename`).
- **Zoeken** (recursief) en **sorteren** in de web UI.
- **Upload-voortgangsbalk** in de web UI.
- **Docker**-ondersteuning (`Dockerfile`, `docker-compose.yml`, `.dockerignore`).
- `/api/whoami` om de ingelogde gebruiker te tonen.

### Gewijzigd

- Padbewerkingen en authenticatie zijn nu per gebruiker; alle acties blijven
  binnen de home-map van de betreffende gebruiker.

## [1.1.0] - 2026-07-19

### Gewijzigd

- Alle geheimen (wachtwoorden, keys) leven nu uitsluitend in `.env`; er staat geen
  wachtwoord meer hardcoded in de broncode. De zwakke standaard `changeme` is verwijderd.

### Toegevoegd

- Automatische aanmaak van `.env` bij de eerste start, met een willekeurig
  gegenereerd wachtwoord dat één keer in de console wordt getoond.
- `.env.example` als sjabloon voor de configuratie.
- `.env` laden via de ingebouwde `.env`-parser van Node (met fallback voor oudere versies).
- De applicatie stopt met een duidelijke foutmelding als `AUTH_PASS` ontbreekt.

## [1.0.0] - 2026-07-19

### Toegevoegd

- SFTP-server op basis van `ssh2` met ondersteuning voor uploaden, downloaden,
  mappen aanmaken/verwijderen, hernoemen en bestandsinformatie opvragen.
- Web UI (Express) met:
  - overzicht van bestanden en mappen;
  - uploaden via knop en via drag & drop;
  - downloaden van bestanden;
  - mappen aanmaken en bestanden/mappen verwijderen;
  - broodkruimel-navigatie.
- Gedeelde opslagmap: SFTP en web UI werken op dezelfde bestanden.
- HTTP Basic Auth op de web UI met dezelfde inloggegevens als SFTP.
- Path-traversal-beveiliging zodat gebruikers binnen de opslagmap blijven.
- Automatische aanmaak van de SSH host key en opslagmap bij de eerste start.
- Configuratie via omgevingsvariabelen (poorten, host, opslag, inloggegevens).
- README met installatie-, gebruiks- en configuratie-instructies.

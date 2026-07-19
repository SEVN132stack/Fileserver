# Changelog

Alle noemenswaardige wijzigingen aan dit project worden in dit bestand bijgehouden.

Het formaat is gebaseerd op [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/),
en dit project volgt [Semantic Versioning](https://semver.org/lang/nl/).

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

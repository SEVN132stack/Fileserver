# Opties & Roadmap

Deze lijst houdt alle functies bij: wat er al is en wat er nog kan komen.
Status: ✅ klaar · 🚧 in ontwikkeling · 💡 idee/gepland.

## Basis (v1.x)

- ✅ SFTP-server (ssh2)
- ✅ Web UI: uploaden, downloaden, mappen aanmaken/verwijderen
- ✅ Gedeelde opslag tussen SFTP en web UI
- ✅ Authenticatie (wachtwoord)
- ✅ Path-traversal-beveiliging
- ✅ Geheimen in `.env` (nooit in de broncode)

## Uitbreiding (v2.0)

- ✅ Meerdere gebruikers met eigen home-map
- ✅ SSH key-authenticatie
- ✅ HTTPS (self-signed auto-gegenereerd)
- ✅ Brute-force-bescherming (rate limiting)
- ✅ Audit-log
- ✅ ZIP-download van mappen
- ✅ Preview (afbeelding/tekst/PDF)
- ✅ Hernoemen/verplaatsen
- ✅ Zoeken & sorteren
- ✅ Upload-voortgangsbalk
- ✅ Docker + docker-compose

## Beveiliging & accounts (v3.0)

- ✅ Sessies + loginpagina (met uitloggen)
- ✅ Twee-factor-authenticatie (TOTP)
- ✅ Rollen & rechten (admin / gebruiker / alleen-lezen)
- ✅ Gedeelde mappen tussen gebruikers
- ✅ Quota per gebruiker
- ✅ Persistente IP-ban

## Bestandsbeheer (v3.0)

- ✅ Publieke deel-links (met vervaldatum/wachtwoord)
- ✅ Meerdere bestanden selecteren (bulk-acties)
- ✅ Mappen uploaden (met substructuur)
- ✅ Versiebeheer / prullenbak
- ✅ Thumbnails voor afbeeldingen
- ✅ Tekst-editor in de browser

## Beheer & bediening (v3.0)

- ✅ Admin-dashboard (gebruikers + audit-log)
- ✅ WebDAV-endpoint
- ✅ Systemd-service-bestand
- ✅ Notificaties (webhook)

## Comfort (v3.0)

- ✅ Licht/donker-thema en taal (NL/EN)
- ✅ Mobiele PWA (installeerbaar)
- ✅ Geïntegreerde tests (CI)

## Geavanceerd (v3.1)

- ✅ Reverse proxy + echt TLS-certificaat (Caddy/nginx + Let's Encrypt)
- ✅ Hervatbare (chunked) uploads voor grote bestanden
- ✅ Antivirus-scan bij upload (ClamAV, optioneel)
- ✅ Volledige e2e-browsertests (Playwright)
- ✅ OpenID Connect / SSO-login (optioneel)
- ✅ Realtime updates (Server-Sent Events)
- ✅ Bandbreedte-limiet per gebruiker
- ✅ Meertalige UI: NL / EN / DE / FR
- ✅ Off-site backup via post-upload-commando (bijv. `aws s3 cp`)
- ✅ Prullenbak telt mee in de opslag/quota

## Toekomstige ideeën

- 💡 Volledige S3/object-storage als primaire backend (storage-abstractielaag)
- 💡 JWKS-handtekeningverificatie voor OIDC id_tokens
- 💡 Wachtwoord-reset via e-mail
- 💡 Gedeelde mappen met schrijfrechten (nu alleen-lezen)
- 💡 Bestandscommentaar / tags / favorieten
- 💡 Miniatuurcache voor snellere thumbnails van grote afbeeldingen
- 💡 Client-side versleuteling (end-to-end)
- 💡 Rsync-/tus-protocol voor extreem grote overdrachten
- 💡 Meer talen (ES/IT/PL/...) en RTL-ondersteuning
- 💡 Mobiele native app (via de bestaande API)
- 💡 Metrics/Prometheus-endpoint voor monitoring
- 💡 Ingebouwde back-upplanner (cron) met retentie

> Nieuwe wensen? Voeg ze onderaan toe onder "Toekomstige ideeën".

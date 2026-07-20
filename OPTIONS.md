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

## Geavanceerd+ (v3.2)

- ✅ Wachtwoord-reset via e-mail (SMTP, met resetlink)
- ✅ Gedeelde mappen met schrijfrechten (ro/rw per deling)
- ✅ Bestandscommentaar / tags / favorieten
- ✅ Miniatuurcache voor snellere thumbnails (sharp)
- ✅ Client-side end-to-end-versleuteling (AES-GCM in de browser)
- ✅ tus-protocol voor hervatbare, zeer grote overdrachten
- ✅ Metrics/Prometheus-endpoint voor monitoring
- ✅ Ingebouwde back-upplanner met retentie + handmatige back-up

## Geavanceerd++ (v3.3)

- ✅ Delta-sync (rsync-achtig): alleen gewijzigde blokken versturen
- ✅ Antivirus-quarantaine met beheer (vrijgeven/wissen) i.p.v. directe weigering
- ✅ Webhook- én e-mailnotificatie bij delen en downloads van deel-links
- ✅ Versiegeschiedenis per bestand (los van de prullenbak)
- ✅ Sleutelbeheer voor E2E (per-map sleutels, delen via publieke sleutels)
- ✅ Grafana-dashboard-sjabloon + Prometheus-scrapevoorbeeld
- ✅ E-mail via Brevo (API of SMTP-relay)
- ✅ Quota gelijkgetrokken over web, SFTP én tus

## Toekomstige ideeën

- 💡 Volledige S3/object-storage als primaire backend (storage-abstractielaag)
- 💡 JWKS-handtekeningverificatie voor OIDC id_tokens
- 💡 Meer talen (ES/IT/PL/...) en RTL-ondersteuning
- 💡 Mobiele native app (via de bestaande API)
- 💡 Rolling-hash (echte librsync) voor delta op byte-niveau i.p.v. vaste blokken
- 💡 Back-up naar externe bestemming (S3/rsync) i.p.v. lokaal
- 💡 Automatische sleutelrotatie voor E2E-mapsleutels
- 💡 Delen van deel-links met verlooptelling/downloadlimiet
- 💡 Antivirus met meerdere engines / VirusTotal-integratie
- 💡 Volledige audit-export (SIEM) en alerting-regels bij de metrics

> Nieuwe wensen? Voeg ze onderaan toe onder "Toekomstige ideeën".

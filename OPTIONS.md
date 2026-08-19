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

## Geavanceerd+++ (v3.4)

- ✅ Echte rsync rolling-hash delta op byte-niveau (invoegen/verwijderen)
- ✅ Automatische E2E-sleutelrotatie (versies + rotatiebeleid)
- ✅ Deel-links met downloadlimiet (naast vervaldatum en wachtwoord)
- ✅ Antivirus met meerdere engines (ClamAV + VirusTotal)
- ✅ Screenshotscript voor de web UI

## Beheer (v3.5)

- ✅ Admin-overzichtsdashboard met kern-informatie en status
- ✅ Deel-link-statistieken in het dashboard
- ✅ Delta-sync ook in de web UI (knop ⟳)
- ✅ VirusTotal-upload voor onbekende bestanden

## Dashboard (v3.6 / v3.7)

- ✅ Grafische grafieken in het admin-dashboard (bar chart + live sparklines)
- ✅ Live-verversend admin-dashboard via SSE
- ✅ Sendmail-testscript (`npm run sendmail`)
- ✅ Historische metrics bewaren (ring-buffer op schijf)
- ✅ Configureerbare tijdvensters + legenda's in de grafieken

## Groot pakket (v3.9)

- ✅ Drop-links (upload-portaal, aanleveren zonder account)
- ✅ QR-code bij deel-links
- ✅ Gebruikersgroepen (delen/rechten per groep)
- ✅ Slepen tussen mappen (drag & drop verplaatsen)
- ✅ Media-preview (video/audio) + gerenderde Markdown
- ✅ Volledige-tekst zoeken in bestandsinhoud
- ✅ Foto-upload vanaf de telefoon (camera)
- ✅ Actieve sessies beheren + op afstand uitloggen
- ✅ Nieuw-apparaat-melding per e-mail
- ✅ Passkeys / WebAuthn
- ✅ IP-allowlist + onderhoudsmodus
- ✅ Wachtwoordbeleid + accountvergrendeling
- ✅ /health-endpoint
- ✅ Geplande opschoning
- ✅ Opslagrapport
- ✅ Configuratie via de admin-UI

## Onderhoud & ops (v3.13)

- ✅ Geautomatiseerde dependency-updates (Dependabot)
- ✅ `npm audit` in CI (security-gate)
- ✅ Update-script voor de NAS (met back-up + rollback)
- ✅ Docker auto-update (Watchtower) + image naar GHCR
- ✅ Ingebouwde update-checker (melding in dashboard)
- ✅ Log-rotatie van het audit-log
- ✅ Alerts (e-mail/webhook) bij schijf vol, back-up-fout, integriteitswijziging
- ✅ Schijfruimte-bewaking
- ✅ Prometheus alert-rules
- ✅ Back-up-verificatie
- ✅ Security-headers (CSP/HSTS/nosniff/frame-options)
- ✅ Bestandsintegriteit (SHA-256-baseline + controle)
- ✅ Config/gebruikers export & import
- ✅ Galerij-weergave voor afbeeldingen
- ✅ Gedeelde bestandscommentaren

## Extra beveiliging & hardening (v3.14)

- ✅ Back-up-encryptie (AES-256-GCM) + herstel (`decryptBackup`)
- ✅ Off-site back-up via `BACKUP_UPLOAD_CMD` (rclone/S3)
- ✅ Ransomware-/massa-wijziging-detectie (web + SFTP)
- ✅ Honeypot-/lokbestanden met alarm
- ✅ Tweefactor afdwingen (off/admin/all)
- ✅ Accountvervaldatum (web + SFTP)
- ✅ fail2ban-hook bij ban/unban
- ✅ Geo-blokkering (landcodes)
- ✅ SFTP alleen-sleutel-modus (wachtwoord-auth uit)
- ✅ Periodieke integriteitscontrole
- ✅ SIEM-forwarding van audit-events
- ✅ HaveIBeenPwned-controle op wachtwoorden
- ✅ Documentatie at-rest-encryptie (LUKS/eCryptfs) + off-site back-up (rclone)

## Beveiliging, onderhoud & organisatie (v3.15)

- ✅ Onvervalsbaar audit-log (hash-keten + verificatie)
- ✅ Sessie-binding aan IP/User-Agent
- ✅ Step-up-herauthenticatie voor gevoelige beheeracties
- ✅ Bestand-gebaseerde geheimen (Docker/Podman/Kubernetes/systemd/Vault)
- ✅ Back-up herstel-test (ZIP-structuurvalidatie + ontsleutelen)
- ✅ Readiness-probe `/ready` + admin-statusoverzicht
- ✅ Per-gebruiker metrics + extra Prometheus-alertregels
- ✅ ClamAV-onderhoud: freshclam-cron + geplande volledige scan
- ✅ Zoekindex (omgekeerde index) voor snelle zoekacties
- ✅ Bulk-verplaatsen + tags/labels per bestand

## Privacy, samenwerking, media & multi-tenant (v3.16)

- ✅ Toegangslog voor gedeelde bestanden (eigenaar ziet downloads)
- ✅ Watermerk op gedeelde afbeeldingen
- ✅ Sessie-timeout bij inactiviteit + "overal uitloggen"
- ✅ Wachtwoordverval + wachtwoordhistorie (geen hergebruik)
- ✅ Config-drift-detectie
- ✅ Bestandsvergrendeling (locks)
- ✅ Upload-portalen (per-inzender submappen)
- ✅ Multi-tenant/afdelingen (tenant-veld per gebruiker)
- ✅ Office-preview (docx/xlsx/pptx → tekst)
- ✅ Automatische foto-ordening (EXIF → jaar/maand + dedupe)
- ✅ Video-poster & audio-golfvorm (via ffmpeg)
- ✅ PWA share-target
- ✅ Geplande exports (rsync/rclone)
- ✅ Automatische TLS via ACME-commando
- ✅ Branding (naam/logo/accentkleur)

## Compliance, beheer & inzicht (v3.17)

- ✅ DLP-scan op uploads (BSN/creditcard/IBAN/wachtwoord)
- ✅ Break-glass nood-admin met alarm
- ✅ Admin-impersonatie ("bekijk als gebruiker") met audit
- ✅ Rapportage-dashboard (opslag per gebruiker/afdeling, inactieve accounts)
- ✅ Toegang-heatmap (uur/weekdag/land)
- ✅ Rate-limiting per endpoint (API + downloads)
- ✅ E2E-browsertest (Playwright) in CI

## Compliance, samenwerking & integraties (v3.18)

- ✅ AVG/GDPR-toolkit (export + recht op vergetelheid)
- ✅ WORM/retentie-vergrendeling
- ✅ Self-destruct/verlopende bestanden
- ✅ E2E-verplichte mappen
- ✅ Aanwezigheid ("wie kijkt nu")
- ✅ Per-gebruiker API-sleutels (scopes, intrekbaar)
- ✅ In-app notificatiecentrum
- ✅ Webhook-templates (Slack/Discord/Teams/ntfy)
- ✅ rclone-/WebDAV-profielgenerator
- ✅ Server-side conversie (afbeelding/document/av)
- ✅ Duplicaten-vinder + opschoon-suggesties
- ✅ Recent geopende bestanden
- ✅ Wekelijks e-mailrapport
- ✅ Docker healthcheck + compose met Caddy
- ✅ Gestructureerde JSON-logging (correlation-id)

## Zoeken, samenwerking & sync (v3.19)

- ✅ OCR-zoeken (tekst in afbeeldingen/PDF's doorzoekbaar)
- ✅ Automatische categorisatie/tagging op inhoud
- ✅ Desktop-sync-client (`npm run sync`, twee-richtingen)
- ✅ Toegangsaanvraag-workflow (aanvragen + goedkeuren)
- ✅ Rijke previews: EPUB-omslag + STL (3D) info
- ✅ Per-gebruiker geplande taken (opschoning)

## Toegang, samenwerking & opslag (v3.20)

- ✅ 2FA-herstelcodes (10 eenmalige codes)
- ✅ Magic-link login (inloggen via e-maillink)
- ✅ Zelfregistratie met invite-codes
- ✅ Per-deellink snelheidslimiet (KB/s)
- ✅ Bestandssjablonen
- ✅ Per-map beschrijving/README
- ✅ Mapkleuren & iconen
- ✅ Opslag-deduplicatie (reflink/copy-on-write)
- ✅ Hervatbare downloads (HTTP Range / 206)
- ✅ Activiteitenfeed per map
- ✅ "Gezien door" read-receipts
- ✅ Publieke status-pagina
- ✅ Quota-waarschuwing per e-mail
- ✅ Onveranderbare snapshots
- ✅ Uitgaande webhook-wachtrij met retries
- ✅ Certificaat-vervalbewaking

## Beveiliging: hardware-keys, geo-blokkering & JIT (v3.21)

- ✅ Hardware-security-keys (FIDO2 `sk-`) verplicht kunnen stellen voor SFTP
- ✅ Geo-/IP-blokkering (landcodes + CIDR-blokken)
- ✅ Just-in-time toegang (tijdelijke rol-verhoging met goedkeuring)
- ✅ Anomalie-detectie (ongebruikelijk downloadvolume → alarm)

## Samenwerking: teamruimtes, reviews & diffs (v3.22)

- ✅ Gedeelde teamruimtes (meerdere leden, rollen viewer/editor/admin)
- ✅ Goedkeuringsworkflow (bestand in review → goedkeuren/afkeuren)
- ✅ Versie-diff-weergave (regel-voor-regel verschil met +/− telling)

## Zoeken & inzicht: opgeslagen zoekopdrachten, office-zoeken, duplicaten & analytics (v3.23)

- ✅ Opgeslagen zoekopdrachten / slimme mappen
- ✅ Volledige-tekst-zoeken in kantoordocumenten (docx/xlsx/pptx)
- ✅ Duplicaten-dashboard (opruimen + reflink-dedupe)
- ✅ Interactief analytics-overzicht (acties, top-gebruikers, tijdlijn)

## Integraties & UX: hooks, recepten, offline, tags & galerijen (v3.24)

- ✅ Inkomende webhooks / API-triggers (token → vooraf toegestane actie)
- ✅ Zapier/Make-recepten (in- en uitgaand)
- ✅ PWA offline-modus (app-schil-cache + offline-pagina)
- ✅ Bulk-tagging via selectie + tag-galerij
- ✅ Thema-planning (donker/licht/auto) + hoog-contrast-toegankelijkheid
- ✅ Deelbare openbare galerijen (/g/<token>)

## Beveiliging & identiteit: classificatie, apparaten & forensics (v3.25)

- ✅ Data-classificatielabels (openbaar/intern/vertrouwelijk/geheim) met deelbeleid
- ✅ Vertrouwde apparaten (apparaatlijst + goedkeuren; optioneel verplicht)
- ✅ Sessie-forensics (IP-historie + geo-sprong-waarschuwing)

## Delen & clients: brievenbus, CLI & WebDAV-locks (v3.26)

- ✅ Brandbare brievenbus (eenmalige drop-link) + instelbaar max. aantal uploads
- ✅ CLI-client (`npm run cli`: ls/get/put/mkdir/rm/share via API-sleutel)
- ✅ WebDAV LOCK/UNLOCK (class-2) + ETag/If-None-Match property-caching

## Automatisering & notificaties: naamsuggesties, regels, abonnementen & digests (v3.27)

- ✅ Slimme naamgeving-suggesties (inhoud/EXIF)
- ✅ Regelgebaseerde automatisering (als upload → tag/verplaats/notificeer)
- ✅ Map-abonnementen (melding bij wijzigingen)
- ✅ Digest-notificaties (dagelijkse/wekelijkse samenvatting)

## Media & bewerking: beeld, PDF, transcode & transcriptie (v3.28)

- ✅ In-browser beeldbewerker (roteren/spiegelen/bijsnijden/schalen)
- ✅ PDF-bewerker (samenvoegen/splitsen/roteren)
- ✅ Transcoderen op verzoek (video → MP4/WebM via ffmpeg)
- ✅ Automatische transcriptie (spraak → tekst via extern commando)

## Opslag & continuïteit: compressie, point-in-time, zelftest & status (v3.29)

- ✅ Compressie-at-rest (koude bestanden gzip, transparante download)
- ✅ Point-in-time herstel van de hele opslag (server-snapshots)
- ✅ Zelftest-/chaos-knop (back-up-herstel + integriteit)
- ✅ Statuspagina met incidenthistorie + onderhoudsvensters

## API & extensibiliteit: OpenAPI, plugin-hooks & webhook-abonnementen (v3.30)

- ✅ OpenAPI-spec (/api/openapi.json) + zelf-gehoste API-docs (/docs)
- ✅ Plugin-/extensiesysteem (event → extern commando, admin, standaard uit)
- ✅ Fijnmazige uitgaande webhook-abonnementen (filters + payload-templates)

## Toekomstige ideeën

- 💡 Server-side at-rest-encryptie op FS-niveau (LUKS/eCryptfs — gedocumenteerd in `deploy/at-rest-encryption.md`)
- 💡 Volledige S3/object-storage als primaire backend (storage-abstractielaag)
- 💡 JWKS-handtekeningverificatie voor OIDC id_tokens
- 💡 Meer talen (ES/IT/PL/...) en RTL-ondersteuning
- 💡 Mobiele native app (via de bestaande API)



> Nieuwe wensen? Voeg ze onderaan toe onder "Toekomstige ideeën".

# Changelog

## [3.12.0] - 2026-07-20

### Toegevoegd

- **Link-beheer in het admin-dashboard**: overzicht van alle deel-links én permalinks
  met de mogelijkheid om per link het **wachtwoord** en de **vervaldatum** te wijzigen
  of de link **in te trekken** (`/api/admin/shares` en `/api/admin/permalinks` met
  PATCH/DELETE).


## [3.11.0] - 2026-07-20

### Gewijzigd

- **Permalinks configureerbaar**: een permalink kan nu een **wachtwoord** en/of
  **vervaldatum** krijgen (zoals deel-links). De `/f/<uuid>`-route toont een
  wachtwoordformulier en weigert verlopen links. Endpoint is nu `POST /api/permalink`
  met `{ path, password, expiresInHours }`.

## [3.10.0] - 2026-07-20

### Toegevoegd

- **Permalink per bestand**: elk bestand krijgt op verzoek een stabiele link met
  UUID (`https://<host>/f/<uuid>`, knop ∞). De link blijft geldig en **volgt het
  bestand** bij hernoemen/verplaatsen; bij verwijderen vervalt hij. Publiek
  bereikbaar (onraadbare UUID), met QR-code. `?inline=1` toont inline i.p.v. download.

### Gewijzigd
- WebAuthn/passkeys geconfigureerd voor productie via `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`.

## [3.9.0] - 2026-07-20

### Toegevoegd

**Delen & samenwerken**
- **Drop-links (upload-portaal)**: deel een link waarmee mensen zónder account
  bestanden naar een map kunnen aanleveren (met optioneel wachtwoord/vervaldatum).
- **QR-code** bij deel-/drop-links (`/api/qr`).
- **Gebruikersgroepen**: delen en rechten per groep (`group:<naam>`).

**Web UI**
- **Slepen tussen mappen** (drag & drop verplaatsen).
- **Media-preview**: video/audio afspelen (range-requests) en **gerenderde Markdown**.
- **Volledige-tekst zoeken** in bestandsinhoud (`?content=1`).
- **Foto-upload** vanaf de telefoon (camera-capture).

**Beveiliging**
- **Actieve sessies beheren** + op afstand uitloggen (`/api/sessions`).
- **Nieuw-apparaat-melding** per e-mail bij login vanaf een onbekend apparaat.
- **Passkeys / WebAuthn** als sterkere 2FA en wachtwoordloze login.
- **IP-allowlist** en **onderhoudsmodus**.
- **Wachtwoordbeleid** (min. lengte/complexiteit) en **accountvergrendeling**.

**Beheer & betrouwbaarheid**
- **`/health`**-endpoint voor uptime-monitoring.
- **Geplande opschoning** van oude prullenbak-items.
- **Opslagrapport**: grootste bestanden/mappen (`/api/admin/storage-report`).
- **Configuratie via de admin-UI** (onderhoudsmodus, opschoning) als overlay op `.env`.

### Opgelost
- `/api/webauthn/enabled` en het keyring-pad: 401-popup op de loginpagina voorkomen
  en het keyring-bestand respecteert nu een configureerbaar pad (i.p.v. de repo-map).

## [3.8.0] - 2026-07-20

### Toegevoegd

- **Configureerbaar antivirus-beleid (fail-closed)**: engines geven nu expliciet
  aan of ze konden scannen. Beleid: besmet bij één engine blokkeert; minstens één
  succesvolle "schoon" laat toe; kon geen enkele engine scannen, dan bepaalt
  `AV_FAIL_CLOSED` of de upload wordt geweigerd (quarantaine) of doorgelaten.
  Per-engine timeout via `AV_TIMEOUT_MS`. Zo wordt het "fail-open"-gat gedicht
  zonder dat een niet-geïnstalleerde engine álle uploads blokkeert.

Alle noemenswaardige wijzigingen aan dit project worden in dit bestand bijgehouden.

Het formaat is gebaseerd op [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/),
en dit project volgt [Semantic Versioning](https://semver.org/lang/nl/).

## [3.7.0] - 2026-07-20

### Toegevoegd

- **Historische metrics**: periodiek worden metric-samples op schijf bewaard
  (ring-buffer, `METRICS_HISTORY_*`), op te vragen via `/api/admin/metrics/history`.
- **Configureerbare tijdvensters + legenda's** in de dashboardgrafieken: kies
  Live / 1u / 6u / 24u; historische vensters tonen lijngrafieken met legenda en tijd-as.

## [3.6.0] - 2026-07-20

### Toegevoegd

- **Grafieken in het admin-dashboard**: een bar chart met totalen en live
  sparklines voor uploads/s, downloads/s en actieve realtime-clients (zelfstandige
  inline-SVG, geen externe libraries).
- **Live-verversend admin-dashboard via SSE**: `/api/admin/events` zendt
  activiteits-events uit; het dashboard ververst direct bij uploads, downloads,
  logins, deel-links en quarantaine (met een 'live'-indicator), plus een periodieke
  sample elke 3 s voor de grafieken.
- **Sendmail-testscript**: `npm run sendmail <ontvanger>` verstuurt een testmail
  met de huidige e-mailconfiguratie.

## [3.5.0] - 2026-07-20

### Toegevoegd

- **Admin-overzichtsdashboard**: stat-kaarten (gebruikers, opslag, uploads/downloads,
  logins, actieve realtime-clients, deel-links, quarantaine, bans, back-ups),
  status-badges (HTTPS/WebDAV/SSO/antivirus) en recente activiteit (`/api/admin/overview`).
- **Deel-link-statistieken** in het dashboard: alle links met downloadtellingen,
  limiet, wachtwoord en vervaltijd (`/api/admin/shares`).
- **Delta-sync in de web UI**: knop ⟳ per bestand werkt een bestaand bestand
  efficiënt bij; de browser berekent de rsync-delta en stuurt alleen het verschil.
- **VirusTotal-upload** voor onbekende bestanden (`VT_UPLOAD=true`): bestanden die
  VT niet kent worden geüpload en geanalyseerd i.p.v. alleen een hash-lookup.

## [3.4.0] - 2026-07-20

### Toegevoegd

- **Echte rsync rolling-hash delta**: overeenkomende blokken worden nu op
  willekeurige byte-offsets herkend (zwakke rollende checksum + sterke SHA-1),
  zodat invoegen/verwijderen efficiënt is i.p.v. alleen op vaste blokgrenzen.
- **Automatische E2E-sleutelrotatie**: map-sleutels krijgen een versie; een
  rotatiebeleid (`KEY_ROTATE_DAYS`) meldt verlopen sleutels en de client roteert
  ze (nieuwe sleutel + alle bestanden opnieuw versleuteld).
- **Deel-links met downloadlimiet**: naast vervaldatum en wachtwoord nu ook een
  maximaal aantal downloads; de link vervalt automatisch bij bereiken.
- **Antivirus met meerdere engines**: naast ClamAV nu ook VirusTotal (hash-lookup,
  `VT_API_KEY`); een bestand geldt als besmet zodra één engine aanslaat.
- Script `npm run screenshot` om screenshots van de web UI te genereren.

### Gewijzigd

- `src/sync.js` vervangen door `src/rsync.js` (rijkere handtekening met zwakke+sterke checksum).

## [3.3.0] - 2026-07-20

### Toegevoegd

- **Delta-sync** (rsync-achtig): `/api/sync/signature` + `/api/sync/apply` sturen
  alleen gewijzigde blokken, met quota-controle en versie-snapshot.
- **Antivirus-quarantaine**: besmette uploads worden niet meer geweigerd maar
  apart gezet; beheerders kunnen ze in het dashboard vrijgeven of wissen.
- **Notificaties bij delen**: webhook én e-mail bij het aanmaken van een deel-link
  en bij het downloaden ervan (naar de eigenaar of `NOTIFY_EMAIL`).
- **Versiegeschiedenis per bestand**: vorige versies worden bewaard bij overschrijven
  (`/api/versions`, `/api/version/restore`, `/api/version/download`), los van de prullenbak.
- **E2E-sleutelbeheer**: per-map AES-sleutels, gewrapt met een RSA-sleutelpaar per
  gebruiker; sleutels deelbaar met andere gebruikers via hun publieke sleutel.
- **Grafana-dashboard-sjabloon** (`deploy/grafana-dashboard.json`) en
  Prometheus-scrapevoorbeeld (`deploy/prometheus.yml`).

### Gewijzigd

- **E-mail via Brevo**: `BREVO_API_KEY` (transactionele API) of Brevo SMTP-relay;
  valt terug op generieke SMTP of console-log.
- **Quota** wordt nu ook afgedwongen op SFTP en tus (voorheen alleen web-uploads).

## [3.2.0] - 2026-07-20

### Toegevoegd

- **Wachtwoord-reset via e-mail** (SMTP): aanvragen op de loginpagina, resetlink
  per mail (of gelogd zonder SMTP), bevestigen op een resetpagina.
- **Gedeelde mappen met schrijfrechten**: delingen kennen nu een modus `ro`/`rw`;
  ontvangers met `rw` kunnen in de gedeelde map uploaden, mappen maken en verwijderen.
  Nieuw: gebruikers kunnen zelf mappen delen (`/api/grant`).
- **Bestandscommentaar, tags en favorieten** per bestand (`/api/meta`,
  `/api/favorites`), opgeslagen per gebruiker.
- **Thumbnailcache** met `sharp`: verkleinde afbeeldingen worden gecachet (`/api/thumb`).
- **Client-side end-to-end-versleuteling** (AES-GCM in de browser): optioneel
  versleutelen vóór upload en ontsleutelen na download; de server ziet enkel cijfertekst.
- **tus 1.0.0-protocol** (`/tus`) voor hervatbare, zeer grote overdrachten
  (interopt met standaard tus-clients).
- **Prometheus-metrics** op `/metrics` (uploads, downloads, logins, bytes, actieve SSE-clients).
- **Ingebouwde back-upplanner** met retentie, plus handmatige back-up en overzicht
  in het admin-dashboard.
- Admin-dashboard: e-mailadres per gebruiker instelbaar.

## [3.1.0] - 2026-07-19

### Toegevoegd

- Reverse-proxy-configuraties voor publiek gebruik met echt TLS:
  `deploy/Caddyfile` (automatisch Let's Encrypt) en `deploy/nginx.conf` (certbot).
- Hervatbare (chunked) uploads voor grote bestanden, met resume na onderbreking.
- Realtime updates via Server-Sent Events: de web UI ververst automatisch als
  er via SFTP/WebDAV of een andere sessie iets wijzigt.
- Bandbreedtelimiet per gebruiker voor downloads (instelbaar in het admin-dashboard).
- Optionele antivirus-scan van uploads met ClamAV (`CLAMSCAN`).
- Optionele OpenID Connect (SSO) login (`OIDC_*`), met auto-provisioning.
- Optioneel post-upload-commando (`POST_UPLOAD_CMD`) voor off-site backup,
  bijvoorbeeld `aws s3 cp` naar een S3-bucket.
- Meertalige UI uitgebreid naar NL / EN / DE / FR.
- End-to-end browsertests met Playwright (`npm run test:e2e`) + aparte CI-job.

### Gewijzigd

- De prullenbak telt nu zichtbaar mee in de gebruikte opslag/quota; `whoami`
  geeft de prullenbakgrootte terug en de UI toont deze.
- Admin-dashboard: quota en bandbreedte per gebruiker bewerkbaar.

## [3.0.0] - 2026-07-19

### Toegevoegd

**Beveiliging & accounts**
- Sessies + loginpagina met uitloggen (naast Basic Auth voor API/WebDAV).
- Twee-factor-authenticatie (TOTP) met in-/uitschakelen vanuit de UI.
- Rollen & rechten: `admin`, `user` en `readonly` (alleen-lezen kan niet
  schrijven, ook niet via SFTP/WebDAV).
- Gedeelde mappen tussen gebruikers ("Gedeeld met mij").
- Quota per gebruiker (uploads worden geweigerd bij overschrijding).
- Persistente IP-bans, met automatische escalatie vanuit de rate limiting.

**Bestandsbeheer**
- Publieke deel-links met optionele vervaldatum en wachtwoord (`/s/<token>`).
- Meerdere bestanden selecteren voor bulk-download (ZIP) en bulk-verwijderen.
- Mappen uploaden met behoud van de substructuur.
- Prullenbak: verwijderen verplaatst naar `.trash`, met herstellen en legen.
- Thumbnails voor afbeeldingen in de bestandslijst.
- Tekst-editor in de browser (openen, bewerken, opslaan) + nieuw bestand aanmaken.

**Beheer & bediening**
- Admin-dashboard (`/admin.html`): gebruikers beheren, IP-bans en audit-log.
- WebDAV-endpoint op `/webdav` (koppelbaar als netwerkschijf).
- Systemd-servicebestand (`deploy/fileserver.service`).
- Webhook-notificaties bij uploads en verwijderingen (`WEBHOOK_URL`).

**Comfort**
- Licht/donker-thema (schakelbaar, onthouden) en taal NL/EN.
- Mobiele PWA: manifest + service worker (installeerbaar, offline app-schil).
- Geïntegreerde tests (`npm test`) en GitHub Actions CI.

### Gewijzigd

- Verwijderen gaat nu naar de prullenbak in plaats van definitief wissen.
- User-CLI ondersteunt nu rollen en quota (`role`, `quota`).
- `SESSION_SECRET` wordt automatisch in `.env` gegenereerd.
- Nieuwe `OPTIONS.md` met de volledige functie-/roadmaplijst.

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

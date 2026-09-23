# Changelog

## [3.40.0] - 2026-09-23

### Toegevoegd (Batch T — Data-intelligentie)

- **Duplicaten-opruimassistent**: kies per duplicaatgroep welk exemplaar blijft (oudste,
  nieuwste, kortste pad of een voorkeursmap), bekijk het voorstel met het terug te winnen
  volume en voer het uit. Vlak vóór het verwijderen wordt opnieuw gecontroleerd dat elk bestand
  nog byte-identiek is aan het bewaarde exemplaar (SHA-256); vergrendelde en
  onder-bewaarplicht staande bestanden worden overgeslagen. Kopieën gaan naar de prullenbak
  (herstelbaar). `GET /api/duplicates/plan`, `POST /api/duplicates/apply`.
- **Opruimadvies**: één overzicht per categorie (grote, oude en nooit gedownloade bestanden,
  duplicaten, prullenbak, oude versies) met het terug te winnen volume, instelbare drempels en
  bulk-verplaatsen naar de prullenbak (`GET /api/cleanup-advice`).
- **Full-text zoeken met fragmenten**: treffers in tekst-, code- en Office-bestanden en in
  OCR-tekst, met tot drie niet-overlappende contextfragmenten per bestand en het aantal treffers;
  de treffer wordt veilig gemarkeerd. Begrensd op bestandsgrootte en aantal bestanden, met
  rate-limiting (`GET /api/search/snippets`).
- **Slimme collecties**: opgeslagen zoekopdrachten kunnen nu filters hebben (type, tag,
  classificatie, min/max-grootte, gewijzigd binnen of ouder dan N dagen). Ze worden live
  geëvalueerd (`GET /api/saved-searches/:id/items`); ongeldige filters worden geweigerd.

## [3.39.0] - 2026-09-23

### Toegevoegd (Batch S — Clients & toegang)

- **QR-apparaatkoppeling**: start op een ingelogd apparaat een koppeling (QR-code). Het nieuwe
  apparaat claimt de code en het ingelogde apparaat keurt expliciet goed, met naam, browser, IP
  en een controlecode in beeld. Pas daarna krijgt het nieuwe apparaat één keer een sessie en
  wordt het als vertrouwd apparaat opgeslagen.
  - Codes zijn eenmalig, drie minuten geldig en leven alleen in het geheugen. Ze staan in het
    URL-fragment, zodat ze niet in logs belanden.
  - Het nieuwe apparaat krijgt een eigen claim-geheim; wie alleen de QR meekijkt, kan de sessie
    niet overnemen.
  - Koppelen kan alleen vanuit een echte browsersessie (niet met API-sleutel, Basic-auth of
    tijdens impersonatie). Claim- en statusverzoeken hebben rate-limiting.
- **Netwerkschijf-profielen + diagnose**: kant-en-klare profielen voor rclone (WebDAV en SFTP),
  Windows (`net use`), macOS Finder, Linux (davfs2/fstab) en sshfs, als download of om te
  kopiëren. Er staat nooit een wachtwoord in. Een diagnose waarschuwt onder meer voor een
  ontbrekende `APP_BASE_URL` en voor WebDAV zonder HTTPS (Windows).
- **Mobiele PWA**: touch-vriendelijke layout op smalle schermen (grotere tikdoelen, scrollbare
  header, schermvullende dialogen, geen iOS-zoom op invoervelden) en een offline
  upload-wachtrij. Uploads zonder verbinding worden in IndexedDB bewaard (max. 200 MB) en
  automatisch verstuurd zodra je weer online bent. De service-worker-cache is vernieuwd (v3).

## [3.38.0] - 2026-09-23

### Toegevoegd (Batch R — Delen & externe samenwerking)

- **Klantportalen**: een gebrande, publieke pagina (`/p/<token>`) per klantmap, met eigen
  koptekst en accentkleur, optioneel wachtwoord en vervaldatum. De klant bladert door de map en
  downloadt bestanden; als dat is toegestaan levert de klant ook bestanden aan (na virusscan,
  binnen het quotum van de eigenaar, in de submap `Aangeleverd`). Paden blijven strikt binnen de
  portaalmap, als vertrouwelijk/geheim gelabelde mappen en bestanden worden nooit via een
  portaal getoond, en er is rate-limiting op verzoeken en wachtwoordpogingen.
  Beheer via `/api/portals`.
- **Deel-link-presets**: herbruikbare profielen (vervaltijd, max. downloads, snelheidslimiet,
  auto-wachtwoord) per gebruiker. `/api/share` accepteert een `presetId`; met auto-wachtwoord
  wordt per link een willekeurig wachtwoord gemaakt en één keer getoond (presets bevatten nooit
  een wachtwoord in platte tekst). De deel-dialoog is een formulier met preset-keuze geworden.

## [3.37.0] - 2026-09-23

### Toegevoegd (Batch Q — Automatisering & workflows)

- **Uitgebreide workflow-engine**: upload-regels ondersteunen nu extra condities
  (`nameContains`, min/max-grootte) en een `label`-actie (classificatie), plus een
  aan/uit-schakelaar per regel (`POST /api/rules/:id/enabled`).
- **Geplande rapporten**: een admin plant periodieke rapporten (overzicht of SLA) die per
  e-mail of als tekstbestand in de `Rapporten`-map worden geleverd; met "nu draaien".
  Endpoints onder `/api/admin/scheduled-reports`.
- **Map-/projectsjablonen**: een admin definieert benoemde sjablonen (mappen + bestanden) die
  een gebruiker in één klik in een doelmap instantieert (`/api/templates`,
  `/api/templates/:id/apply`).
- **Bestandsverloop-workflow (op inactiviteit)**: per-gebruiker beleid per map — na
  `warnDays` een waarschuwing, na `archiveDays` verplaatsen naar `Archief`, na `deleteDays`
  verwijderen; vergrendelde en onder-bewaarplicht staande bestanden worden altijd overgeslagen.
  `/api/lifecycle` (+ `preview`/`run`).

## [3.36.0] - 2026-08-25

### Toegevoegd (Batch P — Beheer & observability)

- **Opslag-dashboard met grafieken**: geconsolideerd `GET /api/admin/dashboard` (opslaggroei/vrije
  schijfruimte over tijd, top-opslag per gebruiker, actieve gebruikers 24u) + inline-SVG-grafieken
  in de admin-UI.
- **Beschikbaarheids-/SLA-dashboard**: `GET /api/admin/sla?days=` berekent uptime%, MTTR, een
  dag-tijdlijn en incidenten per severity uit de incident-historie (`SLA_DOWNTIME_SEVERITIES`
  bepaalt welke severities als downtime tellen). Nieuwe "Beschikbaarheid (SLA)"-sectie in de admin-UI.
- **Configuratie-UI**: de runtime-instellingen worden nu schema-gedreven weergegeven en bewerkt
  (`GET /api/admin/settings` levert ook een getypeerd schema), met validatie/coercion bij opslaan.
  Nieuwe instelbare **globale mededeling (banner)** die alle gebruikers bovenaan de UI zien
  (`bannerText`/`bannerLevel`). Geheimen blijven in `.env`.

## [3.35.1] - 2026-08-20

### Opgelost (security-review batches L–O)

- **Quota-omzeiling via e-mail-upload en hot-folder**: beide invoerkanalen schreven naar de
  opslag van een gebruiker zonder de quota-controle die alle interactieve uploads wél doen.
  Een gelekte inbox-token of een volle hot-folder kon zo de schijf volgooien. Beide bewaken
  nu `dirSize(home) + grootte > quota` (0 = onbeperkt) en weigeren het overschot.
- **`organize/apply` omzeilde locks/retentie en liet metadata verweesd achter**: de
  mapstructuur-suggestie verplaatste ook vergrendelde/onder-bewaarplicht-staande bestanden en
  migreerde tags/locks/ocr/vision/permalinks niet mee. Nu slaat het vergrendelde en
  bewaarplicht-bestanden over (net als bulk/move) en verhuist alle metadata mee.
- **Geheugen-DoS in `/api/ai/ask`**: de bestandscontext werd volledig in het geheugen gelezen
  vóór inkorting. Nu wordt hoogstens ~2×`AI_MAX_CONTEXT` bytes gelezen.
- **Timing-veilige token-vergelijking** voor de chat-bot (`timingSafeEqual` i.p.v. `===`).

### Bevestigd in orde
- Shredder respecteert locks én WORM-retentie (staat achter dezelfde `continue`-guards als een
  normale verwijdering).
- AI-/vision-commando's draaien via `execFile` (geen shell), dus geen commando-injectie; de
  EXIF-GPS-parser is begrensd door de buffer; kaart/tijdlijn/grafiek blijven binnen de eigen
  home en zijn begrensd door `INSIGHTS_MAX_SCAN`.

## [3.35.0] - 2026-08-20

### Toegevoegd (Batch O — Weergave & inzicht)

- **Kaartweergave**: leest GPS-coördinaten uit de EXIF van foto's (ingebouwde parser, geen
  externe dienst) en toont ze op een kaart (`GET /api/geo/photos`).
- **Tijdlijnweergave**: bestanden gesorteerd op datum (EXIF-opnamedatum voor foto's, anders
  wijzigingsdatum), gebucket per maand (`GET /api/timeline`).
- **Relatiegrafiek**: toont bestanden die via gedeelde tags met elkaar verbonden zijn als een
  knopen-en-verbindingen-grafiek (`GET /api/graph/tags`).
- Alle drie de weergaven renderen client-side met inline-SVG (geen externe bibliotheken of
  kaarttegels; werkt offline en binnen een strikte CSP).

## [3.34.0] - 2026-08-20

### Toegevoegd (Batch N — Invoer & integraties)

- **Upload via e-mail**: elke gebruiker kan een geheim inbox-adres aanmaken; een mailprovider
  (of script) POST't een geparste e-mail met bijlagen naar `/api/email-inbox/<token>` en die
  bijlagen komen — na een virusscan — in de `Inbox-mail`-map. Beheer via `/api/email/token`.
- **Scan-naar-map (hot-folder)**: een host-map (`HOTFOLDER_DIR`) wordt periodiek geleegd naar
  de opslag van een gebruiker (na virusscan). Handmatige scan via `POST /api/hotfolder/scan`.
- **Chat-bot (Slack/Teams/Discord)**: inkomend commando-endpoint `POST /api/chat/command`
  (gedeelde `CHAT_BOT_TOKEN`) met `list`/`search`/`help`; uitgaande meldingen lopen al via
  `WEBHOOK_URL`.

## [3.33.0] - 2026-08-20

### Toegevoegd (Batch M — AI & slimme organisatie)

- **AI-assistent**: stel een vraag (optioneel met de inhoud van een bestand als context)
  aan een extern commando (`AI_CMD`, bv. een lokale LLM-CLI die de prompt op stdin krijgt).
  Endpoint `POST /api/ai/ask`; nette 501 als er geen commando is ingesteld.
- **Gezichts-/objectherkenning**: laat een extern commando (`VISION_CMD`) labels uit
  afbeeldingen halen; labels worden opgeslagen en meegenomen bij het zoeken. Analyseer
  handmatig via `POST /api/vision/detect` en zoek met `GET /api/vision/search?label=`.
- **Automatische mapstructuur-suggesties** (volledig lokaal, geen AI nodig): stelt een nette
  indeling voor per type, extensie of jaar en past de verplaatsingen na bevestiging toe
  (`GET /api/organize/suggest`, `POST /api/organize/apply`).

## [3.32.0] - 2026-08-14

### Toegevoegd (Batch L — Vertrouwen & workflow)

- **Digitale ondertekening & verificatie**: onderteken een bestand met de server-sleutel
  (Ed25519); verificatie toont per handtekening of hij geldig is én of het bestand sinds
  ondertekening ongewijzigd is. Publieke sleutel op `/api/signing/pubkey`.
- **Veilig verwijderen ("shredder")**: overschrijf de bestandsinhoud (`SHRED_PASSES`) en sla
  de prullenbak over, zodat de data niet triviaal terug te halen is (best-effort; op
  CoW/SSD niet gegarandeerd).
- **@-vermeldingen in reacties**: noem `@gebruiker` in een bestandsreactie en die persoon
  krijgt een melding.
- **Taken/actiepunten op bestanden**: koppel een taak (titel, toegewezene, status
  open/bezig/klaar) aan een bestand; de toegewezene krijgt een melding.

## [3.31.1] - 2026-08-14

### Opgelost (security-review v3.28–v3.31)

- **OpenAPI-spec achter authenticatie**: `/api/openapi.json` stond vóór de auth-middleware en
  was dus publiek — op een internet-facing deploy een onnodige API-map voor anonieme
  bezoekers. De spec vereist nu een geldige sessie of API-sleutel (Swagger UI/Postman
  authenticeren met een `fsk_`-sleutel). De `/docs`-schil blijft bereikbaar maar toont niets
  zonder geldige spec.

### Bekende beperking (gedocumenteerd)

- **Kiosk-/gastmodus is een UI-vergrendeling, geen toegangscontrole**: het verbergt
  muterende/beheer-knoppen en wordt met een client-side pincode verlaten, maar de gebruiker
  blijft met het eigen account ingelogd. Wil je échte beperking op een gedeeld apparaat,
  gebruik dan een apart `readonly`-account. Server-side controles (rollen, `requireWrite`/
  `requireAdmin`) blijven altijd van kracht, onafhankelijk van de kioskmodus.

## [3.31.0] - 2026-08-14

### Toegevoegd (Batch K — UX & toegankelijkheid)

- **Recent & vastgezet**: een dashboard bovenaan met vastgezette mappen (server-side bewaard,
  op elk apparaat) en recent geopende/gedownloade bestanden. Map vastzetten met 📌.
- **Meerdere weergaven**: wissel tussen lijst- en rasterweergave (📊); kolommen (grootte) te
  verbergen.
- **Uitgebreide i18n**: talen NL/EN/DE/FR + **ES/IT/PL** en **RTL-ondersteuning** (o.a.
  Arabisch); per-gebruiker taalkeuze.
- **Toegankelijkheid (WCAG-AA)**: skip-link, zichtbare focus-indicatie, ARIA-labels op
  icoonknoppen en tabellen, en `lang`/`dir` op het document.
- **Laagbandbreedte-modus** (🐢): geen thumbnails en geen animaties voor trage verbindingen.
- **Kiosk-/gastmodus** (🔒): een vergrendelde, uitgeklede weergave (geen upload/beheer/
  muterende acties) voor gedeelde apparaten, te verlaten met een pincode; ook via `?kiosk=1`.

## [3.30.0] - 2026-08-14

### Toegevoegd (Batch J — API & extensibiliteit)

- **OpenAPI-spec + API-docs**: machine-leesbare OpenAPI 3.0-spec op `/api/openapi.json`
  (bruikbaar met Swagger UI/Postman) en een zelf-gehoste documentatiepagina op `/docs`.
- **Plugin-/extensiesysteem**: een admin koppelt events (upload/delete/rename/share/login/
  download) aan externe commando's die met de event-details (`FS_EVENT`) worden uitgevoerd.
  Krachtig, dus standaard **uit** (`EVENT_HOOKS_ENABLED=true`) en alleen admin-beheer.
- **Fijnmazige uitgaande webhook-abonnementen**: meerdere endpoints, elk met een filter op
  event-type en pad-prefix en een payload-template met `{{velden}}` (plus optioneel een
  gedeeld geheim in `X-FS-Secret`).

## [3.29.0] - 2026-08-14

### Toegevoegd (Batch I — Opslag & continuïteit)

- **Compressie-at-rest**: bestanden die lang niet zijn gewijzigd worden met gzip gecomprimeerd
  (`.gz`, origineel verwijderd) om ruimte te besparen; downloads decomprimeren transparant.
  Handmatig of gepland via `COLD_STORE_DAYS`; per-bestand weer uit te pakken (`/api/warmup`).
- **Point-in-time herstel**: server-brede snapshots van de HELE opslag (reflink waar mogelijk);
  herstel zet de opslag terug naar een gekozen tijdstip, met eerst een veiligheids-snapshot.
- **Zelftest-/chaos-knop**: draait de continuïteitscontroles achter elkaar (back-up geldig +
  herstel-test + integriteits-baseline) en alarmeert bij een probleem; optioneel gepland
  (`SELFTEST_INTERVAL_HOURS`).
- **Statuspagina met incidenthistorie**: beheerders melden incidenten en plannen
  onderhoudsvensters; de publieke statuspagina toont de actuele status, actieve incidenten,
  gepland onderhoud en de historie.

## [3.28.0] - 2026-08-14

### Toegevoegd (Batch H — Media & bewerking)

- **In-browser beeldbewerker**: roteren, spiegelen, bijsnijden en schalen (server-side via
  sharp); het resultaat wordt als nieuw bestand opgeslagen (origineel blijft behouden).
- **PDF-bewerker**: PDF's samenvoegen, pagina's selecteren (splitsen) en roteren (via pdf-lib).
- **Transcoderen op verzoek**: video omzetten naar web-vriendelijk MP4/WebM (via `FFMPEG_CMD`;
  nette 501 als het uit staat).
- **Automatische transcriptie**: spraak-naar-tekst voor audio/video via een extern commando
  (`TRANSCRIBE_CMD`, bijv. whisper); het transcript wordt als `.txt` opgeslagen.

## [3.27.1] - 2026-08-14

### Opgelost (security-review v3.25–v3.27)

- **Classificatiebeleid geldt nu ook voor permalinks.** Vertrouwelijke/geheime bestanden
  werden geweigerd bij `/api/share`, maar konden nog via `/api/permalink` (een publieke
  `/f/`-link) naar buiten. `/api/permalink` past nu dezelfde `mayShare`-controle toe.
- **Naamgeving-suggestie begrenst office-parsing** (max. 20 MB) om geheugenuitputting bij
  zeer grote docx/xlsx/pptx te voorkomen.

### Opmerking (bekende beperking)

- Apparaatgoedkeuring (`REQUIRE_DEVICE_APPROVAL`) geldt voor de interactieve web-login
  (`/api/login`). Op credential-gebaseerde toegang (HTTP Basic, API-sleutels, SFTP) — bedoeld
  voor clients/automatisering — geldt deze niet; beveilig die kanalen met sterke wachtwoorden,
  SSH-sleutels en 2FA/hardware-sleutels.

## [3.27.0] - 2026-08-14

### Toegevoegd (Batch G — Automatisering & notificaties)

- **Slimme naamgeving-suggesties**: bij hernoemen stelt de server een naam voor op basis van
  de inhoud (eerste kop van tekst/office) of de EXIF-opnamedatum van foto's.
- **Regelgebaseerde automatisering**: per gebruiker regels ("als upload in map X met extensie
  Y → tag / verplaats / notificeer"), toegepast bij elke upload.
- **Map-abonnementen**: volg een map en krijg een melding (in-app + digest) bij wijzigingen,
  bijv. drop-link-aanleveringen of gedeelde uploads.
- **Digest-notificaties**: verzamel meldingen en ontvang periodiek (dagelijks/wekelijks) één
  samenvattings-e-mail in plaats van losse mailtjes.

## [3.26.0] - 2026-08-14

### Toegevoegd (Batch F — Delen & clients)

- **Brandbare brievenbus**: een drop-link die na de eerste aanlevering vervalt (`burn`),
  voor eenmalige, veilige aanlevering door externe partijen. Ook een instelbaar
  `maxUploads` op drop-links.
- **CLI-client** (`bin/fs-cli.mjs`, `npm run cli`): `ls`, `get`, `put`, `mkdir`, `rm`, `share`
  tegen de API met een API-sleutel — voor scripting en automatisering.
- **WebDAV-verbeteringen**: `LOCK`/`UNLOCK` (class-2 locking) zodat Windows Verkenner en
  macOS Finder betrouwbaar kunnen schrijven, plus `ETag`/`If-None-Match` (304) en
  `getetag`/`supportedlock` in `PROPFIND` voor property-caching.

## [3.25.0] - 2026-08-14

### Toegevoegd (Batch E — Beveiliging & identiteit)

- **Data-classificatielabels**: label bestanden als openbaar/intern/vertrouwelijk/geheim.
  Beleid: vertrouwelijke en geheime bestanden kunnen niet via een publieke deel-link naar
  buiten (`/api/share` weigert dit).
- **Vertrouwde apparaten**: elk apparaat komt in een apparaatlijst (browser, IP, laatst gezien);
  vertrouw of vergeet ze. Met `REQUIRE_DEVICE_APPROVAL=true` mag een onvertrouwd apparaat niet
  inloggen (het eerste apparaat van een gebruiker wordt automatisch vertrouwd; een admin kan
  een apparaat goedkeuren om uitsluiting te voorkomen).
- **Sessie-forensics**: per gebruiker een overzicht van actieve sessies, IP-historie en een
  waarschuwing bij logins vanuit meerdere landen (geografische sprong).

## [3.24.2] - 2026-08-14

### Opgelost (deploy-check)

- **`DATA_DIR`: alle persistente data op één plek.** In de Docker-image mapte alleen een
  handvol bestanden naar het `/data`-volume; nieuwere JSON-datastores (deel-links, tags,
  teams + teamruimtes, snapshots, invites, reviews, opgeslagen zoekopdrachten, inkomende
  hooks, notificaties, instellingen, …) belandden in de (efemere) app-map en gingen daardoor
  verloren bij elke container-update (Watchtower draait dagelijks). `abs()` gebruikt nu
  `DATA_DIR` als basismap; de Dockerfile zet `DATA_DIR=/data`, zodat álle state op het volume
  leeft. Bare-metal-installaties (zonder `DATA_DIR`) behouden het bestaande gedrag; de
  kritieke bestanden (users/opslag/host-key) stonden voor Docker al op `/data`, dus geen
  migratiebreuk.

## [3.24.1] - 2026-08-14

### Opgelost (security-review v3.21–v3.24)

- **Team-uploads worden nu op malware gescand** (antivirus/quarantaine), net als de gewone
  upload- en drop-link-paden. Voorheen kwamen bestanden in een gedeelde teamruimte ongescand
  binnen, terwijl andere leden ze downloaden — een pad voor malware-verspreiding.
- **Teamruimte-groottecap** (`TEAM_SPACE_MAX_BYTES`, standaard onbeperkt): teamopslag telt niet
  mee voor een gebruikersquota; een cap voorkomt schijf-uitputting via een teamruimte.

## [3.24.0] - 2026-08-14

### Toegevoegd (Batch D — Integraties & UX)

- **Inkomende webhooks / API-triggers**: een admin koppelt een geheime token aan één vooraf
  toegestane actie (reindex/backup/check-quotas/notify); externe diensten POST'en naar
  `/api/hooks/<token>` (per-IP rate-limited, geen willekeurige uitvoering).
- **Zapier/Make-recepten**: kant-en-klare integratiesjablonen (in- en uitgaand) in het
  beheer en via `/api/integrations/recipes`.
- **PWA offline-modus**: de service worker cachet de app-schil (stale-while-revalidate) met
  een nette offline-pagina; de UI laadt ook zonder verbinding.
- **Bulk-tagging + tag-galerij**: tag een hele selectie ineens en toon alle bestanden met een
  bepaalde tag.
- **Thema-planning + hoog contrast**: automatisch dag/nacht-thema (donker/licht/auto) en een
  hoog-contrast-modus voor toegankelijkheid.
- **Deelbare openbare galerijen**: een gedeelde afbeeldingsmap opent als read-only galerij op
  `/g/<token>` (met lightbox en optioneel wachtwoord).

## [3.23.0] - 2026-08-14

### Toegevoegd (Batch C — Zoeken & Inzicht)

- **Opgeslagen zoekopdrachten / slimme mappen**: bewaar een zoekopdracht onder een naam en
  voer die met één klik opnieuw uit (⭐-knop).
- **Volledige-tekst-zoeken in kantoordocumenten**: de zoekindex neemt nu ook de tekst uit
  `docx`/`xlsx`/`pptx` mee (`INDEX_OFFICE_CONTENT`).
- **Duplicaten-dashboard**: 🧬-knop toont groepen identieke bestanden met verspilde ruimte;
  ruim kopieën op of dedupliceer automatisch met reflinks.
- **Interactief analytics-overzicht** (admin): actie-verdeling, top-gebruikers en een
  activiteit-tijdlijn per dag, met instelbare periode.

## [3.22.0] - 2026-08-14

### Toegevoegd (Batch B — Samenwerking)

- **Gedeelde teamruimtes**: benoemde ruimtes met meerdere leden en rolgebaseerde toegang
  (viewer/editor/admin), elk met een eigen opslagmap. Beheer via de 🧑‍🤝‍🧑-knop: bestanden
  uploaden/downloaden/verwijderen en leden beheren.
- **Goedkeuringsworkflow**: markeer een bestand als "in review"; een admin/eigenaar keurt
  goed of af. Status per bestand, verplaatst/verdwijnt mee bij hernoemen/verwijderen.
- **Versie-diff-weergave**: bekijk het regel-voor-regel verschil tussen een oudere versie en
  het huidige bestand (met +/− telling) via de "diff"-knop in het versie-overzicht.

## [3.21.0] - 2026-08-14

### Toegevoegd (Batch A — Beveiliging)

- **Hardware-security-keys voor SFTP**: met `SFTP_REQUIRE_HARDWARE_KEY=true` worden alleen
  FIDO2-backed SSH-sleutels (`sk-ssh-ed25519`, `sk-ecdsa`) geaccepteerd; wachtwoord- en
  niet-hardware-publickey-auth worden geweigerd.
- **Geo-/IP-blokkering**: weiger logins uit geblokkeerde landen (`BLOCKED_COUNTRIES`, via de
  geo-header) en/of IP-bereiken (`BLOCKED_CIDRS`). CIDR-blokken gelden ook voor SFTP.
- **Just-in-time toegang**: een gebruiker vraagt tijdelijk een hogere rol aan (met reden);
  een admin keurt goed, waarna de verhoging automatisch vervalt (`JIT_MAX_HOURS`).
- **Anomalie-detectie**: alarmeer bij ongebruikelijk downloadvolume per uur
  (`ANOMALY_DL_COUNT` / `ANOMALY_DL_BYTES`) — vroege signalering van data-exfiltratie.

## [3.20.2] - 2026-08-14

### Prestatie

- **Gzip-compressie** voor tekstuele responses (JSON-listings, HTML/JS/CSS): scheelt fors
  bandbreedte en laadtijd. Server-Sent Events (moeten ongebufferd stromen), byte-range/206-
  downloads (compressie zou de `Content-Range` breken) en niet-comprimeerbare types
  (afbeeldingen, zip, webp) worden bewust overgeslagen.

## [3.20.1] - 2026-08-14

### Prestatie

- **Gecachete map-grootte** (`dirSize`): quota-checks en de quota-weergave deden bij
  elk verzoek een volledige, synchrone recursieve tree-walk. Het resultaat wordt nu kort
  gecachet (`DIRSIZE_CACHE_MS`, standaard 5s) en bij elke wijziging (upload/verwijderen/
  verplaatsen) direct geïnvalideerd, zodat quota's blijven kloppen.
- **Efficiënte audit-log-lezer** (`tailLines`): endpoints als de activiteitenfeed en de
  statistieken lazen telkens het hele audit-logbestand in het geheugen. Ze lezen nu alleen
  de staart van het bestand via een file-descriptor.
- **Snapshot-groottes gecachet**: `listSnapshots` statte elk bestand in elke snapshot bij
  elke aanroep. Grootte/aantal worden nu één keer bij aanmaak berekend en in een
  sidecar-`.meta.json` bewaard.
- **JSON-datastores met mtime-lees-cache** (`shares`, `tags`, `notifications`, `folder-info`,
  `invites`): deze bestanden werden bij elke bewerking opnieuw van schijf gelezen en geparset.
  Er wordt nu alleen opnieuw geparset als het bestand echt is gewijzigd.

## [3.20.0] - 2026-08-14

### Toegevoegd

- **2FA-herstelcodes**: bij het inschakelen van 2FA krijg je 10 eenmalige herstelcodes
  (scrypt-gehasht opgeslagen). Deze werken als vervanging voor de TOTP-code bij inloggen.
- **Magic-link login**: inloggen via een e-maillink (`/api/login/magic`), geldig gedurende
  `MAGIC_LINK_TTL_MIN` minuten.
- **Zelfregistratie met invite-codes**: beheerders maken invite-codes (rol, quota, max.
  gebruik, vervaldatum); nieuwe gebruikers registreren via `/register.html?code=…`.
- **Per-deellink snelheidslimiet**: een deel-link kan een download-snelheidslimiet (KB/s)
  krijgen.
- **Bestandssjablonen**: nieuwe bestanden aanmaken vanaf een sjabloon.
- **Per-map beschrijving/README**: mappen krijgen een beschrijving die als README wordt
  getoond.
- **Mapkleuren & iconen**: mappen krijgen een eigen kleur en icoon.
- **Opslag-deduplicatie**: identieke bestanden worden vervangen door reflinks
  (copy-on-write, waar het bestandssysteem dit ondersteunt).
- **Hervatbare downloads**: `/api/download` ondersteunt HTTP Range (206 Partial Content).
- **Activiteitenfeed per map**: acties binnen een map worden bijgehouden en getoond.
- **"Gezien door" read-receipts**: zie wie een gedeeld bestand heeft bekeken.
- **Publieke status-pagina** (`/status.html`): toont server-status zonder inloggen.
- **Quota-waarschuwing per e-mail**: gebruikers krijgen bericht bij het naderen van hun quota.
- **Onveranderbare snapshots**: maak momentopnames van je bestanden en herstel ze later.
- **Uitgaande webhook-wachtrij met retries**: systeem-alerts gaan via een wachtrij met
  exponentiële backoff (max. `WEBHOOK_MAX_RETRIES`).
- **Certificaat-vervalbewaking**: waarschuwing wanneer het TLS-certificaat binnen
  `CERT_WARN_DAYS` dagen verloopt.

## [3.19.1] - 2026-07-24

### Opgelost (security-review v3.19-batch)

- **`/api/richpreview` heeft nu een groottelimiet** (100 MB) en rate-limiting: EPUB/STL
  worden volledig in het geheugen geparseerd, dus buitensporig grote bestanden werden
  geweigerd om geheugen/CPU-uitputting te voorkomen.
- **Desktop-sync-client is gehard tegen path-traversal**: een kwaadaardige of
  gecompromitteerde server kan via een `..`-pad in de sync-respons niet langer bestanden
  buiten de lokale sync-map schrijven (paden worden gevalideerd).
- **Toegangsaanvraag-pad wordt begrensd** (lengte) als kleine defensieve maatregel.

## [3.19.0] - 2026-07-24

### Toegevoegd

- **OCR-zoeken**: tekst uit afbeeldingen en gescande PDF's wordt bij upload herkend
  (via een extern OCR-commando zoals `tesseract`) en meegenomen in het inhoud-zoeken.
- **Automatische categorisatie/tagging**: uploads krijgen automatisch tags op basis van
  bestandstype én inhoud (factuur, contract, cv, financieel, medisch, …). `AUTO_TAG=true`.
- **Desktop-sync-client** (`bin/fs-sync.mjs`, `npm run sync`): synchroniseert een lokale map
  twee richtingen met de server (nieuwere versie wint), eenmalig of met `--watch`. Ondersteund
  door een nieuw `/api/changes`-endpoint dat de boom met mtime levert.
- **Toegangsaanvraag-workflow**: een gebruiker vraagt toegang tot een map van iemand anders;
  de eigenaar krijgt een melding en keurt goed (waarna de deling ontstaat) of af.
- **Rijke previews**: EPUB-omslag (cover) en STL-informatie (3D: aantal driehoeken +
  afmetingen) in de web-UI.
- **Per-gebruiker geplande taken**: elke gebruiker kan terugkerende opschoontaken instellen
  (oude bestanden verwijderen, prullenbak legen) binnen de eigen opslag; respecteert WORM.

## [3.18.3] - 2026-07-23

### Opgelost (code-review: fouten & verbeteringen)

- **Self-destruct respecteert nu WORM-bewaarplicht**: de opschoon-sweep verwijderde een
  verlopen bestand ook als het onder retentie (legal hold) stond — dat kon een wettelijke
  bewaarplicht ondermijnen. De sweep slaat zulke bestanden nu over tot de retentie afloopt.
- **AVG-forget verwijdert nu ook commentaren van de gebruiker op andermans bestanden**
  (voorheen bleven die met gebruikersnaam achter) — volledigere anonimisering.
- **Duplicaten-vinder hasht in blokken** i.p.v. het hele bestand in het geheugen te lezen —
  voorkomt geheugenpieken/OOM bij grote bestanden.
- **API-sleutel `lastUsed` wordt hoogstens 1×/minuut weggeschreven** i.p.v. bij elk verzoek —
  minder disk-belasting en geen race-conditie die sleutels kon verliezen.

## [3.18.2] - 2026-07-23

### Opgelost (restpunten security-review)

- **Conversie ruimt tijdelijke bestanden op**: `soffice`/`ffmpeg`-resultaten (en de tmp-map)
  worden na verzending verwijderd — geen opeenhoping meer in de tmp-map.
- **API-sleutel-authenticatie is nu rate-limited** per IP en geeft bij een ongeldige sleutel
  netjes 401 (i.p.v. stille doorval), zodat sleutels niet ongelimiteerd te proberen zijn.
- **WORM-nood-override**: een admin kan een per ongeluk ingestelde bewaarplicht opheffen via
  `/api/admin/retention/release` — alleen met step-up, luid gealarmeerd en geaudit.

## [3.18.1] - 2026-07-23

### Opgelost (security-review v3.18-batch)

- **API-sleutels hadden potentieel beheertoegang**: een API-sleutel (langlevend, zonder
  2FA/step-up) van een admin kon beheerendpoints bereiken. `requireAdmin` weigert nu elke
  API-sleutel — beheeracties vereisen een interactieve sessie.
- **WORM-retentie, bestandsvergrendeling en E2E-verplichting waren te omzeilen via WebDAV
  en tus**: die uploadpaden dwongen de compliance-controles niet af. WebDAV `PUT`/`DELETE`/
  `MOVE` en tus-afronding respecteren nu retentie/lock/E2E (423/422), gelijk aan de web-upload.
- **AVG-anonimisering brak het onvervalsbare audit-log**: het herschrijven van de
  gebruikersnaam maakte de hash-keten ongeldig. Na een `forget` wordt de keten nu netjes
  herbouwd, zodat integriteitsverificatie geldig blijft (de erasure zelf is apart geaudit
  en gealarmeerd).

## [3.18.0] - 2026-07-23

### Toegevoegd — compliance

- **AVG/GDPR-toolkit**: dataportabiliteit (alle gegevens van een gebruiker exporteren)
  en recht op vergetelheid (verwijderen + audit-log anonimiseren), beide met audit.
- **WORM/retentie-vergrendeling**: bestanden onwijzigbaar/onverwijderbaar tot een datum
  (wettelijke bewaarplicht) — geldt ook voor de eigenaar/admin.
- **Self-destruct/verlopende bestanden**: upload met `?expiresInDays=N`; een scheduler
  verwijdert verlopen bestanden automatisch.
- **E2E-verplichte mappen**: markeer een map als "alleen versleuteld"; onversleutelde
  uploads (geen `.enc`) worden geweigerd (zero-knowledge).

### Toegevoegd — samenwerking & integraties

- **Aanwezigheid** ("wie kijkt nu naar dit bestand") — voortbouwend op de locks.
- **Per-gebruiker API-sleutels** met scope (`read`/`write`), intrekbaar; auth via
  `Authorization: Bearer fsk_...` of `X-API-Key`.
- **In-app notificatiecentrum** (belletje) naast e-mail/webhook.
- **Webhook-templates** voor Slack/Discord/Teams/ntfy (`WEBHOOK_TYPE`).
- **rclone-/WebDAV-profiel** genereren voor CLI-clients.

### Toegevoegd — bestandsbeheer & inzicht

- **Server-side conversie**: afbeeldingen (via sharp), documenten→PDF (LibreOffice,
  `SOFFICE_CMD`), audio/video-transcode (ffmpeg).
- **Duplicaten-vinder** (SHA-256) over de hele opslag + **opschoon-suggesties**
  (grote/oude/nooit-gedownloade bestanden).
- **Recent geopende bestanden** per gebruiker.
- **Wekelijks e-mailrapport** (`REPORT_EMAIL_INTERVAL_HOURS`).

### Toegevoegd — techniek

- **Docker healthcheck** (readiness-probe) + kant-en-klare **docker-compose met Caddy**.
- **Gestructureerde JSON-logging** met correlation-id per request (`LOG_JSON=true`),
  voor log-aggregatie/OpenTelemetry-collectors.

## [3.17.0] - 2026-07-23

### Toegevoegd

- **DLP (Data Loss Prevention)**: tekstuele uploads worden gescand op BSN (elfproef),
  creditcards (Luhn), IBAN en wachtwoorden-in-klare-tekst. `DLP_ACTION=flag` markeert +
  alarmeert, `block` plaatst het bestand in quarantaine.
- **Break-glass nood-admin** (`BREAKGLASS_USER`/`BREAKGLASS_PASSWORD`): een normaal
  ongebruikt nood-account waarvan elk gebruik luid alarmeert en extra wordt geaudit.
- **Admin-impersonatie** ("bekijk als gebruiker"): een admin kan tijdelijk als een
  andere gebruiker de UI bekijken; de echte admin blijft in de audit zichtbaar, en de
  UI toont een duidelijke banner. Start/stop via het dashboard.
- **Rapportage-dashboard**: opslag per gebruiker en per afdeling, top-verkeer en
  inactieve accounts (`INACTIVE_DAYS`).
- **Toegang-heatmap**: aantal gebeurtenissen per uur-van-de-dag, per weekdag en per
  land (uit het audit-log), zichtbaar in het admin-paneel.
- **Rate-limiting per endpoint**: algemene API-limiet (`API_RATE_MAX`) en een strengere
  download-limiet (`DOWNLOAD_RATE_MAX`) per IP, naast de bestaande login-bescherming.
- **End-to-end browsertest** (Playwright/Chromium) draait in CI naast de integratietests.

## [3.16.4] - 2026-07-23

### Opgelost (volledige code-review)

- **OIDC account-overname voorkomen**: een OIDC-identiteit waarvan de naam botst met
  een bestaand lokaal (niet-OIDC) account kan niet meer op dat account inloggen (409).
  Voorheen kon iemand met een IdP-`preferred_username` als `admin` het lokale
  admin-account overnemen (alleen relevant als OIDC aanstond).
- **Antivirus-bypass via WebDAV & tus gedicht**: uploads via WebDAV `PUT` en via het
  resumable tus-protocol werden niet gescand. Beide scannen nu na afloop en plaatsen
  besmette bestanden in quarantaine (422), gelijk aan de web-upload.
- **WebDAV `PUT` respecteert nu quota en `MAX_UPLOAD_BYTES`** (voorheen ongelimiteerd).
- **Config-import vereist nu step-up** (`requireReauth`), net als export — het overschrijft
  gebruikers/instellingen en is een van de gevoeligste beheeracties.
- **Defensieve escaping** van het (al gevalideerde) token op de drop-upload-bevestigingspagina.

## [3.16.3] - 2026-07-23

### Toegevoegd (security-hardening, vervolg op de review)

- **Uploadgrootte-limiet** (`MAX_UPLOAD_BYTES`, 0 = uit) op álle uploadpaden (web,
  drop-links, chunked, share-target, gedeelde mappen); te grote uploads → 413.
- **Quotabewaking op anonieme drop-uploads**: een deel-link kan het quotum van de
  eigenaar niet meer overschrijden (voorkomt schijf-vol-misbruik).
- **Centrale foutafhandeling**: nette 413/500-JSON i.p.v. een generieke stacktrace.
- **`COOKIE_SECURE`**: forceer de Secure-vlag op de sessie-cookie ook achter een
  TLS-terminerende proxy (`COOKIE_SECURE=true`), los van `TLS_ENABLED`.

## [3.16.2] - 2026-07-23

### Opgelost (security-review hele repo)

- **`/share-target` stond buiten de auth-mount** (`app.use('/api', authenticate)` dekt
  alleen `/api/*`): de PWA-share-route had geen authenticatie. Nu expliciet `authenticate`
  ervoor — de feature werkte hierdoor bovendien nooit correct (geen `req.home`).
- **`REQUIRE_2FA` was alleen een UI-hint**: een gebruiker zonder 2FA kreeg met enkel een
  wachtwoord een volwaardige sessie. Nu een **server-side poort**: bij verplicht 2FA zonder
  ingeschreven TOTP/passkey is alleen het inschrijven (+ whoami/logout/wachtwoord) toegestaan.
- **`trust proxy: true` vertrouwde álle proxy's** → een direct benaderbare instantie kon
  via `X-Forwarded-For` het client-IP spoofen en bans/rate-limiting/geo/IP-allowlist omzeilen.
  Nu configureerbaar via `TRUST_PROXY` (standaard `1` = alleen de directe proxy).
- **`/metrics` lekte gebruikersnamen** (per-gebruiker verkeer, sinds v3.15) als er geen
  `METRICS_TOKEN` was gezet. Per-gebruiker-metrics worden nu alleen getoond wanneer de
  endpoint met een token is beschermd.

## [3.16.1] - 2026-07-22

### Opgelost (code-review)

- **Bestandsvergrendeling sloot een gat**: een vergrendeld bestand kon nog steeds
  worden overschreven via de editor (`/api/save`), delta-sync (`/api/sync/apply`)
  en her-upload met dezelfde naam. Deze paden respecteren nu de vergrendeling (423).
- **Wachtwoordverval telde niet vanaf accountaanmaak**: nieuwe accounts kregen geen
  `pwChangedAt`, waardoor `PASSWORD_MAX_AGE_DAYS` nooit aansloeg tot de eerste
  wijziging. Aanmaak zet nu de wijzigdatum.

## [3.16.0] - 2026-07-22

### Toegevoegd — privacy & beveiliging

- **Toegangslog voor gedeelde bestanden**: de eigenaar ziet wie zijn deel-link/permalink
  downloadde en wanneer (`/api/share-access`).
- **Watermerk op gedeelde afbeeldingen** (`WATERMARK_SHARES`): recipient + datum in de
  afbeelding, zodat een lek herleidbaar is (alleen rasterafbeeldingen, via sharp).
- **Sessie-timeout bij inactiviteit** (`IDLE_TIMEOUT_MS`) + **"overal uitloggen"**.
- **Wachtwoordverval** (`PASSWORD_MAX_AGE_DAYS`) + **wachtwoordhistorie** (geen hergebruik);
  eigen wachtwoord wijzigen via `/api/change-password`.
- **Config-drift-detectie** (`CONFIG_DRIFT_INTERVAL`): alarm als users/settings/shares/bans
  buiten de app om wijzigen (sluit aan op het onvervalsbare audit-log).

### Toegevoegd — samenwerking & organisatie

- **Bestandsvergrendeling**: vergrendel een bestand tegen (per ongeluk) overschrijven of
  gelijktijdige bewerking; ontgrendelen door de vergrendelaar of een admin.
- **Upload-portalen**: drop-links vragen nu een naam en leggen bestanden per inzender in
  een submap.
- **Multi-tenant/afdelingen**: gebruikers krijgen een `tenant`-veld (beheer in het dashboard).

### Toegevoegd — media & preview

- **Office-preview** (docx/xlsx/pptx → platte tekst) zonder externe bibliotheek.
- **Automatische foto-ordening** (EXIF-datum → jaar/maand + dubbele-detectie).
- **Video-posterframes & audio-golfvormen** via `FFMPEG_CMD`.
- **PWA share-target**: bestanden vanuit een andere app "delen naar" de fileserver.

### Toegevoegd — ops

- **Geplande exports** (rsync/rclone) van een map naar een externe bestemming, beheerbaar in het dashboard.
- **Automatische TLS** via een extern ACME-commando (`ACME_CMD`, certbot/acme.sh) met verleng-scheduler.
- **Branding**: aanpasbare app-naam, logo en accentkleur.

## [3.15.0] - 2026-07-22

### Toegevoegd — beveiliging

- **Onvervalsbaar audit-log** (hash-keten): elke regel is met de vorige gekoppeld;
  `/api/admin/audit/verify` (knop in het dashboard) detecteert gewijzigde/verwijderde regels.
- **Sessie-binding** (`SESSION_BIND=off|ip|ua|both`, **standaard `both`**): een gestolen
  sessie-cookie werkt niet vanaf een ander IP/User-Agent. Bij wisselend mobiel IP: kies `ua`.
- **Step-up-herauthenticatie** (`REAUTH_WINDOW_MS`, **standaard 5 min aan**): gevoelige
  beheeracties (gebruiker verwijderen, config exporteren) vereisen een recente
  wachtwoord-herbevestiging (`/api/reauth`); het admin-dashboard vraagt dit automatisch.
- **Bestand-gebaseerde geheimen**: `<SECRET>_FILE` en systemd `$CREDENTIALS_DIRECTORY`
  worden geladen — geheimen kunnen uit Docker/Podman secrets, Kubernetes of Vault komen.

### Toegevoegd — onderhoud & betrouwbaarheid

- **Back-up herstel-test** (`BACKUP_RESTORE_TEST`): ontsleutelt de nieuwste back-up en
  valideert de echte ZIP-structuur (End-Of-Central-Directory + entries), niet alleen de magic-bytes.
- **Readiness-probe** `/ready` (opslag beschrijfbaar + gebruikers geladen) + admin-statusoverzicht (`/api/admin/status`).
- **Per-gebruiker metrics** (bytes up/down als gelabelde Prometheus-metrics) + `fileserver_disk_free_percent`-gauge en nieuwe alertregels.
- **ClamAV-onderhoud**: definitie-updates (`FRESHCLAM_CMD`/`FRESHCLAM_INTERVAL_HOURS`) en
  geplande volledige scan (`AV_SCAN_INTERVAL_HOURS`) die vondsten in quarantaine plaatst.

### Toegevoegd — organisatie

- **Zoekindex** (omgekeerde index) voor snelle bestandsnaam-/inhoudzoekacties; herbouwbaar
  via het dashboard (`SEARCH_INDEX_INTERVAL` voor automatisch).
- **Bulk-verplaatsen** van een selectie naar een doelmap; **tags/labels** per bestand met
  filteren en verhuizen-bij-hernoemen.

## [3.14.0] - 2026-07-21

### Toegevoegd — extra beveiliging & hardening

- **Back-up-encryptie** (AES-256-GCM) met `BACKUP_PASSWORD`; `encryptBackup`/`decryptBackup` voor herstel.
- **Off-site back-up** via `BACKUP_UPLOAD_CMD` (bijv. `rclone copy`, `aws s3 cp`) na elke geplande back-up.
- **Ransomware-/massa-wijziging-detectie**: alarm bij te veel destructieve acties per gebruiker binnen een tijdvenster (`RANSOMWARE_THRESHOLD`/`RANSOMWARE_WINDOW_MS`), zowel via web als SFTP.
- **Honeypot-/lokbestanden** (`HONEYPOTS`): toegang of wijziging triggert direct een alarm.
- **Tweefactor afdwingen** (`REQUIRE_2FA=off|admin|all`): gebruikers zonder 2FA worden bij het inloggen naar de inschrijving geleid (`mustEnroll2fa`).
- **Accountvervaldatum**: verlopen accounts kunnen niet meer inloggen (web + SFTP); instelbaar per gebruiker in het admin-dashboard.
- **fail2ban-hook** (`BAN_CMD`): shell-commando bij ban/unban.
- **Geo-blokkering** (`GEO_ALLOW`/`GEO_HEADER`): toegang beperken tot bepaalde landen.
- **SFTP alleen-sleutel-modus** (`SFTP_PASSWORD_AUTH=false`): wachtwoord-auth uitschakelen.
- **Periodieke integriteitscontrole** (`INTEGRITY_INTERVAL_HOURS`) naast de handmatige scan.
- **SIEM-forwarding** (`SIEM_URL`): audit-events als JSON doorsturen naar een extern SIEM.
- **HaveIBeenPwned-controle** (`PASSWORD_HIBP`): gelekte wachtwoorden weigeren via k-anonimiteit.
- **Documentatie** voor at-rest-encryptie (LUKS/eCryptfs) en off-site back-up (rclone) in `deploy/`.

## [3.13.0] - 2026-07-20

### Toegevoegd — onderhoud & ops

- **Geautomatiseerde dependency-updates**: `.github/dependabot.yml` (npm + actions).
- **`npm audit` in CI**: build faalt bij hoge/kritieke kwetsbaarheden.
- **Update-script** `deploy/update.sh` (back-up → pull → npm ci → herstart, met rollback).
- **Docker auto-update**: Watchtower-service in compose + workflow die een image naar GHCR pusht.
- **Ingebouwde update-checker**: `/api/admin/update-check` vergelijkt met de nieuwste GitHub-release; melding in het dashboard.
- **Log-rotatie** van `audit.log` (`LOG_MAX_BYTES`/`LOG_KEEP`).
- **Alerts** (e-mail/webhook/log) bij schijf bijna vol, mislukte/ongeldige back-up en integriteitswijzigingen.
- **Schijfruimte-bewaking** met waarschuwingsdrempel (`DISK_WARN_PERCENT`).
- **Prometheus alert-rules** (`deploy/prometheus-alerts.yml`).
- **Back-up-verificatie** (geldige ZIP) — handmatig en na elke geplande back-up.

### Toegevoegd — beveiliging & functioneel

- **Security-headers** op alle antwoorden (CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS bij TLS).
- **Bestandsintegriteit**: SHA-256-baseline + controle op wijzigingen/bit-rot.
- **Config/gebruikers export & import** voor migratie/herstel.
- **Galerij-weergave** voor mappen met afbeeldingen.
- **Gedeelde bestandscommentaren** (zichtbaar voor iedereen met toegang).


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

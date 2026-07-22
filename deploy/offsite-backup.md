# Off-site back-ups (rclone)

De ingebouwde back-upplanner maakt periodiek een ZIP van de opslag en kan die
versleutelen (`BACKUP_PASSWORD`). Voor bescherming tegen brand/diefstal/ransomware
op de NAS zelf wil je een **off-site kopie**. Dat gebeurt via `BACKUP_UPLOAD_CMD`:
het commando krijgt het pad van de nieuwste back-up als laatste argument.

## rclone naar cloud-opslag (S3, Backblaze B2, Google Drive, …)

```bash
# Eenmalig een remote configureren, bijv. Backblaze B2:
rclone config    # maak remote 'b2' aan

# In .env:
BACKUP_UPLOAD_CMD=rclone copy --b2-hard-delete b2:mijn-bucket/fileserver
```

De fileserver voert dan uit: `rclone copy ... b2:mijn-bucket/fileserver <back-up-bestand>`.

## AWS S3

```bash
BACKUP_UPLOAD_CMD=aws s3 cp
# => aws s3 cp <back-up-bestand> ... — gebruik een wrapper-script als je een
#    doel-URL wilt meegeven, zie hieronder.
```

## Wrapper-script (voor commando's die de bestemming vóór het bestand willen)

```bash
#!/usr/bin/env bash
# deploy/upload-backup.sh
exec aws s3 cp "$1" s3://mijn-bucket/fileserver/
```

```bash
chmod +x deploy/upload-backup.sh
# .env:
BACKUP_UPLOAD_CMD=/pad/naar/deploy/upload-backup.sh
```

## Aanbeveling

- Zet **`BACKUP_PASSWORD`** zodat de off-site kopie al versleuteld de deur uit gaat.
- Gebruik een bucket met **object-lock/versioning** tegen ransomware.
- Controleer periodiek herstel: `decryptBackup` in `src/backup.js` ontsleutelt een
  `.zip.enc`-bestand terug naar een geldige ZIP.

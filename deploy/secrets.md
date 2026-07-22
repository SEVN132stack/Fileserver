# Geheimen buiten `.env` houden (Docker/Podman/Kubernetes/systemd/Vault)

Standaard leven geheimen in `.env` (mode 0600, buiten git). Voor productie kun je
ze uit een secret-store laden zodat ze niet als omgevingsvariabele of in een
bestand op de app-schijf staan. Twee mechanismen worden ondersteund:

## 1. `<SECRET>_FILE`-conventie

Zet in plaats van de waarde een verwijzing naar een bestand. De inhoud (zonder
afsluitende newline) wordt als het geheim geladen. Ondersteunde geheimen:
`AUTH_PASS`, `SESSION_SECRET`, `SMTP_PASS`, `SMTP_USER`, `BREVO_API_KEY`,
`VT_API_KEY`, `BACKUP_PASSWORD`, `METRICS_TOKEN`, `OIDC_CLIENT_SECRET`.

### Docker / Podman secrets

```yaml
services:
  fileserver:
    image: ghcr.io/sevn132stack/fileserver:latest
    environment:
      AUTH_PASS_FILE: /run/secrets/auth_pass
      SESSION_SECRET_FILE: /run/secrets/session_secret
    secrets: [auth_pass, session_secret]
secrets:
  auth_pass:
    file: ./secrets/auth_pass
  session_secret:
    file: ./secrets/session_secret
```

### Kubernetes

Mount een Secret als bestanden en wijs ernaar:

```yaml
env:
  - { name: AUTH_PASS_FILE, value: /etc/fs-secrets/auth_pass }
volumeMounts:
  - { name: fs-secrets, mountPath: /etc/fs-secrets, readOnly: true }
volumes:
  - { name: fs-secrets, secret: { secretName: fileserver-secrets } }
```

### HashiCorp Vault

Gebruik de Vault-agent of `vault agent template` om geheimen naar bestanden te
renderen en wijs met `<SECRET>_FILE` naar die bestanden.

## 2. systemd `LoadCredential`

De systemd-unit kan geheimen als *credentials* aanleveren; ze staan dan in een
tmpfs onder `$CREDENTIALS_DIRECTORY` en worden automatisch geladen (geen `_FILE`
nodig — de bestandsnaam ís de variabelenaam):

```ini
[Service]
LoadCredential=AUTH_PASS:/etc/fileserver/auth_pass
LoadCredential=SESSION_SECRET:/etc/fileserver/session_secret
```

## Voorrang

Bestand-gebaseerde geheimen worden ná `.env` geladen en winnen: een `<SECRET>_FILE`
of systemd-credential overschrijft een waarde uit `.env`.

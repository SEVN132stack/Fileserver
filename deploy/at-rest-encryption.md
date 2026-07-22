# Encryptie van bestanden op de schijf (at-rest)

De fileserver beveiligt de *toegang* sterk (auth, 2FA, passkeys, rate-limiting,
bans, path-traversal-bescherming), maar de bestanden zelf staan als platte data
op de schijf. Wie fysieke toegang tot de NAS-schijf krijgt (gestolen apparaat,
uitgebouwde schijf, back-upmedia) kan de inhoud lezen. At-rest-encryptie lost dit
op en gebeurt bewust op **filesystem-niveau**, niet in de applicatie — zo blijft de
gedeelde opslag voor SFTP/WebDAV transparant werken.

## Optie A — LUKS (volledige schijf/volume, aanbevolen)

Versleutelt het hele blok-apparaat. Bij het opstarten wordt het volume ontgrendeld,
daarna werkt alles normaal.

```bash
# Eenmalig opzetten (LET OP: wist het doelapparaat!)
sudo cryptsetup luksFormat /dev/sdX
sudo cryptsetup open /dev/sdX cryptdata
sudo mkfs.ext4 /dev/mapper/cryptdata
sudo mkdir -p /srv/fileserver-data
sudo mount /dev/mapper/cryptdata /srv/fileserver-data
```

Automatisch ontgrendelen bij boot via `/etc/crypttab` + keyfile, of handmatig
ontgrendelen (veiliger — wachtwoord staat nergens op de machine).

Zet daarna in `.env`: `STORAGE_DIR=/srv/fileserver-data/storage`.

## Optie B — eCryptfs (per-map, zonder herformatteren)

Versleutelt één map op een bestaand filesystem. Handig als je de schijf niet
opnieuw kunt indelen.

```bash
sudo apt install ecryptfs-utils
sudo mount -t ecryptfs /srv/storage /srv/storage
# Kies AES, key bytes 32, plaintext passthrough: no, filename encryption: yes
```

## Optie C — gocryptfs (FUSE, per-map, in userspace)

```bash
gocryptfs -init /srv/storage.enc
gocryptfs /srv/storage.enc /srv/storage   # gemount = leesbaar
```

## Aanbeveling

- Eén NAS/één volume → **LUKS** (Optie A).
- Alleen een submap versleutelen zonder herformatteren → **gocryptfs** of **eCryptfs**.
- Combineer altijd met versleutelde **back-ups**: zet `BACKUP_PASSWORD` in `.env`
  zodat ook de ZIP-back-ups (AES-256-GCM) beschermd zijn.

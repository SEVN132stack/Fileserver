FROM node:22-alpine

WORKDIR /app

# Installeer alleen productie-dependencies.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Kopieer de applicatie.
COPY src ./src
COPY public ./public

# Data (opslag, keys, users) leeft in /data zodat het als volume kan worden gekoppeld.
ENV STORAGE_DIR=/data/storage \
    HOST_KEY_PATH=/data/host.key \
    USERS_FILE=/data/users.json \
    AUTHORIZED_KEYS_DIR=/data/authorized_keys \
    AUDIT_LOG=/data/audit.log \
    ENV_FILE=/data/.env \
    TLS_CERT=/data/tls/cert.pem \
    TLS_KEY=/data/tls/key.pem

RUN mkdir -p /data
VOLUME /data

EXPOSE 8080 2222

# Healthcheck: de readiness-probe controleert opslag + geladen gebruikers.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WEB_PORT||8080)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]

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

CMD ["node", "src/server.js"]

FROM node:22-alpine

WORKDIR /app

# Installeer alleen productie-dependencies.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Kopieer de applicatie.
COPY src ./src
COPY public ./public

# Alle persistente data (opslag, keys, users, én alle JSON-datastores) leeft in
# /data zodat het als volume kan worden gekoppeld en een container-update niets
# verliest. DATA_DIR is de basismap: elk relatief datapad valt hieronder.
ENV DATA_DIR=/data \
    ENV_FILE=/data/.env

RUN mkdir -p /data
VOLUME /data

EXPOSE 8080 2222

# Healthcheck: de readiness-probe controleert opslag + geladen gebruikers.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WEB_PORT||8080)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]

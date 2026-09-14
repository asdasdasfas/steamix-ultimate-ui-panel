FROM node:24-alpine

WORKDIR /app

# Install build dependencies for native modules + litestream for R2 persistence (Render free ephemeral fix)
RUN apk add --no-cache python3 make g++ su-exec curl
RUN curl -sL https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz | tar -xz -C /usr/local/bin litestream && chmod +x /usr/local/bin/litestream

# Ship the same pinned account runtime as the Debian/Ubuntu installer.
# The host must also permit the nested sandbox (see docs/CONFIGURATION.md).
ARG INSTALL_AI_CODEX_SANDBOX=true
RUN if [ "$INSTALL_AI_CODEX_SANDBOX" = "true" ]; then \
      apk add --no-cache bubblewrap && npm install --global @openai/codex@0.154.0; \
    fi

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

COPY litestream.yml /etc/litestream.yml

# Copy application code
COPY src ./src
COPY public ./public
COPY .env.example ./.env.example
COPY scripts/check-ai-runtime.mjs ./scripts/check-ai-runtime.mjs

# Set environment variables
ENV DATA_DIR=/data
ENV PORT=3000
ENV NODE_ENV=production
ENV AI_CODEX_ENABLED=true

# Create data directory
RUN mkdir -p /data

# Drop root privileges for runtime
RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app /data

# Entrypoint performs compatibility permission fix for mounted volumes, then drops privileges
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Define volume for data persistence
VOLUME ["/data"]

# Start with litestream replication (R2 persistence) - restores on boot, replicates on write
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh","-c","litestream restore -if-replica-exists -o /data/db.sqlite s3://steamix-panel-db/db.sqlite || true; litestream restore -if-replica-exists -o /data/epg.db s3://steamix-panel-db/epg.db || true; litestream replicate --exec \"npm start\""]

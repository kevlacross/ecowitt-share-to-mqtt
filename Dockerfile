FROM node:22-bookworm-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="Ecowitt Share to MQTT" \
      org.opencontainers.image.description="Ecowitt shared-station data to MQTT and Home Assistant Discovery" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}"
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY public ./public
ENV PORT=8080 CONFIG_DB=/config/ecowitt-share-to-mqtt.sqlite NODE_ENV=production
EXPOSE 8080
VOLUME ["/config"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
USER node
CMD ["node", "src/server.js"]

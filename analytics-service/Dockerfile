FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3100

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

USER node

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:3100/api/analytics/health || exit 1

CMD ["node", "src/server.mjs"]

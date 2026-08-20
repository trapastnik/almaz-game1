FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=builder --chown=node:node /app/dist/standalone ./
COPY --from=builder --chown=node:node /app/node_modules/react ./node_modules/react
COPY --from=builder --chown=node:node /app/node_modules/react-dom ./node_modules/react-dom
COPY --from=builder --chown=node:node /app/node_modules/scheduler ./node_modules/scheduler

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]

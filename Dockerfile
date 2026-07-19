FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/codex-usage-profile-cli/package.json ./packages/codex-usage-profile-cli/package.json
RUN npm ci

COPY . .
RUN npm run build:cloud-run

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    PROFILE_STATIC_ROOT=/app/dist \
    PROFILE_STORE_FILE=/tmp/codex-usage-profile-store.json

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/codex-usage-profile-cli/package.json ./packages/codex-usage-profile-cli/package.json
RUN npm ci --omit=dev --workspaces=false \
    && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/src ./src

USER node

EXPOSE 8080

CMD ["node", "src/profile-runtime/production-server.js"]

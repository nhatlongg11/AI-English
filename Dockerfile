# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data \
    && chown node:node /app/data

FROM base AS build
# better-sqlite3 can compile from source when no prebuilt binary is available.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json vitest.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
COPY frontend ./frontend
RUN DATABASE_URL=file:/app/data/tenselab.db npm run db:generate \
    && npm run build \
    && npm run build:web

# Migration/seed tooling runs once before the API starts.
FROM base AS tools
COPY package.json package-lock.json prisma.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist/src ./dist/src
COPY --from=build /app/dist/scripts/seed.js ./dist/scripts/seed.js
USER node

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM base AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_URL=file:/app/data/tenselab.db
COPY package.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist/src ./dist/src
USER node
EXPOSE 3000
CMD ["node", "dist/src/server.js"]

FROM nginx:stable-alpine AS web
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/frontend /usr/share/nginx/html
USER nginx
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]

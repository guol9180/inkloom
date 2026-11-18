FROM node:22.23.2-bookworm-slim AS build

WORKDIR /app
COPY . .
RUN corepack enable \
  && corepack prepare pnpm@12.5.1 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @inkloom/api build

FROM node:22.23.2-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
RUN useradd --create-home --uid 10001 inkloom \
  && mkdir -p /data \
  && chown -R inkloom:inkloom /data /app
COPY --from=build --chown=inkloom:inkloom /app/services/api/dist/server.mjs /app/server.mjs

USER inkloom
EXPOSE 3001
CMD ["node", "/app/server.mjs"]

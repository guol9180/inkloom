FROM node:22.23.2-bookworm-slim AS build

ARG VITE_API_ORIGIN=https://api.inkloom.imhgl.com
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}
WORKDIR /app
COPY . .
RUN corepack enable \
  && corepack prepare pnpm@12.5.1 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm --filter @inkloom/web build

FROM caddy:2.11.4-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv/inkloom/web

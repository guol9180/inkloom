#!/bin/sh
set -eu

if docker volume inspect workbench_caddy_data >/dev/null 2>&1; then
  if ! docker volume inspect inkloom-caddy-data >/dev/null 2>&1; then
    docker volume create inkloom-caddy-data >/dev/null
    docker run --rm \
      --mount type=volume,src=workbench_caddy_data,dst=/from,readonly \
      --mount type=volume,src=inkloom-caddy-data,dst=/to \
      --entrypoint /bin/sh \
      caddy:2-alpine \
      -c 'cp -a /from/. /to/'
  fi
fi

if docker inspect caddy >/dev/null 2>&1; then
  project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' caddy)
  if [ "$project" = "workbench" ]; then
    docker rm -f caddy >/dev/null
  fi
fi

docker network rm workbench_default >/dev/null 2>&1 || true

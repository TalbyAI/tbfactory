#!/bin/sh
set -eu

docker build \
  --file docker/review-sandbox.Dockerfile \
  --tag tbfactory-mvp-docker-sandbox:local \
  docker

FACTORY_SANDBOX_IMAGE=$(docker image inspect \
  --format '{{.Id}}' \
  tbfactory-mvp-docker-sandbox:local)
export FACTORY_SANDBOX_IMAGE

node --import tsx docker/evaluation/scripts/oidc-proxy.ts &
proxy_pid=$!
app_pid=''
stop_children() {
  trap - INT TERM
  status=0
  if [ -n "$app_pid" ]; then
    kill -TERM "$app_pid" 2>/dev/null || true
    wait "$app_pid" || status=$?
  fi
  kill -TERM "$proxy_pid" 2>/dev/null || true
  wait "$proxy_pid" || true
  exit "$status"
}
trap stop_children INT TERM

node --import tsx docker/evaluation/scripts/bootstrap.ts

node --import tsx scripts/installation.ts run &
app_pid=$!
set +e
wait "$app_pid"
status=$?
set -e

kill -TERM "$proxy_pid" 2>/dev/null || true
wait "$proxy_pid" || true
exit "$status"

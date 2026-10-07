FROM node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM docker:29.5.3-cli@sha256:11e1133c30f3ceb73c6bdc7dfb78b3f9ed8e8e0d1d0400e91c5ec2eb240bf2ff AS docker-cli

FROM node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c

ENV NODE_ENV=production
WORKDIR /app

USER root
RUN apt-get update \
    && apt-get install --no-install-recommends --yes git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/docker ./docker
COPY --from=build --chown=node:node /app/tests/support/oidc.ts ./tests/support/oidc.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=docker-cli --chown=node:node /usr/local/bin/docker /usr/local/bin/docker

RUN mkdir -p \
      /run/factory-root \
      /var/lib/factory \
      /var/lib/factory-key-ring \
      /var/lib/factory-ring-backups \
      /var/lib/factory-workflows \
      /var/lib/factory-artifacts \
      /var/lib/tbfactory-evaluation \
    && chown -R node:node \
      /run/factory-root \
      /var/lib/factory \
      /var/lib/factory-key-ring \
      /var/lib/factory-ring-backups \
      /var/lib/factory-workflows \
      /var/lib/factory-artifacts \
      /var/lib/tbfactory-evaluation

USER node
ENTRYPOINT ["sh", "/app/docker/evaluation/entrypoint.sh"]

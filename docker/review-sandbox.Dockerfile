FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
RUN apk add --no-cache git ca-certificates
COPY repository-tool.mjs /opt/factory/repository-tool.mjs
ENV GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0 HOME=/tmp
WORKDIR /workspace
CMD ["sleep", "infinity"]

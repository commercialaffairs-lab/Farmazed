# Imagen para correr la demo y las pruebas en una máquina SIN Java ni herramientas Linux
# (p. ej. Windows): Node 22 + Java 21 (los emuladores de Firebase lo exigen) + firebase-tools
# con los emuladores ya descargados. La usa demo_docker.sh.
FROM node:22-trixie
RUN apt-get update && apt-get install -y --no-install-recommends default-jre-headless iproute2 procps \
  && rm -rf /var/lib/apt/lists/*
RUN npm i -g firebase-tools && firebase setup:emulators:firestore && firebase setup:emulators:storage
WORKDIR /work

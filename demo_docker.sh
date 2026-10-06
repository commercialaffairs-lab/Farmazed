#!/usr/bin/env bash
# demo_docker.sh — La misma demo de demo_local.sh, pero dentro de Docker, para una máquina sin
# Java ni herramientas Linux (Windows con Docker Desktop, p. ej.). Copia el repo al contenedor
# (sin node_modules ni .git), lee tracker/.env si existe (PayPal sandbox) y publica los puertos
# que usa el navegador. Queda corriendo hasta Ctrl-C.
#
#   ./demo_docker.sh              # levanta la demo
#   ./demo_docker.sh --build      # reconstruye la imagen (la primera vez la construye sola)
#
# Entrar: http://localhost:8092/demo.html  (usuarios de prueba: ver demo_local.sh)
#
# SOLO CONTRA EL EMULADOR — nunca toca producción.

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
REPO="$(pwd)"
IMAGEN=farmazed-demo
export MSYS_NO_PATHCONV=1 # Git Bash en Windows: que no "traduzca" las rutas /work del contenedor

if [ "${1:-}" = "--build" ] || ! docker image inspect "$IMAGEN" >/dev/null 2>&1; then
  echo "→ Construyendo la imagen $IMAGEN (Node 22 + Java 21 + emuladores; tarda unos minutos la primera vez)..."
  docker build -t "$IMAGEN" -f docker/demo.Dockerfile docker || exit 1
fi

# Puerto del tracker: el primero libre desde 8080 en ESTA máquina (en Windows, 8080 suele estar
# ocupado); dentro del contenedor se usa el mismo número, así demo.html apunta bien.
TRACKER_PORT=${FZ_TRACKER_PORT:-8080}
# (grep sin -q: con pipefail, cerrar la tubería antes de tiempo haría fallar la comprobación)
while netstat -an 2>/dev/null | grep -E "[:.]${TRACKER_PORT} .*LISTEN" >/dev/null; do TRACKER_PORT=$((TRACKER_PORT + 1)); done
for p in 8092 9099 9199 4040 "$TRACKER_PORT"; do
  if docker ps --format '{{.Ports}}' | grep -q ":$p->"; then
    echo "❌ Otro contenedor ya publica el puerto $p. Detenlo (docker ps / docker stop) y reintenta."; exit 1
  fi
done

ENV_MONTAJE=()
if [ -f tracker/.env ]; then
  ENV_MONTAJE=(-v "$REPO/tracker/.env:/env/tracker.env:ro")
  echo "→ tracker/.env encontrado: se pasa al contenedor (PayPal sandbox si tiene PAYMENTS_PROVIDER=paypal)."
else
  echo "→ Sin tracker/.env: la demo usa el proveedor de pagos de prueba (mock)."
fi

TTY=(); [ -t 0 ] && TTY=(-it) # con terminal, Ctrl-C apaga la demo; sin ella (scripts) no se pide TTY
echo "→ Levantando la demo en Docker (Ctrl-C para apagarla)..."
docker run --rm "${TTY[@]}" --name farmazed-demo \
  -p 8092:8092 -p 9099:9099 -p "$TRACKER_PORT:$TRACKER_PORT" -p 9199:9199 -p 4040:4040 -e FZ_TRACKER_PORT="$TRACKER_PORT" \
  -v "$REPO:/src:ro" "${ENV_MONTAJE[@]}" "$IMAGEN" bash -c '
    set -e
    tar -C /src --exclude=node_modules --exclude=.git --exclude=tracker/.env -cf - . | tar -C /work -xf -
    find /work -name "*.sh" -exec sed -i "s/\r$//" {} +
    [ -f /env/tracker.env ] && cp /env/tracker.env /work/tracker/.env
    # Los emuladores deben escuchar en todas las interfaces para que el navegador (fuera del
    # contenedor) llegue a Auth y Storage por los puertos publicados.
    node -e "
      const fs = require(\"fs\"); const f = \"/work/firebase.json\"; const j = JSON.parse(fs.readFileSync(f, \"utf8\"));
      for (const e of [\"auth\", \"firestore\", \"storage\", \"ui\"]) j.emulators[e] = { ...j.emulators[e], host: \"0.0.0.0\" };
      fs.writeFileSync(f, JSON.stringify(j, null, 2));
    "
    cd /work/tracker && npm ci --no-audit --no-fund >/tmp/npm.log 2>&1 && cd /work
    exec bash demo_local.sh
  '

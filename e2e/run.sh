#!/usr/bin/env bash
# e2e/run.sh — levanta emuladores + tracker + frontend estático, siembra datos,
# corre los specs de Playwright, y apaga todo al salir (pase o falle el test).
#
# SOLO CONTRA EL EMULADOR. Reutilizable para futuros specs (D16) — agregar el
# archivo en e2e/*.spec.js y correr este mismo script.
#
# NUNCA edita archivos fuente del repo (ni siquiera temporalmente): si el
# puerto 8080 está ocupado en esta máquina, el puerto real del tracker se le
# pasa al navegador via localStorage (`fzApiPort`, leído por
# farmazed-web/portal/js/config.js) desde el propio spec de Playwright — ver
# el fixture en estados.spec.js. `git diff config.js` despues de correr esto,
# o de cortarlo a mitad con Ctrl-C, siempre da vacío.
#
# Uso:
#   ./e2e/run.sh                 # corre todos los specs
#   ./e2e/run.sh estados.spec.js # corre uno solo
#
# Requiere (ver DEV_LOCAL.md): JDK 21+ para los emuladores (ya instalado en
# ~/.local/jdk-21.0.12.1+1-jre), Chromium de Playwright ya cacheado en
# ~/.cache/ms-playwright (no descarga nada).

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."   # raiz del repo
REPO_ROOT="$(pwd)"

export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-21.0.12.1+1-jre}"
export PATH="$JAVA_HOME/bin:$PATH"

FIRESTORE_PORT=8090
AUTH_PORT=9099
STORAGE_PORT=9199
UI_PORT=4040
STATIC_PORT=8092

# El tracker asume 8080 por convención — si esta ocupado en esta maquina
# (pasa en Patch: un proceso ajeno vive ahi permanentemente), usamos el
# primer puerto libre desde 8080. El navegador se entera de este puerto via
# localStorage (ver arriba), nunca editando config.js.
find_free_port() {
  local port=$1
  while ss -ltn 2>/dev/null | grep -q ":$port "; do
    port=$((port + 1))
  done
  echo "$port"
}
TRACKER_PORT=$(find_free_port 8080)

PIDS=()
cleanup() {
  echo "→ Deteniendo servicios de prueba..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  # El proceso "firebase emulators:start" arranca java (Firestore, Storage
  # rules) como hijos independientes — matar solo el PID de npx los deja
  # huerfanos, ocupando los puertos para la proxima corrida. pkill por
  # patron los agarra a todos.
  pkill -f "firebase-tools emulators:start" >/dev/null 2>&1 || true
  pkill -f "cloud-firestore-emulator" >/dev/null 2>&1 || true
  pkill -f "cloud-storage-rules-runtime" >/dev/null 2>&1 || true
  rm -f "$REPO_ROOT/firestore-debug.log" "$REPO_ROOT/ui-debug.log" "$REPO_ROOT/firebase-debug.log"
}
trap cleanup EXIT

if [ "$TRACKER_PORT" != "8080" ]; then
  echo "→ Puerto 8080 ocupado en esta maquina — el tracker usa $TRACKER_PORT (el navegador lo toma de localStorage, config.js no se toca)."
fi

echo "→ Levantando emuladores Firebase (Auth:$AUTH_PORT Firestore:$FIRESTORE_PORT Storage:$STORAGE_PORT)..."
npx --yes firebase-tools emulators:start --project demo-farmazed > /tmp/e2e-emulators.log 2>&1 &
PIDS+=($!)

for i in $(seq 1 60); do
  grep -q "All emulators ready" /tmp/e2e-emulators.log 2>/dev/null && break
  sleep 1
done
if ! grep -q "All emulators ready" /tmp/e2e-emulators.log 2>/dev/null; then
  echo "❌ Los emuladores no arrancaron. Log:"; cat /tmp/e2e-emulators.log; exit 1
fi
echo "  emuladores listos."

echo "→ Sembrando datos (admin, cliente, casos, precios)..."
(cd tracker && \
  FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT \
  FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT \
  STORAGE_EMULATOR_HOST=http://localhost:$STORAGE_PORT \
  FIREBASE_PROJECT_ID=demo-farmazed \
  GCS_BUCKET=demo-farmazed.appspot.com \
  node scripts/seed_emulador.js) > /tmp/e2e-seed.log 2>&1
if [ $? -ne 0 ]; then echo "❌ Seed fallo. Log:"; cat /tmp/e2e-seed.log; exit 1; fi

echo "→ Sembrando roles (TAREA 15/E3 — 2 empresas + 1 usuario por rol, para roles.spec.js)..."
(cd tracker && \
  FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT \
  FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT \
  FIREBASE_PROJECT_ID=demo-farmazed \
  node scripts/seed_roles.js) > /tmp/e2e-seed-roles.log 2>&1
if [ $? -ne 0 ]; then echo "❌ Seed de roles fallo. Log:"; cat /tmp/e2e-seed-roles.log; exit 1; fi
echo "  seed OK."

# TAREA 28: esta máquina es compartida — otro proceso, de otro usuario,
# puede tomar un puerto justo entre que find_free_port lo revisa y node
# alcanza a escuchar (visto repetidas veces: "EADDRINUSE" en el log del
# tracker aunque find_free_port haya dicho que estaba libre un instante
# antes). No es un bug de find_free_port; se reintenta con un puerto NUEVO
# (no el mismo con más timeout) hasta 3 veces antes de rendirse.
TRACKER_OK=""
for intento in 1 2 3; do
  TRACKER_PORT=$(find_free_port "$TRACKER_PORT")
  echo "→ Levantando tracker en :$TRACKER_PORT (intento $intento)..."
  (cd tracker && \
    FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT \
    FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT \
    STORAGE_EMULATOR_HOST=http://localhost:$STORAGE_PORT \
    FIREBASE_PROJECT_ID=demo-farmazed \
    GCS_BUCKET=demo-farmazed.appspot.com \
    ADMIN_KEY=dev-admin-local \
    MCP_KEY=dev-mcp-local \
    PORT=$TRACKER_PORT \
    PRICING_TABLE=24sep \
    node index.js) > /tmp/e2e-tracker.log 2>&1 &
  TRACKER_PID=$!
  PIDS+=($TRACKER_PID)

  for i in $(seq 1 30); do
    curl -s -o /dev/null "http://localhost:$TRACKER_PORT/health" && { TRACKER_OK=1; break; }
    kill -0 "$TRACKER_PID" 2>/dev/null || break # el proceso murió (p.ej. EADDRINUSE) — reintenta ya, no sigas esperando
    sleep 1
  done
  [ -n "$TRACKER_OK" ] && break
  echo "  intento $intento falló (puerto $TRACKER_PORT) — reintentando con otro puerto..."
  TRACKER_PORT=$((TRACKER_PORT + 1))
done
if [ -z "$TRACKER_OK" ]; then
  echo "❌ El tracker no arrancó tras 3 intentos. Log:"; cat /tmp/e2e-tracker.log; exit 1
fi
echo "  tracker OK."

echo "→ Sirviendo frontend en :$STATIC_PORT..."
python3 -m http.server "$STATIC_PORT" --directory farmazed-web > /tmp/e2e-static.log 2>&1 &
PIDS+=($!)
# TAREA 26: antes un `sleep 1` sin verificación — bajo carga del host (18
# usuarios en esta máquina, load average visto hasta 15) 1 segundo no
# siempre alcanza para que http.server esté aceptando conexiones cuando
# Playwright hace su primer page.goto(), causando "net::ERR_ABORTED; maybe
# frame was detached?" en el PRIMER test de la corrida (nunca en corridas
# aisladas del mismo spec, que no pasan por este arranque en frío) — mismo
# patrón de espera con reintentos que ya usan los emuladores y el tracker
# arriba — no es un timeout más largo "a ciegas", es esperar a que el
# proceso real esté listo antes de arrancar Playwright.
for i in $(seq 1 15); do
  curl -s -o /dev/null "http://localhost:$STATIC_PORT/login.html" && break
  sleep 1
done
if ! curl -s -o /dev/null "http://localhost:$STATIC_PORT/login.html"; then
  echo "❌ El frontend estático no arrancó. Log:"; cat /tmp/e2e-static.log; exit 1
fi
echo "  frontend OK."

echo "→ Corriendo Playwright..."
cd e2e
FZ_STATIC_PORT=$STATIC_PORT FZ_AUTH_PORT=$AUTH_PORT FZ_FIRESTORE_PORT=$FIRESTORE_PORT FZ_API_PORT=$TRACKER_PORT \
  npx playwright test "$@"
EXIT_CODE=$?

exit $EXIT_CODE

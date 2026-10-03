#!/usr/bin/env bash
# tracker/scripts/run_permission_tests.sh — E3 parte 1 (backend), PM_COMMENTS
# §H.4: levanta los emuladores Firebase (Auth+Firestore — Storage no hace
# falta, ver tracker/tests/permissions.test.js) + el tracker, siembra los 7
# usuarios de rol + 2 empresas (scripts/seed_roles.js) y corre la matriz de
# permisos con el runner nativo de Node (node --test).
#
# SOLO CONTRA EL EMULADOR — nunca toca producción ni el seed de e2e/ (usa su
# propio fixture, seed_roles.js, para no interferir con esos specs).
#
# Uso: ./tracker/scripts/run_permission_tests.sh

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # raiz del repo
REPO_ROOT="$(pwd)"

export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-21.0.12.1+1-jre}"
export PATH="$JAVA_HOME/bin:$PATH"

FIRESTORE_PORT=8090
AUTH_PORT=9099
STORAGE_PORT=9199

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
  pkill -f "firebase-tools emulators:start" >/dev/null 2>&1 || true
  pkill -f "cloud-firestore-emulator" >/dev/null 2>&1 || true
  pkill -f "cloud-storage-rules-runtime" >/dev/null 2>&1 || true
  rm -f "$REPO_ROOT/firestore-debug.log" "$REPO_ROOT/ui-debug.log" "$REPO_ROOT/firebase-debug.log"
}
trap cleanup EXIT

echo "→ Levantando emuladores Firebase (Auth:$AUTH_PORT Firestore:$FIRESTORE_PORT)..."
npx --yes firebase-tools emulators:start --project demo-farmazed > /tmp/perm-emulators.log 2>&1 &
PIDS+=($!)

for i in $(seq 1 60); do
  grep -q "All emulators ready" /tmp/perm-emulators.log 2>/dev/null && break
  sleep 1
done
if ! grep -q "All emulators ready" /tmp/perm-emulators.log 2>/dev/null; then
  echo "❌ Los emuladores no arrancaron. Log:"; cat /tmp/perm-emulators.log; exit 1
fi
echo "  emuladores listos."

echo "→ Sembrando cuentas LEGACY (admin/cliente sin role — para probar la migracion)..."
(cd tracker && \
  FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT \
  FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT \
  FIREBASE_PROJECT_ID=demo-farmazed \
  node scripts/seed_emulador.js) > /tmp/perm-seed-legacy.log 2>&1
if [ $? -ne 0 ]; then echo "❌ Seed legacy fallo. Log:"; cat /tmp/perm-seed-legacy.log; exit 1; fi

echo "→ Sembrando roles (2 empresas + 1 usuario por rol)..."
(cd tracker && \
  FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT \
  FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT \
  FIREBASE_PROJECT_ID=demo-farmazed \
  node scripts/seed_roles.js) > /tmp/perm-seed.log 2>&1
if [ $? -ne 0 ]; then echo "❌ Seed de roles fallo. Log:"; cat /tmp/perm-seed.log; exit 1; fi
echo "  seed OK."

MCP_KEY_LOCAL=dev-mcp-local

# TAREA 28: esta máquina es compartida (otros procesos, de otros usuarios,
# pueden tomar un puerto justo entre que find_free_port lo revisa y node
# alcanza a escuchar — visto repetidas veces con un proceso ajeno fijo en
# :8080, "EADDRINUSE" en el log del tracker). No es un bug de
# find_free_port (funciona bien aislado) sino una carrera real contra algo
# externo — se reintenta con un puerto NUEVO (no el mismo con más timeout)
# hasta 3 veces antes de rendirse.
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
    MCP_KEY=$MCP_KEY_LOCAL \
    PORT=$TRACKER_PORT \
    PRICING_TABLE=24sep \
    node index.js) > /tmp/perm-tracker.log 2>&1 &
  TRACKER_PID=$!
  PIDS+=($TRACKER_PID)

  for i in $(seq 1 30); do
    curl -s -o /dev/null "http://localhost:$TRACKER_PORT/health" && { TRACKER_OK=1; break; }
    kill -0 "$TRACKER_PID" 2>/dev/null || break # el proceso murió (p.ej. EADDRINUSE) — no sigas esperando, reintenta ya
    sleep 1
  done
  [ -n "$TRACKER_OK" ] && break
  echo "  intento $intento falló (puerto $TRACKER_PORT) — reintentando con otro puerto..."
  TRACKER_PORT=$((TRACKER_PORT + 1))
done
if [ -z "$TRACKER_OK" ]; then
  echo "❌ El tracker no arrancó tras 3 intentos. Log:"; cat /tmp/perm-tracker.log; exit 1
fi
echo "  tracker OK."

echo "→ Corriendo la matriz de permisos (node --test)..."
FZ_API_PORT=$TRACKER_PORT FZ_AUTH_PORT=$AUTH_PORT FZ_FIRESTORE_PORT=$FIRESTORE_PORT \
  node --test tracker/tests/permissions.test.js
EXIT_CODE=$?

echo "→ Corriendo el conteo de páginas del paquete IEA (R13, TAREA 19)..."
FZ_API_PORT=$TRACKER_PORT FZ_AUTH_PORT=$AUTH_PORT \
  node --test tracker/tests/paquete_iea.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo los gates de transición — REST y MCP en paridad (TAREA 22)..."
FZ_API_PORT=$TRACKER_PORT FZ_AUTH_PORT=$AUTH_PORT FZ_MCP_KEY=$MCP_KEY_LOCAL \
  node --test tracker/tests/transition_gates.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo el gate de pago por CONCEPTO — REST y MCP (TAREA 23)..."
FZ_API_PORT=$TRACKER_PORT FZ_AUTH_PORT=$AUTH_PORT FZ_MCP_KEY=$MCP_KEY_LOCAL \
  node --test tracker/tests/payment_concepts.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo el checklist ajustado a las matrices SQ/BIO (TAREA 25, prueba unitaria pura)..."
node --test tracker/tests/checklist_tarea25.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo esInnovador en el checklist de SQ (TAREA 26, prueba unitaria pura)..."
node --test tracker/tests/checklist_tarea26.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo formularios F1/F2/F3/F10 (TAREA 28, prueba unitaria pura)..."
node --test tracker/tests/formularios_tarea28.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo Vacuna=Biológicos en el checklist (TAREA 28, prueba unitaria pura)..."
node --test tracker/tests/checklist_tarea28.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo resolverCategoriaPrecio (Vacuna/Regular-generico/Abreviado-sin-precio, TAREA 28, prueba unitaria pura)..."
PRICING_TABLE=24sep node --test tracker/tests/precios_tarea28.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

echo "→ Corriendo la migración de roles sobre las cuentas legacy..."
(cd tracker && \
  FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT \
  FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT \
  FIREBASE_PROJECT_ID=demo-farmazed \
  node scripts/migrate_roles.js) > /tmp/perm-migrate.log 2>&1
MIGRATE_EXIT=$?
cat /tmp/perm-migrate.log
if [ $MIGRATE_EXIT -ne 0 ]; then EXIT_CODE=$MIGRATE_EXIT; fi

echo "→ Verificando el resultado de la migración..."
FZ_API_PORT=$TRACKER_PORT FZ_AUTH_PORT=$AUTH_PORT FZ_FIRESTORE_PORT=$FIRESTORE_PORT \
  node --test tracker/tests/migration.test.js
if [ $? -ne 0 ]; then EXIT_CODE=1; fi

exit $EXIT_CODE

#!/usr/bin/env bash
# tracker/scripts/entorno_aislado.sh — TAREA 42. Entorno de pruebas ISLADO, para `source`
# desde run_permission_tests.sh y e2e/run.sh (cwd = raíz del repo).
#
# Emuladores en puertos de prueba (firebase.test-ports.json: Auth 9198, Firestore 8190,
# Storage 9298) y tracker/estático en el primer puerto libre desde 8070/8093 — así corre
# AL LADO de la demo (tmux farmazed-demo: 9099/8090/9199/8092/8081) sin tocarla.
# Al salir mata SOLO lo que arrancó (el grupo de procesos de los emuladores), nunca por
# patrón de nombre: el `pkill -f firebase-tools` viejo se llevaba también la demo.
#
# SOLO CONTRA EL EMULADOR — nunca toca producción.

export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-21.0.12.1+1-jre}"
export PATH="$JAVA_HOME/bin:$PATH"

AUTH_PORT=9198
FIRESTORE_PORT=8190
STORAGE_PORT=9298
MCP_KEY_LOCAL=dev-mcp-local
FZ_LOGS="$(mktemp -d /tmp/fz-aislado.XXXXXX)"
FZ_PIDS=()
FZ_EMU_PGID=""
FZ_ROOT="$(pwd)"

fz_find_free_port() {
  local port=$1
  while ss -ltn 2>/dev/null | grep -q ":$port "; do port=$((port + 1)); done
  echo "$port"
}

fz_cleanup() {
  echo "→ Deteniendo servicios de prueba..."
  for pid in "${FZ_PIDS[@]:-}"; do kill "$pid" >/dev/null 2>&1 || true; done
  if [ -n "$FZ_EMU_PGID" ]; then
    kill -TERM -- "-$FZ_EMU_PGID" >/dev/null 2>&1 || true
    # Esperar a que los emuladores suelten sus puertos: la corrida siguiente los necesita ya.
    for _ in $(seq 1 30); do
      ss -ltn 2>/dev/null | grep -qE ":($AUTH_PORT|$FIRESTORE_PORT|$STORAGE_PORT) " || break
      sleep 1
    done
  fi
  rm -f "$FZ_ROOT"/firestore-debug.log "$FZ_ROOT"/ui-debug.log "$FZ_ROOT"/firebase-debug.log
}

# Variables de entorno que usan seeds, tracker y pruebas (mismo conjunto para todos).
fz_env() {
  echo "FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT" \
       "STORAGE_EMULATOR_HOST=http://localhost:$STORAGE_PORT FIREBASE_PROJECT_ID=demo-farmazed GCS_BUCKET=demo-farmazed.appspot.com"
}

fz_start_emulators() {
  for p in $AUTH_PORT $FIRESTORE_PORT $STORAGE_PORT; do
    if ss -ltn 2>/dev/null | grep -q ":$p "; then
      echo "❌ El puerto de prueba $p ya está ocupado (¿otra corrida de pruebas viva?). No se mata nada; libéralo y reintenta."
      return 1
    fi
  done
  echo "→ Levantando emuladores aislados (Auth:$AUTH_PORT Firestore:$FIRESTORE_PORT Storage:$STORAGE_PORT)..."
  setsid npx --yes firebase-tools --config firebase.test-ports.json emulators:start --project demo-farmazed > "$FZ_LOGS/emuladores.log" 2>&1 &
  FZ_EMU_PGID=$!
  for _ in $(seq 1 240); do grep -q "All emulators ready" "$FZ_LOGS/emuladores.log" 2>/dev/null && break; sleep 1; done
  if ! grep -q "All emulators ready" "$FZ_LOGS/emuladores.log" 2>/dev/null; then
    echo "❌ Los emuladores no arrancaron. Log:"; cat "$FZ_LOGS/emuladores.log"; return 1
  fi
  echo "  emuladores listos."
}

# fz_seed [--sin-migrar]: cuentas legacy + roles (+ migración de las legacy, salvo que la
# suite de permisos quiera probarla después).
fz_seed() {
  local envs; envs="$(fz_env)"
  echo "→ Sembrando datos (legacy, roles${1:+, sin migrar})..."
  (cd tracker && env $envs node scripts/seed_emulador.js && env $envs node scripts/seed_roles.js) > "$FZ_LOGS/seed.log" 2>&1 \
    || { echo "❌ Seed falló. Log:"; cat "$FZ_LOGS/seed.log"; return 1; }
  if [ "${1:-}" != "--sin-migrar" ]; then
    (cd tracker && env $envs node scripts/migrate_roles.js) > "$FZ_LOGS/migrate.log" 2>&1 \
      || { echo "❌ migrate_roles falló. Log:"; cat "$FZ_LOGS/migrate.log"; return 1; }
  fi
}

# Deja el puerto del tracker en TRACKER_PORT. Reintenta con otro puerto si otro proceso lo
# toma entre la búsqueda y el arranque (carrera real en esta máquina compartida).
fz_start_tracker() {
  local envs; envs="$(fz_env)"
  TRACKER_PORT=$(fz_find_free_port 8070)
  for intento in 1 2 3; do
    TRACKER_PORT=$(fz_find_free_port "$TRACKER_PORT")
    echo "→ Levantando tracker en :$TRACKER_PORT (intento $intento)..."
    (cd tracker && env $envs ADMIN_KEY=dev-admin-local MCP_KEY=$MCP_KEY_LOCAL PORT=$TRACKER_PORT PRICING_TABLE=24sep node index.js) > "$FZ_LOGS/tracker.log" 2>&1 &
    local pid=$!; FZ_PIDS+=($pid)
    for _ in $(seq 1 30); do
      curl -s -o /dev/null "http://localhost:$TRACKER_PORT/health" && { echo "  tracker OK."; return 0; }
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    TRACKER_PORT=$((TRACKER_PORT + 1))
  done
  echo "❌ El tracker no arrancó tras 3 intentos. Log:"; cat "$FZ_LOGS/tracker.log"; return 1
}

# Deja el puerto del frontend en STATIC_PORT.
fz_start_static() {
  STATIC_PORT=$(fz_find_free_port 8093)
  python3 -m http.server "$STATIC_PORT" --directory farmazed-web > "$FZ_LOGS/static.log" 2>&1 &
  FZ_PIDS+=($!)
  for _ in $(seq 1 15); do curl -s -o /dev/null "http://localhost:$STATIC_PORT/login.html" && return 0; sleep 1; done
  echo "❌ El frontend estático no arrancó. Log:"; cat "$FZ_LOGS/static.log"; return 1
}

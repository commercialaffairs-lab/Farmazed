#!/usr/bin/env bash
# demo_local.sh — TAREA 30. Levanta TODO (emuladores + seed completo + tracker
# + frontend) y lo deja corriendo hasta Ctrl-C, para que Rick pruebe a mano
# (no es un runner de pruebas que se apaga solo al terminar, como e2e/run.sh).
#
# SOLO CONTRA EL EMULADOR — nunca toca producción.
#
# Uso:
#   ./demo_local.sh
#   (pensado para correr dentro de una sesión tmux que quede viva: ver
#   DEV_LOCAL.md, sección "Demo a mano para Rick")

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"   # raíz del repo
REPO_ROOT="$(pwd)"

export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-21.0.12.1+1-jre}"
export PATH="$JAVA_HOME/bin:$PATH"

FIRESTORE_PORT=8090
AUTH_PORT=9099   # fijo: portal/js/auth.js apunta a localhost:9099 a mano, no es configurable por puerto.
STORAGE_PORT=9199
STATIC_PORT=8092 # fijo: es el único origen que el tracker tiene en su allowlist de CORS.
UI_PORT=4040

find_free_port() {
  local port=$1
  while ss -ltn 2>/dev/null | grep -q ":$port "; do
    port=$((port + 1))
  done
  echo "$port"
}

if ss -ltn 2>/dev/null | grep -q ":$AUTH_PORT "; then
  echo "❌ El puerto $AUTH_PORT (Auth emulator) ya está ocupado en esta máquina."
  echo "   auth.js lo tiene fijo (connectAuthEmulator('http://localhost:$AUTH_PORT')) —"
  echo "   no se puede mover sin editar ese archivo. Libera el puerto y reintenta."
  exit 1
fi
if ss -ltn 2>/dev/null | grep -q ":$STATIC_PORT "; then
  echo "❌ El puerto $STATIC_PORT (frontend estático) ya está ocupado."
  echo "   Es el único origen permitido por CORS en tracker/index.js — no se puede"
  echo "   cambiar sin editar ese archivo. Libera el puerto y reintenta."
  exit 1
fi

TRACKER_PORT=$(find_free_port "${FZ_TRACKER_PORT:-8080}") # FZ_TRACKER_PORT: puerto inicial (demo_docker.sh lo fija al que publica)

PIDS=()
cleanup() {
  echo ""
  echo "→ Apagando la demo..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  pkill -f "firebase-tools emulators:start" >/dev/null 2>&1 || true
  pkill -f "cloud-firestore-emulator" >/dev/null 2>&1 || true
  pkill -f "cloud-storage-rules-runtime" >/dev/null 2>&1 || true
  rm -f "$REPO_ROOT/firestore-debug.log" "$REPO_ROOT/ui-debug.log" "$REPO_ROOT/firebase-debug.log"
  rm -f "$REPO_ROOT/farmazed-web/demo.html"
  echo "  listo."
}
trap cleanup EXIT

echo "→ Levantando emuladores Firebase (Auth:$AUTH_PORT Firestore:$FIRESTORE_PORT Storage:$STORAGE_PORT)..."
npx --yes firebase-tools emulators:start --project demo-farmazed > /tmp/demo-local-emulators.log 2>&1 &
PIDS+=($!)

for i in $(seq 1 60); do
  grep -q "All emulators ready" /tmp/demo-local-emulators.log 2>/dev/null && break
  sleep 1
done
if ! grep -q "All emulators ready" /tmp/demo-local-emulators.log 2>/dev/null; then
  echo "❌ Los emuladores no arrancaron. Log:"; cat /tmp/demo-local-emulators.log; exit 1
fi
echo "  emuladores listos."

SEED_ENV=(
  env
  FIRESTORE_EMULATOR_HOST=localhost:$FIRESTORE_PORT
  FIREBASE_AUTH_EMULATOR_HOST=localhost:$AUTH_PORT
  STORAGE_EMULATOR_HOST=http://localhost:$STORAGE_PORT
  FIREBASE_PROJECT_ID=demo-farmazed
  GCS_BUCKET=demo-farmazed.appspot.com
)

echo "→ Sembrando datos legacy (admin@/cliente@ + 3 casos + precios, seed_emulador.js)..."
(cd tracker && "${SEED_ENV[@]}" node scripts/seed_emulador.js) > /tmp/demo-local-seed-emulador.log 2>&1
if [ $? -ne 0 ]; then echo "❌ seed_emulador.js falló. Log:"; cat /tmp/demo-local-seed-emulador.log; exit 1; fi

echo "→ Sembrando roles (2 empresas + 1 usuario por rol + casos de TAREA 15-28, seed_roles.js)..."
(cd tracker && "${SEED_ENV[@]}" node scripts/seed_roles.js) > /tmp/demo-local-seed-roles.log 2>&1
if [ $? -ne 0 ]; then echo "❌ seed_roles.js falló. Log:"; cat /tmp/demo-local-seed-roles.log; exit 1; fi

# TAREA 39: una cuenta sin `role` ya no es cliente_titular por defecto (403) —
# cliente@farmazed.test (seed_emulador) nace legacy y se migra como las reales.
echo "→ Migrando roles de las cuentas legacy (admin@/cliente@, migrate_roles.js)..."
(cd tracker && "${SEED_ENV[@]}" node scripts/migrate_roles.js) > /tmp/demo-local-migrate.log 2>&1
if [ $? -ne 0 ]; then echo "❌ migrate_roles.js falló. Log:"; cat /tmp/demo-local-migrate.log; exit 1; fi

echo "→ Sembrando tarifario del 24-sep (seed_pricing_24sep.js — seed_emulador.js ya lo"
echo "  llama internamente; se repite explícito por la instrucción de esta tarea, es"
echo "  idempotente, no duplica nada)..."
(cd tracker && "${SEED_ENV[@]}" node scripts/seed_pricing_24sep.js) > /tmp/demo-local-seed-precios.log 2>&1
if [ $? -ne 0 ]; then echo "❌ seed_pricing_24sep.js falló. Log:"; cat /tmp/demo-local-seed-precios.log; exit 1; fi
echo "  seed OK."

# PayPal sandbox (opcional): SOLO las líneas PAYMENTS_PROVIDER / PAYPAL_* de tracker/.env (ignorado
# por git). Sin ese archivo, o sin PAYMENTS_PROVIDER=paypal, la demo sigue con el proveedor de prueba.
PAYPAL_VARS=()
if [ -f tracker/.env ]; then
  while IFS= read -r linea; do PAYPAL_VARS+=("$linea"); done \
    < <(grep -E '^(PAYMENTS_PROVIDER|PAYPAL_[A-Z_]+)=' tracker/.env | sed -e 's/[[:space:]]*#.*$//' -e 's/\r$//')
fi
if printf '%s\n' "${PAYPAL_VARS[@]:-}" | grep -q '^PAYMENTS_PROVIDER=paypal$'; then
  echo "→ Pagos: PayPal REAL ($(printf '%s\n' "${PAYPAL_VARS[@]}" | grep '^PAYPAL_ENV=' || echo 'PAYPAL_ENV sin definir')), credenciales de tracker/.env."
else
  echo "→ Pagos: proveedor de prueba (mock). Para PayPal sandbox ver PAYPAL_SETUP.md."
fi

TRACKER_OK=""
for intento in 1 2 3; do
  TRACKER_PORT=$(find_free_port "$TRACKER_PORT")
  echo "→ Levantando tracker en :$TRACKER_PORT (PRICING_TABLE=24sep, intento $intento)..."
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
    env "${PAYPAL_VARS[@]:-FZ_SIN_PAYPAL=1}" node index.js) > /tmp/demo-local-tracker.log 2>&1 &
  TRACKER_PID=$!
  PIDS+=($TRACKER_PID)

  for i in $(seq 1 30); do
    curl -s -o /dev/null "http://localhost:$TRACKER_PORT/health" && { TRACKER_OK=1; break; }
    kill -0 "$TRACKER_PID" 2>/dev/null || break
    sleep 1
  done
  [ -n "$TRACKER_OK" ] && break
  echo "  intento $intento falló (puerto $TRACKER_PORT) — reintentando con otro puerto..."
  TRACKER_PORT=$((TRACKER_PORT + 1))
done
if [ -z "$TRACKER_OK" ]; then
  echo "❌ El tracker no arrancó tras 3 intentos. Log:"; cat /tmp/demo-local-tracker.log; exit 1
fi
echo "  tracker OK en :$TRACKER_PORT."

# Página de entrada única: fija fzApiPort en localStorage (mismo mecanismo que
# usa e2e/, ver portal/js/config.js) y redirige a login.html — así Rick entra
# con 1 sola URL sin importar en qué puerto quedó el tracker. Se regenera cada
# corrida (no se commitea — cleanup() la borra al salir).
cat > "$REPO_ROOT/farmazed-web/demo.html" <<HTML
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Entrando…</title></head>
<body>
<p>Entrando a la demo…</p>
<script>
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    try { localStorage.setItem('fzApiPort', '$TRACKER_PORT'); } catch (e) { /* noop */ }
  }
  location.replace('/login.html');
</script>
</body></html>
HTML

echo "→ Sirviendo frontend en :$STATIC_PORT..."
python3 -m http.server "$STATIC_PORT" --directory farmazed-web > /tmp/demo-local-static.log 2>&1 &
PIDS+=($!)
for i in $(seq 1 15); do
  curl -s -o /dev/null "http://localhost:$STATIC_PORT/login.html" && break
  sleep 1
done
if ! curl -s -o /dev/null "http://localhost:$STATIC_PORT/login.html"; then
  echo "❌ El frontend estático no arrancó. Log:"; cat /tmp/demo-local-static.log; exit 1
fi
echo "  frontend OK."

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Demo Farmazed levantada — queda corriendo hasta Ctrl-C"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Entrar (1 sola URL — fija el puerto de la API sola, sin tocar nada):"
echo "  http://localhost:$STATIC_PORT/demo.html"
echo ""
echo "Después de iniciar sesión, login.html redirige solo según el rol:"
echo "  Admin                -> admin/casos.html"
echo "  Staff (analista/abogado/regente) -> admin/bandeja.html"
echo "  Cliente (titular/miembro)        -> client-dashboard.html"
echo "(dashboard.html NO es un destino de login — es la especificación de diseño"
echo " del v2, ver CLAUDE.md, no está conectada a los flujos reales.)"
echo ""
echo "Puertos a tunelear desde Argus (ssh -L, los 4 — Firestore :$FIRESTORE_PORT no"
echo "hace falta, solo lo usa el tracker de este lado; Storage :$STORAGE_PORT SÍ,"
echo "los links de descarga de documentos apuntan directo al emulador de Storage):"
echo "  ssh -L $STATIC_PORT:localhost:$STATIC_PORT -L $AUTH_PORT:localhost:$AUTH_PORT -L $TRACKER_PORT:localhost:$TRACKER_PORT -L $STORAGE_PORT:localhost:$STORAGE_PORT <usuario>@<ip-de-Patch>"
echo ""
echo "Usuarios de prueba (clave para TODOS: Farmazed123! — solo emulador, no es"
echo "un secreto real):"
echo "  admin@farmazed.test          admin (legacy, seed_emulador — 3 casos propios)"
echo "  cliente@farmazed.test        cliente (legacy, seed_emulador — mismos 3 casos)"
echo "  admin-e3@farmazed.test       admin (seed_roles)"
echo "  analista@farmazed.test       analista (seed_roles)"
echo "  abogado@farmazed.test        abogado (seed_roles)"
echo "  regente@farmazed.test        regente (seed_roles)"
echo "  titular-alfa@farmazed.test   cliente_titular, Org Alfa (la mayoría de los"
echo "                                casos de prueba de TAREA 9-28 viven aquí)"
echo "  miembro-alfa@farmazed.test   cliente_miembro, misma empresa que titular-alfa"
echo "  titular-beta@farmazed.test   cliente_titular, Org Beta (casos de"
echo "                                representación/Vacuna/prioridad innovadores,"
echo "                                TAREA 28)"
echo ""
echo "Tarifario activo: 24-sep (PRICING_TABLE=24sep) — ver organizacion/10_DIFF_PRECIOS_24SEP.md."
echo "Logs: /tmp/demo-local-*.log"
echo ""
echo "Ctrl-C para apagar todo (emuladores + tracker + frontend)."
echo ""

wait

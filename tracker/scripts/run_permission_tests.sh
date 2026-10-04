#!/usr/bin/env bash
# tracker/scripts/run_permission_tests.sh — suite BACKEND completa (node --test).
#
# Levanta un entorno aislado (tracker/scripts/entorno_aislado.sh: emuladores en puertos de
# prueba, no toca la demo), siembra legacy + roles, corre TODAS las suites de
# tracker/tests/*.test.js y al final migra las cuentas legacy y verifica la migración.
# Una suite nueva se engancha sola: basta crear tracker/tests/<nombre>.test.js.
#
# Todas las suites reciben el mismo entorno (FZ_*, emuladores, MCP, tarifario 24-sep) y
# cada una crea sus propios casos/empresas — no comparten estado con otra suite.
#
# SOLO CONTRA EL EMULADOR — nunca toca producción.
# Uso: ./tracker/scripts/run_permission_tests.sh [suite ...]   (sin args = todas; el
#      nombre sin .test.js, p. ej. "pagos_paypal xss")

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # raiz del repo
source tracker/scripts/entorno_aislado.sh
trap fz_cleanup EXIT

fz_start_emulators || exit 1
fz_seed --sin-migrar || exit 1
fz_start_tracker || exit 1

export FZ_API_PORT=$TRACKER_PORT FZ_AUTH_PORT=$AUTH_PORT FZ_FIRESTORE_PORT=$FIRESTORE_PORT FZ_MCP_KEY=$MCP_KEY_LOCAL
export STORAGE_EMULATOR_HOST=http://localhost:$STORAGE_PORT GCS_BUCKET=demo-farmazed.appspot.com PRICING_TABLE=24sep

if [ $# -gt 0 ]; then
  SUITES=("$@")
else
  # permissions primero (matriz base); migration va al final, después de migrar.
  SUITES=(permissions)
  for f in tracker/tests/*.test.js; do
    n=$(basename "$f" .test.js)
    [ "$n" = permissions ] || [ "$n" = migration ] || SUITES+=("$n")
  done
fi

EXIT_CODE=0
RESUMEN=()
correr() {
  local n=$1 log="$FZ_LOGS/$1.log"
  node --test "tracker/tests/$n.test.js" > "$log" 2>&1
  local rc=$? pass fail
  pass=$(grep -E '^# pass' "$log" | awk '{print $3}'); fail=$(grep -E '^# fail' "$log" | awk '{print $3}')
  RESUMEN+=("$(printf '%-24s exit=%s pass=%s fail=%s' "$n" "$rc" "${pass:-?}" "${fail:-?}")")
  if [ $rc -eq 0 ] && { [ -z "$pass" ] || [ "$pass" -eq 0 ]; }; then rc=1; echo "❌ $n — corrió 0 pruebas"; EXIT_CODE=1; fi
  if [ $rc -ne 0 ]; then EXIT_CODE=1; echo "❌ $n — fallos (log: $log):"; grep -E "^\s*(not ok|# Subtest)|failureType|error:" "$log" | head -30; fi
}

echo "→ Corriendo ${#SUITES[@]} suites..."
for n in "${SUITES[@]}"; do correr "$n"; done

if [ $# -eq 0 ]; then
  echo "→ Migrando las cuentas legacy (migrate_roles.js) y verificando el resultado..."
  (cd tracker && env $(fz_env) node scripts/migrate_roles.js) > "$FZ_LOGS/migrate.log" 2>&1 \
    || { EXIT_CODE=1; echo "❌ migrate_roles falló:"; cat "$FZ_LOGS/migrate.log"; }
  correr migration
fi

echo ""; echo "── Resumen backend ──"; printf '%s\n' "${RESUMEN[@]}"
[ $EXIT_CODE -eq 0 ] && echo "✅ Backend completo en verde." || echo "❌ Backend con fallos."
exit $EXIT_CODE

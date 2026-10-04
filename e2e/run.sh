#!/usr/bin/env bash
# e2e/run.sh — levanta emuladores + tracker + frontend estático, siembra datos,
# corre los specs de Playwright, y apaga todo al salir (pase o falle el test).
#
# SOLO CONTRA EL EMULADOR. Reutilizable para futuros specs (D16) — agregar el
# archivo en e2e/*.spec.js y correr este mismo script.
#
# TAREA 42: corre en un entorno AISLADO (tracker/scripts/entorno_aislado.sh): emuladores en
# los puertos de prueba (Auth 9198, Firestore 8190, Storage 9298) y tracker/estático en el
# primer puerto libre desde 8070/8093. Por eso puede correr con la demo viva (tmux
# farmazed-demo, 9099/8092/8081…) y NO la toca: al salir solo detiene lo que arrancó.
# Los puertos llegan al navegador por localStorage (fzApiPort/fzAuthPort, ver
# playwright.config.js) — nunca se edita config.js.
#
# Uso:
#   ./e2e/run.sh                         # corre todos los specs
#   ./e2e/run.sh estados.spec.js         # corre uno solo
#   ./e2e/run.sh --repeat-each=3 ...     # cualquier argumento de `playwright test`
#
# Requiere (ver DEV_LOCAL.md): JDK 21+ para los emuladores (ya instalado en
# ~/.local/jdk-21.0.12.1+1-jre), Chromium de Playwright ya cacheado en
# ~/.cache/ms-playwright (no descarga nada).

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."   # raiz del repo
source tracker/scripts/entorno_aislado.sh
trap fz_cleanup EXIT

fz_start_emulators || exit 1
fz_seed || exit 1        # legacy + roles + migración de las cuentas legacy (admin@/cliente@)
fz_start_tracker || exit 1
fz_start_static || exit 1
echo "  tracker :$TRACKER_PORT, frontend :$STATIC_PORT, logs en $FZ_LOGS"

echo "→ Corriendo Playwright..."
cd e2e
FZ_STATIC_PORT=$STATIC_PORT FZ_AUTH_PORT=$AUTH_PORT FZ_FIRESTORE_PORT=$FIRESTORE_PORT FZ_API_PORT=$TRACKER_PORT \
  STORAGE_EMULATOR_HOST=http://localhost:$STORAGE_PORT GCS_BUCKET=demo-farmazed.appspot.com FZ_MCP_KEY=$MCP_KEY_LOCAL \
  npx playwright test "$@"
exit $?

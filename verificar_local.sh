#!/usr/bin/env bash
# verificar_local.sh — TAREA 16(c): "revisar todo en local con 1 comando".
#
# Corre, en orden, las dos suites de prueba de este repo (cada una levanta y
# apaga sus propios emuladores — no hace falta nada corriendo de antes):
#   1. e2e/run.sh                       — Playwright real en un Chromium
#      cacheado: wizard, las 14 fases, pagos, versionado de documentos,
#      precios, y los 6 roles de E3 (capturas en sessions/2026-09-29/).
#   2. tracker/scripts/run_permission_tests.sh — matriz de permisos endpoint
#      × rol (node --test nativo) + la migración de roles sobre cuentas
#      legacy.
#
# SOLO CONTRA EL EMULADOR — nunca toca producción. Requiere lo mismo que ya
# pedía cada script por separado (ver DEV_LOCAL.md): JDK 21+, Chromium de
# Playwright ya cacheado.
#
# Uso: ./verificar_local.sh

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "══════════════════════════════════════════════════════════"
echo "1/2 — Suite Playwright (UI, los 6 roles, flujo completo)"
echo "══════════════════════════════════════════════════════════"
./e2e/run.sh
E2E_EXIT=$?

echo ""
echo "══════════════════════════════════════════════════════════"
echo "2/2 — Matriz de permisos + migración de roles (node --test)"
echo "══════════════════════════════════════════════════════════"
./tracker/scripts/run_permission_tests.sh
PERM_EXIT=$?

echo ""
echo "══════════════════════════════════════════════════════════"
if [ $E2E_EXIT -eq 0 ] && [ $PERM_EXIT -eq 0 ]; then
  echo "✅ Todo en verde — Playwright OK, permisos/migración OK."
else
  echo "❌ Algo falló — Playwright exit=$E2E_EXIT, permisos exit=$PERM_EXIT."
fi
echo "══════════════════════════════════════════════════════════"

[ $E2E_EXIT -eq 0 ] && [ $PERM_EXIT -eq 0 ]

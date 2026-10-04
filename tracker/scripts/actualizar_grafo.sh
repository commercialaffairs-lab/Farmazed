#!/usr/bin/env bash
# actualizar_grafo.sh — TAREA 41b (PM_COMMENTS §H.16). Regenera el mapa interactivo
# del código que muestra admin/configuracion.html y lo deja en
# tracker/assets/code-graph.html (ese archivo SÍ se versiona; graphify-out/ no).
#
# Alcance (el mismo del grafo original): tracker/, e2e/, farmazed-web/portal/js/ y
# farmazed-web/js/ — SIN las plantillas src/approx ni src/wecare. Solo AST (graphify
# `extract --code-only`): no usa LLM ni API keys. Las comunidades quedan con el nombre
# con nombre propio (tracker/scripts/nombrar_comunidades.py, sin LLM).
#
# Requiere `graphify` en el PATH (pipx install graphifyy) y rsync.
# Uso: ./tracker/scripts/actualizar_grafo.sh
# Cuándo correrlo: ver DEV_LOCAL.md ("Mapa del código").

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."   # raíz del repo
DESTINO="tracker/assets/code-graph.html"

command -v graphify >/dev/null || { echo "❌ graphify no está instalado (pipx install graphifyy)." >&2; exit 1; }
command -v rsync    >/dev/null || { echo "❌ rsync no está instalado." >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Copiando el alcance a un directorio temporal..."
mkdir -p "$TMP/src/farmazed-web/portal"
rsync -a --exclude node_modules --exclude test-results --exclude assets tracker/ "$TMP/src/tracker/"
rsync -a --exclude node_modules --exclude test-results e2e/ "$TMP/src/e2e/"
rsync -a farmazed-web/portal/js/ "$TMP/src/farmazed-web/portal/js/"
[ -d farmazed-web/js ] && rsync -a farmazed-web/js/ "$TMP/src/farmazed-web/js/"

echo "→ Extrayendo (AST, sin LLM)..."
graphify extract "$TMP/src" --code-only --no-gitignore --out "$TMP/out" >/dev/null
graphify cluster-only "$TMP/out" --no-label >/dev/null

# Nombres reales de las comunidades, deterministas y sin LLM (archivos principales + símbolo más conectado).
python3 tracker/scripts/nombrar_comunidades.py "$TMP/out/graphify-out/graph.json" > "$TMP/etiquetas.json"
graphify export html --graph "$TMP/out/graphify-out/graph.json" --labels "$TMP/etiquetas.json" >/dev/null

# vis-network VENDORIZADO: el HTML no carga nada de internet (se sirve a un iframe con CSP sin hosts
# externos). El script de unpkg se reemplaza por el mismo archivo, versionado en tracker/assets/vendor/.
python3 - "$TMP/out/graphify-out/graph.html" "$DESTINO" <<'PY'
import re, sys
html = open(sys.argv[1], encoding='utf-8').read()
vis = open('tracker/assets/vendor/vis-network-9.1.6.min.js', encoding='utf-8').read()
html, n = re.subn(r'<script src="https://unpkg\.com/vis-network[^>]*></script>', lambda m: '<script>' + vis.replace('</script', '<\\/script') + '</script>', html, count=1)
if n != 1 or 'unpkg.com' in html:
    sys.exit('❌ no se pudo vendorizar vis-network (cambió el HTML de graphify?)')
import os
os.makedirs(os.path.dirname(sys.argv[2]), exist_ok=True)
open(sys.argv[2], 'w', encoding='utf-8').write(html)
PY
echo "✅ $DESTINO ($(du -h "$DESTINO" | cut -f1)) — generado $(date -u +%Y-%m-%dT%H:%M:%SZ)"

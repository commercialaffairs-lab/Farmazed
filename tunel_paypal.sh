#!/usr/bin/env bash
# tunel_paypal.sh — Túnel público (Cloudflare "quick tunnel", sin cuenta) hacia el tracker de la
# demo, para que PayPal pueda llegar al webhook. Imprime la URL que hay que registrar en
# developer.paypal.com → Webhooks. Queda corriendo hasta Ctrl-C.
#
#   ./tunel_paypal.sh            # túnel al tracker de demo_docker.sh (puerto 8081)
#   ./tunel_paypal.sh 8080       # otro puerto (p. ej. la demo de Patch)
#
# La URL cambia en cada arranque (quick tunnel): hay que actualizar la URL del webhook en PayPal
# cada vez que se relanza. Para una URL fija haría falta un túnel con nombre (cuenta de Cloudflare).
# Descarga cloudflared (binario oficial) en .tools/, ignorado por git. No instala nada en el sistema.

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
PUERTO="${1:-8081}"
mkdir -p .tools
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) BIN=.tools/cloudflared.exe; ARCH=windows-amd64.exe ;;
  Darwin) BIN=.tools/cloudflared; ARCH=darwin-amd64.tgz ;;
  *) BIN=.tools/cloudflared; ARCH=linux-amd64 ;;
esac
if [ ! -x "$BIN" ]; then
  echo "→ Descargando cloudflared ($ARCH)..."
  if [ "$ARCH" = darwin-amd64.tgz ]; then
    curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-$ARCH" | tar -xz -C .tools
  else
    curl -sL -o "$BIN" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-$ARCH"
  fi
  chmod +x "$BIN"
fi

if ! curl -s -o /dev/null "http://localhost:$PUERTO/health"; then
  echo "❌ Nada responde en http://localhost:$PUERTO/health — levanta la demo primero (./demo_docker.sh)."; exit 1
fi

LOG="$(mktemp)"
"$BIN" tunnel --url "http://localhost:$PUERTO" --no-autoupdate > "$LOG" 2>&1 &
PID=$!
trap 'kill $PID >/dev/null 2>&1; rm -f "$LOG"' EXIT
for _ in $(seq 1 30); do
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG" | head -1)
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "${URL:-}" ]; then echo "❌ El túnel no arrancó:"; cat "$LOG"; exit 1; fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Túnel activo (Ctrl-C para cerrarlo)"
echo "   Webhook para PayPal:  $URL/api/webhooks/paypal"
echo "   Comprobación:         $URL/health"
echo "════════════════════════════════════════════════════════════════"
echo "Registra esa URL en developer.paypal.com → tu app → Webhooks (eventos en PAYPAL_SETUP.md §3),"
echo "pon el Webhook ID en tracker/.env (PAYPAL_WEBHOOK_ID) y reinicia la demo."
wait $PID

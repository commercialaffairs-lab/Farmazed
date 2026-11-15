/**
 * webhooks.js — TAREA 33 (PM_COMMENTS §H.14). Webhook de PayPal. Qué hace cada
 * evento vive en services/paypal_webhook.js (decisión de Rick, 05-oct).
 *
 * Sin uso real en local: no hay URL pública a la que PayPal pueda avisar, y en
 * el emulador el adaptador `mock` nunca manda webhooks (las pruebas los simulan).
 *
 * Público (PayPal llama esto, no hay sesión de usuario) — la seguridad es
 * la verificación de firma (`verifyWebhookSignature`), no un token.
 * TAREA 65: esta ruta recibe el cuerpo CRUDO (index.js monta `express.raw` antes de `express.json`);
 * se parsea aquí y los bytes originales se pasan a la verificación, que PayPal calcula sobre ellos.
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/webhooks/paypal', webhooksRouter);
 */

const { Router } = require('express');
const { getProvider } = require('../services/payments');
const { procesarEvento, ReintentarEvento } = require('../services/paypal_webhook');

const { crearLimitador } = require('../utils/rate_limit');

const router = Router();

// Por IP y holgado (PayPal reintenta y manda ráfagas): frena un flood contra la verificación
// de firma, que llama a la API de PayPal. 300/min.
const limitador = crearLimitador({ ventanaMs: 60 * 1000, max: 300 });

router.post('/', async (req, res) => {
  if (limitador.estaLimitado(req.ip)) return res.status(429).json({ error: 'Demasiadas solicitudes.' });
  // En producción llega un Buffer (express.raw); si alguien monta la ruta con express.json ya viene parseado
  // (sin bytes originales: se verifica con el objeto, como antes).
  const cuerpoCrudo = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
  let evento;
  if (cuerpoCrudo === null) evento = req.body;
  else { try { evento = JSON.parse(cuerpoCrudo); } catch { evento = null; } }
  if (!evento || typeof evento !== 'object' || Array.isArray(evento)) {
    return res.status(400).json({ error: 'Cuerpo del webhook inválido (se espera JSON).' });
  }
  req.body = evento; // el resto del handler (y los logs) trabajan con el evento parseado
  try {
    const provider = getProvider();
    const valido = await provider.verifyWebhookSignature(req.headers, evento, cuerpoCrudo);
    if (!valido) {
      // 400, no 401/403 — no es un intento de auth, es un webhook que no se
      // pudo verificar (firma mala, o `PAYPAL_WEBHOOK_ID` sin configurar).
      return res.status(400).json({ error: 'Firma de webhook inválida o no verificable.' });
    }

    const resultado = await procesarEvento(req.body);
    console.log('Webhook de PayPal verificado:', req.body?.event_type || '(sin event_type)', '->', resultado);
    res.status(200).json({ received: true });
  } catch (e) {
    // Sin 2xx PayPal reintenta el evento más tarde (y como no quedó anotado en
    // `paypal_eventos`, el reintento lo procesa completo).
    if (e instanceof ReintentarEvento) return res.status(503).json({ error: 'Evento todavía no procesable — reintentar.' });
    console.error('[webhook paypal] no se pudo procesar', { eventId: req.body?.id, eventType: req.body?.event_type, error: e.message });
    res.status(500).json({ error: 'No se pudo procesar el evento.' });
  }
});

module.exports = router;

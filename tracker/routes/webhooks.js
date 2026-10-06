/**
 * webhooks.js — TAREA 33 (PM_COMMENTS §H.14). Webhook de PayPal. Qué hace cada
 * evento vive en services/paypal_webhook.js (decisión de Rick, 05-oct).
 *
 * Sin uso real en local: no hay URL pública a la que PayPal pueda avisar, y en
 * el emulador el adaptador `mock` nunca manda webhooks (las pruebas los simulan).
 *
 * Público (PayPal llama esto, no hay sesión de usuario) — la seguridad es
 * la verificación de firma (`verifyWebhookSignature`), no un token.
 * `getRawBody`/el parseo normal de Express alcanza: la verificación de
 * PayPal es una llamada A SU PROPIA API con el evento ya parseado, no un
 * cálculo criptográfico local sobre bytes crudos (ver services/payments/paypal.js).
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/webhooks/paypal', webhooksRouter);
 */

const { Router } = require('express');
const { getProvider } = require('../services/payments');
const { procesarEvento, ReintentarEvento } = require('../services/paypal_webhook');

const router = Router();

router.post('/', async (req, res) => {
  try {
    const provider = getProvider();
    const valido = await provider.verifyWebhookSignature(req.headers, req.body);
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

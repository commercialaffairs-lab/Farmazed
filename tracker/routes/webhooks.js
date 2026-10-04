/**
 * webhooks.js — TAREA 33 (PM_COMMENTS §H.14). Webhook de PayPal — listo,
 * pero SIN uso real en local (no hay URL pública a la que PayPal pueda
 * avisar; en el emulador, el adaptador `mock` nunca manda webhooks). Queda
 * preparado para cuando haya despliegue real con una URL pública que
 * registrar en developer.paypal.com.
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

    // Sin acción real todavía — "listo pero sin uso en local" (instrucción
    // explícita). Cuando haya despliegue real, acá es donde se actualizaría
    // el estado de una suscripción (`BILLING.SUBSCRIPTION.ACTIVATED`/
    // `.CANCELLED`) sin depender de que el cliente vuelva a visitar la
    // página — hoy esa actualización solo pasa por la consulta directa que
    // ya hace `subscription.js`.
    console.log('Webhook de PayPal verificado:', req.body?.event_type || '(sin event_type)');
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

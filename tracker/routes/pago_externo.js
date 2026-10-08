/**
 * pago_externo.js — Rapid PayPro por enlace de pago, un enlace por producto (decisión de Rick,
 * 07-oct-2026). Rapid PayPro no tiene API pública: el admin crea el cobro en su panel
 * (link.rapidpaypro.com/...), pega el enlace en la línea de la cotización, el cliente paga en la
 * página de Rapid PayPro y, cuando el panel muestra el pago, el admin lo confirma aquí: se
 * registran los mismos pagos por concepto que registra la captura de PayPal (routes/quotes.js),
 * con `origen: 'rapidpaypro'`, y el gate de fase_05 se destraba igual.
 *
 * Una cotización se cobra por UNA vía: con una línea confirmada por Rapid PayPro, PayPal queda
 * bloqueado para esa cotización (y al revés, una cotización capturada por PayPal no se confirma aquí).
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/quotes/:id/lineas/:caseId/pago-externo', pagoExternoRouter);
 */

const { Router } = require('express');
const admin       = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { textoError, trimOrNull } = require('../utils/validar_texto');
const { conceptosRequeridosFase05 } = require('../utils/conceptos_fase05');
const { createConceptPayment } = require('../services/payments_ledger');

const router = Router({ mergeParams: true });
const db     = () => admin.firestore();

const PROVEEDOR = 'rapidpaypro';
const DOMINIOS = /(^|\.)rapidpaypro\.com$/;
const ESTADOS_CON_ENLACE = ['borrador', 'enviada', 'aceptada'];

function urlValida(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && DOMINIOS.test(u.hostname); }
  catch { return false; }
}

async function cargarLinea(req, res) {
  const ref  = db().collection('quotes').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: 'Cotización no encontrada' }); return null; }
  const data = snap.data();
  const idx = data.lineas.findIndex(l => l.caseId === req.params.caseId && (l.tipo || 'principal') === 'principal');
  if (idx === -1) { res.status(404).json({ error: 'Ese caso no está en esta cotización' }); return null; }
  return { ref, data, idx };
}

// ─── PUT (admin, quotes.edit): guardar o quitar el enlace de Rapid PayPro de la línea ───
router.put('/', requireAuth, requirePermission('quotes.edit'), async (req, res) => {
  try {
    const url = trimOrNull(typeof req.body?.url === 'string' ? req.body.url : null);
    if (url && (url.length > 500 || !urlValida(url))) {
      return res.status(400).json({ error: 'El enlace debe ser https y de rapidpaypro.com (p. ej. https://link.rapidpaypro.com/...).' });
    }
    const cargada = await cargarLinea(req, res);
    if (!cargada) return;
    const { ref, data, idx } = cargada;
    if (!ESTADOS_CON_ENLACE.includes(data.estado)) {
      return res.status(400).json({ error: `No se puede cambiar el enlace de una cotización '${data.estado}'.` });
    }
    if (data.lineas[idx].pagoExterno?.estado === 'confirmado') {
      return res.status(409).json({ error: 'Ese producto ya tiene el pago confirmado; el enlace no se cambia.' });
    }
    const lineas = data.lineas.map((l, i) => {
      if (i !== idx) return l;
      const { pagoExterno, ...resto } = l;
      return url
        ? { ...resto, pagoExterno: { proveedor: PROVEEDOR, url, estado: 'pendiente', actualizadoEn: admin.firestore.Timestamp.now(), actualizadoPor: req.user.uid } }
        : resto;
    });
    await ref.update({ lineas });
    res.json(serializeTimestamps({ caseId: req.params.caseId, pagoExterno: lineas[idx].pagoExterno || null }));
  } catch (e) {
    console.error('[pago-externo] enlace', e);
    res.status(500).json({ error: 'No se pudo guardar el enlace.' });
  }
});

// ─── POST /confirmar (admin, payments.create): el panel de Rapid PayPro ya muestra el pago ───
router.post('/confirmar', requireAuth, requirePermission('payments.create'), async (req, res) => {
  try {
    const errorRef = textoError('La referencia', req.body?.referencia, 120, false);
    if (errorRef) return res.status(400).json({ error: errorRef });
    const referencia = trimOrNull(req.body?.referencia);

    const cargada = await cargarLinea(req, res);
    if (!cargada) return;
    const { ref, data, idx } = cargada;
    const principal = data.lineas[idx];
    if (data.estado !== 'aceptada') {
      return res.status(400).json({ error: `Solo se confirma el pago de una cotización 'aceptada' (esta está '${data.estado}').` });
    }
    if (!principal.pagoExterno?.url) return res.status(400).json({ error: 'Ese producto no tiene enlace de Rapid PayPro.' });
    if (principal.pagoExterno.estado === 'confirmado') return res.json({ confirmado: true, yaEstaba: true });
    if (['capturando', 'capturada'].includes(data.pagoPaypal?.estado)) {
      return res.status(409).json({ error: 'Esta cotización se está cobrando (o se cobró) con PayPal: no se confirma por Rapid PayPro.' });
    }

    const caseId = req.params.caseId;
    const extras = data.lineas.filter(l => l.caseId === caseId && l.tipo && l.tipo !== 'principal');
    const ahora = admin.firestore.Timestamp.now();
    const batch = db().batch();
    const pagos = [];
    for (const concepto of conceptosRequeridosFase05(principal)) {
      const monto = (principal.conceptos?.[concepto] || 0) + extras.reduce((s, l) => s + (l.conceptos?.[concepto] || 0), 0);
      const pago = await createConceptPayment(caseId, {
        concepto, monto, origen: PROVEEDOR, paypalOrderId: null,
        registradoPor: req.user.uid, registradoPorEmail: req.user.email,
        paymentId: `rpp_${ref.id}_${caseId}_${concepto}`, batch, // determinista: confirmar dos veces no duplica
      });
      pagos.push({ concepto, monto, paymentId: pago.id });
    }
    const lineas = data.lineas.map((l, i) => (i !== idx ? l : {
      ...l, pagoExterno: { ...l.pagoExterno, estado: 'confirmado', referencia, confirmadoEn: ahora, confirmadoPor: req.user.uid },
    }));
    batch.update(ref, {
      lineas,
      historial: admin.firestore.FieldValue.arrayUnion({
        tipo: 'pago_externo_confirmado', caseId, proveedor: PROVEEDOR, referencia,
        por: req.user.uid, porEmail: req.user.email, at: ahora,
      }),
    });
    await batch.commit();
    res.json(serializeTimestamps({ confirmado: true, caseId, pagos }));
  } catch (e) {
    console.error('[pago-externo] confirmar', e);
    res.status(500).json({ error: 'No se pudo confirmar el pago.' });
  }
});

module.exports = router;

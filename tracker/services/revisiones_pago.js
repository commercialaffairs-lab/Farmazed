/**
 * revisiones_pago.js — Cola de "pagos por revisar" del admin (`revisiones_pago/{id}`).
 * La llenan el webhook de PayPal (pago fallido, reembolso, cobro denegado, cobro sin
 * registro) y el cambio de plan cuando la suscripción anterior no se pudo cancelar.
 * El admin la ve en Mi Bandeja y la marca resuelta (routes/revisiones_pago.js).
 *
 * El `id` lo decide quien la abre (el id del evento de PayPal, p. ej.): abrir dos veces
 * la misma revisión no la duplica.
 */
const admin = require('../utils/firebase_admin.js');

const db = () => admin.firestore();
const COLECCION = 'revisiones_pago';

/** `t` (opcional): la transacción de quien la abre, para que quede escrita junto con su efecto. */
async function abrirRevision(id, { motivo, origen, eventType = null, orgId = null, quoteId = null, recursoId = null }, t = null) {
  const ref = db().collection(COLECCION).doc(id);
  const datos = { motivo, origen, eventType, orgId, quoteId, recursoId, resuelta: false, creadaEn: admin.firestore.Timestamp.now() };
  console.error('[pagos] para revisión del admin', { id, motivo, orgId, quoteId, recursoId });
  if (t) t.set(ref, datos);
  else await ref.set(datos);
}

module.exports = { COLECCION, abrirRevision };

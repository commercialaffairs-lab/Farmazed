/**
 * paypal_webhook.js — Qué hace cada evento del webhook de PayPal (decisión de Rick, 05-oct;
 * tabla en PAYPAL_SETUP.md). La firma ya la verificó routes/webhooks.js.
 *
 *   BILLING.SUBSCRIPTION.ACTIVATED            suscripción -> 'activa' (o entra en vigor el cambio de plan)
 *   BILLING.SUBSCRIPTION.CANCELLED / EXPIRED  suscripción -> 'cancelada'
 *   BILLING.SUBSCRIPTION.SUSPENDED            suscripción -> 'suspendida'
 *   BILLING.SUBSCRIPTION.PAYMENT.FAILED       revisión del admin
 *   PAYMENT.CAPTURE.REFUNDED / DENIED         revisión del admin
 *   PAYMENT.CAPTURE.COMPLETED                 se concilia con el pago ya registrado en la cotización
 *
 * Cada evento se procesa UNA vez: `paypal_eventos/{event.id}` se escribe en la misma
 * transacción que su efecto (PayPal reintenta un evento hasta que recibe un 2xx).
 */
const admin = require('firebase-admin');
const { abrirRevision } = require('./revisiones_pago');
const { cambiosDeCambioDePlan, cancelarAnterior } = require('./suscripciones');

const db = () => admin.firestore();
const ID_DOC = /^[\w.-]{1,150}$/; // lo que llega de fuera y se usa como id de documento

const ESTADO_POR_EVENTO = {
  'BILLING.SUBSCRIPTION.ACTIVATED': 'activa',
  'BILLING.SUBSCRIPTION.CANCELLED': 'cancelada',
  'BILLING.SUBSCRIPTION.EXPIRED': 'cancelada',
  'BILLING.SUBSCRIPTION.SUSPENDED': 'suspendida',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED': null, // no cambia el estado: PayPal reintenta el cobro por su cuenta
};
const EVENTOS_DE_CAPTURA = ['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED'];
// La captura la está registrando ahora mismo routes/quotes.js: el evento se reintenta después.
const CAPTURA_EN_CURSO = ['creando', 'creada', 'capturando'];

/** PayPal debe reintentar el evento más tarde (routes/webhooks.js responde 503 y no lo da por recibido). */
class ReintentarEvento extends Error {}

/**
 * Qué hacer con un evento de suscripción, dado el estado de la empresa. Sin efectos:
 * devuelve { resultado, cambios?, revision?, cancelar? } y quien llama lo aplica.
 */
function decidirSuscripcion(org, tipo, subscriptionId, ahora) {
  const estado = ESTADO_POR_EVENTO[tipo];
  const actual = org?.suscripcion;

  if (org?.cambioDePlan?.subscriptionId === subscriptionId) {
    if (estado === 'activa') {
      return { resultado: 'cambio_de_plan_aplicado', cambios: cambiosDeCambioDePlan(org, ahora), cancelar: actual?.subscriptionId || null };
    }
    if (estado === 'cancelada') {
      return { resultado: 'cambio_de_plan_descartado', cambios: { cambioDePlan: admin.firestore.FieldValue.delete() } };
    }
    return { resultado: 'revision', revision: 'PayPal reporta un problema con la suscripción de un cambio de plan que todavía no entró en vigor.' };
  }

  if (actual?.subscriptionId === subscriptionId) {
    if (!estado) {
      return {
        resultado: 'pago_fallido',
        cambios: { 'suscripcion.pagoFallidoEn': ahora },
        revision: 'PayPal no pudo cobrar la suscripción de la empresa.',
      };
    }
    // Una suscripción cancelada no revive: un ACTIVATED/SUSPENDED que llega después es un evento atrasado.
    if (actual.estado === estado || actual.estado === 'cancelada') return { resultado: 'sin_cambio' };
    return { resultado: `suscripcion_${estado}`, cambios: { 'suscripcion.estado': estado, 'suscripcion.actualizadaEn': ahora } };
  }

  // Terminó una suscripción que ya no es la de la empresa (la reemplazada por un cambio de plan,
  // o una que nunca se aprobó): no hay nada que reflejar.
  if (estado === 'cancelada') return { resultado: 'sin_cambio' };
  return {
    resultado: 'revision',
    revision: 'PayPal avisa de una suscripción que no es la vigente de la empresa (puede estar cobrando): revisarla en PayPal.',
  };
}

async function buscarEmpresa(subscriptionId, customId) {
  const orgs = db().collection('orgs');
  if (typeof customId === 'string' && ID_DOC.test(customId)) {
    const snap = await orgs.doc(customId).get();
    if (snap.exists) return snap.ref;
  }
  const consulta = await orgs.where('suscripcion.subscriptionId', '==', subscriptionId).limit(1).get();
  return consulta.empty ? null : consulta.docs[0].ref;
}

async function eventoDeSuscripcion({ id, event_type: tipo, resource }) {
  const orgRef = await buscarEmpresa(resource.id, resource.custom_id);
  const eventoRef = db().collection('paypal_eventos').doc(id);
  let cancelar = null;

  const resultado = await db().runTransaction(async (t) => {
    cancelar = null; // la transacción puede reintentarse
    if ((await t.get(eventoRef)).exists) return 'duplicado';
    const ahora = admin.firestore.Timestamp.now();
    const org = orgRef ? (await t.get(orgRef)).data() : null;
    const decision = decidirSuscripcion(org, tipo, resource.id, ahora);
    if (decision.cambios) t.update(orgRef, decision.cambios);
    if (decision.revision) {
      await abrirRevision(id, { motivo: decision.revision, origen: 'webhook_paypal', eventType: tipo, orgId: orgRef?.id || null, recursoId: resource.id }, t);
    }
    cancelar = decision.cancelar || null;
    t.create(eventoRef, { tipo, recursoId: resource.id, resultado: decision.resultado, procesadoEn: ahora });
    return decision.resultado;
  });

  if (cancelar) await cancelarAnterior(orgRef.id, cancelar);
  return resultado;
}

// En un reembolso, `resource` es el reembolso: la captura original viene en el enlace 'up'.
function idDeCaptura(tipo, resource) {
  if (tipo !== 'PAYMENT.CAPTURE.REFUNDED') return resource.id;
  const up = (resource.links || []).find(l => l.rel === 'up')?.href || '';
  return up.match(/\/captures\/([\w-]+)$/)?.[1] || null;
}

async function buscarCotizacion(captureId, orderId) {
  const quotes = db().collection('quotes');
  for (const [campo, valor] of [['pagoPaypal.captureId', captureId], ['pagoPaypal.orderId', orderId]]) {
    if (!valor) continue;
    const consulta = await quotes.where(campo, '==', valor).limit(1).get();
    if (!consulta.empty) return consulta.docs[0].ref;
  }
  return null;
}

async function eventoDeCaptura({ id, event_type: tipo, resource }) {
  const captureId = idDeCaptura(tipo, resource);
  const quoteRef = await buscarCotizacion(captureId, resource.supplementary_data?.related_ids?.order_id);
  const eventoRef = db().collection('paypal_eventos').doc(id);

  return db().runTransaction(async (t) => {
    if ((await t.get(eventoRef)).exists) return 'duplicado';
    const ahora = admin.firestore.Timestamp.now();
    const quote = quoteRef ? (await t.get(quoteRef)).data() : null;
    const estadoPago = quote?.pagoPaypal?.estado;
    const revisar = (motivo) => abrirRevision(id, {
      motivo, origen: 'webhook_paypal', eventType: tipo,
      orgId: quote?.orgId || null, quoteId: quoteRef?.id || null, recursoId: captureId || resource.id,
    }, t);

    let resultado;
    if (tipo === 'PAYMENT.CAPTURE.COMPLETED') {
      if (estadoPago === 'capturada') {
        t.update(quoteRef, { 'pagoPaypal.conciliadoEn': ahora });
        resultado = 'conciliado';
      } else if (CAPTURA_EN_CURSO.includes(estadoPago)) {
        throw new ReintentarEvento(`la cotización ${quoteRef.id} todavía está registrando la captura (${estadoPago})`);
      } else {
        await revisar(quote
          ? `PayPal confirma el cobro, pero la cotización no lo tiene registrado como pagado (estado del pago: ${estadoPago || 'sin pago'}).`
          : 'PayPal confirma un cobro que no corresponde a ninguna cotización registrada.');
        resultado = 'revision';
      }
    } else {
      const incidencia = tipo === 'PAYMENT.CAPTURE.REFUNDED' ? 'reembolsado' : 'denegado';
      if (quote) t.update(quoteRef, { 'pagoPaypal.incidencia': { tipo: incidencia, en: ahora } });
      await revisar(incidencia === 'reembolsado'
        ? 'PayPal reporta un reembolso de un pago de cotización: revisar los pagos registrados del caso.'
        : 'PayPal denegó el cobro de una cotización: revisar si el pago quedó registrado.');
      resultado = 'revision';
    }
    t.create(eventoRef, { tipo, recursoId: captureId || resource.id, resultado, procesadoEn: ahora });
    return resultado;
  });
}

/** Procesa un evento ya verificado. Devuelve una etiqueta del resultado (para el log). */
async function procesarEvento(evento) {
  const { id, event_type: tipo, resource } = evento || {};
  // Sin id de evento no se puede garantizar "una sola vez": no se toca nada.
  if (typeof id !== 'string' || !ID_DOC.test(id) || typeof resource?.id !== 'string') return 'ignorado';
  if (tipo in ESTADO_POR_EVENTO) return eventoDeSuscripcion(evento);
  if (EVENTOS_DE_CAPTURA.includes(tipo)) return eventoDeCaptura(evento);
  return 'ignorado';
}

module.exports = { procesarEvento, decidirSuscripcion, ReintentarEvento };

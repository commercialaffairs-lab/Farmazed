/**
 * quotes.js — R5/R12 (TAREA 18, PM_COMMENTS líneas 50, 57, 78, 447; SVG fase
 * 4 "Cotización del servicio").
 *
 * R5 (cliente con varios productos): la cotización AGRUPA N casos de la
 * MISMA empresa; cada caso conserva su propio `caseCode`. R12: borrador
 * automático que Farmazed ajusta y envía.
 *
 * Modelo — colección `quotes` (top-level, por encima de `cases`):
 *   { orgId, caseIds:[...], lineas:[{
 *       caseId, caseCode, categoriaPrecio,        // categoriaPrecio: null si
 *                                                  // no se pudo resolver con
 *                                                  // certeza (ver
 *                                                  // resolverCategoriaPrecio) —
 *                                                  // el admin la completa a mano
 *       tarifarioHonorarios, tarifarioTasas,       // congelados al crear la línea
 *       honorariosFarmazed, tasasOficiales, monto, // valores EFECTIVOS de la línea
 *       ajustado, motivoAjuste,
 *     }],
 *     total, estado: 'borrador'|'enviada'|'aceptada'|'rechazada',
 *     historial: [{tipo, caseId?, por, motivo?, at}],
 *     createdAt, updatedAt, enviadaAt?, enviadaPor?, respondidaAt?, respondidaPor?, motivoRechazo?
 *   }
 *
 * Ciclo: fase_03 -> fase_04 (§H.1, TRANSITIONS) dispara
 * `attachCaseToDraftQuote()` desde cases.js — agrega/actualiza la línea de
 * ese caso en el borrador de su empresa (uno solo por empresa a la vez; si
 * ya existe uno en 'borrador' se reusa, si no se crea). El admin ajusta
 * líneas (motivo obligatorio si el monto se aparta del tarifario congelado)
 * y envía (`estado: 'enviada'`); el cliente TITULAR (no miembro — decisión
 * de este trámite: quien acepta un compromiso de pago es el dueño de la
 * cuenta) la acepta o rechaza. fase_04 -> fase_05 exige una cotización
 * 'aceptada' que incluya ese caso (`hasAcceptedQuote`, gate igual de forma
 * que el de pagos en payments.js — override del admin lo sigue pasando por
 * encima).
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/quotes', quotesRouter);
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { serializeTimestamps } = require('../utils/serialize');
const { effectiveRole, CLIENT_ROLES, requirePermission } = require('../middleware/permissions');
const { conceptosRequeridosFase05 } = require('../utils/conceptos_fase05');
const { getProvider } = require('../services/payments');
const { createConceptPayment } = require('../services/payments_ledger');
const { recomputeTotal } = require('../services/quotes');
const { HttpError, responderError } = require('../utils/http_error');

const router = Router();
const db     = () => admin.firestore();

function historialEntry(tipo, extra, req) {
  return {
    tipo, ...extra,
    por: req.user.uid, porEmail: req.user.email,
    at: admin.firestore.Timestamp.now(),
  };
}

/**
 * ¿Puede este usuario ver esta cotización? Admin: cualquiera. Cliente
 * (titular o miembro): solo la de su propia empresa. Nadie más — el staff
 * (analista/abogado/regente) no participa de la cotización, no está en la
 * tabla de roles de `quotes.read` (ver middleware/permissions.js).
 */
function canAccessQuote(user, quoteData) {
  const role = effectiveRole(user);
  if (role === 'admin') return true;
  if (CLIENT_ROLES.includes(role)) return quoteData.orgId && quoteData.orgId === user.orgId;
  return false;
}

// ─── GET /api/quotes ──────────────────────────────────────────────────────────
router.get('/', requireAuth, requirePermission('quotes.read'), async (req, res) => {
  try {
    const role = effectiveRole(req.user);
    let query = db().collection('quotes').orderBy('createdAt', 'desc');
    if (role !== 'admin') query = query.where('orgId', '==', req.user.orgId || '__sin_org__');

    const snap = await query.limit(200).get();
    const quotes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(serializeTimestamps({ total: quotes.length, quotes }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/quotes/:id ──────────────────────────────────────────────────────
router.get('/:id', requireAuth, requirePermission('quotes.read'), async (req, res) => {
  try {
    const snap = await db().collection('quotes').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Cotización no encontrada' });
    const data = snap.data();
    if (!canAccessQuote(req.user, data)) return res.status(403).json({ error: 'Forbidden' });
    res.json(serializeTimestamps({ id: snap.id, ...data }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const MODALIDADES_IEA = ['regular', 'expedita'];

// ─── PATCH /api/quotes/:id/lineas/:caseId (admin only) ───────────────────────
// Body: { honorariosFarmazed?, tasasOficiales?, motivo?, esExtranjero?,
// aplicaIEA?, modalidadIEA?, tipo? }. `tipo` ('principal' por default, o
// 'prioridad_innovadores' — TAREA 28) elige CUÁL línea de este caso ajustar,
// cuando hay dos (mismo caseId). Motivo obligatorio si el monto resultante
// de la línea se aparta del tarifario congelado al crearla
// (tarifarioHonorarios/tarifarioTasas) — igual si no había categoría
// resuelta (tarifario 0/0: cualquier monto que el admin ponga a mano es, por
// definición, un apartamiento).
router.patch('/:id/lineas/:caseId', requireAuth, requirePermission('quotes.edit'), async (req, res) => {
  try {
    const ref  = db().collection('quotes').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Cotización no encontrada' });
    const data = snap.data();

    if (data.estado !== 'borrador') {
      return res.status(400).json({ error: `Solo se puede ajustar una cotización en 'borrador' (esta está '${data.estado}').` });
    }

    const tipoLinea = req.body.tipo || 'principal';
    const idx = data.lineas.findIndex(l => l.caseId === req.params.caseId && (l.tipo || 'principal') === tipoLinea);
    if (idx === -1) return res.status(404).json({ error: 'Ese caso no está en esta cotización (o no tiene una línea de ese tipo)' });

    const linea = data.lineas[idx];
    const { honorariosFarmazed, tasasOficiales, motivo, esExtranjero, aplicaIEA, modalidadIEA, conceptos } = req.body;
    const nuevoHonorarios = honorariosFarmazed !== undefined ? Number(honorariosFarmazed) : linea.honorariosFarmazed;
    const nuevoTasas      = tasasOficiales      !== undefined ? Number(tasasOficiales)      : linea.tasasOficiales;

    if (!Number.isFinite(nuevoHonorarios) || nuevoHonorarios < 0 || !Number.isFinite(nuevoTasas) || nuevoTasas < 0) {
      return res.status(400).json({ error: 'honorariosFarmazed/tasasOficiales deben ser números >= 0' });
    }

    const cambio = nuevoHonorarios !== linea.tarifarioHonorarios || nuevoTasas !== linea.tarifarioTasas;
    if (cambio && !motivo) {
      return res.status(400).json({
        error: 'motivo obligatorio: el monto se aparta del tarifario de esta categoría',
        tarifario: { honorariosFarmazed: linea.tarifarioHonorarios, tasasOficiales: linea.tarifarioTasas },
      });
    }

    // TAREA 23: esExtranjero/aplicaIEA/modalidadIEA — de esto depende el
    // gate de fase_05 (concepto mef/iea). Sin aplicaIEA, modalidadIEA no
    // tiene sentido — se fuerza a null para no dejar el dato a medias.
    const nuevoEsExtranjero = esExtranjero !== undefined ? !!esExtranjero : linea.esExtranjero;
    const nuevoAplicaIEA    = aplicaIEA    !== undefined ? !!aplicaIEA    : linea.aplicaIEA;
    let nuevaModalidadIEA   = modalidadIEA !== undefined ? modalidadIEA   : linea.modalidadIEA;
    if (!nuevoAplicaIEA) {
      nuevaModalidadIEA = null;
    } else if (!MODALIDADES_IEA.includes(nuevaModalidadIEA)) {
      return res.status(400).json({
        error: `modalidadIEA obligatoria y valida cuando aplicaIEA=true: "${nuevaModalidadIEA || '(vacio)'}". Validas: ${MODALIDADES_IEA.join(', ')}`,
        validas: MODALIDADES_IEA,
      });
    }

    // TAREA 33 (§H.14): `conceptos` es OPCIONAL — si el admin ajusta montos
    // sin mandarlo explícito, el desglose por concepto queda como estaba
    // (no se reescala solo; no hay una regla obvia de cómo repartir un
    // ajuste manual entre honorarios/tasa_dnfd/mef/iea sin inventarla).
    let nuevosConceptos = linea.conceptos;
    if (conceptos !== undefined) {
      const faltante = ['honorarios', 'tasa_dnfd', 'mef', 'iea'].find(k => typeof conceptos[k] !== 'number' || conceptos[k] < 0);
      if (faltante) {
        return res.status(400).json({ error: `conceptos.${faltante} debe ser un número >= 0` });
      }
      nuevosConceptos = conceptos;
    }

    const lineaActualizada = {
      ...linea,
      honorariosFarmazed: nuevoHonorarios,
      tasasOficiales: nuevoTasas,
      monto: nuevoHonorarios + nuevoTasas,
      ajustado: cambio,
      motivoAjuste: cambio ? motivo : null,
      esExtranjero: nuevoEsExtranjero,
      aplicaIEA: nuevoAplicaIEA,
      modalidadIEA: nuevaModalidadIEA,
      conceptos: nuevosConceptos,
    };
    const lineas = [...data.lineas];
    lineas[idx] = lineaActualizada;

    await ref.update({
      lineas,
      total: recomputeTotal(lineas),
      historial: admin.firestore.FieldValue.arrayUnion(
        historialEntry('linea_ajustada', { caseId: req.params.caseId, motivo: motivo || null }, req)
      ),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    res.json(serializeTimestamps({ id: ref.id, ...data, lineas, total: recomputeTotal(lineas) }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/quotes/:id/send (admin only) ──────────────────────────────────
router.post('/:id/send', requireAuth, requirePermission('quotes.send'), async (req, res) => {
  try {
    const ref  = db().collection('quotes').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Cotización no encontrada' });
    const data = snap.data();

    if (data.estado !== 'borrador') {
      return res.status(400).json({ error: `Solo se puede enviar una cotización en 'borrador' (esta está '${data.estado}').` });
    }
    if (!data.lineas.length) {
      return res.status(400).json({ error: 'La cotización no tiene líneas' });
    }

    const now = admin.firestore.Timestamp.now();
    await ref.update({
      estado: 'enviada',
      enviadaAt: now, enviadaPor: req.user.uid, enviadaPorEmail: req.user.email,
      historial: admin.firestore.FieldValue.arrayUnion(historialEntry('enviada', {}, req)),
      updatedAt: now,
    });

    res.json(serializeTimestamps({ id: ref.id, ...data, estado: 'enviada' }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/quotes/:id/respond (cliente_titular only) ────────────────────
// Body: { decision: 'aceptada'|'rechazada', motivo? } — motivo obligatorio
// si rechazada.
router.post('/:id/respond', requireAuth, requirePermission('quotes.accept'), async (req, res) => {
  try {
    const ref  = db().collection('quotes').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Cotización no encontrada' });
    const data = snap.data();

    if (!canAccessQuote(req.user, data)) return res.status(403).json({ error: 'Forbidden' });
    if (data.estado !== 'enviada') {
      return res.status(400).json({ error: `Solo se puede responder una cotización 'enviada' (esta está '${data.estado}').` });
    }

    const { decision, motivo } = req.body;
    if (!['aceptada', 'rechazada'].includes(decision)) {
      return res.status(400).json({ error: `decision inválida: "${decision}". Válidas: aceptada, rechazada` });
    }
    if (decision === 'rechazada' && !motivo) {
      return res.status(400).json({ error: 'motivo obligatorio para rechazar una cotización' });
    }

    const now = admin.firestore.Timestamp.now();
    const update = {
      estado: decision,
      respondidaAt: now, respondidaPor: req.user.uid, respondidaPorEmail: req.user.email,
      motivoRechazo: decision === 'rechazada' ? motivo : null,
      historial: admin.firestore.FieldValue.arrayUnion(historialEntry(decision, { motivo: motivo || null }, req)),
      updatedAt: now,
    };
    await ref.update(update);

    res.json(serializeTimestamps({ id: ref.id, ...data, ...update }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Pago de la cotización aceptada con PayPal (TAREA 33, §H.14) ──────────────
// "Por PayPal se cobra TODO junto" (decisión de Rick): un solo cargo por el
// TOTAL de la cotización (todos los casos, honorarios+tasas de cada uno);
// al capturarse se reparten en los pagos POR CONCEPTO que el gate de
// fase_05 ya sabe leer (hasConceptPayment, payments.js) — Farmazed emite
// después los cheques separados a DNFD/IEA/MEF con esa referencia.

// TAREA 38 (C3/H6): crear-orden y capturar son ATÓMICOS — el estado de
// `pagoPaypal` se reserva dentro de una runTransaction ANTES de hablar con el
// proveedor ('creando' / 'capturando'), así dos requests en paralelo (doble
// clic, reintento del navegador) no pueden cobrar ni registrar dos veces. Una
// reserva más vieja que RESERVA_TTL_MS se considera abandonada (el proceso
// murió a medias) y se puede retomar.
const RESERVA_TTL_MS = 2 * 60 * 1000;
const aCentavos = (n) => Math.round(Number(n) * 100); // comparar dinero en enteros, no con float (0.1+0.2 !== 0.3)
// Con alguno de estos estados puede haber dinero cobrado sin cuadrar: crear-orden
// no abre otra orden encima (sobrescribiría el orderId cobrado).
const ESTADOS_PAGO_A_REVISAR = ['capturando', 'captura_sin_registrar', 'captura_discrepante'];
const reservaVigente = (pago, campo) => {
  const t = pago?.[campo]?.toMillis?.();
  return !!t && Date.now() - t < RESERVA_TTL_MS;
};

function verificarAccesoYEstado(user, data) {
  if (!canAccessQuote(user, data)) throw new HttpError(403, { error: 'Forbidden' });
  if (data.estado !== 'aceptada') {
    throw new HttpError(400, { error: `Solo se puede pagar una cotización 'aceptada' (esta está '${data.estado}').` });
  }
}

// ─── POST /api/quotes/:id/pago/crear-orden (cliente_titular) ─────────────────
// Sin monto en el body — a propósito: el monto SIEMPRE se calcula en el
// servidor desde la cotización, nunca desde lo que mande el navegador.
// Si ya hay una orden 'creada' con el mismo monto, se REUTILIZA (no se abre
// otra en PayPal por cada clic).
router.post('/:id/pago/crear-orden', requireAuth, requirePermission('quotes.pay'), async (req, res) => {
  const ref = db().collection('quotes').doc(req.params.id);
  try {
    const reserva = await db().runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new HttpError(404, { error: 'Cotización no encontrada' });
      const data = snap.data();
      verificarAccesoYEstado(req.user, data);

      const pago = data.pagoPaypal;
      if (pago?.estado === 'capturada') throw new HttpError(409, { error: 'Esta cotización ya fue pagada.' });
      if (ESTADOS_PAGO_A_REVISAR.includes(pago?.estado)) {
        throw new HttpError(409, { error: 'Hay un pago en curso o pendiente de revisión para esta cotización — contacta a Farmazed.' });
      }

      const monto = recomputeTotal(data.lineas); // recalculado acá, nunca del body ni de data.total cacheado
      if (!(aCentavos(monto) > 0)) throw new HttpError(400, { error: 'Esta cotización no tiene un monto a pagar.' });
      if (pago?.estado === 'creada' && pago.orderId && aCentavos(pago.expectedAmount) === aCentavos(monto)) {
        return { reutilizada: true, orderId: pago.orderId, approveUrl: pago.approveUrl || null, monto, data };
      }
      if (pago?.estado === 'creando' && reservaVigente(pago, 'reservadaEn')) {
        throw new HttpError(409, { error: 'Ya se está creando la orden de pago — espera un momento.' });
      }
      t.update(ref, { pagoPaypal: { estado: 'creando', reservadaEn: admin.firestore.Timestamp.now() } });
      return { reutilizada: false, monto, data };
    });

    if (reserva.reutilizada) {
      return res.json({ orderId: reserva.orderId, status: 'CREATED', approveUrl: reserva.approveUrl, amount: reserva.monto, currency: 'USD', reutilizada: true });
    }

    let provider, orden;
    const liberar = () => ref.update({ pagoPaypal: admin.firestore.FieldValue.delete() })
      .catch(err => console.error('[quotes/pago] no se pudo liberar la reserva', { quoteId: ref.id, error: err.message }));
    try {
      provider = getProvider();
      orden = await provider.createOrder({
        amount: reserva.monto, currency: 'USD', referenceId: req.params.id,
        // un reintento inmediato del mismo cobro no abre otra orden; por hora, para que una orden caducada no quede pegada
        requestId: `order-${req.params.id}-${aCentavos(reserva.monto)}-${Math.floor(Date.now() / 3_600_000)}`,
        description: `Farmazed — cotización ${req.params.id} (${reserva.data.caseIds.length} caso(s))`,
      });
    } catch (e) {
      // El proveedor falló: se libera la reserva, para poder reintentar.
      await liberar();
      throw e;
    }

    const pagoPaypal = {
      orderId: orden.orderId, estado: 'creada', proveedor: provider.name,
      approveUrl: orden.approveUrl || null,
      expectedAmount: reserva.monto, expectedCurrency: 'USD',
      creadaEn: admin.firestore.Timestamp.now(), creadaPor: req.user.uid,
    };
    try {
      await ref.update({ pagoPaypal });
    } catch (e) {
      console.error('[quotes/pago] orden creada en el proveedor pero no guardada', { quoteId: ref.id, orderId: orden.orderId, error: e.message });
      await liberar();
      throw e;
    }

    res.status(201).json(serializeTimestamps({ orderId: orden.orderId, status: orden.status, approveUrl: orden.approveUrl, amount: reserva.monto, currency: 'USD' }));
  } catch (e) {
    responderError(res, e);
  }
});

// ─── POST /api/quotes/:id/pago/capturar (cliente_titular) ────────────────────
// Body: { orderId } — tiene que ser EXACTAMENTE el que devolvió crear-orden
// para esta misma cotización; no hay forma de capturar la orden de otra
// cotización contra esta (se compara contra lo que el servidor guardó, no
// contra nada que el cliente pueda inventar). Idempotente: si ya estaba
// 'capturada', devuelve el mismo resultado sin volver a crear pagos ni
// llamar al proveedor de nuevo. TAREA 38: la transición creada->capturando es
// una transacción (el segundo request en paralelo recibe 409), los pagos por
// concepto llevan id determinista y se escriben en UN batch junto con el
// estado 'capturada', y si el cobro se hizo pero el registro falla, queda
// 'captura_sin_registrar' (reintentar /capturar lo completa sin recobrar).
router.post('/:id/pago/capturar', requireAuth, requirePermission('quotes.pay'), async (req, res) => {
  const ref = db().collection('quotes').doc(req.params.id);
  try {
    const { orderId } = req.body;
    const reserva = await db().runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new HttpError(404, { error: 'Cotización no encontrada' });
      const data = snap.data();
      verificarAccesoYEstado(req.user, data);
      if (!data.pagoPaypal) {
        throw new HttpError(400, { error: 'Todavía no se creó una orden de pago para esta cotización — llamar primero a /pago/crear-orden.' });
      }

      // El orderId se valida ANTES de la idempotencia — si no, una cotización
      // ya capturada devolvería "éxito" para CUALQUIER orderId que alguien
      // mande (mismo bug que "monto manipulado": no hay que confiar en nada
      // del cliente, ni siquiera cuando la respuesta iba a ser la misma).
      if (!orderId || orderId !== data.pagoPaypal.orderId) {
        throw new HttpError(400, { error: 'orderId no coincide con la orden creada para esta cotización.' });
      }

      const pago = data.pagoPaypal;
      if (pago.estado === 'capturada') return { yaEstaba: true, pago };
      if (pago.estado === 'capturando' && reservaVigente(pago, 'capturandoDesde')) {
        throw new HttpError(409, { error: 'Ya hay una captura en curso para esta cotización.' });
      }
      t.update(ref, { 'pagoPaypal.estado': 'capturando', 'pagoPaypal.capturandoDesde': admin.firestore.Timestamp.now() });
      return { yaEstaba: false, data, estadoPrevio: pago.estado };
    });

    if (reserva.yaEstaba) {
      return res.json({ capturada: true, yaEstaba: true, orderId, amount: reserva.pago.expectedAmount });
    }
    const { data, estadoPrevio } = reserva;
    const FieldValue = admin.firestore.FieldValue;
    const soltar = () => ref.update({ 'pagoPaypal.estado': estadoPrevio, 'pagoPaypal.capturandoDesde': FieldValue.delete() })
      .catch(err => console.error('[quotes/pago] no se pudo liberar la captura', { quoteId: ref.id, orderId, error: err.message }));

    let resultado;
    try {
      resultado = await getProvider().captureOrder(orderId);
    } catch (e) {
      // Puede haber cobrado igual (timeout con la respuesta perdida): al
      // volver al estado previo, reintentar /capturar lo detecta
      // (captureOrder trata ORDER_ALREADY_CAPTURED como éxito).
      await soltar();
      throw e;
    }
    if (resultado.captureId) {
      // Si esto falla, el captureId igual queda en el log (y en el batch final).
      await ref.update({ 'pagoPaypal.captureId': resultado.captureId })
        .catch(err => console.error('[quotes/pago] COBRADO, no se pudo guardar el captureId', { quoteId: ref.id, orderId, captureId: resultado.captureId, error: err.message }));
    }
    // Hay dinero cobrado (o en vuelo) que no cuadra: NO se libera la reserva
    // (volver a 'creada' dejaría abrir otra orden encima y cobrar dos veces).
    const aRevisar = async (motivo, extra) => {
      console.error(`[quotes/pago] ${motivo} — revisar a mano`, { quoteId: ref.id, orderId, captureId: resultado.captureId || null, ...extra });
      await ref.update({ 'pagoPaypal.estado': 'captura_discrepante', 'pagoPaypal.capturandoDesde': FieldValue.delete() })
        .catch(err => console.error('[quotes/pago] tampoco se pudo marcar captura_discrepante', { quoteId: ref.id, orderId, error: err.message }));
    };

    // Validación en servidor — NUNCA se confía en lo que diga el cliente:
    // el estado y el monto se verifican contra lo que el proveedor mismo
    // devuelve Y contra lo que el servidor calculó al crear la orden
    // (recalculado otra vez acá, por si la cotización cambió mientras
    // tanto), en centavos enteros. Cualquier discrepancia aborta SIN crear
    // pagos ni marcar nada como capturado — queda para revisión manual,
    // nunca se asume lo mejor.
    const montoActual = recomputeTotal(data.lineas);
    if (resultado.status !== 'COMPLETED') {
      console.error('[quotes/pago] el proveedor no completó la captura', { quoteId: ref.id, orderId, status: resultado.status });
      await soltar();
      return res.status(402).json({ error: `El proveedor de pagos no completó la captura (status: ${resultado.status}).` });
    }
    if (resultado.captureStatus && resultado.captureStatus !== 'COMPLETED') {
      await aRevisar('la orden está COMPLETED pero la captura no', { captureStatus: resultado.captureStatus });
      return res.status(409).json({ error: 'El pago quedó pendiente de confirmación en el proveedor — no se registró ningún pago todavía. Contacta a Farmazed.' });
    }
    const centavosCapturados = aCentavos(resultado.amount);
    if (resultado.orderId !== orderId
        || centavosCapturados !== aCentavos(data.pagoPaypal.expectedAmount)
        || centavosCapturados !== aCentavos(montoActual)
        || resultado.currency !== data.pagoPaypal.expectedCurrency) {
      await aRevisar('captura con monto/moneda/orderId distinto al esperado', {
        esperadoCentavos: aCentavos(data.pagoPaypal.expectedAmount), capturadoCentavos: centavosCapturados,
      });
      return res.status(409).json({
        error: 'El monto/moneda/orderId capturado no coincide con lo esperado — no se registró ningún pago. Revisar a mano.',
      });
    }

    const pagosCreados = [];
    try {
      const batch = db().batch();
      for (const caseId of data.caseIds) {
        const principal = data.lineas.find(l => l.caseId === caseId && (l.tipo || 'principal') === 'principal');
        // No debería pasar — cada caseId trae su línea principal. Si pasa, no se
        // salta en silencio: ya se cobró, así que cae en 'captura_sin_registrar'.
        if (!principal) throw new Error(`el caso ${caseId} no tiene línea principal en la cotización`);
        const extras = data.lineas.filter(l => l.caseId === caseId && l.tipo && l.tipo !== 'principal');

        for (const concepto of conceptosRequeridosFase05(principal)) {
          const montoConcepto = (principal.conceptos?.[concepto] || 0)
            + extras.reduce((s, l) => s + (l.conceptos?.[concepto] || 0), 0);
          const pago = await createConceptPayment(caseId, {
            concepto, monto: montoConcepto, origen: 'paypal', paypalOrderId: orderId,
            registradoPor: req.user.uid, registradoPorEmail: req.user.email,
            paymentId: `${orderId}_${caseId}_${concepto}`, batch,
          });
          pagosCreados.push({ caseId, concepto, monto: montoConcepto, paymentId: pago.id });
        }
      }
      batch.update(ref, {
        'pagoPaypal.estado': 'capturada',
        'pagoPaypal.captureId': resultado.captureId || null,
        'pagoPaypal.capturadaEn': admin.firestore.Timestamp.now(),
        'pagoPaypal.capturadaPor': req.user.uid,
        'pagoPaypal.capturandoDesde': FieldValue.delete(),
      });
      await batch.commit();
    } catch (e) {
      // Ya se cobró pero no quedó registrado: nunca se pierde en silencio.
      console.error('[quotes/pago] COBRADO SIN REGISTRAR — revisar a mano', {
        quoteId: ref.id, orderId, captureId: resultado.captureId || null, error: e.message,
      });
      await ref.update({ 'pagoPaypal.estado': 'captura_sin_registrar', 'pagoPaypal.capturandoDesde': FieldValue.delete() })
        .catch(err => console.error('[quotes/pago] tampoco se pudo marcar captura_sin_registrar', { quoteId: ref.id, orderId, error: err.message }));
      res.locals.errorControlado = true; // 500 informativo a propósito (index.js lo deja pasar)
      return res.status(500).json({
        error: 'El pago se cobró pero no se pudo registrar. Reintenta /pago/capturar o contacta a Farmazed.',
        orderId, captureId: resultado.captureId || null,
      });
    }

    res.json(serializeTimestamps({ capturada: true, orderId, amount: resultado.amount, currency: resultado.currency, pagos: pagosCreados }));
  } catch (e) {
    responderError(res, e);
  }
});


module.exports = router;

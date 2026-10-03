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
const { desglose } = require('../utils/pricing_desglose');
const { effectiveRole, CLIENT_ROLES, requirePermission } = require('../middleware/permissions');

const router = Router();
const db     = () => admin.firestore();

// ─── Resolución de categoría de precio (no inventa — ver TAREA 17/H.6 para
// el mismo criterio aplicado a formularios) ──────────────────────────────────
// Fuente de los ids: tracker/seed_pricing.js (única copia — si un id cambia
// ahí, hay que actualizarlo aquí). Hoy `seed_pricing.js` solo tiene filas de
// `medicamentos` (grupo "Registros Nuevos" para Nuevo Registro, que es lo
// único que crea el wizard — ver H.6 sobre el gap de "Renovación"). Un
// trámite/subtipo sin fila propia en el tarifario devuelve `null` — el admin
// lo completa a mano en la cotización, nunca se le asigna un precio a
// ciegas.
// TAREA 23 (§H.8, Precios): el xlsx del 24-sep separó varias categorías que
// seed_pricing.js (prod, 12-sep) traía combinadas en una sola fila —p.ej.
// Mutuo Acuerdo vs WLA WHO, o Suplementos/Homeopático/Radiofármaco, antes 1
// sola categoría "med_abreviado_suplemento". Ese tarifario más fino
// (`_24sep`) SOLO existe sembrado en el emulador (seed_pricing_24sep.js — ver
// organizacion/10_DIFF_PRECIOS_24SEP.md); producción sigue con los ids viejos
// de seed_pricing.js hasta que Rick apruebe promoverlo.
//
// Ajuste del PM tras TAREA 23: cuál tarifario está ACTIVO es una decisión de
// NEGOCIO (que Rick aprueba), no algo que deba inferirse de si esto corre
// contra el emulador o no — antes esta función miraba
// `FIRESTORE_EMULATOR_HOST`, que ata la decisión al entorno técnico. Ahora es
// una variable explícita: `PRICING_TABLE=24sep` activa el tarifario nuevo;
// cualquier otro valor (incluido no definida) usa el de siempre. Rick lo
// enciende en producción con un solo cambio de variable de entorno cuando
// apruebe el tarifario del 24-sep — ver ENTREGA_E1_E3.md, plan de deploy.
const TARIFARIO_24SEP = process.env.PRICING_TABLE === '24sep';

// TAREA 26 (§H.9-2) dejó "Prioridad innovadores" sin mapear por ambigüedad
// (¿reemplaza la categoría del subtipo o es un cargo adicional? ¿excluyente
// de las demás filas de Abreviado?). TAREA 28 (§H.11, Zelky ronda 2): es un
// cargo ADICIONAL (no reemplaza nada), solo para Síntesis Química,
// Biológicos y Biotecnológicos con `esInnovador = true` — por eso NO vive
// en `resolverCategoriaPrecio()` (que resuelve LA categoría principal, una
// sola por línea): se agrega como línea EXTRA de la cotización en
// `attachCaseToDraftQuote()` (ver más abajo, `lineaPrioridadInnovadores()`),
// marcada como provisional para que el admin la revise (Zelky: la fila dice
// "(Abreviado)" y sus tasas podrían duplicar las de la línea principal).
function resolverCategoriaPrecio({ tramiteType, tipoRegistro, tipoMedicamento = [] }) {
  if (tramiteType !== 'medicamentos') return null; // cosmeticos/higienicos/plaguicidas/... sin tarifario hoy.

  if (tipoRegistro === 'Reconocimiento Mutuo') {
    return TARIFARIO_24SEP ? 'med_mutuo_acuerdo_24sep' : 'med_abreviado_mutuo_acuerdo';
  }
  if (tipoRegistro === 'Reconocimiento WLA') {
    return TARIFARIO_24SEP ? 'med_abreviado_wla_who_24sep' : 'med_abreviado_mutuo_acuerdo'; // combinados en prod.
  }

  if (tipoRegistro === 'Abreviado') {
    if (tipoMedicamento.includes('Huérfanos')) return TARIFARIO_24SEP ? 'med_abreviado_huerfanos_24sep' : 'med_abreviado_huerfano';
    if (tipoMedicamento.includes('Suplementos')) return TARIFARIO_24SEP ? 'med_abreviado_suplementos_24sep' : 'med_abreviado_suplemento';
    if (tipoMedicamento.includes('Homeopático')) return TARIFARIO_24SEP ? 'med_abreviado_homeopaticos_24sep' : 'med_abreviado_suplemento';
    if (tipoMedicamento.includes('Radiofármaco')) return TARIFARIO_24SEP ? 'med_abreviado_radiofarmacos_24sep' : 'med_abreviado_suplemento';
    // TAREA 28 (§H.11): "Vacuna = Biológicos" — mismo precio, no es categoría aparte.
    if (tipoMedicamento.some(t => ['Biológicos', 'Biotecnológicos', 'Vacuna'].includes(t))) return TARIFARIO_24SEP ? 'med_abreviado_biologicos_24sep' : 'med_abreviado_biologico';
    if (tipoMedicamento.includes('Síntesis Química')) return TARIFARIO_24SEP ? 'med_abreviado_sintesis_24sep' : 'med_abreviado_sintesis';
    // TAREA 28 (§H.11): Zelky confirmó — Medio de Contraste/Gas Medicinal/
    // Productos Naturales en Abreviado quedan SIN precio a propósito ("ruta
    // no tarifada"), no es un gap pendiente de confirmar.
    return null;
  }

  if (tipoRegistro === 'Regular') {
    if (tipoMedicamento.includes('Huérfanos')) return TARIFARIO_24SEP ? 'med_regular_huerfano_24sep' : 'med_regular_huerfano';
    if (tipoMedicamento.includes('Productos Naturales')) return TARIFARIO_24SEP ? 'med_regular_naturales_24sep' : 'med_regular_natural';
    if (tipoMedicamento.includes('Gas Medicinal')) return TARIFARIO_24SEP ? 'med_regular_gases_24sep' : 'med_regular_natural';
    if (tipoMedicamento.includes('Medio de Contraste')) return TARIFARIO_24SEP ? 'med_regular_contraste_24sep' : 'med_regular_natural';
    if (tipoMedicamento.includes('Síntesis Química')) return TARIFARIO_24SEP ? 'med_regular_sintesis_24sep' : 'med_regular_sintesis';
    // TAREA 28 (§H.11): Zelky confirmó — Regular + categoría SIN fila propia
    // (Biológicos/Biotecnológicos/Homeopático/Radiofármaco/Suplementos/
    // Vacuna) usa la fila genérica "Procedimiento Regular" del xlsx 24-sep.
    // Solo existe en el tarifario nuevo — en legacy (prod, sin
    // PRICING_TABLE=24sep) sigue sin fila propia, null, como siempre.
    if (TARIFARIO_24SEP) return 'med_regular_general_24sep';
    return null;
  }

  return null;
}

async function tarifarioDe(categoriaPrecio) {
  if (!categoriaPrecio) return { honorariosFarmazed: 0, tasasOficiales: 0 };
  const snap = await db().collection('pricing').doc(categoriaPrecio).get();
  if (!snap.exists) return { honorariosFarmazed: 0, tasasOficiales: 0 };
  return desglose(snap.data().components);
}

function recomputeTotal(lineas) {
  return lineas.reduce((s, l) => s + (Number(l.monto) || 0), 0);
}

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

const CATEGORIAS_PRIORIDAD_INNOVADORES = ['Síntesis Química', 'Biológicos', 'Biotecnológicos', 'Vacuna'];

/**
 * TAREA 28 (§H.11, ajuste PM tras entrega): línea EXTRA de "Prioridad
 * innovadores" — cargo adicional, no reemplaza la línea principal. Solo si
 * `esInnovador===true` y la categoría es Síntesis Química/Biológicos/
 * Biotecnológicos/Vacuna ("Vacuna = Biológicos" aplica también aquí, el PM
 * lo confirmó explícitamente). Solo existe en el tarifario 24-sep
 * (`TARIFARIO_24SEP`) — en legacy no hay fila que cobrar. `null` si no
 * corresponde.
 */
async function lineaPrioridadInnovadores(caseData) {
  if (!TARIFARIO_24SEP) return null;
  if (caseData.esInnovador !== true) return null;
  if (!(caseData.tipoMedicamento || []).some(t => CATEGORIAS_PRIORIDAD_INNOVADORES.includes(t))) return null;

  const { honorariosFarmazed, tasasOficiales } = await tarifarioDe('med_abreviado_prioridad_innovadores_24sep');
  return {
    caseId: caseData.id, caseCode: caseData.caseCode,
    tipo: 'prioridad_innovadores',
    categoriaPrecio: 'med_abreviado_prioridad_innovadores_24sep',
    tarifarioHonorarios: honorariosFarmazed, tarifarioTasas: tasasOficiales,
    honorariosFarmazed, tasasOficiales, monto: honorariosFarmazed + tasasOficiales,
    // Provisional desde que se crea — Zelky: la fila dice "(Abreviado)" y
    // sus tasas podrían duplicar las de la línea principal; el admin la
    // revisa y ajusta con motivo (PATCH /lineas/:caseId con tipo:
    // 'prioridad_innovadores'). Si el admin la guarda sin cambiar el monto,
    // `ajustado` vuelve a `false` — ya no hace falta seguir marcándola.
    ajustado: true,
    motivoAjuste: 'Línea provisional (Prioridad innovadores, Abreviado) — revisar si corresponde a este caso y si las tasas duplican las de la línea principal.',
    esExtranjero: false, aplicaIEA: false, modalidadIEA: null,
  };
}

// ─── R12: borrador automático — llamado desde cases.js al salir de fase_03 ──
// hacia fase_04. Reusa el borrador 'borrador' de la empresa si ya existe uno
// (agrega/actualiza la línea de este caso); si no, crea uno nuevo. Si el
// caso no tiene orgId (cuenta sin migrar, TAREA 14) no hace nada — sin
// empresa no hay a qué cotización agrupar (mismo criterio de canAccessCase
// para cuentas legacy).
async function attachCaseToDraftQuote(caseData, systemUser = { uid: 'sistema', email: 'sistema' }) {
  if (!caseData.orgId) return null;

  const categoriaPrecio = resolverCategoriaPrecio(caseData);
  const { honorariosFarmazed, tasasOficiales } = await tarifarioDe(categoriaPrecio);
  const nuevaLinea = {
    caseId: caseData.id, caseCode: caseData.caseCode,
    tipo: 'principal', // TAREA 28: distingue de la línea extra de "prioridad_innovadores" (mismo caseId).
    categoriaPrecio,
    tarifarioHonorarios: honorariosFarmazed, tarifarioTasas: tasasOficiales,
    honorariosFarmazed, tasasOficiales, monto: honorariosFarmazed + tasasOficiales,
    ajustado: false, motivoAjuste: null,
    // TAREA 23 (§H.8, Pagos): de esto depende qué CONCEPTOS exige el gate de
    // fase_05 (transitions.js) — mef solo si es extranjero, iea solo si
    // aplica (y con qué modalidad). Por defecto false/null — el admin los
    // marca a mano en la cotización (PATCH /lineas/:caseId), no se infieren
    // del wizard (el caso no trae ese dato hoy).
    esExtranjero: false, aplicaIEA: false, modalidadIEA: null,
  };
  const lineaExtra = await lineaPrioridadInnovadores(caseData);
  const lineasNuevas = lineaExtra ? [nuevaLinea, lineaExtra] : [nuevaLinea];

  const existente = await db().collection('quotes')
    .where('orgId', '==', caseData.orgId)
    .where('estado', '==', 'borrador')
    .limit(1)
    .get();

  const now = admin.firestore.Timestamp.now();
  const histEntry = { tipo: 'linea_agregada', caseId: caseData.id, por: systemUser.uid, porEmail: systemUser.email, at: now };

  if (existente.empty) {
    const ref = await db().collection('quotes').add({
      orgId: caseData.orgId,
      caseIds: [caseData.id],
      lineas: lineasNuevas,
      total: recomputeTotal(lineasNuevas),
      estado: 'borrador',
      historial: [histEntry],
      createdAt: now, updatedAt: now,
    });
    return ref.id;
  }

  const doc = existente.docs[0];
  const data = doc.data();
  if (data.caseIds.includes(caseData.id)) return doc.id; // ya estaba (reintento idempotente)

  const lineas = [...data.lineas, ...lineasNuevas];
  await doc.ref.update({
    caseIds: [...data.caseIds, caseData.id],
    lineas,
    total: recomputeTotal(lineas),
    historial: admin.firestore.FieldValue.arrayUnion(histEntry),
    updatedAt: now,
  });
  return doc.id;
}

/**
 * ¿Este caso tiene una cotización 'aceptada' que lo incluya? Gate de
 * fase_04 -> fase_05 (mismo patrón que hasRequiredPayment en payments.js).
 */
async function hasAcceptedQuote(caseId) {
  const snap = await db().collection('quotes')
    .where('caseIds', 'array-contains', caseId)
    .where('estado', '==', 'aceptada')
    .limit(1)
    .get();
  return !snap.empty;
}

function describeQuoteGate() {
  return 'cotización aceptada que incluya este caso';
}

/**
 * La línea de ESTE caso dentro de su cotización 'aceptada' — trae
 * esExtranjero/aplicaIEA/modalidadIEA, que usa el gate de fase_05
 * (transitions.js) para saber qué conceptos de pago exigir. `null` si no
 * hay cotización aceptada para el caso (mismo criterio que hasAcceptedQuote
 * — el gate de fase_04->05 ya debió haber bloqueado eso antes; si llegó
 * aquí sin cotización fue por un override).
 */
async function getAcceptedQuoteLineForCase(caseId) {
  const snap = await db().collection('quotes')
    .where('caseIds', 'array-contains', caseId)
    .where('estado', '==', 'aceptada')
    .limit(1)
    .get();
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  // TAREA 28: un caso puede tener 2 líneas (principal + "prioridad
  // innovadores", mismo caseId) — esta función es para los gates de pago/
  // checklist (aplicaIEA/esExtranjero), que viven en la línea PRINCIPAL.
  return data.lineas.find(l => l.caseId === caseId && (l.tipo || 'principal') === 'principal') || null;
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
    const { honorariosFarmazed, tasasOficiales, motivo, esExtranjero, aplicaIEA, modalidadIEA } = req.body;
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

router.resolverCategoriaPrecio       = resolverCategoriaPrecio;
router.attachCaseToDraftQuote        = attachCaseToDraftQuote;
router.hasAcceptedQuote              = hasAcceptedQuote;
router.describeQuoteGate             = describeQuoteGate;
router.getAcceptedQuoteLineForCase   = getAcceptedQuoteLineForCase;

module.exports = router;

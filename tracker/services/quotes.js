/**
 * quotes.js (servicio) — TAREA 41. La lógica de NEGOCIO de las cotizaciones:
 * resolución de la categoría de precio, tarifario, borrador automático al
 * entrar a fase_04, y las consultas que usan los gates de transición. Antes
 * vivía dentro de `routes/quotes.js` (colgada de `router.xxx = ...`) y
 * `services/transitions.js`/`routes/mcp.js` hacían `require('../routes/quotes')`.
 * Las rutas ahora son finas y dependen de esto, nunca al revés.
 */
const admin = require('../utils/firebase_admin.js');
const { desglose, desgloseConceptos } = require('../utils/pricing_desglose');

const db = () => admin.firestore();

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

const CONCEPTOS_VACIO = { honorarios: 0, tasa_dnfd: 0, mef: 0, iea: 0 };

// TAREA 33 (§H.14): además de los 2 buckets de siempre, el desglose POR
// CONCEPTO (honorarios/tasa_dnfd/mef/iea) — lo necesita el pago por PayPal
// para crear los registros de `payments.js` que el gate de fase_05 ya
// sabe leer (`hasConceptPayment`), sin los cuales Farmazed no podría saber
// cuánto emitir a cada autoridad de un cargo que llegó junto.
//
// TAREA 41: SIN categoría (`null`) = el trámite no tiene tarifa a propósito ("ruta no
// tarifada", el admin completa la línea a mano — ver arriba): línea en cero. PERO si la
// categoría SÍ se resolvió y su fila de precio no existe (o no trae componentes), eso es
// un dato faltante, no un precio de cero: lanza un error explícito en vez de generar
// una cotización de $0 que parezca legítima.
async function tarifarioDe(categoriaPrecio) {
  if (!categoriaPrecio) return { honorariosFarmazed: 0, tasasOficiales: 0, conceptos: { ...CONCEPTOS_VACIO } };
  const snap = await db().collection('pricing').doc(categoriaPrecio).get();
  if (!snap.exists) throw new Error(`Falta la fila de precio "${categoriaPrecio}" en el tarifario (colección pricing): no se puede cotizar este caso.`);
  const components = snap.data().components;
  if (!components || typeof components !== 'object' || Object.keys(components).length === 0) {
    throw new Error(`La fila de precio "${categoriaPrecio}" no tiene componentes: no se puede cotizar este caso.`);
  }
  return { ...desglose(components), conceptos: desgloseConceptos(components) };
}

function recomputeTotal(lineas) {
  return lineas.reduce((s, l) => s + (Number(l.monto) || 0), 0);
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
  // TAREA 33: todo el monto de esta línea extra se trata como "honorarios"
  // para el reparto por concepto del pago — es un cargo adicional de
  // Farmazed, no una tasa oficial propia (y Zelky ya avisó que sus "tasas"
  // podrían duplicar las de la línea principal — no tiene sentido
  // repartirlas a DNFD/IEA/MEF dos veces).
  const montoTotal = honorariosFarmazed + tasasOficiales;
  return {
    caseId: caseData.id, caseCode: caseData.caseCode,
    tipo: 'prioridad_innovadores',
    categoriaPrecio: 'med_abreviado_prioridad_innovadores_24sep',
    tarifarioHonorarios: honorariosFarmazed, tarifarioTasas: tasasOficiales,
    honorariosFarmazed, tasasOficiales, monto: montoTotal,
    tarifarioConceptos: { honorarios: montoTotal, tasa_dnfd: 0, mef: 0, iea: 0 },
    conceptos:          { honorarios: montoTotal, tasa_dnfd: 0, mef: 0, iea: 0 },
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
async function armarBorrador(caseData, systemUser, lineaExtra) {
  if (!caseData.orgId) return null;

  const categoriaPrecio = resolverCategoriaPrecio(caseData);
  const { honorariosFarmazed, tasasOficiales, conceptos } = await tarifarioDe(categoriaPrecio);
  const nuevaLinea = {
    caseId: caseData.id, caseCode: caseData.caseCode,
    tipo: 'principal', // TAREA 28: distingue de la línea extra de "prioridad_innovadores" (mismo caseId).
    categoriaPrecio,
    tarifarioHonorarios: honorariosFarmazed, tarifarioTasas: tasasOficiales,
    honorariosFarmazed, tasasOficiales, monto: honorariosFarmazed + tasasOficiales,
    // TAREA 33 (§H.14): desglose por concepto (honorarios/tasa_dnfd/mef/iea)
    // — lo usa el pago por PayPal para crear los registros de payments.js
    // por concepto. `tarifarioConceptos` queda CONGELADO (igual que
    // tarifarioHonorarios/tarifarioTasas); `conceptos` es el efectivo, que
    // el admin puede pisar a mano en el PATCH de abajo si ajusta montos —
    // si no lo hace explícito, sigue igual al congelado.
    tarifarioConceptos: conceptos, conceptos,
    ajustado: false, motivoAjuste: null,
    // TAREA 23 (§H.8, Pagos): de esto depende qué CONCEPTOS exige el gate de
    // fase_05 (transitions.js) — mef solo si es extranjero, iea solo si
    // aplica (y con qué modalidad). Por defecto false/null — el admin los
    // marca a mano en la cotización (PATCH /lineas/:caseId), no se infieren
    // del wizard (el caso no trae ese dato hoy).
    esExtranjero: false, aplicaIEA: false, modalidadIEA: null,
  };
  const lineasNuevas = lineaExtra ? [nuevaLinea, lineaExtra] : [nuevaLinea];

  const now = admin.firestore.Timestamp.now();
  const histEntry = { tipo: 'linea_agregada', caseId: caseData.id, por: systemUser.uid, porEmail: systemUser.email, at: now };

  // TAREA 43: buscar el borrador y escribir en UNA transacción. Dos casos de la misma empresa que
  // salen de fase_03 a la vez ya no crean dos borradores ni se pisan la línea (el segundo reintenta
  // sobre lo que dejó el primero).
  return db().runTransaction(async (t) => {
    const existente = await t.get(db().collection('quotes')
      .where('orgId', '==', caseData.orgId)
      .where('estado', '==', 'borrador')
      .limit(1));

    if (existente.empty) {
      const ref = db().collection('quotes').doc();
      t.set(ref, {
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
    t.update(doc.ref, {
      caseIds: [...data.caseIds, caseData.id],
      lineas,
      total: recomputeTotal(lineas),
      historial: admin.firestore.FieldValue.arrayUnion(histEntry),
      updatedAt: now,
    });
    return doc.id;
  });
}

// TAREA 41: la línea EXTRA de "prioridad innovadores" no puede tumbar la principal. Si su fila de
// precio falta, la línea principal igual se agrega al borrador y DESPUÉS se avisa (lanza) con el
// motivo específico — así el staff sabe qué falta, sin perder la línea que sí estaba bien.
async function attachCaseToDraftQuote(caseData, systemUser = { uid: 'sistema', email: 'sistema' }) {
  let lineaExtra = null, errorExtra = null;
  try { lineaExtra = await lineaPrioridadInnovadores(caseData); } catch (e) { errorExtra = e; }
  const id = await armarBorrador(caseData, systemUser, lineaExtra);
  if (errorExtra) throw new Error(`la línea principal quedó en el borrador, pero falló la línea de prioridad innovadores: ${errorExtra.message}`);
  return id;
}

// `t` (opcional): transacción de applyTransition — los gates leen bajo el mismo bloqueo que escribe.
const consultaAceptada = (caseId, t) => {
  const consulta = db().collection('quotes')
    .where('caseIds', 'array-contains', caseId)
    .where('estado', '==', 'aceptada')
    .limit(1);
  return t ? t.get(consulta) : consulta.get();
};

/**
 * ¿Este caso tiene una cotización 'aceptada' que lo incluya? Gate de
 * fase_04 -> fase_05 (mismo patrón que hasRequiredPayment en payments.js).
 */
async function hasAcceptedQuote(caseId, t = null) {
  const snap = await consultaAceptada(caseId, t);
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
async function getAcceptedQuoteLineForCase(caseId, t = null) {
  const snap = await consultaAceptada(caseId, t);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  // TAREA 28: un caso puede tener 2 líneas (principal + "prioridad
  // innovadores", mismo caseId) — esta función es para los gates de pago/
  // checklist (aplicaIEA/esExtranjero), que viven en la línea PRINCIPAL.
  return data.lineas.find(l => l.caseId === caseId && (l.tipo || 'principal') === 'principal') || null;
}


module.exports = {
  resolverCategoriaPrecio, tarifarioDe, recomputeTotal,
  attachCaseToDraftQuote, hasAcceptedQuote, describeQuoteGate, getAcceptedQuoteLineForCase,
};

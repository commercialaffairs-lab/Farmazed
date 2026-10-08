/**
 * payments_ledger.js — TAREA 41. El LIBRO de pagos de un caso (cases/{id}/payments):
 * las constantes del modelo de pagos y las dos operaciones que usan los gates y
 * las capturas de PayPal. Antes vivían colgadas de `routes/payments.js`
 * (`router.hasConceptPayment = ...`) y `services/transitions.js` hacía
 * `require('../routes/payments')`: la lógica de negocio dependía de una ruta.
 * Ahora las rutas son finas y dependen de este servicio, nunca al revés.
 */
const { randomUUID: uuid } = require('node:crypto');
const admin        = require('../utils/firebase_admin.js');

const db = () => admin.firestore();

const TIPOS_PAGO = ['cliente_a_farmazed', 'farmazed_a_autoridad'];
const AUTORIDADES = ['DNFD', 'IEA', 'CNF', 'MEF'];

// TAREA 23 (§H.8, parte Pagos): cada pago cliente_a_farmazed lleva un
// concepto — reemplaza el campo `fase` de TAREA 21/22 (fase_05/fase_13 ya
// no describían nada real: "fase_13" es hoy "Seguimiento post-ingreso", sin
// relación con pagos). `honorarios_saldo` es informativo — se muestra como
// "saldo pendiente" pero ningún gate lo exige (instrucción explícita: "El
// saldo de honorarios se registra ... pero NO bloquea").
const CONCEPTOS_CLIENTE = ['honorarios', 'tasa_dnfd', 'mef', 'iea', 'honorarios_saldo'];

// Montos oficiales — solo de referencia para la UI (el admin registra el
// monto real del cheque, que puede diferir; nunca se valida contra esto).
// `iea` depende de la modalidad (regular/expedita) de la línea de
// cotización del caso, así que no tiene un solo monto fijo aquí.
const MONTOS_REFERENCIA = {
  tasa_dnfd: 200,
  mef: 25,
  iea_regular: 1500,
  iea_expedita: 2250,
};

/**
 * ¿Este caso tiene al menos un pago cliente_a_farmazed con este `concepto`
 * registrado? Bloque mínimo que usa `transitions.js` para armar el gate de
 * fase_05 concepto por concepto (qué concepto es obligatorio depende de la
 * línea de cotización del caso — esExtranjero/aplicaIEA — así que esa
 * decisión vive en transitions.js, no aquí).
 */
// `t` (opcional): la transacción de applyTransition — así el gate lee bajo el mismo bloqueo que escribe.
async function hasConceptPayment(caseId, concepto, t = null) {
  const consulta = db()
    .collection('cases').doc(caseId)
    .collection('payments')
    .where('tipo', '==', 'cliente_a_farmazed')
    .where('concepto', '==', concepto)
    .limit(1);
  const snap = await (t ? t.get(consulta) : consulta.get());
  return !snap.empty;
}

/**
 * TAREA 33 (§H.14): registra un pago `cliente_a_farmazed` SIN comprobante
 * manual — lo usa la captura de PayPal (tracker/routes/quotes.js, /pago/capturar) para
 * crear, por cada concepto que el gate de fase_05 exige, el mismo tipo de
 * registro que ya entiende `hasConceptPayment()`. No pasa por el endpoint
 * HTTP de arriba (que exige `comprobante` — registro MANUAL, otro flujo) ni
 * por `requirePermission` (quien llama ya decidió el permiso: aquí solo
 * hay que acertar la forma del documento).
 */
async function createConceptPayment(caseId, { concepto, monto, origen, paypalOrderId, registradoPor, registradoPorEmail, paymentId: idFijo, batch }) {
  if (!CONCEPTOS_CLIENTE.includes(concepto)) {
    throw new Error(`createConceptPayment: concepto inválido "${concepto}"`);
  }
  // TAREA 38: `paymentId` determinista (orderId_caseId_concepto) + `batch` para
  // escribirlos junto con el estado 'capturada' de la cotización, atómico y
  // sin duplicados en un reintento. Sin ellos, igual que antes (uuid, set directo).
  // TAREA 41: nada de `Number(monto) || 0` (un NaN/undefined se volvía un pago de $0 que
  // igual satisfacía el gate): el monto es un número finito >= 0 o es un error.
  const montoNum = Number(monto);
  if (typeof monto !== 'number' || !Number.isFinite(montoNum) || montoNum < 0) throw new Error(`createConceptPayment: monto inválido "${monto}"`);
  const paymentId = idFijo || uuid();
  const now = admin.firestore.Timestamp.now();
  const paymentData = {
    tipo: 'cliente_a_farmazed',
    autoridad: null,
    concepto,
    monto: montoNum,
    fecha: now,
    comprobanteDocId: null, comprobantePath: null, comprobanteFileName: null,
    origen: origen || 'paypal', paypalOrderId: paypalOrderId || null,
    registradoPor, registradoPorEmail,
    createdAt: now,
  };
  const pagoRef = db().collection('cases').doc(caseId).collection('payments').doc(paymentId);
  if (batch) batch.set(pagoRef, paymentData);
  else await pagoRef.set(paymentData);
  return { id: paymentId, ...paymentData };
}

module.exports = { TIPOS_PAGO, AUTORIDADES, CONCEPTOS_CLIENTE, MONTOS_REFERENCIA, hasConceptPayment, createConceptPayment };

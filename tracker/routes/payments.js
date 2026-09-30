/**
 * payments.js — D12 (organizacion/03_INSTRUCCIONES_DEV.md fila D12, Parte
 * C.9; conectado a la máquina de estados en TAREA 11; rehecho por CONCEPTO
 * en TAREA 23, PM_COMMENTS §H.8 parte Pagos — reemplaza el modelo por
 * `fase` de TAREA 21/22).
 *
 * Modelo de los DOS eventos de pago distintos de un expediente — son cosas
 * diferentes con dueños distintos, no una sola "cuenta":
 *   - `cliente_a_farmazed`: el cliente le paga a Farmazed. Cada registro
 *     lleva un `concepto` (ver CONCEPTOS_CLIENTE) — cheques separados son
 *     registros separados, un pago de "honorarios" NO sirve para satisfacer
 *     el de "tasa_dnfd", ni viceversa. `honorarios_saldo` se registra y se
 *     muestra como "saldo pendiente" pero NO bloquea ningún gate (instrucción
 *     explícita del PM).
 *   - `farmazed_a_autoridad`: Farmazed le paga a una autoridad oficial
 *     (DNFD/IEA/CNF/MEF) las tasas del trámite — comprobante interno del
 *     dossier (15.17/15.1/16.1.1, responsable Farmazed), no un concepto del
 *     cliente.
 *
 * Registro MANUAL — sin pasarela (Parte H, supuesto explícito). El admin
 * sube un comprobante real (reusa services/storage.js, igual que
 * documents.js) al registrar el pago; el cliente solo puede leer.
 *
 * Mounts on the main Express app (index.js):
 *   const paymentsRouter = require('./routes/payments');
 *   app.use('/api/cases/:caseId/payments', paymentsRouter);
 *
 * Endpoints:
 *   GET  /                → lista de pagos del caso (admin: todos; cliente: los suyos)
 *   POST /                → registrar un pago (admin only), multipart con `comprobante`
 *
 * También exporta `hasConceptPayment(caseId, concepto)`, usado por
 * `tracker/services/transitions.js` para armar el gate de fase_05 (que
 * concepto exige depende de la línea de cotización aceptada del caso —
 * esExtranjero/aplicaIEA, ver quotes.js — por eso ese gate vive en
 * transitions.js y no aquí, igual que el resto de gates centralizados en
 * TAREA 22).
 */

const { Router }   = require('express');
const multer        = require('multer');
const { v4: uuid }  = require('uuid');
const admin         = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { uploadFile } = require('../services/storage');
const { serializeTimestamps } = require('../utils/serialize');
const { canAccessCase, requirePermission } = require('../middleware/permissions');

const router = Router({ mergeParams: true }); // mergeParams to access :caseId
const db     = () => admin.firestore();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 52 * 1024 * 1024 },
});

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

async function getCaseOrFail(caseId, user, res) {
  const snap = await db().collection('cases').doc(caseId).get();
  if (!snap.exists) { res.status(404).json({ error: 'Case not found' }); return null; }
  const data = snap.data();
  if (!canAccessCase(user, data)) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return { id: snap.id, ...data };
}

// ─── GET /api/cases/:caseId/payments ─────────────────────────────────────────
router.get('/', requireAuth, requirePermission('payments.read'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const snap = await db()
      .collection('cases').doc(req.params.caseId)
      .collection('payments')
      .orderBy('fecha', 'desc')
      .get();

    const payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(serializeTimestamps({ total: payments.length, payments }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cases/:caseId/payments (admin only) ───────────────────────────
// multipart/form-data: campos tipo, autoridad (solo si tipo=farmazed_a_autoridad),
// fase (solo si tipo=cliente_a_farmazed), monto, fecha (ISO, opcional — default
// ahora), archivo `comprobante`.
router.post('/', requireAuth, requirePermission('payments.create'), upload.single('comprobante'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const { tipo, autoridad, concepto, monto, fecha } = req.body;

    if (!TIPOS_PAGO.includes(tipo)) {
      return res.status(400).json({
        error: `tipo invalido: "${tipo}". Validos: ${TIPOS_PAGO.join(', ')}`,
        validos: TIPOS_PAGO,
      });
    }
    if (tipo === 'farmazed_a_autoridad' && !AUTORIDADES.includes(autoridad)) {
      return res.status(400).json({
        error: `autoridad obligatoria y valida para "farmazed_a_autoridad": "${autoridad || '(vacio)'}". Validas: ${AUTORIDADES.join(', ')}`,
        validas: AUTORIDADES,
      });
    }
    // TAREA 23: cliente_a_farmazed son cheques separados por concepto — sin
    // `concepto` no hay forma de saber cual gate (o "saldo pendiente")
    // satisface.
    if (tipo === 'cliente_a_farmazed' && !CONCEPTOS_CLIENTE.includes(concepto)) {
      return res.status(400).json({
        error: `concepto obligatorio y valido para "cliente_a_farmazed": "${concepto || '(vacio)'}". Validos: ${CONCEPTOS_CLIENTE.join(', ')}`,
        validos: CONCEPTOS_CLIENTE,
      });
    }
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) {
      return res.status(400).json({ error: 'monto es obligatorio y debe ser un numero positivo' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'comprobante (archivo) es obligatorio — registro manual, sin pasarela' });
    }

    const paymentId = uuid();
    const { storagePath, signedUrl } = await uploadFile(
      req.params.caseId,
      `payment-${paymentId}`,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype
    );

    const now = admin.firestore.Timestamp.now();
    const paymentData = {
      tipo,
      autoridad: tipo === 'farmazed_a_autoridad' ? autoridad : null,
      concepto:  tipo === 'cliente_a_farmazed'   ? concepto  : null,
      monto: montoNum,
      fecha: fecha ? admin.firestore.Timestamp.fromDate(new Date(fecha)) : now,
      comprobanteDocId: paymentId,
      comprobantePath: storagePath,
      comprobanteFileName: req.file.originalname,
      registradoPor: req.user.uid,
      registradoPorEmail: req.user.email,
      createdAt: now,
    };

    await db()
      .collection('cases').doc(req.params.caseId)
      .collection('payments').doc(paymentId).set(paymentData);

    res.status(201).json(serializeTimestamps({ id: paymentId, ...paymentData, comprobanteUrl: signedUrl }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * ¿Este caso tiene al menos un pago cliente_a_farmazed con este `concepto`
 * registrado? Bloque mínimo que usa `transitions.js` para armar el gate de
 * fase_05 concepto por concepto (qué concepto es obligatorio depende de la
 * línea de cotización del caso — esExtranjero/aplicaIEA — así que esa
 * decisión vive en transitions.js, no aquí).
 */
async function hasConceptPayment(caseId, concepto) {
  const snap = await db()
    .collection('cases').doc(caseId)
    .collection('payments')
    .where('tipo', '==', 'cliente_a_farmazed')
    .where('concepto', '==', concepto)
    .limit(1)
    .get();
  return !snap.empty;
}

router.hasConceptPayment  = hasConceptPayment;
router.TIPOS_PAGO         = TIPOS_PAGO;
router.AUTORIDADES        = AUTORIDADES;
router.CONCEPTOS_CLIENTE  = CONCEPTOS_CLIENTE;
router.MONTOS_REFERENCIA  = MONTOS_REFERENCIA;

module.exports = router;

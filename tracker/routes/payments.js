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
 * La lógica del libro de pagos (`hasConceptPayment`, `createConceptPayment`, las constantes del
 * modelo) vive en `tracker/services/payments_ledger.js` (TAREA 41): este archivo es solo la ruta.
 */

const { Router }   = require('express');
const multer        = require('multer');
const { randomUUID: uuid } = require('node:crypto');
const admin         = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { uploadFile, deleteFile } = require('../services/storage');
const { serializeTimestamps } = require('../utils/serialize');
const { getCaseOrFail, requirePermission } = require('../middleware/permissions');
const { TIPOS_PAGO, AUTORIDADES, CONCEPTOS_CLIENTE } = require('../services/payments_ledger');

const router = Router({ mergeParams: true }); // mergeParams to access :caseId
const db     = () => admin.firestore();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 52 * 1024 * 1024 },
});

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
    // TAREA 41: monto finito y > 0 (antes `!montoNum` dejaba pasar Infinity y un string
    // raro dependía de la coerción), y fecha válida — TODO se valida ANTES de subir nada a Storage.
    const montoNum = typeof monto === 'string' ? Number(monto.trim()) : Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'monto es obligatorio y debe ser un numero finito mayor que 0' });
    }
    const fechaDate = fecha ? new Date(fecha) : null;
    if (fechaDate && Number.isNaN(fechaDate.getTime())) {
      return res.status(400).json({ error: 'fecha invalida: usar una fecha ISO (p. ej. 2026-10-04)' });
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
      fecha: fechaDate ? admin.firestore.Timestamp.fromDate(fechaDate) : now,
      comprobanteDocId: paymentId,
      comprobantePath: storagePath,
      comprobanteFileName: req.file.originalname,
      registradoPor: req.user.uid,
      registradoPorEmail: req.user.email,
      createdAt: now,
    };

    try {
      await db()
        .collection('cases').doc(req.params.caseId)
        .collection('payments').doc(paymentId).set(paymentData);
    } catch (e) {
      // El registro no se pudo guardar: no se deja el comprobante huérfano en Storage.
      await deleteFile(storagePath).catch(err => console.error('[payments] no se pudo borrar el comprobante huérfano', { storagePath, error: err.message }));
      throw e;
    }

    res.status(201).json(serializeTimestamps({ id: paymentId, ...paymentData, comprobanteUrl: signedUrl }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

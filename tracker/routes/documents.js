const { Router }   = require('express');
const multer        = require('multer');
const admin         = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { uploadFile, getSignedUrl, deleteFile } = require('../services/storage');
const { isValidDocStatus, DOC_STATUSES, PENDING_DOCS } = require('../data/case_status');
const { serializeTimestamps } = require('../utils/serialize');
const { solicitarDocumento } = require('../services/document_requests');
const { effectiveRole, getCaseOrFail, requirePermission } = require('../middleware/permissions');
const { countPdfPages } = require('../utils/pdf_pages');
const { LIMITE_PAGINAS, IEA_DOC_IDS } = require('../data/paquete_iea');

const router  = Router({ mergeParams: true }); // mergeParams to access :caseId
const db      = () => admin.firestore();
const upload  = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 52 * 1024 * 1024 }, // 52 MB (slightly above 50 MB limit)
});

// ─── GET /api/cases/:caseId/documents ────────────────────────────────────────
router.get('/', requireAuth, requirePermission('documents.read'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const snap = await db()
      .collection('cases').doc(req.params.caseId)
      .collection('documents')
      .orderBy('uploadedAt', 'desc')
      .get();

    const docs = snap.docs.map(d => {
      const data = d.data();
      return {
        id:           d.id,
        faddiDocId:   data.faddiDocId,
        faddiCode:    data.faddiCode,
        faddiDocName: data.faddiDocName,
        faddiStep:    data.faddiStep,
        fileName:     data.fileName,
        fileSize:     data.fileSize,
        mimeType:     data.mimeType,
        status:       data.status,
        reviewNotes:  data.reviewNotes,
        uploadedAt:   data.uploadedAt,
        uploadedBy:   data.uploadedBy,
        version:      data.version || 1,
        pageCount:    data.pageCount ?? null,
      };
    });

    res.json(serializeTimestamps({ total: docs.length, documents: docs }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cases/:caseId/documents ───────────────────────────────────────
// Accepts multipart/form-data with fields: faddiDocId, faddiCode, faddiDocName, faddiStep
router.post('/', requireAuth, requirePermission('documents.upload'), upload.single('file'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { faddiDocId, faddiCode, faddiDocName, faddiStep } = req.body;
    if (!faddiDocId) return res.status(400).json({ error: 'faddiDocId is required' });

    // TAREA 13: un solo registro VISIBLE por faddiDocId. Si ya existe uno
    // para este caso (el placeholder 'requested' que crea
    // POST /documents/request al pedirle algo al cliente, o un 'rejected'
    // anterior), esta subida lo REEMPLAZA en el mismo doc — no crea uno
    // nuevo. Sin esto, dos filas con el mismo faddiDocId hacían que el admin
    // viera la MÁS VIEJA: GET /documents ordena por uploadedAt desc, y el
    // map que arma admin/expediente.html (`docsById[d.faddiDocId] = d`) se
    // queda con la ÚLTIMA iterada, que en orden "desc" es la más antigua.
    //
    // Ajuste de cumplimiento (Rick, 29-sep): "reemplazar" no puede significar
    // "perder" — un documento rechazado y su reemplazo deben quedar
    // trazables. Antes de sobrescribir, la versión ANTERIOR (si había una
    // real, no un placeholder de 'requested' sin archivo) se archiva en la
    // subcolección `versions` del mismo doc, con su storagePath intacto — el
    // archivo viejo NUNCA se borra de Storage (subir a un docId de Storage
    // distinto por versión evita pisarlo: uploadFile() usa `${docId}` como
    // nombre de objeto, así que aquí se le pasa `${docId}-v${version}`).
    const docsCol = db().collection('cases').doc(req.params.caseId).collection('documents');
    const existingSnap  = await docsCol.where('faddiDocId', '==', faddiDocId).limit(1).get();
    const docRef         = existingSnap.empty ? docsCol.doc() : existingSnap.docs[0].ref;
    const docId           = docRef.id;
    const previousData   = existingSnap.empty ? null : existingSnap.docs[0].data();
    const hadRealFile     = previousData && previousData.storagePath; // no el placeholder vacío de 'requested'
    const version         = hadRealFile ? (previousData.version || 1) + 1 : 1;

    const { gcsPath, signedUrl, storagePath } = await uploadFile(
      req.params.caseId,
      `${docId}-v${version}`,
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype
    );

    const now = admin.firestore.Timestamp.now();

    // R13 (TAREA 19): cuenta páginas si es un PDF — null si no lo es o no se
    // pudo leer (nunca bloquea la subida por esto, ver utils/pdf_pages.js).
    const pageCount = req.file.mimetype === 'application/pdf'
      ? await countPdfPages(req.file.buffer)
      : null;

    if (hadRealFile) {
      await docRef.collection('versions').add({
        storagePath:  previousData.storagePath,
        gcsPath:      previousData.gcsPath || '',
        fileName:     previousData.fileName,
        fileSize:     previousData.fileSize,
        mimeType:     previousData.mimeType,
        status:       previousData.status,           // el status que tenía al ser reemplazado
        reviewNotes:  previousData.reviewNotes || '', // motivo de rechazo, si lo hubo
        reviewedBy:   previousData.reviewedBy || null,
        reviewedAt:   previousData.reviewedAt || null,
        uploadedBy:   previousData.uploadedBy,
        uploadedAt:   previousData.uploadedAt,
        version:      previousData.version || 1,
        archivedAt:   now,
        archivedBy:   req.user.uid,
      });
    }

    const docData = {
      faddiDocId,
      faddiCode:    faddiCode    || '',
      faddiDocName: faddiDocName || '',
      faddiStep:    parseInt(faddiStep, 10) || 0,
      fileName:     req.file.originalname,
      fileSize:     req.file.size,
      mimeType:     req.file.mimetype,
      storagePath,
      gcsPath,
      pageCount,
      status:       'uploaded',
      reviewNotes:  '',
      reviewedBy:   null,
      reviewedAt:   null,
      uploadedAt:   now,
      uploadedBy:   req.user.uid,
      version,
    };

    await docRef.set(docData); // set (no merge) — reemplaza el placeholder/version anterior en el doc VISIBLE; lo archivado ya quedó en versions/

    // Update case updatedAt
    await db().collection('cases').doc(req.params.caseId).update({
      updatedAt: now
    });

    res.status(201).json(serializeTimestamps({
      id: docId,
      ...docData,
      signedUrl,
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cases/:caseId/documents/request (admin only) ──────────────────
// Flag a document as required from the client. Updates the matching document
// to status "requested" if one already exists, or creates a placeholder entry.
router.post('/request', requireAuth, requirePermission('documents.request'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const { faddiDocId, message } = req.body;
    if (!faddiDocId) return res.status(400).json({ error: 'faddiDocId is required' });

    // TAREA 22 (ajuste PM sobre TAREA 21): entrar a pending_docs pasa por los
    // MISMOS gates que cualquier otra transición (checkTransition). TAREA 39:
    // esa lógica vive en services/document_requests.js y la comparte el MCP;
    // `override`/`reason` en el body, solo-admin, igual que en cases.js.
    const override = effectiveRole(req.user) === 'admin' && req.body.override === true;
    const r = await solicitarDocumento({
      caseId: req.params.caseId, caseData, faddiDocId, message, override, reason: req.body.reason,
      actor: { uid: req.user.uid, email: req.user.email, revisor: req.user.email },
    });
    if (!r.ok) return res.status(r.status).json({ error: r.error, from: caseData.status, to: PENDING_DOCS });

    res.json({ requested: true, faddiDocId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cases/:caseId/documents/paquete-iea (R13, TAREA 19) ────────────
// Suma las páginas de los documentos que van al paquete IEA (ver
// data/paquete_iea.js) ya subidos — cuenta y advierte, NUNCA bloquea. Debe
// montarse ANTES de GET /:docId (si no, Express toma "paquete-iea" como
// valor de :docId).
router.get('/paquete-iea', requireAuth, requirePermission('documents.read'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const snap = await db()
      .collection('cases').doc(req.params.caseId)
      .collection('documents').get();

    const documentos = snap.docs
      .map(d => d.data())
      .filter(d => IEA_DOC_IDS.includes(d.faddiDocId) && typeof d.pageCount === 'number')
      .map(d => ({ faddiDocId: d.faddiDocId, faddiDocName: d.faddiDocName, fileName: d.fileName, pageCount: d.pageCount }));

    const totalPaginas = documentos.reduce((s, d) => s + d.pageCount, 0);

    res.json({
      limite: LIMITE_PAGINAS,
      totalPaginas,
      excedido: totalPaginas > LIMITE_PAGINAS,
      documentos,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cases/:caseId/documents/:docId ─────────────────────────────────
// Returns document metadata + a fresh signed URL
router.get('/:docId', requireAuth, requirePermission('documents.read'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const snap = await db()
      .collection('cases').doc(req.params.caseId)
      .collection('documents').doc(req.params.docId).get();

    if (!snap.exists) return res.status(404).json({ error: 'Document not found' });

    const data      = snap.data();
    const signedUrl = await getSignedUrl(data.storagePath);

    res.json(serializeTimestamps({
      id: snap.id,
      ...data,
      signedUrl,
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cases/:caseId/documents/:docId/versions ────────────────────────
// Versiones ANTERIORES (archivadas) de un documento — la vigente se ve en
// GET /:docId. Más nueva primero, con signed URL fresca cada una.
router.get('/:docId/versions', requireAuth, requirePermission('documents.read'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const snap = await db()
      .collection('cases').doc(req.params.caseId)
      .collection('documents').doc(req.params.docId)
      .collection('versions')
      .orderBy('archivedAt', 'desc')
      .get();

    const versions = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      const signedUrl = data.storagePath ? await getSignedUrl(data.storagePath) : null;
      return { id: d.id, ...data, signedUrl };
    }));

    res.json(serializeTimestamps({ total: versions.length, versions }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/cases/:caseId/documents/:docId (admin only) ──────────────────
// Update status (uploaded|reviewing|approved|rejected) and review notes
router.patch('/:docId', requireAuth, requirePermission('documents.review'), async (req, res) => {
  try {
    // TAREA 39: antes no había chequeo por caso — cualquier staff (también uno NO
    // asignado a este caso) podía aprobar/rechazar sus documentos.
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const ref = db()
      .collection('cases').doc(req.params.caseId)
      .collection('documents').doc(req.params.docId);

    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Document not found' });

    // D05b/D06 (07 §4#7): status de documento debe ser uno de los validos.
    if (req.body.status && !isValidDocStatus(req.body.status)) {
      return res.status(400).json({
        error: `status invalido: "${req.body.status}". Validos: ${DOC_STATUSES.join(', ')}`,
        validos: DOC_STATUSES,
      });
    }

    const update = {
      ...(req.body.status      && { status: req.body.status }),
      ...(req.body.reviewNotes !== undefined && { reviewNotes: req.body.reviewNotes }),
      reviewedBy: req.user.email,
      reviewedAt: admin.firestore.Timestamp.now(),
    };

    await ref.update(update);
    res.json(serializeTimestamps({ id: req.params.docId, ...update }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/cases/:caseId/documents/:docId ──────────────────────────────
router.delete('/:docId', requireAuth, requirePermission('documents.delete'), async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const ref  = db().collection('cases').doc(req.params.caseId).collection('documents').doc(req.params.docId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Document not found' });

    // Only owner or admin can delete
    if (effectiveRole(req.user) !== 'admin' && snap.data().uploadedBy !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await deleteFile(snap.data().storagePath);
    await ref.delete();

    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

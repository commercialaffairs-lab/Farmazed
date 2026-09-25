const { Router }  = require('express');
const { v4: uuid } = require('uuid');
const admin         = require('firebase-admin');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getChecklist } = require('../data/faddi_checklists');
const { rechazoTramite } = require('../data/tramites_habilitados');

const router = Router();
const db     = () => admin.firestore();

// ─── Case codes (Gap 2, PM decision 2026-08-26) ──────────────────────────────
// Scheme: FZ-{TIPO}-{SUBTIPO}-{AÑO}-{SECUENCIA}. SUBTIPO only for medicamentos.
// SECUENCIA is a global consecutive, 4 digits, incremented atomically via a
// Firestore transaction on meta/counters.caseSequence. Immutable once assigned.
const TIPO_ABBR = {
  medicamentos: 'MED', cosmeticos: 'COS', higienicos: 'HIG',
  plaguicidas: 'PLAG', excepcion: 'EXC', publicidad: 'PUB',
};
const SUBTIPO_ABBR = {
  'Regular': 'REG', 'Abreviado': 'ABR',
  'Reconocimiento Mutuo': 'REC', 'Reconocimiento WLA': 'WLA',
};

async function generateCaseCode(tramiteType, tipoRegistro) {
  const counterRef = db().collection('meta').doc('counters');
  const seq = await db().runTransaction(async (tx) => {
    const snap    = await tx.get(counterRef);
    const current = snap.exists ? (snap.data().caseSequence || 0) : 0;
    const next    = current + 1;
    tx.set(counterRef, { caseSequence: next }, { merge: true });
    return next;
  });

  const tipo    = TIPO_ABBR[tramiteType] || tramiteType.toUpperCase().slice(0, 3);
  const subtipo = tramiteType === 'medicamentos' ? (SUBTIPO_ABBR[tipoRegistro] || null) : null;
  const year    = new Date().getFullYear();
  const seqStr  = String(seq).padStart(4, '0');

  return `FZ-${tipo}${subtipo ? '-' + subtipo : ''}-${year}-${seqStr}`;
}

// ─── GET /api/cases ─────────────────────────────────────────────────────────
// Admin: all cases. Client: own cases only.
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = db().collection('cases').orderBy('createdAt', 'desc');

    if (!req.user.admin) {
      query = query.where('clientId', '==', req.user.uid);
    }

    // Optional filters
    if (req.query.status)       query = query.where('status', '==', req.query.status);
    if (req.query.tramiteType)  query = query.where('tramiteType', '==', req.query.tramiteType);
    if (req.query.assignedTo)   query = query.where('assignedTo', '==', req.query.assignedTo);

    const snap  = await query.limit(200).get();
    const cases = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, productName: data.product?.nombreComercial || '(sin nombre de producto)' };
    });
    res.json({ total: cases.length, cases });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cases ─────────────────────────────────────────────────────────
// Client creates a new case.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { tramiteType, tipoSolicitud, tipoRegistro, tipoMedicamento, product, entities } = req.body;

    if (!tramiteType) return res.status(400).json({ error: 'tramiteType is required' });
    // F-6: rechazar antes de generateCaseCode, que consume el contador global.
    const rechazo = rechazoTramite(tramiteType);
    if (rechazo) return res.status(rechazo.status).json(rechazo.body);

    const now      = admin.firestore.Timestamp.now();
    const caseCode = await generateCaseCode(tramiteType, tipoRegistro || 'Regular');
    const caseData = {
      createdAt:      now,
      updatedAt:      now,
      status:         'draft',
      caseCode,
      vencimiento:    null,
      tramiteType,
      tipoSolicitud:  tipoSolicitud  || 'Nuevo Registro',
      tipoRegistro:   tipoRegistro   || 'Regular',
      tipoMedicamento: tipoMedicamento || [],
      product:        product   || {},
      entities:       entities  || {},
      monografia:     {},
      clientId:       req.user.uid,
      clientEmail:    req.user.email,
      clientName:     req.user.name || req.user.email,
      assignedTo:     null,
      priority:       'normal',
      notes:          '',
      faddi:          {},
    };

    const ref = await db().collection('cases').add(caseData);
    res.status(201).json({ id: ref.id, ...caseData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cases/:id ──────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const snap = await db().collection('cases').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    // Client can only see their own cases
    if (!req.user.admin && data.clientId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Include dynamic checklist
    const checklist = getChecklist(data.tramiteType, {
      tipoRegistro:    data.tipoRegistro,
      tipoMedicamento: data.tipoMedicamento,
    });

    res.json({ id: snap.id, ...data, checklist });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/cases/:id ─────────────────────────────────────────────────────
// Update fields — client can update product/entities/monografia while in draft.
// Admin can update any field including status.
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    // F-6: tramiteType no es editable aquí; si viene, debe ser uno habilitado
    // (antes se ignoraba en silencio).
    if (req.body.tramiteType !== undefined) {
      const rechazo = rechazoTramite(req.body.tramiteType);
      if (rechazo) return res.status(rechazo.status).json(rechazo.body);
    }

    const snap = await db().collection('cases').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    if (!req.user.admin && data.clientId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Clients can only update in draft status
    if (!req.user.admin && data.status !== 'draft') {
      return res.status(400).json({ error: 'Case is no longer in draft — contact Farmazed to make changes' });
    }

    // Allowed fields per role
    // vencimiento (Gap 1, PM decision 2026-08-26): admin-only — Farmazed fills it
    // manually on FADDI approval notification, there's no automated source for it.
    const ADMIN_FIELDS  = ['status', 'assignedTo', 'priority', 'notes', 'faddi', 'product', 'entities', 'monografia', 'tipoSolicitud', 'tipoRegistro', 'tipoMedicamento', 'vencimiento'];
    const CLIENT_FIELDS = ['product', 'entities', 'monografia', 'tipoSolicitud', 'tipoRegistro', 'tipoMedicamento'];
    const allowed       = req.user.admin ? ADMIN_FIELDS : CLIENT_FIELDS;

    const update = { updatedAt: admin.firestore.Timestamp.now() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    // Clients may not set arbitrary status values — only submit their own draft.
    if (!req.user.admin && req.body.status !== undefined) {
      if (req.body.status !== 'submitted') {
        return res.status(400).json({ error: 'Clients may only set status to "submitted"' });
      }
      update.status = 'submitted';
    }

    // vencimiento arrives as an ISO date string from the client JSON body —
    // store it as a proper Firestore Timestamp (or null to clear it).
    if (update.vencimiento !== undefined) {
      update.vencimiento = update.vencimiento === null
        ? null
        : admin.firestore.Timestamp.fromDate(new Date(update.vencimiento));
    }

    await db().collection('cases').doc(req.params.id).update(update);
    res.json({ id: req.params.id, ...update });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/cases/:id (soft delete, admin only) ─────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db().collection('cases').doc(req.params.id).update({
      status:    'deleted',
      updatedAt: admin.firestore.Timestamp.now(),
    });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cases/:id/checklist ────────────────────────────────────────────
// Returns the dynamic checklist for a case (with upload status per document).
router.get('/:id/checklist', requireAuth, async (req, res) => {
  try {
    const snap = await db().collection('cases').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    if (!req.user.admin && data.clientId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get uploaded docs
    const docsSnap = await db()
      .collection('cases').doc(req.params.id)
      .collection('documents').get();

    const uploadedIds = new Set(docsSnap.docs.map(d => d.data().faddiDocId));

    const checklist = getChecklist(data.tramiteType, {
      tipoRegistro:    data.tipoRegistro,
      tipoMedicamento: data.tipoMedicamento,
    });

    const enriched = checklist.map(item => ({
      ...item,
      uploaded: uploadedIds.has(item.id),
    }));

    const total    = enriched.length;
    const uploaded = enriched.filter(i => i.uploaded).length;

    res.json({
      caseId:     req.params.id,
      tramiteType: data.tramiteType,
      progress:   { uploaded, total, percent: Math.round((uploaded / total) * 100) },
      checklist:  enriched,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

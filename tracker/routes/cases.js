const { Router }  = require('express');
const { v4: uuid } = require('uuid');
const admin         = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { getChecklist } = require('../data/faddi_checklists');
const { rechazoTramite } = require('../data/tramites_habilitados');
const { isValidStatus, CASE_STATUSES } = require('../data/case_status');
const { serializeTimestamps } = require('../utils/serialize');
const { checkTransition, computeSideEffects, afterTransition } = require('../services/transitions');
const { getAcceptedQuoteLineForCase } = require('./quotes');
const { effectiveRole, canAccessCase, canTransitionCase, requirePermission, can, PERMISSIONS, CLIENT_ROLES, STAFF_ROLES } = require('../middleware/permissions');

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
router.get('/', requireAuth, requirePermission('cases.list'), async (req, res) => {
  try {
    let query = db().collection('cases').orderBy('createdAt', 'desc');

    // E3/§H.4: admin ve todo; cliente ve los de su empresa (o los suyos por
    // clientId si la cuenta todavia no tiene orgId — compat con cuentas sin
    // migrar); staff (analista/abogado/regente) solo los que tiene asignados.
    const role = effectiveRole(req.user);
    if (role === 'admin') {
      // sin filtro
    } else if (CLIENT_ROLES.includes(role)) {
      query = req.user.orgId
        ? query.where('orgId', '==', req.user.orgId)
        : query.where('clientId', '==', req.user.uid);
    } else if (STAFF_ROLES.includes(role)) {
      query = query.where(`asignados.${role}`, '==', req.user.uid);
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
    res.json(serializeTimestamps({ total: cases.length, cases }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cases ─────────────────────────────────────────────────────────
// Client creates a new case.
router.post('/', requireAuth, requirePermission('cases.create'), async (req, res) => {
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
      // E3/§H.4: el caso pertenece a la EMPRESA (orgId), no a quien lo creó
      // — así un cliente_miembro y el cliente_titular de la misma empresa
      // ven el mismo caso. null en cuentas sin migrar (compat, ver
      // canAccessCase() en middleware/permissions.js).
      orgId:          req.user.orgId || null,
      assignedTo:     null,
      asignados:      { analista: null, abogado: null, regente: null },
      priority:       'normal',
      notes:          '',
      faddi:          {},
    };

    const ref = await db().collection('cases').add(caseData);
    res.status(201).json(serializeTimestamps({ id: ref.id, ...caseData }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cases/:id ──────────────────────────────────────────────────────
router.get('/:id', requireAuth, requirePermission('cases.read'), async (req, res) => {
  try {
    const snap = await db().collection('cases').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    if (!canAccessCase(req.user, data)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Include dynamic checklist
    const linea = await getAcceptedQuoteLineForCase(req.params.id);
    const checklist = getChecklist(data.tramiteType, {
      tipoRegistro:    data.tipoRegistro,
      tipoMedicamento: data.tipoMedicamento,
      aplicaIEA:       linea?.aplicaIEA,
      esInnovador:     data.esInnovador,
    });

    res.json(serializeTimestamps({ id: snap.id, ...data, checklist }));
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
    if (!canAccessCase(req.user, data)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // E3/§H.4: 3 grupos de campos editables — admin (todo), cliente (datos
    // del caso mientras está en borrador), staff (solo status/notas, y el
    // status con el gate de canTransitionCase() más abajo).
    const role     = effectiveRole(req.user);
    const isAdmin  = role === 'admin';
    const isClient = CLIENT_ROLES.includes(role);
    const isStaff  = STAFF_ROLES.includes(role);

    // Clients can only update in draft status
    if (isClient && data.status !== 'draft') {
      return res.status(400).json({ error: 'Case is no longer in draft — contact Farmazed to make changes' });
    }

    // Allowed fields per role
    // vencimiento (Gap 1, PM decision 2026-08-26): admin-only — Farmazed fills it
    // manually on FADDI approval notification, there's no automated source for it.
    // asignados (E3): a quién ve el caso el staff — solo el admin lo toca
    // (cases.assign en la tabla de permisos).
    // esInnovador (TAREA 26, §H.9-2 sobre la auditoría checklist vs
    // matrices): lo confirma Farmazed en fase_03, junto con vía/categoría —
    // Zelky también lo usa en precios ("Prioridad ... innovadores").
    const ADMIN_FIELDS  = ['status', 'assignedTo', 'asignados', 'priority', 'notes', 'faddi', 'product', 'entities', 'monografia', 'tipoSolicitud', 'tipoRegistro', 'tipoMedicamento', 'esInnovador', 'vencimiento'];
    const CLIENT_FIELDS = ['product', 'entities', 'monografia', 'tipoSolicitud', 'tipoRegistro', 'tipoMedicamento'];
    // TAREA 16(b): faddi tracking y notas internas son de staff+admin, nunca
    // del cliente — ya estaban en ADMIN_FIELDS; faltaba en STAFF_FIELDS
    // (cases.edit_faddi/cases.edit_notes en la tabla de permisos).
    // TAREA 26: tipoRegistro/tipoMedicamento/esInnovador — antes el staff NO
    // podía tocarlos (solo cliente en borrador, o admin) pese a que fase_03
    // ("Tipo de registro sanitario y ruta de registro", §H.8) es
    // responsabilidad de Farmazed, no del cliente (cases.edit_via_categoria
    // en la tabla de permisos).
    const STAFF_FIELDS  = ['status', 'notes', 'faddi', 'tipoRegistro', 'tipoMedicamento', 'esInnovador'];
    const allowed        = isAdmin ? ADMIN_FIELDS : isStaff ? STAFF_FIELDS : CLIENT_FIELDS;

    const update = { updatedAt: admin.firestore.Timestamp.now() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    // Clients may not set arbitrary status values — only submit their own draft.
    if (isClient && req.body.status !== undefined) {
      if (req.body.status !== 'submitted') {
        return res.status(400).json({ error: 'Clients may only set status to "submitted"' });
      }
      update.status = 'submitted';
    }

    // D06/D06b (07 §4#8): status debe ser uno de los 18 valores validos,
    // para admin y cliente por igual — el bloque de arriba ya obliga al
    // cliente a 'submitted' (siempre valido); esto cierra el hueco del lado
    // admin, que hasta ahora aceptaba cualquier string.
    if (update.status !== undefined && !isValidStatus(update.status)) {
      return res.status(400).json({
        error: `status invalido: "${update.status}". Validos: ${CASE_STATUSES.join(', ')}`,
        validos: CASE_STATUSES,
      });
    }

    // §H.1/§H.8: valida el SALTO, no solo que el valor exista. `override:true`
    // (solo admin — un cliente nunca llega aqui con un status fuera de
    // 'submitted', ver arriba) fuerza el salto y queda en
    // cases/{id}/statusHistory para auditoria.
    const override = isAdmin && req.body.override === true;
    const isRealTransition = update.status !== undefined
      && (update.status !== data.status || (update.status === 'fase_08' && data.status === 'fase_08'));

    let gateResult = { ok: true, gatesSaltados: [], transitionValid: true, isFase8Recycle: false };

    if (isRealTransition) {
      // TAREA 22 (ajuste PM sobre TAREA 21): TODOS los gates de negocio
      // (transición válida, pago, cotización, cerrado, confirmaciones de
      // fase_08) viven en tracker/services/transitions.js — ni cases.js ni
      // mcp.js repiten esta lógica (antes mcp.js le faltaban dos gates
      // completos, un hueco de cumplimiento real).
      gateResult = await checkTransition(data, req.params.id, update.status, { override, reason: req.body.reason });
      if (!gateResult.ok) {
        return res.status(gateResult.status).json({
          error: gateResult.error, from: data.status, to: update.status,
          ...(gateResult.pagoRequerido ? { pagoRequerido: gateResult.pagoRequerido } : {}),
        });
      }

      // E3/§H.4, actualizado §H.8: dentro de staff, el analista mueve TODO
      // el status (incluidas fase_08 y fase_10, los dos puntos de control) —
      // abogado/regente ya no mueven status directamente, solo registran su
      // confirmación de fase_08 (POST /confirmaciones/fase8, ver abajo). El
      // admin no pasa por aquí (ya puede cualquier salto válido u override).
      // Esto SÍ sigue siendo propio de REST (permiso por ROL) — MCP no
      // tiene el concepto, por eso no vive en checkTransition().
      if (isStaff && !canTransitionCase(role, data.status)) {
        return res.status(403).json({
          error: `Rol "${role}" no puede mover el caso fuera de "${data.status}" — esa confirmación es de otro rol.`,
          from: data.status,
        });
      }

      Object.assign(update, computeSideEffects(data, update.status, gateResult.isFase8Recycle));
    }

    // vencimiento arrives as an ISO date string from the client JSON body —
    // store it as a proper Firestore Timestamp (or null to clear it).
    if (update.vencimiento !== undefined) {
      update.vencimiento = update.vencimiento === null
        ? null
        : admin.firestore.Timestamp.fromDate(new Date(update.vencimiento));
    }

    await db().collection('cases').doc(req.params.id).update(update);

    if (isRealTransition) {
      const isOverride = gateResult.gatesSaltados.length > 0 && override;
      // El motivo de cierre (fase_04 -> cerrado) se registra igual que un
      // override, aunque no lo sea — es la única transición normal que
      // exige `reason`.
      const registrarMotivo = isOverride || update.status === 'cerrado';
      await db().collection('cases').doc(req.params.id).collection('statusHistory').add({
        from: data.status, to: update.status,
        override: isOverride,
        reason: registrarMotivo ? (req.body.reason || '') : null,
        by: req.user.uid, byEmail: req.user.email,
        at: admin.firestore.Timestamp.now(),
      });

      await afterTransition(req.params.id, data, update.status, { uid: req.user.uid, email: req.user.email });
    }

    res.json(serializeTimestamps({ id: req.params.id, ...update }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/cases/:id (soft delete, admin only) ─────────────────────────
router.delete('/:id', requireAuth, requirePermission('cases.delete'), async (req, res) => {
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

// ─── GET /api/cases/:id/history (D18) ────────────────────────────────────────
// Historial de transiciones de status (cases/{id}/statusHistory), mas nuevo
// primero. Mismo control de acceso que el resto: admin ve cualquiera, cliente
// solo el suyo.
router.get('/:id/history', requireAuth, requirePermission('cases.read_history'), async (req, res) => {
  try {
    const snap = await db().collection('cases').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    if (!canAccessCase(req.user, data)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const histSnap = await db()
      .collection('cases').doc(req.params.id)
      .collection('statusHistory')
      .orderBy('at', 'desc')
      .get();

    const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    res.json(serializeTimestamps({ total: history.length, history }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/cases/:id/checklist ────────────────────────────────────────────
// Returns the dynamic checklist for a case (with upload status per document).
router.get('/:id/checklist', requireAuth, requirePermission('cases.read_checklist'), async (req, res) => {
  try {
    const snap = await db().collection('cases').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    if (!canAccessCase(req.user, data)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get uploaded docs
    const docsSnap = await db()
      .collection('cases').doc(req.params.id)
      .collection('documents').get();

    const uploadedIds = new Set(docsSnap.docs.map(d => d.data().faddiDocId));

    const linea = await getAcceptedQuoteLineForCase(req.params.id);
    const checklist = getChecklist(data.tramiteType, {
      tipoRegistro:    data.tipoRegistro,
      tipoMedicamento: data.tipoMedicamento,
      aplicaIEA:       linea?.aplicaIEA,
      esInnovador:     data.esInnovador,
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

// ─── POST /api/cases/:id/confirmaciones/fase8 (§H.8, TAREA 21) ───────────────
// Registra UNA de las dos confirmaciones que exige la fase 8 antes de poder
// avanzar a fase_09 — 'legal' (abogado) o 'tecnica' (regente). No cambia el
// status del caso; solo el gate de la transición fase_08->fase_09 (arriba en
// el PATCH) las exige a ambas. canAccessCase() ya obliga a que sea EL
// abogado/regente asignado a este caso (o admin) el que confirme.
router.post('/:id/confirmaciones/fase8', requireAuth, async (req, res) => {
  try {
    const snap = await db().collection('cases').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    if (!canAccessCase(req.user, data)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { tipo } = req.body;
    if (!['legal', 'tecnica'].includes(tipo)) {
      return res.status(400).json({ error: `tipo inválido: "${tipo}". Válidos: legal, tecnica` });
    }

    const permName = tipo === 'legal' ? 'cases.confirm_8_legal' : 'cases.confirm_8_tecnica';
    const role = effectiveRole(req.user);
    if (!can(role, permName)) {
      return res.status(403).json({ error: `Rol "${role}" no puede: ${PERMISSIONS[permName].label}` });
    }

    if (data.status !== 'fase_08') {
      return res.status(400).json({ error: `El caso no está en fase_08 (está en "${data.status}") — la confirmación solo aplica ahí.` });
    }

    const now = admin.firestore.Timestamp.now();
    const confirmacion = { by: req.user.uid, byEmail: req.user.email, at: now };
    const confirmacionesFase8 = { ...(data.confirmacionesFase8 || {}), [tipo]: confirmacion };

    await db().collection('cases').doc(req.params.id).update({ confirmacionesFase8, updatedAt: now });
    await db().collection('cases').doc(req.params.id).collection('confirmacionesFase8Log').add({ tipo, ...confirmacion });

    res.json(serializeTimestamps({ confirmacionesFase8 }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

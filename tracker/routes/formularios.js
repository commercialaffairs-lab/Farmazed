/**
 * formularios.js (routes) — R14, TAREA 17.
 *
 * Endpoints:
 *   GET /api/formularios              → biblioteca completa (los 13), para el admin.
 *   GET /api/cases/:caseId/formularios → solo los que aplican a ESTE caso
 *     (+ los `por_confirmar`, nunca ocultados), para el cliente.
 *
 * Los archivos .docx en sí (`farmazed-web/formularios/*.docx`) se sirven
 * como estáticos públicos — son plantillas en blanco, sin datos de ningún
 * cliente, así que no necesitan signed URL ni control de acceso por caso
 * (a diferencia de un documento YA subido, que sí es de alguien).
 */

const { Router } = require('express');
const admin       = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, canAccessCase } = require('../middleware/permissions');
const { FORMULARIOS, getFormulariosParaCaso } = require('../data/formularios');

const router = Router();
const casosRouter = Router({ mergeParams: true }); // mounted at /api/cases/:caseId/formularios
const db = () => admin.firestore();

// ─── GET /api/formularios (biblioteca completa) ──────────────────────────────
router.get('/', requireAuth, requirePermission('formularios.read'), (req, res) => {
  res.json({ total: FORMULARIOS.length, formularios: FORMULARIOS });
});

// ─── GET /api/cases/:caseId/formularios (filtrados por el caso) ─────────────
casosRouter.get('/', requireAuth, requirePermission('formularios.read'), async (req, res) => {
  try {
    const snap = await db().collection('cases').doc(req.params.caseId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });

    const data = snap.data();
    if (!canAccessCase(req.user, data)) return res.status(403).json({ error: 'Forbidden' });

    res.json(getFormulariosParaCaso(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { biblioteca: router, porCaso: casosRouter };

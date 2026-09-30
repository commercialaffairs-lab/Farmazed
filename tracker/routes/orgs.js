/**
 * orgs.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Colección `orgs`: una empresa cliente. `cases.orgId` (no `clientId`) es lo
 * que decide qué casos ve un cliente — un caso pertenece a la EMPRESA, no a
 * la persona que lo creó (R7: "empresa con varios usuarios").
 *
 * Alta normal de una empresa: POST /api/invitations/titular (admin) crea la
 * empresa Y la invitación juntas — este archivo solo expone lectura/edición
 * directa para el admin (gestión, no alta).
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');

const router = Router();
const db     = () => admin.firestore();

// ─── GET /api/orgs (admin) ────────────────────────────────────────────────────
router.get('/', requireAuth, requirePermission('orgs.manage'), async (req, res) => {
  try {
    const snap = await db().collection('orgs').orderBy('createdAt', 'desc').get();
    const orgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(serializeTimestamps({ total: orgs.length, orgs }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/orgs (admin) ───────────────────────────────────────────────────
// Uso directo (sin invitación) — p.ej. para pruebas o alta manual del admin.
router.post('/', requireAuth, requirePermission('orgs.manage'), async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre is required' });

    const now = admin.firestore.Timestamp.now();
    const orgData = { nombre, createdAt: now, createdBy: req.user.uid };
    const ref = await db().collection('orgs').add(orgData);

    res.status(201).json(serializeTimestamps({ id: ref.id, ...orgData }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/orgs/:orgId/members (admin) ────────────────────────────────────
// El propio titular/miembro usa GET /api/me/org para ver los suyos — esta es
// la vista del admin sobre CUALQUIER empresa (gestión de empresas y
// empleados, TAREA 15).
router.get('/:orgId/members', requireAuth, requirePermission('orgs.manage'), async (req, res) => {
  try {
    const orgSnap = await db().collection('orgs').doc(req.params.orgId).get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });

    const usersResult = await admin.auth().listUsers(1000);
    const members = usersResult.users
      .filter(u => u.customClaims?.orgId === req.params.orgId)
      .map(u => ({ uid: u.uid, email: u.email, displayName: u.displayName || u.email, role: u.customClaims?.role }));

    res.json(serializeTimestamps({ id: orgSnap.id, ...orgSnap.data(), members }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

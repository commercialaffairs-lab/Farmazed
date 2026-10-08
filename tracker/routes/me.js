/**
 * me.js — E3 parte 2 (UI), PM_COMMENTS §H.4.
 *
 * "Quién soy y qué puedo hacer" — para que el FRONT nunca repita la tabla de
 * middleware/permissions.js con sus propios ifs de rol. admin/bandeja.html,
 * admin/expediente.html y client-dashboard.html (módulo "Mi Empresa") leen
 * de aquí en vez de hardcodear reglas.
 */

const { Router } = require('express');
const admin       = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { effectiveRole, permissionsForRole, requirePermission, CLIENT_ROLES } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');

const router = Router();
const db     = () => admin.firestore();

// ─── GET /api/me/permissions ──────────────────────────────────────────────────
router.get('/permissions', requireAuth, (req, res) => {
  const role = effectiveRole(req.user);
  res.json({
    role,
    orgId: req.user.orgId || null,
    email: req.user.email,
    permissions: permissionsForRole(role),
  });
});

// ─── GET /api/me/org (cliente_titular, cliente_miembro) ───────────────────────
// Empresa propia + sus miembros + invitaciones pendientes (solo el titular
// las necesita, pero no cuesta nada devolverlas a ambos — orgs.read_members
// ya es el permiso de "ver miembros", no de "invitar").
router.get('/org', requireAuth, requirePermission('orgs.read_members'), async (req, res) => {
  try {
    const role = effectiveRole(req.user);
    if (!CLIENT_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Esta ruta es para cuentas de cliente (cliente_titular/cliente_miembro).' });
    }
    if (!req.user.orgId) {
      return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });
    }

    const orgSnap = await db().collection('orgs').doc(req.user.orgId).get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });

    const usersResult = await admin.auth().listUsers(1000);
    const members = usersResult.users
      .filter(u => u.customClaims?.orgId === req.user.orgId)
      .map(u => ({ uid: u.uid, email: u.email, displayName: u.displayName || u.email, role: u.customClaims?.role }));

    let invitations = [];
    if (role === 'cliente_titular') {
      const invSnap = await db().collection('invitations').where('orgId', '==', req.user.orgId).get();
      invitations = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    res.json(serializeTimestamps({ id: orgSnap.id, ...orgSnap.data(), members, invitations }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

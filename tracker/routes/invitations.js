/**
 * invitations.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Alta por invitación (supuesto explícito: SIN registro abierto — la página
 * de registro libre no se construye, decisión de Rick 29-sep). Tres rutas de
 * invitación, cada una con quién puede invitar a quién:
 *
 *   admin        → titular   (crea la empresa + el primer usuario de ella)
 *   admin        → empleado  (analista/abogado/regente/admin)
 *   cliente_titular → miembro (de su PROPIA empresa, nunca de otra)
 *
 * Cada invitación es de un solo uso: `POST /:token/accept` la consume y
 * asigna los custom claims — no hay UI todavía (Sin UI todavía, ver
 * PM_COMMENTS §H.4); `accept` se llama con el uid de una cuenta de Firebase
 * Auth que la persona invitada ya tiene (o que se creó por otro medio) — la
 * página que junte "crear cuenta" + "aceptar invitación" es trabajo de
 * frontend, fuera de esta tarea.
 */

const { Router } = require('express');
const crypto       = require('crypto');
const admin         = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, ROLES } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');

const router = Router();
const db     = () => admin.firestore();

const EMPLEADO_ROLES = ['analista', 'abogado', 'regente', 'admin'];

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function createInvitation({ email, role, orgId, invitedBy }) {
  const now   = admin.firestore.Timestamp.now();
  const token = newToken();
  const data  = {
    email, role, orgId: orgId || null,
    token, used: false, usedAt: null, usedByUid: null,
    invitedBy, createdAt: now,
  };
  const ref = await db().collection('invitations').doc(token).set(data);
  return { id: token, ...data };
}

// ─── POST /api/invitations/titular (admin) ────────────────────────────────────
// Crea la empresa Y la invitación del primer usuario (titular) de una vez.
router.post('/titular', requireAuth, requirePermission('invitations.create_org'), async (req, res) => {
  try {
    const { email, orgName } = req.body;
    if (!email)   return res.status(400).json({ error: 'email is required' });
    if (!orgName) return res.status(400).json({ error: 'orgName is required' });

    const now = admin.firestore.Timestamp.now();
    const orgRef = await db().collection('orgs').add({ nombre: orgName, createdAt: now, createdBy: req.user.uid });

    const invite = await createInvitation({ email, role: 'cliente_titular', orgId: orgRef.id, invitedBy: req.user.uid });
    res.status(201).json(serializeTimestamps({ ...invite, orgId: orgRef.id }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/invitations/empleado (admin) ───────────────────────────────────
router.post('/empleado', requireAuth, requirePermission('invitations.create_empleado'), async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (!EMPLEADO_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role invalido: "${role}". Validos: ${EMPLEADO_ROLES.join(', ')}`,
        validos: EMPLEADO_ROLES,
      });
    }

    const invite = await createInvitation({ email, role, orgId: null, invitedBy: req.user.uid });
    res.status(201).json(serializeTimestamps(invite));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/invitations/miembro (cliente_titular) ──────────────────────────
// Solo puede invitar a SU PROPIA empresa — nunca a otra, ni siquiera un
// titular malicioso puede mandar un orgId ajeno porque no se lee del body.
router.post('/miembro', requireAuth, requirePermission('invitations.create_miembro'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada (orgId) — contacta a Farmazed.' });

    const invite = await createInvitation({ email, role: 'cliente_miembro', orgId: req.user.orgId, invitedBy: req.user.uid });
    res.status(201).json(serializeTimestamps(invite));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/invitations/:token (público) ────────────────────────────────────
// Lookup para la página pública de aceptar invitación (TAREA 15) — antes de
// pedirle una contraseña a la persona, la página necesita saber a qué email
// corresponde el link y si ya se usó. Sin requireAuth: quien todavía no
// tiene cuenta no puede mandar un token de Firebase.
router.get('/:token', async (req, res) => {
  try {
    const snap = await db().collection('invitations').doc(req.params.token).get();
    if (!snap.exists) return res.status(404).json({ error: 'Invitación no encontrada' });

    const { email, role, orgId, used } = snap.data();
    res.json({ email, role, orgId, used });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/invitations/:token/accept ──────────────────────────────────────
// Body: { uid } — el uid de Firebase Auth de quien acepta. Sin requireAuth
// propio a propósito: quien acepta puede no tener sesión todavía (es su
// primera vez) — el "de un solo uso" del token ES el control de seguridad.
router.post('/:token/accept', async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid is required' });

    const ref  = db().collection('invitations').doc(req.params.token);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Invitación no encontrada' });

    const invite = snap.data();
    if (invite.used) return res.status(409).json({ error: 'Esta invitación ya fue usada' });

    await admin.auth().setCustomUserClaims(uid, {
      role: invite.role,
      ...(invite.orgId ? { orgId: invite.orgId } : {}),
      // El claim legacy `admin` se mantiene en paralelo solo para el caso
      // role:'admin' — requireAdmin() acepta cualquiera de los dos.
      ...(invite.role === 'admin' ? { admin: true } : {}),
    });

    const now = admin.firestore.Timestamp.now();
    await ref.update({ used: true, usedAt: now, usedByUid: uid });

    res.json({ accepted: true, role: invite.role, orgId: invite.orgId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/invitations (admin) — visibilidad, sin UI ──────────────────────
router.get('/', requireAuth, requirePermission('invitations.create_empleado'), async (req, res) => {
  try {
    const snap = await db().collection('invitations').orderBy('createdAt', 'desc').get();
    const invitations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(serializeTimestamps({ total: invitations.length, invitations }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

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
const { recorridoCliente } = require('../services/recorrido_cliente');
const { normalizarIdioma } = require('../services/demo_recorrido_textos');

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

// ─── Preferencias de la cuenta (Rick, 01-nov-2026) ─────────────────────────────
// userPrefs/{uid}: { recorridoGuiado: boolean }. Siguen a la persona entre dispositivos; por eso van
// en el tracker y no en localStorage. Solo claves conocidas y del tipo esperado.
const PREFERENCIAS = { recorridoGuiado: 'boolean' };
const PREFERENCIAS_POR_DEFECTO = { recorridoGuiado: false };
const prefsRef = (uid) => db().collection('userPrefs').doc(uid);
const soloConocidas = (datos) => {
  const salida = { ...PREFERENCIAS_POR_DEFECTO };
  for (const k of Object.keys(PREFERENCIAS)) if (datos && k in datos) salida[k] = datos[k];
  return salida;
};

router.get('/preferencias', requireAuth, async (req, res) => {
  try {
    const snap = await prefsRef(req.user.uid).get();
    res.json(soloConocidas(snap.exists ? snap.data() : {}));
  } catch (e) {
    console.error('[me] preferencias', { uid: req.user.uid, error: e.message });
    res.status(500).json({ error: 'No se pudieron leer las preferencias.' });
  }
});

router.put('/preferencias', requireAuth, async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const cambios = {};
  for (const [k, v] of Object.entries(body)) {
    if (!(k in PREFERENCIAS)) return res.status(400).json({ error: `Preferencia desconocida: ${k}` });
    if (typeof v !== PREFERENCIAS[k]) return res.status(400).json({ error: `${k} debe ser ${PREFERENCIAS[k]}.` });
    cambios[k] = v;
  }
  if (!Object.keys(cambios).length) return res.status(400).json({ error: 'No hay preferencias que guardar.' });
  try {
    await prefsRef(req.user.uid).set({ ...cambios, actualizadoEn: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    const snap = await prefsRef(req.user.uid).get();
    res.json(soloConocidas(snap.data()));
  } catch (e) {
    console.error('[me] preferencias', { uid: req.user.uid, error: e.message });
    res.status(500).json({ error: 'No se pudieron guardar las preferencias.' });
  }
});

// ─── GET /api/me/recorrido?idioma=es|en|fr|pt — recorrido guiado de un cliente real ────────────
// El panel del portal lo pide cuando la persona activó el recorrido en "Mi cuenta" (la cuenta demo
// usa /api/demo/recorrido). Progreso deducido de los datos de su empresa (services/recorrido_cliente.js).
router.get('/recorrido', requireAuth, async (req, res) => {
  const role = effectiveRole(req.user);
  if (!CLIENT_ROLES.includes(role)) return res.status(403).json({ error: 'El recorrido guiado es para cuentas de cliente.' });
  if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });
  try {
    res.json(await recorridoCliente(req.user, normalizarIdioma(req.query.idioma)));
  } catch (e) {
    console.error('[me] recorrido', { uid: req.user.uid, error: e.message });
    res.status(500).json({ error: 'No se pudo leer el estado del recorrido.' });
  }
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

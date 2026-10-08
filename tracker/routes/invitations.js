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
 * asigna los custom claims. Desde TAREA 39 exige sesión: aceptar-invitacion.html
 * crea la cuenta (register()) y acepta con ESA sesión; el uid sale del token y
 * el correo de la sesión debe ser el de la invitación.
 */

const { Router } = require('express');
const crypto       = require('crypto');
const admin         = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, ROLES } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { HttpError, responderError } = require('../utils/http_error');
const { textoError, errorPassword, enmascararCorreo } = require('../utils/validar_texto');
const { crearLimitador } = require('../utils/rate_limit');
const { createOrg } = require('../services/orgs');

const router = Router();
const db     = () => admin.firestore();

const EMPLEADO_ROLES = ['analista', 'abogado', 'regente', 'admin'];

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

// TAREA 39c: TODA invitación caduca a los 7 días (sin distinguir personal). Las
// viejas, sin `expiresAt`, se tratan como creadas + 7 días (sin backfill obligatorio).
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;
function expiraEnMs(inv) {
  const t = inv.expiresAt?.toMillis ? inv.expiresAt.toMillis() : (inv.createdAt?.toMillis?.() ?? 0) + VIGENCIA_MS;
  return Number.isFinite(t) ? t : 0; // un dato corrupto falla CERRADO (caducada), nunca "no caduca"
}
const estaCaducada = (inv) => Date.now() > expiraEnMs(inv);
const errorCaducada = () => new HttpError(410, { error: 'Esta invitación caducó (duran 7 días). Pide a Farmazed que te envíe una nueva.' });

async function createInvitation({ email, role, orgId, invitedBy }) {
  const now   = admin.firestore.Timestamp.now();
  const token = newToken();
  const data  = {
    email: String(email).trim().toLowerCase(), role, orgId: orgId || null,
    token, used: false, usedAt: null, usedByUid: null,
    invitedBy, createdAt: now,
    expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + VIGENCIA_MS),
  };
  await db().collection('invitations').doc(token).set(data);
  return { id: token, ...data };
}

// ─── POST /api/invitations/titular (admin) ────────────────────────────────────
// Crea la empresa Y la invitación del primer usuario (titular) de una vez.
router.post('/titular', requireAuth, requirePermission('invitations.create_org'), async (req, res) => {
  try {
    const { email, orgName } = req.body;
    if (!email)   return res.status(400).json({ error: 'email is required' });
    if (!orgName) return res.status(400).json({ error: 'orgName is required' });

    const orgRef = await createOrg({ nombre: orgName, createdBy: req.user.uid });

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

    const inv = snap.data();
    const { email, role, orgId, used } = inv;
    if (!used && estaCaducada(inv)) throw errorCaducada();
    // TAREA 39b: el correo sale enmascarado — el endpoint es público y con el
    // correo completo cualquiera con el token podría intentar suplantarlo.
    res.json({ email: enmascararCorreo(email), role, orgId, used });
  } catch (e) {
    responderError(res, e);
  }
});

// ─── POST /api/invitations/:token/accept ──────────────────────────────────────
// TAREA 39b: el ENLACE de la invitación prueba la propiedad del correo (el token
// solo le llega a quien recibe ese correo), así que hay dos caminos:
//
//  · SIN sesión (quien NO tiene cuenta): body { password, displayName } — el
//    servidor CREA el usuario con el correo de la invitación, `emailVerified:
//    true` y el rol de la invitación. Nadie puede "pre-registrar" ese correo con
//    una contraseña propia: `register.js` rechaza (409) los correos con una
//    invitación vigente. Con límite de intentos por IP.
//  · CON sesión (Bearer; quien YA tiene cuenta con ese correo): TAREA 39 — el uid
//    sale del token (el body se ignora), el correo de la sesión debe ser el de la
//    invitación Y estar VERIFICADO (`email_verified`): una cuenta registrada con el
//    correo ajeno sin verificar no sirve.
//
// En ambos la invitación se consume en una transacción ANTES de otorgar el rol
// (dos aceptaciones en paralelo: 200 + 409) y se devuelve si algo falla antes de
// que el rol se conceda.
const normEmail = (e) => String(e || '').trim().toLowerCase();
const limitadorAceptar = crearLimitador({ ventanaMs: 10 * 60 * 1000, max: 5 });

// Con Authorization -> exige sesión válida; sin él, sigue como "sin cuenta".
const authOpcional = (req, res, next) => (req.headers.authorization ? requireAuth(req, res, next) : next());

// Marca la invitación como usada (transacción). `validar(inv)` lanza HttpError si no aplica.
async function consumirInvitacion(ref, validar = () => {}) {
  return db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw new HttpError(404, { error: 'Invitación no encontrada' });
    const inv = snap.data();
    if (inv.used) throw new HttpError(409, { error: 'Esta invitación ya fue usada' });
    if (estaCaducada(inv)) throw errorCaducada();
    validar(inv);
    t.update(ref, { used: true, usedAt: admin.firestore.Timestamp.now(), usedByUid: null });
    return inv;
  });
}
const devolverInvitacion = (ref) => ref.update({ used: false, usedAt: null, usedByUid: null })
  .catch(err => console.error('[invitations] no se pudo devolver la invitación', { token: ref.id, error: err.message }));

// El rol/org/admin los decide la invitación; el resto de claims se conserva.
function claimsDeInvitacion(invite, previos = {}) {
  const { role: _r, orgId: _o, admin: _a, ...otros } = previos;
  return {
    ...otros,
    role: invite.role,
    ...(invite.orgId ? { orgId: invite.orgId } : {}),
    // El claim legacy `admin` se mantiene en paralelo solo para el caso
    // role:'admin' — requireAdmin() acepta cualquiera de los dos.
    ...(invite.role === 'admin' ? { admin: true } : {}),
  };
}

async function aceptarSinCuenta(req, res) {
  if (limitadorAceptar.estaLimitado(req.ip)) {
    throw new HttpError(429, { error: 'Demasiados intentos desde esta dirección. Intenta de nuevo más tarde.' });
  }
  const { password, displayName } = req.body || {};
  const errorDatos = textoError('El nombre', displayName, 120)
    || errorPassword(password);
  if (errorDatos) throw new HttpError(400, { error: errorDatos });

  const ref = db().collection('invitations').doc(req.params.token);
  const invite = await consumirInvitacion(ref);

  const correo = normEmail(invite.email);
  const datosCuenta = { password, displayName: displayName.trim(), emailVerified: true };
  // Solo estos códigos significan "no se creó nada": ante cualquier otro error
  // (timeout, etc.) el usuario podría existir y NO se reabre la invitación.
  const NO_SE_CREO = ['auth/email-already-exists', 'auth/invalid-password', 'auth/invalid-email'];
  let user, creado = true;
  try {
    user = await admin.auth().createUser({ email: correo, ...datosCuenta });
  } catch (e) {
    if (e.code !== 'auth/email-already-exists') {
      if (NO_SE_CREO.includes(e.code)) await devolverInvitacion(ref);
      throw e.code === 'auth/invalid-password' ? new HttpError(400, { error: 'Contraseña inválida.' }) : e;
    }
    // Ya hay una cuenta con ese correo. Si su correo NO está verificado, nadie
    // probó jamás ser dueño del buzón (p. ej. alguien registró el correo ajeno
    // antes de que existiera la invitación): el ENLACE sí lo prueba, así que la
    // cuenta se toma — contraseña nueva, sesiones anteriores revocadas y sin los
    // claims previos. Si ya está verificada, es de su dueño: debe iniciar sesión.
    const existente = await admin.auth().getUserByEmail(correo);
    if (existente.emailVerified) {
      await devolverInvitacion(ref);
      throw new HttpError(409, { error: 'Ya existe una cuenta con el correo de esta invitación: inicia sesión con ella y acepta desde ahí.', codigo: 'cuenta_existente' });
    }
    try {
      await admin.auth().updateUser(existente.uid, datosCuenta);
      await admin.auth().revokeRefreshTokens(existente.uid);
    } catch (err) {
      await devolverInvitacion(ref); // todavía no se concedió nada
      throw err;
    }
    user = existente;
    creado = false;
  }
  try {
    await admin.auth().setCustomUserClaims(user.uid, claimsDeInvitacion(invite));
  } catch (e) {
    // Solo se devuelve la invitación si se pudo deshacer lo creado; si no, queda
    // gastada y se avisa (un usuario verificado sin claims + invitación vigente
    // sería una toma de cuenta).
    const deshecho = creado
      ? await admin.auth().deleteUser(user.uid).then(() => true).catch(err => {
        console.error('[invitations] no se pudo borrar el usuario a medio crear — limpiar a mano', { uid: user.uid, error: err.message });
        return false;
      })
      : true;
    if (deshecho) await devolverInvitacion(ref);
    throw e;
  }
  await ref.update({ usedByUid: user.uid }).catch(() => {});
  res.status(201).json({ accepted: true, role: invite.role, orgId: invite.orgId, email: correo });
}

async function aceptarConSesion(req, res) {
  if (req.user.email_verified !== true) {
    throw new HttpError(403, { error: 'Verifica tu correo antes de aceptar la invitación (revisa el mensaje de verificación que te envió Farmazed) o usa el enlace sin iniciar sesión si aún no tienes cuenta.' });
  }
  const uid = req.user.uid;
  const ref = db().collection('invitations').doc(req.params.token);
  const invite = await consumirInvitacion(ref, (inv) => {
    if (normEmail(req.user.email) !== normEmail(inv.email)) {
      throw new HttpError(403, { error: 'Esta invitación es para otro correo.' });
    }
  });
  try {
    const { customClaims = {} } = await admin.auth().getUser(uid);
    await admin.auth().setCustomUserClaims(uid, claimsDeInvitacion(invite, customClaims));
  } catch (e) {
    await devolverInvitacion(ref); // el rol no se concedió: la invitación sigue vigente
    throw e;
  }
  await ref.update({ usedByUid: uid }).catch(() => {});
  res.json({ accepted: true, role: invite.role, orgId: invite.orgId });
}

router.post('/:token/accept', authOpcional, async (req, res) => {
  try {
    await (req.user ? aceptarConSesion(req, res) : aceptarSinCuenta(req, res));
  } catch (e) {
    responderError(res, e);
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

// TAREA 34 (§H.15): "Invitar a crear cuenta" sobre un lead del formulario
// de contacto (contact_leads.js) reusa esta misma función — mismo criterio
// que quotes.js/payments.js, que cuelgan helpers del router exportado para
// que otro archivo los reuse sin duplicar lógica.
router.createInvitation = createInvitation;
router.estaCaducada = estaCaducada; // register.js: una invitación caducada no bloquea el registro del correo

module.exports = router;

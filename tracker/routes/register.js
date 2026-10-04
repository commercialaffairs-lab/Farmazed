/**
 * register.js — TAREA 32 (PM_COMMENTS §H.13). Registro ABIERTO de clientes
 * nuevos — Fase 1 de Zelky ("primer contacto por la web"). Reemplaza el
 * supuesto de §H.4 ("sin registro abierto": la invitación seguía siendo la
 * única puerta de entrada) — esa puerta sigue existiendo para miembros de
 * una empresa y para empleados (ver invitations.js), esta es la nueva para
 * un titular que llega solo, sin que nadie de Farmazed lo invite primero.
 *
 * PÚBLICO, sin requireAuth — quien se registra todavía no tiene cuenta. Crea
 * la empresa (`orgs`) Y el usuario `cliente_titular` en un solo paso.
 *
 * El `role` NUNCA viene del body — se fija aquí mismo, siempre
 * 'cliente_titular'. No hay forma de que esta ruta cree un admin/staff ni de
 * que alguien se asigne otro rol mandándolo en el POST: el endpoint
 * simplemente no lee `req.body.role` en ningún punto.
 *
 * Verificación de correo: la cuenta se crea con `emailVerified:false`. El
 * FRONT (ver farmazed-web/registro.html) hace login inmediatamente después
 * con la misma contraseña para obtener una sesión real y disparar
 * `sendEmailVerification()` desde el SDK de cliente (el admin SDK no manda
 * el correo). `portal/js/auth.js` (`requireVerifiedLogin`) bloquea el
 * portal hasta que el link se confirme — en el emulador, el link sale en su
 * consola/UI, nunca se manda un correo real (ver DEV_LOCAL.md).
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { textoError, errorPassword } = require('../utils/validar_texto');
const { crearLimitador } = require('../utils/rate_limit');
const { createOrg } = require('../services/orgs');
const invitaciones = require('./invitations');

const router = Router();
const db     = () => admin.firestore();

// TAREA 34 (§H.15): los 3 botones "Solicitar" del landing mandan a
// registro.html?plan=X — se guarda en la empresa desde el alta misma, para
// que la bienvenida del portal sepa qué mostrar sin un paso aparte. 'consulta'
// por default (el más abierto, $0) si alguien llega sin el parámetro (p.ej.
// por el link "Crear cuenta" de login.html, que no elige plan).
const PLANES = ['consulta', 'registro', 'empresarial'];

// Rate limit por IP: utils/rate_limit.js (TAREA 39) — req.ip (con trust proxy
// en index.js), no el x-forwarded-for crudo que el cliente puede rotar.
const limitador = crearLimitador({ ventanaMs: 10 * 60 * 1000, max: 5 });

// Mismo texto para "ya hay una cuenta" y "hay una invitación pendiente": así este
// endpoint público no sirve para averiguar qué correos tiene Farmazed por invitar.
const MENSAJE_CORREO_EN_USO = 'Ya existe una cuenta o una invitación pendiente para este correo. Si te invitaron, usa el enlace del correo de invitación; si ya tienes cuenta, inicia sesión.';

function validar({ nombre, correo, password, telefono, empresa, pais }) {
  const errorTexto = textoError('El nombre', nombre, 120)
    || textoError('El teléfono', telefono, 40)
    || textoError('El nombre de la empresa', empresa, 120)
    || textoError('El país', pais, 80)
    || textoError('El correo', correo, 254);
  if (errorTexto) return errorTexto;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return 'Correo inválido.';
  return errorPassword(password);
}

// ─── POST /api/register (público) ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  if (limitador.estaLimitado(req.ip)) {
    return res.status(429).json({ error: 'Demasiados intentos de registro desde esta dirección. Intenta de nuevo más tarde.' });
  }

  const errorValidacion = validar(req.body || {});
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  const { password } = req.body;
  const nombre = req.body.nombre.trim(), correo = req.body.correo.trim(), telefono = req.body.telefono.trim();
  const empresa = req.body.empresa.trim(), pais = req.body.pais.trim();
  const plan = PLANES.includes(req.body.plan) ? req.body.plan : 'consulta';

  // TAREA 39b: si ese correo ya tiene una invitación vigente, el registro abierto
  // no puede quedarse con la cuenta ("squatting"): la persona invitada usa su
  // enlace, que crea la cuenta verificada con el rol de la invitación.
  // (una invitación CADUCADA ya no bloquea: el correo vuelve a quedar libre)
  const pendientes = await db().collection('invitations')
    .where('email', '==', correo.toLowerCase()).where('used', '==', false).get();
  if (pendientes.docs.some(d => !invitaciones.estaCaducada(d.data()))) {
    return res.status(409).json({ error: MENSAJE_CORREO_EN_USO });
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: correo, password, displayName: nombre, emailVerified: false,
    });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: MENSAJE_CORREO_EN_USO });
    }
    if (e.code === 'auth/invalid-password' || e.code === 'auth/invalid-email') {
      return res.status(400).json({ error: e.code === 'auth/invalid-email' ? 'Correo inválido.' : 'Contraseña inválida.' });
    }
    return res.status(500).json({ error: e.message });
  }

  let orgRef = null;
  try {
    // auto-registro — nadie de Farmazed la creó (createdBy: null)
    orgRef = await createOrg({ nombre: empresa, pais, telefonoContacto: telefono, plan });

    // Fijo aquí, nunca desde el body — ver nota de arriba. `origen:'registro'`
    // (ajuste del PM) es lo que hace que `requireAuth` (tracker/middleware/
    // auth.js) exija correo verificado para ESTA cuenta — las de
    // invitación/semilla/legacy no llevan este claim, no las afecta.
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'cliente_titular', orgId: orgRef.id, origen: 'registro',
    });

    res.status(201).json({ uid: userRecord.uid, orgId: orgRef.id });
  } catch (e) {
    // TAREA 39 (H4): si falló la empresa o los claims, no se deja una cuenta
    // huérfana (con el correo "ocupado" y sin rol/empresa): se borran el
    // usuario y la empresa a medio crear. El correo queda libre para reintentar.
    console.error('[register] falló el alta, se deshace', { uid: userRecord.uid, orgId: orgRef?.id || null, error: e.message });
    await Promise.all([
      admin.auth().deleteUser(userRecord.uid),
      orgRef ? orgRef.delete() : null,
    ]).catch(err => console.error('[register] no se pudo deshacer el alta — limpiar a mano', { uid: userRecord.uid, orgId: orgRef?.id || null, error: err.message }));
    res.status(500).json({ error: 'No se pudo completar el registro — intenta de nuevo.' });
  }
});

router.limitador = limitador; // para las pruebas en proceso (reset)

module.exports = router;

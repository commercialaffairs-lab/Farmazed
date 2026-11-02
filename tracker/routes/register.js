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
const admin       = require('../utils/firebase_admin.js');
const { textoError, errorPassword } = require('../utils/validar_texto');
const { crearLimitador } = require('../utils/rate_limit');
const { createOrg } = require('../services/orgs');
const { enviarVerificacion, enviarRestablecimiento } = require('../services/correo');
const { requireAuth } = require('../middleware/auth');
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

/**
 * Alta de un cliente_titular con su empresa: usuario de Auth + empresa + claims. Compartida
 * con scripts/seed_clientes.js (misma forma que el registro abierto; cambian `emailVerified`
 * y `origen`). Los errores de createUser se propagan tal cual (`e.code`). Si falla la empresa
 * o los claims (TAREA 39, H4) no queda una cuenta huérfana con el correo "ocupado": se borran
 * el usuario y la empresa a medio crear y se lanza un error con `altaDeshecha:true`.
 */
async function altaTitular({ nombre, correo, password, empresa, pais, telefono, plan, emailVerified, origen }) {
  const userRecord = await admin.auth().createUser({ email: correo, password, displayName: nombre, emailVerified });
  let orgRef = null;
  try {
    // auto-registro — nadie de Farmazed la creó (createdBy: null)
    orgRef = await createOrg({ nombre: empresa, pais, telefonoContacto: telefono, plan });

    // Fijo aquí, nunca desde el body — ver nota de arriba. `origen:'registro'`
    // (ajuste del PM) es lo que hace que `requireAuth` (tracker/middleware/
    // auth.js) exija correo verificado para ESTA cuenta — las de
    // invitación/semilla/legacy no llevan este claim, no las afecta.
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'cliente_titular', orgId: orgRef.id, origen });
    return { userRecord, orgRef };
  } catch (e) {
    console.error('[register] falló el alta, se deshace', { uid: userRecord.uid, orgId: orgRef?.id || null, error: e.message });
    await Promise.all([
      admin.auth().deleteUser(userRecord.uid),
      orgRef ? orgRef.delete() : null,
    ]).catch(err => console.error('[register] no se pudo deshacer el alta — limpiar a mano', { uid: userRecord.uid, orgId: orgRef?.id || null, error: err.message }));
    throw Object.assign(e, { altaDeshecha: true });
  }
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

  let userRecord, orgRef;
  try {
    ({ userRecord, orgRef } = await altaTitular({ nombre, correo, password, empresa, pais, telefono, plan, emailVerified: false, origen: 'registro' }));
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: MENSAJE_CORREO_EN_USO });
    }
    if (e.code === 'auth/invalid-password' || e.code === 'auth/invalid-email') {
      return res.status(400).json({ error: e.code === 'auth/invalid-email' ? 'Correo inválido.' : 'Contraseña inválida.' });
    }
    if (e.altaDeshecha) return res.status(500).json({ error: 'No se pudo completar el registro — intenta de nuevo.' });
    return res.status(500).json({ error: e.message });
  }

  // Correo de verificación de marca (services/correo.js) si hay SMTP; si falla o no hay SMTP,
  // `correoEnviado:false` y el navegador manda el de Firebase (texto plano), como siempre.
  let correoEnviado = false;
  try {
    correoEnviado = await enviarVerificacion({ correo, nombre });
  } catch (err) {
    console.error('[register] no se pudo enviar el correo de verificación de marca; el navegador usará el de Firebase', { uid: userRecord.uid, error: err.message });
  }

  res.status(201).json({ uid: userRecord.uid, orgId: orgRef.id, correoEnviado });
});

router.limitador = limitador; // para las pruebas en proceso (reset)
router.altaTitular = altaTitular;

// "Reenviar correo" manda un email por llamada (SMTP real): tope por uid, no por IP.
const limitadorReenvio = crearLimitador({ ventanaMs: 10 * 60 * 1000, max: 5 });

// ─── POST /api/register/reenviar-verificacion (sesión, cuenta aún sin verificar) ─────
// "Reenviar correo" de verificar-correo.html con la plantilla de marca. Sin SMTP responde
// `correoEnviado:false` y el navegador reenvía el de Firebase. Exento del 403 de "verifica tu
// correo" en middleware/auth.js (EXEMPT_PATHS): es justamente para cuentas sin verificar.
router.post('/reenviar-verificacion', requireAuth, async (req, res) => {
  if (limitadorReenvio.estaLimitado(req.user.uid)) {
    return res.status(429).json({ error: 'Demasiados reenvíos. Espera unos minutos antes de pedir otro correo.' });
  }
  try {
    if (req.user.email_verified) return res.json({ correoEnviado: false, yaVerificado: true });
    const user = await admin.auth().getUser(req.user.uid);
    const correoEnviado = await enviarVerificacion({ correo: user.email, nombre: user.displayName });
    res.json({ correoEnviado });
  } catch (e) {
    console.error('[register] reenviar-verificacion', { uid: req.user?.uid, error: e.message });
    res.status(500).json({ error: 'No se pudo reenviar el correo. Intenta de nuevo en unos minutos.' });
  }
});

// ─── POST /api/register/restablecer (público) — "¿Olvidó su contraseña?" del login ─────────
// Misma respuesta exista o no la cuenta (no sirve para averiguar qué correos tiene Farmazed).
// Sin SMTP responde `correoEnviado:false` y el navegador manda el de Firebase (texto plano).
const limitadorRestablecer = crearLimitador({ ventanaMs: 10 * 60 * 1000, max: 5 });
// Revisión de seguridad (02-nov-2026): además del límite por IP, un enfriamiento por correo (una
// solicitud cada 5 min por instancia) para que nadie bombardee un buzón ajeno; y la respuesta es
// SIEMPRE la misma ({ ok: true }), exista o no la cuenta y se envíe o no el correo, para que el
// endpoint no sirva para averiguar qué correos tiene Farmazed.
const ENFRIAMIENTO_CORREO_MS = 5 * 60 * 1000;
const ultimoRestablecer = new Map(); // correo (minúsculas) → timestamp
router.post('/restablecer', async (req, res) => {
  if (limitadorRestablecer.estaLimitado(req.ip)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes desde esta dirección. Intenta de nuevo más tarde.' });
  }
  const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254) return res.status(400).json({ error: 'Correo inválido.' });
  const clave = correo.toLowerCase();
  const ahora = Date.now();
  if (ahora - (ultimoRestablecer.get(clave) || 0) < ENFRIAMIENTO_CORREO_MS) return res.json({ ok: true });
  ultimoRestablecer.set(clave, ahora);
  if (ultimoRestablecer.size > 5000) for (const [k, t] of ultimoRestablecer) if (ahora - t > ENFRIAMIENTO_CORREO_MS) ultimoRestablecer.delete(k);
  res.json({ ok: true });
  // El envío sigue tras responder: el tiempo de respuesta tampoco delata si la cuenta existe.
  try {
    const user = await admin.auth().getUserByEmail(correo);
    await enviarRestablecimiento({ correo: user.email, nombre: user.displayName });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') console.error('[register] restablecer', { error: e.message });
  }
});

module.exports = router;

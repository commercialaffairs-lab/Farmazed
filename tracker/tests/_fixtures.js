/**
 * _fixtures.js — TAREA 42. Utilidades comunes de las suites de integración (contra el tracker
 * REAL sobre el emulador). Cada suite crea SUS PROPIAS empresas, usuarios y casos con ids
 * únicos por corrida (RUN), así ninguna depende del estado que otra dejó en las semillas
 * compartidas (seed_roles.js) — el orden de las suites no importa.
 *
 * Requiere FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT (los pone run_permission_tests.sh).
 */
const admin = require('firebase-admin');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('_fixtures.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const db       = admin.firestore();
const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';
const RUN      = Date.now();

async function idTokenFor(email, password = PASSWORD) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

// token=null -> sin Authorization (para probar el 401).
async function api(token, method, path, body, extraHeaders = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* respuesta no JSON */ }
  return { status: res.status, json, text };
}

// Usuario con su propia empresa. `emailVerified:false` + `origen:'registro'` = cuenta del registro abierto sin verificar (403 en toda la API).
async function crearUsuario(sufijo, { role = 'cliente_titular', orgId = null, emailVerified = true, origen = null } = {}) {
  const email = `${sufijo}-${RUN}@farmazed.test`;
  if (orgId) await db.collection('orgs').doc(orgId).set({ nombre: `Test ${sufijo}`, createdAt: admin.firestore.Timestamp.now() }, { merge: true });
  const u = await admin.auth().createUser({ email, password: PASSWORD, emailVerified });
  await admin.auth().setCustomUserClaims(u.uid, { role, ...(orgId ? { orgId } : {}), ...(origen ? { origen } : {}) });
  return { uid: u.uid, email, orgId, token: await idTokenFor(email) };
}

const crearTitular = (sufijo, opts = {}) => crearUsuario(sufijo, { orgId: `org-${sufijo}-${RUN}`, ...opts });

// Caso con los campos mínimos que el backend espera (mismo molde que seed_roles.js).
async function crearCaso(sufijo, campos = {}) {
  const id = `c-${sufijo}-${RUN}`;
  const now = admin.firestore.Timestamp.now();
  await db.collection('cases').doc(id).set({
    createdAt: now, updatedAt: now, status: 'fase_01', caseCode: `T-${sufijo}-${RUN}`,
    tramiteType: 'medicamentos', tipoSolicitud: 'Nuevo Registro', tipoRegistro: 'Regular', tipoMedicamento: [],
    product: {}, entities: {}, monografia: {}, assignedTo: null, priority: 'normal', notes: '', faddi: {}, vencimiento: null,
    asignados: { analista: null, abogado: null, regente: null },
    ...campos,
  });
  return id;
}

module.exports = { admin, db, API_BASE, AUTH_PORT, PASSWORD, RUN, idTokenFor, api, crearUsuario, crearTitular, crearCaso };

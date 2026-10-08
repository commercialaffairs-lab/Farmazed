/**
 * auth_acceso.test.js — TAREA 39 (C4 + H1-H5, H8). Autenticación y
 * acceso: aceptar invitación (uid del token, correo, un solo uso, claims
 * fusionados), cuenta sin role -> 403, PATCH de documentos con acceso por
 * caso, MCP request_document con gate, rate limit por IP real (XFF rotado no
 * lo evade), registro sin usuario huérfano, requireMcpKey en tiempo constante.
 *
 * Contra el tracker REAL sobre el emulador (+ pruebas en proceso para el
 * limitador, el registro y requireMcpKey). Datos propios `t39-*`. Mismo patrón
 * y puertos que las demás pruebas:
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 FZ_MCP_KEY=dev-mcp-local \
 *     node --test tracker/tests/auth_acceso.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const express = require('express');
const admin  = require('../utils/firebase_admin.js');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
const MCP_KEY        = process.env.FZ_MCP_KEY;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT || !MCP_KEY) {
  throw new Error('auth_acceso.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT / FZ_MCP_KEY no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const db       = admin.firestore();
const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';
const RUN      = Date.now();

async function tokenFor(email) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function api(token, method, path, body, extraHeaders = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extraHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// Cuenta de Firebase nueva (como la que crea register() en aceptar-invitacion.html), con claims opcionales.
// TAREA 39b: aceptar con sesión exige correo verificado -> por defecto verificada.
async function crearCuenta(sufijo, claims, emailVerified = true) {
  const email = `t39-${sufijo}-${RUN}@farmazed.test`;
  const u = await admin.auth().createUser({ email, password: PASSWORD, emailVerified });
  if (claims) await admin.auth().setCustomUserClaims(u.uid, claims);
  return { uid: u.uid, email, token: await tokenFor(email) };
}

let admToken, analistaToken, analistaUid;
before(async () => {
  admToken = await tokenFor('admin-e3@farmazed.test');
  analistaToken = await tokenFor('analista@farmazed.test');
  analistaUid = (await admin.auth().getUserByEmail('analista@farmazed.test')).uid;
});

const invitarEmpleado = async (email, role) => (await api(admToken, 'POST', '/api/invitations/empleado', { email, role })).json.id;

describe('Aceptar invitación', () => {
  test('sin sesión y sin datos para crear la cuenta -> 400 (el camino público pide contraseña y nombre)', async () => {
    const token = await invitarEmpleado(`t39-nosesion-${RUN}@farmazed.test`, 'analista');
    assert.equal((await api(null, 'POST', `/api/invitations/${token}/accept`)).status, 400);
    assert.equal((await db.collection('invitations').doc(token).get()).data().used, false);
  });

  test('sesión con OTRO correo -> 403, y la invitación sigue sin usar', async () => {
    const invitado = `t39-invitado-${RUN}@farmazed.test`;
    const token = await invitarEmpleado(invitado, 'analista');
    const intruso = await crearCuenta('intruso', null);
    assert.equal((await api(intruso.token, 'POST', `/api/invitations/${token}/accept`)).status, 403);
    assert.equal((await db.collection('invitations').doc(token).get()).data().used, false);
    assert.equal((await admin.auth().getUser(intruso.uid)).customClaims?.role, undefined, 'el intruso no recibió ningún rol');
  });

  test('el uid del body se IGNORA: no se puede reescribir el rol de otra cuenta', async () => {
    const victima = await crearCuenta('victima', { role: 'cliente_titular', orgId: 'org-alfa' });
    const yo = await crearCuenta('yo', null);
    const token = await invitarEmpleado(yo.email, 'abogado');
    const r = await api(yo.token, 'POST', `/api/invitations/${token}/accept`, { uid: victima.uid });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await admin.auth().getUser(victima.uid)).customClaims.role, 'cliente_titular', 'la cuenta ajena quedó intacta');
    assert.equal((await admin.auth().getUser(yo.uid)).customClaims.role, 'abogado', 'el rol lo recibió quien aceptó');
  });

  test('aceptar dos veces en paralelo -> un solo éxito (el otro 409)', async () => {
    const yo = await crearCuenta('paralelo', null);
    const token = await invitarEmpleado(yo.email, 'regente');
    const resp = await Promise.all([1, 2].map(() => api(yo.token, 'POST', `/api/invitations/${token}/accept`)));
    assert.deepEqual(resp.map(r => r.status).sort(), [200, 409], JSON.stringify(resp));
  });

  test('los claims previos se CONSERVAN (fusión) y el rol de la invitación reemplaza al anterior', async () => {
    const yo = await crearCuenta('claims', { origen: 'registro', role: 'cliente_titular', orgId: 'org-vieja', extra: 'conservame' });
    const token = await invitarEmpleado(yo.email, 'analista');
    assert.equal((await api(yo.token, 'POST', `/api/invitations/${token}/accept`)).status, 200);
    const claims = (await admin.auth().getUser(yo.uid)).customClaims;
    assert.equal(claims.role, 'analista');
    assert.equal(claims.origen, 'registro');
    assert.equal(claims.extra, 'conservame');
    assert.equal(claims.orgId, undefined, 'el orgId viejo no se arrastra a un empleado');
  });

  test('el correo se compara normalizado (mayúsculas/espacios)', async () => {
    const yo = await crearCuenta('norm', null);
    const token = await invitarEmpleado(`  ${yo.email.toUpperCase()} `, 'analista');
    assert.equal((await api(yo.token, 'POST', `/api/invitations/${token}/accept`)).status, 200);
  });
});

describe('Cuenta sin role', () => {
  test('sin role ni admin -> 403 en cualquier permiso (ya no es cliente_titular por defecto)', async () => {
    const sinRol = await crearCuenta('sinrol', null);
    const r = await api(sinRol.token, 'GET', '/api/cases');
    assert.equal(r.status, 403);
    assert.match(r.json.error, /rol/i);
    const me = await api(sinRol.token, 'GET', '/api/me/permissions');
    assert.equal(me.json.role, null);
    assert.deepEqual(me.json.permissions, []);
  });

  test('la cuenta legacy con admin:true sigue funcionando', async () => {
    const legacy = await crearCuenta('legacyadmin', { admin: true });
    assert.equal((await api(legacy.token, 'GET', '/api/cases')).status, 200);
  });

  test('effectiveRole: {} -> null, {admin:true} -> admin, role inválido -> null', () => {
    const { effectiveRole } = require('../middleware/permissions');
    assert.equal(effectiveRole({}), null);
    assert.equal(effectiveRole({ admin: true }), 'admin');
    assert.equal(effectiveRole({ role: 'cualquiera' }), null);
    assert.equal(effectiveRole({ role: 'analista' }), 'analista');
  });
});

describe('PATCH de documentos con acceso por caso', () => {
  const CASO_AJENO = `t39-caso-ajeno-${RUN}`, CASO_PROPIO = `t39-caso-propio-${RUN}`;
  before(async () => {
    const base = (asignados) => ({ status: 'fase_07', caseCode: `T39-${asignados.analista ? 'P' : 'A'}`, orgId: 'org-alfa', clientId: 'role-titular-alfa', asignados, createdAt: admin.firestore.Timestamp.now() });
    await db.collection('cases').doc(CASO_AJENO).set(base({ analista: null, abogado: null, regente: null }));
    await db.collection('cases').doc(CASO_PROPIO).set(base({ analista: analistaUid, abogado: null, regente: null }));
    for (const c of [CASO_AJENO, CASO_PROPIO]) {
      await db.collection('cases').doc(c).collection('documents').doc('doc1').set({ faddiDocId: 'x', status: 'uploaded', fileName: 'f.pdf', uploadedAt: admin.firestore.Timestamp.now() });
    }
  });

  test('staff NO asignado al caso -> 403 y el documento no cambia', async () => {
    const r = await api(analistaToken, 'PATCH', `/api/cases/${CASO_AJENO}/documents/doc1`, { status: 'approved' });
    assert.equal(r.status, 403);
    assert.equal((await db.collection('cases').doc(CASO_AJENO).collection('documents').doc('doc1').get()).data().status, 'uploaded');
  });

  test('staff asignado -> 200', async () => {
    const r = await api(analistaToken, 'PATCH', `/api/cases/${CASO_PROPIO}/documents/doc1`, { status: 'approved' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  });

  test('admin -> 200 en cualquier caso', async () => {
    assert.equal((await api(admToken, 'PATCH', `/api/cases/${CASO_AJENO}/documents/doc1`, { status: 'reviewing' })).status, 200);
  });

  test('caso inexistente -> 404', async () => {
    assert.equal((await api(admToken, 'PATCH', `/api/cases/t39-no-existe-${RUN}/documents/doc1`, { status: 'approved' })).status, 404);
  });
});

describe('MCP farmazed_request_document pasa por el gate', () => {
  const mcp = async (name, args) => (await fetch(`${API_BASE}/mcp`, {
    method: 'POST', headers: { Authorization: `Bearer ${MCP_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })).json();

  test('desde fase_05 sin pagos -> rechazado: el caso no cambia y no queda documento "requested"', async () => {
    const id = `t39-mcp-gate-${RUN}`;
    await db.collection('cases').doc(id).set({ status: 'fase_05', caseCode: 'T39-MCP', orgId: 'org-beta', asignados: {}, createdAt: admin.firestore.Timestamp.now() });
    const r = await mcp('farmazed_request_document', { caseId: id, faddiDocId: 'doc_x', message: 'falta' });
    assert.ok(r.error, JSON.stringify(r));
    assert.match(r.error.message, /pago/i);
    assert.equal((await db.collection('cases').doc(id).get()).data().status, 'fase_05');
    assert.equal((await db.collection('cases').doc(id).collection('documents').get()).size, 0);
  });

  test('un caso sin bloqueo sí pasa a pending_docs (con historial)', async () => {
    const id = `t39-mcp-ok-${RUN}`;
    await db.collection('cases').doc(id).set({ status: 'fase_03', caseCode: 'T39-MCP2', orgId: 'org-beta', asignados: {}, createdAt: admin.firestore.Timestamp.now() });
    const r = await mcp('farmazed_request_document', { caseId: id, faddiDocId: 'doc_y', message: 'sube esto' });
    assert.ok(r.result, JSON.stringify(r));
    assert.equal((await db.collection('cases').doc(id).get()).data().status, 'pending_docs');
    const hist = await db.collection('cases').doc(id).collection('statusHistory').get();
    assert.equal(hist.docs[0].data().by, 'mcp');
  });

  test('caso inexistente -> error (antes creaba el documento en un caso que no existe)', async () => {
    const r = await mcp('farmazed_request_document', { caseId: `t39-fantasma-${RUN}`, faddiDocId: 'z', message: 'm' });
    assert.ok(r.error);
  });
});

describe('Rate limit por IP real', () => {
  test('rotar el primer valor de X-Forwarded-For NO evade el límite (cuenta la IP que agrega el balanceador)', async () => {
    const lead = { nombre: 'Rate', correo: 'rate@farmazed.test' };
    const estados = [];
    for (let i = 0; i < 8; i++) {
      // "falso-i" lo manda el atacante; "198.18.0.77" es lo que agregaría el balanceador de Cloud Run
      const r = await api(null, 'POST', '/api/contact-leads', lead, { 'X-Forwarded-For': `falso-${i}, 198.18.0.77` });
      estados.push(r.status);
    }
    assert.deepEqual(estados.slice(0, 5), [201, 201, 201, 201, 201]);
    assert.ok(estados.slice(5).every(s => s === 429), JSON.stringify(estados));
  });

  test('limitador: reset() vacía y la purga borra las IPs vencidas', async () => {
    const { crearLimitador } = require('../utils/rate_limit');
    const l = crearLimitador({ ventanaMs: 60, max: 2 });
    assert.equal(l.estaLimitado('a'), false);
    assert.equal(l.estaLimitado('a'), false);
    assert.equal(l.estaLimitado('a'), true);
    l.estaLimitado('b'); l.estaLimitado('c');
    assert.equal(l.tamano, 3);
    await new Promise(r => setTimeout(r, 130));
    l.estaLimitado('d'); // dispara la purga: a, b y c salieron de la ventana
    assert.equal(l.tamano, 1);
    l.reset();
    assert.equal(l.tamano, 0);
    assert.equal(l.estaLimitado('a'), false, 'tras reset() vuelve a contar desde cero');
  });
});

describe('Registro sin usuario huérfano', () => {
  test('si falla la empresa/claims tras crear el usuario, se borran usuario y empresa (y el correo queda libre)', async () => {
    const router = require('../routes/register');
    router.limitador.reset();
    const app = express(); app.use(express.json()); app.use('/api/register', router);
    const server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    const url = `http://localhost:${server.address().port}/api/register`;

    const correo = `t39-reg-${RUN}@farmazed.test`, empresa = `T39 Empresa ${RUN}`;
    const cuerpo = JSON.stringify({ nombre: 'Reg', correo, password: PASSWORD, telefono: '+507 6000-0000', empresa, pais: 'Panamá' });
    const post = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo });

    const auth = admin.auth();
    const original = auth.setCustomUserClaims;
    auth.setCustomUserClaims = async () => { throw new Error('fallo simulado en los claims'); };
    try {
      const r = await post();
      assert.equal(r.status, 500);
    } finally { auth.setCustomUserClaims = original; }

    await assert.rejects(auth.getUserByEmail(correo), /no user record|user-not-found/i, 'no quedó un usuario huérfano');
    assert.equal((await db.collection('orgs').where('nombre', '==', empresa).get()).size, 0, 'no quedó una empresa huérfana');

    const ok = await post(); // el correo quedó libre: el reintento funciona
    assert.equal(ok.status, 201, await ok.text());
    server.close();
  });
});

describe('requireMcpKey en tiempo constante', () => {
  const { requireMcpKey } = require('../middleware/auth');
  const llamar = (authorization) => {
    let status = null, siguio = false;
    const res = { status(s) { status = s; return this; }, json() { return this; } };
    requireMcpKey({ headers: { authorization } }, res, () => { siguio = true; });
    return { status, siguio };
  };
  test('clave correcta pasa; incorrecta (de cualquier largo), vacía o ausente -> 401, sin lanzar', () => {
    const previa = process.env.MCP_KEY;
    process.env.MCP_KEY = 'clave-de-prueba-123';
    try {
      assert.equal(llamar('Bearer clave-de-prueba-123').siguio, true);
      for (const mala of ['Bearer x', 'Bearer clave-de-prueba-1234', 'Bearer ', '', undefined]) {
        const r = llamar(mala);
        assert.equal(r.siguio, false);
        assert.equal(r.status, 401);
      }
    } finally { process.env.MCP_KEY = previa; }
  });
});

describe('Token revocado -> 401 (checkRevoked)', () => {
  const fx = require('./_fixtures');
  test('tras revokeRefreshTokens, el token que valía deja de valer; uno nuevo sí', async () => {
    const u = await fx.crearTitular('revocado');
    assert.equal((await fx.api(u.token, 'GET', '/api/cases')).status, 200);
    await new Promise(r => setTimeout(r, 1100)); // Firebase compara en segundos: la revocación debe caer en un segundo posterior al del token
    await fx.admin.auth().revokeRefreshTokens(u.uid);
    const r = await fx.api(u.token, 'GET', '/api/cases');
    assert.equal(r.status, 401);
    await new Promise(r => setTimeout(r, 1100));
    const nuevo = await fx.idTokenFor(u.email);
    assert.equal((await fx.api(nuevo, 'GET', '/api/cases')).status, 200);
  });
});

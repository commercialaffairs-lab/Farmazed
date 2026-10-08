/**
 * registro_captacion.test.js — TAREA 32 (PM_COMMENTS §H.13). Registro abierto
 * de clientes nuevos + captación de información preliminar + leads en
 * bandeja. Contra el tracker REAL sobre el emulador — mismo patrón que
 * permissions.test.js, pero con sus propios puertos (ver
 * FZ_AUTH_PORT/FZ_API_PORT/FZ_FIRESTORE_PORT), para no interferir con
 * ninguna otra corrida (p.ej. la demo de Rick en tmux farmazed-demo).
 *
 * Corre con:
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/registro_captacion.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const admin  = require('../utils/firebase_admin.js');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('registro_captacion.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';

async function idTokenFor(email, password = PASSWORD) {
  const res = await fetch(
    `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function post(path, body, extraHeaders = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function apiAuth(token, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const DATOS_BASE = {
  nombre: 'Lead de Prueba', correo: `lead-${Date.now()}@farmazed.test`,
  password: 'Farmazed123!', telefono: '+507 6000-0000', empresa: 'Lead Co.', pais: 'Panamá',
};

// El rate limit de /api/register es por IP (5/10min) — sin esto, las
// llamadas de ESTE archivo (todas desde el loopback del test runner, salvo
// que se mande X-Forwarded-For) se pisarían entre sí y algún test fallaría
// con 429 en vez del código que realmente está probando. Cada test que no
// sea el del rate limit en sí usa una IP sintética distinta (TEST-NET-2,
// RFC 5737) — simula lo real (cada registro viene de una IP distinta),
// no es un truco para esconder el límite.
let ipCounter = 0;
const { ipUnica } = require('./_ip');
function nextTestIp() { return ipUnica(); }
function withIp(extra = {}) { return { 'X-Forwarded-For': nextTestIp(), ...extra }; }

describe('POST /api/register', () => {
  test('registro normal crea cliente_titular con su propia empresa', async () => {
    const datos = { ...DATOS_BASE, correo: `lead-ok-${Date.now()}@farmazed.test` };
    const { status, json } = await post('/api/register', datos, withIp());
    assert.equal(status, 201);
    assert.ok(json.uid);
    assert.ok(json.orgId);

    const user = await admin.auth().getUser(json.uid);
    assert.equal(user.customClaims.role, 'cliente_titular');
    assert.equal(user.customClaims.orgId, json.orgId);
    assert.equal(user.emailVerified, false); // obligatorio verificar antes de entrar

    const org = await admin.firestore().collection('orgs').doc(json.orgId).get();
    assert.equal(org.data().nombre, datos.empresa);
    assert.equal(org.data().pais, datos.pais);
    assert.equal(org.data().telefonoContacto, datos.telefono);
  });

  test('no puede escalar rol mandando "role" en el body — el endpoint no lo lee', async () => {
    const datos = { ...DATOS_BASE, correo: `lead-escala-${Date.now()}@farmazed.test`, role: 'admin', admin: true, orgId: 'org-alfa' };
    const { status, json } = await post('/api/register', datos, withIp());
    assert.equal(status, 201);

    const user = await admin.auth().getUser(json.uid);
    assert.equal(user.customClaims.role, 'cliente_titular'); // nunca 'admin'
    assert.equal(user.customClaims.admin, undefined);
    assert.notEqual(user.customClaims.orgId, 'org-alfa'); // nunca la empresa ajena que mandó
  });

  test('correo duplicado -> 409', async () => {
    const datos = { ...DATOS_BASE, correo: `lead-dup-${Date.now()}@farmazed.test` };
    const r1 = await post('/api/register', datos, withIp());
    assert.equal(r1.status, 201);
    const r2 = await post('/api/register', datos, withIp());
    assert.equal(r2.status, 409);
  });

  test('faltan campos -> 400, no crea nada', async () => {
    const { status } = await post('/api/register', { ...DATOS_BASE, correo: `lead-falta-${Date.now()}@farmazed.test`, empresa: '' }, withIp());
    assert.equal(status, 400);
  });

  test('rate limit básico por IP — 6to intento en la ventana da 429', async () => {
    const ip = ipUnica(); // IP de prueba (RFC 5737), distinta por corrida
    let ultimo;
    for (let i = 0; i < 6; i++) {
      ultimo = await post('/api/register', { ...DATOS_BASE, correo: `lead-rl-${i}-${Date.now()}@farmazed.test` }, { 'X-Forwarded-For': ip });
    }
    assert.equal(ultimo.status, 429);
  });
});

describe('POST /api/register/reenviar-verificacion', () => {
  test('rate limit por uid — el 6to reenvío da 429', async () => {
    const datos = { ...DATOS_BASE, correo: `lead-reenvio-${Date.now()}@farmazed.test` };
    assert.equal((await post('/api/register', datos, withIp())).status, 201);
    const token = await idTokenFor(datos.correo, datos.password);
    const estados = [];
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${API_BASE}/api/register/reenviar-verificacion`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      estados.push(res.status);
    }
    assert.deepEqual(estados.slice(0, 5), [200, 200, 200, 200, 200]);
    assert.equal(estados[5], 429);
  });
});

describe('PATCH /api/orgs/mine/captacion', () => {
  let tokenTitular, tokenMiembro, tokenStaff;

  before(async () => {
    tokenTitular = await idTokenFor('titular-alfa@farmazed.test');
    tokenMiembro = await idTokenFor('miembro-alfa@farmazed.test');
    tokenStaff   = await idTokenFor('analista@farmazed.test');
  });

  const CAPTACION_OK = {
    paisYNombreFabricante: 'Alemania — Laboratorios XYZ',
    categoriasProducto: ['medicamentos', 'cosmeticos'],
    numeroProductosPorCategoria: '3 medicamentos, 1 cosmético',
    registroPrevioAutoridadReconocida: true,
    clienteNuevoOYaRegistrado: 'nuevo',
    productoConModificacionEnCurso: false,
  };

  test('cliente_miembro NO puede completarla (403) — solo el titular', async () => {
    const { status } = await apiAuth(tokenMiembro, 'PATCH', '/api/orgs/mine/captacion', CAPTACION_OK);
    assert.equal(status, 403);
  });

  test('categoriasProducto fuera de la lista conocida -> 400', async () => {
    const { status } = await apiAuth(tokenTitular, 'PATCH', '/api/orgs/mine/captacion', { ...CAPTACION_OK, categoriasProducto: ['brujeria'] });
    assert.equal(status, 400);
  });

  test('titular completa la captación -> queda en su empresa, "se pide una sola vez" (GET /api/me/org la refleja)', async () => {
    const guardar = await apiAuth(tokenTitular, 'PATCH', '/api/orgs/mine/captacion', CAPTACION_OK);
    assert.equal(guardar.status, 200);

    const org = await apiAuth(tokenTitular, 'GET', '/api/me/org');
    assert.equal(org.status, 200);
    assert.ok(org.json.captacion, 'org.captacion debería existir — así el front NO vuelve a mostrar la pantalla bloqueante');
    assert.equal(org.json.captacion.paisYNombreFabricante, CAPTACION_OK.paisYNombreFabricante);
    assert.equal(org.json.captacion.revisadoPorFarmazed, false);
  });

  test('productosPorCategoria (contadores del portal): válido se guarda; categoría no marcada o cantidad inválida -> 400', async () => {
    const ok = await apiAuth(tokenTitular, 'PATCH', '/api/orgs/mine/captacion', { ...CAPTACION_OK, productosPorCategoria: { medicamentos: 3 } });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.deepEqual((await apiAuth(tokenTitular, 'GET', '/api/me/org')).json.captacion.productosPorCategoria, { medicamentos: 3 });
    for (const malo of [{ plaguicidas: 1 }, { medicamentos: 0 }, { medicamentos: 2.5 }, [3], 'tres']) {
      assert.equal((await apiAuth(tokenTitular, 'PATCH', '/api/orgs/mine/captacion', { ...CAPTACION_OK, productosPorCategoria: malo })).status, 400, JSON.stringify(malo));
    }
  });

  test('editar después (mismo endpoint) actualiza, no duplica — sigue siendo UN solo objeto captacion', async () => {
    const editado = { ...CAPTACION_OK, numeroProductosPorCategoria: '10 medicamentos', clienteNuevoOYaRegistrado: 'ya_registrado' };
    const guardar = await apiAuth(tokenTitular, 'PATCH', '/api/orgs/mine/captacion', editado);
    assert.equal(guardar.status, 200);

    const org = await apiAuth(tokenTitular, 'GET', '/api/me/org');
    assert.equal(org.json.captacion.numeroProductosPorCategoria, '10 medicamentos');
    assert.equal(org.json.captacion.clienteNuevoOYaRegistrado, 'ya_registrado');
    assert.equal(typeof org.json.captacion, 'object');
    assert.ok(!Array.isArray(org.json.captacion));
  });

  test('staff no tiene permiso para completar captación (403) — orgs.edit_captacion es de cliente_titular/admin', async () => {
    const { status } = await apiAuth(tokenStaff, 'PATCH', '/api/orgs/mine/captacion', CAPTACION_OK);
    assert.equal(status, 403);
  });
});

describe('Verificación de correo reforzada en el backend — ajuste PM tras entrega (requireAuth)', () => {
  // Solo para cuentas del registro abierto (claim `origen:'registro'`,
  // puesto en register.js) — la verificación SOLO en el front se salta
  // llamando la API directo; este refuerzo cierra esa puerta sin afectar
  // invitación/semilla/legacy (ninguna lleva ese claim).
  test('cuenta registrada SIN verificar -> 403 al crear un caso vía API', async () => {
    const datos = { ...DATOS_BASE, correo: `lead-noverif-${Date.now()}@farmazed.test` };
    const { json: reg } = await post('/api/register', datos, withIp());
    const token = await idTokenFor(datos.correo, datos.password);

    const { status, json } = await apiAuth(token, 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 403);
    assert.match(json.error, /verifica tu correo/i);
  });

  test('la misma cuenta, YA verificada -> puede crear el caso normal', async () => {
    const datos = { ...DATOS_BASE, correo: `lead-verif-${Date.now()}@farmazed.test` };
    const { json: reg } = await post('/api/register', datos, withIp());
    await admin.auth().updateUser(reg.uid, { emailVerified: true });
    const token = await idTokenFor(datos.correo, datos.password); // token nuevo — el viejo tiene email_verified:false grabado adentro

    const { status } = await apiAuth(token, 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 201);
  });

  test('cuenta legacy/invitación (sin el claim "origen") sigue funcionando igual — no la toca este refuerzo', async () => {
    const tokenLegacy = await idTokenFor('titular-alfa@farmazed.test'); // seed_roles.js, sin claim origen
    const { status } = await apiAuth(tokenLegacy, 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 201);
  });
});

describe('Leads en bandeja (orgs.read_leads)', () => {
  let tokenStaff, tokenAdmin, tokenTitular;

  before(async () => {
    tokenStaff   = await idTokenFor('analista@farmazed.test');
    tokenAdmin   = await idTokenFor('admin-e3@farmazed.test');
    tokenTitular = await idTokenFor('titular-alfa@farmazed.test'); // ya completó captación en el describe anterior
  });

  test('cliente_titular NO puede ver /api/orgs/leads (403) — es vista de staff/admin', async () => {
    const { status } = await apiAuth(tokenTitular, 'GET', '/api/orgs/leads');
    assert.equal(status, 403);
  });

  test('staff ve org-alfa en los leads (captación completada, sin revisar)', async () => {
    const { status, json } = await apiAuth(tokenStaff, 'GET', '/api/orgs/leads');
    assert.equal(status, 200);
    assert.ok(json.leads.some(l => l.id === 'org-alfa'));
  });

  test('admin marca org-alfa como revisada -> ya no aparece en los leads', async () => {
    const marcar = await apiAuth(tokenAdmin, 'POST', '/api/orgs/org-alfa/leads/revisar');
    assert.equal(marcar.status, 200);

    const leads = await apiAuth(tokenStaff, 'GET', '/api/orgs/leads');
    assert.ok(!leads.json.leads.some(l => l.id === 'org-alfa'));
  });
});

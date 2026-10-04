/**
 * invitacion_squat.test.js — TAREA 39b. Invitación sin squatting: el
 * ENLACE prueba la propiedad del correo. Accept público para quien no tiene
 * cuenta (el servidor crea el usuario verificado con el rol), accept con
 * sesión exige correo verificado, GET con correo enmascarado, register rechaza
 * correos con invitación vigente, y los modos de migrate_roles.js (dry-run por
 * defecto en producción, sin escribir nada).
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/invitacion_squat.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');
const { spawnSync } = require('node:child_process');
const admin  = require('firebase-admin');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('invitacion_squat.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const db       = admin.firestore();
const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';
const RUN      = Date.now();

async function tokenFor(email, password = PASSWORD) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

let ipN = 0;
const { ipUnica } = require('./_ip');
const ip = () => ({ 'X-Forwarded-For': ipUnica() }); // TEST-NET-1: una IP distinta por llamada, sin chocar con el rango de otros archivos de prueba (rate limit compartido)

async function api(token, method, path, body, extra = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let admToken;
before(async () => { admToken = await tokenFor('admin-e3@farmazed.test'); });

const invitar = async (email, role = 'analista') => (await api(admToken, 'POST', '/api/invitations/empleado', { email, role })).json.id;
const correoNuevo = (s) => `t39b-${s}-${RUN}@farmazed.test`;

describe('Accept SIN cuenta — el servidor crea el usuario', () => {
  test('crea el usuario con el correo de la invitación, verificado, con el rol; la invitación queda usada', async () => {
    const correo = correoNuevo('nueva');
    const token = await invitar(correo, 'abogado');
    const r = await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'Nueva Persona' }, ip());
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.email, correo);

    const u = await admin.auth().getUserByEmail(correo);
    assert.equal(u.emailVerified, true);
    assert.equal(u.displayName, 'Nueva Persona');
    assert.equal(u.customClaims.role, 'abogado');
    assert.ok(await tokenFor(correo), 'puede iniciar sesión con la contraseña que puso');

    const inv = (await db.collection('invitations').doc(token).get()).data();
    assert.equal(inv.used, true);
    assert.equal(inv.usedByUid, u.uid);
    assert.equal((await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'X' }, ip())).status, 409);
  });

  test('titular: el usuario nace con la empresa de la invitación', async () => {
    const correo = correoNuevo('titular');
    const inv = (await api(admToken, 'POST', '/api/invitations/titular', { email: correo, orgName: `T39b Org ${RUN}` })).json;
    const r = await api(null, 'POST', `/api/invitations/${inv.id}/accept`, { password: PASSWORD, displayName: 'Titular Nuevo' }, ip());
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const claims = (await admin.auth().getUserByEmail(correo)).customClaims;
    assert.equal(claims.role, 'cliente_titular');
    assert.equal(claims.orgId, inv.orgId);
  });

  test('en paralelo (x2) -> un solo usuario creado (el otro 409)', async () => {
    const token = await invitar(correoNuevo('paralelo'));
    const resp = await Promise.all([1, 2].map(() => api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'P' }, ip())));
    assert.deepEqual(resp.map(r => r.status).sort(), [201, 409], JSON.stringify(resp));
  });

  test('datos inválidos -> 400 y la invitación NO se consume', async () => {
    const token = await invitar(correoNuevo('invalida'));
    assert.equal((await api(null, 'POST', `/api/invitations/${token}/accept`, { password: '123', displayName: 'X' }, ip())).status, 400);
    assert.equal((await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD }, ip())).status, 400);
    assert.equal((await api(null, 'POST', `/api/invitations/${token}/accept`, undefined, ip())).status, 400);
    assert.equal((await db.collection('invitations').doc(token).get()).data().used, false);
  });

  test('token inexistente -> 404', async () => {
    assert.equal((await api(null, 'POST', '/api/invitations/no-existe/accept', { password: PASSWORD, displayName: 'X' }, ip())).status, 404);
  });

  test('límite de intentos por IP real: el 6.º en la ventana -> 429 (XFF rotado no lo evade)', async () => {
    const estados = [];
    for (let i = 0; i < 7; i++) {
      estados.push((await api(null, 'POST', '/api/invitations/no-existe/accept', { password: PASSWORD, displayName: 'X' }, { 'X-Forwarded-For': `falso-${i}, 198.18.0.99` })).status);
    }
    assert.deepEqual(estados.slice(0, 5), [404, 404, 404, 404, 404]);
    assert.ok(estados.slice(5).every(s => s === 429), JSON.stringify(estados));
  });
});

describe('Squatting — cuenta preexistente sin verificar', () => {
  test('un squatter que registró el correo SIN verificar no puede aceptar con su sesión (403), y el invitado real no pierde su invitación', async () => {
    const correo = correoNuevo('squat');
    await admin.auth().createUser({ email: correo, password: 'ContraseñaDelAtacante1', emailVerified: false });
    const token = await invitar(correo, 'analista'); // el admin invita DESPUÉS: el squatter ya tenía la cuenta
    const sesionAtacante = await tokenFor(correo, 'ContraseñaDelAtacante1');

    const r = await api(sesionAtacante, 'POST', `/api/invitations/${token}/accept`);
    assert.equal(r.status, 403);
    assert.match(r.json.error, /verifica tu correo/i);
    assert.equal((await db.collection('invitations').doc(token).get()).data().used, false, 'la invitación sigue vigente');
    assert.equal((await admin.auth().getUserByEmail(correo)).customClaims?.role, undefined, 'el squatter no recibió el rol');

    // el invitado real abre su enlace (que prueba su buzón): TOMA la cuenta no verificada — contraseña nueva,
    // sesiones del atacante revocadas y el rol de la invitación
    const publico = await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'Real' }, ip());
    assert.equal(publico.status, 201, JSON.stringify(publico.json));
    const u = await admin.auth().getUserByEmail(correo);
    assert.equal(u.emailVerified, true);
    assert.equal(u.displayName, 'Real');
    assert.equal(u.customClaims.role, 'analista');
    assert.ok(await tokenFor(correo, PASSWORD), 'la contraseña nueva funciona');
    await assert.rejects(tokenFor(correo, 'ContraseñaDelAtacante1'), /No se pudo autenticar/, 'la del atacante ya no sirve');
    assert.ok(u.tokensValidAfterTime, 'se revocaron los refresh tokens del atacante (no podrá renovar su sesión)');
  });

  test('si la cuenta preexistente YA estaba verificada, el camino público no la toma: 409 cuenta_existente y la invitación sigue vigente', async () => {
    const correo = correoNuevo('duenio');
    await admin.auth().createUser({ email: correo, password: 'ContraseñaDelDuenio1', emailVerified: true });
    const token = await invitar(correo, 'analista');
    const r = await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'Intruso' }, ip());
    assert.equal(r.status, 409);
    assert.equal(r.json.codigo, 'cuenta_existente');
    assert.equal((await db.collection('invitations').doc(token).get()).data().used, false);
    assert.ok(await tokenFor(correo, 'ContraseñaDelDuenio1'), 'su contraseña sigue igual');
  });

  test('con la cuenta preexistente VERIFICADA el camino autenticado sí funciona', async () => {
    const correo = correoNuevo('verificada');
    await admin.auth().createUser({ email: correo, password: PASSWORD, emailVerified: true });
    const token = await invitar(correo, 'regente');
    const r = await api(await tokenFor(correo), 'POST', `/api/invitations/${token}/accept`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await admin.auth().getUserByEmail(correo)).customClaims.role, 'regente');
  });
});

describe('GET de la invitación y registro abierto', () => {
  test('el GET público NO expone el correo completo (enmascarado)', async () => {
    const correo = correoNuevo('mascara');
    const token = await invitar(correo);
    const r = await api(null, 'GET', `/api/invitations/${token}`);
    assert.equal(r.status, 200);
    assert.notEqual(r.json.email, correo);
    assert.match(r.json.email, /^t\*\*\*@farmazed\.test$/);
    assert.ok(!JSON.stringify(r.json).includes(correo.split('@')[0]), 'ni el usuario del correo aparece');
  });

  test('registro abierto con un correo que tiene invitación vigente -> 409 "tienes una invitación pendiente"', async () => {
    const correo = correoNuevo('regsquat');
    await invitar(correo);
    const r = await api(null, 'POST', '/api/register', { nombre: 'Squatter', correo: correo.toUpperCase(), password: PASSWORD, telefono: '+507 6000-0000', empresa: 'Squat Co', pais: 'Panamá' }, ip());
    assert.equal(r.status, 409);
    assert.match(r.json.error, /invitación pendiente/i);
    await assert.rejects(admin.auth().getUserByEmail(correo), /no user record|user-not-found/i, 'no se creó ninguna cuenta');
  });

  test('un registro normal (sin invitación) sigue funcionando', async () => {
    const r = await api(null, 'POST', '/api/register', { nombre: 'Normal', correo: correoNuevo('normal'), password: PASSWORD, telefono: '+507 6000-0000', empresa: 'Normal Co', pais: 'Panamá' }, ip());
    assert.equal(r.status, 201, JSON.stringify(r.json));
  });
});

describe('migrate_roles.js — modos', () => {
  const { resolverModo } = require('../scripts/migrate_roles');

  test('resolverModo: producción solo con --prod, dry-run por defecto, escribe solo con --prod --confirm', () => {
    const prodEnv = {};
    const PROD = ['--prod', '--project=proyecto-prod'];
    assert.match(resolverModo([], prodEnv).error, /--prod/);                         // sin emulador ni --prod: se niega
    assert.match(resolverModo([], { FIRESTORE_EMULATOR_HOST: 'x' }).error, /AMBOS/); // solo Firestore: la otra mitad iría a prod
    assert.match(resolverModo(PROD, { FIREBASE_AUTH_EMULATOR_HOST: 'x' }).error, /AMBOS/);
    assert.equal(resolverModo(PROD, prodEnv).dryRun, true);                          // dry-run por defecto
    assert.equal(resolverModo([...PROD, '--dry-run'], prodEnv).dryRun, true);
    assert.equal(resolverModo([...PROD, '--confirm'], prodEnv).dryRun, false);       // la única forma de escribir
    assert.match(resolverModo(['--confirm'], prodEnv).error, /--prod/);              // --confirm solo
    assert.match(resolverModo(['--prod'], {}).error, /--project/);                   // hay que nombrar el proyecto
    assert.match(resolverModo([...PROD, '--confirm'], { FIRESTORE_EMULATOR_HOST: 'x', FIREBASE_AUTH_EMULATOR_HOST: 'y' }).error, /emulador/i);
  });

  test('resolverModo: el emulador sigue escribiendo salvo --dry-run (los scripts de prueba no cambian)', () => {
    const emu = { FIRESTORE_EMULATOR_HOST: 'localhost:8190', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9198' };
    assert.equal(resolverModo([], emu).dryRun, false);
    assert.equal(resolverModo(['--dry-run'], emu).dryRun, true);
  });

  test('--dry-run: lista la cuenta sin role y NO escribe nada (ni claims, ni empresas)', async () => {
    const sinRol = await admin.auth().createUser({ email: correoNuevo('legacy'), password: PASSWORD });
    const empresasAntes = (await db.collection('orgs').where('createdBy', '==', 'migrate_roles').get()).size;

    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'migrate_roles.js'), '--dry-run'], {
      env: { ...process.env, FIREBASE_PROJECT_ID: 'demo-farmazed' }, encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[dry-run\]/);
    assert.ok(r.stdout.includes(sinRol.email), 'la cuenta sin role aparece en el listado');

    assert.equal((await admin.auth().getUser(sinRol.uid)).customClaims?.role, undefined, 'sus claims no cambiaron');
    assert.equal((await db.collection('orgs').where('createdBy', '==', 'migrate_roles').get()).size, empresasAntes, 'no se creó ninguna empresa');
  });
});

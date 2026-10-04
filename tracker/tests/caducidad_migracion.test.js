/**
 * caducidad_migracion.test.js — TAREA 39c. Caducidad de invitaciones
 * (7 días; las viejas sin `expiresAt` = creadas + 7 d), contraseña mínima de 8
 * para cuentas nuevas, migración de roles REANUDABLE (corte simulado a mitad y
 * re-corrida) y backfill de correos de invitaciones viejas.
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/caducidad_migracion.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const admin  = require('firebase-admin');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('caducidad_migracion.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const db       = admin.firestore();
const auth     = admin.auth();
const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';
const RUN      = Date.now();
const DIA_MS   = 24 * 60 * 60 * 1000;

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
const ip = () => ({ 'X-Forwarded-For': ipUnica() }); // TEST-NET-1, otro tramo que 39b: el rate limit se comparte

async function api(token, method, path, body, extra = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const correoNuevo = (s) => `t39c-${s}-${RUN}@farmazed.test`;
const ts = (ms) => admin.firestore.Timestamp.fromMillis(ms);

// Invitación escrita directo en Firestore (para fijar fechas): `expiresAt` opcional (las viejas no lo tienen).
async function invitacionDirecta({ email, createdHaceDias, expiresEnMs, role = 'analista', used = false }) {
  const token = crypto.randomBytes(24).toString('hex');
  const data = { email, role, orgId: null, token, used, usedAt: null, usedByUid: null, invitedBy: 'test', createdAt: ts(Date.now() - createdHaceDias * DIA_MS) };
  if (expiresEnMs !== undefined) data.expiresAt = ts(expiresEnMs);
  await db.collection('invitations').doc(token).set(data);
  return token;
}

let admToken;
before(async () => { admToken = await tokenFor('admin-e3@farmazed.test'); });

describe('Caducidad de invitaciones — 7 días', () => {
  test('una invitación nueva lleva expiresAt = creación + 7 días', async () => {
    const r = await api(admToken, 'POST', '/api/invitations/empleado', { email: correoNuevo('nueva'), role: 'analista' });
    const d = (await db.collection('invitations').doc(r.json.id).get()).data();
    const dif = d.expiresAt.toMillis() - d.createdAt.toMillis();
    assert.equal(dif, 7 * DIA_MS);
    const get = await api(null, 'GET', `/api/invitations/${r.json.id}`);
    assert.equal(get.status, 200);
  });

  test('caducada (expiresAt en el pasado) -> 410 en GET y en accept (público y con sesión); no se consume ni se crea la cuenta', async () => {
    const correo = correoNuevo('caducada');
    const token = await invitacionDirecta({ email: correo, createdHaceDias: 8, expiresEnMs: Date.now() - 1000 });
    const get = await api(null, 'GET', `/api/invitations/${token}`);
    assert.equal(get.status, 410);
    assert.match(get.json.error, /caduc/i);

    const publico = await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'Tarde' }, ip());
    assert.equal(publico.status, 410);
    await assert.rejects(auth.getUserByEmail(correo), /no user record|user-not-found/i, 'no se creó ninguna cuenta');

    const existente = await auth.createUser({ email: correoNuevo('caducada-sesion'), password: PASSWORD, emailVerified: true });
    const tokenCaducado = await invitacionDirecta({ email: existente.email, createdHaceDias: 8, expiresEnMs: Date.now() - 1000 });
    const conSesion = await api(await tokenFor(existente.email), 'POST', `/api/invitations/${tokenCaducado}/accept`);
    assert.equal(conSesion.status, 410);
    assert.equal((await auth.getUser(existente.uid)).customClaims?.role, undefined, 'tampoco recibió el rol');
    assert.equal((await db.collection('invitations').doc(token).get()).data().used, false);
  });

  test('VIEJA sin expiresAt creada hace 8 días -> 410 (se trata como creada + 7 días)', async () => {
    const token = await invitacionDirecta({ email: correoNuevo('vieja8'), createdHaceDias: 8 });
    assert.equal((await api(null, 'GET', `/api/invitations/${token}`)).status, 410);
    assert.equal((await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'X' }, ip())).status, 410);
  });

  test('VIEJA sin expiresAt creada hace 6 días -> sigue vigente (GET 200 y accept 201)', async () => {
    const correo = correoNuevo('vieja6');
    const token = await invitacionDirecta({ email: correo, createdHaceDias: 6 });
    assert.equal((await api(null, 'GET', `/api/invitations/${token}`)).status, 200);
    const r = await api(null, 'POST', `/api/invitations/${token}/accept`, { password: PASSWORD, displayName: 'A Tiempo' }, ip());
    assert.equal(r.status, 201, JSON.stringify(r.json));
  });

  test('una invitación YA usada y vieja responde 200 used:true (no 410): el mensaje correcto es "ya fue usada"', async () => {
    const token = await invitacionDirecta({ email: correoNuevo('usada'), createdHaceDias: 30, used: true });
    const get = await api(null, 'GET', `/api/invitations/${token}`);
    assert.equal(get.status, 200);
    assert.equal(get.json.used, true);
  });

  test('una invitación CADUCADA ya no bloquea el registro abierto de ese correo', async () => {
    const correo = correoNuevo('regcaducada');
    await invitacionDirecta({ email: correo, createdHaceDias: 9 });
    const r = await api(null, 'POST', '/api/register', { nombre: 'Libre', correo, password: PASSWORD, telefono: '+507 6000-0000', empresa: 'Libre Co', pais: 'Panamá' }, ip());
    assert.equal(r.status, 201, JSON.stringify(r.json));
  });
});

describe('Contraseña mínima de 8 para cuentas NUEVAS', () => {
  test('registro con 7 caracteres -> 400; con 8 -> 201', async () => {
    const base = { nombre: 'Pw', telefono: '+507 6000-0000', empresa: 'Pw Co', pais: 'Panamá' };
    const corta = await api(null, 'POST', '/api/register', { ...base, correo: correoNuevo('pw7'), password: '1234567' }, ip());
    assert.equal(corta.status, 400);
    assert.match(corta.json.error, /8/);
    const ok = await api(null, 'POST', '/api/register', { ...base, correo: correoNuevo('pw8'), password: '12345678' }, ip());
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
  });

  test('accept público con 7 caracteres -> 400 (la invitación no se consume); con 8 -> 201', async () => {
    const correo = correoNuevo('pwacc');
    const r = await api(admToken, 'POST', '/api/invitations/empleado', { email: correo, role: 'analista' });
    const token = r.json.id;
    const corta = await api(null, 'POST', `/api/invitations/${token}/accept`, { password: '1234567', displayName: 'P' }, ip());
    assert.equal(corta.status, 400);
    assert.equal((await db.collection('invitations').doc(token).get()).data().used, false);
    assert.equal((await api(null, 'POST', `/api/invitations/${token}/accept`, { password: '12345678', displayName: 'P' }, ip())).status, 201);
  });

  test('una cuenta EXISTENTE con contraseña corta sigue entrando (no se fuerza a las viejas)', async () => {
    const correo = correoNuevo('vieja-pw');
    await auth.createUser({ email: correo, password: '123456', emailVerified: true }); // 6 caracteres, como las de antes
    assert.ok(await tokenFor(correo, '123456'));
  });
});

describe('migrate_roles.js — reanudable', () => {
  const { migrarCuentas } = require('../scripts/migrate_roles');

  // Solo ve las cuentas que se le pasan (así la prueba no migra ni toca nada más del emulador).
  const authSolo = (uids, { fallaEnClaimsDe } = {}) => {
    let yaFallo = false;
    return {
      listUsers: async () => ({ users: await Promise.all(uids.map(u => auth.getUser(u))), pageToken: undefined }),
      setCustomUserClaims: async (uid, claims) => {
        if (uid === fallaEnClaimsDe && !yaFallo) { yaFallo = true; throw new Error('corte simulado a mitad de la migración'); }
        return auth.setCustomUserClaims(uid, claims);
      },
    };
  };
  const crearLegacy = async (sufijo, nCasos) => {
    const u = await auth.createUser({ email: correoNuevo(sufijo), password: PASSWORD, emailVerified: true });
    const casos = [];
    for (let i = 0; i < nCasos; i++) {
      const id = `t39c-caso-${sufijo}-${i}-${RUN}`;
      await db.collection('cases').doc(id).set({ status: 'fase_01', caseCode: `T39C-${sufijo}-${i}`, clientId: u.uid, clientEmail: u.email, createdAt: admin.firestore.Timestamp.now() });
      casos.push(id);
    }
    return { uid: u.uid, email: u.email, casos };
  };
  const estadoFinal = async (u) => {
    const claims = (await auth.getUser(u.uid)).customClaims || {};
    const org = (await db.collection('orgs').doc(`mig_${u.uid}`).get());
    const casos = await Promise.all(u.casos.map(async id => (await db.collection('cases').doc(id).get()).data().orgId));
    const duplicadas = (await db.collection('orgs').where('nombre', '==', `Empresa de ${u.email}`).get()).size;
    return { role: claims.role, orgIdClaim: claims.orgId === `mig_${u.uid}`, orgExiste: org.exists, orgCreadaPor: org.data()?.createdBy, casosConOrg: casos.every(o => o === `mig_${u.uid}`), duplicadas };
  };
  const silencio = () => {};

  test('cortar a mitad (fallo simulado al poner los claims) y re-correr -> mismo resultado final que sin corte, sin empresas duplicadas', async () => {
    const A = await crearLegacy('mig-A', 2); // la que sufre el corte
    const B = await crearLegacy('mig-B', 2); // control: corrida sin cortes

    // corrida 1 con corte: la empresa y los casos de A ya se escribieron, los claims NO
    await assert.rejects(
      migrarCuentas({ auth: authSolo([A.uid, B.uid], { fallaEnClaimsDe: A.uid }), db, admin, dryRun: false, log: silencio }),
      /corte simulado/);
    const aMedias = await estadoFinal(A);
    assert.equal(aMedias.role, undefined, 'A todavía no tiene role: sigue "pendiente" para la re-corrida');
    assert.equal(aMedias.orgExiste, true, 'su empresa (id determinista) ya existe');
    assert.equal(aMedias.casosConOrg, true, 'sus casos ya tienen orgId (antes de los claims)');

    // corrida 2 sin corte: completa A y B
    await migrarCuentas({ auth: authSolo([A.uid, B.uid]), db, admin, dryRun: false, log: silencio });
    const a = await estadoFinal(A), b = await estadoFinal(B);
    const esperado = { role: 'cliente_titular', orgIdClaim: true, orgExiste: true, orgCreadaPor: 'migrate_roles', casosConOrg: true, duplicadas: 1 };
    assert.deepEqual(a, esperado, 'A (con corte) termina igual que lo esperado');
    assert.deepEqual(b, esperado, 'B (sin corte) igual: mismo resultado final');

    // corrida 3: idempotente — no hay nada más que migrar
    const r3 = await migrarCuentas({ auth: authSolo([A.uid, B.uid]), db, admin, dryRun: false, log: silencio });
    assert.equal(r3.migratedCliente, 0);
    assert.equal(r3.skipped, 2);
    assert.deepEqual(await estadoFinal(A), esperado);
  });

  test('con la empresa ya creada por un corte anterior también se reanuda sin duplicar', async () => {
    const C = await crearLegacy('mig-C', 1);
    await db.collection('orgs').doc(`mig_${C.uid}`).set({ nombre: `Empresa de ${C.email}`, createdAt: admin.firestore.Timestamp.now(), createdBy: 'migrate_roles' });
    await migrarCuentas({ auth: authSolo([C.uid]), db, admin, dryRun: false, log: silencio });
    const c = await estadoFinal(C);
    assert.equal(c.role, 'cliente_titular');
    assert.equal(c.duplicadas, 1);
    assert.equal(c.casosConOrg, true);
  });

  test('una cuenta sin role pero con orgId en sus claims conserva SU empresa (no se le crea otra)', async () => {
    const E = await crearLegacy('mig-E', 1);
    await auth.setCustomUserClaims(E.uid, { orgId: `org-previa-${RUN}` });
    await migrarCuentas({ auth: authSolo([E.uid]), db, admin, dryRun: false, log: silencio });
    const claims = (await auth.getUser(E.uid)).customClaims;
    assert.equal(claims.role, 'cliente_titular');
    assert.equal(claims.orgId, `org-previa-${RUN}`);
    assert.equal((await db.collection('orgs').doc(`mig_${E.uid}`).get()).exists, false, 'no se creó una empresa nueva');
    assert.equal((await db.collection('cases').doc(E.casos[0]).get()).data().orgId, `org-previa-${RUN}`);
  });

  test('--dry-run no escribe nada (ni empresa, ni casos, ni claims)', async () => {
    const D = await crearLegacy('mig-D', 1);
    const r = await migrarCuentas({ auth: authSolo([D.uid]), db, admin, dryRun: true, log: silencio });
    assert.equal(r.migratedCliente, 1);
    assert.equal(r.casesFixed, 1, 'cuenta lo que haría');
    const d = await estadoFinal(D);
    assert.equal(d.role, undefined);
    assert.equal(d.orgExiste, false);
    assert.equal(d.casosConOrg, false);
  });
});

describe('--project y backfill de invitaciones', () => {
  const { resolverModo } = require('../scripts/migrate_roles');
  const { normalizarInvitaciones } = require('../scripts/backfill_invitaciones');

  test('resolverModo: --prod exige --project=<id>; si el entorno define otro proyecto, discrepancia = error', () => {
    assert.match(resolverModo(['--prod'], {}).error, /--project/);
    assert.equal(resolverModo(['--prod', '--project=farmazed'], {}).proyecto, 'farmazed');
    assert.equal(resolverModo(['--prod', '--project=farmazed'], {}).dryRun, true);
    assert.equal(resolverModo(['--prod', '--project=farmazed', '--confirm'], { FIREBASE_PROJECT_ID: 'farmazed' }).dryRun, false);
    assert.match(resolverModo(['--prod', '--project=farmazed', '--confirm'], { FIREBASE_PROJECT_ID: 'otro' }).error, /no coincide/);
    assert.match(resolverModo(['--prod', '--project=farmazed', '--confirm'], { GCLOUD_PROJECT: 'otro' }).error, /no coincide/);
    assert.match(resolverModo(['--prod', '--project=farmazed', '--project=otro'], {}).error, /más de una vez/);
  });

  test('backfill_invitaciones: dry-run lista sin escribir; real normaliza; segunda corrida no cambia nada', async () => {
    const sucia = await invitacionDirecta({ email: `  T39C-Sucia-${RUN}@Farmazed.TEST `, createdHaceDias: 1 });
    const mayus = await invitacionDirecta({ email: `T39C-MAYUS-${RUN}@farmazed.test`, createdHaceDias: 1 });
    const limpia = await invitacionDirecta({ email: `t39c-limpia-${RUN}@farmazed.test`, createdHaceDias: 1 });
    const leer = async (t) => (await db.collection('invitations').doc(t).get()).data().email;
    const silencio = () => {};

    const seco = await normalizarInvitaciones({ db, dryRun: true, log: silencio });
    assert.ok(seco.cambios >= 2);
    assert.equal(await leer(sucia), `  T39C-Sucia-${RUN}@Farmazed.TEST `, 'dry-run: nada escrito');

    await normalizarInvitaciones({ db, dryRun: false, log: silencio });
    assert.equal(await leer(sucia), `t39c-sucia-${RUN}@farmazed.test`);
    assert.equal(await leer(mayus), `t39c-mayus-${RUN}@farmazed.test`);
    assert.equal(await leer(limpia), `t39c-limpia-${RUN}@farmazed.test`);

    assert.equal((await normalizarInvitaciones({ db, dryRun: false, log: silencio })).cambios, 0, 'idempotente');
  });
});

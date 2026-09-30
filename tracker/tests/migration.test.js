/**
 * migration.test.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Verifica el resultado de scripts/migrate_roles.js sobre las cuentas
 * LEGACY sembradas por scripts/seed_emulador.js (admin@farmazed.test,
 * cliente@farmazed.test) — DESPUÉS de correrlo. Ver
 * tracker/scripts/run_permission_tests.sh, que hace: seed_emulador ->
 * seed_roles -> tracker arriba -> permissions.test.js -> migrate_roles.js ->
 * este archivo.
 *
 * Nota de diseño: `admin:true` ya pasaba `requirePermission` vía el fallback
 * de `effectiveRole()` (compatibilidad — ver middleware/permissions.js),
 * así que probar la migración del admin por COMPORTAMIENTO HTTP no
 * distinguiría "ya funcionaba por el fallback" de "de verdad migró". Por
 * eso esto lee los custom claims directo con el Admin SDK. Para el cliente,
 * SÍ hay un comportamiento nuevo observable: sus casos legacy (sin orgId)
 * deben seguir apareciéndole en la lista después de migrar — eso prueba que
 * el backfill de `orgId` en esos casos funcionó (si hubiera fallado, el
 * nuevo filtro por orgId los habría hecho desaparecer).
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const admin  = require('firebase-admin');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('migration.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos — usar run_permission_tests.sh.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';

async function idTokenFor(email) {
  const res = await fetch(
    `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }) }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

describe('migrate_roles.js — cuenta admin legacy', () => {
  test('admin@farmazed.test tiene role:"admin" (y conserva admin:true)', async () => {
    const users = await admin.auth().listUsers(1000);
    const user  = users.users.find(u => u.email === 'admin@farmazed.test');
    assert.ok(user, 'admin@farmazed.test no existe — ¿corrió seed_emulador.js?');
    assert.equal(user.customClaims?.role, 'admin');
    assert.equal(user.customClaims?.admin, true);
  });
});

describe('migrate_roles.js — cuenta cliente legacy', () => {
  let orgId;

  test('cliente@farmazed.test tiene role:"cliente_titular" y un orgId nuevo', async () => {
    const users = await admin.auth().listUsers(1000);
    const user  = users.users.find(u => u.email === 'cliente@farmazed.test');
    assert.ok(user, 'cliente@farmazed.test no existe — ¿corrió seed_emulador.js?');
    assert.equal(user.customClaims?.role, 'cliente_titular');
    assert.ok(user.customClaims?.orgId, 'no se le asignó orgId');
    orgId = user.customClaims.orgId;
  });

  test('sus 3 casos legacy quedaron con ese orgId (backfill)', async () => {
    const db = admin.firestore();
    const snap = await db.collection('cases').where('clientId', '==', 'seed-client-uid').get();
    assert.ok(snap.size >= 3, `esperaba al menos 3 casos legacy, encontré ${snap.size}`);
    snap.docs.forEach(d => {
      assert.equal(d.data().orgId, orgId, `caso ${d.id} no tiene el orgId del backfill`);
    });
  });

  test('sigue viendo sus mismos 3 casos por GET /api/cases (el backfill no le rompió el acceso)', async () => {
    const token = await idTokenFor('cliente@farmazed.test');
    const res   = await fetch(`${API_BASE}/api/cases`, { headers: { Authorization: `Bearer ${token}` } });
    const json  = await res.json();
    assert.equal(res.status, 200);
    const ids = json.cases.map(c => c.id);
    assert.ok(ids.includes('seed-case-draft'));
    assert.ok(ids.includes('seed-case-in-review'));
    assert.ok(ids.includes('seed-case-approved'));
  });
});

describe('migrate_roles.js — idempotencia', () => {
  test('las cuentas de seed_roles.js (ya con role) no fueron tocadas', async () => {
    const users = await admin.auth().listUsers(1000);
    const analista = users.users.find(u => u.email === 'analista@farmazed.test');
    assert.ok(analista);
    assert.equal(analista.customClaims?.role, 'analista');
    assert.equal(analista.customClaims?.orgId, undefined); // el staff no tiene empresa
  });
});

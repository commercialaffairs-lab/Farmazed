/**
 * seed_roles_lista.test.js — TAREA 46. scripts/seed_roles.js en modo lista (clientes y personal con contraseña
 * aleatoria) corrido como proceso real contra el emulador: crea, no duplica, dry-run no escribe,
 * rechaza roles no permitidos y las cuentas sembradas entran a la API con sus permisos.
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { admin, db, RUN, idTokenFor, api, crearTitular, crearCaso } = require('./_fixtures');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'seed_roles.js');
const PROYECTO = 'demo-farmazed';
const correo = (s) => `t46-${s}-${RUN}@farmazed.test`;

const C1 = { correo: correo('c1'), nombre: 'Cliente Uno', empresa: `Empresa Uno ${RUN}` };
const C2 = { correo: correo('c2'), nombre: 'Cliente Dos', empresa: `Empresa Dos ${RUN}` };
const S1 = { correo: correo('regente'), nombre: 'Xenia Test', rol: 'regente' };
const flag = (c) => `--cliente=${c.correo}|${c.nombre}|${c.empresa}`;
const flagStaff = (s) => `--staff=${s.correo}|${s.nombre}|${s.rol}`;

function seed(...args) {
  const r = spawnSync('node', [SCRIPT, `--project=${PROYECTO}`, ...args], { env: process.env, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const passwordDe = (out, c) => out.split('\n').find(l => l.includes(c.correo))?.split('UNA vez): ')[1]?.trim();
const existe = (c) => admin.auth().getUserByEmail(c).then(() => true, () => false);

describe('seed_roles.js — modo lista', () => {
  let pw1, pw2, pwS;

  test('guardas: --prod con emuladores, --confirm sin --prod y falta de --project se rechazan', () => {
    assert.equal(seed('--prod', flag(C1)).code, 1);
    assert.equal(seed('--confirm', flag(C1)).code, 1);
    assert.equal(spawnSync('node', [SCRIPT, flag(C1)], { env: process.env, encoding: 'utf8' }).status, 1, 'sin --project');
    assert.equal(seed(flag(C1), flag(C1)).code, 1, 'correo repetido');
  });

  test('--dry-run lista y no escribe nada', async () => {
    const r = seed('--dry-run', flag(C1), flag(C2), flagStaff(S1));
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /DRY-RUN: 3 por crear/);
    assert.equal(await existe(C1.correo), false);
    assert.equal(await existe(S1.correo), false);
  });

  test('un correo marcador (.invalid) se lista en dry-run pero no se escribe', async () => {
    const marcador = `--staff=xenia-${RUN}@pendiente.invalid|Xenia Mendoza|regente`;
    assert.match(seed('--dry-run', marcador).out, /crearía personal \(regente\)/);
    assert.equal(seed(marcador).code, 1);
    assert.equal(await existe(`xenia-${RUN}@pendiente.invalid`), false);
  });

  test('rechaza staff con rol admin o cliente_*, y rol inventado', async () => {
    for (const rol of ['admin', 'cliente_titular', 'cliente_miembro', 'jefe']) {
      const r = seed(`--staff=${correo('x')}|X|${rol}`);
      assert.equal(r.code, 1, rol);
      assert.match(r.err, /rol debe ser uno de/);
    }
    assert.equal(await existe(correo('x')), false);
  });

  test('crea 2 clientes y 1 regente: claims, empresa propia, contraseña impresa una vez', async () => {
    const r = seed(flag(C1), flag(C2), flagStaff(S1));
    assert.equal(r.code, 0, r.err);
    [pw1, pw2, pwS] = [passwordDe(r.out, C1), passwordDe(r.out, C2), passwordDe(r.out, S1)];
    for (const p of [pw1, pw2, pwS]) assert.ok(p && p.length >= 16);
    assert.equal(r.out.split(pw1).length - 1, 1, 'la contraseña sale una sola vez');

    const u1 = await admin.auth().getUserByEmail(C1.correo), u2 = await admin.auth().getUserByEmail(C2.correo);
    assert.equal(u1.emailVerified, true);
    assert.equal(u1.displayName, C1.nombre);
    assert.equal(u1.customClaims.role, 'cliente_titular');
    assert.equal(u1.customClaims.origen, 'seed');
    assert.notEqual(u1.customClaims.orgId, u2.customClaims.orgId, 'cada cliente tiene su propia empresa');
    const org = (await db.collection('orgs').doc(u1.customClaims.orgId).get()).data();
    assert.equal(org.nombre, C1.empresa);
    assert.equal(org.createdBy, null);

    const s = await admin.auth().getUserByEmail(S1.correo);
    assert.equal(s.emailVerified, true);
    assert.deepEqual(s.customClaims, { role: 'regente', origen: 'seed' });
  });

  test('segundo run: no duplica ni cambia contraseñas ni empresas', async () => {
    const empresas = async () => (await db.collection('orgs').where('nombre', 'in', [C1.empresa, C2.empresa]).get()).size;
    const antes = await empresas();
    const r = seed(flag(C1), flag(C2), flagStaff(S1));
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /0 creada\(s\), 3 ya existían/);
    assert.equal(await empresas(), antes);
    await idTokenFor(C1.correo, pw1); // la contraseña original sigue valiendo
  });

  describe('las cuentas sembradas entran a la API', () => {
    let casoPropio, casoAjeno;
    before(async () => {
      const u1 = await admin.auth().getUserByEmail(C1.correo);
      const ajeno = await crearTitular('t46-ajeno');
      casoPropio = await crearCaso('t46-propio', { orgId: u1.customClaims.orgId, clientId: u1.uid });
      casoAjeno = await crearCaso('t46-ajeno', { orgId: ajeno.orgId, clientId: ajeno.uid });
    });

    test('el cliente ve el caso de su empresa (200) y no el de otra (403)', async () => {
      const token = await idTokenFor(C1.correo, pw1);
      assert.equal((await api(token, 'GET', `/api/cases/${casoPropio}`)).status, 200);
      assert.equal((await api(token, 'GET', `/api/cases/${casoAjeno}`)).status, 403);
    });

    test('el regente entra a la bandeja de staff (200) y no al área de admin (403)', async () => {
      const token = await idTokenFor(S1.correo, pwS);
      assert.equal((await api(token, 'GET', '/api/orgs/leads')).status, 200);
      assert.equal((await api(token, 'GET', '/api/employees')).status, 403);
      assert.equal((await api(token, 'GET', '/api/admin/revisiones-pago')).status, 403);
    });
  });
});

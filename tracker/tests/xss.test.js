/**
 * xss.test.js — TAREA 37 (C1). Tope de longitud y tipo en los campos
 * públicos (contact-leads, register, captación). Mismo patrón y puertos que
 * registro_captacion.test.js:
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/xss.test.js
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const AUTH_PORT = process.env.FZ_AUTH_PORT;
const API_PORT  = process.env.FZ_API_PORT;
if (!AUTH_PORT || !API_PORT) throw new Error('xss.test.js: FZ_AUTH_PORT / FZ_API_PORT no definidos.');
const API_BASE = `http://localhost:${API_PORT}`;

// El rate limit es por IP (5/10min): una IP sintética distinta por llamada.
const { ipUnica } = require('./_ip');
const ip = () => ({ 'X-Forwarded-For': ipUnica() });

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...ip() }, body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function idTokenFor(email) {
  const res = await fetch(
    `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Farmazed123!', returnSecureToken: true }) }
  );
  return (await res.json()).idToken;
}

const LEAD_OK = { nombre: 'Ana', correo: 'ana@farmazed.test', empresa: 'Ana Co', tipoProducto: 'medicamentos' };
const REG_OK  = () => ({
  nombre: 'Reg', correo: `xss-${Date.now()}-${process.pid}@farmazed.test`, password: 'Farmazed123!',
  telefono: '+507 6000-0000', empresa: 'Reg Co', pais: 'Panamá',
});
const x = (n) => 'a'.repeat(n);

describe('POST /api/contact-leads — topes de longitud y tipo', () => {
  test('en el tope exacto (nombre 120) se acepta', async () => {
    const { status } = await post('/api/contact-leads', { ...LEAD_OK, nombre: x(120) });
    assert.equal(status, 201);
  });
  for (const [campo, max] of [['nombre', 120], ['empresa', 120], ['tipoProducto', 120]]) {
    test(`${campo} de ${max + 1} caracteres -> 400`, async () => {
      const { status } = await post('/api/contact-leads', { ...LEAD_OK, [campo]: x(max + 1) });
      assert.equal(status, 400);
    });
  }
  test('correo de más de 254 caracteres -> 400', async () => {
    const { status } = await post('/api/contact-leads', { ...LEAD_OK, correo: `${x(250)}@farmazed.test` });
    assert.equal(status, 400);
  });
  for (const [campo, valor] of [['nombre', 123], ['nombre', { a: 1 }], ['nombre', ['x']], ['empresa', 5], ['tipoProducto', {}], ['correo', ['a@b.co']]]) {
    test(`${campo} no-string (${JSON.stringify(valor)}) -> 400`, async () => {
      const { status } = await post('/api/contact-leads', { ...LEAD_OK, [campo]: valor });
      assert.equal(status, 400);
    });
  }
  test('guarda el texto con trim (no lo escapa: el escape es del front)', async () => {
    const { status, json } = await post('/api/contact-leads', { ...LEAD_OK, nombre: '  <b>Ana</b>  ' });
    assert.equal(status, 201);
    assert.equal(json.nombre, '<b>Ana</b>');
  });
});

describe('POST /api/register — topes de longitud y tipo', () => {
  for (const [campo, max] of [['nombre', 120], ['empresa', 120], ['telefono', 40], ['pais', 80]]) {
    test(`${campo} de ${max + 1} caracteres -> 400`, async () => {
      const { status } = await post('/api/register', { ...REG_OK(), [campo]: x(max + 1) });
      assert.equal(status, 400);
    });
  }
  test('correo de más de 254 caracteres -> 400', async () => {
    const { status } = await post('/api/register', { ...REG_OK(), correo: `${x(250)}@farmazed.test` });
    assert.equal(status, 400);
  });
  for (const campo of ['nombre', 'empresa', 'telefono', 'pais', 'correo', 'password']) {
    test(`${campo} no-string -> 400`, async () => {
      const { status } = await post('/api/register', { ...REG_OK(), [campo]: { $ne: 1 } });
      assert.equal(status, 400);
    });
  }
  test('password de más de 128 caracteres -> 400', async () => {
    const { status } = await post('/api/register', { ...REG_OK(), password: x(129) });
    assert.equal(status, 400);
  });
  test('registro normal sigue funcionando (201)', async () => {
    const { status } = await post('/api/register', REG_OK());
    assert.equal(status, 201);
  });
});

describe('PATCH /api/orgs/mine/captacion — topes de longitud y tipo', () => {
  let token;
  before(async () => { token = await idTokenFor('titular-alfa@farmazed.test'); });
  const OK = {
    paisYNombreFabricante: 'Alemania — XYZ', categoriasProducto: ['medicamentos'], numeroProductosPorCategoria: '3',
    registroPrevioAutoridadReconocida: true, clienteNuevoOYaRegistrado: 'nuevo', productoConModificacionEnCurso: false,
  };
  const patch = async (body) => (await fetch(`${API_BASE}/api/orgs/mine/captacion`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).status;

  test('paisYNombreFabricante de 201 caracteres -> 400', async () => assert.equal(await patch({ ...OK, paisYNombreFabricante: x(201) }), 400));
  test('numeroProductosPorCategoria de 121 caracteres -> 400', async () => assert.equal(await patch({ ...OK, numeroProductosPorCategoria: x(121) }), 400));
  test('paisYNombreFabricante no-string -> 400', async () => assert.equal(await patch({ ...OK, paisYNombreFabricante: ['x'] }), 400));
  test('numeroProductosPorCategoria no-string -> 400', async () => assert.equal(await patch({ ...OK, numeroProductosPorCategoria: 3 }), 400));
  test('captación válida sigue guardándose (200)', async () => assert.equal(await patch(OK), 200));
});

// ── TAREA 37b: topes en PUT diagnóstico y POST empresarial/solicitar ──────────
describe('PUT /api/orgs/:orgId/diagnostico y POST /api/empresarial/solicitar — topes', () => {
  let staff, titular, orgId;
  before(async () => {
    staff = await idTokenFor('analista@farmazed.test');
    titular = await idTokenFor('titular-alfa@farmazed.test');
    const me = await fetch(`${API_BASE}/api/me/org`, { headers: { Authorization: `Bearer ${titular}` } }).then(r => r.json());
    orgId = me.id;
  });
  const DIAG = { clasificacion: 'a', rutaRecomendada: 'b', requisitosAplicables: 'c', estimadoTiempos: 'd', estimadoCostos: 'e' };
  const put = async (body) => (await fetch(`${API_BASE}/api/orgs/${orgId}/diagnostico`, {
    method: 'PUT', headers: { Authorization: `Bearer ${staff}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).status;
  const solicitar = async (body) => (await fetch(`${API_BASE}/api/empresarial/solicitar`, {
    method: 'POST', headers: { Authorization: `Bearer ${titular}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })).status;

  for (const campo of Object.keys(DIAG)) {
    test(`diagnóstico: ${campo} de 501 caracteres -> 400`, async () => assert.equal(await put({ ...DIAG, [campo]: x(501) }), 400));
    test(`diagnóstico: ${campo} no-string -> 400`, async () => assert.equal(await put({ ...DIAG, [campo]: { a: 1 } }), 400));
  }
  test('diagnóstico: en el tope exacto (500) se acepta (200)', async () => assert.equal(await put({ ...DIAG, clasificacion: x(500) }), 200));
  test('diagnóstico: solo espacios -> 400', async () => assert.equal(await put({ ...DIAG, clasificacion: '   ' }), 400));
  test('diagnóstico: campo ausente -> 400', async () => assert.equal(await put({ ...DIAG, estimadoCostos: undefined }), 400));
  test('diagnóstico válido sigue guardándose (200)', async () => assert.equal(await put(DIAG), 200));
  test('empresarial: productosEstimados de 1001 caracteres -> 400', async () => assert.equal(await solicitar({ productosEstimados: x(1001) }), 400));
  test('empresarial: productosEstimados no-string -> 400', async () => assert.equal(await solicitar({ productosEstimados: ['x'] }), 400));
});

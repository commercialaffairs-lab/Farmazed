/**
 * acceso_basico.test.js — TAREA 42 (H9). Huecos de la matriz de acceso que ninguna otra
 * suite cubría: sin token / token inválido (401), cuenta del registro abierto SIN verificar
 * (403 en toda la API), mensajes (empresa ajena 403, sin datos internos), empleados (solo
 * admin) y que un cliente no puede mover el estado de su caso.
 *
 * Crea sus propias empresas, usuarios y casos (tests/_fixtures.js).
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 node --test tracker/tests/acceso_basico.test.js
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./_fixtures');

const { api, db } = fx;
let adm, analista, titularA, titularB, sinVerificar, casoA;

before(async () => {
  adm      = await fx.idTokenFor('admin-e3@farmazed.test');
  analista = await fx.idTokenFor('analista@farmazed.test');
  titularA = await fx.crearTitular('acceso-a');
  titularB = await fx.crearTitular('acceso-b');
  sinVerificar = await fx.crearTitular('acceso-sinverif', { emailVerified: false, origen: 'registro' });
  casoA = await fx.crearCaso('acceso-a', { status: 'draft', orgId: titularA.orgId, clientId: titularA.uid, notes: 'NOTA INTERNA SOLO STAFF', faddi: { expedienteNumber: 'FADDI-SECRETO' } });
});

// Un endpoint de cada router protegido (ids inexistentes: la autenticación va ANTES de buscar nada).
const PROTEGIDOS = [
  ['GET', '/api/cases'], ['POST', '/api/cases'], ['GET', '/api/cases/x'], ['PATCH', '/api/cases/x'],
  ['GET', '/api/cases/x/documents'], ['GET', '/api/cases/x/messages'], ['POST', '/api/cases/x/messages'],
  ['GET', '/api/cases/x/payments'], ['POST', '/api/cases/x/payments'], ['GET', '/api/cases/x/formularios'],
  ['GET', '/api/quotes'], ['POST', '/api/quotes/x/pago/crear-orden'], ['POST', '/api/quotes/x/pago/capturar'],
  ['GET', '/api/orgs'], ['GET', '/api/me/org'], ['GET', '/api/me/permissions'], ['GET', '/api/employees'],
  ['POST', '/api/subscription/subscribe'], ['POST', '/api/subscription/cancel'], ['PUT', '/api/subscription/plan'],
  ['POST', '/api/admin/set-role'], ['GET', '/api/admin/code-graph'], ['GET', '/api/formularios'],
];

describe('Sin credenciales válidas -> 401 en todos los routers protegidos', () => {
  const casos = [
    ['sin token', {}],
    ['esquema distinto de Bearer', { Authorization: 'Basic dXNlcjpwYXNz' }],
    ['Bearer vacío', { Authorization: 'Bearer ' }],
    ['token que no es un JWT', { Authorization: 'Bearer esto-no-es-un-token' }],
    ['JWT con firma inventada', { Authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJ1aWQiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.' }],
  ];
  for (const [nombre, headers] of casos) {
    test(`${nombre} -> 401 (sin filtrar datos)`, async () => {
      for (const [method, path] of PROTEGIDOS) {
        const r = await api(null, method, path, method === 'GET' ? undefined : {}, headers);
        assert.equal(r.status, 401, `${method} ${path} devolvió ${r.status}`);
        assert.ok(!('cases' in r.json) && !('quotes' in r.json) && !('employees' in r.json), `${method} ${path} filtró datos`);
      }
    });
  }
});

describe('Cuenta del registro abierto SIN verificar -> 403 en pagos, empresas, cotizaciones y documentos', () => {
  const RUTAS = [
    ['POST', '/api/cases/x/payments'], ['GET', '/api/cases/x/payments'],
    ['GET', '/api/orgs'], ['GET', '/api/me/org'],
    ['GET', '/api/quotes'], ['POST', '/api/quotes/x/pago/crear-orden'], ['POST', '/api/quotes/x/respond'],
    ['GET', '/api/cases/x/documents'], ['POST', '/api/cases/x/documents'],
    ['POST', '/api/subscription/subscribe'], ['GET', '/api/cases'],
  ];
  for (const [method, path] of RUTAS) {
    test(`${method} ${path} -> 403 "Verifica tu correo"`, async () => {
      const r = await api(sinVerificar.token, method, path, method === 'GET' ? undefined : {});
      assert.equal(r.status, 403);
      assert.match(r.json.error, /Verifica tu correo/);
    });
  }

  test('control: la misma cuenta, ya verificada, sí entra (no es un 403 genérico)', async () => {
    await fx.admin.auth().updateUser(sinVerificar.uid, { emailVerified: true });
    const token = await fx.idTokenFor(sinVerificar.email); // token nuevo con email_verified:true
    assert.equal((await api(token, 'GET', '/api/cases')).status, 200);
  });
});

describe('Mensajes del caso', () => {
  test('el titular de OTRA empresa no puede leer ni escribir -> 403', async () => {
    assert.equal((await api(titularB.token, 'GET', `/api/cases/${casoA}/messages`)).status, 403);
    assert.equal((await api(titularB.token, 'POST', `/api/cases/${casoA}/messages`, { text: 'intruso' })).status, 403);
  });

  test('el titular de la empresa escribe; la lista solo trae campos públicos (sin senderId ni datos internos)', async () => {
    const enviado = await api(titularA.token, 'POST', `/api/cases/${casoA}/messages`, { text: 'Hola Farmazed' });
    assert.equal(enviado.status, 201);
    const lista = await api(adm, 'GET', `/api/cases/${casoA}/messages`);
    assert.equal(lista.status, 200);
    assert.equal(lista.json.total, 1);
    assert.deepEqual(Object.keys(lista.json.messages[0]).sort(), ['createdAt', 'id', 'senderName', 'senderRole', 'text']);
    assert.equal(lista.json.messages[0].senderRole, 'client');
  });

  test('texto vacío o de más de 4000 caracteres -> 400', async () => {
    assert.equal((await api(titularA.token, 'POST', `/api/cases/${casoA}/messages`, { text: '   ' })).status, 400);
    assert.equal((await api(titularA.token, 'POST', `/api/cases/${casoA}/messages`, { text: 'x'.repeat(4001) })).status, 400);
  });

  test('el cliente no ve las notas internas ni el seguimiento FADDI (GET del caso y lista)', async () => {
    const uno = await api(titularA.token, 'GET', `/api/cases/${casoA}`);
    assert.equal(uno.status, 200);
    const lista = await api(titularA.token, 'GET', '/api/cases');
    for (const [donde, texto] of [['GET /api/cases/:id', uno.text], ['GET /api/cases', lista.text]]) {
      assert.ok(!texto.includes('NOTA INTERNA SOLO STAFF'), `${donde} filtra las notas internas al cliente`);
      assert.ok(!texto.includes('FADDI-SECRETO'), `${donde} filtra el seguimiento FADDI al cliente`);
    }
  });

  test('control positivo: el admin SÍ ve notas y seguimiento FADDI (el filtro es solo para clientes)', async () => {
    const r = await api(adm, 'GET', `/api/cases/${casoA}`);
    assert.equal(r.json.notes, 'NOTA INTERNA SOLO STAFF');
    assert.equal(r.json.faddi.expedienteNumber, 'FADDI-SECRETO');
  });
});

describe('Empleados — solo admin', () => {
  test('admin -> 200, solo staff/admin (ningún cliente)', async () => {
    const r = await api(adm, 'GET', '/api/employees');
    assert.equal(r.status, 200);
    assert.ok(r.json.employees.some(e => e.role === 'analista'));
    assert.ok(r.json.employees.every(e => ['analista', 'abogado', 'regente', 'admin'].includes(e.role)));
    assert.ok(!r.json.employees.some(e => e.email === titularA.email));
  });
  test('analista y titular -> 403', async () => {
    assert.equal((await api(analista, 'GET', '/api/employees')).status, 403);
    assert.equal((await api(titularA.token, 'GET', '/api/employees')).status, 403);
  });
});

describe('El cliente no puede mover el estado de su caso', () => {
  const estado = async (id) => (await db.collection('cases').doc(id).get()).data().status;

  test('PATCH status en borrador: el campo se ignora o se rechaza, pero el estado no cambia', async () => {
    await api(titularA.token, 'PATCH', `/api/cases/${casoA}`, { status: 'fase_05' });
    assert.equal(await estado(casoA), 'draft');
  });

  test('ni con override:true ni tocando campos de staff (mass-assignment) cambia el caso', async () => {
    await api(titularA.token, 'PATCH', `/api/cases/${casoA}`, { status: 'fase_05', override: true, reason: 'x' });
    await api(titularA.token, 'PATCH', `/api/cases/${casoA}`, { notes: 'hackeado', faddi: { expedienteNumber: 'X' }, assignedTo: 'yo', priority: 'urgent' });
    const d = (await db.collection('cases').doc(casoA).get()).data();
    assert.equal(d.status, 'draft');
    assert.equal(d.notes, 'NOTA INTERNA SOLO STAFF');
    assert.equal(d.faddi.expedienteNumber, 'FADDI-SECRETO');
    assert.equal(d.assignedTo, null);
    assert.equal(d.priority, 'normal');
  });

  test('PATCH en un caso ya en fase_03 -> 400 y sigue en fase_03', async () => {
    const id = await fx.crearCaso('acceso-fase03', { status: 'fase_03', orgId: titularA.orgId, clientId: titularA.uid });
    const r = await api(titularA.token, 'PATCH', `/api/cases/${id}`, { status: 'fase_05' });
    assert.equal(r.status, 400);
    assert.equal(await estado(id), 'fase_03');
  });
});

describe('Los campos internos no salen al cliente en ninguna respuesta del caso', () => {
  let casoH;
  before(async () => {
    casoH = await fx.crearCaso('acceso-hist', { status: 'fase_04', orgId: titularA.orgId, clientId: titularA.uid });
    await db.collection('cases').doc(casoH).collection('statusHistory').add({
      from: 'fase_03', to: 'fase_04', override: true, reason: 'MOTIVO INTERNO OVERRIDE', by: 'uid-staff', byEmail: 'staff-interno@farmazed.test', at: fx.admin.firestore.Timestamp.now(),
    });
  });

  test('GET /history: el cliente solo ve from/to/at; el admin ve todo', async () => {
    const c = await api(titularA.token, 'GET', `/api/cases/${casoH}/history`);
    assert.equal(c.status, 200);
    assert.equal(c.json.total, 1);
    assert.deepEqual(Object.keys(c.json.history[0]).sort(), ['at', 'from', 'id', 'to']);
    assert.ok(!c.text.includes('MOTIVO INTERNO') && !c.text.includes('staff-interno'));
    const a = await api(adm, 'GET', `/api/cases/${casoH}/history`);
    assert.equal(a.json.history[0].reason, 'MOTIVO INTERNO OVERRIDE');
    assert.equal(a.json.history[0].byEmail, 'staff-interno@farmazed.test');
  });

  test('POST /api/cases: la respuesta al cliente no trae notes ni faddi', async () => {
    const r = await api(titularA.token, 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(r.status, 201, r.text);
    assert.ok(!('notes' in r.json) && !('faddi' in r.json));
  });

  test('PATCH de un campo permitido: la respuesta al cliente no trae notes ni faddi', async () => {
    const r = await api(titularA.token, 'PATCH', `/api/cases/${casoA}`, { product: { nombreComercial: 'X' }, notes: 'n', faddi: { a: 1 } });
    assert.equal(r.status, 200);
    assert.ok(!('notes' in r.json) && !('faddi' in r.json));
  });
});

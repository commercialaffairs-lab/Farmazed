/**
 * planes_y_leads.test.js — TAREA 34 (PM_COMMENTS §H.15). Los 3
 * flujos de alta desde los planes del landing: plan guardado al
 * registrarse, diagnóstico (Plan Consulta), leads sin cuenta del hero, y
 * solicitud/condiciones/aceptación del Plan Empresarial. Mismo patrón que
 * el resto de TAREA 32/33 — tracker real + emulador, puertos propios (ver
 * FZ_AUTH_PORT/FZ_API_PORT/FZ_FIRESTORE_PORT), proveedor de pagos SIEMPRE
 * mock (sin credenciales de PayPal en el entorno de prueba).
 *
 * Corre con:
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/planes_y_leads.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const admin  = require('firebase-admin');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('planes_y_leads.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';

async function idTokenFor(email) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function post(path, body, extraHeaders = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body),
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

let ipCounter = 0;
const { ipUnica } = require('./_ip');
function nextTestIp() { return ipUnica(); }

const EMAILS = {
  admin: 'admin-e3@farmazed.test',
  titular_beta: 'titular-beta@farmazed.test',
  miembro_alfa: 'miembro-alfa@farmazed.test',
  titular_alfa: 'titular-alfa@farmazed.test',
  analista: 'analista@farmazed.test',
};
const tokens = {};
before(async () => {
  for (const [key, email] of Object.entries(EMAILS)) tokens[key] = await idTokenFor(email);
});

describe('Registro con plan', () => {
  test('?plan=registro se guarda en la empresa', async () => {
    const correo = `lead34-plan-${Date.now()}@farmazed.test`;
    const { status, json } = await post('/api/register', {
      nombre: 'Plan Test', correo, password: PASSWORD, telefono: '+507 6000-4444', empresa: 'Plan Registro Co', pais: 'Panamá', plan: 'registro',
    }, { 'X-Forwarded-For': nextTestIp() });
    assert.equal(status, 201);
    const org = await admin.firestore().collection('orgs').doc(json.orgId).get();
    assert.equal(org.data().plan, 'registro');
  });

  test('plan inválido o ausente -> cae a "consulta" (default seguro, nunca se inventa otro)', async () => {
    const correo = `lead34-sinplan-${Date.now()}@farmazed.test`;
    const { status, json } = await post('/api/register', {
      nombre: 'Sin Plan', correo, password: PASSWORD, telefono: '+507 6000-5555', empresa: 'Sin Plan Co', pais: 'Panamá', plan: 'inventado',
    }, { 'X-Forwarded-For': nextTestIp() });
    assert.equal(status, 201);
    const org = await admin.firestore().collection('orgs').doc(json.orgId).get();
    assert.equal(org.data().plan, 'consulta');
  });
});

describe('PATCH /api/orgs/mine/plan — "subir de plan"', () => {
  test('cliente_miembro NO puede cambiar el plan (403)', async () => {
    const { status } = await apiAuth(tokens.miembro_alfa, 'PATCH', '/api/orgs/mine/plan', { plan: 'registro' });
    assert.equal(status, 403);
  });

  test('plan inválido -> 400', async () => {
    const { status } = await apiAuth(tokens.titular_alfa, 'PATCH', '/api/orgs/mine/plan', { plan: 'oro' });
    assert.equal(status, 400);
  });

  test('titular sube de plan -> GET /api/me/org lo refleja', async () => {
    const guardar = await apiAuth(tokens.titular_alfa, 'PATCH', '/api/orgs/mine/plan', { plan: 'registro' });
    assert.equal(guardar.status, 200);
    const org = await apiAuth(tokens.titular_alfa, 'GET', '/api/me/org');
    assert.equal(org.json.plan, 'registro');
  });
});

describe('Diagnóstico regulatorio (Plan Consulta)', () => {
  test('cliente NO puede cargarlo (403) — es del staff', async () => {
    const { status } = await apiAuth(tokens.titular_alfa, 'PUT', '/api/orgs/org-alfa/diagnostico', {
      clasificacion: 'x', rutaRecomendada: 'x', requisitosAplicables: 'x', estimadoTiempos: 'x', estimadoCostos: 'x',
    });
    assert.equal(status, 403);
  });

  test('falta un campo -> 400', async () => {
    const { status } = await apiAuth(tokens.analista, 'PUT', '/api/orgs/org-alfa/diagnostico', {
      clasificacion: 'Medicamento de síntesis química', rutaRecomendada: 'Regular',
    });
    assert.equal(status, 400);
  });

  test('staff carga el diagnóstico -> GET /api/me/org lo refleja al cliente', async () => {
    const data = {
      clasificacion: 'Medicamento de síntesis química, uso humano',
      rutaRecomendada: 'Registro sanitario por procedimiento Regular',
      requisitosAplicables: 'Dossier técnico completo, IEA, certificado de libre venta',
      estimadoTiempos: '6-9 meses',
      estimadoCostos: 'Honorarios Farmazed ~B/.1,855 + tasas oficiales ~B/.2,275',
    };
    const guardar = await apiAuth(tokens.analista, 'PUT', '/api/orgs/org-alfa/diagnostico', data);
    assert.equal(guardar.status, 200);

    const org = await apiAuth(tokens.titular_alfa, 'GET', '/api/me/org');
    assert.equal(org.json.diagnostico.clasificacion, data.clasificacion);
    assert.equal(org.json.diagnostico.estimadoCostos, data.estimadoCostos);
  });
});

describe('Lead sin cuenta — "Enviar consulta" del hero', () => {
  let leadId;

  test('POST público crea el lead', async () => {
    const { status, json } = await post('/api/contact-leads', {
      nombre: 'Consulta Hero', correo: `hero34-${Date.now()}@farmazed.test`, empresa: 'Hero Co', tipoProducto: 'Cosmético',
    }, { 'X-Forwarded-For': nextTestIp() });
    assert.equal(status, 201);
    leadId = json.id;
  });

  test('contacto.html: `mensaje` opcional se guarda; más de 1000 caracteres -> 400', async () => {
    const con = await post('/api/contact-leads', {
      nombre: 'Formulario Contacto', correo: `contacto-${Date.now()}@farmazed.test`, empresa: 'Lab Contacto', mensaje: '  Quiero registrar 3 cosméticos.  ',
    }, { 'X-Forwarded-For': nextTestIp() });
    assert.equal(con.status, 201, JSON.stringify(con.json));
    assert.equal(con.json.mensaje, 'Quiero registrar 3 cosméticos.');
    const largo = await post('/api/contact-leads', {
      nombre: 'Largo', correo: `largo-${Date.now()}@farmazed.test`, mensaje: 'x'.repeat(1001),
    }, { 'X-Forwarded-For': nextTestIp() });
    assert.equal(largo.status, 400);
  });

  test('rate limit básico (6to intento en la ventana -> 429)', async () => {
    const ip = nextTestIp();
    let ultimo;
    for (let i = 0; i < 6; i++) {
      ultimo = await post('/api/contact-leads', { nombre: 'x', correo: `rl34-${i}-${Date.now()}@farmazed.test` }, { 'X-Forwarded-For': ip });
    }
    assert.equal(ultimo.status, 429);
  });

  test('cliente NO puede verlos (403) — es del staff', async () => {
    const { status } = await apiAuth(tokens.titular_alfa, 'GET', '/api/contact-leads');
    assert.equal(status, 403);
  });

  test('staff/admin los ve; admin invita -> crea org+invitación y desaparece de la lista', async () => {
    const ver = await apiAuth(tokens.analista, 'GET', '/api/contact-leads');
    assert.equal(ver.status, 200);
    assert.ok(ver.json.leads.some(l => l.id === leadId));

    const invitar = await apiAuth(tokens.admin, 'POST', `/api/contact-leads/${leadId}/invitar`, { orgName: 'Hero Co Oficial' });
    assert.equal(invitar.status, 201);
    assert.ok(invitar.json.orgId);

    const org = await admin.firestore().collection('orgs').doc(invitar.json.orgId).get();
    assert.equal(org.data().nombre, 'Hero Co Oficial');

    const verDespues = await apiAuth(tokens.analista, 'GET', '/api/contact-leads');
    assert.ok(!verDespues.json.leads.some(l => l.id === leadId));
  });
});

describe('Plan Empresarial — solicitud, condiciones, aceptación', () => {
  // org-beta (titular-beta) — aislado de org-alfa, que ya usan otras describes de arriba.
  test('miembro no puede solicitar (403)', async () => {
    const { status } = await apiAuth(tokens.miembro_alfa, 'POST', '/api/empresarial/solicitar', { productosEstimados: 'x' });
    assert.equal(status, 403);
  });

  test('titular envía la solicitud -> estado "solicitada"', async () => {
    const { status, json } = await apiAuth(tokens.titular_beta, 'POST', '/api/empresarial/solicitar', {
      productosEstimados: '5 medicamentos de síntesis química, 2 cosméticos',
      necesidades: { modificaciones: true, etiquetado: false, informes: true },
    });
    assert.equal(status, 201);
    assert.equal(json.estado, 'solicitada');
  });

  test('segunda solicitud mientras hay una activa -> 409', async () => {
    const { status } = await apiAuth(tokens.titular_beta, 'POST', '/api/empresarial/solicitar', { productosEstimados: 'x' });
    assert.equal(status, 409);
  });

  test('aceptar ANTES de que haya condiciones -> 400', async () => {
    const { status } = await apiAuth(tokens.titular_beta, 'POST', '/api/empresarial/aceptar');
    assert.equal(status, 400);
  });

  test('admin define condiciones con un gestor que NO es analista -> 400', async () => {
    const { status } = await apiAuth(tokens.admin, 'PUT', '/api/empresarial/org-beta/condiciones', {
      monto: 500, periodo: 'mensual', gestorCuenta: 'role-titular-beta', // es cliente_titular, no analista
    });
    assert.equal(status, 400);
  });

  test('admin define condiciones válidas -> estado "condiciones_definidas"', async () => {
    const { status, json } = await apiAuth(tokens.admin, 'PUT', '/api/empresarial/org-beta/condiciones', {
      monto: 500, periodo: 'mensual', gestorCuenta: 'role-analista',
    });
    assert.equal(status, 200);
    assert.equal(json.estado, 'condiciones_definidas');
    assert.equal(json.gestorCuentaEmail, 'analista@farmazed.test');
    assert.ok(json.planId);
  });

  test('cliente_miembro no puede definir condiciones (403) — es del admin', async () => {
    const { status } = await apiAuth(tokens.titular_beta, 'PUT', '/api/empresarial/org-beta/condiciones', {
      monto: 1, periodo: 'mensual', gestorCuenta: 'role-analista',
    });
    assert.equal(status, 403);
  });

  test('titular acepta -> se suscribe (mismo campo org.suscripcion que el pago de la cotización) y queda "aceptada"', async () => {
    const { status, json } = await apiAuth(tokens.titular_beta, 'POST', '/api/empresarial/aceptar');
    assert.equal(status, 201);
    assert.equal(json.estado, 'activa'); // mock aprueba de una

    const org = await apiAuth(tokens.titular_beta, 'GET', '/api/me/org');
    assert.equal(org.json.suscripcion.estado, 'activa');
    assert.equal(org.json.propuestaEmpresarial.estado, 'aceptada');
  });
});

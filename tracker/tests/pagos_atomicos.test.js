/**
 * pagos_atomicos.test.js — TAREA 38 (C3/H6/H8). Pagos y suscripciones
 * atómicos: capturas en paralelo, reintentos, montos en centavos, doble
 * suscripción, cancelar idempotente, y el adaptador paypal.js con `fetch`
 * stubbeado (timeout, JSON inválido, approveUrl no-https, 422 idempotentes).
 *
 * Contra el tracker REAL sobre el emulador, proveedor `mock`, casos y
 * cotizaciones PROPIOS creados aquí (no los fixtures compartidos). Puertos
 * propios, mismo patrón que pagos_paypal.test.js:
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/pagos_atomicos.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const admin  = require('firebase-admin');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('pagos_atomicos.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const db       = admin.firestore();
const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';
const RUN      = Date.now(); // ids únicos por corrida: el emulador acumula datos entre corridas

async function idTokenFor(email) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// Usuario titular con su propia empresa (así subscribe/aceptar no chocan con
// el estado de org-alfa/org-beta que usan otros archivos de prueba).
async function crearTitular(sufijo) {
  const orgId = `t38-org-${sufijo}-${RUN}`;
  const email = `t38-${sufijo}-${RUN}@farmazed.test`;
  await db.collection('orgs').doc(orgId).set({ nombre: `T38 ${sufijo}`, createdAt: admin.firestore.Timestamp.now() });
  const u = await admin.auth().createUser({ email, password: PASSWORD, emailVerified: true });
  await admin.auth().setCustomUserClaims(u.uid, { role: 'cliente_titular', orgId });
  return { orgId, token: await idTokenFor(email) };
}

// Cotización 'aceptada' con una línea principal por caso (honorarios + tasa_dnfd).
async function crearCotizacion(id, orgId, lineas) {
  await db.collection('quotes').doc(id).set({
    orgId, estado: 'aceptada', caseIds: lineas.map(l => l.caseId),
    lineas: lineas.map(l => ({
      caseId: l.caseId, caseCode: l.caseId, tipo: 'principal', esExtranjero: false, aplicaIEA: false,
      monto: l.honorarios + l.tasas, conceptos: { honorarios: l.honorarios, tasa_dnfd: l.tasas },
    })),
    total: lineas.reduce((s, l) => s + l.honorarios + l.tasas, 0),
    createdAt: admin.firestore.Timestamp.now(),
  });
}

const pagosDe = async (caseId) => (await db.collection('cases').doc(caseId).collection('payments').get()).docs.map(d => ({ id: d.id, ...d.data() }));

let admToken, titular;
before(async () => {
  admToken = await idTokenFor('admin-e3@farmazed.test');
  titular = await crearTitular('pago');
  const plan = await api(admToken, 'PUT', '/api/subscription/plan', { nombre: 'Uso de plataforma T38', monto: 10, periodo: 'mensual' });
  assert.equal(plan.status, 200);
});

describe('Captura de pago atómica', () => {
  test('crear-orden dos veces reutiliza la orden; en paralelo no abre dos', async () => {
    const q = `t38-q-reuso-${RUN}`, c = `t38-c-reuso-${RUN}`;
    await crearCotizacion(q, titular.orgId, [{ caseId: c, honorarios: 100, tasas: 50 }]);

    const [a, b] = await Promise.all([1, 2].map(() => api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`)));
    const ok = [a, b].filter(r => r.status === 201 || r.status === 200);
    assert.ok(ok.length >= 1, JSON.stringify([a, b]));
    assert.ok([a, b].every(r => [200, 201, 409].includes(r.status)), JSON.stringify([a, b]));
    assert.equal(new Set(ok.map(r => r.json.orderId)).size, 1, 'una sola orden, no dos');

    const otra = await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`);
    assert.equal(otra.status, 200);
    assert.equal(otra.json.reutilizada, true);
    assert.equal(otra.json.orderId, ok[0].json.orderId);
  });

  test('capturar en paralelo (x2) -> exactamente un cobro y N pagos, con id determinista', async () => {
    const q = `t38-q-par-${RUN}`, c = `t38-c-par-${RUN}`;
    await crearCotizacion(q, titular.orgId, [{ caseId: c, honorarios: 100, tasas: 50 }]);
    const { json: { orderId } } = await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`);

    const resp = await Promise.all([1, 2].map(() => api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId })));
    assert.ok(resp.every(r => [200, 409].includes(r.status)), JSON.stringify(resp));
    assert.ok(resp.some(r => r.status === 200 && r.json.capturada), 'al menos una captura exitosa');

    const pagos = await pagosDe(c);
    assert.deepEqual(pagos.map(p => p.id).sort(), [`${orderId}_${c}_honorarios`, `${orderId}_${c}_tasa_dnfd`]);
    const q2 = (await db.collection('quotes').doc(q).get()).data();
    assert.equal(q2.pagoPaypal.estado, 'capturada');
    assert.ok(q2.pagoPaypal.captureId);
  });

  test('reintento tras capturar -> idempotente, sin duplicados', async () => {
    const q = `t38-q-reint-${RUN}`, c = `t38-c-reint-${RUN}`;
    await crearCotizacion(q, titular.orgId, [{ caseId: c, honorarios: 80, tasas: 20 }]);
    const { json: { orderId } } = await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`);
    assert.equal((await api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId })).status, 200);

    const segunda = await api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId });
    assert.equal(segunda.status, 200);
    assert.equal(segunda.json.yaEstaba, true);
    assert.equal((await pagosDe(c)).length, 2);
  });

  test('montos tipo 0.1+0.2 (float) no dan 409 — se comparan en centavos', async () => {
    const q = `t38-q-cent-${RUN}`, c1 = `t38-c-cent1-${RUN}`, c2 = `t38-c-cent2-${RUN}`;
    // recomputeTotal = 0.1 + 0.2 = 0.30000000000000004; PayPal (y el mock) devuelven 0.30
    await crearCotizacion(q, titular.orgId, [{ caseId: c1, honorarios: 0.1, tasas: 0 }, { caseId: c2, honorarios: 0.2, tasas: 0 }]);
    const { json: { orderId } } = await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`);
    const r = await api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  });

  test('monto distinto DESPUÉS de cobrar -> captura_discrepante: sin pagos, y crear-orden NO abre otra orden encima', async () => {
    const q = `t38-q-disc-${RUN}`, c = `t38-c-disc-${RUN}`;
    await crearCotizacion(q, titular.orgId, [{ caseId: c, honorarios: 70, tasas: 30 }]);
    const { json: { orderId } } = await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`);
    const ref = db.collection('quotes').doc(q);
    await ref.update({ 'pagoPaypal.expectedAmount': 999999 });

    const r = await api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId });
    assert.equal(r.status, 409);
    assert.equal(r.json.capturado, undefined, 'el cuerpo del proveedor no se le devuelve al cliente');
    const marcado = (await ref.get()).data().pagoPaypal;
    assert.equal(marcado.estado, 'captura_discrepante');
    assert.ok(marcado.captureId, 'se cobró: queda el captureId para reconciliar');
    assert.equal((await pagosDe(c)).length, 0);

    assert.equal((await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`)).status, 409);

    await ref.update({ 'pagoPaypal.expectedAmount': 100 }); // el admin lo corrige a mano
    assert.equal((await api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId })).status, 200);
    assert.equal((await pagosDe(c)).length, 2);
  });

  test('cotización con total 0 -> crear-orden 400 (no se cobra ni se abre el gate con $0)', async () => {
    const q = `t38-q-cero-${RUN}`, c = `t38-c-cero-${RUN}`;
    await crearCotizacion(q, titular.orgId, [{ caseId: c, honorarios: 0, tasas: 0 }]);
    assert.equal((await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`)).status, 400);
  });

  test('cobrado pero el registro falla -> captura_sin_registrar (con captureId), y reintentar lo completa sin recobrar', async () => {
    const q = `t38-q-sinreg-${RUN}`, malo = `t38/mala-${RUN}`, bueno = `t38-c-sinreg-${RUN}`;
    // "t38/mala" no es un id de documento válido: el batch de pagos no se puede armar
    await crearCotizacion(q, titular.orgId, [{ caseId: malo, honorarios: 60, tasas: 40 }]);
    const { json: { orderId } } = await api(titular.token, 'POST', `/api/quotes/${q}/pago/crear-orden`);

    const fallo = await api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId });
    assert.equal(fallo.status, 500);
    const roto = (await db.collection('quotes').doc(q).get()).data().pagoPaypal;
    assert.equal(roto.estado, 'captura_sin_registrar');
    assert.ok(roto.captureId, 'el captureId se guardó apenas se cobró');
    assert.equal(fallo.json.captureId, roto.captureId);

    // se "arregla" el dato y se reintenta: no vuelve a cobrar (captureOrder es idempotente) y registra
    await db.collection('quotes').doc(q).update({
      caseIds: [bueno],
      lineas: [{ caseId: bueno, caseCode: bueno, tipo: 'principal', esExtranjero: false, aplicaIEA: false, monto: 100, conceptos: { honorarios: 60, tasa_dnfd: 40 } }],
    });
    const ok = await api(titular.token, 'POST', `/api/quotes/${q}/pago/capturar`, { orderId });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal((await pagosDe(bueno)).length, 2);
  });
});

describe('Suscripción atómica e idempotente', () => {
  test('subscribe en paralelo (x2) -> una sola suscripción (el otro 409)', async () => {
    const t = await crearTitular('sub');
    const resp = await Promise.all([1, 2].map(() => api(t.token, 'POST', '/api/subscription/subscribe')));
    assert.deepEqual(resp.map(r => r.status).sort(), [201, 409], JSON.stringify(resp));
    const org = (await db.collection('orgs').doc(t.orgId).get()).data();
    assert.equal(org.suscripcion.estado, 'activa');
    assert.equal(org.suscripcion.subscriptionId, resp.find(r => r.status === 201).json.subscriptionId);
  });

  test('cancel sobre una suscripción ya cancelada -> 200 (idempotente)', async () => {
    const t = await crearTitular('cancel');
    assert.equal((await api(t.token, 'POST', '/api/subscription/subscribe')).status, 201);
    assert.equal((await api(t.token, 'POST', '/api/subscription/cancel')).status, 200);
    const otra = await api(t.token, 'POST', '/api/subscription/cancel');
    assert.equal(otra.status, 200);
    assert.equal(otra.json.estado, 'cancelada');
  });

  test('empresarial/aceptar en paralelo (x2) -> una sola suscripción (el otro 409)', async () => {
    const t = await crearTitular('emp');
    assert.equal((await api(t.token, 'POST', '/api/empresarial/solicitar', { productosEstimados: '10 productos' })).status, 201);
    const analista = await admin.auth().getUserByEmail('analista@farmazed.test');
    const cond = await api(admToken, 'PUT', `/api/empresarial/${t.orgId}/condiciones`, { monto: 500, periodo: 'mensual', gestorCuenta: analista.uid });
    assert.equal(cond.status, 200, JSON.stringify(cond.json));

    const resp = await Promise.all([1, 2].map(() => api(t.token, 'POST', '/api/empresarial/aceptar')));
    const estados = resp.map(r => r.status).sort();
    assert.equal(estados[0], 201, JSON.stringify(resp));
    assert.ok([400, 409].includes(estados[1]), JSON.stringify(resp)); // 409 (reserva) o 400 (ya aceptada)
    const org = (await db.collection('orgs').doc(t.orgId).get()).data();
    assert.equal(org.propuestaEmpresarial.estado, 'aceptada');
    assert.equal(org.suscripcion.estado, 'activa');
  });
});

describe('paypal.js con fetch stubbeado', () => {
  const fetchOriginal = globalThis.fetch;
  Object.assign(process.env, { PAYPAL_CLIENT_ID: 'id-prueba', PAYPAL_CLIENT_SECRET: 'secreto-prueba', PAYPAL_ENV: 'sandbox' });
  const paypal = require('../services/payments/paypal');

  const json = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
  // Responde por URL; el token OAuth siempre válido.
  function stub(handlers) {
    globalThis.fetch = async (url, opts) => {
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
      const h = handlers.find(([frag]) => String(url).includes(frag));
      if (!h) throw new Error(`fetch no esperado: ${url}`);
      return h[1](url, opts);
    };
  }
  const restaurar = () => { globalThis.fetch = fetchOriginal; delete process.env.PAYPAL_TIMEOUT_MS; };

  test('un fetch colgado se corta por timeout con un error claro', async () => {
    process.env.PAYPAL_TIMEOUT_MS = '50';
    // AbortSignal.timeout usa un timer sin referencia: este setTimeout mantiene vivo el event loop mientras el stub "cuelga".
    globalThis.fetch = (url, opts) => new Promise((_, rej) => {
      const vivo = setTimeout(() => {}, 5000);
      opts.signal.addEventListener('abort', () => { clearTimeout(vivo); rej(opts.signal.reason); });
    });
    try {
      await assert.rejects(paypal.createOrder({ amount: 1, currency: 'USD', referenceId: 'x', description: 'x' }), /timeout/);
    } finally { restaurar(); }
  });

  test('2xx con cuerpo que no es JSON -> error claro (antes: {} y orderId undefined)', async () => {
    stub([['/v2/checkout/orders', async () => ({ ok: true, status: 200, text: async () => '<html>gateway</html>' })]]);
    try {
      await assert.rejects(paypal.createOrder({ amount: 1, currency: 'USD', referenceId: 'x', description: 'x' }), /JSON válido/);
    } finally { restaurar(); }
  });

  test('approveUrl que no es https -> se rechaza', async () => {
    stub([['/v2/checkout/orders', async () => json(201, { id: 'O1', status: 'CREATED', links: [{ rel: 'approve', href: 'javascript:alert(1)' }] })]]);
    try {
      await assert.rejects(paypal.createOrder({ amount: 1, currency: 'USD', referenceId: 'x', description: 'x' }), /https/);
    } finally { restaurar(); }
    stub([['/v2/checkout/orders', async () => json(201, { id: 'O5', status: 'CREATED', links: [{ rel: 'approve', href: 'https://evil.example.com/checkoutnow?token=O5' }] })]]);
    try {
      await assert.rejects(paypal.createOrder({ amount: 1, currency: 'USD', referenceId: 'x', description: 'x' }), /paypal\.com/);
    } finally { restaurar(); }
    stub([['/v2/checkout/orders', async () => json(201, { id: 'O2', status: 'CREATED', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=O2' }] })]]);
    try {
      const r = await paypal.createOrder({ amount: 1, currency: 'USD', referenceId: 'x', description: 'x' });
      assert.equal(r.approveUrl, 'https://www.sandbox.paypal.com/checkoutnow?token=O2');
    } finally { restaurar(); }
  });

  test('captureOrder: 422 ORDER_ALREADY_CAPTURED -> lee la orden y sigue (no es error)', async () => {
    stub([
      ['/capture', async () => json(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] })],
      ['/v2/checkout/orders/O3', async () => json(200, { id: 'O3', status: 'COMPLETED', purchase_units: [{ amount: { value: '150.00', currency_code: 'USD' }, payments: { captures: [{ id: 'CAP3', amount: { value: '150.00', currency_code: 'USD' } }] } }] })],
    ]);
    try {
      const r = await paypal.captureOrder('O3');
      assert.deepEqual(r, { orderId: 'O3', status: 'COMPLETED', amount: 150, currency: 'USD', captureId: 'CAP3', captureStatus: undefined });
    } finally { restaurar(); }
  });

  test('captureOrder: otros errores de PayPal siguen siendo error', async () => {
    stub([['/capture', async () => json(500, { name: 'INTERNAL_SERVER_ERROR' })]]);
    try {
      await assert.rejects(paypal.captureOrder('O4'), /500/);
    } finally { restaurar(); }
  });

  test('cancelSubscription: 204 vacío OK; 422 SUBSCRIPTION_STATUS_INVALID = éxito; otro error falla', async () => {
    stub([['/cancel', async () => json(204)]]);
    try { assert.equal((await paypal.cancelSubscription('S1')).status, 'CANCELLED'); } finally { restaurar(); }
    const invalido = ['/cancel', async () => json(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'SUBSCRIPTION_STATUS_INVALID' }] })];
    stub([invalido, ['/v1/billing/subscriptions/S2', async () => json(200, { id: 'S2', status: 'CANCELLED', plan_id: 'P' })]]);
    try { assert.equal((await paypal.cancelSubscription('S2')).status, 'CANCELLED'); } finally { restaurar(); }
    // APPROVAL_PENDING no es "ya cancelada": se podría aprobar después y cobrar -> sigue siendo error
    stub([invalido, ['/v1/billing/subscriptions/S4', async () => json(200, { id: 'S4', status: 'APPROVAL_PENDING', plan_id: 'P' })]]);
    try { await assert.rejects(paypal.cancelSubscription('S4'), /422/); } finally { restaurar(); }
    stub([['/cancel', async () => json(403, { name: 'NOT_AUTHORIZED' })]]);
    try { await assert.rejects(paypal.cancelSubscription('S3'), /403/); } finally { restaurar(); }
  });
});

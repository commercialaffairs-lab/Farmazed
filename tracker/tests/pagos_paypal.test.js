/**
 * pagos_paypal.test.js — TAREA 33 (PM_COMMENTS §H.14). Suscripción
 * + pago de cotización con PayPal — contra el tracker REAL sobre el
 * emulador, SIEMPRE con el proveedor `mock` (sin PAYPAL_CLIENT_ID/SECRET/
 * ENV en el entorno de prueba — igual que en el emulador real). Mismo
 * patrón que permissions.test.js, puertos propios (ver
 * FZ_AUTH_PORT/FZ_API_PORT/FZ_FIRESTORE_PORT), para no interferir con
 * ninguna otra corrida (p.ej. la demo de Rick en tmux farmazed-demo).
 *
 * Corre con:
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/pagos_paypal.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fx     = require('./_fixtures');

const { admin, API_BASE } = fx;
const tokens = {};
// api(rol, ...): el token sale de `tokens[rol]` (admin, miembro_alfa, y el titular propio de cada describe).
const api = (role, method, path, body) => fx.api(tokens[role], method, path, body);

before(async () => {
  tokens.admin        = await fx.idTokenFor('admin-e3@farmazed.test');
  tokens.miembro_alfa = await fx.idTokenFor('miembro-alfa@farmazed.test');
  tokens.titular_susc = (await fx.crearTitular('paypal-susc')).token; // empresa propia: suscribir/cancelar no toca a otras suites
});

describe('Plan recurrente — admin define, el resto no', () => {
  test('admin crea/edita el plan', async () => {
    const { status, json } = await api('admin', 'PUT', '/api/subscription/plan', { nombre: 'Uso de plataforma', monto: 50, periodo: 'mensual' });
    assert.equal(status, 200);
    assert.equal(json.nombre, 'Uso de plataforma');
    assert.equal(json.monto, 50);
    assert.equal(json.proveedor, 'mock'); // sin credenciales de PayPal en el entorno de prueba
    assert.ok(json.planId);
  });

  test('cliente NO puede editar el plan (403)', async () => {
    const { status } = await api('titular_susc', 'PUT', '/api/subscription/plan', { nombre: 'x', monto: 1, periodo: 'mensual' });
    assert.equal(status, 403);
  });

  test('periodo inválido -> 400', async () => {
    const { status } = await api('admin', 'PUT', '/api/subscription/plan', { nombre: 'x', monto: 1, periodo: 'semanal' });
    assert.equal(status, 400);
  });

  test('GET /api/subscription/plan es público (sin token)', async () => {
    const res = await fetch(`${API_BASE}/api/subscription/plan`);
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.plan.nombre, 'Uso de plataforma');
  });
});

describe('Suscripción de la empresa — solo el titular', () => {
  test('cliente_miembro NO puede suscribir (403)', async () => {
    const { status } = await api('miembro_alfa', 'POST', '/api/subscription/subscribe');
    assert.equal(status, 403);
  });

  test('titular suscribe su empresa -> activa (mock aprueba de una)', async () => {
    const { status, json } = await api('titular_susc', 'POST', '/api/subscription/subscribe');
    assert.equal(status, 201);
    assert.equal(json.estado, 'activa');
    assert.ok(json.subscriptionId);

    const org = await api('titular_susc', 'GET', '/api/me/org');
    assert.equal(org.json.suscripcion.estado, 'activa');
    assert.equal(org.json.suscripcion.subscriptionId, json.subscriptionId);
  });

  test('suscribir de nuevo mientras está activa -> 409', async () => {
    const { status } = await api('titular_susc', 'POST', '/api/subscription/subscribe');
    assert.equal(status, 409);
  });

  test('cancelar -> estado cancelada; no bloquea nada más (no hay gate que la consulte)', async () => {
    const { status, json } = await api('titular_susc', 'POST', '/api/subscription/cancel');
    assert.equal(status, 200);
    assert.equal(json.estado, 'cancelada');
  });
});

describe('Pago de la cotización aceptada con PayPal', () => {
  let CASE_ID;
  let orgPago;
  let quoteId;
  let montoEsperado;
  let quoteSinOrden;

  before(async () => {
    // Empresa, titular y caso PROPIOS (Regular + Síntesis Química: categoría con montos > 0 en el tarifario).
    const t = await fx.crearTitular('paypal-pago');
    tokens.titular_pago = t.token;
    orgPago = t.orgId;
    CASE_ID = await fx.crearCaso('paypal-pago', {
      status: 'fase_03', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'],
      orgId: t.orgId, clientId: t.uid, clientEmail: t.email, clientName: 'Titular Pago PayPal', product: { nombreComercial: 'Producto Pago PayPal' },
    });
    await api('admin', 'PATCH', `/api/cases/${CASE_ID}`, { status: 'fase_04' });
    const { json } = await api('admin', 'GET', '/api/quotes');
    const quote = json.quotes.find(q => q.orgId === t.orgId && q.estado === 'borrador' && q.caseIds.includes(CASE_ID));
    quoteId = quote.id;
    await api('admin', 'POST', `/api/quotes/${quoteId}/send`);
    await api('titular_pago', 'POST', `/api/quotes/${quoteId}/respond`, { decision: 'aceptada' });

    const aceptada = await api('titular_pago', 'GET', `/api/quotes/${quoteId}`);
    montoEsperado = aceptada.json.lineas.reduce((s, l) => s + (l.monto || 0), 0);
    assert.ok(montoEsperado > 0, 'el fixture debe resolver a un tarifario con monto > 0');

    // Otra cotización aceptada de la MISMA empresa, a la que nunca se le creó orden.
    quoteSinOrden = `q-paypal-sin-orden-${fx.RUN}`;
    await fx.db.collection('quotes').doc(quoteSinOrden).set({ orgId: orgPago, estado: 'aceptada', caseIds: [], lineas: [], total: 10, createdAt: admin.firestore.Timestamp.now() });
  });

  test('crear-orden IGNORA cualquier monto que mande el cliente — siempre cobra el total real de la cotización', async () => {
    const { status, json } = await api('titular_pago', 'POST', `/api/quotes/${quoteId}/pago/crear-orden`, { amount: 1, monto: 1, orderId: 'lo-que-sea' });
    assert.equal(status, 201);
    assert.equal(json.amount, montoEsperado); // NUNCA el 1 que mandó el body
    assert.equal(json.currency, 'USD');
    assert.ok(json.orderId);
  });

  test('cliente_miembro no puede pagar (403 — por rol, o por org ajena si lo probara con otra empresa)', async () => {
    const { status } = await api('miembro_alfa', 'POST', `/api/quotes/${quoteId}/pago/crear-orden`);
    assert.equal(status, 403);
  });

  test('capturar ANTES de crear-orden (otra cotización, nunca tocada) -> 400', async () => {
    const { status, json } = await api('titular_pago', 'POST', `/api/quotes/${quoteSinOrden}/pago/capturar`, { orderId: 'cualquiera' });
    assert.equal(status, 400);
    assert.match(json.error, /crear-orden/);
  });

  test('capturar con orderId que NO es el de esta cotización -> 400, sin crear pagos', async () => {
    const { status, json } = await api('titular_pago', 'POST', `/api/quotes/${quoteId}/pago/capturar`, { orderId: 'orden-inventada-por-el-cliente' });
    assert.equal(status, 400);
    assert.match(json.error, /no coincide/);

    const pagos = await api('admin', 'GET', `/api/cases/${CASE_ID}/payments`);
    assert.equal(pagos.json.total, 0, 'ningún intento inválido debe crear pagos');
  });

  test('monto corrupto en el servidor (simulando que algo cambió) -> capturar rechaza, sin crear pagos', async () => {
    // No hay forma de lograr esto por la API pública (la cotización
    // 'aceptada' ya no se puede editar) — se corrompe directo en Firestore
    // para probar que la verificación de monto en el servidor de verdad
    // frena algo, no es decorativa.
    const quoteRef = admin.firestore().collection('quotes').doc(quoteId);
    const antes = (await quoteRef.get()).data().pagoPaypal;
    await quoteRef.update({ 'pagoPaypal.expectedAmount': 999999 });

    const { status, json } = await api('titular_pago', 'POST', `/api/quotes/${quoteId}/pago/capturar`, { orderId: antes.orderId });
    assert.equal(status, 409);

    const pagos = await api('admin', 'GET', `/api/cases/${CASE_ID}/payments`);
    assert.equal(pagos.json.total, 0, 'un monto que no calza no debe crear ningún pago');

    await quoteRef.update({ 'pagoPaypal.expectedAmount': antes.expectedAmount }); // deshacer la corrupción
  });

  test('capturar de verdad -> crea los pagos por concepto (honorarios + tasa_dnfd, sin mef/iea — esExtranjero/aplicaIEA son false por defecto)', async () => {
    const quoteRef = admin.firestore().collection('quotes').doc(quoteId);
    const { orderId } = (await quoteRef.get()).data().pagoPaypal;

    const { status, json } = await api('titular_pago', 'POST', `/api/quotes/${quoteId}/pago/capturar`, { orderId });
    assert.equal(status, 200);
    assert.equal(json.capturada, true);
    assert.equal(json.amount, montoEsperado);

    const conceptos = json.pagos.map(p => p.concepto).sort();
    assert.deepEqual(conceptos, ['honorarios', 'tasa_dnfd']);
    for (const p of json.pagos) assert.ok(p.monto > 0);

    const pagos = await api('admin', 'GET', `/api/cases/${CASE_ID}/payments`);
    assert.equal(pagos.json.total, 2);
    assert.ok(pagos.json.payments.every(p => p.origen === 'paypal' && p.paypalOrderId === orderId));
  });

  test('fase_05 se destraba por el gate normal — sin ningún cambio ahí, el pago de PayPal ya lo satisface', async () => {
    const avance = await api('admin', 'PATCH', `/api/cases/${CASE_ID}`, { status: 'fase_05' });
    assert.equal(avance.status, 200);
    const salida = await api('admin', 'PATCH', `/api/cases/${CASE_ID}`, { status: 'fase_06' });
    assert.equal(salida.status, 200, JSON.stringify(salida.json));
  });

  test('capturar DOS VECES no duplica pagos (idempotente)', async () => {
    const quoteRef = admin.firestore().collection('quotes').doc(quoteId);
    const { orderId } = (await quoteRef.get()).data().pagoPaypal;

    const segunda = await api('titular_pago', 'POST', `/api/quotes/${quoteId}/pago/capturar`, { orderId });
    assert.equal(segunda.status, 200);
    assert.equal(segunda.json.yaEstaba, true);

    const pagos = await api('admin', 'GET', `/api/cases/${CASE_ID}/payments`);
    assert.equal(pagos.json.total, 2, 'seguía siendo 2, no 4');
  });

  test('crear-orden sobre una cotización ya pagada -> 409', async () => {
    const { status } = await api('titular_pago', 'POST', `/api/quotes/${quoteId}/pago/crear-orden`);
    assert.equal(status, 409);
  });
});

describe('Webhook de PayPal — listo, sin uso real en local', () => {
  // Este entorno de prueba NUNCA tiene PAYPAL_CLIENT_ID/SECRET/ENV (por
  // diseño — "todo corre con mock"), así que el endpoint usa SIEMPRE
  // mock.verifyWebhookSignature(), que es `async () => true` a propósito
  // (no hay nada real que falsificar en el mock — ver services/payments/mock.js).
  // El "falla cerrado sin PAYPAL_WEBHOOK_ID" es responsabilidad del
  // adaptador paypal.js (ver services/payments/paypal.js), que esta
  // corrida no ejercita porque no hay credenciales — sin smoke-test real
  // contra PayPal todavía (Rick no ha creado la app sandbox).
  test('en modo mock, el endpoint responde 200 (nada real que verificar)', async () => {
    const res = await fetch(`${API_BASE}/api/webhooks/paypal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED' }),
    });
    assert.equal(res.status, 200);
  });

  test('paypal.js (el adaptador real) falla cerrado sin PAYPAL_WEBHOOK_ID — prueba unitaria pura, sin red', async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    const paypal = require('../services/payments/paypal');
    const valido = await paypal.verifyWebhookSignature({}, {});
    assert.equal(valido, false);
  });
});

/**
 * paypal_contrato.test.js — TAREA 42 (H9). Sin emulador ni tracker: todo en proceso.
 *  1. Webhook de PayPal: firma inválida -> 400 SIN efectos; firma válida -> 200. Con el
 *     proveedor stubbeado y con el adaptador REAL de paypal.js sobre un `fetch` stubbeado.
 *  2. Contrato de paypal.js: lo que SE ENVÍA a PayPal en createOrder/captureOrder (URL,
 *     cabeceras, cuerpo, monto con 2 decimales) y cómo se interpreta la respuesta.
 *
 *   node --test tracker/tests/paypal_contrato.test.js
 */
const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

Object.assign(process.env, { PAYPAL_CLIENT_ID: 'id-prueba', PAYPAL_CLIENT_SECRET: 'secreto-prueba', PAYPAL_ENV: 'sandbox' });
const paypal   = require('../services/payments/paypal');
const payments = require('../services/payments');

const fetchOriginal = globalThis.fetch;
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
afterEach(() => { globalThis.fetch = fetchOriginal; delete process.env.PAYPAL_WEBHOOK_ID; });

// ─── Webhook ────────────────────────────────────────────────────────────────────
describe('POST /api/webhooks/paypal — firma inválida no tiene efectos', () => {
  let server, base, proveedor, logs;
  const logOriginal = console.log;

  before(async () => {
    payments.getProvider = () => proveedor; // antes de cargar la ruta (la desestructura al requerirla)
    const app = express();
    app.use(express.json());
    app.use('/api/webhooks/paypal', require('../routes/webhooks'));
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise(r => server.close(r)));
  beforeEach(() => { logs = []; console.log = (...a) => logs.push(a.join(' ')); });
  afterEach(() => { console.log = logOriginal; });

  const enviar = (evento = { event_type: 'BILLING.SUBSCRIPTION.CANCELLED' }, headers = {}) =>
    globalThis.fetch(`${base}/api/webhooks/paypal`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(evento) });

  test('proveedor dice que la firma es inválida -> 400 y el evento NO se procesa', async () => {
    const vistos = [];
    proveedor = { verifyWebhookSignature: async (h, b) => { vistos.push(b); return false; } };
    const res = await enviar();
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Firma de webhook inválida/);
    assert.equal(vistos.length, 1, 'se verificó una vez');
    assert.ok(!logs.some(l => /verificado/.test(l)), 'un evento sin firma válida no se registra como verificado');
  });

  test('el proveedor falla (PayPal caído) -> NO es 200: nunca se acusa recibo de lo que no se verificó', async () => {
    proveedor = { verifyWebhookSignature: async () => { throw new Error('PayPal caído'); } };
    const res = await enviar();
    assert.notEqual(res.status, 200);
    assert.ok(res.status >= 400);
  });

  test('firma válida -> 200 y se acusa recibo', async () => {
    proveedor = { verifyWebhookSignature: async () => true };
    const res = await enviar();
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { received: true });
  });

  test('adaptador REAL: PayPal responde verification_status FAILURE -> 400', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'WH-1';
    proveedor = paypal;
    const llamadas = [];
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(base)) return fetchOriginal(url, opts); // la petición al propio servidor de prueba
      llamadas.push([String(url), opts]);
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
      return json(200, { verification_status: 'FAILURE' });
    };
    const res = await enviar({ event_type: 'X' }, { 'paypal-transmission-id': 'T1', 'paypal-transmission-sig': 'mala' });
    assert.equal(res.status, 400);
    const verif = llamadas.find(([u]) => u.endsWith('/v1/notifications/verify-webhook-signature'));
    assert.ok(verif, 'se consultó a PayPal');
    const enviado = JSON.parse(verif[1].body);
    assert.equal(enviado.webhook_id, 'WH-1');
    assert.equal(enviado.transmission_id, 'T1');
    assert.equal(enviado.transmission_sig, 'mala');
  });

  test('adaptador REAL: SUCCESS -> 200; sin PAYPAL_WEBHOOK_ID -> 400 sin llamar a PayPal', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'WH-1';
    proveedor = paypal;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(base)) return fetchOriginal(url, opts);
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
      return json(200, { verification_status: 'SUCCESS' });
    };
    assert.equal((await enviar()).status, 200);

    delete process.env.PAYPAL_WEBHOOK_ID;
    let aPayPal = 0;
    globalThis.fetch = async (url, opts) => { if (!String(url).startsWith(base)) aPayPal++; return String(url).startsWith(base) ? fetchOriginal(url, opts) : json(200, {}); };
    assert.equal((await enviar()).status, 400);
    assert.equal(aPayPal, 0, 'sin webhook id no hay nada que consultar');
  });
});

// ─── Contrato de paypal.js ──────────────────────────────────────────────────────
describe('paypal.js — contrato de createOrder / captureOrder', () => {
  test('createOrder envía intent CAPTURE, monto con 2 decimales, Bearer y devuelve orderId/approveUrl', async () => {
    const peticiones = [];
    globalThis.fetch = async (url, opts) => {
      peticiones.push({ url: String(url), opts });
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok-contrato', expires_in: 3600 });
      return json(201, { id: 'ORD-1', status: 'CREATED', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD-1' }] });
    };
    const r = await paypal.createOrder({ amount: 12.5, currency: 'USD', referenceId: 'quote-9', description: 'Cotización 9' });
    assert.deepEqual(r, { orderId: 'ORD-1', status: 'CREATED', approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD-1' });

    const orden = peticiones.find(p => p.url.endsWith('/v2/checkout/orders'));
    assert.equal(orden.url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders');
    assert.equal(orden.opts.method, 'POST');
    assert.match(orden.opts.headers.Authorization, /^Bearer .+/);
    assert.equal(orden.opts.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(orden.opts.body), {
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: 'quote-9', description: 'Cotización 9', amount: { currency_code: 'USD', value: '12.50' } }],
    });
  });

  test('captureOrder: POST a /capture y mapea monto, moneda, captureId y estado de la captura', async () => {
    const peticiones = [];
    globalThis.fetch = async (url, opts) => {
      peticiones.push({ url: String(url), opts });
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
      return json(201, { id: 'ORD-2', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP-2', status: 'COMPLETED', amount: { value: '150.00', currency_code: 'USD' } }] } }] });
    };
    const r = await paypal.captureOrder('ORD-2');
    assert.deepEqual(r, { orderId: 'ORD-2', status: 'COMPLETED', amount: 150, currency: 'USD', captureId: 'CAP-2', captureStatus: 'COMPLETED' });
    const captura = peticiones.find(p => p.url.endsWith('/capture'));
    assert.equal(captura.url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORD-2/capture');
    assert.equal(captura.opts.method, 'POST');
  });

  test('captureOrder con la orden COMPLETED pero la captura PENDING -> se reporta PENDING (el llamador no la da por cobrada)', async () => {
    globalThis.fetch = async (url) => String(url).endsWith('/v1/oauth2/token')
      ? json(200, { access_token: 'tok', expires_in: 3600 })
      : json(201, { id: 'ORD-3', status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP-3', status: 'PENDING', amount: { value: '10.00', currency_code: 'USD' } }] } }] });
    const r = await paypal.captureOrder('ORD-3');
    assert.equal(r.status, 'COMPLETED');
    assert.equal(r.captureStatus, 'PENDING');
  });

  test('el token OAuth se reutiliza entre llamadas (no se pide otro mientras sea vigente)', async () => {
    let oauth = 0;
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/v1/oauth2/token')) { oauth++; return json(200, { access_token: 'otro', expires_in: 3600 }); }
      return json(201, { id: 'ORD-4', status: 'CREATED', links: [] });
    };
    await paypal.createOrder({ amount: 1, currency: 'USD', referenceId: 'a', description: 'a' });
    await paypal.createOrder({ amount: 1, currency: 'USD', referenceId: 'b', description: 'b' });
    assert.ok(oauth <= 1, `se pidió ${oauth} veces el token OAuth para 2 llamadas (máx. 1, y 0 si ya había uno en caché)`);
  });
});

describe('paypal.js — idempotencia (PayPal-Request-Id) y OAuth', () => {
  // Módulo fresco: el token OAuth vive en una caché del módulo.
  const fresco = () => { delete require.cache[require.resolve('../services/payments/paypal')]; return require('../services/payments/paypal'); };
  const registrar = (respuestaOauth = { access_token: 'tok', expires_in: 3600 }) => {
    const llamadas = [];
    globalThis.fetch = async (url, opts) => {
      llamadas.push({ url: String(url), opts });
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, respuestaOauth);
      return json(201, { id: 'X-1', status: 'CREATED', links: [], purchase_units: [{ payments: { captures: [{ id: 'C', status: 'COMPLETED', amount: { value: '1.00', currency_code: 'USD' } }] } }] });
    };
    return llamadas;
  };

  test('createOrder / createSubscription mandan la clave que reciben; captureOrder usa una estable por orden', async () => {
    const pp = fresco();
    const llamadas = registrar();
    await pp.createOrder({ amount: 1, currency: 'USD', referenceId: 'q', description: 'd', requestId: 'order-q-100' });
    await pp.createSubscription({ planId: 'P-1', referenceId: 'org', requestId: 'sub-org-P-1-9' });
    await pp.captureOrder('ORD-9');
    await pp.captureOrder('ORD-9');
    const cab = (frag) => llamadas.filter(l => l.url.includes(frag)).map(l => l.opts.headers['PayPal-Request-Id']);
    assert.deepEqual(cab('/v2/checkout/orders') .filter(Boolean).slice(0, 1), ['order-q-100']);
    assert.deepEqual(cab('/v1/billing/subscriptions'), ['sub-org-P-1-9']);
    assert.deepEqual(cab('/capture'), ['capture-ORD-9', 'capture-ORD-9'], 'dos intentos de capturar la misma orden = la misma clave');
  });

  test('sin requestId no se manda la cabecera (no se inventa una clave distinta por intento)', async () => {
    const pp = fresco();
    const llamadas = registrar();
    await pp.createOrder({ amount: 1, currency: 'USD', referenceId: 'q', description: 'd' });
    assert.ok(!('PayPal-Request-Id' in llamadas.find(l => l.url.endsWith('/v2/checkout/orders')).opts.headers));
  });

  test('OAuth: Basic base64(id:secret), grant_type=client_credentials, form-urlencoded', async () => {
    const pp = fresco();
    const llamadas = registrar();
    await pp.createOrder({ amount: 1, currency: 'USD', referenceId: 'q', description: 'd' });
    const oauth = llamadas.find(l => l.url.endsWith('/v1/oauth2/token'));
    assert.equal(oauth.url, 'https://api-m.sandbox.paypal.com/v1/oauth2/token');
    assert.equal(oauth.opts.method, 'POST');
    assert.equal(oauth.opts.headers.Authorization, `Basic ${Buffer.from('id-prueba:secreto-prueba').toString('base64')}`);
    assert.equal(oauth.opts.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(oauth.opts.body, 'grant_type=client_credentials');
  });

  test('OAuth: el token se reutiliza mientras vale y se renueva al vencer (expires_in)', async () => {
    let pp = fresco();
    let llamadas = registrar({ access_token: 'largo', expires_in: 3600 });
    await pp.createOrder({ amount: 1, currency: 'USD', referenceId: 'a', description: 'a' });
    await pp.createOrder({ amount: 1, currency: 'USD', referenceId: 'b', description: 'b' });
    assert.equal(llamadas.filter(l => l.url.endsWith('/v1/oauth2/token')).length, 1, 'vigente: una sola petición de token');

    pp = fresco();
    llamadas = registrar({ access_token: 'corto', expires_in: 10 }); // dentro del margen de 30 s: ya cuenta como vencido
    await pp.createOrder({ amount: 1, currency: 'USD', referenceId: 'a', description: 'a' });
    await pp.createOrder({ amount: 1, currency: 'USD', referenceId: 'b', description: 'b' });
    assert.equal(llamadas.filter(l => l.url.endsWith('/v1/oauth2/token')).length, 2, 'vencido: se pide otro token');
  });
});

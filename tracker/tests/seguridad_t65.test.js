/**
 * seguridad_t65.test.js — TAREA 65. Sin emulador ni tracker: todo en proceso.
 *  1. Dependencias parcheadas (body-parser, nodemailer) tras `npm audit fix`.
 *  3. nginx.conf: 404 a ocultos/.map/.log/.md y Permissions-Policy también en el bloque de imágenes.
 *  5. Webhook de PayPal: la ruta recibe el cuerpo CRUDO y la verificación de firma lo envía literal.
 *  (El punto 2, subida de archivos, está en subida_archivos.test.js.)
 */
const { test, describe, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const express = require('express');

const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const version = (paquete) => require(`${paquete}/package.json`).version;

describe('1 — dependencias parcheadas', () => {
  test('body-parser >= 1.20.9 (DoS con cuerpo comprimido)', () => assert.ok(cmp(version('body-parser'), '1.20.9') >= 0, version('body-parser')));
  test('nodemailer >= 10.5.0 (addressparser)', () => assert.ok(cmp(version('nodemailer'), '10.5.0') >= 0, version('nodemailer')));
});

describe('3 — nginx.conf', () => {
  const conf = fs.readFileSync(path.join(__dirname, '../../nginx.conf'), 'utf8');
  const bloque = (patron) => { const i = conf.indexOf(patron); assert.ok(i >= 0, `falta ${patron}`); return conf.slice(i, conf.indexOf('}', i)); };

  test('ocultos, .map, .log y .md responden 404, y esa regla va ANTES de las de caché', () => {
    const regla = bloque('location ~ /\\.|\\.(map|log|md)$');
    assert.match(regla, /return 404;/);
    assert.ok(conf.indexOf('location ~ /\\.|') < conf.indexOf('location ~* \\.(html|json|js|css)$'), 'orden: gana la primera regex que coincide');
  });
  test('Permissions-Policy también en el bloque de imágenes/fuentes', () => {
    assert.match(bloque('location ~* \\.(png|jpg'), /add_header Permissions-Policy/);
  });
});

describe('5 — webhook de PayPal con cuerpo crudo', () => {
  Object.assign(process.env, { PAYPAL_CLIENT_ID: 'id-prueba', PAYPAL_CLIENT_SECRET: 'secreto-prueba', PAYPAL_ENV: 'sandbox' });
  const paypal = require('../services/payments/paypal');
  const payments = require('../services/payments');
  const fetchOriginal = globalThis.fetch;
  const json = (status, body) => ({ ok: true, status, text: async () => JSON.stringify(body) });
  let server, base;
  afterEach(() => { globalThis.fetch = fetchOriginal; delete process.env.PAYPAL_WEBHOOK_ID; });

  before(async () => {
    payments.getProvider = () => paypal;
    const app = express();
    app.use('/api/webhooks/paypal', express.raw({ type: '*/*', limit: '1mb' })); // igual que index.js
    app.use(express.json());
    app.use('/api/webhooks/paypal', require('../routes/webhooks'));
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => new Promise(r => server.close(r)));

  const enviar = (cuerpo, tipo = 'application/json') => fetchOriginal(`${base}/api/webhooks/paypal`, { method: 'POST', headers: { 'Content-Type': tipo }, body: cuerpo });

  test('a PayPal le llega el evento con los MISMOS bytes que se recibieron (espacios, orden y escapes intactos)', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'WH-1';
    const crudo = '{ "id":"WH-EV-1",  "event_type" : "X.Y",\n "resource":{"monto":1.10,"txt":"caf\\u00e9 \\/"} }';
    let enviado;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(base)) return fetchOriginal(url, opts);
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
      enviado = opts.body;
      return json(200, { verification_status: 'FAILURE' });
    };
    const res = await enviar(crudo);
    assert.equal(res.status, 400); // FAILURE -> 400, como siempre
    assert.ok(enviado.includes(`"webhook_event":${crudo}}`), `el cuerpo original debe ir literal: ${enviado}`);
    const parseado = JSON.parse(enviado); // y el envoltorio sigue siendo JSON válido
    assert.equal(parseado.webhook_id, 'WH-1');
    assert.equal(parseado.webhook_event.event_type, 'X.Y');
  });

  test('cuerpo que no es JSON o no es un objeto -> 400 sin llamar a PayPal', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'WH-1';
    let aPayPal = 0;
    globalThis.fetch = async (url, opts) => { if (!String(url).startsWith(base)) aPayPal++; return fetchOriginal(url, opts); };
    for (const malo of ['no es json', '', '[1,2]', '"texto"']) assert.equal((await enviar(malo)).status, 400, JSON.stringify(malo));
    assert.equal(aPayPal, 0);
  });

  test('también acepta cualquier Content-Type (el raw no depende de él)', async () => {
    process.env.PAYPAL_WEBHOOK_ID = 'WH-1';
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith(base)) return fetchOriginal(url, opts);
      if (String(url).endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
      return json(200, { verification_status: 'SUCCESS' });
    };
    assert.equal((await enviar('{"event_type":"CUSTOMER.DISPUTE.CREATED","resource":{}}', 'text/plain')).status, 200);
  });
});

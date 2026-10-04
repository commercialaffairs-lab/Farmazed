/**
 * config.test.js — TAREA 40 (C2 + config de producción). Validación de
 * configuración al ARRANCAR (el proceso sale con un error claro), el mock de pagos
 * solo con emulador/PAYMENTS_PROVIDER=mock, CORS anclado, y que un 500 no filtre
 * e.message. Los arranques fallidos se prueban lanzando `node index.js` con un
 * entorno controlado: la validación ocurre ANTES de abrir ninguna conexión.
 *
 *   FZ_API_PORT=8070 node --test tracker/tests/config.test.js
 * (FZ_TRACKER_INDEX=<ruta a otro index.js> para correr los arranques contra otra copia.)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');
const { spawnSync } = require('node:child_process');

const API_PORT = process.env.FZ_API_PORT;
if (!API_PORT) throw new Error('config.test.js: FZ_API_PORT no definido.');
const API_BASE = `http://localhost:${API_PORT}`;
const INDEX    = process.env.FZ_TRACKER_INDEX || path.join(__dirname, '..', 'index.js');

const { cargarConfig, resolverProveedorPagos, origenPermitido, ConfigError } = require('../config');

const PROD_OK = {
  NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'proyecto-x', GCS_BUCKET: 'bucket-x', MCP_KEY: 'k'.repeat(40),
  PAYPAL_ENV: 'live', PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'secreto', PAYPAL_WEBHOOK_ID: 'wh',
};
const EMULADOR_OK = { FIRESTORE_EMULATOR_HOST: 'localhost:8190', FIREBASE_PROJECT_ID: 'demo-x', GCS_BUCKET: 'demo-x.appspot.com' };

// Arranca `node index.js` con un entorno LIMPIO (sin lo que herede este proceso) y espera a que salga.
function arrancar(env) {
  const r = spawnSync(process.execPath, [INDEX], { env: { PATH: process.env.PATH, PORT: '0', ...env }, encoding: 'utf8', timeout: 8000, killSignal: 'SIGKILL' });
  return { status: r.status, salida: `${r.stdout}${r.stderr}` };
}

describe('Arranque: la config inválida impide que el tracker arranque', () => {
  test('producción SIN las variables de PayPal -> sale con error claro (no cae al mock)', () => {
    const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_ENV, ...sinPaypal } = PROD_OK;
    const r = arrancar(sinPaypal);
    assert.equal(r.status, 1, r.salida);
    assert.match(r.salida, /PAYPAL_CLIENT_ID/);
    assert.match(r.salida, /PAYPAL_WEBHOOK_ID/);
  });

  test('PAYMENTS_PROVIDER=mock + NODE_ENV=production -> error', () => {
    const r = arrancar({ ...PROD_OK, PAYMENTS_PROVIDER: 'mock' });
    assert.equal(r.status, 1, r.salida);
    assert.match(r.salida, /PAYMENTS_PROVIDER=mock no se permite en producción/);
  });

  test('sin emulador y sin NODE_ENV=production (un entorno local con credenciales) -> se niega a arrancar', () => {
    const r = arrancar({ FIREBASE_PROJECT_ID: 'proyecto-x', GCS_BUCKET: 'bucket-x' });
    assert.equal(r.status, 1, r.salida);
    assert.match(r.salida, /FIRESTORE_EMULATOR_HOST/);
  });

  test('sin FIREBASE_PROJECT_ID / GCS_BUCKET (no hay default "farmazed") -> error', () => {
    const r = arrancar({ FIRESTORE_EMULATOR_HOST: 'localhost:8190' });
    assert.equal(r.status, 1, r.salida);
    assert.match(r.salida, /FIREBASE_PROJECT_ID es obligatorio/);
    assert.match(r.salida, /GCS_BUCKET es obligatorio/);
  });

  test('producción con MCP_KEY corta (< 32) -> error', () => {
    const r = arrancar({ ...PROD_OK, MCP_KEY: 'corta' });
    assert.equal(r.status, 1, r.salida);
    assert.match(r.salida, /MCP_KEY/);
  });

  test('producción con FIRESTORE_EMULATOR_HOST definido -> error (no se combinan)', () => {
    const r = arrancar({ ...PROD_OK, FIRESTORE_EMULATOR_HOST: 'localhost:8190' });
    assert.equal(r.status, 1, r.salida);
    assert.match(r.salida, /no se combinan/);
  });
});

describe('cargarConfig / proveedor de pagos', () => {
  test('producción completa y válida: pagos reales, sin emulador', () => {
    const c = cargarConfig(PROD_OK);
    assert.equal(c.produccion, true);
    assert.equal(c.proveedorPagos, 'paypal');
    assert.equal(c.trustProxy, 1);
  });

  test('NODE_ENV se normaliza (mayúsculas/espacios) y el host del emulador debe ser local', () => {
    assert.equal(cargarConfig({ ...PROD_OK, NODE_ENV: ' Production ' }).produccion, true);
    assert.throws(() => cargarConfig({ ...EMULADOR_OK, FIRESTORE_EMULATOR_HOST: 'staging.interno:8080' }), /localhost\/127\.0\.0\.1/);
    assert.equal(cargarConfig({ ...EMULADOR_OK, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8190' }).enEmulador, true);
  });

  test('K_SERVICE (Cloud Run) cuenta como producción aunque falte NODE_ENV', () => {
    const { NODE_ENV, ...sinNodeEnv } = PROD_OK;
    assert.equal(cargarConfig({ ...sinNodeEnv, K_SERVICE: 'farmazed-tracker' }).produccion, true);
    assert.throws(() => cargarConfig({ ...sinNodeEnv, K_SERVICE: 'farmazed-tracker', MCP_KEY: 'corta' }), ConfigError);
  });

  test('emulador: el mock por defecto; PAYMENTS_PROVIDER=mock también vale; explícito paypal sin credenciales -> error', () => {
    assert.equal(cargarConfig(EMULADOR_OK).proveedorPagos, 'mock');
    assert.equal(cargarConfig({ ...EMULADOR_OK, PAYMENTS_PROVIDER: 'mock' }).proveedorPagos, 'mock');
    assert.throws(() => cargarConfig({ ...EMULADOR_OK, PAYMENTS_PROVIDER: 'paypal' }), /PAYPAL_CLIENT_ID/);
  });

  test('el mock solo con emulador o PAYMENTS_PROVIDER=mock: sin ellos y sin credenciales -> lanza (no cae al mock)', () => {
    assert.throws(() => resolverProveedorPagos({ NODE_ENV: 'production' }), ConfigError);
    assert.throws(() => resolverProveedorPagos({ PAYPAL_CLIENT_ID: 'x', PAYPAL_CLIENT_SECRET: 'y' }), /PAYPAL_WEBHOOK_ID/);
    assert.throws(() => resolverProveedorPagos({ ...PROD_OK, PAYPAL_ENV: 'otro' }), /sandbox/);
    assert.throws(() => resolverProveedorPagos({ PAYMENTS_PROVIDER: 'raro' }), /inválido/);
  });

  test('TRUST_PROXY: entero >= 1 (o sin definir = 1)', () => {
    assert.equal(cargarConfig({ ...EMULADOR_OK, TRUST_PROXY: '2' }).trustProxy, 2);
    for (const malo of ['0', '-1', 'dos', '1.5']) assert.throws(() => cargarConfig({ ...EMULADOR_OK, TRUST_PROXY: malo }), /TRUST_PROXY/);
  });
});

describe('CORS anclado', () => {
  test('origenPermitido en PRODUCCIÓN: LISTA explícita (farmazed.com y www), sin comodines de subdominio; nada de http, sufijos ni localhost', () => {
    const prod = { produccion: true };
    for (const ok of ['https://farmazed.com', 'https://www.farmazed.com']) assert.equal(origenPermitido(ok, prod), true, ok);
    for (const malo of ['https://api.farmazed.com', 'https://sub.farmazed.com', 'http://farmazed.com', 'https://evil-farmazed.com', 'https://farmazed.com.evil.com', 'https://a.b.farmazed.com',
      'http://www.farmazed.com', 'https://farmazed.com:8443', 'http://localhost:8092', 'http://localhost:3000', 'http://127.0.0.1:8092', 'https://farmazed.com/']) {
      assert.equal(origenPermitido(malo, prod), false, malo);
    }
  });

  test('CORS_ORIGINS configurable por env: reemplaza la lista; se valida (https, sin comodines/rutas)', () => {
    const c = cargarConfig({ ...PROD_OK, CORS_ORIGINS: 'https://farmazed.com, https://app.farmazed.com' });
    assert.deepEqual(c.origenesProd, ['https://farmazed.com', 'https://app.farmazed.com']);
    assert.equal(origenPermitido('https://app.farmazed.com', c), true);
    assert.equal(origenPermitido('https://www.farmazed.com', c), false, 'lo que no está en la lista se rechaza');
    for (const malo of ['http://farmazed.com', 'https://*.farmazed.com', 'https://farmazed.com/ruta', '*']) {
      assert.throws(() => cargarConfig({ ...PROD_OK, CORS_ORIGINS: malo }), /CORS_ORIGINS/, malo);
    }
    assert.throws(() => cargarConfig({ ...PROD_OK, CORS_ORIGINS: ' , ' }), /CORS_ORIGINS/);
  });

  test('fuera de producción (emulador) sí acepta localhost/127.0.0.1 con cualquier puerto', () => {
    assert.equal(origenPermitido('http://localhost:8093', { produccion: false }), true);
    assert.equal(origenPermitido('http://127.0.0.1:9000', { produccion: false }), true);
    assert.equal(origenPermitido('http://evil-farmazed.com', { produccion: false }), false);
  });

  test('en el servidor real: la cabecera Access-Control-Allow-Origin solo sale para orígenes permitidos', async () => {
    const acao = async (origin) => (await fetch(`${API_BASE}/health`, { headers: { Origin: origin } })).headers.get('access-control-allow-origin');
    assert.equal(await acao('https://www.farmazed.com'), 'https://www.farmazed.com');
    for (const malo of ['http://farmazed.com', 'https://evil-farmazed.com', 'http://x.farmazed.com', 'https://a.b.farmazed.com', 'https://sub.farmazed.com']) {
      assert.equal(await acao(malo), null, malo);
    }
  });
});

describe('Los 500 no filtran detalles internos', () => {
  test('un error interno (id de documento inválido) responde un mensaje genérico, sin e.message', async () => {
    const r = await fetch(`${API_BASE}/api/invitations/${encodeURIComponent('a/b')}`);
    const cuerpo = await r.json();
    assert.equal(r.status, 500);
    assert.match(cuerpo.error, /Error interno/);
    assert.ok(!/documentPath|Firestore|segments|document/i.test(JSON.stringify(cuerpo)), `filtró un detalle interno: ${JSON.stringify(cuerpo)}`);
  });

  test('JSON malformado en el body -> 400 genérico (antes: 500 con el mensaje del parser)', async () => {
    const r = await fetch(`${API_BASE}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"nombre": ' });
    const cuerpo = await r.json();
    assert.equal(r.status, 400);
    assert.ok(!/JSON|Unexpected|position/i.test(JSON.stringify(cuerpo)), JSON.stringify(cuerpo));
  });

  test('los 4xx con mensaje de negocio se quedan tal cual', async () => {
    const r = await fetch(`${API_BASE}/api/invitations/no-existe`);
    assert.equal(r.status, 404);
    assert.match((await r.json()).error, /Invitación no encontrada/);
  });
});

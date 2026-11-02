/**
 * configuracion.test.js — Sección "Configuración" del back-office (Rick, 02-nov-2026): perfil,
 * cierre de sesiones y estado de los servicios (solo admin). Reemplaza code_graph.test.js (graphify
 * retirado). Contra el tracker real sobre los emuladores.
 *
 * Corre con (ver _fixtures.js): FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *   node --test tracker/tests/configuracion.test.js
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./_fixtures');

let adminToken;
let regente;

before(async () => {
  adminToken = await fx.idTokenFor('admin-e3@farmazed.test');
  regente = await fx.crearUsuario('config-regente', { role: 'regente' });
});

describe('Perfil (/api/me/perfil)', () => {
  test('GET devuelve correo, nombre, rol y fechas de la cuenta', async () => {
    const r = await fx.api(regente.token, 'GET', '/api/me/perfil');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.correo, regente.email);
    assert.equal(r.json.rol, 'regente');
    assert.equal(r.json.correoVerificado, true);
    assert.ok('creadoEn' in r.json && 'ultimoAcceso' in r.json);
  });

  test('PUT valida el nombre (2–80 caracteres) y lo guarda normalizando espacios', async () => {
    assert.equal((await fx.api(regente.token, 'PUT', '/api/me/perfil', { nombre: 'X' })).status, 400);
    assert.equal((await fx.api(regente.token, 'PUT', '/api/me/perfil', { nombre: 'a'.repeat(81) })).status, 400);
    assert.equal((await fx.api(regente.token, 'PUT', '/api/me/perfil', {})).status, 400);
    const r = await fx.api(regente.token, 'PUT', '/api/me/perfil', { nombre: '  Regente   De Prueba ' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.nombre, 'Regente De Prueba');
    assert.equal((await fx.api(regente.token, 'GET', '/api/me/perfil')).json.nombre, 'Regente De Prueba');
  });

  test('sin token -> 401', async () => {
    assert.equal((await fx.api(null, 'GET', '/api/me/perfil')).status, 401);
  });
});

describe('Cerrar sesión en todos los dispositivos (/api/me/cerrar-sesiones)', () => {
  test('revoca los tokens y responde revocadas:true; un login nuevo vuelve a funcionar', async () => {
    const victima = await fx.crearUsuario('config-revocar', { role: 'analista' });
    const r = await fx.api(victima.token, 'POST', '/api/me/cerrar-sesiones');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.revocadas, true);
    const nuevo = await fx.idTokenFor(victima.email);
    assert.equal((await fx.api(nuevo, 'GET', '/api/me/perfil')).status, 200);
  });
});

describe('Estado de los servicios (/api/admin/estado, solo admin)', () => {
  test('el admin ve pagos, facturación, correo, demo y versión, sin credenciales', async () => {
    const r = await fx.api(adminToken, 'GET', '/api/admin/estado');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.entorno, 'local');
    assert.equal(r.json.pagos.proveedor, 'mock');
    assert.equal(r.json.facturacion.proveedor, 'mock');
    assert.equal(typeof r.json.correo.configurado, 'boolean');
    assert.deepEqual(r.json.demo.cuentas.map(c => c.rol), ['cliente_titular', 'regente']);
    assert.match(r.json.version, /^\d+\.\d+\.\d+$/);
    const texto = JSON.stringify(r.json).toLowerCase();
    for (const prohibido of ['secret', 'password', 'token', 'clave']) assert.ok(!texto.includes(prohibido), `no debe exponer ${prohibido}`);
  });

  test('el personal no admin -> 403; el mapa del código ya no existe (404)', async () => {
    assert.equal((await fx.api(regente.token, 'GET', '/api/admin/estado')).status, 403);
    assert.equal((await fx.api(adminToken, 'GET', '/api/admin/code-graph')).status, 404);
  });
});

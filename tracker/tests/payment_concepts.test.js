/**
 * payment_concepts.test.js — TAREA 23 (§H.8, Pagos): el gate de fase_05
 * pasó de "algún pago cliente_a_farmazed" (TAREA 21/22) a un gate por
 * CONCEPTO — honorarios + tasa_dnfd siempre; + mef si el producto es
 * extranjero; + iea si aplica (según la línea de la cotización ACEPTADA
 * del caso, ver tracker/routes/quotes.js).
 *
 * Fixtures dedicados (seed_roles.js): case-gate-pago-concepto-rest/mcp, cada
 * uno con una cotización 'aceptada' sembrada directo con esExtranjero:true,
 * aplicaIEA:true, modalidadIEA:'expedita' — así el gate exige los 4
 * conceptos, no solo los 2 base (eso ya lo cubre transition_gates.test.js,
 * Gate 2/5). Prueba, por CADA vía (REST y MCP), que:
 *   1. Sin ningún pago, bloquea mencionando los 4 conceptos.
 *   2. Con solo 3 de 4 (falta iea), sigue bloqueado.
 *   3. Con los 4, avanza sin override.
 * Los pagos siempre se registran vía REST (admin) — MCP no tiene un tool
 * para registrar pagos (ver tracker/routes/mcp.js) — lo que se prueba por
 * MCP es que SU lectura del gate ve los mismos pagos que REST escribió.
 *
 * Corre con tracker/scripts/run_permission_tests.sh, que ya levantó
 * emuladores + tracker (con MCP_KEY y Storage) + sembró seed_roles.js.
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const AUTH_PORT = process.env.FZ_AUTH_PORT;
const API_PORT  = process.env.FZ_API_PORT;
const MCP_KEY   = process.env.FZ_MCP_KEY;
if (!AUTH_PORT || !API_PORT || !MCP_KEY) {
  throw new Error('payment_concepts.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_MCP_KEY no definidos — usar run_permission_tests.sh, no "node --test" directo.');
}

const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';

let adminToken;

async function idTokenFor(email) {
  const res = await fetch(
    `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function registrarPago(caseId, concepto, monto) {
  const form = new FormData();
  form.append('tipo', 'cliente_a_farmazed');
  form.append('concepto', concepto);
  form.append('monto', String(monto));
  form.append('comprobante', new Blob([`comprobante de prueba — ${caseId}/${concepto}`], { type: 'application/pdf' }), `${concepto}.pdf`);
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status !== 201) throw new Error(`registrarPago(${caseId}, ${concepto}) falló: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function restPatch(caseId, body) {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let mcpCallId = 0;
async function mcpUpdateCase(caseId, args) {
  mcpCallId += 1;
  const res = await fetch(`${API_BASE}/mcp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MCP_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'tools/call', id: mcpCallId,
      params: { name: 'farmazed_update_case', arguments: { caseId, ...args } },
    }),
  });
  return res.json();
}

before(async () => {
  adminToken = await idTokenFor('admin-e3@farmazed.test');
});

describe('Gate de fase_05 por concepto (TAREA 23) — REST, caso con esExtranjero+aplicaIEA', () => {
  const CASE_ID = 'case-gate-pago-concepto-rest';

  test('sin ningún pago, bloquea y menciona los 4 conceptos', async () => {
    const { status, json } = await restPatch(CASE_ID, { status: 'fase_06' });
    assert.equal(status, 400);
    assert.match(json.error, /honorarios/);
    assert.match(json.error, /tasa_dnfd/);
    assert.match(json.error, /mef/);
    assert.match(json.error, /iea/);
  });

  test('con honorarios+tasa_dnfd+mef pagados, sigue bloqueado (falta iea)', async () => {
    await registrarPago(CASE_ID, 'honorarios', 2055);
    await registrarPago(CASE_ID, 'tasa_dnfd', 200);
    await registrarPago(CASE_ID, 'mef', 25);
    const { status, json } = await restPatch(CASE_ID, { status: 'fase_06' });
    assert.equal(status, 400);
    assert.match(json.error, /iea/);
  });

  test('con los 4 conceptos pagados, avanza sin override', async () => {
    await registrarPago(CASE_ID, 'iea', 2250);
    const { status, json } = await restPatch(CASE_ID, { status: 'fase_06' });
    assert.equal(status, 200);
    assert.equal(json.status, 'fase_06');
  });
});

describe('Gate de fase_05 por concepto (TAREA 23) — MCP ve los MISMOS pagos que REST escribió', () => {
  const CASE_ID = 'case-gate-pago-concepto-mcp';

  test('sin ningún pago, MCP bloquea y menciona los 4 conceptos', async () => {
    const resp = await mcpUpdateCase(CASE_ID, { status: 'fase_06' });
    assert.ok(resp.error);
    assert.match(resp.error.message, /honorarios/);
    assert.match(resp.error.message, /tasa_dnfd/);
    assert.match(resp.error.message, /mef/);
    assert.match(resp.error.message, /iea/);
  });

  test('con 3 de 4 pagados (vía REST), MCP sigue bloqueando por el que falta', async () => {
    await registrarPago(CASE_ID, 'honorarios', 2055);
    await registrarPago(CASE_ID, 'tasa_dnfd', 200);
    await registrarPago(CASE_ID, 'iea', 1500);
    const resp = await mcpUpdateCase(CASE_ID, { status: 'fase_06' });
    assert.ok(resp.error);
    assert.match(resp.error.message, /mef/);
  });

  test('con los 4 conceptos pagados, MCP avanza sin override', async () => {
    await registrarPago(CASE_ID, 'mef', 25);
    const resp = await mcpUpdateCase(CASE_ID, { status: 'fase_06' });
    assert.ok(!resp.error, `no debería dar error: ${JSON.stringify(resp.error)}`);
    const texto = resp.result.content[0].text;
    assert.match(texto, /"status"/); // handleUpdateCase devuelve fields:[...,'status',...]
  });
});

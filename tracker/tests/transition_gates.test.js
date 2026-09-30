/**
 * transition_gates.test.js — TAREA 22 (ajuste del PM sobre TAREA 21):
 * `mcp.js` (Cowork) validaba transición y pago, pero NO exigía las dos
 * confirmaciones de fase_08 ni la cotización aceptada de fase_04 — un
 * cliente MCP podía saltarse esos dos controles aunque REST los bloqueara.
 * Se centralizaron TODOS los gates en `tracker/services/transitions.js`
 * (`checkTransition`), usado ahora por cases.js, mcp.js y el `pending_docs`
 * de documents.js.
 *
 * Esta suite prueba, por CADA uno de los 5 gates, que REST y MCP bloquean
 * IGUAL sin override — la prueba de que ya no hay una vía más permisiva que
 * la otra. Usa fixtures dedicados de `seed_roles.js` (`case-gate-*-rest` /
 * `case-gate-*-mcp`), uno por gate y por vía, para que un test no
 * contamine al otro.
 *
 * Corre con tracker/scripts/run_permission_tests.sh, que ya levantó
 * emuladores + tracker (con MCP_KEY) + sembró seed_roles.js.
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const AUTH_PORT = process.env.FZ_AUTH_PORT;
const API_PORT  = process.env.FZ_API_PORT;
const MCP_KEY   = process.env.FZ_MCP_KEY;
if (!AUTH_PORT || !API_PORT || !MCP_KEY) {
  throw new Error('transition_gates.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_MCP_KEY no definidos — usar run_permission_tests.sh, no "node --test" directo.');
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

// ── REST: PATCH /api/cases/:id como admin ───────────────────────────────────
async function restPatch(caseId, body) {
  const res = await fetch(`${API_BASE}/api/cases/${caseId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// ── MCP: tools/call farmazed_update_case ─────────────────────────────────────
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
  // El transporte MCP siempre da HTTP 200 — el éxito/error real viaja en el
  // JSON-RPC (`.result` vs `.error`), nunca en el status code.
  return res.json();
}

before(async () => {
  adminToken = await idTokenFor('admin-e3@farmazed.test');
});

describe('Gate 1/5 — transición inválida (sin override, bloqueado en las dos vías)', () => {
  test('REST: 400', async () => {
    const { status, json } = await restPatch('case-gate-transicion-rest', { status: 'aprobado' });
    assert.equal(status, 400);
    assert.match(json.error, /Transicion invalida/);
  });
  test('MCP: error JSON-RPC (nunca lo acepta en silencio)', async () => {
    const resp = await mcpUpdateCase('case-gate-transicion-mcp', { status: 'aprobado' });
    assert.ok(resp.error, 'debería venir con .error');
    assert.match(resp.error.message, /Transicion invalida/);
  });
});

describe('Gate 2/5 — pago de fase_05 (sin override, bloqueado en las dos vías)', () => {
  test('REST: 400', async () => {
    const { status, json } = await restPatch('case-gate-pago-rest', { status: 'fase_06' });
    assert.equal(status, 400);
    assert.match(json.error, /pago/);
  });
  test('MCP: error JSON-RPC', async () => {
    const resp = await mcpUpdateCase('case-gate-pago-mcp', { status: 'fase_06' });
    assert.ok(resp.error);
    assert.match(resp.error.message, /pago/);
  });
});

describe('Gate 3/5 — cotización aceptada de fase_04->fase_05 (sin override, bloqueado en las dos vías)', () => {
  test('REST: 400', async () => {
    const { status, json } = await restPatch('case-gate-cotizacion-rest', { status: 'fase_05' });
    assert.equal(status, 400);
    assert.match(json.error, /cotización/);
  });
  test('MCP: error JSON-RPC — antes de esta tarea, MCP NO tenía este gate', async () => {
    const resp = await mcpUpdateCase('case-gate-cotizacion-mcp', { status: 'fase_05' });
    assert.ok(resp.error, 'MCP debe bloquear igual que REST — antes lo dejaba pasar');
    assert.match(resp.error.message, /cotización/);
  });
});

describe('Gate 4/5 — motivo obligatorio para cerrado (sin motivo, bloqueado en las dos vías)', () => {
  test('REST: 400', async () => {
    const { status, json } = await restPatch('case-gate-cerrado-rest', { status: 'cerrado' });
    assert.equal(status, 400);
    assert.match(json.error, /reason/);
  });
  test('MCP: error JSON-RPC', async () => {
    const resp = await mcpUpdateCase('case-gate-cerrado-mcp', { status: 'cerrado' });
    assert.ok(resp.error);
    assert.match(resp.error.message, /reason/);
  });
});

describe('Gate 5/5 — dos confirmaciones de fase_08 antes de fase_09 (sin ellas, bloqueado en las dos vías)', () => {
  test('REST: 400', async () => {
    const { status, json } = await restPatch('case-gate-fase8-rest', { status: 'fase_09' });
    assert.equal(status, 400);
    assert.match(json.error, /dos confirmaciones/);
  });
  test('MCP: error JSON-RPC — antes de esta tarea, MCP NO tenía este gate', async () => {
    const resp = await mcpUpdateCase('case-gate-fase8-mcp', { status: 'fase_09' });
    assert.ok(resp.error, 'MCP debe bloquear igual que REST — antes lo dejaba pasar');
    assert.match(resp.error.message, /dos confirmaciones/);
  });
});

describe('Con override:true, las dos vías fuerzan el salto igual (queda registrado)', () => {
  test('REST: override fuerza el pago de fase_05', async () => {
    const { status, json } = await restPatch('case-gate-pago-rest', { status: 'fase_06', override: true, reason: 'prueba de gate REST' });
    assert.equal(status, 200);
    assert.equal(json.status, 'fase_06');
  });
  test('MCP: override fuerza la cotización de fase_04', async () => {
    const resp = await mcpUpdateCase('case-gate-cotizacion-mcp', { status: 'fase_05', override: true, reason: 'prueba de gate MCP' });
    assert.ok(!resp.error, `no debería dar error: ${JSON.stringify(resp.error)}`);
  });
});

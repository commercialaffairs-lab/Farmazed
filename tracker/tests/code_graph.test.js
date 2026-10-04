/**
 * code_graph.test.js — TAREA 41b. GET /api/admin/code-graph: solo admin
 * (permiso system.code_graph), responde el HTML del mapa del código, 404 claro si el
 * archivo no existe, y el grafo NO está publicado como archivo estático en farmazed-web/.
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 node --test tracker/tests/code_graph.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');

const AUTH_PORT = process.env.FZ_AUTH_PORT;
const API_PORT  = process.env.FZ_API_PORT;
if (!AUTH_PORT || !API_PORT) throw new Error('code_graph.test.js: FZ_AUTH_PORT / FZ_API_PORT no definidos.');
const API_BASE = `http://localhost:${API_PORT}`;
const GRAFO    = path.join(__dirname, '..', 'assets', 'code-graph.html');
const WEB      = path.join(__dirname, '..', '..', 'farmazed-web');

async function tokenFor(email) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Farmazed123!', returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}
const pedir = (token) => fetch(`${API_BASE}/api/admin/code-graph`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe('GET /api/admin/code-graph — solo admin', () => {
  const tokens = {};
  before(async () => {
    for (const [rol, email] of Object.entries({ admin: 'admin-e3@farmazed.test', analista: 'analista@farmazed.test', abogado: 'abogado@farmazed.test', regente: 'regente@farmazed.test', titular: 'titular-alfa@farmazed.test', miembro: 'miembro-alfa@farmazed.test' })) {
      tokens[rol] = await tokenFor(email);
    }
  });

  test('sin token -> 401', async () => {
    assert.equal((await pedir(null)).status, 401);
  });

  for (const rol of ['analista', 'abogado', 'regente', 'titular', 'miembro']) {
    test(`${rol} -> 403`, async () => {
      const r = await pedir(tokens[rol]);
      assert.equal(r.status, 403);
      assert.ok(!(await r.text()).includes('vis-network'), 'no se filtra el grafo en el cuerpo del 403');
    });
  }

  test('admin -> 200 text/html con el grafo, fecha de generación y sin caché', async () => {
    const r = await pedir(tokens.admin);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/html/);
    assert.match(r.headers.get('cache-control'), /no-store/);
    assert.ok(Number.isFinite(Date.parse(r.headers.get('last-modified'))), 'Last-Modified es una fecha válida');
    const html = await r.text();
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, /vis-network/);
    assert.match(html, /id="graph"/);
    assert.ok(!/<script[^>]+src=/.test(html) && !html.includes('unpkg.com'), 'el mapa no carga scripts externos (vis-network va inline)');
  });

  test('si el archivo no existe -> 404 con un mensaje claro (y se restaura el archivo)', async () => {
    const respaldo = `${GRAFO}.respaldo-test`;
    fs.renameSync(GRAFO, respaldo);
    try {
      const r = await pedir(tokens.admin);
      assert.equal(r.status, 404);
      assert.match((await r.json()).error, /actualizar_grafo\.sh/);
    } finally {
      fs.renameSync(respaldo, GRAFO);
    }
    assert.equal((await pedir(tokens.admin)).status, 200);
  });
});

describe('El grafo no se publica como estático', () => {
  test('ningún archivo de farmazed-web/ (servido sin auth) contiene el grafo', () => {
    const huellas = ['id="neighbors-list"', 'graphify', 'vis-network'];
    const hallados = [];
    const recorrer = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.(html|js|json)$/.test(e.name) && fs.statSync(p).size < 5_000_000) {
          const t = fs.readFileSync(p, 'utf8');
          if (huellas.every(h => t.includes(h))) hallados.push(p);
        }
      }
    };
    recorrer(WEB);
    assert.deepEqual(hallados, [], `el grafo no debe estar en farmazed-web/: ${hallados.join(', ')}`);
  });
});

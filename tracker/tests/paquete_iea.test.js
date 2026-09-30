/**
 * paquete_iea.test.js — R13 (TAREA 19): cuenta páginas del paquete IEA
 * (formula, metodo_analisis, cert_analisis, especificaciones, etiquetas —
 * ver tracker/data/paquete_iea.js) contra el tracker REAL sobre el
 * emulador. Corre con tracker/scripts/run_permission_tests.sh, que ya
 * levantó emuladores + tracker + sembró tracker/scripts/seed_roles.js
 * (fixture dedicado: case-iea-test, org Alfa).
 *
 * Sube PDFs reales generados con pdf-lib (mismo paquete que ya usa el
 * producto para contar páginas) — no se puede probar esto con un body JSON
 * vacío como el resto de permissions.test.js, hace falta contenido real.
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');

const AUTH_PORT = process.env.FZ_AUTH_PORT;
const API_PORT  = process.env.FZ_API_PORT;
if (!AUTH_PORT || !API_PORT) {
  throw new Error('paquete_iea.test.js: FZ_AUTH_PORT / FZ_API_PORT no definidos — usar run_permission_tests.sh, no "node --test" directo.');
}

const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';
const CASE_ID  = 'case-iea-test';

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

async function makePdfBuffer(pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage();
  return Buffer.from(await doc.save());
}

async function uploadPdf(token, faddiDocId, buffer, filename = `${faddiDocId}.pdf`) {
  const form = new FormData();
  form.append('faddiDocId', faddiDocId);
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
  const res = await fetch(`${API_BASE}/api/cases/${CASE_ID}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function getResumen(token) {
  const res = await fetch(`${API_BASE}/api/cases/${CASE_ID}/documents/paquete-iea`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

let token;
before(async () => { token = await idTokenFor('titular-alfa@farmazed.test'); });

describe('R13 — conteo de páginas del paquete IEA', () => {
  test('formula (100p) + especificaciones (60p): total 160/150, excedido — y la subida NO se bloquea', async () => {
    const r1 = await uploadPdf(token, 'formula', await makePdfBuffer(100));
    assert.equal(r1.status, 201); // R13: nunca bloquea, ni siquiera al momento de subir
    assert.equal(r1.json.pageCount, 100);

    const r2 = await uploadPdf(token, 'especificaciones', await makePdfBuffer(60));
    assert.equal(r2.status, 201);
    assert.equal(r2.json.pageCount, 60);

    const resumen = await getResumen(token);
    assert.equal(resumen.limite, 150);
    assert.equal(resumen.totalPaginas, 160);
    assert.equal(resumen.excedido, true);
    assert.equal(resumen.documentos.length, 2);
  });

  test('un documento fuera del paquete IEA (poder) no suma al total', async () => {
    const r = await uploadPdf(token, 'poder', await makePdfBuffer(500));
    assert.equal(r.status, 201);

    const resumen = await getResumen(token);
    assert.equal(resumen.totalPaginas, 160); // sin cambio — 'poder' no está en IEA_DOC_IDS
    assert.equal(resumen.documentos.length, 2);
  });

  test('un archivo que no es PDF válido no rompe el conteo (pageCount null, se excluye)', async () => {
    const r = await uploadPdf(token, 'etiquetas', Buffer.from('esto no es un pdf'), 'etiquetas.pdf');
    assert.equal(r.status, 201);
    assert.equal(r.json.pageCount, null);

    const resumen = await getResumen(token);
    assert.equal(resumen.totalPaginas, 160); // 'etiquetas' con pageCount null no se suma
  });

  test('bajo el límite: 30 páginas no marca excedido', async () => {
    const r = await uploadPdf(token, 'metodo_analisis', await makePdfBuffer(30));
    assert.equal(r.status, 201);
    const resumen = await getResumen(token);
    assert.equal(resumen.totalPaginas, 190);
    assert.equal(resumen.excedido, true); // ya estaba excedido desde el primer test — sigue estándolo
  });
});

/**
 * subida_archivos.test.js — TAREA 65 (punto 2). Lista blanca de archivos subidos (documentos del
 * expediente y comprobantes) y descarga siempre como adjunto.
 *  - Unitarias: services/storage.js (extensión saneada, extensión + MIME dentro de la lista, nada de html/svg).
 *  - Contra el tracker REAL sobre el emulador (run_permission_tests.sh): POST /documents responde 415
 *    sin guardar nada y un PDF válido se guarda con `Content-Disposition: attachment`.
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { archivoNoPermitido, extensionSegura, disposicionPara } = require('../services/storage');

describe('Content-Disposition — unitaria', () => {
  test('inline SOLO para pdf, png, jpg/jpeg y webp con su MIME', () => {
    for (const [n, m] of [['a.pdf', 'application/pdf'], ['a.PNG', 'image/png'], ['a.jpg', 'image/jpeg'], ['a.jpeg', 'image/jpeg'], ['cases/1/x-v1.webp', 'image/webp']])
      assert.equal(disposicionPara(n, m), 'inline', n);
  });
  test('office, zip, gif, html/svg, MIME que no coincide o ausente -> attachment', () => {
    for (const [n, m] of [
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['a.zip', 'application/zip'], ['a.gif', 'image/gif'], ['a.html', 'text/html'], ['a.svg', 'image/svg+xml'],
      ['a.pdf', 'text/html'], ['a.pdf', undefined], ['a.png', 'application/pdf'], ['sinext', 'application/pdf'],
    ]) assert.equal(disposicionPara(n, m), 'attachment', `${n} ${m}`);
  });
});

describe('lista blanca — unitaria', () => {
  test('pdf, imágenes, office y zip pasan', () => {
    for (const [n, m] of [
      ['a.pdf', 'application/pdf'], ['a.JPG', 'image/jpeg'], ['a.png', 'image/png'], ['a.webp', 'image/webp'],
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['a.zip', 'application/x-zip-compressed'],
    ]) assert.equal(archivoNoPermitido(n, m), null, `${n} ${m}`);
  });

  test('html, svg, js, ejecutables y sin extensión se rechazan', () => {
    for (const [n, m] of [
      ['x.html', 'text/html'], ['x.htm', 'text/html'], ['x.svg', 'image/svg+xml'], ['x.js', 'text/javascript'],
      ['x.exe', 'application/octet-stream'], ['sin_extension', 'application/pdf'], ['x.', 'application/pdf'], ['', 'application/pdf'],
    ]) assert.ok(archivoNoPermitido(n, m), `${n} debe rechazarse`);
  });

  test('el MIME debe coincidir con la extensión (un .pdf que dice ser text/html no pasa)', () => {
    assert.ok(archivoNoPermitido('x.pdf', 'text/html'));
    assert.ok(archivoNoPermitido('x.png', 'image/svg+xml'));
    assert.ok(archivoNoPermitido('x.pdf', undefined));
  });

  test('la extensión se sanea: /^[a-z0-9]{1,5}$/i, en minúsculas, y nunca arrastra rutas ni espacios', () => {
    assert.equal(extensionSegura('Informe.PDF'), 'pdf');
    assert.equal(extensionSegura('a.b.c.docx'), 'docx');
    assert.equal(extensionSegura('a.pdf/../../x'), null);   // el "sufijo" es "pdf/../../x"
    assert.equal(extensionSegura('a.p df'), null);
    assert.equal(extensionSegura('a.abcdef'), null);        // 6 caracteres
    assert.equal(extensionSegura('a.<svg>'), null);
    assert.equal(extensionSegura('noext'), null);
  });
});

// ─── Contra el tracker real (emulador) ──────────────────────────────────────────────────────────
const AUTH_PORT = process.env.FZ_AUTH_PORT;
const API_PORT  = process.env.FZ_API_PORT;
if (!AUTH_PORT || !API_PORT) {
  throw new Error('subida_archivos.test.js: FZ_AUTH_PORT / FZ_API_PORT no definidos — usar run_permission_tests.sh, no "node --test" directo.');
}
const API_BASE = `http://localhost:${API_PORT}`;
const CASE_ID  = 'case-iea-test';

async function idTokenFor(email) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Farmazed123!', returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

let token;
before(async () => { token = await idTokenFor('titular-alfa@farmazed.test'); });

async function subir(nombre, tipo, contenido = '%PDF-1.4 prueba t65', faddiDocId = 'otros_docs_t65') {
  const form = new FormData();
  form.append('faddiDocId', faddiDocId);
  form.append('file', new Blob([contenido], { type: tipo }), nombre);
  const res = await fetch(`${API_BASE}/api/cases/${CASE_ID}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

describe('POST /api/cases/:id/documents — lista blanca', () => {
  test('html y svg -> 415, no se guarda nada', async () => {
    const lista = async () => { const j = await (await fetch(`${API_BASE}/api/cases/${CASE_ID}/documents`, { headers: { Authorization: `Bearer ${token}` } })).json(); return (j.documents || j).length; };
    const antes = await lista();
    for (const [n, t, c] of [['x.html', 'text/html', '<script>alert(1)</script>'], ['x.svg', 'image/svg+xml', '<svg onload=alert(1)/>']]) {
      const r = await subir(n, t, c, 'otros_docs_t65_malo');
      assert.equal(r.status, 415, n);
      assert.match(r.json.error, /no permitido/i);
    }
    assert.equal(await lista(), antes, 'no se creó ningún documento');
  });

  test('un .pdf que declara text/html -> 415; sin extensión -> 415', async () => {
    assert.equal((await subir('x.pdf', 'text/html')).status, 415);
    assert.equal((await subir('sinextension', 'application/pdf')).status, 415);
  });

  test('un PDF válido se guarda y se sirve INLINE (vista previa); la extensión guardada es la saneada', async () => {
    const r = await subir('Informe T65.PDF', 'application/pdf');
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.match(r.json.storagePath, /\.pdf$/, 'la extensión guardada es la saneada, en minúsculas');
    const descarga = await fetch(r.json.signedUrl);
    assert.equal(descarga.status, 200);
    assert.match(descarga.headers.get('content-disposition') || '', /^inline/i);
  });

  test('un DOCX y un ZIP se sirven como attachment', async () => {
    for (const [n, t] of [['acta.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['paquete.zip', 'application/zip']]) {
      const r = await subir(n, t, 'PK contenido de prueba', `otros_docs_t65_${n.split('.')[1]}`);
      assert.equal(r.status, 201, JSON.stringify(r.json));
      const descarga = await fetch(r.json.signedUrl);
      assert.match(descarga.headers.get('content-disposition') || '', /^attachment/i, n);
    }
  });
});

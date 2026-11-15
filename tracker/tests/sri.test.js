/**
 * sri.test.js — TAREA 66. Sin emulador ni red: todo recurso externo (script/stylesheet de CDN) de los html
 * servidos lleva integrity sha384 + crossorigin="anonymous" y una versión fija. Google Fonts queda fuera
 * (su CSS cambia por navegador). Los hashes se comparan con el archivo real con
 * `node tracker/scripts/verificar_sri.js --descargar` (necesita red).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { revisar, versionFijada } = require('../scripts/verificar_sri');

describe('SRI en los html servidos', () => {
  test('ningún recurso externo sin integrity, sin crossorigin o con versión sin fijar', () => {
    const filas = revisar();
    assert.ok(filas.length >= 30, `se esperaban los recursos de jsdelivr/tailwind, hay ${filas.length}`);
    const malas = filas.filter(f => f.problemas.length).map(f => `${f.archivo}: ${f.url} — ${f.problemas.join('; ')}`);
    assert.deepEqual(malas, []);
  });

  test('el verificador SÍ detecta un recurso sin integrity, @latest y uno con crossorigin faltante', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sri-'));
    const hash = 'sha384-' + 'A'.repeat(64);
    fs.writeFileSync(path.join(dir, 'a.html'), [
      '<script src="https://cdn.jsdelivr.net/npm/x@1.2.3/x.js"></script>',                                                   // sin integrity
      `<script src="https://cdn.jsdelivr.net/npm/x@latest/x.js" integrity="${hash}" crossorigin="anonymous"></script>`,    // sin fijar
      `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/x@1.2.3/x.css" integrity="${hash}">`,                      // sin crossorigin
      `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/x@1.2.3/ok.css" integrity="${hash}" crossorigin="anonymous">`, // bien
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald">',                                      // excluido
      '<link rel="stylesheet" href="css/propio.css"><script src="js/propio.js"></script>',                                   // local
    ].join('\n'));
    const filas = revisar(dir);
    assert.equal(filas.length, 4);
    assert.deepEqual(filas.map(f => f.problemas.length > 0), [true, true, true, false]);
    assert.match(filas[0].problemas.join(), /integrity/);
    assert.match(filas[1].problemas.join(), /versión/);
    assert.match(filas[2].problemas.join(), /crossorigin/);
  });

  test('versionFijada', () => {
    for (const u of ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/x.css', 'https://cdn.tailwindcss.com/3.4.17', 'https://www.gstatic.com/firebasejs/10.11.0/a.js']) assert.ok(versionFijada(u), u);
    for (const u of ['https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net/npm/x@latest/a.js', 'https://cdn.jsdelivr.net/npm/x@5/a.js', 'https://cdn.jsdelivr.net/npm/x/a.js']) assert.ok(!versionFijada(u), u);
  });
});

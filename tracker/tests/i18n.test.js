/**
 * i18n.test.js — Cobertura de idiomas de la interfaz (ES/EN/FR/PT), sin emuladores.
 *
 * Rick (01-nov-2026): la demo y los manuales en los 4 idiomas "so we don't have language mixtures".
 * Esta prueba es la que evita las mezclas:
 *   1. farmazed-web/i18n/{en,fr,pt}.json son exactamente la fusión de _partes/*.json (npm run i18n),
 *      sin conflictos ni claves que falten en algún idioma.
 *   2. Toda clave USADA en la interfaz existe en los tres diccionarios: textos marcados con
 *      data-i18n / data-i18n-html / data-i18n-attr en los HTML traducidos, literales t('…') en los
 *      JS y HTML (y en el generador del manual), y las etiquetas que el tracker manda en español
 *      (fases y estados de case_status.js, nombres de documentos de faddi_checklists.js, estados de
 *      lead, conceptos de la cotización demo).
 *   3. Las claves son usables: sin saltos de línea ni espacios dobles dentro (textContent.trim() del
 *      navegador no los colapsa), y los marcadores {x} de cada traducción son los del español.
 *   4. Cada página traducida carga i18n.js como primer script del <head>.
 *
 *   node --test tracker/tests/i18n.test.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { fusionar, serializar, IDIOMAS, RAIZ } = require('../scripts/i18n_fusionar');

const WEB = path.join(__dirname, '..', '..', 'farmazed-web');
const leer = (ruta) => fs.readFileSync(ruta, 'utf8');

// Páginas que cargan la capa y se traducen enteras.
const PAGINAS = ['client-dashboard.html', 'login.html', 'admin/bandeja.html', 'admin/expediente.html', 'admin/leads.html', 'admin/finanzas.html', 'admin/configuracion.html']
  .map(p => path.join(WEB, p));
// JS con texto de interfaz que pasa por t().
const SCRIPTS = fs.readdirSync(path.join(WEB, 'portal', 'js')).filter(f => f.endsWith('.js') && f !== 'i18n.js')
  .map(f => path.join(WEB, 'portal', 'js', f));
const GENERADOR = path.join(__dirname, '..', 'scripts', 'generar_manual.js');

// Lo que el navegador pone en textContent: entidades resueltas (el diccionario usa el texto visible).
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '\u00a9', middot: '\u00b7', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', laquo: '\u00ab', raquo: '\u00bb', rarr: '\u2192', larr: '\u2190' };
const desescaparHtml = (s) => s
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, e) => (e in ENTIDADES ? ENTIDADES[e] : m));

/** Claves usadas en un archivo: { clave → cómo se usa } (para mensajes de error útiles). */
function clavesUsadas(ruta) {
  const src = leer(ruta);
  const usos = new Map();
  const anotar = (clave, como) => { if (clave && clave.trim()) usos.set(clave, `${path.relative(WEB, ruta)} ${como}`); };
  // t('…') / t("…") con comillas simples o dobles (sin plantillas: la clave debe ser literal)
  for (const m of src.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) anotar(m[2].replace(/\\(['"\\])/g, '$1'), 't()');
  if (ruta.endsWith('.html')) {
    // <tag … data-i18n …>TEXTO</tag> (hoja: sin etiquetas dentro)
    for (const m of src.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*?\sdata-i18n(?:=["'][^"']*["'])?(?:\s[^>]*)?)>([^<]*)<\/\1>/g)) {
      if (/data-i18n-(html|attr)/.test(m[2]) && !/\sdata-i18n(\s|=|>|$)/.test(` ${m[2]}`)) continue;
      anotar(desescaparHtml(m[3].trim()), 'data-i18n');
    }
    // data-i18n-html: el innerHTML exacto
    for (const m of src.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\sdata-i18n-html[^>]*>([\s\S]*?)<\/\1>/g)) anotar(m[2].trim(), 'data-i18n-html');
    // data-i18n-attr="a,b": los valores de esos atributos en la misma etiqueta
    for (const m of src.matchAll(/<[a-zA-Z][\w-]*\b[^>]*\sdata-i18n-attr=["']([^"']+)["'][^>]*>/g)) {
      for (const attr of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
        const v = m[0].match(new RegExp(`\\s${attr}=["']([^"']*)["']`));
        if (v) anotar(desescaparHtml(v[1].trim()), `data-i18n-attr ${attr}`);
      }
    }
  }
  return usos;
}

/** Etiquetas en español que manda el tracker y la interfaz pinta tal cual (pasan por t() al pintar). */
function clavesDelTracker() {
  const usos = new Map();
  const { CASE_STATUS_META } = require('../data/case_status');
  for (const [k, v] of Object.entries(CASE_STATUS_META)) if (v && v.label) usos.set(v.label, `case_status.js ${k}`);
  const faddi = require('../data/faddi_checklists');
  const recorrer = (nodo, ruta) => {
    if (!nodo || typeof nodo !== 'object') return;
    if (Array.isArray(nodo)) return nodo.forEach((n, i) => recorrer(n, `${ruta}[${i}]`));
    for (const [k, v] of Object.entries(nodo)) {
      if (typeof v === 'string' && /^(nombre|name|label|titulo|title|descripcion|description|seccion|section)$/.test(k) && v.trim()) usos.set(v.trim(), `faddi_checklists.js ${ruta}.${k}`);
      else if (v && typeof v === 'object') recorrer(v, `${ruta}.${k}`);
    }
  };
  recorrer(faddi, 'faddi');
  for (const e of ['Nuevo', 'Contactado', 'Calificado', 'Invitado', 'Descartado']) usos.set(e, 'contact_leads.js estado');
  // Contenido sembrado que la demo muestra como datos (mensajes del hilo, mensaje del lead): la interfaz
  // lo pinta con t(), así que debe estar traducido (parte demo.json). Los nombres propios no.
  const demoSrc = leer(path.join(__dirname, '..', 'services', 'demo.js'));
  for (const m of demoSrc.matchAll(/\b(?:text|mensaje)\s*:\s*'([^']+)'/g)) usos.set(m[1], 'demo.js contenido sembrado');
  return usos;
}

const marcadores = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

describe('idiomas de la interfaz (ES/EN/FR/PT)', () => {
  const fusion = fusionar();

  test('los diccionarios del repo son la fusión de las partes, sin conflictos ni huecos', () => {
    assert.deepEqual(fusion.conflictos, [], 'misma clave con traducciones distintas en dos partes');
    for (const idioma of IDIOMAS) {
      assert.deepEqual(fusion.faltantes[idioma], [], `claves sin traducción en ${idioma}`);
      const enDisco = leer(path.join(RAIZ, `${idioma}.json`));
      assert.equal(enDisco, serializar(fusion.diccionarios[idioma]), `${idioma}.json desactualizado: corre "npm run i18n" en tracker/`);
    }
    assert.ok(fusion.total > 100, `demasiadas pocas claves (${fusion.total}): ¿faltan partes en _partes/?`);
  });

  test('toda clave usada en la interfaz y en las etiquetas del tracker tiene traducción en los 3 idiomas', () => {
    const usos = new Map();
    for (const ruta of [...PAGINAS, ...SCRIPTS, GENERADOR]) for (const [k, v] of clavesUsadas(ruta)) usos.set(k, v);
    for (const [k, v] of clavesDelTracker()) usos.set(k, v);
    assert.ok(usos.size > 100, `demasiadas pocas claves usadas (${usos.size})`);
    const faltan = [];
    for (const [clave, donde] of usos) for (const idioma of IDIOMAS) if (!(clave in fusion.diccionarios[idioma])) faltan.push(`${idioma}: "${clave}" (${donde})`);
    assert.deepEqual(faltan, [], `claves usadas sin traducción:\n${faltan.join('\n')}`);
  });

  test('las claves y traducciones son usables: sin saltos de línea ni espacios dobles, mismos marcadores', () => {
    const malas = [];
    for (const idioma of IDIOMAS) {
      for (const [clave, trad] of Object.entries(fusion.diccionarios[idioma])) {
        if (/\n|\r|\t|  /.test(clave) || clave !== clave.trim()) malas.push(`${idioma}: clave con espacios raros "${clave.slice(0, 60)}"`);
        if (!trad.trim()) malas.push(`${idioma}: traducción vacía de "${clave}"`);
        if (marcadores(clave) !== marcadores(trad)) malas.push(`${idioma}: marcadores distintos en "${clave}" → "${trad}"`);
      }
    }
    assert.deepEqual(malas, [], malas.join('\n'));
  });

  test('cada página traducida carga i18n.js como primer script del <head>', () => {
    for (const ruta of PAGINAS) {
      const html = leer(ruta);
      const head = html.slice(0, html.indexOf('</head>'));
      const primerScript = head.match(/<script\b[^>]*>/);
      assert.ok(primerScript && /src="\/portal\/js\/i18n\.js"/.test(primerScript[0]), `${path.relative(WEB, ruta)}: el primer <script> del <head> debe ser /portal/js/i18n.js`);
    }
  });

  test('los rótulos citados en los textos del recorrido (EN/FR/PT) son los de la interfaz en ese idioma', () => {
    // Los pasos dicen 'Under "Request Registration"…' o 'click [Reset demo account]': lo citado debe ser
    // EXACTAMENTE lo que la interfaz muestra en ese idioma (una traducción del diccionario), salvo
    // nombres propios de los datos de ejemplo.
    const { TRADUCCIONES, NOTAS, ETIQUETAS_PANEL } = require('../services/demo_recorrido_textos');
    const PROPIOS = new Set(['Producto Ejemplo 2', 'Producto Ejemplo 3', 'Farmacia Ejemplo', 'Laboratorios Ejemplo', 'Laboratorios Ejemplo S.A.', 'Leads', 'PayPal']);
    const malas = [];
    for (const idioma of IDIOMAS) {
      const valores = new Set(Object.values(fusion.diccionarios[idioma]));
      const textos = [
        ...Object.values(TRADUCCIONES[idioma].cliente).flatMap(p => [p.titulo, p.descripcion]),
        ...Object.values(TRADUCCIONES[idioma].clienteReal).flatMap(p => [p.titulo, p.descripcion]),
        ...Object.values(TRADUCCIONES[idioma].regente).flatMap(p => [p.titulo, p.descripcion]),
        ...Object.values(NOTAS[idioma]), ETIQUETAS_PANEL[idioma].completoTexto, ETIQUETAS_PANEL[idioma].completoTextoCliente,
      ];
      for (const texto of textos) {
        const citas = [...texto.matchAll(/"([^"]+)"|«\s*([^»]+?)\s*»|\[([^\]]+)\]/g)].map(m => m[1] || m[2] || m[3]);
        for (const cita of citas) if (!PROPIOS.has(cita) && !valores.has(cita)) malas.push(`${idioma}: "${cita}" no es un rótulo de la interfaz en ${idioma} (en: ${texto.slice(0, 50)}…)`);
      }
      const boton = fusion.diccionarios[idioma]['Reiniciar cuenta demo'];
      assert.ok(boton && ETIQUETAS_PANEL[idioma].completoTexto.includes(`[${boton}]`) && NOTAS[idioma].rechazada.includes(`[${boton}]`), `${idioma}: el botón citado debe ser [${boton}]`);
    }
    assert.deepEqual(malas, [], malas.join('\n'));
  });

  test('la capa funciona en Node con los diccionarios reales (la usa el generador del manual)', () => {
    const i18n = require('../../farmazed-web/portal/js/i18n.js');
    for (const idioma of IDIOMAS) {
      i18n.usarSync(idioma);
      assert.equal(i18n.idioma(), idioma);
      assert.notEqual(i18n.t('Ayuda'), 'Ayuda', `${idioma}: "Ayuda" debe estar traducida`);
    }
    i18n.usarSync('es');
    assert.equal(i18n.t('Paso {n} de {total}', { n: 2, total: 6 }), 'Paso 2 de 6');
    assert.equal(i18n.normalizar('EN-us'), 'en');
    assert.equal(i18n.normalizar('de'), 'es');
  });
});

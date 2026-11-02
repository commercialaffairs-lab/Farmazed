/**
 * manual.test.js — Los dos manuales de usuario (cliente y regente) en ES/EN/FR/PT.
 *
 * No necesita emuladores: comprueba que farmazed-web/manual/{cliente,regente}/{es,en,fr,pt}.html están al
 * día con scripts/generar_manual.js (si falla, corre `npm run manual` en tracker/ y commitea), que el
 * español de los pasos es el de services/demo_recorrido_textos.js (la fuente del panel: variante
 * clienteReal para el manual del cliente, regente para el del regente), que cada idioma traduce TODOS
 * los pasos, notas y rótulos del panel (sin eso el generador y la API caerían en silencio al español),
 * que los enlaces "Ayuda" apuntan al manual de cada rol y que el panel (recorrido.js) no trae textos
 * en duro. Los HTML generados se guardan con LF (.gitattributes) para que la comparación byte a byte no
 * dependa de core.autocrlf.
 *
 *   node --test tracker/tests/manual.test.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { generarManual, IDIOMAS, ROLES, DESTINO } = require('../scripts/generar_manual');
const { TEXTOS } = require('../scripts/manual_textos');
const { PASOS_CLIENTE, PASOS_CLIENTE_REAL, PASOS_REGENTE, TRADUCCIONES, NOTAS, ETIQUETAS_PANEL, normalizarIdioma, pasosEnIdioma } = require('../services/demo_recorrido_textos');

const WEB = path.join(__dirname, '..', '..', 'farmazed-web');
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const leer = (rol, idioma) => fs.readFileSync(path.join(DESTINO, rol, `${idioma}.html`), 'utf8');
const PASOS_DEL_MANUAL = { cliente: PASOS_CLIENTE_REAL, regente: PASOS_REGENTE };
const SECCIONES = { cliente: ['empezar', 'panel', 'pasos', 'demo', 'fases', 'notas'], regente: ['empezar', 'panel', 'pasos', 'fases', 'notas'] };

describe('manuales de usuario (cliente y regente, ES/EN/FR/PT)', () => {
  test('los HTML del repo son exactamente lo que produce el generador', () => {
    assert.deepEqual(ROLES, ['cliente', 'regente']);
    for (const rol of ROLES) for (const idioma of IDIOMAS) {
      const enDisco = leer(rol, idioma);
      const fecha = enDisco.match(/(\d{4}-\d{2}-\d{2})<\/span>/)?.[1];
      assert.ok(fecha, `${rol}/${idioma}.html sin fecha de generación en el pie`);
      assert.equal(generarManual(idioma, rol, fecha), enDisco, `${rol}/${idioma}.html desactualizado: corre "npm run manual" en tracker/`);
    }
    assert.ok(!fs.existsSync(path.join(DESTINO, 'es.html')), 'el manual único antiguo (manual/es.html) ya no debe existir');
  });

  test('el español de los pasos es el de demo_recorrido_textos.js: cliente real en el manual del cliente, regente en el del regente', () => {
    for (const rol of ROLES) {
      const html = leer(rol, 'es');
      for (const p of PASOS_DEL_MANUAL[rol]) {
        assert.ok(html.includes(`<h3>${esc(p.titulo)}</h3>`), `${rol}: falta el título "${p.titulo}"`);
        assert.ok(html.includes(`<p class="paso-desc">${esc(p.descripcion)}</p>`), `${rol}: falta la descripción de "${p.id}"`);
      }
    }
    // El manual del cliente es para clientes reales: los pasos de la cuenta demo no son los suyos.
    const cliente = leer('cliente', 'es');
    assert.ok(!cliente.includes(esc(PASOS_CLIENTE.find(p => p.id === 'cotizacion').titulo)), 'el manual del cliente no debe usar los pasos de la demo');
    assert.ok(cliente.includes('id="demo"'), 'pero sí explica la cuenta de demostración en su apartado');
  });

  test('los textos del recorrido (panel y manual) existen en los 4 idiomas: pasos (3 variantes), notas y rótulos', () => {
    for (const idioma of IDIOMAS.filter(i => i !== 'es')) {
      const trad = TRADUCCIONES[idioma];
      for (const p of PASOS_CLIENTE) assert.ok(trad.cliente[p.id]?.titulo && trad.cliente[p.id]?.descripcion, `${idioma}: falta cliente.${p.id}`);
      for (const p of PASOS_CLIENTE_REAL) assert.ok(trad.clienteReal[p.id]?.titulo && trad.clienteReal[p.id]?.descripcion, `${idioma}: falta clienteReal.${p.id}`);
      for (const p of PASOS_REGENTE) assert.ok(trad.regente[p.id]?.titulo && trad.regente[p.id]?.descripcion, `${idioma}: falta regente.${p.id}`);
      assert.deepEqual(Object.keys(NOTAS[idioma]).sort(), Object.keys(NOTAS.es).sort(), `${idioma}: notas distintas del español`);
      assert.deepEqual(Object.keys(ETIQUETAS_PANEL[idioma]).sort(), Object.keys(ETIQUETAS_PANEL.es).sort(), `${idioma}: rótulos del panel distintos del español`);
      for (const [k, v] of Object.entries(ETIQUETAS_PANEL[idioma])) assert.ok(typeof v === 'string' && v.trim(), `${idioma}: rótulo ${k} vacío`);
      assert.equal(TEXTOS[idioma].comunes.fases.length, 13, `${idioma}: deben ser 13 fases`);
    }
    // Mismos ids en las dos variantes del cliente: el panel y "Ir al paso" no distinguen demo de real.
    assert.deepEqual(PASOS_CLIENTE_REAL.map(p => p.id), PASOS_CLIENTE.map(p => p.id));
    // Los marcadores de los rótulos son los que sustituye el panel (recorrido.js: {n}, {total}).
    for (const idioma of IDIOMAS) {
      const t = ETIQUETAS_PANEL[idioma];
      assert.ok(t.paso.includes('{n}') && t.contador.includes('{n}') && t.contador.includes('{total}') && t.pildora.includes('{n}') && t.pildoraCliente.includes('{n}'), `${idioma}: faltan marcadores`);
      // El botón del topbar se cita entre corchetes en cada idioma (tests/i18n.test.js comprueba que sea la traducción real).
      assert.ok(/\[[^\]]+\]/.test(t.completoTexto) && /\[[^\]]+\]/.test(NOTAS[idioma].rechazada), `${idioma}: el botón del topbar se cita entre corchetes`);
      assert.ok(!/\[[^\]]+\]/.test(t.completoTextoCliente), `${idioma}: el cierre del cliente real no cita el botón de reinicio (no existe fuera de la demo)`);
    }
    // pasosEnIdioma traduce por id sin perder pasos ni orden; un idioma desconocido cae al español.
    assert.deepEqual(pasosEnIdioma('cliente', 'en').map(p => p.id), PASOS_CLIENTE.map(p => p.id));
    assert.equal(pasosEnIdioma('clienteReal', 'fr')[0].titulo, TRADUCCIONES.fr.clienteReal.captacion.titulo);
    assert.equal(pasosEnIdioma('regente', 'pt')[0].titulo, TRADUCCIONES.pt.regente.documento.titulo);
    assert.deepEqual(pasosEnIdioma('cliente', 'xx'), PASOS_CLIENTE);
    assert.deepEqual(['en-US', 'FR', 'pt-BR', 'de', '', undefined].map(normalizarIdioma), ['en', 'fr', 'pt', 'es', 'es', 'es']);
  });

  test('cada manual tiene sus secciones, reproduce el panel en su idioma y no trae claves', () => {
    for (const rol of ROLES) for (const idioma of IDIOMAS) {
      const html = leer(rol, idioma);
      assert.ok(html.includes(`<html lang="${idioma}">`));
      assert.equal((html.match(/<article class="paso"/g) || []).length, PASOS_DEL_MANUAL[rol].length, `${rol}/${idioma}: un artículo por paso`);
      for (const id of SECCIONES[rol]) assert.ok(html.includes(`id="${id}"`), `${rol}/${idioma}: falta la sección ${id}`);
      for (const otro of IDIOMAS) assert.ok(html.includes(`href="./${otro}.html"`), `${rol}/${idioma}: falta el enlace a ${otro}`);
      assert.ok(!/DEMO_PASSWORD|contraseña:|password:/i.test(html), `${rol}/${idioma}: el manual no debe traer claves`);
      const panel = ETIQUETAS_PANEL[idioma];
      const tituloPanel = rol === 'cliente' ? panel.tituloCliente : panel.titulo;
      assert.ok(html.includes(`<strong>${esc(tituloPanel)}</strong>`) && html.includes(esc(panel.ir)), `${rol}/${idioma}: la réplica del panel debe ir en el idioma del manual`);
      assert.ok(html.includes(`<span class="m-idioma activo" lang="${idioma}">`), `${rol}/${idioma}: el selector del topbar debe marcar el idioma actual`);
    }
    // Rick (01-nov-2026): la carga de documentos se simula en la demo, así que ningún manual enlaza
    // el PDF de ejemplo (el archivo sigue existiendo: lo adjunta el portal al simular).
    for (const rol of ROLES) for (const idioma of IDIOMAS) {
      assert.ok(!leer(rol, idioma).includes('/demo/documento-ejemplo.pdf'), `${rol}/${idioma}: el manual no debe enlazar el PDF de ejemplo`);
    }
    assert.ok(fs.existsSync(path.join(WEB, 'demo', 'documento-ejemplo.pdf')), 'el PDF de ejemplo que adjunta la simulación debe existir');
  });

  test('los enlaces "Ayuda" llevan al manual de cada rol y "Mi cuenta" al del cliente', () => {
    const portal = fs.readFileSync(path.join(WEB, 'client-dashboard.html'), 'utf8');
    assert.match(portal, /id="tb-ayuda"[^>]*>/);
    assert.ok(portal.includes('href="/manual/cliente/es.html"'), 'el topbar del portal enlaza el manual del cliente');
    assert.ok(portal.includes('id="cuenta-manual"') && portal.includes('id="pref-recorrido"'), '"Mi cuenta" tiene el enlace al manual y el interruptor del recorrido');
    assert.ok(/\/manual\/cliente\/\$\{[^}]*\}\.html/.test(portal), 'el enlace sigue al idioma de la interfaz');
    const auth = fs.readFileSync(path.join(WEB, 'portal', 'js', 'auth.js'), 'utf8');
    assert.ok(/\/manual\/regente\/\$\{[^}]*\}\.html/.test(auth), 'el enlace del back-office apunta al manual del regente en el idioma activo');
    assert.ok(/montarEnlaceAyuda\(nombre\);/.test(auth), 'initBackoffice debe montar el enlace');
  });

  test('el panel pide el recorrido que toca (demo o cliente real), sin tablas de textos propias, y sincroniza "Ayuda"', () => {
    const panel = fs.readFileSync(path.join(WEB, 'portal', 'js', 'recorrido.js'), 'utf8');
    assert.ok(panel.includes('api.getRecorridoDemo') && panel.includes('api.getRecorridoCliente'), 'dos fuentes: demo y cliente real');
    assert.ok(panel.includes('api.getPreferencias()') && panel.includes("recorridoGuiado: false") && panel.includes("recorridoGuiado: true"), 'la preferencia del cliente real vive en el tracker');
    assert.ok(panel.includes('export async function activarRecorrido') && panel.includes('export async function desactivarRecorrido'), '"Mi cuenta" enciende y apaga el recorrido');
    assert.ok(panel.includes('.onCambio(') && panel.includes("localStorage.setItem(CLAVE_IDIOMA"), 'sigue el idioma de la interfaz (i18n.js) y lo recuerda sin ella');
    assert.ok(panel.includes("getElementById('tb-ayuda')") && panel.includes("/manual/${estado.rol === 'regente' ? 'regente' : 'cliente'}/"), '"Ayuda" sigue al rol y al idioma del panel');
    for (const rotulo of ['Ir al paso', 'Recorrido completo', 'Minimizar', 'Descargar PDF de ejemplo', 'Ocultar el recorrido']) {
      assert.ok(!panel.includes(`>${rotulo}`) && !panel.includes(`'${rotulo}'`), `recorrido.js no debe traer el rótulo "${rotulo}" en duro: viene del tracker`);
    }
    const api = fs.readFileSync(path.join(WEB, 'portal', 'js', 'api.js'), 'utf8');
    assert.ok(/getRecorridoDemo: \(idioma\) =>/.test(api) && /getRecorridoCliente: \(idioma\) =>/.test(api) && api.includes("'/api/me/preferencias'"), 'api.js expone las tres llamadas');
  });
});

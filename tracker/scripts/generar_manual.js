#!/usr/bin/env node
/**
 * generar_manual.js — Manual de usuario de la cuenta demo en ES/EN/FR/PT
 * (PENDIENTES.md, modo demo, punto 3).
 *
 *   node tracker/scripts/generar_manual.js        (o: cd tracker && npm run manual)
 *
 * Produce farmazed-web/manual/{es,en,fr,pt}.html: páginas estáticas, imprimibles (Ctrl+P →
 * "Guardar como PDF"), que reproducen las tarjetas y modales reales de cada paso del recorrido,
 * en el orden del panel "Recorrido demo". Los textos de los pasos (español y traducciones) y los
 * rótulos del panel son los de services/demo_recorrido_textos.js (la misma fuente del panel); el
 * resto de la prosa está en scripts/manual_textos.js. Las pantallas reproducidas muestran los
 * rótulos de la aplicación EN EL IDIOMA DEL MANUAL, traducidos con el mismo diccionario que usa la
 * interfaz (farmazed-web/i18n/, vía portal/js/i18n.js): sin mezclas de idiomas (Rick, 01-nov-2026).
 *
 * tests/manual.test.js regenera en memoria y compara con lo que hay en el repo: si cambias un
 * texto del recorrido o del manual, vuelve a correr este script y commitea los HTML.
 */
const fs = require('fs');
const path = require('path');
const { ETIQUETAS_PANEL, pasosEnIdioma } = require('../services/demo_recorrido_textos');
const { IDIOMAS, NOMBRES, FASES_RECORRIDO, TEXTOS } = require('./manual_textos');
// Dos manuales (Rick, 01-nov-2026): el del cliente (portal; recorrido activable en "Mi cuenta", con
// apartado para la cuenta demo) y el del regente (solo existe en la demo).
const ROLES = ['cliente', 'regente'];
// Variante de los pasos que reproduce cada manual (services/demo_recorrido_textos.js).
const VARIANTE = { cliente: 'clienteReal', regente: 'regente' };
// Los rótulos de las pantallas reproducidas pasan por el MISMO diccionario que la aplicación
// (farmazed-web/i18n/{en,fr,pt}.json, vía farmazed-web/portal/js/i18n.js): lo que se ve en el manual
// es lo que se ve en pantalla en ese idioma. `generarManual(idioma)` activa el idioma con usarSync().
const i18n = require('../../farmazed-web/portal/js/i18n.js');
const t = (texto, vars) => i18n.t(texto, vars);

const DESTINO = path.join(__dirname, '..', '..', 'farmazed-web', 'manual');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// A mano, no toLocaleString: el resultado no debe depender de la ICU del Node que genere
// (tests/manual.test.js compara byte a byte con los HTML del repo).
const dinero = (n) => `B/. ${Math.trunc(n).toString().replace(/\B(?=(\d{3})+$)/g, ',')}.${Math.round((n % 1) * 100).toString().padStart(2, '0')}`;

// ── Pantallas reproducidas (rótulos reales de la aplicación, en español) ─────────────────────
// Botones, insignias y opciones: el texto es el rótulo en español de la aplicación y se traduce aquí.
const btn = (texto, clase = '') => `<span class="m-btn ${clase}">${esc(t(texto))}</span>`;
const badge = (texto, clase = '') => `<span class="m-badge ${clase}">${esc(t(texto))}</span>`;
const radio = (texto, marcado = false) => `<label class="m-radio"><i class="${marcado ? 'on' : ''}"></i>${esc(t(texto))}</label>`;
const tx = (texto, vars) => esc(t(texto, vars)); // texto suelto traducido y escapado

// El panel "Recorrido demo" en el idioma del manual (los mismos rótulos que recibe el panel real del
// tracker, ETIQUETAS_PANEL). El idioma se elige en el selector del topbar (mockTopbar).
const mockPanel = (idioma, variante = 'clienteReal') => {
  const et = ETIQUETAS_PANEL[idioma];
  const pasos = pasosEnIdioma(variante, idioma);
  const titulo = variante === 'clienteReal' ? et.tituloCliente : et.titulo;
  return `
<div class="m-panel" lang="${idioma}">
  <div class="m-panel-cab"><strong>${esc(titulo)}</strong><span class="m-badge azul">${esc(et.contador.replace('{n}', '1').replace('{total}', String(pasos.length)))}</span></div>
  <div class="m-barra"><span style="width:17%"></span></div>
  <ol class="m-pasos">${pasos.map((p, i) => `
    <li class="${i === 0 ? 'actual' : ''}">○ ${esc(p.titulo)}${i === 0 ? `<small>${esc(p.descripcion)}</small><span class="m-btn m-btn-primario m-btn-sm">${esc(et.ir)}</span>` : ''}</li>`).join('')}
  </ol>
</div>`;
};

// Topbar del portal: selector de idioma ES · EN · FR · PT (portal/js/i18n.js), [Reiniciar cuenta demo]
// (solo en la demo), Ayuda. `demo: true` reproduce la cuenta de demostración; si no, un cliente real.
const selectorIdiomas = (idioma) => `<span class="m-idiomas">${IDIOMAS.map(i => `<span class="m-idioma ${i === idioma ? 'activo' : ''}" lang="${i}">${i.toUpperCase()}</span>`).join('')}</span>`;
const mockTopbar = (idioma, { demo = false } = {}) => `
<div class="m-topbar">${selectorIdiomas(idioma)}${demo ? btn('Reiniciar cuenta demo', 'm-btn-aviso m-btn-sm') : ''}<span class="m-topbar-txt"><b>${demo ? 'Laboratorios Ejemplo S.A.' : 'Laboratorios ABC, S.A.'}</b> · ${demo ? 'Cliente Ejemplo' : 'María Pérez'}</span><span class="m-link">${tx('Ayuda')}</span><span class="m-avatar">${demo ? 'CE' : 'MP'}</span></div>`;
// Topbar del back-office (admin/bandeja.html): título de la página, selector, Ayuda, nombre.
const mockTopbarBackoffice = (idioma) => `
<div class="m-topbar m-topbar-bo"><b class="m-topbar-txt">${tx('Mi Bandeja')}</b>${selectorIdiomas(idioma)}<span class="m-link">${tx('Ayuda')}</span><span class="m-topbar-txt">Regente Ejemplo</span></div>`;

const mockCaptacion = () => `
<div class="m-modal">
  <h4>${tx('Captación de información preliminar')}</h4>
  <p>${tx('Antes de empezar, necesitamos esta información de tu empresa (se pide una sola vez — después la puedes editar desde "Mi Empresa").')}</p>
  <div class="m-campo"><label>${tx('¿Registro previo ante autoridad reconocida (FDA, EMA, TGA…)?')}</label>${radio('Sí')}${radio('No', true)}</div>
  <div class="m-campo"><label>${tx('¿Cliente nuevo o ya tiene productos registrados en Panamá?')}</label>${radio('Cliente nuevo', true)}${radio('Ya tiene productos registrados')}</div>
  <div class="m-campo"><label>${tx('¿Algún producto con modificación en curso?')}</label>${radio('Sí')}${radio('No', true)}</div>
  <div class="m-acciones">${btn('Guardar', 'm-btn-primario')}</div>
</div>`;

const TABS = ['1. Tipo de Trámite', '2. Datos del Producto', '3. Empresas', '4. Documentos', '5. Confirmar'];
const tabs = (activa) => `<div class="m-tabs">${TABS.map((n, i) => `<span class="${i === activa ? 'on' : ''}">${tx(n)}</span>`).join('')}</div>`;

// El botón "Rellenar con datos de ejemplo" solo existe en la cuenta demo.
const mockProducto = ({ demo = false } = {}) => `
<div class="m-card">
  <div class="m-card-cab"><h4>${tx('¿Tienes un nuevo producto que registrar?')}</h4>${demo ? btn('Rellenar con datos de ejemplo', 'm-btn-contorno m-btn-sm') : ''}</div>
  ${tabs(0)}
  <h5>${tx('¿Qué tipo de registro necesitas?')}</h5>
  <div class="m-opciones"><span class="on">${tx('Medicamentos')}</span><span>${tx('Cosméticos')}</span><span>${tx('Higiénicos')}</span></div>
  <div class="m-campo"><label>${tx('Tipo de registro')}</label><span class="m-input">${tx('Regular')}</span></div>
  <div class="m-acciones">${btn('Siguiente', 'm-btn-primario')}</div>
</div>`;

const mockDocumentos = () => `
<div class="m-card">
  ${tabs(3)}
  <h5>${tx('Carga de Documentos')}</h5>
  <div class="m-fila"><span class="m-cod">15.5</span><span class="m-crece">${tx('Fórmula cuali-cuantitativa')}</span><span class="m-badge verde">documento-ejemplo.pdf · ${tx('Subido')} ✓</span></div>
  <div class="m-fila"><span class="m-cod">15.1</span><span class="m-crece">${tx('Certificado de libre venta')}</span>${btn('Subir PDF', 'm-btn-contorno m-btn-sm')}</div>
  <div class="m-fila"><span class="m-cod">15.2</span><span class="m-crece">${tx('Poder notarial')}</span>${btn('Subir PDF', 'm-btn-contorno m-btn-sm')}</div>
  <div class="m-fila m-fila-mas">…</div>
</div>`;

const CONCEPTOS = [['Honorarios Farmazed', 1855], ['Tasa DNFD', 750], ['MEF (producto extranjero)', 25], ['IEA', 1500]];
// Estados: 'enviada' (Aceptar/Rechazar), 'aceptada' (Pagar con PayPal) y 'pagada' (compacta: lo que
// se ve después del pago, con la fase a la que avanzó el expediente).
const mockCotizacion = (estado) => `
<div class="m-card">
  <div class="m-card-cab"><h4>${tx('Cotización')} FZ-DEMO-2026-0002</h4>${estado === 'enviada' ? badge('Enviada', 'azul') : estado === 'aceptada' ? badge('Aceptada', 'verde') : `<span class="m-badge verde">${tx('Pagada')} ✓</span>`}</div>
  <div class="m-fila"><span class="m-crece"><b>Producto Ejemplo 2 — Analgésico 500 mg</b><br><small>${tx('Tableta')} · Laboratorios Ejemplo S.A.</small></span><span class="m-mono">${esc(dinero(4130))}</span></div>
  ${estado === 'pagada' ? `<div class="m-fase"><span class="m-badge azul">${tx('Fase')} 6</span> ${tx('Apertura de expediente interno (CRM)')}</div>` : `
  <div class="m-desglose">${CONCEPTOS.map(([n, v]) => `<div><span>${tx(n)}</span><span class="m-mono">${esc(dinero(v))}</span></div>`).join('')}
    <div class="m-total"><span>${tx('Total')}</span><span class="m-mono">${esc(dinero(4130))}</span></div></div>
  <div class="m-acciones">${estado === 'enviada' ? btn('Aceptar', 'm-btn-primario m-btn-sm') + btn('Rechazar', 'm-btn-contorno m-btn-sm') : btn('Pagar con PayPal', 'm-btn-primario m-btn-sm')}</div>`}
</div>`;

// Los dos mensajes sembrados (services/demo.js) también están en el diccionario: la aplicación los
// pinta con t(), así en inglés no aparece un hilo en español.
const mockMensajes = () => `
<div class="m-card">
  <div class="m-card-cab"><h4>${tx('Mensajes')}</h4><span class="m-input m-input-sel">Producto Ejemplo 3 — Jarabe pediátrico ▾</span></div>
  <div class="m-hilo">
    <div class="m-msg mio"><small>Cliente Ejemplo</small>${tx('Hola, ya realizamos el pago de la cotización. ¿Cuál es el siguiente paso?')}</div>
    <div class="m-msg"><small>Regente Ejemplo</small>${tx('Recibido, gracias. Ya revisamos la documentación digital; en cuanto confirmemos el cotejo técnico pasamos a los originales.')}</div>
  </div>
  <div class="m-fila"><span class="m-input m-crece m-input-vacio">${tx('Escribe un mensaje…')}</span>${btn('Enviar', 'm-btn-primario m-btn-sm')}</div>
</div>`;

const mockExpediente = () => `
<div class="m-card">
  <div class="m-card-cab"><h4>FZ-DEMO-2026-0003 · Producto Ejemplo 3 — Jarabe pediátrico</h4><span class="m-badge ambar">${tx('Fase')} 8</span></div>
  <h5>${tx('Documentos Adjuntos — Paso 15 FADDI')}</h5>
  <div class="m-fila"><span class="m-cod">15.5</span><span class="m-crece">${tx('Fórmula cuali-cuantitativa')} <small>· v1 · ${tx('Subido')}</small></span><span class="m-btn m-btn-ok m-btn-sm" title="${tx('Aprobar')}">✓</span><span class="m-btn m-btn-no m-btn-sm" title="${tx('Rechazar')}">✗</span></div>
  <div class="m-fila m-fila-mas"><span class="m-input m-crece m-input-vacio">${tx('Motivo del rechazo (el cliente lo verá):')}</span></div>
</div>`;

const mockFase8 = () => `
<div class="m-card">
  <h4>${tx('Fase 8 — Confirmaciones')}</h4>
  <div class="m-fila"><span class="m-crece">${tx('Legal (poderes/declaraciones)')}</span>${badge('Pendiente', 'ambar')}</div>
  <div class="m-fila"><span class="m-crece">${tx('Técnica/matrices')}</span>${badge('Pendiente', 'ambar')}${btn('Confirmar', 'm-btn-contorno m-btn-sm')}</div>
</div>`;

const mockLead = () => `
<div class="m-card">
  <div class="m-card-cab"><h4>Leads</h4></div>
  <div class="m-fila"><span class="m-crece"><b>Farmacia Ejemplo</b><br><small>${tx('Panamá')} · ${tx('solicitud de cuenta')}</small></span>${badge('Nuevo', 'azul')}</div>
  <div class="m-campo"><label>${tx('Estado')}</label><span class="m-input m-input-sel">${tx('Contactado')} ▾</span></div>
  <div class="m-campo"><label>${tx('Notas internas')}</label><span class="m-input m-input-area">${tx('Llamamos el lunes; interesados en registrar 2 productos.')}</span></div>
  <div class="m-acciones">${btn('Guardar', 'm-btn-primario m-btn-sm')}</div>
</div>`;

// Pantalla de cada paso: ruta en la aplicación + contenido, en el idioma activo. Las claves son los
// ids de los pasos. Es una función (no una constante) porque depende del idioma activo en i18n.
const ruta = (...tramos) => tramos.map(s => t(s)).join(' › ');
const pantallas = ({ demo = false } = {}) => ({
  cliente: {
    captacion:  { ruta: ruta('Portal del cliente', 'Mi Empresa'), html: mockCaptacion() },
    producto:   { ruta: ruta('Portal del cliente', 'Solicitar Registro'), html: mockProducto({ demo }) },
    documento:  { ruta: ruta('Portal del cliente', 'Solicitar Registro', '4. Documentos'), html: mockDocumentos() },
    cotizacion: { ruta: ruta('Portal del cliente', 'Cotización'), html: mockCotizacion('enviada') },
    pago:       { ruta: ruta('Portal del cliente', 'Cotización'), html: mockCotizacion('aceptada') + mockCotizacion('pagada') },
    mensaje:    { ruta: ruta('Portal del cliente', 'Mensajes'), html: mockMensajes() },
  },
  regente: {
    documento: { ruta: ruta('Back-office', 'Mi Bandeja', 'Expediente'), html: mockExpediente() },
    cotejo:    { ruta: ruta('Back-office', 'Expediente', 'Fase 8 — Confirmaciones'), html: mockFase8() },
    lead:      { ruta: ruta('Back-office', 'Leads'), html: mockLead() },
  },
});

// ── Página ─────────────────────────────────────────────────────────────────────────────────────
// Pasos en el idioma del manual (services/demo_recorrido_textos.js: la misma fuente que el panel).
const pasosTraducidos = (idioma, variante) => pasosEnIdioma(variante, idioma);

function marco(etq, ruta, html, rol) {
  return `<figure class="pantalla pantalla-${rol}"><figcaption><span class="pantalla-ruta">${esc(ruta)}</span><span class="pantalla-nota">${esc(etq.pantalla)}</span></figcaption><div class="pantalla-cuerpo">${html}</div></figure>`;
}

// Los pasos del manual de `rol`, con la pantalla de cada uno. El manual del cliente usa la variante
// de cliente real (sin PDF de ejemplo ni botón de datos de ejemplo: eso va en el apartado de la demo).
function seccionPasos(idioma, rol) {
  const comunes = TEXTOS[idioma].comunes;
  const etq = comunes.etiquetas;
  const pasos = pasosTraducidos(idioma, VARIANTE[rol]);
  const sec = TEXTOS[idioma][rol].secciones.pasos;
  const PANTALLAS = pantallas({ demo: false });
  const items = pasos.map((p, i) => {
    const sig = pasos[i + 1];
    const pantalla = PANTALLAS[rol][p.id];
    return `
<article class="paso" id="${rol}-${esc(p.id)}">
  <div class="paso-cab"><span class="paso-num">${i + 1}</span><h3>${esc(p.titulo)}</h3></div>
  <p class="paso-desc">${esc(p.descripcion)}</p>
  ${marco(etq, pantalla.ruta, pantalla.html, rol)}
  <p class="paso-sig">${sig ? `<span>${esc(etq.siguiente)}:</span> <a href="#${rol}-${esc(sig.id)}">${i + 2}. ${esc(sig.titulo)}</a>` : `<span class="fin">✓ ${esc(etq.fin)}</span>`}</p>
</article>`;
  }).join('');
  return `
<section class="seccion seccion-${rol}" id="pasos">
  <h2>${esc(sec.titulo)}</h2>
  <p class="seccion-intro">${esc(sec.intro)}</p>
  ${items}
</section>`;
}

// Apartado del manual del cliente para quien prueba la cuenta de demostración: topbar con el botón
// de reinicio y el asistente con "Rellenar con datos de ejemplo". Sin enlace al PDF de ejemplo
// (Rick, 01-nov-2026): la carga de documentos se simula en la demo, no hay nada que descargar.
function seccionDemo(idioma) {
  const comunes = TEXTOS[idioma].comunes;
  const sec = TEXTOS[idioma].cliente.secciones.demo;
  return `
<section class="seccion" id="demo">
  <h2>${esc(sec.titulo)}</h2>
  ${sec.parrafos.map(p => `<p>${esc(p)}</p>`).join('')}
  ${marco(comunes.etiquetas, t('Portal del cliente'), mockTopbar(idioma, { demo: true }) + mockProducto({ demo: true }), 'cliente')}
</section>`;
}

function seccionFases(idioma, rol) {
  const comunes = TEXTOS[idioma].comunes;
  const sec = TEXTOS[idioma][rol].secciones.fases;
  const marcadas = FASES_RECORRIDO[rol];
  const filas = comunes.fases.map((nombre, i) => {
    const n = i + 1;
    const enRecorrido = marcadas.includes(n);
    return `<li class="${enRecorrido ? `fase-demo fase-${rol}` : ''}"><span class="fase-num">${n}</span><span class="fase-nombre">${esc(nombre)}</span>${enRecorrido ? `<span class="fase-tag">${esc(comunes.etiquetas.enRecorrido)}</span>` : ''}</li>`;
  }).join('');
  return `
<section class="seccion" id="fases">
  <h2>${esc(sec.titulo)}</h2>
  <p class="seccion-intro">${esc(sec.intro)}</p>
  <ol class="fases">${filas}</ol>
</section>`;
}

/**
 * HTML completo del manual de `rol` ('cliente' | 'regente') en `idioma`. `fecha` fija el pie para que
 * tests/manual.test.js pueda regenerar y comparar byte a byte.
 */
function generarManual(idioma, rol = 'cliente', fecha = new Date().toISOString().slice(0, 10)) {
  if (!ROLES.includes(rol)) throw new Error(`rol desconocido: ${rol}`);
  i18n.usarSync(idioma); // las pantallas reproducidas salen en el idioma del manual
  const comunes = TEXTOS[idioma].comunes;
  const t = TEXTOS[idioma][rol];
  const etq = comunes.etiquetas;
  const otros = IDIOMAS.map(i => `<a href="./${i}.html" ${i === idioma ? 'aria-current="page"' : ''} lang="${i}">${esc(NOMBRES[i])}</a>`).join('');
  const secciones = [['empezar', t.secciones.empezar.titulo], ['panel', t.secciones.panel.titulo], ['pasos', t.secciones.pasos.titulo]];
  if (rol === 'cliente') secciones.push(['demo', t.secciones.demo.titulo]);
  secciones.push(['fases', t.secciones.fases.titulo], ['notas', t.secciones.notas.titulo]);
  const indice = secciones.map(([id, tit]) => `<li><a href="#${id}">${esc(tit)}</a></li>`).join('');
  // Réplica del panel en su contexto: topbar del portal (cliente real) o del back-office (regente).
  const panelMock = rol === 'cliente'
    ? marco(etq, t_('Portal del cliente'), mockTopbar(idioma) + mockPanel(idioma, 'clienteReal'), 'cliente')
    : marco(etq, t_('Back-office'), mockTopbarBackoffice(idioma) + mockPanel(idioma, 'regente'), 'regente');
  const volver = rol === 'cliente'
    ? `<a href="/client-dashboard.html">${esc(etq.volverPortal)}</a>`
    : `<a href="/admin/bandeja.html">${esc(etq.volverBackoffice)}</a>`;

  return `<!DOCTYPE html>
<html lang="${idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.titulo)} · Farmazed</title>
<meta name="description" content="${esc(t.subtitulo)}">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon_Farzed.png">
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&family=Open+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
${CSS}
</style>
</head>
<body>
<header class="cabecera">
  <div class="ancho">
    <nav class="idiomas" aria-label="${esc(etq.idiomas)}">${otros}</nav>
    <p class="marca">Farmazed</p>
    <h1>${esc(t.titulo)}</h1>
    <p class="subtitulo">${esc(t.subtitulo)}</p>
    <div class="cabecera-acciones">
      <a class="enlace-boton claro" href="/login.html">${esc(etq.entrar)}</a>
      <button type="button" class="enlace-boton claro" onclick="window.print()">${esc(etq.imprimir)}</button>
    </div>
  </div>
</header>
<main class="ancho">
  <section class="intro">
    ${t.intro.map(p => `<p>${esc(p)}</p>`).join('')}
    <nav class="indice" aria-label="${esc(comunes.indice)}"><h2>${esc(comunes.indice)}</h2><ol>${indice}</ol></nav>
  </section>

  <section class="seccion" id="empezar">
    <h2>${esc(t.secciones.empezar.titulo)}</h2>
    ${t.secciones.empezar.parrafos.map(p => `<p>${esc(p)}</p>`).join('')}
  </section>

  <section class="seccion" id="panel">
    <h2>${esc(t.secciones.panel.titulo)}</h2>
    ${t.secciones.panel.parrafos.map(p => `<p>${esc(p)}</p>`).join('')}
    <div class="dos">
      ${panelMock}
    </div>
  </section>
  ${seccionPasos(idioma, rol)}
  ${rol === 'cliente' ? seccionDemo(idioma) : ''}
  ${seccionFases(idioma, rol)}

  <section class="seccion" id="notas">
    <h2>${esc(t.secciones.notas.titulo)}</h2>
    <ul class="notas">${t.secciones.notas.items.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
  </section>
</main>
<footer class="pie ancho">
  <span>${volver}</span>
  <span>${esc(etq.actualizado)} ${fecha}</span>
</footer>
</body>
</html>
`;
}
const t_ = (s) => i18n.t(s);

const CSS = `
:root{--azul:#1B4F8A;--navy:#0F3260;--verde:#3A7D44;--ambar:#BA7517;--rojo:#A32D2D;--tinte:#E8EFF8;--fondo:#F4F6FB;--tarjeta:#fff;--texto:#1e293b;--mudo:#64748b;--borde:rgba(15,50,96,.12);--fuente:'Open Sans',sans-serif;--titulos:'Oswald',sans-serif;--mono:'IBM Plex Mono',monospace;--radio:10px}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:16px}
body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--fuente);font-size:16px;line-height:1.6}
.ancho{max-width:860px;margin:0 auto;padding:0 16px}
h1,h2,h3,h4,h5{font-family:var(--titulos);font-weight:600;line-height:1.2;margin:0}
a{color:var(--azul)}
.cabecera{background:var(--navy);color:#fff;padding:28px 0 36px}
.cabecera .marca{font-family:var(--titulos);letter-spacing:.14em;text-transform:uppercase;font-size:.8rem;color:rgba(255,255,255,.7);margin:0 0 6px}
.cabecera h1{font-size:clamp(1.9rem,4vw,2.6rem);font-weight:400}
.cabecera .subtitulo{color:rgba(255,255,255,.78);margin:8px 0 0;font-size:1.05rem}
.idiomas{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:14px}
.idiomas a{color:rgba(255,255,255,.75);text-decoration:none;font-size:.82rem;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.25)}
.idiomas a[aria-current]{background:#fff;color:var(--navy);border-color:#fff;font-weight:600}
.cabecera-acciones{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}
.enlace-boton{display:inline-block;font:600 .9rem var(--fuente);text-decoration:none;color:#fff;background:var(--azul);border:1px solid var(--azul);padding:9px 16px;border-radius:var(--radio);cursor:pointer}
.enlace-boton.claro{background:transparent;border-color:rgba(255,255,255,.45)}
.enlace-boton.claro:hover{background:rgba(255,255,255,.1)}
main{padding:28px 16px 40px}
.intro p{font-size:1.08rem;margin:0 0 14px}
.indice{background:var(--tarjeta);border:1px solid var(--borde);border-radius:var(--radio);padding:18px 22px;margin-top:22px}
.indice h2{font-size:.85rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mudo);margin-bottom:8px}
.indice ol{margin:0;padding-left:20px;columns:2;column-gap:28px}
.indice li{margin:4px 0;break-inside:avoid}
.seccion{margin-top:44px;padding-top:28px;border-top:1px solid var(--borde)}
.seccion h2{font-size:1.75rem;color:var(--navy);margin-bottom:10px}
.seccion-intro{color:var(--mudo);margin:0 0 20px}
.seccion > p{margin:0 0 12px}
.paso{background:var(--tarjeta);border:1px solid var(--borde);border-radius:14px;padding:22px 24px;margin:18px 0}
.paso-cab{display:flex;align-items:center;gap:14px}
.paso-num{flex:none;width:38px;height:38px;border-radius:50%;background:var(--azul);color:#fff;font:600 1.05rem var(--titulos);display:grid;place-items:center}
.seccion-regente .paso-num{background:var(--verde)}
.paso h3{font-size:1.3rem;color:var(--navy)}
.paso-desc{margin:12px 0 0;font-size:1.02rem}
.paso-extra{margin:12px 0 0}
.paso-sig{margin:16px 0 0;font-size:.92rem;color:var(--mudo)}
.paso-sig a{font-weight:600;text-decoration:none}
.paso-sig .fin{color:var(--verde);font-weight:600}
.pantalla{margin:18px 0 0;border:1px solid var(--borde);border-radius:12px;overflow:hidden;background:#F4F6FB}
.pantalla figcaption{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;background:var(--azul);color:#fff;padding:8px 14px;font-size:.78rem}
.pantalla-regente figcaption{background:var(--verde)}
.pantalla-ruta{font-weight:600}
.pantalla-nota{color:rgba(255,255,255,.75)}
.pantalla-cuerpo{padding:16px;font-size:.86rem;display:grid;gap:14px}
.dos .pantalla-cuerpo{justify-items:end}
.dos .m-topbar{justify-self:stretch}
/* Réplicas de la interfaz */
.m-card,.m-modal,.m-panel{background:#fff;border:1px solid var(--borde);border-radius:10px;padding:16px;box-shadow:0 1px 2px rgba(15,50,96,.06)}
.m-modal{border-top:4px solid var(--azul)}
.m-card h4,.m-modal h4,.m-panel strong{font:600 1rem var(--titulos);color:var(--navy)}
.m-card h5{font:600 .9rem var(--titulos);color:var(--texto);margin:12px 0 8px}
.m-modal p{color:var(--mudo);margin:6px 0 12px;font-size:.82rem}
.m-card-cab{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.m-btn{display:inline-block;padding:6px 14px;border-radius:7px;border:1px solid var(--azul);background:#fff;color:var(--azul);font-weight:600;font-size:.84rem;line-height:1.3;white-space:nowrap}
.m-btn-primario{background:var(--azul);color:#fff}
.m-btn-contorno{background:#fff}
.m-btn-aviso{background:#ffc107;border-color:#ffc107;color:#1e293b}
.m-btn-ok{color:var(--verde);border-color:var(--verde)}
.m-btn-no{color:var(--rojo);border-color:var(--rojo)}
.m-btn-sm{padding:4px 10px;font-size:.78rem}
.m-badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:.72rem;font-weight:700;border:1px solid transparent;white-space:nowrap}
.m-badge.azul{background:var(--tinte);color:var(--azul)}
.m-badge.verde{background:#e6f1e7;color:var(--verde)}
.m-badge.ambar{background:#fbf1e1;color:var(--ambar)}
.m-campo{margin:12px 0 0}
.m-campo label{display:block;font-weight:600;font-size:.82rem;margin-bottom:6px}
.m-radio{display:inline-flex;align-items:center;gap:6px;margin-right:16px;font-size:.84rem}
.m-radio i{width:14px;height:14px;border-radius:50%;border:1.5px solid #94a3b8;display:inline-block}
.m-radio i.on{border-color:var(--azul);background:radial-gradient(var(--azul) 45%,#fff 50%)}
.m-input{display:inline-block;min-width:160px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;font-size:.84rem}
.m-input-sel{padding-right:8px}
.m-input-vacio{color:#94a3b8}
.m-input-area{display:block;min-height:54px}
.m-acciones{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
.m-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:12px 0 4px;border-bottom:1px solid var(--borde)}
.m-tabs span{padding:6px 10px;font-size:.76rem;color:var(--mudo);border-bottom:2px solid transparent}
.m-tabs span.on{color:var(--azul);border-bottom-color:var(--azul);font-weight:700}
.m-opciones{display:flex;gap:8px;flex-wrap:wrap}
.m-opciones span{padding:8px 14px;border:1px solid var(--borde);border-radius:8px;font-weight:600;font-size:.84rem}
.m-opciones span.on{border-color:var(--azul);background:var(--tinte);color:var(--azul)}
.m-fila{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--borde);flex-wrap:wrap}
.m-fila:first-of-type{border-top:0}
.m-fila small{color:var(--mudo)}
.m-fila-mas{color:var(--mudo);justify-content:center}
.m-crece{flex:1 1 180px}
.m-cod{font-family:var(--mono);font-size:.78rem;color:var(--mudo);min-width:36px}
.m-mono{font-family:var(--mono);font-weight:500}
.m-desglose{margin-top:8px;border-top:1px dashed var(--borde);padding-top:8px;font-size:.84rem}
.m-desglose div{display:flex;justify-content:space-between;padding:3px 0}
.m-desglose .m-total{border-top:1px solid var(--borde);margin-top:6px;padding-top:8px;font-weight:700}
.m-fase{margin-top:14px;padding-top:12px;border-top:1px solid var(--borde);display:flex;align-items:center;gap:8px;font-weight:600}
.m-hilo{display:grid;gap:8px;margin:12px 0}
.m-msg{max-width:85%;background:var(--fondo);border-radius:10px;padding:8px 12px;font-size:.84rem}
.m-msg.mio{justify-self:end;background:var(--tinte)}
.m-msg small{display:block;color:var(--mudo);font-size:.7rem;margin-bottom:2px}
.m-topbar{display:flex;align-items:center;gap:12px;background:var(--azul);color:#fff;border-radius:8px;padding:8px 12px;flex-wrap:wrap}
.m-topbar-bo{background:#fff;color:var(--texto);border:1px solid var(--borde)}
.m-topbar-bo .m-link{color:var(--azul)}
.m-topbar-bo .m-idioma{border-color:#cfd8e3;color:var(--mudo)}
.m-topbar-bo .m-idioma.activo{background:var(--navy);border-color:var(--navy);color:#fff}
.m-topbar-txt{font-size:.78rem;margin-left:auto}
.m-topbar .m-link{text-decoration:underline;font-size:.82rem}
.m-avatar{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;font:600 .72rem var(--titulos)}
.m-panel{max-width:340px;width:100%}
.m-panel-cab{display:flex;justify-content:space-between;align-items:center}
.m-barra{height:4px;background:var(--tinte);border-radius:2px;margin:10px 0;overflow:hidden}
.m-barra span{display:block;height:100%;background:var(--azul)}
.m-idiomas{display:flex;justify-content:flex-end;gap:4px;margin:8px 0 2px}
.m-idioma{font-size:.62rem;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:999px;border:1px solid #cfd8e3;color:var(--mudo)}
.m-idioma.activo{background:var(--navy);border-color:var(--navy);color:#fff}
.m-pasos{list-style:none;margin:0;padding:0;font-size:.82rem}
.m-pasos li{padding:6px 0 6px 8px;color:var(--mudo)}
.m-pasos li.actual{color:var(--texto);border-left:3px solid var(--azul);background:var(--fondo);border-radius:0 6px 6px 0;padding:8px 10px}
.m-pasos li small{display:block;color:var(--mudo);margin:4px 0 8px;font-size:.76rem}
.fases{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.fases li{display:flex;align-items:center;gap:12px;background:var(--tarjeta);border:1px solid var(--borde);border-radius:10px;padding:10px 14px;flex-wrap:wrap}
.fase-num{flex:none;width:30px;height:30px;border-radius:50%;background:var(--tinte);color:var(--azul);font:600 .9rem var(--titulos);display:grid;place-items:center}
.fase-demo{border-color:var(--azul)}
.fase-regente{border-color:var(--verde)}
.fase-regente .fase-num{background:#e6f1e7;color:var(--verde)}
.fase-nombre{flex:1 1 200px}
.fase-tag{font-size:.72rem;font-weight:700;color:var(--azul);background:var(--tinte);padding:3px 9px;border-radius:999px}
.fase-regente .fase-tag{color:var(--verde);background:#e6f1e7}
.notas{margin:0;padding-left:22px}
.notas li{margin:8px 0}
.pie{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:20px;padding-bottom:40px;border-top:1px solid var(--borde);color:var(--mudo);font-size:.88rem}
@media (max-width:640px){.indice ol{columns:1}.paso{padding:18px 16px}.pantalla-cuerpo{padding:12px}}
@media print{
  body{background:#fff;font-size:12pt}
  .cabecera{background:none;color:#000;padding:0 0 12pt;border-bottom:2pt solid #000}
  .cabecera .marca,.cabecera .subtitulo{color:#444}
  .idiomas,.cabecera-acciones,.pie a{display:none}
  .seccion{break-before:page;border-top:0;margin-top:0;padding-top:0}
  .seccion#empezar{break-before:auto}
  .paso,.pantalla,.fases li{break-inside:avoid;box-shadow:none}
  .pantalla figcaption,.m-topbar,.paso-num,.m-btn-primario{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  a{color:inherit;text-decoration:none}
}
`;

function main() {
  for (const rol of ROLES) {
    fs.mkdirSync(path.join(DESTINO, rol), { recursive: true });
    for (const idioma of IDIOMAS) {
      const ruta = path.join(DESTINO, rol, `${idioma}.html`);
      fs.writeFileSync(ruta, generarManual(idioma, rol));
      process.stdout.write(`${path.relative(process.cwd(), ruta)}\n`);
    }
  }
}

if (require.main === module) main();

module.exports = { generarManual, IDIOMAS, ROLES, DESTINO };

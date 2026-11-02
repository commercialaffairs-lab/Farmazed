/**
 * i18n.js — Idiomas de la interfaz (español, inglés, francés, portugués). Rick, 01-nov-2026:
 * "make sure the official demo has the 4 languages as well and so the manuals, so we don't have
 * language mixtures".
 *
 * Es un <script> CLÁSICO (no módulo) que se carga en el <head> de cada página traducida, para que
 * `FZI18N.t()` exista antes que cualquier otro script (los módulos ES son diferidos; el código
 * clásico de client-dashboard.html corre durante el parseo). También se puede hacer `require()`
 * desde Node (el generador del manual usa los mismos diccionarios para reproducir las pantallas).
 *
 * Cómo funciona:
 *   - El español es la fuente. Los diccionarios son JSON planos en /i18n/{en,fr,pt}.json con el
 *     TEXTO EN ESPAÑOL como clave: { "Mis Productos": "My Products" }. Si falta una clave, se muestra
 *     el español y la clave queda en `FZI18N.faltantes` (así se detectan mezclas).
 *   - Texto estático: `<h2 data-i18n>Mis Productos</h2>`; atributos: `data-i18n-attr="placeholder,title"`;
 *     con etiquetas dentro: `data-i18n-html` (clave = innerHTML exacto; evitar si se puede).
 *     `aplicar()` recorre el DOM y guarda el original en data-i18n-es para poder volver a traducir.
 *     Un MutationObserver aplica a lo que se inserte después (modales, plantillas).
 *   - Texto generado por JS: `t('Texto')`, con marcadores `t('Paso {n} de {total}', { n, total })`.
 *     Las etiquetas que llegan del tracker (fases, nombres de documentos, estados) también pasan por
 *     `t()`: están en el diccionario.
 *   - Fechas: `FZI18N.fecha(valor)` / `fechaHora(valor)` usan la configuración regional del idioma.
 *   - Cambio en vivo: `cambiarIdioma('en')` guarda la preferencia (localStorage `fzIdioma`), vuelve a
 *     aplicar el DOM estático y avisa a `onCambio(cb)` (y al evento `fz:idioma` en document) para que
 *     cada página repinte lo que generó por JS.
 *   - Por defecto español. No se adivina por el navegador: la persona elige en el selector del topbar
 *     (`montarSelector(contenedor)`).
 *   - Mientras carga un diccionario distinto del español, el <body> queda oculto (html.fz-i18n-cargando)
 *     como mucho 2 s, para no mostrar un destello en español.
 *
 * Ver farmazed-web/i18n/README.md (convenciones) y tracker/tests/i18n.test.js (cobertura).
 */
(function (global) {
  'use strict';

  const IDIOMAS = ['es', 'en', 'fr', 'pt'];
  const IDIOMA_POR_DEFECTO = 'es';
  const NOMBRES = { es: 'Español', en: 'English', fr: 'Français', pt: 'Português' };
  const LOCALES = { es: 'es-PA', en: 'en-US', fr: 'fr-FR', pt: 'pt-PT' };
  const CLAVE = 'fzIdioma';
  const CLAVE_ANTIGUA = 'fzRecorridoIdioma'; // la preferencia del panel "Recorrido demo" antes de existir esta capa
  const RUTA_DICCIONARIOS = '/i18n/';
  const ESPERA_MAX_MS = 2000;

  const enNode = typeof window === 'undefined';
  let idiomaActual = IDIOMA_POR_DEFECTO;
  let diccionario = {};
  const oyentes = new Set();
  const faltantes = new Set();

  function normalizar(valor) {
    const base = String(valor || '').toLowerCase().slice(0, 2);
    return IDIOMAS.includes(base) ? base : IDIOMA_POR_DEFECTO;
  }

  function leerGuardado() {
    try { return localStorage.getItem(CLAVE) || localStorage.getItem(CLAVE_ANTIGUA); } catch (e) { return null; }
  }
  function guardar(idioma) {
    try { localStorage.setItem(CLAVE, idioma); localStorage.setItem(CLAVE_ANTIGUA, idioma); } catch (e) { /* sin localStorage no se recuerda */ }
  }

  function interpolar(plantilla, vars) {
    if (!vars) return plantilla;
    return plantilla.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  /** Traduce un texto (clave = el español exacto). Si falta, devuelve el español y lo anota. */
  function t(texto, vars) {
    if (texto === null || texto === undefined) return '';
    const clave = String(texto);
    let salida = clave;
    if (idiomaActual !== 'es') {
      const trad = diccionario[clave];
      if (typeof trad === 'string') salida = trad;
      else if (clave.trim()) faltantes.add(clave);
    }
    return interpolar(salida, vars);
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────────────────────
  function aplicarElemento(el) {
    if (el.hasAttribute('data-i18n')) {
      if (el.dataset.i18nEs === undefined) el.dataset.i18nEs = el.textContent.trim();
      el.textContent = t(el.dataset.i18nEs);
    }
    if (el.hasAttribute('data-i18n-html')) {
      if (el.dataset.i18nEsHtml === undefined) el.dataset.i18nEsHtml = el.innerHTML.trim();
      el.innerHTML = t(el.dataset.i18nEsHtml);
    }
    const attrs = el.getAttribute('data-i18n-attr');
    if (attrs) {
      for (const attr of attrs.split(',').map(s => s.trim()).filter(Boolean)) {
        // El original se guarda en data-i18n-es-<attr> (con setAttribute: dataset no admite guiones).
        const guardado = `data-i18n-es-${attr}`;
        if (!el.hasAttribute(guardado)) el.setAttribute(guardado, el.getAttribute(attr) || '');
        el.setAttribute(attr, t(el.getAttribute(guardado)));
      }
    }
  }

  /** Traduce todo lo marcado con data-i18n / data-i18n-html / data-i18n-attr bajo `raiz`. */
  function aplicar(raiz) {
    if (enNode) return;
    const base = raiz || document;
    if (base.nodeType === 1) aplicarElemento(base);
    base.querySelectorAll('[data-i18n],[data-i18n-html],[data-i18n-attr]').forEach(aplicarElemento);
    actualizarSelectores(base);
  }

  function observar() {
    if (enNode || !document.body || observar.hecho) return;
    observar.hecho = true;
    new MutationObserver((cambios) => {
      if (idiomaActual === 'es') return;
      for (const c of cambios) {
        c.addedNodes.forEach((n) => { if (n.nodeType === 1) aplicar(n); });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Carga de diccionarios ───────────────────────────────────────────────────────────────────
  function leerDiccionarioNode(idioma) {
    const fs = require('fs');
    const path = require('path');
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'i18n', `${idioma}.json`), 'utf8'));
  }

  async function cargar(idioma) {
    if (idioma === 'es') return {};
    if (enNode) return leerDiccionarioNode(idioma);
    const r = await fetch(`${RUTA_DICCIONARIOS}${idioma}.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`diccionario ${idioma}: HTTP ${r.status}`);
    return r.json();
  }

  function avisar() {
    oyentes.forEach((cb) => { try { cb(idiomaActual); } catch (e) { console.error('[i18n] oyente', e); } });
    if (!enNode) document.dispatchEvent(new CustomEvent('fz:idioma', { detail: { idioma: idiomaActual } }));
  }

  // La última petición manda: dos clics rápidos (EN, FR) no deben dejar el idioma del que respondió más tarde.
  let peticion = 0;

  /** Activa un idioma: carga su diccionario, traduce el DOM estático y avisa a las páginas. */
  async function usar(idioma) {
    const nuevo = normalizar(idioma);
    const mia = ++peticion;
    let cargado;
    let fallo = null;
    try {
      cargado = await cargar(nuevo);
    } catch (e) {
      fallo = e;
    }
    if (mia !== peticion) return idiomaActual; // otra petición más nueva ya decidió
    if (fallo) {
      console.error('[i18n] no se pudo cargar el diccionario', nuevo, fallo.message);
      diccionario = {};
      idiomaActual = 'es';
    } else {
      diccionario = cargado;
      idiomaActual = nuevo;
    }
    faltantes.clear();
    if (!enNode) {
      document.documentElement.lang = idiomaActual;
      if (document.body) aplicar(document);
    }
    avisar();
    return idiomaActual;
  }

  /** Solo Node (generador del manual): activa el idioma leyendo el JSON de disco, sin promesas. */
  function usarSync(idioma) {
    const nuevo = normalizar(idioma);
    diccionario = nuevo === 'es' ? {} : leerDiccionarioNode(nuevo);
    idiomaActual = nuevo;
    faltantes.clear();
    return idiomaActual;
  }

  /** La persona eligió un idioma: se aplica y, si su diccionario cargó, se guarda la preferencia. */
  async function cambiarIdioma(idioma) {
    const nuevo = normalizar(idioma);
    if (nuevo === idiomaActual) { guardar(nuevo); return nuevo; }
    const resultado = await usar(nuevo);
    if (resultado === nuevo) guardar(nuevo); // si falló la carga no se guarda: la próxima vez no se ocultaría el body para nada
    return resultado;
  }

  function onCambio(cb) { oyentes.add(cb); return () => oyentes.delete(cb); }

  /**
   * Repinta sin perder lo que la persona estaba escribiendo: guarda los valores de inputs, textareas
   * y selects con id (o name) bajo `raiz`, ejecuta `repintar` (puede ser async) y los repone en los
   * elementos que vuelvan a existir con el mismo id/name. Para los handlers de onCambio de páginas
   * que reconstruyen formularios con innerHTML.
   */
  async function repintarConservando(repintar, raiz) {
    if (enNode) return repintar();
    const base = raiz || document;
    const guardados = [];
    base.querySelectorAll('input[id],input[name],textarea[id],textarea[name],select[id],select[name]').forEach((el) => {
      if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') return;
      const clave = el.id ? `#${el.id}` : `[name="${el.name}"]`;
      const valor = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
      const porDefecto = (el.type === 'checkbox' || el.type === 'radio') ? el.defaultChecked : (el.tagName === 'SELECT' ? null : el.defaultValue);
      if (valor !== porDefecto) guardados.push({ clave, valor, tipo: el.type });
    });
    await repintar();
    for (const g of guardados) {
      const el = base.querySelector(g.clave);
      if (!el) continue;
      if (g.tipo === 'checkbox' || g.tipo === 'radio') el.checked = g.valor;
      else el.value = g.valor;
    }
  }

  // ── Fechas ──────────────────────────────────────────────────────────────────────────────────
  function aFecha(valor) {
    if (valor && typeof valor.toDate === 'function') return valor.toDate();
    if (valor && typeof valor === 'object' && typeof valor._seconds === 'number') return new Date(valor._seconds * 1000);
    if (valor && typeof valor === 'object' && typeof valor.seconds === 'number') return new Date(valor.seconds * 1000);
    return new Date(valor);
  }
  function fecha(valor, opciones) {
    const d = aFecha(valor);
    return isNaN(d) ? '' : d.toLocaleDateString(LOCALES[idiomaActual], opciones);
  }
  function fechaHora(valor, opciones) {
    const d = aFecha(valor);
    return isNaN(d) ? '' : d.toLocaleString(LOCALES[idiomaActual], opciones);
  }

  // ── Selector ES · EN · FR · PT ──────────────────────────────────────────────────────────────
  const CSS_SELECTOR = `
.fz-idiomas{display:inline-flex;gap:4px;align-items:center}
.fz-idioma{font:inherit;font-size:.68rem;font-weight:700;letter-spacing:.04em;line-height:1;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:transparent;color:rgba(255,255,255,.8);cursor:pointer}
.fz-idioma:hover{background:rgba(255,255,255,.12);color:#fff}
.fz-idioma[aria-pressed="true"]{background:#fff;border-color:#fff;color:#0F3260;cursor:default}
.fz-idiomas.oscuro .fz-idioma{border-color:#cfd8e3;color:#6b7280}
.fz-idiomas.oscuro .fz-idioma:hover{background:#f3f6fa;color:#1f2937}
.fz-idiomas.oscuro .fz-idioma[aria-pressed="true"]{background:#0F3260;border-color:#0F3260;color:#fff}
html.fz-i18n-cargando body{visibility:hidden}
`;
  function instalarCss() {
    if (enNode || document.getElementById('fz-i18n-css')) return;
    const style = document.createElement('style');
    style.id = 'fz-i18n-css';
    style.textContent = CSS_SELECTOR;
    (document.head || document.documentElement).appendChild(style);
  }

  function actualizarSelectores(raiz) {
    (raiz || document).querySelectorAll('.fz-idioma[data-idioma]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.idioma === idiomaActual));
    });
  }

  /**
   * Pinta los botones ES · EN · FR · PT dentro de `contenedor` (elemento o selector CSS).
   * `oscuro: true` para fondos claros (topbar blanco del back-office).
   */
  function montarSelector(contenedor, opciones) {
    if (enNode) return null;
    const el = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
    if (!el) return null;
    instalarCss();
    const grupo = document.createElement('div');
    grupo.className = `fz-idiomas${opciones && opciones.oscuro ? ' oscuro' : ''}`;
    grupo.setAttribute('role', 'group');
    grupo.setAttribute('aria-label', t('Idioma'));
    grupo.setAttribute('data-i18n-attr', 'aria-label');
    grupo.setAttribute('data-i18n-es-aria-label', 'Idioma');
    for (const i of IDIOMAS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fz-idioma';
      b.dataset.idioma = i;
      b.lang = i;
      b.title = NOMBRES[i];
      b.textContent = i.toUpperCase();
      b.setAttribute('aria-pressed', String(i === idiomaActual));
      b.addEventListener('click', () => { cambiarIdioma(i); });
      grupo.appendChild(b);
    }
    el.appendChild(grupo);
    return grupo;
  }

  // ── Arranque en el navegador ────────────────────────────────────────────────────────────────
  let listo = Promise.resolve('es');
  if (!enNode) {
    instalarCss();
    const inicial = normalizar(leerGuardado());
    if (inicial !== 'es') {
      document.documentElement.classList.add('fz-i18n-cargando');
      setTimeout(() => document.documentElement.classList.remove('fz-i18n-cargando'), ESPERA_MAX_MS);
    }
    listo = (async () => {
      const diccionarioInicial = cargar(inicial).catch((e) => { console.error('[i18n]', e.message); return null; });
      if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
      const d = await diccionarioInicial;
      diccionario = d || {};
      idiomaActual = d ? inicial : 'es';
      document.documentElement.lang = idiomaActual;
      aplicar(document);
      observar();
      document.documentElement.classList.remove('fz-i18n-cargando');
      avisar();
      return idiomaActual;
    })();
  }

  const api = {
    IDIOMAS, NOMBRES, LOCALES, CLAVE,
    t, aplicar, usar, usarSync, cambiarIdioma, onCambio, repintarConservando, fecha, fechaHora, montarSelector, normalizar,
    idioma: () => idiomaActual,
    locale: () => LOCALES[idiomaActual],
    faltantes,
    listo,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.FZI18N = api;
})(typeof window !== 'undefined' ? window : globalThis);

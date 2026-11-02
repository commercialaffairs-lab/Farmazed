/**
 * recorrido.js — Panel del recorrido guiado (tarjeta flotante abajo a la derecha).
 *
 * Dos recorridos, separados (Rick, 01-nov-2026):
 *   - **Demo** (claim `demo:true`): cliente demo y regente demo. Pregunta al tracker
 *     (GET /api/demo/recorrido, services/demo_recorrido.js) y aparece siempre; se minimiza, no se cierra.
 *     El recorrido del regente SOLO existe aquí.
 *   - **Cliente real** (cliente_titular / cliente_miembro): se activa en "Mi cuenta" (preferencia
 *     `recorridoGuiado` guardada en el tracker, GET/PUT /api/me/preferencias) y pregunta a
 *     GET /api/me/recorrido (services/recorrido_cliente.js). Tiene una ✕ para ocultarlo (vuelve a
 *     activarse en "Mi cuenta").
 *
 * En ambos casos el progreso se deduce de los datos (no se guarda) y "Ir al paso" lo resuelve la
 * página que monta el panel (`irA(pasoId)`), porque navegar es distinto en cada una.
 *
 *   import { montarRecorrido, activarRecorrido, desactivarRecorrido } from './recorrido.js';
 *   await montarRecorrido({ irA: (paso) => showModule(...) });
 *
 * Idiomas: el panel sigue el idioma de la interfaz (portal/js/i18n.js): escucha `FZI18N.onCambio` y
 * vuelve a pedir el recorrido. Aquí no hay tablas de textos: los pasos Y los rótulos
 * (`estado.etiquetas`) llegan ya traducidos del tracker (services/demo_recorrido_textos.js, la misma
 * fuente que el manual). El enlace "Ayuda" del topbar (#tb-ayuda) se sincroniza con el idioma y el
 * manual del rol (manual/cliente/ o manual/regente/).
 *
 * Se refresca solo: al volver a la pestaña y cada pocos segundos mientras está desplegado, y
 * cualquier página puede forzarlo con `window.__fzRecorrido.actualizar()` después de una acción.
 * Sin dependencias: inyecta su CSS una vez (mismo patrón que dialogos.js).
 */
import api from './api.js';
import { esc, esDemo, getRole } from './auth.js';

const CLAVE_PLEGADO = 'fzRecorridoPlegado';
const CLAVE_IDIOMA = 'fzIdioma'; // la misma preferencia que i18n.js
const CLAVE_IDIOMA_ANTIGUA = 'fzRecorridoIdioma';
const INTERVALO_MS = 12000;          // demo: datos de ejemplo, el ritmo que pide el recorrido
const INTERVALO_CLIENTE_MS = 45000;  // cliente real: su empresa cambia despacio y cada sondeo lee Firestore
const PDF_EJEMPLO = '/demo/documento-ejemplo.pdf';
const ROLES_CLIENTE = ['cliente_titular', 'cliente_miembro'];
const ERROR_SIN_ESTADO = 'No se pudo cargar el recorrido'; // antes de la primera respuesta no hay rótulos traducidos
const i18n = () => (typeof window !== 'undefined' ? window.FZI18N : null) || null;

const CSS = `
.fz-recorrido{position:fixed;right:16px;bottom:16px;z-index:1500;width:min(380px,calc(100vw - 32px));font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2937}
.fz-recorrido-tarjeta{background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(15,50,96,.28),inset 0 4px 0 0 #BA7517;overflow:hidden;animation:fzRecorridoEntra .2s ease-out}
.fz-recorrido-cab{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}
.fz-recorrido-cab .fz-recorrido-titulo{margin:0;font-size:.95rem;font-weight:700;letter-spacing:-.01em;flex:1}
.fz-recorrido-cab .fz-recorrido-contador{font-size:.72rem;font-weight:700;color:#BA7517;background:rgba(186,117,23,.1);padding:2px 8px;border-radius:20px;white-space:nowrap}
.fz-recorrido-plegar,.fz-recorrido-cerrar{border:none;background:transparent;color:#6b7280;font-size:1.1rem;line-height:1;cursor:pointer;padding:2px 6px;border-radius:6px}
.fz-recorrido-plegar:hover,.fz-recorrido-cerrar:hover{background:#f3f6fa;color:#1f2937}
.fz-recorrido-barra{height:4px;background:#e5e7eb;margin:0 16px}
.fz-recorrido-barra span{display:block;height:100%;background:#3A7D44;border-radius:2px;transform-origin:left;transition:transform .3s}
.fz-recorrido-pasos{list-style:none;margin:0;padding:12px 16px 4px;display:flex;flex-direction:column;gap:4px;max-height:40vh;overflow:auto}
.fz-recorrido-paso{display:flex;align-items:flex-start;gap:9px;font-size:.78rem;color:#6b7280;padding:3px 0}
.fz-recorrido-paso .fz-recorrido-icono{flex:none;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:.65rem;font-weight:700;border:1.5px solid #cfd8e3;color:#9ca3af;margin-top:1px}
.fz-recorrido-paso.hecho .fz-recorrido-icono{background:#3A7D44;border-color:#3A7D44;color:#fff}
.fz-recorrido-paso.hecho{color:#374151;text-decoration:line-through;text-decoration-color:rgba(0,0,0,.25)}
.fz-recorrido-paso.actual{color:#1f2937;font-weight:700}
.fz-recorrido-paso.actual .fz-recorrido-icono{background:#1B4F8A;border-color:#1B4F8A;color:#fff}
.fz-recorrido-actual{margin:8px 16px 0;padding:12px 14px;background:#E8EFF8;border-left:3px solid #1B4F8A;border-radius:8px}
.fz-recorrido-actual h3{margin:0 0 6px;font-size:.88rem;font-weight:700}
.fz-recorrido-actual p{margin:0;font-size:.8rem;line-height:1.5;color:#374151}
.fz-recorrido-nota{margin:8px 0 0;padding:8px 10px;font-size:.76rem;line-height:1.45;background:#FFFBF4;border:1px solid rgba(186,117,23,.3);border-radius:6px;color:#7c4a03}
.fz-recorrido-acciones{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px 14px}
.fz-recorrido-boton{font:inherit;font-size:.8rem;font-weight:600;padding:7px 14px;border-radius:8px;border:1px solid transparent;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.fz-recorrido-boton.principal{background:#1B4F8A;color:#fff}
.fz-recorrido-boton.principal:hover{background:#0F3260;color:#fff}
.fz-recorrido-boton.secundario{background:#fff;color:#374151;border-color:#cfd8e3}
.fz-recorrido-boton.secundario:hover{background:#f3f6fa}
.fz-recorrido-completo{margin:12px 16px 4px;padding:14px;border-radius:8px;background:rgba(58,125,68,.1);color:#1f4d2a;font-size:.82rem;line-height:1.5}
.fz-recorrido-completo strong{display:block;font-size:.95rem;margin-bottom:4px}
.fz-recorrido-pildora{display:flex;align-items:center;gap:10px;background:#0F3260;color:#fff;border:none;border-radius:999px;padding:10px 16px;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;box-shadow:0 10px 30px rgba(15,50,96,.35)}
.fz-recorrido-pildora:hover{background:#1B4F8A}
.fz-recorrido-pildora .fz-recorrido-contador{color:#fff;background:rgba(255,255,255,.18)}
.fz-recorrido-error{margin:12px 16px 14px;font-size:.78rem;color:#B42318}
@keyframes fzRecorridoEntra{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fz-recorrido-tarjeta{animation:none}}
@media print{.fz-recorrido{display:none}}
`;

function instalarCss() {
  if (document.getElementById('fz-recorrido-css')) return;
  const style = document.createElement('style');
  style.id = 'fz-recorrido-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

function leerPlegado() {
  try { return localStorage.getItem(CLAVE_PLEGADO) === '1'; } catch (e) { return false; }
}
function guardarPlegado(valor) {
  try { localStorage.setItem(CLAVE_PLEGADO, valor ? '1' : '0'); } catch (e) { /* sin localStorage, no se recuerda */ }
}

// Idioma: el de la interfaz (i18n.js) si la página lo carga; si no, la preferencia guardada o español.
// El tracker normaliza ('en-US' → 'en', desconocido → 'es'), así que basta con mandar lo que haya.
function leerIdioma() {
  if (i18n()) return i18n().idioma();
  try {
    return localStorage.getItem(CLAVE_IDIOMA) || localStorage.getItem(CLAVE_IDIOMA_ANTIGUA) || 'es';
  } catch (e) { return 'es'; }
}
function guardarIdioma(valor) {
  try { localStorage.setItem(CLAVE_IDIOMA, valor); } catch (e) { /* sin localStorage, no se recuerda */ }
}

// Rótulos con marcadores: "Paso {n}", "{n} de {total}".
const rotulo = (plantilla, valores) => String(plantilla || '').replace(/\{(\w+)\}/g, (m, k) => (k in valores ? valores[k] : m));

// Texto escapado con el nombre del botón del topbar, que los textos citan entre corchetes
// ([Reiniciar cuenta demo] / [Reset demo account]…), en negrita.
const conBotonReiniciar = (texto) => esc(texto).replace(/\[[^\]]+\]/g, (m) => `<b>${m}</b>`);

const esReal = (estado) => estado.variante === 'real';

// Acciones propias de algunos pasos del cliente DEMO, además de "Ir al paso" (el regente también tiene
// un paso 'documento', pero el suyo es revisar, no subir; el cliente real sube sus propios documentos).
function accionesExtra(paso, estado) {
  if (estado.rol === 'cliente' && !esReal(estado) && paso.id === 'documento') {
    return `<a class="fz-recorrido-boton secundario" href="${PDF_EJEMPLO}" download="documento-ejemplo.pdf">⬇ ${esc(estado.etiquetas.pdf)}</a>`;
  }
  return '';
}

// Número del paso actual por su posición en la lista (los pasos pueden hacerse en otro orden).
const numeroActual = (estado) => estado.pasos.findIndex(p => p.id === estado.actual) + 1;

function htmlTarjeta(estado) {
  const t = estado.etiquetas;
  const actual = estado.pasos.find(p => p.id === estado.actual) || null;
  const porcentaje = Math.round((estado.hechos / estado.total) * 100);
  const pasos = estado.pasos.map((p, i) => `
    <li class="fz-recorrido-paso ${p.hecho ? 'hecho' : ''} ${p.id === estado.actual ? 'actual' : ''}">
      <span class="fz-recorrido-icono" aria-hidden="true">${p.hecho ? '✓' : i + 1}</span>
      <span>${esc(p.titulo)}</span>
    </li>`).join('');
  const cuerpo = actual ? `
    <div class="fz-recorrido-actual" role="status">
      <h3>${esc(rotulo(t.paso, { n: numeroActual(estado) }))}: ${esc(actual.titulo)}</h3>
      <p>${esc(actual.descripcion)}</p>
      ${actual.nota ? `<p class="fz-recorrido-nota">${conBotonReiniciar(actual.nota)}</p>` : ''}
    </div>
    <div class="fz-recorrido-acciones">
      <button type="button" class="fz-recorrido-boton principal" data-accion="ir" data-paso="${esc(actual.id)}">${esc(t.ir)} →</button>
      ${accionesExtra(actual, estado)}
      <button type="button" class="fz-recorrido-boton secundario" data-accion="actualizar" title="${esc(t.actualizarTitulo)}" aria-label="${esc(t.actualizar)}">↻</button>
    </div>` : `
    <div class="fz-recorrido-completo" role="status">
      <strong>${esc(t.completoTitulo)}</strong>
      ${conBotonReiniciar(t.completoTexto)}
    </div>
    <div class="fz-recorrido-acciones">
      <button type="button" class="fz-recorrido-boton secundario" data-accion="actualizar">↻ ${esc(t.actualizar)}</button>
    </div>`;
  // El cliente real puede cerrar el panel (se reactiva en "Mi cuenta"); en la demo solo se minimiza.
  const cerrar = esReal(estado)
    ? `<button type="button" class="fz-recorrido-cerrar" data-accion="ocultar" title="${esc(t.ocultar)}" aria-label="${esc(t.ocultarAria)}">✕</button>` : '';
  return `
    <div class="fz-recorrido-tarjeta" role="complementary" aria-label="${esc(t.titulo)}">
      <div class="fz-recorrido-cab">
        <h2 class="fz-recorrido-titulo">${esc(t.titulo)}</h2>
        <span class="fz-recorrido-contador">${esc(rotulo(t.contador, { n: estado.hechos, total: estado.total }))}</span>
        <button type="button" class="fz-recorrido-plegar" data-accion="plegar" title="${esc(t.minimizar)}" aria-label="${esc(t.minimizarAria)}">—</button>
        ${cerrar}
      </div>
      <div class="fz-recorrido-barra"><span style="transform:scaleX(${porcentaje / 100})"></span></div>
      <ol class="fz-recorrido-pasos">${pasos}</ol>
      ${cuerpo}
    </div>`;
}

function htmlPildora(estado) {
  const t = estado.etiquetas;
  const texto = estado.completado ? t.completoPildora : rotulo(t.pildora, { n: numeroActual(estado), total: estado.total });
  return `<button type="button" class="fz-recorrido-pildora" data-accion="desplegar" aria-label="${esc(t.abrirAria)}">
    ▶ ${esc(texto)} <span class="fz-recorrido-contador">${estado.hechos}/${estado.total}</span></button>`;
}

// El enlace "Ayuda" del topbar abre el manual del rol en el idioma del panel.
function sincronizarAyuda(estado) {
  const ayuda = document.getElementById('tb-ayuda');
  if (!ayuda || !estado?.idioma) return;
  ayuda.href = `/manual/${estado.rol === 'regente' ? 'regente' : 'cliente'}/${encodeURIComponent(estado.idioma)}.html`;
}

const avisarCambio = (activo) => document.dispatchEvent(new CustomEvent('fz:recorrido', { detail: { activo } }));

/**
 * Decide qué recorrido le toca a esta sesión: 'demo' (cuenta demo), 'cliente' (cliente real con la
 * preferencia activa, o `forzar` recién activada en "Mi cuenta") o null (nada que mostrar).
 */
async function fuenteRecorrido(forzar) {
  if (await esDemo()) return 'demo';
  if (!ROLES_CLIENTE.includes(await getRole())) return null;
  if (forzar) return 'cliente';
  try {
    const prefs = await api.getPreferencias();
    return prefs && prefs.recorridoGuiado ? 'cliente' : null;
  } catch (e) {
    return null; // sin preferencias legibles no se molesta a nadie
  }
}

// Un solo montaje a la vez: si la página está montando (esperando esDemo/rol/preferencias) y la
// persona enciende el interruptor, la segunda llamada espera a la primera en vez de crear otro panel.
let montando = null;

/**
 * Monta el panel si toca (demo siempre; cliente real si lo activó). `irA(pasoId)` navega al lugar
 * del paso en esta página. Devuelve el controlador ({ actualizar, estado, idioma, destruir }) o null.
 */
export function montarRecorrido(opciones = {}) {
  if (window.__fzRecorrido) return Promise.resolve(window.__fzRecorrido); // ya montado (p. ej. activado dos veces)
  if (!montando) montando = montarInterno(opciones).finally(() => { montando = null; });
  return montando;
}

async function montarInterno({ irA, forzar = false } = {}) {
  const fuente = await fuenteRecorrido(forzar);
  if (!fuente) return null;
  if (window.__fzRecorrido) return window.__fzRecorrido;
  const pedir = fuente === 'demo' ? api.getRecorridoDemo : api.getRecorridoCliente;
  const intervalo = fuente === 'demo' ? INTERVALO_MS : INTERVALO_CLIENTE_MS;
  instalarCss();
  if (fuente === 'demo') document.body.classList.add('fz-demo'); // las páginas ocultan con CSS lo que no entra en la demo (invitar, suscribirse)

  const raiz = document.createElement('div');
  raiz.className = 'fz-recorrido';
  document.body.appendChild(raiz);

  let estado = null;
  let plegado = leerPlegado();
  let idioma = leerIdioma();
  let temporizador = null;
  let secuencia = 0; // la última petición manda: una respuesta vieja (p. ej. en español) no pisa un cambio de idioma
  let destruido = false;

  function pintar() {
    if (!estado) return;
    raiz.lang = estado.idioma;
    raiz.innerHTML = plegado ? htmlPildora(estado) : htmlTarjeta(estado);
  }

  async function actualizar() {
    const mia = ++secuencia;
    try {
      const nuevo = await pedir(idioma);
      if (mia !== secuencia || destruido) return;
      idioma = nuevo.idioma; // el tracker normaliza ('en-US' → 'en', desconocido → 'es'): se sigue su criterio
      const cambio = JSON.stringify(nuevo) !== JSON.stringify(estado);
      estado = nuevo;
      if (cambio) pintar();
      sincronizarAyuda(estado); // siempre: el enlace "Ayuda" puede montarse después que el panel
    } catch (e) {
      if (mia !== secuencia || destruido) return;
      if (estado) {
        // Falló (p. ej. al cambiar de idioma): se mantiene lo que se ve y la preferencia vuelve a ese idioma.
        idioma = estado.idioma;
        guardarIdioma(idioma);
        return;
      }
      raiz.innerHTML = `<div class="fz-recorrido-tarjeta"><p class="fz-recorrido-error">${esc(ERROR_SIN_ESTADO)}: ${esc(e.message)}</p></div>`;
    }
  }

  // Con i18n.js el idioma lo cambia el selector del topbar y nos avisa; sin él, lo cambia quien llame aquí.
  function cambiarIdioma(nuevo) {
    if (!nuevo || nuevo === idioma) return;
    if (i18n()) { i18n().cambiarIdioma(nuevo); return; }
    idioma = nuevo;
    guardarIdioma(nuevo);
    actualizar();
  }
  const quitarOyente = i18n() ? i18n().onCambio((nuevo) => { if (nuevo !== idioma) { idioma = nuevo; actualizar(); } }) : null;

  function programar() {
    clearInterval(temporizador);
    temporizador = setInterval(() => { if (!document.hidden) actualizar(); }, intervalo);
  }

  const alVolver = () => { if (!document.hidden) actualizar(); };

  function destruir() {
    destruido = true;
    clearInterval(temporizador);
    if (quitarOyente) quitarOyente();
    document.removeEventListener('visibilitychange', alVolver);
    window.removeEventListener('focus', alVolver);
    raiz.remove();
    if (window.__fzRecorrido === controlador) window.__fzRecorrido = null;
  }

  // Cliente real: la ✕ apaga la preferencia en el tracker y quita el panel; "Mi cuenta" lo vuelve a encender.
  // Si el tracker no guarda la preferencia, el panel se queda (si no, volvería solo en la próxima carga
  // y el interruptor diría lo contrario de lo guardado).
  async function ocultar() {
    try { await api.setPreferencias({ recorridoGuiado: false }); } catch (e) { return; }
    destruir();
    avisarCambio(false);
  }

  raiz.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;
    const accion = boton.dataset.accion;
    if (accion === 'plegar' || accion === 'desplegar') {
      plegado = accion === 'plegar';
      guardarPlegado(plegado);
      pintar();
    } else if (accion === 'actualizar') {
      actualizar();
    } else if (accion === 'ocultar') {
      ocultar();
    } else if (accion === 'ir' && irA) {
      irA(boton.dataset.paso);
    }
  });

  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('focus', alVolver);

  const controlador = {
    fuente,
    actualizar,
    estado: () => estado, // último estado leído (la página lo usa para navegar, p. ej. retomar el borrador)
    idioma: () => estado?.idioma || idioma,
    cambiarIdioma,
    destruir,
  };
  window.__fzRecorrido = controlador;

  await actualizar();
  if (destruido) return null;
  programar();
  return controlador;
}

/** "Mi cuenta" → interruptor encendido: guarda la preferencia y monta el panel (cliente real). */
export async function activarRecorrido({ irA } = {}) {
  await api.setPreferencias({ recorridoGuiado: true });
  if (montando) await montando.catch(() => null); // si la página aún estaba montando, que termine primero
  const controlador = await montarRecorrido({ irA, forzar: true });
  if (!controlador) {
    // No había nada que montar (p. ej. la cuenta no es de cliente): la preferencia no se queda encendida a medias.
    await api.setPreferencias({ recorridoGuiado: false }).catch(() => null);
    throw new Error('El recorrido guiado solo está disponible para cuentas de cliente.');
  }
  avisarCambio(true);
  return controlador;
}

/** "Mi cuenta" → interruptor apagado: guarda la preferencia y quita el panel si estaba (o si estaba montándose). */
export async function desactivarRecorrido() {
  await api.setPreferencias({ recorridoGuiado: false });
  if (montando) await montando.catch(() => null);
  if (window.__fzRecorrido) window.__fzRecorrido.destruir();
  avisarCambio(false);
}

export default { montarRecorrido, activarRecorrido, desactivarRecorrido };

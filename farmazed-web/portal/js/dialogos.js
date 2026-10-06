/**
 * dialogos.js — Reemplazo de alert/confirm/prompt del navegador por modales con el formato de
 * la interfaz (pedido de Rick, 05-oct-2026). Misma semántica que los nativos, pero asíncrona:
 *
 *   await avisar('Pago registrado.')                      // alert   -> resuelve al cerrar
 *   if (!(await confirmar('¿Enviar?'))) return;           // confirm -> true | false
 *   const motivo = await preguntar('Motivo del rechazo:'); // prompt  -> texto | null (cancelado)
 *
 * Sin dependencias: inyecta su propio CSS una sola vez y funciona igual en el admin (Bootstrap)
 * y en el portal del cliente. Accesible: role="dialog", foco atrapado, Escape cancela, Enter
 * acepta, el foco vuelve a donde estaba.
 *
 * Pruebas de pantalla (Playwright): antes auto-aceptaban los diálogos nativos con
 * `page.on('dialog', d => d.accept())`. Bajo `navigator.webdriver` este módulo resuelve de una
 * (avisar -> ok, confirmar -> true, preguntar -> `window.__fzRespuestaDialogo` o '') salvo que la
 * prueba ponga `window.__fzDialogosReales = true` para ver y manejar el modal de verdad.
 */

const TIPOS = {
  info:     { titulo: 'Aviso',          color: '#1B4F8A', icono: 'i' },
  exito:    { titulo: 'Listo',          color: '#3A7D44', icono: '✓' },
  error:    { titulo: 'Algo salió mal', color: '#B42318', icono: '!' },
  pregunta: { titulo: 'Confirmar',      color: '#B26A00', icono: '?' },
  entrada:  { titulo: 'Un dato más',    color: '#1B4F8A', icono: '✎' },
};

const CSS = `
.fz-dialogo-fondo{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,50,96,.45);backdrop-filter:blur(2px);animation:fzDialogoFondo .15s ease-out}
.fz-dialogo{width:min(460px,100%);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(15,50,96,.35);border-top:4px solid var(--fz-dialogo-color,#1B4F8A);padding:20px 22px 18px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1f2937;animation:fzDialogoEntra .18s cubic-bezier(.16,1,.3,1)}
.fz-dialogo-cab{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.fz-dialogo-icono{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:15px;color:#fff;background:var(--fz-dialogo-color,#1B4F8A)}
.fz-dialogo-titulo{margin:0;font-size:1rem;font-weight:700;letter-spacing:-.01em}
.fz-dialogo-texto{margin:0 0 14px;font-size:.92rem;line-height:1.5;white-space:pre-line;color:#374151}
.fz-dialogo-campo{display:block;width:100%;box-sizing:border-box;margin-bottom:14px;padding:9px 11px;font:inherit;font-size:.92rem;border:1px solid #cfd8e3;border-radius:8px;background:#fff;color:#1f2937}
.fz-dialogo-campo:focus{outline:2px solid #1B4F8A;outline-offset:1px;border-color:#1B4F8A}
.fz-dialogo-botones{display:flex;justify-content:flex-end;gap:8px}
.fz-dialogo-boton{font:inherit;font-size:.88rem;font-weight:600;padding:8px 16px;border-radius:8px;border:1px solid transparent;cursor:pointer;transition:background-color .12s,color .12s,border-color .12s}
.fz-dialogo-boton:focus-visible{outline:2px solid #1B4F8A;outline-offset:2px}
.fz-dialogo-boton.ok{background:var(--fz-dialogo-color,#1B4F8A);color:#fff}
.fz-dialogo-boton.ok:hover{filter:brightness(.9)}
.fz-dialogo-boton.cancelar{background:#fff;color:#374151;border-color:#cfd8e3}
.fz-dialogo-boton.cancelar:hover{background:#f3f6fa;border-color:#9aa8bb}
@keyframes fzDialogoFondo{from{opacity:0}to{opacity:1}}
@keyframes fzDialogoEntra{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fz-dialogo-fondo,.fz-dialogo{animation:none}}
`;

function instalarCss() {
  if (document.getElementById('fz-dialogos-css')) return;
  const style = document.createElement('style');
  style.id = 'fz-dialogos-css';
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Tipo deducido del texto cuando quien llama no lo dice (los mensajes ya existentes empiezan así).
function deducirTipo(mensaje) {
  if (/^(error|no se pudo|no se complet)/i.test(mensaje)) return 'error';
  if (/^(¡listo|listo|.* (guardad[oa]s?|registrad[oa]|actualizad[oa]s?|creada|enviada|recibido|subido)\b)/i.test(mensaje)) return 'exito';
  return 'info';
}

const enPruebas = () => navigator.webdriver && !window.__fzDialogosReales;
let contador = 0;

/**
 * Abre un modal y devuelve una promesa con el resultado del botón pulsado.
 * modo: 'aviso' (un botón), 'confirmar' (ok/cancelar) o 'entrada' (ok/cancelar + campo de texto).
 */
function abrir({ modo, mensaje, tipo, titulo, ok, cancelar, valor, placeholder }) {
  instalarCss();
  const def = TIPOS[tipo] || TIPOS.info;
  const id = `fz-dialogo-${++contador}`;
  const anterior = document.activeElement;

  const fondo = document.createElement('div');
  fondo.className = 'fz-dialogo-fondo';
  fondo.innerHTML = `
    <div class="fz-dialogo" role="dialog" aria-modal="true" aria-labelledby="${id}-titulo" aria-describedby="${id}-texto" style="--fz-dialogo-color:${def.color}">
      <div class="fz-dialogo-cab">
        <span class="fz-dialogo-icono" aria-hidden="true">${def.icono}</span>
        <h2 class="fz-dialogo-titulo" id="${id}-titulo"></h2>
      </div>
      <p class="fz-dialogo-texto" id="${id}-texto"></p>
      ${modo === 'entrada' ? `<input class="fz-dialogo-campo" type="text" aria-labelledby="${id}-texto">` : ''}
      <div class="fz-dialogo-botones">
        ${modo !== 'aviso' ? '<button type="button" class="fz-dialogo-boton cancelar" data-accion="cancelar"></button>' : ''}
        <button type="button" class="fz-dialogo-boton ok" data-accion="ok"></button>
      </div>
    </div>`;
  // Texto siempre por textContent (nunca innerHTML): los mensajes pueden traer datos del usuario.
  fondo.querySelector('.fz-dialogo-titulo').textContent = titulo || def.titulo;
  fondo.querySelector('.fz-dialogo-texto').textContent = mensaje;
  fondo.querySelector('[data-accion="ok"]').textContent = ok || (modo === 'aviso' ? 'Entendido' : 'Aceptar');
  const botonCancelar = fondo.querySelector('[data-accion="cancelar"]');
  if (botonCancelar) botonCancelar.textContent = cancelar || 'Cancelar';
  const campo = fondo.querySelector('.fz-dialogo-campo');
  if (campo) { campo.value = valor || ''; if (placeholder) campo.placeholder = placeholder; }

  return new Promise((resolve) => {
    const cerrar = (resultado) => {
      document.removeEventListener('keydown', teclas, true);
      fondo.remove();
      if (anterior && typeof anterior.focus === 'function') anterior.focus();
      resolve(resultado);
    };
    const aceptar = () => cerrar(modo === 'entrada' ? campo.value : true);
    const cancelarDialogo = () => cerrar(modo === 'entrada' ? null : modo !== 'aviso' ? false : true);

    const enfocables = () => [...fondo.querySelectorAll('input, button')];
    const teclas = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelarDialogo(); }
      else if (e.key === 'Enter' && e.target === campo) { e.preventDefault(); aceptar(); }
      else if (e.key === 'Tab') { // el foco no sale del modal
        const lista = enfocables();
        const i = lista.indexOf(document.activeElement);
        const siguiente = e.shiftKey ? (i <= 0 ? lista.length - 1 : i - 1) : (i >= lista.length - 1 ? 0 : i + 1);
        e.preventDefault();
        lista[siguiente].focus();
      }
    };
    document.addEventListener('keydown', teclas, true);
    fondo.querySelector('[data-accion="ok"]').addEventListener('click', aceptar);
    botonCancelar?.addEventListener('click', cancelarDialogo);
    fondo.addEventListener('mousedown', (e) => { if (e.target === fondo && modo === 'aviso') cancelarDialogo(); });

    document.body.appendChild(fondo);
    (campo || fondo.querySelector('[data-accion="ok"]')).focus();
  });
}

/** alert(): se resuelve cuando el usuario cierra el aviso. `opciones.tipo`: info | exito | error. */
export function avisar(mensaje, opciones = {}) {
  const texto = String(mensaje ?? '');
  if (enPruebas()) return Promise.resolve(true);
  return abrir({ modo: 'aviso', mensaje: texto, tipo: opciones.tipo || deducirTipo(texto), titulo: opciones.titulo, ok: opciones.ok });
}

/** confirm(): true si acepta, false si cancela o pulsa Escape. */
export function confirmar(mensaje, opciones = {}) {
  if (enPruebas()) return Promise.resolve(true);
  return abrir({ modo: 'confirmar', mensaje: String(mensaje ?? ''), tipo: opciones.tipo || 'pregunta', titulo: opciones.titulo, ok: opciones.ok, cancelar: opciones.cancelar });
}

/** prompt(): el texto escrito, o null si cancela. */
export function preguntar(mensaje, opciones = {}) {
  if (enPruebas()) return Promise.resolve(window.__fzRespuestaDialogo ?? '');
  return abrir({ modo: 'entrada', mensaje: String(mensaje ?? ''), tipo: 'entrada', titulo: opciones.titulo, ok: opciones.ok, cancelar: opciones.cancelar, valor: opciones.valor, placeholder: opciones.placeholder });
}

export default { avisar, confirmar, preguntar };

// e2e/_esperas.js — TAREA 42. Esperas a CONDICIÓN (no a tiempo fijo) compartidas por los specs.
// Cada una espera el hecho real, no "un rato": una respuesta de la API, un diálogo, el fin de
// las animaciones CSS o la red en reposo.

const CASO_URL = /\/api\/cases\/[^/]+$/;
const esPeticion = (metodo) => (r) => r.request().method() === metodo && CASO_URL.test(new URL(r.url()).pathname);

// admin/expediente.html: cambiar el estado = PATCH -> alert() (lo acepta el page.on('dialog') del
// spec) -> la página relee el caso (GET). Se espera a ese GET: ahí la página ya terminó y se puede
// navegar sin abortar el diálogo ("net::ERR_ABORTED" / "Not attached to an active page").
async function guardarEstado(page, estado) {
  await page.selectOption('#status-select', estado);
  const patch = page.waitForResponse(esPeticion('PATCH'));
  const relectura = page.waitForResponse(esPeticion('GET'));
  relectura.catch(() => {}); // si el PATCH falla, no dejar esta espera como rechazo sin manejar
  await page.click('#btn-save-status');
  await patch;
  await relectura;
}

// Fin de las transiciones/animaciones CSS en curso (p. ej. el sidebar al cambiar el viewport).
// (se ignoran las infinitas: un spinner nunca terminaría).
const esperarAnimaciones = (page) => page.waitForFunction(() =>
  document.getAnimations().every(a => a.effect?.getComputedTiming().iterations === Infinity));

// Para los specs de XSS: da tiempo REAL a que un onerror/onload (si existiera) corra — las
// imágenes rotas terminan de resolverse cuando la red queda en reposo, y luego un par de frames.
async function esperarQueNadaSeEjecute(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => [...document.images].every(i => i.complete)); // las imágenes rotas ya fallaron
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// Envía el formulario de login.html y espera a la URL de destino. El esperador se arma ANTES del
// click; y si la navegación se solapa con la redirección del propio login (net::ERR_ABORTED), basta
// con que la URL ya sea la esperada. Resuelve al COMMIT de la URL: si el spec usa page.evaluate()
// enseguida, que espere antes a lo que necesite (p. ej. waitForFunction).
async function enviarLogin(page, destino, timeout = 15000) {
  const nav = page.waitForURL(destino, { timeout, waitUntil: 'commit' });
  nav.catch(() => {});
  await page.click('button[type="submit"]');
  try {
    await nav;
  } catch (e) {
    if (!destino.test(page.url())) await page.waitForURL(destino, { timeout, waitUntil: 'commit' });
  }
}

// Cuenta recién creada (invitación / registro): su empresa no tiene captación y el portal muestra un
// overlay bloqueante. Se completa por la API si aparece.
async function completarCaptacionSiHaceFalta(page) {
  // Race real: el overlay se decide de forma asíncrona (await api.getMyOrg()
  // dentro del módulo), después de que la página ya terminó de cargar —
  // un solo chequeo inmediato casi siempre lo agarra todavía oculto. Se
  // espera explícito a que aparezca O a que pase suficiente tiempo sin que
  // aparezca (cuenta ya con captación, caso legítimo).
  let visible = false;
  try {
    await page.locator('#captacion-overlay:not(.d-none)').waitFor({ state: 'visible', timeout: 4000 });
    visible = true;
  } catch (e) { /* no apareció en 4s -> esta empresa ya tiene captación */ }
  if (!visible) return;
  await page.evaluate(async () => {
    const api = (await import('/portal/js/api.js')).default;
    await api.saveCaptacion({
      paisYNombreFabricante: 'Alemania — Fabricante E2E',
      categoriasProducto: ['medicamentos'],
      numeroProductosPorCategoria: '1',
      registroPrevioAutoridadReconocida: true,
      clienteNuevoOYaRegistrado: 'nuevo',
      productoConModificacionEnCurso: false,
    });
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

module.exports = { enviarLogin, guardarEstado, esperarAnimaciones, esperarQueNadaSeEjecute, completarCaptacionSiHaceFalta };

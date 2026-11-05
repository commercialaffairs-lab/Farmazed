// e2e/_esperas.js — TAREA 42. Esperas a CONDICIÓN (no a tiempo fijo) compartidas por los specs.
// Cada una espera el hecho real, no "un rato": una respuesta de la API, un diálogo, el fin de
// las animaciones CSS o la red en reposo.

const { expect } = require('@playwright/test');

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
  // El overlay lo decide el portal de forma asíncrona (api.getMyOrg() dentro del módulo), después de
  // que la página carga. En vez de esperar un tiempo fijo a ver si aparece (con la máquina cargada
  // aparecía tarde y la spec seguía con el overlay encima), se pregunta el dato que lo decide: si la
  // empresa no tiene captación, el overlay VA a aparecer y se espera a que lo haga.
  await page.waitForLoadState('load'); // el evaluate de abajo no debe pillar la navegación del login
  const sinCaptacion = await page.evaluate(async () => {
    const api = (await import('/portal/js/api.js')).default;
    return !(await api.getMyOrg()).captacion;
  });
  if (!sinCaptacion) return;
  try {
    await page.locator('#captacion-overlay:not(.d-none)').waitFor({ state: 'visible', timeout: 15000 });
  } catch (e) { return; /* sin overlay (p. ej. no es titular): nada que completar */ }
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

// Decisión de Rick (31-oct-2026, d588d5e): tras crear la contraseña, aceptar-invitacion.html NO entra
// directo; cierra la sesión y manda a login.html?cuenta=creada con un aviso. Esta espera comprueba ese
// redirect + aviso y luego inicia sesión con la contraseña recién elegida.
async function iniciarSesionTrasAlta(page, email, password, destino, timeout = 15000) {
  await page.waitForURL(/login\.html\?cuenta=creada/, { timeout });
  await expect(page.locator('#login-msg')).toContainText('Cuenta creada', { timeout });
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, destino, timeout);
}

// Portal del cliente (client-dashboard.html) pintado: renderAll() llena #bienvenida-text al FINAL de
// la carga, que encadena ~3 peticiones por caso (documentos, pagos, formularios; el N+1 de /payments
// está en client-dashboard.html:1556). Esperar 'networkidle' no sirve: se dispara en el hueco antes
// de que el JS del portal empiece a llamar a la API. Sin timeout propio: lo acota el del test.
// Deuda: quitar de los specs cuando se arregle ese N+1.
async function esperarDashboardCliente(page) {
  await page.waitForFunction(() => !!document.getElementById('bienvenida-text')?.textContent.trim(), null, { timeout: 0 });
}

module.exports = { esperarDashboardCliente, iniciarSesionTrasAlta, enviarLogin, guardarEstado, esperarAnimaciones, esperarQueNadaSeEjecute, completarCaptacionSiHaceFalta };

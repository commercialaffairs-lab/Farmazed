// e2e/plan_empresarial.spec.js — TAREA 34 (PM_COMMENTS §H.15). Flujo
// completo del Plan Empresarial: registro?plan=empresarial -> verificación
// -> captación -> titular envía solicitud de propuesta -> admin define
// condiciones (monto/período/gestor de cuenta) -> titular acepta y se
// suscribe (PayPal mock) -> ve "Informes de avance".
//
// Proveedor SIEMPRE mock. NO se corrió todavía contra un emulador real —
// el host estaba en memoria crítica en el momento de escribir esto (ver
// handover.md); escrito con los mismos patrones ya verificados en
// e2e/registro.spec.js, e2e/pago_paypal.spec.js y e2e/plan_consulta.spec.js.
//
// Requiere que `analista@farmazed.test` exista (seed_roles.js) — es el
// gestor de cuenta que el admin asigna.

const { test, expect } = require('@playwright/test');
const { enviarLogin } = require('./_esperas');

const AUTH_PORT = process.env.FZ_AUTH_PORT || '9099';
const API_PORT  = process.env.FZ_API_PORT  || '8080';

async function confirmarCorreo(correo, password) {
  const login = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, returnSecureToken: true }),
  }).then(r => r.json());
  await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: login.idToken }),
  });
  const { oobCodes } = await fetch(`http://localhost:${AUTH_PORT}/emulator/v1/projects/demo-farmazed/oobCodes`).then(r => r.json());
  const codigo = oobCodes.find(c => c.email === correo && c.requestType === 'VERIFY_EMAIL');
  await fetch(codigo.oobLink);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}

async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
    page.evaluate(async () => { const { logout } = await import('/portal/js/auth.js'); await logout(); }).catch(() => {}),
  ]);
}

async function completarCaptacionSiHaceFalta(page) {
  let visible = false;
  try {
    await page.locator('#captacion-overlay:not(.d-none)').waitFor({ state: 'visible', timeout: 4000 });
    visible = true;
  } catch (e) { /* ya tenía captación */ }
  if (!visible) return;
  await page.evaluate(async () => {
    const api = (await import('/portal/js/api.js')).default;
    await api.saveCaptacion({
      paisYNombreFabricante: 'Suiza — Fabricante E2E', categoriasProducto: ['medicamentos', 'cosmeticos'],
      numeroProductosPorCategoria: '5', registroPrevioAutoridadReconocida: true,
      clienteNuevoOYaRegistrado: 'nuevo', productoConModificacionEnCurso: false,
    });
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test.describe('TAREA 34 — Plan Empresarial (solicitud -> condiciones -> suscripción)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const authPort = AUTH_PORT;
    await page.addInitScript(({ apiPort, authPort }) => {
      try {
        window.localStorage.setItem('fzApiPort', apiPort);
        window.localStorage.setItem('fzAuthPort', authPort);
      } catch (e) { /* noop */ }
    }, { apiPort: API_PORT, authPort });
  });

  test('flujo completo: registro?plan=empresarial -> solicitud -> condiciones -> aceptar -> Informes de avance', async ({ page }) => {
    test.setTimeout(60000);
    const correo = `e2e-empresarial-${Date.now()}@farmazed.test`;
    const empresaNombre = `E2E Empresarial Co ${Date.now()}`;
    const password = 'Farmazed123!';

    await page.goto('/registro.html?plan=empresarial');
    await page.fill('#r-nombre', 'E2E Empresarial Test');
    await page.fill('#r-correo', correo);
    await page.fill('#r-password', password);
    await page.fill('#r-password-confirm', password);
    await page.fill('#r-telefono', '+507 6000-9999');
    await page.fill('#r-empresa', empresaNombre);
    await page.fill('#r-pais', 'Panamá');
    await page.click('#btn-submit');
    await expect(page.locator('#done-msg')).toBeVisible({ timeout: 10000 });

    // Ver nota en plan_consulta.spec.js: el reload de Firebase a veces ya
    // trae emailVerified fresco, no siempre pasa por verificar-correo.html.
    await confirmarCorreo(correo, password);
    await page.goto('/login.html');
    await page.waitForURL(/(verificar-correo|client-dashboard)\.html/, { timeout: 10000 });
    if (/verificar-correo\.html/.test(page.url())) {
      await page.click('#btn-continuar');
      await page.waitForURL(/client-dashboard\.html/, { timeout: 10000 });
    }
    await completarCaptacionSiHaceFalta(page);

    await expect(page.locator('#nav-empresarial-item')).toBeVisible({ timeout: 10000 });
    await page.waitForFunction(() => window.__fzMyRole, null, { timeout: 10000 }); // el módulo de auth carga el rol DESPUÉS de mostrar el menú: sin esto el click llega con el rol vacío
    await page.locator('a.nav-link', { hasText: 'Informes de avance' }).dispatchEvent('click');

    // ── Solicitud de propuesta ──
    await page.locator('#prop-productos').fill('10 medicamentos de síntesis química, necesidad de etiquetado');
    await page.check('#prop-modificaciones');
    await page.check('#prop-informes');
    await page.locator('#form-propuesta button[type="submit"]').dispatchEvent('click');
    await expect(page.getByText('Farmazed está preparando las condiciones')).toBeVisible({ timeout: 10000 });
    await logout(page);

    // ── Admin define condiciones ──
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/empresas.html');
    const fila = page.locator('#orgs-list > div', { hasText: empresaNombre });
    await expect(fila).toBeVisible({ timeout: 10000 });
    await fila.getByText('Definir condiciones').click();
    await fila.locator('input[name="monto"]').fill('750');
    await fila.locator('select[name="periodo"]').selectOption('mensual');
    await fila.locator('select[name="gestorCuenta"]').selectOption({ label: 'analista@farmazed.test' });
    // El submit guarda vía API y recién AL TERMINAR hace alert('Condiciones
    // guardadas.') — si se sigue derecho a logout() sin esperar ese alert
    // (como con un click + continuar normal), cuando el backend tarda un
    // poco el diálogo llega tarde, justo cuando logout() ya está navegando
    // y la página deja de estar "attached" (mismo patrón TAREA 26: armar el
    // esperador ANTES de disparar la acción, correr ambos en paralelo).
    // (Hoy el aviso es un modal propio auto-resuelto en pruebas: se espera la respuesta del PUT.)
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/condiciones') && r.request().method() === 'PUT'),
      fila.locator('button[type="submit"]').click(),
    ]);
    await logout(page);

    // ── Titular acepta y se suscribe ──
    await login(page, correo, password);
    await page.waitForFunction(() => window.__fzMyRole, null, { timeout: 10000 }); // rol cargado antes de usar el menú
    await page.locator('a.nav-link', { hasText: 'Informes de avance' }).dispatchEvent('click');
    await expect(page.getByText('$750.00 / mensual')).toBeVisible({ timeout: 10000 });
    await page.locator('#btn-aceptar-empresarial').dispatchEvent('click');
    await expect(page.getByText('Suscripción activa')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Informes de avance — todos los casos de tu empresa')).toBeVisible();
  });
});

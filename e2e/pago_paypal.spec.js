// e2e/pago_paypal.spec.js — TAREA 33 (PM_COMMENTS §H.14). Suscripción al
// plan recurrente + pago de la cotización aceptada con PayPal — SIEMPRE
// contra el proveedor `mock` (sin PAYPAL_CLIENT_ID/SECRET/ENV en el
// entorno de e2e/run.sh). Usa el caso dedicado `case-pago-paypal-test`
// (seed_roles.js, org Beta) — no comparte fixtures con quotes.spec.js.
//
// Corre con: ./e2e/run.sh pago_paypal.spec.js (o ./e2e/run.sh para todos)

const { test, expect } = require('@playwright/test');
const { enviarLogin, guardarEstado } = require('./_esperas');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-10-03');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-pago-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}

// TAREA 32 deja una pantalla bloqueante de captación en el primer ingreso
// del titular — si no se completa, intercepta cualquier clic en el resto
// del dashboard (overlay a pantalla completa). Se completa vía API directo
// (no es lo que este spec prueba) para no bloquear el resto del flujo.
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

async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

const CASE_ID = 'case-pago-paypal-test';

test.describe('TAREA 33 — suscripción y pago de cotización con PayPal (mock)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort  = process.env.FZ_API_PORT  || '8080';
    const authPort = process.env.FZ_AUTH_PORT || '9099';
    await page.addInitScript(({ apiPort, authPort }) => {
      try {
        window.localStorage.setItem('fzApiPort', apiPort);
        window.localStorage.setItem('fzAuthPort', authPort);
      } catch (e) { /* noop */ }
    }, { apiPort, authPort });
  });

  test('admin define el plan -> titular se suscribe desde Mi Empresa', async ({ page }) => {
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/precios.html');
    await page.fill('#plan-nombre', 'Uso de plataforma');
    await page.fill('#plan-monto', '50');
    await page.selectOption('#plan-periodo', 'mensual');
    await page.click('#form-plan button[type="submit"]');
    await expect(page.locator('#plan-msg')).toHaveText('Plan guardado.', { timeout: 10000 });
    await shot(page, '00-admin-plan-guardado');
    await logout(page);

    await login(page, 'titular-beta@farmazed.test', 'Farmazed123!');
    await completarCaptacionSiHaceFalta(page);
    await page.locator('a.nav-link', { hasText: 'Mi Empresa' }).click();
    await expect(page.locator('#btn-suscribir')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-suscribir');
    await expect(page.getByText('activa')).toBeVisible({ timeout: 10000 });
    await shot(page, '01-titular-suscrito');
  });

  test('flujo completo: fase_04 -> cotización enviada -> aceptada -> pagada con PayPal (mock) -> fase_05 destrabado', async ({ page }) => {
    test.setTimeout(60000);

    // ═══ Admin avanza el caso a fase_04 (dispara el borrador de cotización) ═══
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${CASE_ID}`);
    await expect(page.locator('#status-select')).toHaveValue('fase_03', { timeout: 10000 });
    await guardarEstado(page, 'fase_04');

    // ═══ Admin envía la cotización ═══
    await page.goto('/admin/cotizaciones.html');
    const fila = page.locator('.card', { hasText: 'FZ-MED-REG-2026-0117' }).first();
    await expect(fila).toBeVisible({ timeout: 10000 });
    await fila.locator('.btn-enviar').click();
    await shot(page, '02-admin-cotizacion-enviada');
    await logout(page);

    // ═══ Titular acepta y paga con PayPal ═══
    await login(page, 'titular-beta@farmazed.test', 'Farmazed123!');
    await completarCaptacionSiHaceFalta(page);
    await page.locator('a.nav-link', { hasText: 'Cotización' }).click();
    const card = page.locator('.card', { hasText: 'FZ-MED-REG-2026-0117' });
    await expect(card).toBeVisible({ timeout: 10000 });
    // dispatchEvent (no click/force) — el sidebar fijo del template
    // (.startbar) a veces queda VISUALMENTE encima mientras el contenido
    // recién inyectado termina de asentar layout; `click({force:true})`
    // sigue siendo un click de mouse en esas coordenadas y el navegador se
    // lo entrega a lo que esté arriba de verdad (terminó abriendo "Mi
    // Empresa" en vez de aceptar). dispatchEvent('click') dispara el
    // evento DIRECTO en el botón, sin pasar por hit-testing visual — ya se
    // confirmó arriba que es el botón correcto y está visible.
    await card.locator('.btn-aceptar-cot').dispatchEvent('click');
    await expect(card.locator('.btn-pagar-paypal')).toBeVisible({ timeout: 10000 });
    await shot(page, '03-titular-cotizacion-aceptada');

    await card.locator('.btn-pagar-paypal').dispatchEvent('click');
    await expect(card.getByText('Pagado con PayPal')).toBeVisible({ timeout: 10000 });
    await shot(page, '04-titular-pagado-con-paypal');
    await logout(page);

    // ═══ El pago por PayPal ya destrabó el gate normal de fase_05 ═══
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${CASE_ID}`);
    await expect(page.locator('#status-select')).toHaveValue('fase_04', { timeout: 10000 });
    await guardarEstado(page, 'fase_05');
    await page.selectOption('#status-select', 'fase_06');
    await page.click('#btn-save-status');
    await expect(page.locator('#status-select')).toHaveValue('fase_06', { timeout: 10000 });
    await shot(page, '05-admin-fase06-destrabado');
  });
});

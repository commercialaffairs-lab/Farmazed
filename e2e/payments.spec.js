// e2e/payments.spec.js — D12 (organizacion/03_INSTRUCCIONES_DEV.md fila D12,
// Parte C.9). TAREA 21 (§H.8, reemplaza §H.3): el flujo canónico pasa a 13
// fases — "fase_13" ya NO es una fase de pago (es "Seguimiento y gestión
// post-ingreso") y "fase_14" ya no existe. Queda un solo gate de pago, al
// SALIR de fase_05. TAREA 23 (§H.8, parte Pagos) lo rehace por CONCEPTO:
// cada cheque (honorarios, tasa_dnfd, mef, iea) es un registro separado —
// este caso no tiene cotización aceptada (sin orgId, ver
// e2e/global-setup.js), así que el gate exige la base: honorarios +
// tasa_dnfd (mef/iea nunca aplican sin esExtranjero/aplicaIEA en una
// cotización — ver e2e/quotes.spec.js para ese desglose).
//
// Corre con: ./e2e/run.sh payments.spec.js  (o ./e2e/run.sh para todos)
// El caso de prueba (test-pago-visual) lo deja listo e2e/global-setup.js
// antes de cada corrida — no toca test-flujo-visual, que usa
// estados.spec.js/checklist.spec.js.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-29');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-pagos-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(dashboard|client-dashboard)\.html/, { timeout: 15000 });
}

// TAREA 26: waitForURL en paralelo con el evaluate (no después) — la
// navegación que dispara logout() (window.location.href, dentro de auth.js)
// puede destruir el execution context de evaluate() antes de que resuelva
// ("Execution context was destroyed" / "net::ERR_ABORTED" / "dialog.accept:
// Not attached to an active page" en el login() siguiente) — se ignora el
// rechazo de evaluate(), lo que importa es que la navegación de verdad
// ocurrió.
async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000 }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

function comprobante(nombre) {
  return { name: nombre, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 comprobante de prueba D12 — ${nombre}`) };
}

test.describe('D12/§H.8 — el gate de pago de fase_05 por CONCEPTO (TAREA 23)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('fase_05: bloqueado sin ningún concepto; bloqueado con solo uno; avanza con ambos', async ({ page }) => {
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/expediente.html?id=test-pago-visual');
    await expect(page.locator('#status-select')).toHaveValue('fase_05', { timeout: 10000 });
    await expect(page.locator('#payments-list')).toContainText('Sin pagos registrados', { timeout: 10000 });
    await expect(page.locator('#payments-resumen')).toContainText('Honorarios pendiente');
    await expect(page.locator('#payments-resumen')).toContainText('Tasa DNFD pendiente');
    await shot(page, '00-fase05-sin-pagos');

    // Intentar 05 -> 06 SIN ningún concepto pagado y SIN override: bloqueado.
    await page.selectOption('#status-select', 'fase_06');
    await page.click('#btn-save-status'); // dispara alert de error (auto-aceptado)
    await shot(page, '01-fase05-bloqueado-sin-conceptos');
    await page.reload();
    await expect(page.locator('#status-select')).toHaveValue('fase_05', { timeout: 10000 });

    async function registrarConcepto(concepto, monto, archivo) {
      await expect(page.locator('#pay-tipo')).toHaveValue('cliente_a_farmazed');
      await expect(page.locator('#pay-concepto-row')).toBeVisible();
      await page.selectOption('#pay-concepto', concepto);
      await page.fill('#pay-monto', String(monto));
      await page.fill('#pay-fecha', '2026-09-29');
      await page.setInputFiles('#pay-comprobante', comprobante(archivo));
      await page.click('#payment-form button[type="submit"]');
      await expect(page.locator('#payments-list')).toContainText(`B/. ${Number(monto).toFixed(2)}`, { timeout: 10000 });
    }

    // Registrar SOLO "honorarios" — falta "tasa_dnfd", sigue bloqueado.
    await registrarConcepto('honorarios', 1855, 'honorarios-fase05.pdf');
    await expect(page.locator('#payments-resumen')).toContainText('Honorarios ✓');
    await expect(page.locator('#payments-resumen')).toContainText('Tasa DNFD pendiente');
    await shot(page, '02-fase05-solo-honorarios');

    await page.selectOption('#status-select', 'fase_06');
    await page.click('#btn-save-status');
    await shot(page, '03-fase05-bloqueado-falta-tasa-dnfd');
    await page.reload();
    await expect(page.locator('#status-select')).toHaveValue('fase_05', { timeout: 10000 });

    // Registrar "tasa_dnfd" — ya están los dos conceptos base, desbloquea.
    await registrarConcepto('tasa_dnfd', 200, 'tasa-dnfd-fase05.pdf');
    await expect(page.locator('#payments-resumen')).toContainText('Tasa DNFD ✓');
    await shot(page, '04-fase05-ambos-conceptos');

    await page.selectOption('#status-select', 'fase_06');
    await page.click('#btn-save-status');
    await expect(page.locator('#status-select')).toHaveValue('fase_06', { timeout: 10000 });
    await expect(page.locator('#status-history')).not.toContainText('override');
    await shot(page, '05-fase05-desbloqueado');

    // El cliente ve cada concepto pagado/pendiente por separado.
    await logout(page);
    await login(page, 'cliente@farmazed.test', 'Farmazed123!');
    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    const productCard = page.locator('.fz-product-card', { hasText: 'Analgen Test Pago' });
    await expect(productCard).toBeVisible({ timeout: 10000 });
    await productCard.locator('.fz-prod-header').click();
    await expect(productCard).toContainText('Honorarios');
    await expect(productCard).toContainText('Tasa DNFD');
    await expect(productCard).toContainText('Saldo de honorarios');
    await expect(productCard.locator('.badge', { hasText: 'Pagado' })).toHaveCount(2);   // honorarios, tasa_dnfd
    await expect(productCard.locator('.badge', { hasText: 'Pendiente' })).toHaveCount(1); // saldo
    await page.mouse.move(700, 400);
    await shot(page, '06-fase05-cliente-ve-conceptos');
  });
});

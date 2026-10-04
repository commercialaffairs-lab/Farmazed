// e2e/roles.spec.js — TAREA 15 (E3 parte 2, PM_COMMENTS §H.4): cada uno de
// los 6 roles ve lo suyo y NO ve lo ajeno, en la UI real (no solo por HTTP —
// eso ya lo prueba tracker/tests/permissions.test.js, 48/48 en verde). Más
// el recorrido invitación -> aceptar -> login.
//
// Corre con: ./e2e/run.sh roles.spec.js (o ./e2e/run.sh para todos).
// Usa el fixture de e2e/run.sh -> tracker/scripts/seed_roles.js (2 empresas
// + 1 usuario por rol) — independiente del seed legacy de seed_emulador.js.

const { test, expect } = require('@playwright/test');
const { enviarLogin, completarCaptacionSiHaceFalta } = require('./_esperas');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-29');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-roles-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

const PASSWORD = 'Farmazed123!';
async function login(page, email, password = PASSWORD) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}
// TAREA 26: waitForURL en paralelo con el evaluate (no después) — mismo
// criterio en todos los specs de este directorio (ver quotes.spec.js): la
// navegación que dispara logout() puede destruir el execution context de
// evaluate() antes de que resuelva, así que se ignora su rechazo y lo único
// que importa es que la navegación de verdad ocurrió.
async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

test.describe('TAREA 15 — cada rol ve lo suyo, no lo ajeno', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('cliente_titular: Mi Empresa (miembros + invitar) y solo sus casos', async ({ page }) => {
    await login(page, 'titular-alfa@farmazed.test');

    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    await expect(page.locator('.fz-product-card', { hasText: 'Producto Org Alfa (fase 7)' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.fz-product-card', { hasText: 'Producto Org Beta' })).toHaveCount(0);
    await shot(page, '00-titular-productos');

    await page.locator('a.nav-link', { hasText: 'Mi Empresa' }).click();
    await expect(page.getByText('Laboratorios Alfa')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('titular-alfa@farmazed.test')).toBeVisible();
    await expect(page.getByText('miembro-alfa@farmazed.test')).toBeVisible();
    await expect(page.locator('#form-invitar-miembro')).toBeVisible();
    await shot(page, '01-titular-mi-empresa');

    await logout(page);
  });

  test('cliente_miembro: ve la misma empresa, sin formulario de invitar', async ({ page }) => {
    await login(page, 'miembro-alfa@farmazed.test');

    await page.locator('a.nav-link', { hasText: 'Mi Empresa' }).click();
    await expect(page.getByText('Laboratorios Alfa')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('titular-alfa@farmazed.test')).toBeVisible();
    await expect(page.locator('#form-invitar-miembro')).toHaveCount(0);
    await shot(page, '02-miembro-mi-empresa');

    await logout(page);
  });

  test('analista: bandeja resalta fase_10 (su confirmación, §H.8), no ve org Beta; sin override/pagos/asignar en expediente', async ({ page }) => {
    await login(page, 'analista@farmazed.test');

    await page.goto('/admin/bandeja.html');
    const row = page.locator('tr', { hasText: 'Producto Fase 10 Test' });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText('Fase 10 — confirmar recepción y verificación de originales');
    await expect(page.locator('tr', { hasText: 'Producto Org Beta' })).toHaveCount(0);
    await shot(page, '03-analista-bandeja');

    await page.goto('/admin/expediente.html?id=case-fase10-test');
    await expect(page.locator('#status-select')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#override-wrap')).toBeHidden();
    await expect(page.locator('#payment-form')).toBeHidden();
    await expect(page.locator('#assign-card')).toBeHidden();
    await shot(page, '04-analista-expediente');

    await logout(page);
  });

  test('abogado: bandeja resalta fase_08 (confirmación legal pendiente); documentos legales destacados', async ({ page }) => {
    await login(page, 'abogado@farmazed.test');

    // case-fase8-test y case-fase8-recycle-test están ambos en fase_08 y
    // asignados al mismo abogado (seed_roles.js) — acotar a la fila del
    // producto, no un getByText de página completa (matchea las dos).
    await page.goto('/admin/bandeja.html');
    const rowAbogado = page.locator('tr', { hasText: 'Producto Fase 8 Test' });
    await expect(rowAbogado).toContainText('Fase 8 — confirmar revisión legal (poderes/declaraciones)', { timeout: 10000 });
    await shot(page, '05-abogado-bandeja');

    await page.goto('/admin/expediente.html?id=case-fase8-test');
    await expect(page.locator('#status-select')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#override-wrap')).toBeHidden();
    await expect(page.locator('#assign-card')).toBeHidden();
    // "Poder Original" (legal) debe verse resaltado con fondo distinto.
    const docPoder = page.locator('.doc-item', { hasText: 'Poder Original' });
    await expect(docPoder).toHaveAttribute('style', /background/);
    await shot(page, '06-abogado-expediente');

    await logout(page);
  });

  test('regente: bandeja resalta fase_08 (confirmación técnica pendiente, §H.8); documentos técnicos destacados', async ({ page }) => {
    await login(page, 'regente@farmazed.test');

    await page.goto('/admin/bandeja.html');
    const rowRegente = page.locator('tr', { hasText: 'Producto Fase 8 Test' });
    await expect(rowRegente).toContainText('Fase 8 — confirmar cotejo técnico/matrices', { timeout: 10000 });
    await shot(page, '07-regente-bandeja');

    await page.goto('/admin/expediente.html?id=case-fase8-test');
    await expect(page.locator('#status-select')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#assign-card')).toBeHidden();
    // "Fórmula Cuali-Cuantitativa" (técnico) debe verse resaltado.
    const docFormula = page.locator('.doc-item', { hasText: 'Fórmula Cuali-Cuantitativa' });
    await expect(docFormula).toHaveAttribute('style', /background/);
    await shot(page, '08-regente-expediente');

    await logout(page);
  });

  test('admin: ve ambas empresas, y override/pagos/asignar visibles en expediente', async ({ page }) => {
    await login(page, 'admin-e3@farmazed.test');

    await page.goto('/admin/casos.html');
    await page.waitForSelector('#cases-tbody tr');
    await expect(page.getByText('Producto Org Alfa (fase 7)')).toBeVisible();
    await expect(page.getByText('Producto Org Beta')).toBeVisible();
    await shot(page, '09-admin-casos');

    await page.goto('/admin/expediente.html?id=case-org-alfa');
    await expect(page.locator('#override-wrap')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#payment-form')).toBeVisible();
    await expect(page.locator('#assign-card')).toBeVisible();
    await shot(page, '10-admin-expediente');

    await page.goto('/admin/empresas.html');
    await expect(page.getByText('Laboratorios Alfa')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Farmacéutica Beta')).toBeVisible();
    await shot(page, '11-admin-empresas');

    await logout(page);
  });

  test('invitación -> aceptar -> login (titular nuevo, empresa nueva)', async ({ page }) => {
    const email = `nuevo-titular-e2e-${Date.now()}@test.com`;

    await login(page, 'admin-e3@farmazed.test');
    await page.goto('/admin/empresas.html');
    await page.fill('#titular-email', email);
    await page.fill('#titular-org', 'Empresa E2E Invitación');
    await page.click('#form-invitar-titular button[type="submit"]');

    const row = page.locator('#invitations-tbody tr', { hasText: email });
    await expect(row).toBeVisible({ timeout: 10000 });
    const linkText = (await row.locator('td').last().textContent() || '').trim();
    const token = linkText.split('token=')[1];
    expect(token).toBeTruthy();
    await shot(page, '12-invitacion-creada');

    await logout(page);

    await page.goto(`/aceptar-invitacion.html?token=${token}`);
    await expect(page.locator('#accept-form')).toBeVisible({ timeout: 10000 });
    // TAREA 39b: la página pública de la invitación muestra el correo ENMASCARADO (n***@dominio).
    const [usuario, dominio] = email.split('@');
    await expect(page.locator('#invite-email')).toHaveValue(`${usuario[0]}***@${dominio}`);
    await page.fill('#display-name', 'Nuevo Titular E2E');
    await page.fill('#password', PASSWORD);
    await page.fill('#password-confirm', PASSWORD);
    await shot(page, '13-aceptar-invitacion-formulario');

    await page.click('#btn-submit');
    await page.waitForURL(/client-dashboard\.html/, { timeout: 15000 });
    await completarCaptacionSiHaceFalta(page); // la empresa nueva (invitación) nace sin captación
    await expect(page.locator('a.nav-link', { hasText: 'Mi Empresa' })).toBeVisible({ timeout: 10000 });
    await page.locator('a.nav-link', { hasText: 'Mi Empresa' }).click();
    await expect(page.getByText('Empresa E2E Invitación')).toBeVisible({ timeout: 10000 });
    await shot(page, '14-invitacion-aceptada-login');
  });
});

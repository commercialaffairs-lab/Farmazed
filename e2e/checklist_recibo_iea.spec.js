// e2e/checklist_recibo_iea.spec.js — TAREA 25 (PM_COMMENTS §H.9, decisión 1
// sobre organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md): recibo_iea del
// checklist (tracker/data/faddi_checklists.js) DEJA de depender del subtipo
// de medicamento y pasa a depender de `aplicaIEA` de la línea de la
// cotización ACEPTADA del caso — antes de eso, se muestra "por confirmar"
// (no bloquea). Usa 2 casos dedicados de org Beta (seed_roles.js,
// `case-checklist-iea-si`/`-no`) para no chocar con el locator
// "Laboratorios Alfa" de quotes.spec.js.
//
// Corre con: ./e2e/run.sh checklist_recibo_iea.spec.js

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-30');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-checklist-iea-${name}.png`);
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

// TAREA 26: logout() hace signOut()+`window.location.href` DENTRO de
// evaluate() — si se espera a que evaluate() resuelva antes de armar
// waitForURL, la navegación a veces destruye el execution context primero
// ("Execution context was destroyed" / "net::ERR_ABORTED" / "dialog.accept:
// Not attached to an active page" en el login() siguiente). Se arma
// waitForURL ANTES de disparar el evaluate, en paralelo, y se ignora el
// rechazo de evaluate() — lo que importa es que la navegación de verdad
// ocurrió, no que evaluate() haya podido devolver su valor.
async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000 }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

async function guardarEstado(page, to) {
  await page.selectOption('#status-select', to);
  await page.click('#btn-save-status');
  await expect(page.locator('#status-select')).toHaveValue(to, { timeout: 10000 });
  await page.waitForTimeout(300);
}

// El "(opcional)" al lado del nombre lo pinta admin/expediente.html solo
// cuando `!item.required` (ver render de #docs-list) — es el indicador que
// usamos para leer required:true/false del checklist sin llamar a la API
// directo, igual que lo vería el equipo de Farmazed en la pantalla real.
function reciboIeaRow(page) {
  return page.locator('.doc-item', { hasText: 'Recibo del pago de la I.E.A.' });
}

test.describe('TAREA 25/§H.9 — recibo_iea depende de aplicaIEA de la cotización, no del subtipo', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('sin cotización aceptada: "(opcional)" en ambos; con aplicaIEA=true: obligatorio solo en ese caso', async ({ page }) => {
    test.setTimeout(120000);

    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');

    // ═══ 1. Antes de cualquier cotización: recibo_iea "(opcional)" en los 2 ═══
    await page.goto('/admin/expediente.html?id=case-checklist-iea-si');
    await expect(reciboIeaRow(page)).toContainText('(opcional)', { timeout: 10000 });
    await shot(page, '00-si-sin-cotizacion-opcional');

    await page.goto('/admin/expediente.html?id=case-checklist-iea-no');
    await expect(reciboIeaRow(page)).toContainText('(opcional)', { timeout: 10000 });

    // ═══ 2. fase_03 -> fase_04 dispara el borrador automático de cotización ═══
    for (const caseId of ['case-checklist-iea-si', 'case-checklist-iea-no']) {
      await page.goto(`/admin/expediente.html?id=${caseId}`);
      await expect(page.locator('#status-select')).toHaveValue('fase_03', { timeout: 10000 });
      await guardarEstado(page, 'fase_04');
    }

    // ═══ 3. Admin marca "Aplica IEA" SOLO en la línea de case-checklist-iea-si ═══
    // org Beta ya tiene 2 cotizaciones 'aceptada' de otro fixture (TAREA 23,
    // case-gate-pago-concepto-*) — filtrar por el caseCode propio de este
    // caso para no chocar con esas tarjetas (mismo tipo de bug ya corregido
    // una vez para "Laboratorios Alfa" en quotes.spec.js).
    await page.goto('/admin/cotizaciones.html');
    const card = page.locator('.quote-card', { hasText: 'FZ-MED-REG-2026-0113' });
    await expect(card).toBeVisible({ timeout: 10000 });
    const lineaSi = card.locator('.linea-row[data-case="case-checklist-iea-si"]');
    await lineaSi.locator('.chk-iea').check();
    await lineaSi.locator('.btn-guardar-linea').click();
    await expect(card).toContainText('borrador', { timeout: 10000 });
    await shot(page, '01-admin-marca-aplica-iea');

    // ═══ 4. Enviar y aceptar la cotización (client Beta) ═══
    await card.locator('.btn-enviar').click();
    await expect(card).toContainText('enviada', { timeout: 10000 });
    await logout(page);

    await login(page, 'titular-beta@farmazed.test', 'Farmazed123!');
    await page.locator('a.nav-link', { hasText: 'Cotización' }).click();
    await page.mouse.move(700, 400);
    await expect(page.locator('.btn-aceptar-cot')).toBeVisible({ timeout: 10000 });
    await page.locator('.btn-aceptar-cot').click();
    await expect(page.locator('#cotizacion-content')).toContainText('Aceptada', { timeout: 10000 });
    await logout(page);

    // ═══ 5. Con la cotización aceptada: recibo_iea obligatorio SOLO en el
    // caso marcado con aplicaIEA=true — el otro sigue "(opcional)" ═══
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/expediente.html?id=case-checklist-iea-si');
    await expect(reciboIeaRow(page)).not.toContainText('(opcional)', { timeout: 10000 });
    await shot(page, '02-si-aceptada-obligatorio');

    await page.goto('/admin/expediente.html?id=case-checklist-iea-no');
    await expect(reciboIeaRow(page)).toContainText('(opcional)', { timeout: 10000 });
    await shot(page, '03-no-sigue-opcional');
  });
});

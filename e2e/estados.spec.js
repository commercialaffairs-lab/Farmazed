// e2e/estados.spec.js — Recorrido real en la UI (Playwright + Chromium
// cacheado, SOLO contra el emulador) del enum de 21 estados: TAREA 8,
// reescrito en TAREA 21 (§H.8, reemplaza §H.1) para el flujo canónico de 13
// fases en 5 bloques — fase_08 y fase_10 son las únicas manuales; fase_08
// exige DOS confirmaciones (legal + técnica/matrices) antes de avanzar.
//
// Corre con: ./e2e/run.sh estados.spec.js  (o ./e2e/run.sh para todos los specs)
// NUNCA correr "npx playwright test" a mano sin pasar por run.sh — necesita
// los emuladores + tracker + frontend ya arriba y las env vars FZ_*.

const { test, expect } = require('@playwright/test');
const { enviarLogin, esperarAnimaciones } = require('./_esperas');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-29');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

// El panel de historial se refresca de forma async tras cada guardado — sin
// esto, una captura tomada justo después de un save puede llegar antes de
// que el fetch termine y mostrar el conteo de entradas viejo.
async function waitForHistoryCount(page, n) {
  await expect(page.locator('#status-history .field-row')).toHaveCount(n, { timeout: 10000 });
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}

test.describe('Máquina de 21 estados (13 fases, §H.8/TAREA 21)', () => {
  test.beforeEach(async ({ page }) => {
    // Acepta todos los alert()/confirm() nativos — es exactamente el
    // comportamiento esperado del admin al confirmar un avance o ver el
    // mensaje de éxito. Playwright no puede clickear un dialog nativo con
    // locators normales, así que se maneja aquí una sola vez.
    page.on('dialog', d => d.accept());

    // Ajuste (Rick, 29-sep): nunca editar config.js para apuntar el tracker
    // a un puerto distinto de 8080 — el puerto real (FZ_API_PORT, lo decide
    // run.sh según lo que esté libre en la máquina) viaja por localStorage,
    // que config.js ya sabe leer. addInitScript corre antes de CADA carga de
    // página en este test, así que sobrevive a los redirects de login.html.
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('admin avanza, confirma fase 8 (dos partes), subsana, override bloqueado, historial; cliente ve el cambio', async ({ page }) => {
    test.setTimeout(120000); // recorrido largo (13 fases + historial + 3 viewports): 45 s no alcanza con el host cargado
    // ── 1. Login admin ──────────────────────────────────────────────────
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await shot(page, 'admin-login-ok');

    // ── 2. Ir al expediente del caso (fase_06) desde la lista real ──────
    await page.goto('/admin/casos.html');
    await page.waitForSelector('#cases-tbody tr');
    await page.getByText('Analgen Test Visual').first().click();
    await page.waitForURL(/expediente\.html\?id=test-flujo-visual/);
    await expect(page.locator('#status-select')).toHaveValue('fase_06', { timeout: 10000 });
    await shot(page, 'expediente-fase06');

    // ── 3. Avanzar 06 -> 07 (ninguna de las dos es manual, sin confirm) ─
    await page.selectOption('#status-select', 'fase_07');
    await page.click('#btn-save-status');
    await expect(page.locator('#status-select')).toHaveValue('fase_07', { timeout: 10000 });
    await waitForHistoryCount(page, 1);
    await shot(page, 'fase07');

    // ── 4. Desde fase_07 el select NO ofrece fase_09 (solo fase_08) ─────
    const optionsFase07 = await page.locator('#status-select option').evaluateAll(
      opts => opts.map(o => o.value)
    );
    expect(optionsFase07).not.toContain('fase_09');
    expect(optionsFase07.sort()).toEqual(['fase_07', 'fase_08'].sort());

    // ── 5. Avanzar 07 -> 08 (fase_07 NO es manual — sin confirm, cambió
    // respecto al modelo de 14 fases) ────────────────────────────────────
    await page.selectOption('#status-select', 'fase_08');
    await page.click('#btn-save-status');
    await expect(page.locator('#status-select')).toHaveValue('fase_08', { timeout: 10000 });
    await waitForHistoryCount(page, 2);
    await shot(page, 'fase08-entrada');

    // ── 6. fase_08 -> fase_09 SIN las dos confirmaciones: bloqueado ─────
    await page.selectOption('#status-select', 'fase_09');
    await page.click('#btn-save-status'); // dispara alert de error (auto-aceptado)
    await shot(page, 'fase08-sin-confirmaciones-bloqueado');
    await page.reload();
    await expect(page.locator('#status-select')).toHaveValue('fase_08', { timeout: 10000 });

    // ── 7. El admin confirma las dos partes (legal y técnica) desde la
    // tarjeta de Fase 8 — tiene los dos permisos (abogado+admin, regente+admin) ──
    await expect(page.locator('#fase8-card')).toBeVisible({ timeout: 10000 });
    await page.locator('.btn-confirmar-fase8[data-tipo="legal"]').click();
    await expect(page.locator('#fase8-confirmaciones')).toContainText('Confirmada', { timeout: 10000 });
    await page.locator('.btn-confirmar-fase8[data-tipo="tecnica"]').click();
    await expect(page.locator('#fase8-confirmaciones')).not.toContainText('Pendiente', { timeout: 10000 });
    await shot(page, 'fase08-dos-confirmaciones');

    // ── 8. Ahora sí avanza 08 -> 09 -> 10 ────────────────────────────────
    await page.selectOption('#status-select', 'fase_09');
    await page.click('#btn-save-status');
    await expect(page.locator('#status-select')).toHaveValue('fase_09', { timeout: 10000 });
    await waitForHistoryCount(page, 3);

    await page.selectOption('#status-select', 'fase_10');
    await page.click('#btn-save-status');
    await expect(page.locator('#status-select')).toHaveValue('fase_10', { timeout: 10000 });
    await waitForHistoryCount(page, 4);
    await shot(page, 'fase10');

    // ── 9. Subsanación 10 -> 09 (fase_10 es manual — confirma el analista;
    // el admin lo mismo puede) ───────────────────────────────────────────
    const optionsFase10 = await page.locator('#status-select option').evaluateAll(
      opts => opts.map(o => o.value)
    );
    expect(optionsFase10.sort()).toEqual(['fase_09', 'fase_10', 'fase_11'].sort());
    await page.selectOption('#status-select', 'fase_09');
    await page.click('#btn-save-status');
    await expect(page.locator('#status-select')).toHaveValue('fase_09', { timeout: 10000 });
    await waitForHistoryCount(page, 5);
    await shot(page, 'subsanacion-fase09');

    // ── 10. Override SIN motivo debe bloquear (salto inválido a propósito) ──
    await page.check('#override-check');
    await expect(page.locator('#override-reason-row')).toBeVisible();
    const optionsOverride = await page.locator('#status-select option').evaluateAll(
      opts => opts.map(o => o.value)
    );
    expect(optionsOverride.length).toBe(21); // con override, se ofrecen los 21 estados
    await page.selectOption('#status-select', 'aprobado'); // salto invalido a proposito
    await page.fill('#override-reason', ''); // motivo vacio a proposito
    await page.click('#btn-save-status'); // dispara el alert "necesita un motivo" (auto-aceptado)
    await shot(page, 'override-sin-motivo-bloqueado');

    // Confirma que NO se guardó nada: recargando, el caso sigue en fase_09.
    await page.reload();
    await expect(page.locator('#status-select')).toHaveValue('fase_09', { timeout: 10000 });

    // ── 11. Historial visible ─────────────────────────────────────────────
    // Tras el reload, renderStatusHistory() es async — esperar a que
    // termine (Playwright reintenta el locator hasta que la condición se
    // cumpla o expire el timeout, en vez de leer el DOM una sola vez).
    await expect(page.locator('#status-history')).toContainText('revisión de documentación digital', { timeout: 10000 });
    await expect(page.locator('#status-history')).not.toContainText('Cargando');
    await shot(page, 'historial-visible');

    // ── 12. Estado sin migrar en el admin: badge gris + console.warn ────
    // Ajuste (Rick, 29-sep): un caso legacy (seed-case-approved, status
    // "approved", fuera del enum de 21) NO debe verse como una fase válida.
    const casosWarnings = [];
    page.on('console', msg => { if (msg.type() === 'warning') casosWarnings.push(msg.text()); });
    await page.goto('/admin/casos.html');
    await page.waitForSelector('#cases-tbody tr');
    const legacyRow = page.locator('tr', { hasText: 'seed-case-approved' });
    await expect(legacyRow).toBeVisible({ timeout: 10000 });
    await expect(legacyRow.locator('.badge')).toHaveClass(/bg-secondary/);
    await expect(legacyRow.locator('.badge')).toContainText('sin migrar');
    expect(casosWarnings.some(w => w.includes('seed-case-approved') && w.includes('sin migrar'))).toBe(true);
    await shot(page, 'admin-sin-migrar-gris');

    // ── 13. Logout admin, login cliente ─────────────────────────────────
    await page.click('#sidebar-logout');
    await page.waitForURL(/login\.html/);

    await login(page, 'cliente@farmazed.test', 'Farmazed123!');
    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    const productCard = page.locator('#productos-list', { hasText: 'Analgen Test Visual' });
    await expect(productCard).toBeVisible({ timeout: 10000 });
    await expect(productCard).toContainText('Solicitud y envío de documentos originales');

    // Mover el mouse lejos del sidebar antes de capturar: el template
    // vendored (src/approx) colapsa el sidebar a un riel de íconos entre
    // 310-1440px de ancho, pero lo EXPANDE en :hover (flyout) — si el mouse
    // queda sobre el sidebar (ej. justo después de clickear un link ahí),
    // la captura lo agarra expandido tapando el contenido, aunque el layout
    // en uso real (mouse en cualquier otro lado) esté bien. No es un bug de
    // la app, es nada más dejar el cursor en un lugar razonable antes de la
    // foto — igual que haría una persona mirando la pantalla.
    await page.mouse.move(700, 400);

    // ── 14. Responsive: 1280 (default), 1440 y 390px ─────────────────────
    await esperarAnimaciones(page); // deja terminar la transición CSS del sidebar
    await shot(page, 'cliente-ve-fase-real-1280');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.mouse.move(700, 400);
    await esperarAnimaciones(page);
    await expect(productCard).toBeVisible();
    await shot(page, 'cliente-ve-fase-real-1440');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.mouse.move(200, 400);
    await esperarAnimaciones(page);
    await expect(page.locator('#productos-list', { hasText: 'Analgen Test Visual' })).toBeVisible();
    await shot(page, 'cliente-ve-fase-real-390');

    // ── 15. Estado sin migrar en el cliente: texto neutro + console.warn ─
    await page.setViewportSize({ width: 1280, height: 720 });
    const dashWarnings = [];
    page.on('console', msg => { if (msg.type() === 'warning') dashWarnings.push(msg.text()); });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    await page.mouse.move(700, 400);

    // Los 2 casos legacy sembrados (seed-case-approved "approved",
    // seed-case-in-review "in_review") deben mostrar el texto neutro, cada
    // uno 2 veces (fase_label + badge) = 4 coincidencias esperadas.
    await expect(page.getByText('Estado en actualización').first()).toBeVisible({ timeout: 10000 });
    expect(await page.getByText('Estado en actualización').count()).toBe(4);
    expect(dashWarnings.some(w => w.includes('in_review') && w.includes('sin migrar'))).toBe(true);
    await shot(page, 'cliente-sin-migrar-neutro');
  });
});

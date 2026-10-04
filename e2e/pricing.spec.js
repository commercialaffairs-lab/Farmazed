// e2e/pricing.spec.js — D13 (organizacion/03_INSTRUCCIONES_DEV.md fila D13):
// desglose "Honorarios Farmazed" vs. "Tasas oficiales" en la pantalla de
// costo del cliente y en admin/precios.html. SOLO contra el emulador.
// Corre con: ./e2e/run.sh pricing.spec.js

const { test, expect } = require('@playwright/test');
const { enviarLogin } = require('./_esperas');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-29');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-pricing-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
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
    page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
    page.evaluate(async () => {
      const { logout } = await import('./portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

// 3 categorías distintas (una de cada `grupo`), con los montos actuales de
// seed_pricing.js — ver organizacion/05_DIFF_PRECIOS_D09.md para el detalle
// de por qué algunos de estos NO coinciden con el xlsx canónico. No se
// tocan montos en esta tarea, solo se verifica que lo que hay hoy se agrupa
// y se muestra bien.
const CASOS = [
  { id: 'med_abreviado_sintesis', name: 'Síntesis Química — Procedimiento Abreviado', honorarios: 2055, tasas: 2525, total: 4580 },
  { id: 'cambio_rep_legal',       name: 'Cambio Rep. Legal / Prof. Responsable',       honorarios: 400,  tasas: 25,   total: 425  },
  { id: 'renovacion',             name: 'Renovaciones (tipos principales)',            honorarios: 800,  tasas: 500,  total: 1300 },
];

test.describe('D13 — desglose honorarios Farmazed / tasas oficiales', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('el módulo Precios está oculto por defecto (flag apagado, PM_COMMENTS §H.2)', async ({ page }) => {
    // Sin encender feature_clientePrecios — este es el estado real de
    // cualquier cliente hoy, local o producción.
    await login(page, 'cliente@farmazed.test', 'Farmazed123!');
    // El <li> sigue en el DOM (a propósito, "no lo borres") pero oculto —
    // toBeHidden() chequea display:none, no ausencia del nodo.
    await expect(page.locator('a.nav-link', { hasText: 'Precios' })).toBeHidden();
    await expect(page.locator('#nav-precios-item')).toBeHidden();

    // Ni siquiera invocándolo a mano (ej. alguien con la consola abierta)
    // se llega al módulo — showModule('precios') se niega sin el flag.
    await page.evaluate(() => window.showModule('precios'));
    await expect(page.locator('#mod-precios')).not.toHaveClass(/active/);
    await shot(page, '00-oculto-sin-flag');
  });

  test('las 3 cifras cuadran en la vista del cliente y en admin/precios.html (flag encendido en local, solo para esta prueba)', async ({ page }) => {
    // Ajuste (PM_COMMENTS §H.2): el módulo "Precios" del cliente está
    // apagado por defecto (decisión comercial pendiente de Rick) — se
    // enciende SOLO en esta prueba, vía localStorage, para poder probarlo.
    // Nunca se enciende así en producción (config.js lo bloquea fuera de
    // IS_LOCAL, pase lo que pase en localStorage/query string).
    await page.addInitScript(() => {
      try { window.localStorage.setItem('feature_clientePrecios', '1'); } catch (e) { /* noop */ }
    });
    // ── 1. API: confirmar que el backend ya manda el desglose correcto ──
    const apiPort = process.env.FZ_API_PORT || '8080';
    const apiRes = await page.request.get(`http://localhost:${apiPort}/api/admin/pricing`);
    expect(apiRes.ok()).toBeTruthy();
    const { pricing } = await apiRes.json();
    for (const c of CASOS) {
      const item = pricing.find(p => p.id === c.id);
      expect(item, `falta ${c.id} en /api/admin/pricing`).toBeTruthy();
      expect(item.honorariosFarmazed).toBe(c.honorarios);
      expect(item.tasasOficiales).toBe(c.tasas);
      expect(item.total).toBe(c.total);
      expect(item.honorariosFarmazed + item.tasasOficiales).toBe(item.total);
    }

    // ── 2. Cliente: pantalla de precios ─────────────────────────────────
    await login(page, 'cliente@farmazed.test', 'Farmazed123!');
    await page.locator('a.nav-link', { hasText: 'Precios' }).click();
    await expect(page.getByText(CASOS[0].name)).toBeVisible({ timeout: 10000 });

    for (const c of CASOS) {
      const card = page.locator('.fz-price-card', { hasText: c.name });
      await expect(card).toBeVisible();
      await expect(card).toContainText(`B/. ${c.honorarios.toLocaleString('es-PA')}`);
      await expect(card).toContainText(`B/. ${c.tasas.toLocaleString('es-PA')}`);
      await expect(card).toContainText(`B/. ${c.total.toLocaleString('es-PA')}`);
    }
    await shot(page, 'cliente-precios');

    // ── 3. Admin: admin/precios.html — TAREA 15/E3 parte 2: ya no pide
    // "admin key", usa la sesión de Firebase (requireLogin + rol admin). ──
    await logout(page);
    await login(page, 'admin@farmazed.test', 'Farmazed123!');

    await page.goto('/admin/precios.html');
    await expect(page.getByText(CASOS[0].name)).toBeVisible({ timeout: 10000 });

    for (const c of CASOS) {
      const card = page.locator('.price-card', { has: page.getByText(c.name) });
      await expect(card.getByText(`B/. ${c.honorarios.toLocaleString('es-PA')}`)).toBeVisible();
      await expect(card.getByText(`B/. ${c.tasas.toLocaleString('es-PA')}`)).toBeVisible();
      await expect(card.locator('.total-display')).toContainText(`B/. ${c.total.toLocaleString('es-PA')}`);
    }
    await shot(page, 'admin-precios');
  });
});

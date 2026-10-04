// e2e/formularios.spec.js — R14 (organizacion/04_ROADMAP.md), TAREA 17.
//
// Biblioteca de los 13 formularios canónicos: el admin ve la biblioteca
// completa; el cliente solo ve los que aplican con certeza a SU caso (más
// los "por confirmar", nunca ocultados ni afirmados). Usa el fixture
// `case-formularios-test` (Abreviado + Suplementos) de
// tracker/scripts/seed_roles.js, sembrado por e2e/run.sh.
//
// Corre con: ./e2e/run.sh formularios.spec.js (o ./e2e/run.sh para todos)

const { test, expect } = require('@playwright/test');
const { enviarLogin } = require('./_esperas');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-30');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-formularios-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}

test.describe('R14 — biblioteca de formularios', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('admin ve la biblioteca completa (13), con F1/F2 "por confirmar" (TAREA 28: dependen de representación)', async ({ page }) => {
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/formularios.html');
    await expect(page.getByText('Autorización de Representación Legal en Panamá (otorgada por el Titular)')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.form-row')).toHaveCount(13);
    // TAREA 28 (§H.11): F3 ("aplica siempre") y F10 ("todo registro nuevo")
    // ya tienen una condición cierta — solo F1/F2 (dependen de
    // `representacion`, un dato del caso que la biblioteca sin contexto no
    // tiene) siguen "por confirmar" acá.
    await expect(page.locator('.form-row .badge', { hasText: 'Por confirmar' })).toHaveCount(2);
    // Un aplicable con certeza sí lleva su tag, no "por confirmar".
    const formSuplementos = page.locator('.form-row', { hasText: 'Inscripción de Suplementos' });
    await expect(formSuplementos.locator('.badge', { hasText: 'Suplementos' })).toBeVisible();
    await expect(formSuplementos.locator('.badge', { hasText: 'Por confirmar' })).toHaveCount(0);
    const formPoderFarmaceutico = page.locator('.form-row', { hasText: 'Autorización de Trámite de Registro Sanitario al Farmacéutico' });
    await expect(formPoderFarmaceutico.locator('.badge', { hasText: 'Siempre' })).toBeVisible();
    await shot(page, '00-admin-biblioteca-completa');
  });

  test('cliente ve solo los formularios que aplican a su caso (Abreviado + Suplementos) + los "por confirmar"', async ({ page }) => {
    await login(page, 'titular-alfa@farmazed.test', 'Farmazed123!');
    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    const card = page.locator('.fz-product-card', { hasText: 'Producto Formularios Test' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator('.fz-prod-header').click();

    // Aplicables con certeza: Abreviado (06/07) + Suplementos (11/12) + F3
    // (siempre) + F10 (todo registro nuevo) — TAREA 28 (§H.11).
    await expect(card.getByText('Procedimiento Abreviado, Nuevo Registro Sanitario')).toBeVisible({ timeout: 10000 });
    await expect(card.getByText('Procedimiento Abreviado, Renovación con Cambios')).toBeVisible();
    await expect(card.getByText('Inscripción de Suplementos')).toBeVisible();
    await expect(card.getByText('Renovación de Suplementos')).toBeVisible();
    await expect(card.getByText('Autorización de Trámite de Registro Sanitario al Farmacéutico')).toBeVisible();
    await expect(card.getByText('Declaración de Nombre Comercial del Producto')).toBeVisible();

    // NO aplicable a este caso: Reconocimiento Mutuo.
    await expect(card.getByText('Reconocimiento Mutuo')).toHaveCount(0);

    // "Por confirmar" (solo F1/F2 — representacion sin definir en este
    // caso) se listan, marcados como tal — no se ocultan ni se afirma que
    // aplican.
    await expect(card.getByText('Por confirmar con Farmazed si te corresponde.')).toHaveCount(2);

    await page.mouse.move(700, 400);
    await shot(page, '01-cliente-formularios-filtrados');
  });
});

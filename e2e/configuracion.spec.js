// e2e/configuracion.spec.js — TAREA 41b. Página admin "Configuración": el admin ve el
// mapa del código cargado en un iframe aislado (sandbox sin allow-same-origin) y puede
// abrirlo en una pestaña nueva; el analista no ve el enlace y, si entra directo, lo
// redirigen a su bandeja.
//
// Instancia aislada (desde e2e/):
//   FZ_STATIC_PORT=8093 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 FZ_API_PORT=8070 \
//     npx playwright test configuracion.spec.js

const { test, expect } = require('@playwright/test');
const { enviarLogin } = require('./_esperas');

const AUTH_PORT = process.env.FZ_AUTH_PORT || '9099';
const API_PORT  = process.env.FZ_API_PORT  || '8080';

async function entrar(page, email) {
  await page.addInitScript(({ apiPort, authPort }) => {
    try { localStorage.setItem('fzApiPort', apiPort); localStorage.setItem('fzAuthPort', authPort); } catch (e) { /* noop */ }
  }, { apiPort: API_PORT, authPort: AUTH_PORT });
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', 'Farmazed123!');
  await enviarLogin(page, /admin\/(bandeja|casos)\.html/, 15000);
}

test('admin: el enlace Configuración está, el grafo carga en un iframe aislado y se abre en pestaña nueva', async ({ page }) => {
  await entrar(page, 'admin-e3@farmazed.test');
  const enlace = page.locator('#nav-configuracion');
  await expect(enlace).toBeVisible({ timeout: 10000 });
  await enlace.click();
  await page.waitForURL(/admin\/configuracion\.html/);

  const frame = page.locator('#grafo-frame');
  await expect(frame).toBeVisible({ timeout: 20000 });
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts'); // sin allow-same-origin
  await expect(page.locator('#grafo-fecha')).toContainText('generado');

  // el grafo ya cargó dentro del iframe (contenedor + panel de búsqueda de graphify)
  const dentro = page.frameLocator('#grafo-frame');
  await expect(dentro.locator('#graph')).toBeAttached({ timeout: 20000 });
  await expect(dentro.locator('#search')).toBeAttached();

  // aislamiento: el contenido del iframe NO puede tocar la página padre (origen opaco)
  const handle = await frame.elementHandle();
  const contenido = await handle.contentFrame();
  const resultado = await contenido.evaluate(() => { try { return typeof window.parent.document.title; } catch (e) { return e.name; } });
  expect(resultado).toBe('SecurityError');

  // pestaña nueva: una envoltura con el MISMO iframe sandbox (la URL blob heredaría el origen de la página)
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#btn-nueva-pestana')]);
  await popup.waitForLoadState();
  await expect(popup.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(popup.frameLocator('iframe').locator('#graph')).toBeAttached({ timeout: 20000 });
});

test('analista: no ve el enlace Configuración y, si entra directo, lo redirigen a su bandeja', async ({ page }) => {
  await entrar(page, 'analista@farmazed.test');
  await page.goto('/admin/bandeja.html');
  await expect(page.locator('#nav-empresas')).toBeVisible({ timeout: 10000 }); // la página ya cargó
  await expect(page.locator('#nav-configuracion')).toBeHidden();

  await page.goto('/admin/configuracion.html');
  await page.waitForURL(/admin\/bandeja\.html/, { timeout: 15000 });
  await expect(page.locator('#grafo-frame')).toHaveCount(0);
});

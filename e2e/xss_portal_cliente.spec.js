// e2e/xss_portal_cliente.spec.js — TAREA 37b. XSS almacenado hacia el CLIENTE:
// el staff guarda un diagnóstico hostil y el propio cliente una captación
// hostil; en client-dashboard.html (portal vivo) deben verse como texto
// literal, sin ejecutarse. Sin el fix, window.__xss queda definido.
//
// Instancia aislada (desde e2e/):
//   FZ_STATIC_PORT=8093 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 FZ_API_PORT=8070 \
//     npx playwright test xss_portal_cliente.spec.js

const { test, expect } = require('@playwright/test');
const { enviarLogin, esperarQueNadaSeEjecute } = require('./_esperas');

const AUTH_PORT = process.env.FZ_AUTH_PORT || '9099';
const API_PORT  = process.env.FZ_API_PORT  || '8080';
const API  = `http://localhost:${API_PORT}`;
const AUTH = `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts`;

const XSS_FAB  = '<img src=x onerror=window.__xss=1>';
const XSS_DIAG = '<svg onload=window.__xss=2>';

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const authed = (method, token, body) => ({ method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const signIn = async (email, password) => (await fetch(`${AUTH}:signInWithPassword?key=fake-api-key`, json({ email, password, returnSecureToken: true })).then(r => r.json())).idToken;

async function verificar(correo, password) {
  const idToken = await signIn(correo, password);
  await fetch(`${AUTH}:sendOobCode?key=fake-api-key`, json({ requestType: 'VERIFY_EMAIL', idToken }));
  const { oobCodes } = await fetch(`http://localhost:${AUTH_PORT}/emulator/v1/projects/demo-farmazed/oobCodes`).then(r => r.json());
  await fetch(oobCodes.find(c => c.email === correo && c.requestType === 'VERIFY_EMAIL').oobLink);
}

test('XSS almacenado hacia el cliente: captación y diagnóstico hostiles se ven literales en client-dashboard', async ({ page }) => {
  const correo = `xss-cli-${Date.now()}@farmazed.test`;
  const password = 'Farmazed123!';

  // Cliente nuevo (plan 'consulta' por default) con captación hostil
  const reg = await fetch(`${API}/api/register`, json({ nombre: 'Cli', correo, password, telefono: '+507 6000-0000', empresa: 'Cli Co', pais: 'Panamá' }));
  expect(reg.status).toBe(201);
  const { orgId } = await reg.json();
  await verificar(correo, password);
  const tokenCliente = await signIn(correo, password);
  const capt = await fetch(`${API}/api/orgs/mine/captacion`, authed('PATCH', tokenCliente, {
    paisYNombreFabricante: XSS_FAB, categoriasProducto: ['medicamentos'], numeroProductosPorCategoria: '1',
    registroPrevioAutoridadReconocida: false, clienteNuevoOYaRegistrado: 'nuevo', productoConModificacionEnCurso: false,
  }));
  expect(capt.status).toBe(200);

  // Staff carga un diagnóstico hostil
  const tokenStaff = await signIn('analista@farmazed.test', password);
  const diag = await fetch(`${API}/api/orgs/${orgId}/diagnostico`, authed('PUT', tokenStaff, {
    clasificacion: XSS_DIAG, rutaRecomendada: 'ruta', requisitosAplicables: 'req', estimadoTiempos: '1 mes', estimadoCostos: '$1',
  }));
  expect(diag.status).toBe(200);

  // El cliente abre su portal
  await page.addInitScript(({ apiPort, authPort }) => {
    try { localStorage.setItem('fzApiPort', apiPort); localStorage.setItem('fzAuthPort', authPort); } catch (e) { /* noop */ }
  }, { apiPort: API_PORT, authPort: AUTH_PORT });
  page.on('dialog', d => d.accept());
  await page.goto('/login.html');
  await page.fill('#usuario', correo);
  await page.fill('#password', password);
  await enviarLogin(page, /client-dashboard\.html/, 15000);

  await page.waitForFunction(() => typeof window.showModule === 'function'); // el login resuelve al COMMIT de la URL: esperar a que el portal cargue
  await page.evaluate(() => showModule('empresa'));
  await expect(page.locator('#empresa-content')).toContainText(XSS_FAB, { timeout: 10000 });
  await expect(page.locator('#empresa-content').locator('img, svg')).toHaveCount(0);

  await page.evaluate(() => showModule('diagnostico'));
  await expect(page.locator('#diagnostico-content')).toContainText(XSS_DIAG, { timeout: 10000 });
  await expect(page.locator('#diagnostico-content').locator('img, svg')).toHaveCount(0);

  await esperarQueNadaSeEjecute(page); // un onerror/onload, si existiera, ya habría corrido
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

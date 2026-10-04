// e2e/xss_bandeja.spec.js — TAREA 37 (C1). XSS almacenado público -> admin:
// datos hostiles que entran por endpoints públicos (contact-leads, register +
// captación) deben verse como TEXTO LITERAL en la bandeja del admin, sin
// ejecutarse. Sin el fix, window.__xss queda definido.
//
// Corre contra la instancia aislada:
//   FZ_STATIC_PORT=8093 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 FZ_API_PORT=8070 \
//     npx playwright test xss_bandeja.spec.js   (desde e2e/)

const { test, expect } = require('@playwright/test');
const { enviarLogin, esperarQueNadaSeEjecute } = require('./_esperas');

const AUTH_PORT = process.env.FZ_AUTH_PORT || '9099';
const API_PORT  = process.env.FZ_API_PORT  || '8080';
const API = `http://localhost:${API_PORT}`;
const AUTH = `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts`;

const XSS_NOMBRE  = '<img src=x onerror=window.__xss=1>';
const XSS_EMPRESA = '<svg onload=window.__xss=2>';
const XSS_FAB     = '<img src=x onerror=window.__xss=3>';

const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function verificarYTokenDe(correo, password) {
  const login = await fetch(`${AUTH}:signInWithPassword?key=fake-api-key`, json({ email: correo, password, returnSecureToken: true })).then(r => r.json());
  await fetch(`${AUTH}:sendOobCode?key=fake-api-key`, json({ requestType: 'VERIFY_EMAIL', idToken: login.idToken }));
  const { oobCodes } = await fetch(`http://localhost:${AUTH_PORT}/emulator/v1/projects/demo-farmazed/oobCodes`).then(r => r.json());
  await fetch(oobCodes.find(c => c.email === correo && c.requestType === 'VERIFY_EMAIL').oobLink);
  // token nuevo, ya con emailVerified
  return (await fetch(`${AUTH}:signInWithPassword?key=fake-api-key`, json({ email: correo, password, returnSecureToken: true })).then(r => r.json())).idToken;
}

test('XSS almacenado: lead público y captación hostiles se ven literales en la bandeja del admin', async ({ page }) => {
  const sufijo = Date.now();
  const correoLead = `xss-lead-${sufijo}@farmazed.test`;
  const correoReg  = `xss-reg-${sufijo}@farmazed.test`;
  const password  = 'Farmazed123!';

  // 1) Lead de contacto público con HTML hostil
  const lead = await fetch(`${API}/api/contact-leads`, json({ nombre: XSS_NOMBRE, correo: correoLead, empresa: XSS_EMPRESA, tipoProducto: 'x' }));
  expect(lead.status).toBe(201);

  // 2) Registro público con empresa hostil + captación con fabricante hostil
  const reg = await fetch(`${API}/api/register`, json({ nombre: 'Reg', correo: correoReg, password, telefono: '+507 6000-0000', empresa: XSS_EMPRESA, pais: 'Panamá' }));
  expect(reg.status).toBe(201);
  const token = await verificarYTokenDe(correoReg, password);
  const capt = await fetch(`${API}/api/orgs/mine/captacion`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paisYNombreFabricante: XSS_FAB, categoriasProducto: ['medicamentos'], numeroProductosPorCategoria: '1',
      registroPrevioAutoridadReconocida: false, clienteNuevoOYaRegistrado: 'nuevo', productoConModificacionEnCurso: false,
    }),
  });
  expect(capt.status).toBe(200);

  // 3) Admin abre la bandeja
  await page.addInitScript(({ apiPort, authPort }) => {
    try { localStorage.setItem('fzApiPort', apiPort); localStorage.setItem('fzAuthPort', authPort); } catch (e) { /* noop */ }
  }, { apiPort: API_PORT, authPort: AUTH_PORT });
  page.on('dialog', d => d.accept());
  await page.goto('/login.html');
  await page.fill('#usuario', 'admin-e3@farmazed.test');
  await page.fill('#password', password);
  await enviarLogin(page, /admin\/(bandeja|casos)\.html|dashboard\.html/, 15000);
  await page.goto('/admin/bandeja.html');

  const filaLead = page.locator('#contact-leads-list > div', { hasText: correoLead });
  await expect(filaLead).toBeVisible({ timeout: 10000 });
  await expect(filaLead).toContainText(XSS_NOMBRE);   // texto literal, no una <img>
  await expect(filaLead).toContainText(XSS_EMPRESA);
  await expect(filaLead.locator('img, svg')).toHaveCount(0);

  const filaOrg = page.locator('#leads-list > div', { hasText: XSS_FAB });
  await expect(filaOrg).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#leads-list').locator('img, svg')).toHaveCount(0);

  await esperarQueNadaSeEjecute(page); // un onerror/onload, si existiera, ya habría corrido
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

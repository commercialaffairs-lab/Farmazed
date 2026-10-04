// e2e/aceptar_invitacion.spec.js — TAREA 39b. La página pública
// aceptar-invitacion.html: quien NO tiene cuenta pone nombre y
// contraseña y el SERVIDOR crea el usuario con el correo de la invitación
// (verificado, con el rol); la página muestra el correo enmascarado y luego inicia
// sesión. Quien ya tiene cuenta usa "Ya tengo una cuenta" (cubierto en el backend).
//
// Instancia aislada (desde e2e/):
//   FZ_STATIC_PORT=8093 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 FZ_API_PORT=8070 \
//     npx playwright test aceptar_invitacion.spec.js

const { test, expect } = require('@playwright/test');

const AUTH_PORT = process.env.FZ_AUTH_PORT || '9099';
const API_PORT  = process.env.FZ_API_PORT  || '8080';
const API  = `http://localhost:${API_PORT}`;
const AUTH = `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts`;

test('invitado crea su cuenta y acepta la invitación -> entra como staff; el link no se puede reutilizar', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.addInitScript(({ apiPort, authPort }) => {
    try { localStorage.setItem('fzApiPort', apiPort); localStorage.setItem('fzAuthPort', authPort); } catch (e) { /* noop */ }
  }, { apiPort: API_PORT, authPort: AUTH_PORT });

  // El admin invita a un nuevo analista
  const adm = await fetch(`${AUTH}:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin-e3@farmazed.test', password: 'Farmazed123!', returnSecureToken: true }),
  }).then(r => r.json());
  const correo = `e2e-invitado-${Date.now()}@farmazed.test`;
  const inv = await fetch(`${API}/api/invitations/empleado`, {
    method: 'POST', headers: { Authorization: `Bearer ${adm.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, role: 'analista' }),
  }).then(r => r.json());
  expect(inv.id).toBeTruthy();

  // La persona abre el link, pone nombre y contraseña
  await page.goto(`/aceptar-invitacion.html?token=${inv.id}`);
  // TAREA 39b: el GET público devuelve el correo ENMASCARADO (p. ej. e***@farmazed.test)
  await expect(page.locator('#invite-email')).toHaveValue(/^e\*\*\*@farmazed\.test$/, { timeout: 10000 });
  await page.fill('#display-name', 'Invitado E2E');
  await page.fill('#password', 'Farmazed123!');
  await page.fill('#password-confirm', 'Farmazed123!');
  await page.click('#btn-submit');
  await page.waitForURL(/admin\/bandeja\.html/, { timeout: 15000 });

  // El link ya se usó: abrirlo de nuevo muestra "ya fue usada"
  await page.goto(`/aceptar-invitacion.html?token=${inv.id}`);
  await expect(page.locator('#used-msg')).toBeVisible({ timeout: 10000 });
});

// Quien YA tiene cuenta con ese correo (verificada): el camino público le avisa y la
// página le pide iniciar sesión; la invitación se acepta con esa sesión.
test('invitado con cuenta verificada previa -> "ya tengo una cuenta": inicia sesión y acepta', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.addInitScript(({ apiPort, authPort }) => {
    try { localStorage.setItem('fzApiPort', apiPort); localStorage.setItem('fzAuthPort', authPort); } catch (e) { /* noop */ }
  }, { apiPort: API_PORT, authPort: AUTH_PORT });

  const post = (url, body, token) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }).then(r => r.json());
  const adm = await post(`${AUTH}:signInWithPassword?key=fake-api-key`, { email: 'admin-e3@farmazed.test', password: 'Farmazed123!', returnSecureToken: true });
  const correo = `e2e-existente-${Date.now()}@farmazed.test`;
  const password = 'Farmazed123!';

  // cuenta previa, con el correo verificado (como si hubiera confirmado el mensaje de Firebase)
  const cuenta = await post(`${AUTH}:signUp?key=fake-api-key`, { email: correo, password, returnSecureToken: true });
  await post(`${AUTH}:sendOobCode?key=fake-api-key`, { requestType: 'VERIFY_EMAIL', idToken: cuenta.idToken });
  const { oobCodes } = await fetch(`http://localhost:${AUTH_PORT}/emulator/v1/projects/demo-farmazed/oobCodes`).then(r => r.json());
  await fetch(oobCodes.find(c => c.email === correo && c.requestType === 'VERIFY_EMAIL').oobLink);

  const inv = await post(`${API}/api/invitations/empleado`, { email: correo, role: 'analista' }, adm.idToken);
  await page.goto(`/aceptar-invitacion.html?token=${inv.id}`);
  await expect(page.locator('#invite-email')).toHaveValue(/\*\*\*@farmazed\.test$/, { timeout: 10000 });
  await page.fill('#display-name', 'Con Cuenta');
  await page.fill('#password', password);
  await page.fill('#password-confirm', password);
  await page.click('#btn-submit');

  // el servidor responde "cuenta_existente": aparece el formulario de iniciar sesión
  await expect(page.locator('#login-form')).toBeVisible({ timeout: 10000 });
  await page.fill('#login-email', correo);
  await page.fill('#login-password', password);
  await page.click('#btn-login');
  await page.waitForURL(/admin\/bandeja\.html/, { timeout: 15000 });
});

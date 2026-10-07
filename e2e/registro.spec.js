// e2e/registro.spec.js — TAREA 32 (PM_COMMENTS §H.13). Registro abierto de
// clientes nuevos -> verificación de correo obligatoria -> captación de
// información preliminar (primer ingreso, Fase 2 Zelky) -> portal. Más el
// lead visible en la bandeja de staff.
//
// La "verificación de correo" contra el emulador no manda un correo real —
// se confirma llamando el link de confirmación (oobLink) que el emulador de
// Auth expone en su propia API REST (ver DEV_LOCAL.md). Esto simula
// exactamente lo que haría la persona al hacer clic en el correo real.
//
// Corre con: ./e2e/run.sh registro.spec.js (o ./e2e/run.sh para todos)

const { test, expect } = require('@playwright/test');
const { enviarLogin } = require('./_esperas');

const AUTH_PORT = process.env.FZ_AUTH_PORT || '9099';
const API_PORT  = process.env.FZ_API_PORT  || '8080';

async function confirmarCorreo(correo, password) {
  const login = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, returnSecureToken: true }),
  }).then(r => r.json());

  await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: login.idToken }),
  });

  const { oobCodes } = await fetch(`http://localhost:${AUTH_PORT}/emulator/v1/projects/demo-farmazed/oobCodes`).then(r => r.json());
  const codigo = oobCodes.find(c => c.email === correo && c.requestType === 'VERIFY_EMAIL');
  if (!codigo) throw new Error(`No se encontró el oobCode de verificación para ${correo}`);
  await fetch(codigo.oobLink); // exactamente lo que hace la persona al hacer clic en el correo real
}

test.describe('R? — TAREA 32: registro abierto -> verificación -> captación -> portal', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    await page.addInitScript(({ apiPort, authPort }) => {
      try {
        window.localStorage.setItem('fzApiPort', apiPort);
        window.localStorage.setItem('fzAuthPort', authPort);
      } catch (e) { /* noop */ }
    }, { apiPort: API_PORT, authPort: AUTH_PORT });
  });

  test('registro -> bloqueado sin verificar -> verifica -> aterriza en el portal con la captación bloqueante -> queda en Mi Empresa -> lead visible para staff', async ({ page }) => {
    const correo = `e2e-registro-${Date.now()}@farmazed.test`;
    const password = 'Farmazed123!';

    // ── 1) Registro ──────────────────────────────────────────────────────
    await page.goto('/registro.html');
    await page.fill('#r-nombre', 'E2E Registro Test');
    await page.fill('#r-correo', correo);
    await page.fill('#r-password', password);
    await page.fill('#r-password-confirm', password);
    await page.fill('#r-telefono', '+507 6000-9999');
    await page.fill('#r-empresa', 'E2E Registro Co');
    await page.fill('#r-pais', 'Panamá');
    await page.click('#btn-submit');
    await expect(page.locator('#done-msg')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#done-email')).toHaveText(correo);

    // ── 2) Sin verificar, el portal bloquea (TAREA 32: "sin verificar no entra") ──
    // registro.html ya deja la sesión activa (login() + sendEmailVerification())
    // — ir a login.html de nuevo ni muestra el formulario: su propio
    // onAuthStateChanged manda derecho al destino, que a su vez rebota a
    // verificar-correo.html porque requireVerifiedLogin lo detecta sin
    // verificar (cascada real, no un atajo del test).
    await page.goto('/login.html');
    await page.waitForURL(/verificar-correo\.html/, { timeout: 10000 });
    await expect(page.locator('#v-email')).toHaveText(correo);

    // Intentar entrar directo por URL tampoco sirve — requireVerifiedLogin
    // en CADA página protegida, no solo en login.html.
    await page.goto('/client-dashboard.html');
    await page.waitForURL(/verificar-correo\.html/, { timeout: 10000 });

    // ── 3) Verificar el correo (vía la API del emulador, ver arriba) ──────
    await confirmarCorreo(correo, password);

    // ── 4) "Ya verifiqué, continuar" ahora sí entra ──────────────────────
    await page.click('#btn-continuar');
    await page.waitForURL(/client-dashboard\.html/, { timeout: 10000 });

    // ── 5) Primer ingreso: captación bloqueante (Fase 2 Zelky, §H.13) ────
    await expect(page.locator('#captacion-overlay')).toBeVisible({ timeout: 10000 });
    // Cancelar no existe en el primer ingreso — es obligatoria.
    await expect(page.locator('#btn-captacion-cancelar')).toBeHidden();

    await page.fill('#capt-fabricante', 'Alemania — Laboratorios E2E');
    await page.check('#capt-cat-medicamentos');
    // Contador por categoría (07-oct): aparece al marcar la categoría; "+" lo sube a 2.
    await expect(page.locator('#capt-num-medicamentos')).toHaveValue('1');
    await page.click('.fz-contador[data-cat="medicamentos"] button[data-paso="1"]');
    await expect(page.locator('#capt-num-medicamentos')).toHaveValue('2');
    await page.check('input[name="capt-registro-previo"][value="si"]');
    await page.check('input[name="capt-nuevo-o-registrado"][value="nuevo"]');
    await page.check('input[name="capt-modificacion-en-curso"][value="no"]');
    await page.click('#btn-captacion-guardar');
    await expect(page.locator('#captacion-overlay')).toBeHidden({ timeout: 10000 });

    // ── 6) "Se pide una sola vez": recargar NO vuelve a mostrarla ─────────
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#captacion-overlay')).toBeHidden();

    // ── 7) Editable después, desde Mi Empresa ─────────────────────────────
    await page.locator('a.nav-link', { hasText: 'Mi Empresa' }).click();
    await expect(page.getByText('Alemania — Laboratorios E2E')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#btn-editar-captacion')).toBeVisible();

    // ── 8) Staff ve el lead en su bandeja ──────────────────────────────────
    // Logout primero — si no, login.html redirige solo por la sesión del
    // cliente que sigue activa (mismo patrón que los demás specs de este
    // directorio para cambiar de usuario).
    await Promise.all([
      page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
      page.evaluate(() => document.getElementById('btn-logout').click()).catch(() => {}),
    ]);
    await page.goto('/login.html');
    await page.fill('#usuario', 'analista@farmazed.test');
    await page.fill('#password', 'Farmazed123!');
    await enviarLogin(page, /admin\/bandeja\.html/, 15000);
    await expect(page.locator('#leads-card')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('E2E Registro Co')).toBeVisible();
  });
});

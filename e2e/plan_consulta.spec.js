// e2e/plan_consulta.spec.js — TAREA 34 (PM_COMMENTS §H.15). Flujo de alta
// completo del Plan Consulta: registro?plan=consulta -> verificación ->
// captación -> bienvenida de Consulta -> staff carga el Diagnóstico
// (admin/empresas.html) -> cliente lo ve -> "Contratar el registro" sube
// el plan a 'registro'. Incluye también el lead SIN cuenta del hero
// ("Enviar consulta") -> staff lo ve en bandeja -> "Invitar a crear cuenta".
//
// Mismo proveedor SIEMPRE mock (sin credenciales de PayPal en el entorno).
// NO se corrió todavía contra un emulador real — el host estaba en
// memoria crítica (swap 100%, load average >20) en el momento de escribir
// esto; ver handover.md. Escrito siguiendo los mismos patrones ya
// verificados en e2e/registro.spec.js y e2e/pago_paypal.spec.js
// (fzAuthPort, el helper de captación, dispatchEvent en vez de
// click/force por el sidebar fijo).
//
// Corre con: ./e2e/run.sh (NO — usa puertos fijos de la demo) o, en una
// instancia aislada, ver DEV_LOCAL.md "Probar algo sin tocar una demo que
// ya está corriendo".

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
  await fetch(codigo.oobLink);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}

async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
    page.evaluate(async () => { const { logout } = await import('/portal/js/auth.js'); await logout(); }).catch(() => {}),
  ]);
}

async function completarCaptacionSiHaceFalta(page) {
  let visible = false;
  try {
    await page.locator('#captacion-overlay:not(.d-none)').waitFor({ state: 'visible', timeout: 4000 });
    visible = true;
  } catch (e) { /* ya tenía captación */ }
  if (!visible) return;
  await page.evaluate(async () => {
    const api = (await import('/portal/js/api.js')).default;
    await api.saveCaptacion({
      paisYNombreFabricante: 'Alemania — Fabricante E2E', categoriasProducto: ['medicamentos'],
      numeroProductosPorCategoria: '1', registroPrevioAutoridadReconocida: true,
      clienteNuevoOYaRegistrado: 'nuevo', productoConModificacionEnCurso: false,
    });
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

test.describe('TAREA 34 — Plan Consulta (diagnóstico) + lead del hero', () => {
  test.beforeEach(async ({ page }) => {
    // Un solo listener global para TODOS los diálogos del archivo — un
    // segundo listener puntual (page.once) sobre el mismo evento revienta
    // con "Cannot accept dialog which is already handled" porque este ya
    // lo resolvió primero. El único prompt() de este archivo es "Nombre
    // de la empresa" (invitar lead) — ahí hace falta un VALOR, no solo
    // aceptar vacío.
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'E2E Hero Co Oficial' : undefined));
    page.on('pageerror', (err) => console.log('  [pageerror]', err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') console.log('  [console.error]', msg.text()); });
    const authPort = AUTH_PORT;
    await page.addInitScript(({ apiPort, authPort }) => {
      try {
        window.localStorage.setItem('fzApiPort', apiPort);
        window.localStorage.setItem('fzAuthPort', authPort);
      } catch (e) { /* noop */ }
    }, { apiPort: API_PORT, authPort });
  });

  test('registro?plan=consulta -> diagnóstico cargado por staff -> cliente lo ve -> Contratar el registro', async ({ page }) => {
    test.setTimeout(60000);
    const correo = `e2e-consulta-${Date.now()}@farmazed.test`;
    const empresaNombre = `E2E Consulta Co ${Date.now()}`;
    const password = 'Farmazed123!';

    // ── 1) Registro con plan=consulta ──
    await page.goto('/registro.html?plan=consulta');
    await page.fill('#r-nombre', 'E2E Consulta Test');
    await page.fill('#r-correo', correo);
    await page.fill('#r-password', password);
    await page.fill('#r-password-confirm', password);
    await page.fill('#r-telefono', '+507 6000-1234');
    await page.fill('#r-empresa', empresaNombre);
    await page.fill('#r-pais', 'Panamá');
    await page.click('#btn-submit');
    await expect(page.locator('#done-msg')).toBeVisible({ timeout: 10000 });

    // ── 2) Verificar correo ──
    // El reload de Firebase al restaurar la sesión a veces YA trae
    // `emailVerified` fresco del servidor (no siempre pasa por
    // verificar-correo.html; la mecánica exacta del gate ya la prueba
    // registro.spec.js, acá solo hace falta terminar logueado) — se
    // acepta cualquiera de los dos destinos.
    await confirmarCorreo(correo, password);
    await page.goto('/login.html');
    await page.waitForURL(/(verificar-correo|client-dashboard)\.html/, { timeout: 10000 });
    if (/verificar-correo\.html/.test(page.url())) {
      await page.click('#btn-continuar');
      await page.waitForURL(/client-dashboard\.html/, { timeout: 10000 });
    }

    // ── 3) Captación (primer ingreso) ──
    await completarCaptacionSiHaceFalta(page);

    // ── 4) Bienvenida de Plan Consulta + nav "Diagnóstico" visible ──
    // #bienvenida-text, no getByText a nivel de página — el prototipo del
    // módulo Resumen YA tiene texto estático con "diagnóstico regulatorio"
    // en otro lado (violación de strict mode si se busca en toda la página).
    await expect(page.locator('#bienvenida-text')).toContainText('diagnóstico regulatorio', { timeout: 10000 });
    await expect(page.locator('#nav-diagnostico-item')).toBeVisible();
    await page.locator('a.nav-link', { hasText: 'Diagnóstico' }).dispatchEvent('click');
    // #diagnostico-content, no getByText a nivel de página — la bienvenida
    // de arriba TAMBIÉN empieza con "Farmazed está preparando tu
    // diagnóstico" (solo cambia cómo sigue), violación de strict mode si
    // se busca en toda la página.
    await expect(page.locator('#diagnostico-content')).toContainText('Farmazed está preparando tu diagnóstico', { timeout: 10000 });
    await logout(page);

    // ── 5) Staff carga el diagnóstico desde admin/empresas.html ──
    // TAREA 35: admin/empresas.html ya NO es admin-only — analista (como
    // cualquier staff) entra por su propio permiso real (orgs.list +
    // orgs.edit_diagnostico), no por ser admin.
    await login(page, 'analista@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/empresas.html');
    const fila = page.locator('#orgs-list > div', { hasText: empresaNombre });
    await expect(fila).toBeVisible({ timeout: 10000 });
    await fila.getByText('Cargar diagnóstico').click();
    await fila.locator('input[name="clasificacion"]').fill('Medicamento de síntesis química');
    await fila.locator('input[name="rutaRecomendada"]').fill('Registro Regular');
    await fila.locator('input[name="requisitosAplicables"]').fill('Dossier técnico completo, IEA');
    await fila.locator('input[name="estimadoTiempos"]').fill('6-9 meses');
    await fila.locator('input[name="estimadoCostos"]').fill('~B/.4,130 (honorarios + tasas)');
    // Ver la misma carrera documentada en plan_empresarial.spec.js: el
    // submit guarda vía API y RECIÉN AL TERMINAR hace alert('Diagnóstico
    // guardado.') — armar el esperador del diálogo ANTES del click, en
    // paralelo, para no seguir a logout() antes de que el alert dispare.
    await Promise.all([
      page.waitForEvent('dialog'),
      fila.locator('button[type="submit"]').click(),
    ]);
    await logout(page);

    // ── 6) El cliente ve el diagnóstico y lo contrata ──
    await login(page, correo, password);
    await page.waitForFunction(() => window.__fzMyRole, null, { timeout: 10000 }); // rol cargado antes de usar el portal (el botón lo consulta)
    await page.locator('a.nav-link', { hasText: 'Diagnóstico' }).dispatchEvent('click');
    await expect(page.getByText('Medicamento de síntesis química')).toBeVisible({ timeout: 10000 });
    // TAREA 26 (mismo patrón ya usado en el resto de los specs): el
    // waiter se arma ANTES del dispatch y se corre en paralelo con él, no
    // después. Acá hace falta además 'load' en vez de waitForURL: el botón
    // hace window.location.reload() de la MISMA url (sigue en
    // client-dashboard.html) — waitForURL con ese mismo regex resuelve de
    // inmediato porque la url actual YA calza, sin esperar el reload real,
    // y el evaluate() de abajo caía en medio de la navegación real
    // ("Execution context was destroyed"). 'load' sí espera el próximo
    // evento real, armado antes de que ocurra.
    await Promise.all([
      page.waitForEvent('load', { timeout: 10000 }),
      page.locator('#btn-contratar-registro').dispatchEvent('click'),
    ]);

    const org = await page.evaluate(async () => {
      const api = (await import('/portal/js/api.js')).default;
      return (await api.getMyOrg()).plan;
    });
    expect(org).toBe('registro');
  });

  test('lead sin cuenta ("Enviar consulta" del hero) -> staff lo ve en bandeja -> invitar a crear cuenta', async ({ page }) => {
    const correo = `e2e-hero-${Date.now()}@farmazed.test`;

    // ── 1) El formulario del hero, público, sin login ──
    await page.goto('/index.html');
    await page.fill('#nombre', 'E2E Hero Lead');
    await page.fill('#empresa', 'E2E Hero Co');
    await page.fill('#email', correo);
    await page.fill('#tipo', 'Cosmético');
    await page.click('#submit_contact2');
    await expect(page.locator('#msg2')).toContainText('Consulta enviada', { timeout: 10000 });

    // ── 2) Staff lo ve, admin lo invita (crear empresa+invitación es
    // admin-only, invitations.create_org — igual que el resto de altas
    // manuales; la separación analista-ve/admin-invita YA la prueba
    // planes_y_leads.test.js a nivel de permisos, acá solo hace
    // falta que la UI funcione de punta a punta) ──
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/bandeja.html');
    await expect(page.locator('#contact-leads-card')).toBeVisible({ timeout: 10000 });
    const fila = page.locator('#contact-leads-list > div', { hasText: correo });
    await expect(fila).toBeVisible();

    await fila.getByText('Invitar a crear cuenta').click();
    await expect(fila).toBeHidden({ timeout: 10000 });
  });
});

// e2e/quotes.spec.js — R5/R12 (TAREA 18, PM_COMMENTS líneas 50, 57, 78, 447):
// cotización que agrupa N casos de la MISMA empresa (R5), con borrador
// automático (R12) al pasar un caso de fase_03 a fase_04. Usa los 3 casos
// dedicados de org Alfa `case-quote-test-1/2/3` (seed_roles.js, ya en
// fase_03) — no comparte fixtures con ningún otro spec.
//
// Corre con: ./e2e/run.sh quotes.spec.js (o ./e2e/run.sh para todos)

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-30');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-cotizacion-${name}.png`);
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

// TAREA 26: waitForURL en paralelo con el evaluate (no después) — si se
// espera a que evaluate() resuelva antes de armar waitForURL, la navegación
// que dispara logout() (window.location.href, dentro de auth.js) a veces
// destruye el execution context primero ("Execution context was destroyed" /
// "net::ERR_ABORTED" / "dialog.accept: Not attached to an active page" en el
// login() siguiente) — se ignora el rechazo de evaluate(), lo que importa es
// que la navegación de verdad ocurrió.
async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000 }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

async function getCase(page, caseId) {
  return page.evaluate(async (id) => {
    const api = (await import('/portal/js/api.js')).default;
    return api.getCase(id);
  }, caseId);
}

const CASOS = ['case-quote-test-1', 'case-quote-test-2', 'case-quote-test-3'];
const CASE_CODES = {
  'case-quote-test-1': 'FZ-MED-ABR-2026-0085',
  'case-quote-test-2': 'FZ-MED-REG-2026-0086',
  'case-quote-test-3': 'FZ-MED-ABR-2026-0087',
};

// A diferencia de otros specs (que quedan en la MISMA página y reintentan
// advance() varias veces), este spec navega a una página DISTINTA por cada
// caso en el mismo loop — más expuesto a la carrera entre el alert()
// bloqueante de expediente.html (ver btn-save-status, que hace alert() ANTES
// de refrescar caseData) y el siguiente page.goto(): si el diálogo no
// terminó de resolverse del todo, la navegación al caso siguiente puede
// abortar (net::ERR_ABORTED — visto 3 veces corriendo la suite completa,
// nunca corriendo este spec solo). `guardarEstado()` centraliza el
// select+click+espera y dejo un margen después del alert antes de navegar.
async function guardarEstado(page, to) {
  await page.selectOption('#status-select', to);
  await page.click('#btn-save-status');
  await expect(page.locator('#status-select')).toHaveValue(to, { timeout: 10000 });
  await page.waitForTimeout(300); // deja asentar el diálogo antes del próximo goto()
}

test.describe('R5/R12 — cotización agrupa 3 casos de una empresa', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('borrador automático (3 líneas) -> ajuste con motivo -> envío -> aceptación -> cada caso a fase_05 con su caseCode', async ({ page }) => {
    test.setTimeout(120000);

    // ═══ 1. Admin pasa los 3 casos de fase_03 a fase_04 — dispara R12 ═══
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    for (const caseId of CASOS) {
      await page.goto(`/admin/expediente.html?id=${caseId}`);
      await expect(page.locator('#status-select')).toHaveValue('fase_03', { timeout: 10000 });
      await guardarEstado(page, 'fase_04');
    }
    await shot(page, '00-3-casos-en-fase04');

    // ═══ 2. El admin ve el borrador con las 3 líneas agrupadas de la MISMA empresa ═══
    await page.goto('/admin/cotizaciones.html');
    const card = page.locator('.quote-card', { hasText: 'Laboratorios Alfa' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.locator('.linea-row')).toHaveCount(3);
    await expect(card).toContainText('borrador');
    await shot(page, '01-admin-borrador-3-lineas');

    // Ajustar la línea de case-quote-test-1 sin motivo: rechazado (alert, ya
    // auto-aceptado por page.on('dialog')) — el valor vuelve a su original
    // al recargar, así que se verifica releyendo la cotización.
    const linea1 = card.locator('.linea-row[data-case="case-quote-test-1"]');
    await linea1.locator('.inp-honorarios').fill('1300');
    await linea1.locator('.btn-guardar-linea').click();
    await page.waitForTimeout(500); // el alert de error no navega — deja tiempo al dialog handler
    await page.reload();
    const linea1b = page.locator('.quote-card', { hasText: 'Laboratorios Alfa' }).locator('.linea-row[data-case="case-quote-test-1"]');
    await expect(linea1b.locator('.inp-honorarios')).toHaveValue('2055', { timeout: 10000 }); // sin cambio — el ajuste sin motivo no se aplicó

    // Con motivo: sí se aplica.
    await linea1b.locator('.inp-honorarios').fill('1300');
    await linea1b.locator('.inp-motivo').fill('Ajuste comercial acordado con el cliente');
    await linea1b.locator('.btn-guardar-linea').click();
    await expect(page.locator('.quote-card', { hasText: 'Laboratorios Alfa' })).toContainText('Ajustado', { timeout: 10000 });
    await shot(page, '02-admin-ajuste-con-motivo');

    // ═══ 3. Enviar la cotización ═══
    await page.locator('.quote-card', { hasText: 'Laboratorios Alfa' }).locator('.btn-enviar').click();
    await expect(page.locator('.quote-card', { hasText: 'Laboratorios Alfa' })).toContainText('enviada', { timeout: 10000 });
    await shot(page, '03-admin-cotizacion-enviada');

    await logout(page);

    // ═══ 4. El cliente titular la ve con el desglose y la acepta ═══
    await login(page, 'titular-alfa@farmazed.test', 'Farmazed123!');
    await page.locator('a.nav-link', { hasText: 'Cotización' }).click();
    // El sidebar se expande al pasar el mouse por el nav-link (overlay, no
    // empuja el contenido) — alejar el mouse antes de seguir, si no, el
    // siguiente click puede caer sobre el sidebar todavía expandido (bug de
    // interacción encontrado en esta tarea, no del layout: el contenido está
    // bien posicionado una vez el sidebar vuelve a su ancho colapsado).
    await page.mouse.move(700, 400);
    await expect(page.locator('#cotizacion-content')).toContainText('Pendiente de tu respuesta', { timeout: 10000 });
    await expect(page.locator('#cotizacion-content')).toContainText('Honorarios Farmazed');
    await expect(page.locator('#cotizacion-content')).toContainText('Tasas oficiales');
    await shot(page, '04-cliente-ve-cotizacion-desglose');

    await page.locator('.btn-aceptar-cot').click();
    await expect(page.locator('#cotizacion-content')).toContainText('Aceptada', { timeout: 10000 });
    await shot(page, '05-cliente-acepta-cotizacion');

    await logout(page);

    // ═══ 5. Cada caso avanza de fase_04 a fase_05 SIN override, con su propio caseCode ═══
    await login(page, 'admin-e3@farmazed.test', 'Farmazed123!');
    for (const caseId of CASOS) {
      await page.goto(`/admin/expediente.html?id=${caseId}`);
      await guardarEstado(page, 'fase_05');
    }
    await shot(page, '06-3-casos-en-fase05');

    for (const caseId of CASOS) {
      const c = await getCase(page, caseId);
      expect(c.status).toBe('fase_05');
      expect(c.caseCode).toBe(CASE_CODES[caseId]);
    }
  });
});

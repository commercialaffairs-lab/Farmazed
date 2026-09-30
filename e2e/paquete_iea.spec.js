// e2e/paquete_iea.spec.js — R13 (organizacion/04 E3, TAREA 19): conteo de
// páginas del paquete IEA (formula, metodo_analisis, cert_analisis,
// especificaciones, etiquetas — ver tracker/data/paquete_iea.js). Límite
// 150 páginas, fuente F08-IEA-guia para usuarios IEA.docx y F10-Fase 10
// Se verifica la documentación con nuestras matrices guias.docx (ambos,
// independientemente: "No exceder en la documentación de 150 páginas").
// NUNCA bloquea — solo advierte.
//
// Corre con: ./e2e/run.sh paquete_iea.spec.js (o ./e2e/run.sh para todos)

const { test, expect } = require('@playwright/test');
const { PDFDocument }  = require('pdf-lib');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-30');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-iea-${name}.png`);
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

// TAREA 26: waitForURL en paralelo con el evaluate (no después) — la
// navegación que dispara logout() (window.location.href, dentro de auth.js)
// puede destruir el execution context de evaluate() antes de que resuelva
// ("Execution context was destroyed" / "net::ERR_ABORTED" / "dialog.accept:
// Not attached to an active page" en el login() siguiente) — se ignora el
// rechazo de evaluate(), lo que importa es que la navegación de verdad
// ocurrió.
async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000 }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

function docFile(nombre) {
  return { name: `${nombre}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 documento de prueba — ${nombre}`) };
}
async function realPdf(nombre, paginas) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage();
  return { name: `${nombre}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}

// Los 16 documentos obligatorios de 'cliente' para medicamentos + Síntesis
// Química (mismo subtipo que flujo_completo.spec.js/checklist.spec.js;
// 'especificaciones_pa' se agregó en TAREA 25/§H.9).
// 'formula' y 'especificaciones' llevan PDFs REALES con páginas contables
// (90 + 70 = 160 > 150); el resto son placeholders (page count null, no
// cuentan — mismo criterio que el resto de los specs de este directorio).
const CLIENTE_REQUIRED_IDS = [
  'poder', 'clv', 'bpm', 'formula', 'especificaciones', 'clave_lote',
  'estabilidad', 'proceso_fab', 'controles', 'monografia', 'disposicion',
  'patrones', 'etiquetas', 'muestra', 'metodo_analisis', 'especificaciones_pa',
];

test.describe('R13 — conteo de páginas del paquete IEA', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('el cliente ve la advertencia al subir el documento que hace exceder las 150 páginas; el admin ve el conteo en el expediente', async ({ page }) => {
    test.setTimeout(90000);
    const clientEmail = `iea.e2e.${Date.now()}@farmazed.test`;
    const clientPass  = 'Farmazed123!';

    await page.goto('/login.html');
    await page.evaluate(({ email, password }) => {
      import('/portal/js/auth.js').then(m => m.register(email, password, 'IEA E2E'));
    }, { email: clientEmail, password: clientPass });
    await page.waitForURL(/client-dashboard\.html/, { timeout: 15000 });

    await page.locator('a.nav-link', { hasText: 'Solicitar Registro' }).click();
    await page.click('button:has-text("Iniciar solicitud")');
    await page.locator('.tramite-card[data-id="medicamentos"]').click();
    await page.click('#btn-next');
    await expect(page.locator('#step-2')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('#tipo-med-checks input[type=checkbox]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('#tipo-med-checks input[value="Síntesis Química"]').check();
    await page.fill('#nombreComercial', 'Producto IEA E2E');
    await page.click('#btn-next');
    await expect(page.locator('#step-3')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-next');
    await expect(page.locator('#step-4')).toBeVisible({ timeout: 10000 });

    for (const docId of CLIENTE_REQUIRED_IDS) {
      const file = docId === 'formula'
        ? await realPdf(docId, 90)
        : docId === 'especificaciones'
          ? await realPdf(docId, 70)
          : docFile(docId);
      await page.locator(`#doc-${docId} input[type=file]`).setInputFiles(file);
      await expect(page.locator(`#doc-${docId}`)).toContainText('uploaded', { timeout: 10000 });

      if (docId === 'formula') {
        // 90 páginas solas — todavía NO excede las 150.
        await expect(page.locator('.toast', { hasText: 'IEA' })).toHaveCount(0);
      }
      if (docId === 'especificaciones') {
        // 90 + 70 = 160 — cruza el límite justo aquí.
        await expect(page.locator('.toast', { hasText: 'IEA' })).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.toast', { hasText: 'IEA' })).toContainText('160');
        await shot(page, '00-cliente-advertencia-al-subir');
      }
    }
    // R13: la advertencia NUNCA bloquea — el wizard sigue hasta el final con normalidad.
    await expect(page.locator('#btn-next')).toBeEnabled({ timeout: 10000 });

    const caseId = new URL(page.url()).searchParams.get('caseId');
    expect(caseId).toBeTruthy();

    // ═══ El admin ve el conteo en el expediente (nunca bloqueado) ═══
    await logout(page);
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${caseId}`);
    await expect(page.locator('#iea-banner')).toContainText('160 / 150', { timeout: 10000 });
    await expect(page.locator('#iea-banner .alert-warning')).toBeVisible();
    await shot(page, '01-admin-ve-conteo-excedido');
  });
});

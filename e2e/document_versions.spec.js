// e2e/document_versions.spec.js — TAREA 13 (ajuste de cumplimiento, 29-sep):
// reemplazar un documento en el mismo id NO puede perder la versión
// anterior — un documento rechazado y su reemplazo deben quedar trazables,
// y el archivo viejo NO se borra de Storage.
//
// Corre con: ./e2e/run.sh document_versions.spec.js (o ./e2e/run.sh para todos)
// Caso de prueba: test-doc-version (fase_07, sin documentos), lo deja listo
// e2e/global-setup.js en cada corrida.

const { test, expect } = require('@playwright/test');
const { enviarLogin } = require('./_esperas');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-29');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-versiones-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}

// TAREA 26 (esta suite flaqueaba con "Invalid or expired token" en el
// siguiente uploadAs()): el patrón viejo — `import(...).then(m =>
// m.logout())` sin esperar, y luego un waitForURL() aparte — deja el
// signOut()+redirect internos totalmente desacoplados de lo que el test
// espera: el login() siguiente puede arrancar (y hasta completar
// signInWithEmailAndPassword) antes de que el signOut() anterior haya
// terminado de asentarse en la persistencia local de Firebase, dejando un
// token viejo dando vueltas. Arreglo real: esperar la navegación real
// (waitForURL) EN PARALELO con el evaluate que dispara logout() — así el
// siguiente login() nunca arranca antes de que el logout() haya de verdad
// terminado.
async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

const CASE_ID = 'test-doc-version';

// Sube un archivo directo por api.js (no hace falta pasar por el wizard
// completo — lo que se prueba aquí es el versionado del backend, ya
// cubierto el mecanismo real de upload en checklist.spec.js/flujo_completo.spec.js).
async function uploadAs(page, { faddiDocId, faddiDocName, contenido, nombreArchivo }) {
  return page.evaluate(async ({ caseId, faddiDocId, faddiDocName, contenido, nombreArchivo }) => {
    const api  = (await import('/portal/js/api.js')).default;
    const file = new File([contenido], nombreArchivo, { type: 'application/pdf' });
    return api.uploadDocument(caseId, file, { faddiDocId, faddiCode: 'X', faddiDocName, faddiStep: 15 });
  }, { caseId: CASE_ID, faddiDocId, faddiDocName, contenido, nombreArchivo });
}

test.describe('TAREA 13 (ajuste) — versionado de documentos, no se pierde el anterior', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('rechazado -> re-subido: v1 queda archivada, el archivo viejo sigue accesible', async ({ page }) => {
    // ── 1. Cliente sube la v1 de "poder" ────────────────────────────────
    await login(page, 'cliente@farmazed.test', 'Farmazed123!');
    const v1 = await uploadAs(page, {
      faddiDocId: 'poder', faddiDocName: 'Poder Original',
      contenido: '%PDF-1.4 version 1 — original', nombreArchivo: 'poder-v1.pdf',
    });
    expect(v1.version).toBe(1);
    const v1DocId = v1.id;

    await logout(page);

    // ── 2. Admin lo rechaza con motivo (sin UI propia — llama al mismo
    // endpoint que usaría un botón "Rechazar" si existiera) ──────────────
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${CASE_ID}`);
    const docItem = page.locator('.doc-item', { hasText: 'Poder Original' });
    await expect(docItem.getByText('Ver', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(docItem.getByText(/v\d+ · ver versiones/)).toHaveCount(0); // v1, sin badge todavía
    await shot(page, '00-v1-sin-badge');

    const motivo = 'Falta la firma del representante legal en la última página.';
    await page.evaluate(async ({ caseId, docId, motivo }) => {
      const api = (await import('/portal/js/api.js')).default;
      await api.updateDocument(caseId, docId, { status: 'rejected', reviewNotes: motivo });
    }, { caseId: CASE_ID, docId: v1DocId, motivo });

    await logout(page);

    // ── 3. Cliente re-sube el mismo faddiDocId (v2) ─────────────────────
    await login(page, 'cliente@farmazed.test', 'Farmazed123!');
    const v2 = await uploadAs(page, {
      faddiDocId: 'poder', faddiDocName: 'Poder Original',
      contenido: '%PDF-1.4 version 2 — corregido, con firma', nombreArchivo: 'poder-v2.pdf',
    });
    expect(v2.version).toBe(2);
    expect(v2.id).toBe(v1DocId); // mismo doc — se reemplaza en el mismo id, no crea uno nuevo
    expect(v2.status).toBe('uploaded'); // vuelve a 'uploaded', no se queda en 'rejected'

    await logout(page);

    // ── 4. Admin ve "v2 · ver versiones anteriores" y la versión vieja,
    // con su motivo de rechazo y un link al archivo QUE SIGUE existiendo ──
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${CASE_ID}`);
    const docItem2 = page.locator('.doc-item', { hasText: 'Poder Original' });
    const versionBadge = docItem2.getByText(/v2 · ver versiones/);
    await expect(versionBadge).toBeVisible({ timeout: 10000 });
    await shot(page, '01-v2-con-badge');

    await versionBadge.click();
    await expect(page.locator('#versionsModal')).toBeVisible({ timeout: 5000 });
    const modal = page.locator('#versionsModal');
    await expect(modal).toContainText('v1');
    await expect(modal).toContainText('rejected');
    await expect(modal).toContainText(motivo);
    await shot(page, '02-modal-version-anterior');

    // El link de la versión archivada apunta a un archivo que SIGUE
    // existiendo en Storage — no se borró al reemplazarlo.
    const oldFileHref = await modal.locator('a:has-text("Ver archivo")').getAttribute('href');
    expect(oldFileHref).toBeTruthy();
    const oldFileRes = await page.request.get(oldFileHref);
    expect(oldFileRes.ok()).toBeTruthy();
    const oldFileBody = await oldFileRes.text();
    expect(oldFileBody).toContain('version 1'); // el contenido viejo, intacto

    // El documento VIGENTE es la v2, no la v1 — mismo criterio que arriba
    // (fetch directo del signedUrl, no un popup de un PDF falso que
    // Chromium intenta renderizar como visor de PDF real).
    await page.locator('button:has-text("Cerrar")').first().click();
    await expect(page.locator('#versionsModal')).toBeHidden();
    const currentDoc = await page.evaluate(async ({ caseId, docId }) => {
      const api = (await import('/portal/js/api.js')).default;
      return api.getDocument(caseId, docId);
    }, { caseId: CASE_ID, docId: v1DocId });
    expect(currentDoc.version).toBe(2);
    const currentRes = await page.request.get(currentDoc.signedUrl);
    expect(currentRes.ok()).toBeTruthy();
    expect(await currentRes.text()).toContain('version 2');
  });
});

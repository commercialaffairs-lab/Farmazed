// e2e/checklist.spec.js — D10 (campo `responsable`) + D11 (UI que separa
// documentos del cliente vs. de Farmazed y no bloquea por los de Farmazed) +
// TAREA 10(a) (fix de renderStep2() en avance normal). SOLO contra el
// emulador. Corre con: ./e2e/run.sh checklist.spec.js
//
// La pantalla real de carga documental es el wizard embebido en
// client-dashboard.html (módulo "Solicitar Registro"), que carga
// portal/js/wizard.js como <script type="module"> — confirmado con grep
// antes de escribir este spec (ver handover.md, TAREA 9): wizard.js está
// vivo, no huérfano.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-29');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-checklist-${name}.png`);
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
      const { logout } = await import('./portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

// Con tipoMedicamento=['Síntesis Química'] (ver getChecklist en
// faddi_checklists.js): 16 obligatorios 'cliente' (los 13 de siempre +
// 'muestra' y 'metodo_analisis', que SOLO aparecen por este subtipo, + la
// TAREA 25 'especificaciones_pa' — distinta de 'especificaciones', que es
// del producto terminado) + 3 'farmazed' (tasa_servicio, recibo_cnf,
// recibo_iea — este último ya NO depende del subtipo, TAREA 25/§H.9:
// depende de aplicaIEA de la cotización ACEPTADA; este caso no tiene
// cotización todavía, así que aparece "por confirmar"/opcional, pero sigue
// contando como doc de Farmazed igual — el gate de #btn-next nunca depende
// de los docs de Farmazed, obligatorios u opcionales).
const CLIENTE_REQUIRED_IDS = [
  'poder', 'clv', 'bpm', 'formula', 'especificaciones', 'clave_lote',
  'estabilidad', 'proceso_fab', 'controles', 'monografia', 'disposicion',
  'patrones', 'etiquetas', 'muestra', 'metodo_analisis', 'especificaciones_pa',
];

test.describe('D10/D11 — responsable del documento (TAREA 9/10)', () => {
  let caseId;

  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('recorrido 1->2->3->4 en línea recta: checklist corresponde al subtipo, Farmazed no bloquea, admin ve tarea interna', async ({ page }) => {
    // ── 1. Cliente inicia un caso nuevo de medicamentos ─────────────────
    await login(page, 'cliente@farmazed.test', 'Farmazed123!');
    await page.locator('a.nav-link', { hasText: 'Solicitar Registro' }).click();
    await page.click('button:has-text("Iniciar solicitud")'); // toggleWizard() — revela #wizard-form
    await page.locator('.tramite-card[data-id="medicamentos"]').click();
    await page.click('#btn-next');
    await expect(page.locator('#step-2')).toBeVisible({ timeout: 10000 }); // createCase() ya resolvió

    // ── TAREA 10(a): las casillas de tipoMedicamento SÍ se pueblan al
    // avanzar en línea recta (antes de este fix, #tipo-med-checks quedaba
    // vacío la primera vez que se llegaba acá avanzando — solo se
    // rellenaba si el cliente retrocedía y volvía a avanzar). ──────────
    const checks = page.locator('#tipo-med-checks input[type=checkbox]');
    await expect(checks.first()).toBeVisible({ timeout: 10000 });
    expect(await checks.count()).toBeGreaterThan(0);
    await shot(page, '00-paso2-casillas-pobladas');

    await page.locator('#tipo-med-checks input[value="Síntesis Química"]').check();
    await page.click('#btn-next');
    await expect(page.locator('#step-3')).toBeVisible({ timeout: 10000 });

    // Paso 3: sin datos de entidades, solo avanzar.
    await page.click('#btn-next');
    await expect(page.locator('#step-4')).toBeVisible({ timeout: 10000 });

    // ── 2. Paso 4: el checklist corresponde al subtipo elegido ──────────
    // 'muestra'/'metodo_analisis' (cliente) SOLO existen en el checklist por
    // haber marcado "Síntesis Química" — si el checklist mostrado fuera el
    // genérico (bug de antes), no aparecerían. 'recibo_iea' (Farmazed) ya no
    // depende del subtipo (TAREA 25/§H.9) — aparece siempre, aquí "por
    // confirmar" porque el caso no tiene cotización aceptada todavía.
    await expect(page.getByText('Documentos que subes tú')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Documentos que aporta Farmazed')).toBeVisible();
    await expect(page.locator('#doc-muestra')).toBeVisible();
    await expect(page.locator('#doc-metodo_analisis')).toBeVisible();
    await expect(page.locator('#doc-recibo_iea')).toBeVisible();

    // Las 3 docs de Farmazed (tasa_servicio, recibo_cnf, recibo_iea) sin botón "Subir".
    const farmazedSection = page.locator('div.doc-group', { hasText: 'Documentos que aporta Farmazed' });
    await expect(farmazedSection.locator('button:has-text("Subir")')).toHaveCount(0);
    await expect(farmazedSection.getByText('A cargo de Farmazed')).toHaveCount(3);
    await expect(page.locator('#btn-next')).toBeDisabled();
    await shot(page, '01-bloqueado-faltan-docs-cliente');

    // Capturar el caseId real para usarlo en el resto del spec (admin).
    caseId = new URL(page.url()).searchParams.get('caseId');
    expect(caseId).toBeTruthy();

    // ── 3. Subir 2 documentos reales via UI (prueba el upload real) ─────
    const tinyFile = { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') };
    for (const docId of ['poder', 'clv']) {
      await page.locator(`#doc-${docId} input[type=file]`).setInputFiles(tinyFile);
      await expect(page.locator(`#doc-${docId}`)).toContainText('uploaded', { timeout: 10000 });
    }
    await expect(page.locator('#btn-next')).toBeDisabled(); // aún faltan los otros 13

    // ── 4. Completar el resto de los docs del cliente directo en Firestore
    // (más rápido que 13 uploads reales por UI — el mecanismo de upload ya
    // se probó con los 2 de arriba; lo que falta probar aquí es que el
    // botón reacciona igual sin importar cómo se subieron los documentos).
    const admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });
    const db  = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const restantes = CLIENTE_REQUIRED_IDS.filter(id => id !== 'poder' && id !== 'clv');
    const batch = db.batch();
    for (const id of restantes) {
      const ref = db.collection('cases').doc(caseId).collection('documents').doc();
      batch.set(ref, {
        faddiDocId: id, faddiCode: id, faddiDocName: id, faddiStep: 15,
        fileName: `${id}.pdf`, fileSize: 100, mimeType: 'application/pdf',
        storagePath: `cases/${caseId}/${id}.pdf`, status: 'uploaded',
        reviewNotes: '', reviewedBy: null, reviewedAt: null,
        uploadedAt: now, uploadedBy: 'seed-client-uid',
      });
    }
    await batch.commit();

    // ── 5. Refrescar el checklist (sin recargar toda la pagina) y verificar
    // que el boton se habilita — los 3 docs de Farmazed siguen sin subir.
    await page.reload();
    // wizard.js init() retoma state.caseId/tramiteType/tipoMedicamento desde
    // ?caseId= en la URL (seteado por history.replaceState en el paso 1
    // original) — no crea un caso nuevo, solo actualiza el existente.
    await page.locator('a.nav-link', { hasText: 'Solicitar Registro' }).click();
    await page.click('button:has-text("Iniciar solicitud")');
    await page.locator('.tramite-card[data-id="medicamentos"]').click();
    await page.click('#btn-next');
    await expect(page.locator('#step-2')).toBeVisible({ timeout: 10000 });
    // La casilla ya viene marcada (resumida desde el caso) — no hace falta
    // volver a marcarla.
    await expect(page.locator('#tipo-med-checks input[value="Síntesis Química"]')).toBeChecked();
    await page.click('#btn-next'); // paso 2 -> 3
    await expect(page.locator('#step-3')).toBeVisible({ timeout: 10000 });
    await page.click('#btn-next'); // paso 3 -> 4
    await expect(page.locator('#step-4')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('#btn-next')).toBeEnabled({ timeout: 10000 });
    await expect(farmazedSection.getByText('A cargo de Farmazed')).toHaveCount(3); // siguen sin subir, y no importa
    await shot(page, '02-habilitado-solo-faltan-farmazed');

    // ── 6. Admin: los mismos 3 documentos aparecen como tarea interna ───
    // Logout real del cliente. El botón vive en un dropdown de Bootstrap
    // (el toggle no es fiable en headless) — se llama logout() del módulo
    // directo, que es exactamente lo que hace el click real (signOut +
    // redirect a login.html).
    await logout(page);

    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${caseId}`);
    await expect(page.getByText('Tarea interna Farmazed').first()).toBeVisible({ timeout: 10000 });
    expect(await page.getByText('Tarea interna Farmazed').count()).toBe(3);
    expect(await page.getByText('Pendiente (interno)').count()).toBe(3);
    // Ninguno de los 3 docs marcados como tarea interna tiene botón
    // "Solicitar" (pedirle al cliente algo que es trabajo de Farmazed no
    // tendría sentido) — los docs opcionales del cliente sin subir sí
    // pueden seguir teniendo su "Solicitar" propio, eso no cambia con D11.
    const farmazedItems = page.locator('.doc-item', { hasText: 'Tarea interna Farmazed' });
    await expect(farmazedItems).toHaveCount(3);
    await expect(farmazedItems.locator('button:has-text("Solicitar")')).toHaveCount(0);
    await shot(page, '03-admin-tarea-interna');
  });
});

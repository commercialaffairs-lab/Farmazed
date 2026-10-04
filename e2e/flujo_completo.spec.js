// e2e/flujo_completo.spec.js — TAREA 12 (D16, cierre de E2): recorrido
// end-to-end de un caso de medicamentos (Síntesis Química, vía Regular) de
// punta a punta, como lo viviría Zelky: cliente se registra, llena el
// wizard, sube sus documentos, y el admin lo mueve por las 13 fases (§H.8,
// TAREA 21) + aprobación, con los 2 pagos del cliente (anticipo/saldo), las
// dos confirmaciones de fase_08 (legal + técnica/matrices), una subsanación
// real (10->09->10), un ciclo de observado_dnfd, y una solicitud de
// documento adicional (pending_docs) en medio del camino. El cliente entra
// 3 veces a verificar lo que ve.
//
// Corre con: ./e2e/run.sh flujo_completo.spec.js (o ./e2e/run.sh para todos)
// SOLO EMULADOR. No comparte casos con otros specs — el cliente se registra
// de cero (email único por corrida) para no interferir con cliente@farmazed.test.
//
// Ver organizacion/08_PRUEBA_E2E_E2.md para qué se probó, qué bugs se
// encontraron/arreglaron, y qué queda fuera (depende de prod o de Zelky).

const { test, expect } = require('@playwright/test');
const { enviarLogin, completarCaptacionSiHaceFalta } = require('./_esperas');
const path = require('path');
const fs   = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'sessions', '2026-09-29');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotIndex = 0;
async function shot(page, name) {
  shotIndex += 1;
  const file = path.join(SHOT_DIR, `${String(shotIndex).padStart(2, '0')}-flujo-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${path.basename(file)}`);
}

async function login(page, email, password) {
  await page.goto('/login.html');
  await page.fill('#usuario', email);
  await page.fill('#password', password);
  await enviarLogin(page, /(dashboard|client-dashboard|admin\/casos|admin\/bandeja)\.html/, 15000);
}

// TAREA 26 (raíz del flake documentado muchas veces en esta sesión, con
// distintos síntomas: "Execution context was destroyed", "net::ERR_ABORTED",
// "dialog.accept: Not attached to an active page"): logout() hace
// signOut()+`window.location.href` DENTRO del bloque que evaluate() ejecuta
// en la página — si se espera a que evaluate() resuelva ANTES de armar
// waitForURL, la navegación que el propio logout() dispara a veces destruye
// el execution context de evaluate() primero, y esa excepción se propaga
// como si la navegación hubiera fallado (cuando en realidad sí ocurrió, y el
// login() siguiente hereda la carrera). Arreglo real, no retry ni timeout
// más largo: armar waitForURL ANTES de disparar el evaluate, en paralelo
// (Promise.all), e ignorar el rechazo de evaluate() — lo único que importa
// es que la navegación de verdad ocurrió.
async function logout(page) {
  await Promise.all([
    page.waitForURL(/login\.html/, { timeout: 10000, waitUntil: 'commit' }),
    page.evaluate(async () => {
      const { logout } = await import('/portal/js/auth.js');
      await logout();
    }).catch(() => {}),
  ]);
}

function comprobante(nombre) {
  return { name: nombre, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 comprobante D16 — ${nombre}`) };
}
function docFile(nombre) {
  return { name: `${nombre}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 documento D16 — ${nombre}`) };
}

// Los 16 documentos obligatorios de 'cliente' para medicamentos + Síntesis
// Química (mismo subtipo y misma lista que e2e/checklist.spec.js — 'muestra'
// y 'metodo_analisis' solo existen por este subtipo; 'especificaciones_pa'
// se agregó en TAREA 25/§H.9, distinta de 'especificaciones' que es del
// producto terminado).
const CLIENTE_REQUIRED_IDS = [
  'poder', 'clv', 'bpm', 'formula', 'especificaciones', 'clave_lote',
  'estabilidad', 'proceso_fab', 'controles', 'monografia', 'disposicion',
  'patrones', 'etiquetas', 'muestra', 'metodo_analisis', 'especificaciones_pa',
];

test.describe('D16 — flujo completo E2E (medicamentos, Síntesis Química, Regular)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', d => d.accept());
    page.on('console', m => { if (m.type() === 'error') console.log('PAGE CONSOLE ERROR:', m.text()); });
    const apiPort = process.env.FZ_API_PORT || '8080';
    await page.addInitScript((port) => {
      try { window.localStorage.setItem('fzApiPort', port); } catch (e) { /* noop */ }
    }, apiPort);
  });

  test('registro -> wizard -> 13 fases + pagos + subsanación + pendiente -> aprobado', async ({ page }) => {
    test.setTimeout(180000);
    const clientEmail = `zelky.e2e.${Date.now()}@farmazed.test`;
    const clientPass  = 'Farmazed123!';
    let caseId;

    // ═══ 1. Cliente entra por invitación — el modelo REAL (PM_COMMENTS
    // §H.4: alta por invitación, sin registro abierto; TAREA 18 §H.7 pidió
    // corregir este spec porque `register()` directo deja `orgId: null`, un
    // estado que ya no representa el alta real de un cliente). El admin
    // invita al titular (crea la empresa), el titular acepta con su propio
    // password y entra ya con orgId — mismo recorrido que
    // roles.spec.js "invitación -> aceptar -> login". ═══
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto('/admin/empresas.html');
    await page.fill('#titular-email', clientEmail);
    await page.fill('#titular-org', 'Zelky E2E Labs');
    await page.click('#form-invitar-titular button[type="submit"]');

    const row = page.locator('#invitations-tbody tr', { hasText: clientEmail });
    await expect(row).toBeVisible({ timeout: 10000 });
    const linkText = (await row.locator('td').last().textContent() || '').trim();
    const token = linkText.split('token=')[1];
    expect(token).toBeTruthy();

    await logout(page);

    await page.goto(`/aceptar-invitacion.html?token=${token}`);
    await expect(page.locator('#accept-form')).toBeVisible({ timeout: 10000 });
    await page.fill('#display-name', 'Zelky E2E');
    await page.fill('#password', clientPass);
    await page.fill('#password-confirm', clientPass);
    await page.click('#btn-submit');
    await page.waitForURL(/client-dashboard\.html/, { timeout: 15000 });
    await completarCaptacionSiHaceFalta(page); // la empresa nueva (invitación) nace sin captación
    await expect(page.locator('a.nav-link', { hasText: 'Solicitar Registro' })).toBeVisible({ timeout: 15000 });
    await shot(page, '00-cliente-registrado');

    // ═══ 2. Wizard 1 -> 4: medicamentos, Síntesis Química, vía Regular ═══
    await page.locator('a.nav-link', { hasText: 'Solicitar Registro' }).click();
    await page.click('button:has-text("Iniciar solicitud")');
    await page.locator('.tramite-card[data-id="medicamentos"]').click();
    await shot(page, '01-wizard-paso1-medicamentos');
    await page.click('#btn-next');
    await expect(page.locator('#step-2')).toBeVisible({ timeout: 10000 });
    caseId = new URL(page.url()).searchParams.get('caseId');
    expect(caseId).toBeTruthy();

    await expect(page.locator('#tipo-med-checks input[type=checkbox]').first()).toBeVisible({ timeout: 10000 });
    await page.locator('#tipo-med-checks input[value="Síntesis Química"]').check();
    await page.fill('#nombreComercial', 'Analgen E2E Completo');
    await shot(page, '02-wizard-paso2-sintesis-quimica');
    await page.click('#btn-next');
    await expect(page.locator('#step-3')).toBeVisible({ timeout: 10000 });

    await shot(page, '03-wizard-paso3-entidades');
    await page.click('#btn-next'); // sin datos de entidades — ya probado en checklist.spec.js
    await expect(page.locator('#step-4')).toBeVisible({ timeout: 10000 });

    // ═══ 3. Sube los 15 documentos obligatorios (reales, uno por uno) ═══
    for (const docId of CLIENTE_REQUIRED_IDS) {
      await page.locator(`#doc-${docId} input[type=file]`).setInputFiles(docFile(docId));
      await expect(page.locator(`#doc-${docId}`)).toContainText('uploaded', { timeout: 10000 });
    }
    await expect(page.locator('#btn-next')).toBeEnabled({ timeout: 10000 });
    await shot(page, '04-wizard-paso4-15-docs-subidos');

    await page.click('#btn-next');
    await expect(page.locator('#step-5')).toBeVisible({ timeout: 10000 });
    // Bug encontrado y arreglado en esta tarea (ver handover.md): antes de
    // renderConfirmation() no distinguir por responsable, un cliente con los
    // 15 documentos suyos ya subidos veía "faltantes (3)" listando los 3
    // documentos que son tarea interna de Farmazed — alarmante y falso.
    await expect(page.locator('#confirm-missing')).toContainText('Todos los documentos obligatorios están subidos', { timeout: 10000 });
    await shot(page, '05-wizard-paso5-confirmacion');
    await page.click('#btn-next'); // envía — status: 'submitted'
    // Bug encontrado y arreglado (ver handover.md): tras enviar, wizard.js
    // recarga la página entera para traer datos frescos — antes, el modo
    // embebido solo cambiaba de módulo sin recargar y el caso nuevo quedaba
    // invisible en "Mis Productos" hasta un refresh manual.
    await page.waitForURL(/client-dashboard\.html/, { timeout: 10000 });
    await expect(page.locator('a.nav-link', { hasText: 'Mis Productos' })).toBeVisible({ timeout: 10000 });

    // ═══ CLIENTE CHECK #1 — recién enviado, sin pagos ═══
    // Tras la recarga, la carga real de datos (15 documentos + pagos) es
    // asíncrona — se espera a que window.DATA.productos deje de estar vacío
    // antes de navegar a "Mis Productos" (si no, se ve el placeholder
    // "Aún no tienes productos" de una foto tomada demasiado pronto).
    await page.waitForFunction(() => (window.DATA?.productos?.length ?? 0) > 0, { timeout: 15000 });
    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    const productCard = page.locator('.fz-product-card', { hasText: 'Analgen E2E Completo' });
    await expect(productCard).toBeVisible({ timeout: 10000 });
    await productCard.locator('.fz-prod-header').click();
    await expect(productCard).toContainText('Enviado');
    await expect(productCard.locator('.badge', { hasText: 'Pendiente' })).toHaveCount(3); // honorarios, tasa_dnfd, saldo — ninguno pagado aún (mef/iea no aplican sin cotización aceptada)
    await page.mouse.move(700, 400);
    await shot(page, '06-cliente-check1-enviado-sin-pagos');

    await logout(page);

    // ═══ 4. Admin mueve el caso: submitted -> fase_01..04 ═══
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${caseId}`);
    await expect(page.locator('#status-select')).toHaveValue('submitted', { timeout: 10000 });

    async function advance(to) {
      await page.selectOption('#status-select', to);
      await page.click('#btn-save-status');
      await expect(page.locator('#status-select')).toHaveValue(to, { timeout: 10000 });
    }
    // TAREA 18/§H.7: fase_04 -> fase_05 exige una cotización aceptada (el
    // flujo completo de cotización — borrador, ajuste, envío, aceptación —
    // ya lo cubre e2e/quotes.spec.js). Este spec se enfoca en pagos/
    // documentos/subsanación, así que se fuerza con override, igual que lo
    // haría un admin ante una excepción real.
    async function advanceOverride(to, reason) {
      // Orden importa: marcar "Forzar (override)" dispara buildStatusOptions()
      // (expediente.html), que RECONSTRUYE el <select> y vuelve a seleccionar
      // el estado ACTUAL por defecto — si el target ya estaba elegido antes
      // de marcar el checkbox, la reconstrucción lo pisa. Por eso el
      // checkbox va primero.
      await page.check('#override-check');
      await page.selectOption('#status-select', to);
      await page.fill('#override-reason', reason);
      await page.click('#btn-save-status');
      await expect(page.locator('#status-select')).toHaveValue(to, { timeout: 10000 });
    }
    async function registerPayment({ tipo, concepto, autoridad, monto, comprobanteName }) {
      await page.selectOption('#pay-tipo', tipo);
      if (concepto)  await page.selectOption('#pay-concepto', concepto);
      if (autoridad) await page.selectOption('#pay-autoridad', autoridad);
      await page.fill('#pay-monto', String(monto));
      await page.fill('#pay-fecha', '2026-09-29');
      await page.setInputFiles('#pay-comprobante', comprobante(comprobanteName));
      await page.click('#payment-form button[type="submit"]');
      await expect(page.locator('#payments-list')).toContainText(`B/. ${Number(monto).toFixed(2)}`, { timeout: 10000 });
    }

    await advance('fase_01');
    await advance('fase_02');
    await advance('fase_03');
    await advance('fase_04');
    // Recarga antes del override — mismo patrón ya probado en
    // payments.spec.js/estados.spec.js (un estado recién actualizado por JS,
    // sin reload, deja el checkbox/reason-row en un estado que a veces no
    // vuelve a mostrarse limpio con check()+fill() inmediatos).
    await page.reload();
    await expect(page.locator('#status-select')).toHaveValue('fase_04', { timeout: 10000 });
    await advanceOverride('fase_05', 'Cotización cubierta en e2e/quotes.spec.js — fuera de foco de este flujo');

    // ═══ fase_05: pago por CONCEPTO (TAREA 23) — sin cotización aceptada
    // (se llegó por override) la línea es null, así que el gate exige la
    // base: honorarios + tasa_dnfd (ni mef ni iea aplican sin
    // esExtranjero/aplicaIEA marcados en una cotización) ═══
    await registerPayment({ tipo: 'cliente_a_farmazed', concepto: 'honorarios', monto: 2055, comprobanteName: 'honorarios-fase05.pdf' });
    await registerPayment({ tipo: 'cliente_a_farmazed', concepto: 'tasa_dnfd', monto: 200, comprobanteName: 'tasa-dnfd-fase05.pdf' });
    await shot(page, '07-fase05-pagos-registrados');

    await advance('fase_06');
    await shot(page, '08-fase06');

    await advance('fase_07'); // §H.8: fase_07 ya NO es manual — entrar no pide confirm
    await shot(page, '09-fase07-instruccion-cliente');

    // ═══ 5. Fase_07: el control encuentra algo y pide un documento
    // aclaratorio adicional (opcional, 'otros_docs') — pending_docs desde
    // cualquier fase, D07. Se invoca directo el mismo endpoint que dispara
    // el botón "Solicitar" (que usa prompt() nativo, no fiable en headless —
    // mismo criterio que logout() en otros specs de este directorio). ═══
    await page.evaluate(async ({ caseId, faddiDocId, message }) => {
      const api = (await import('/portal/js/api.js')).default;
      await api.requestDocument(caseId, faddiDocId, message);
    }, { caseId, faddiDocId: 'otros_docs', message: 'Favor adjuntar declaración jurada aclaratoria sobre el lote de referencia.' });
    await page.reload();
    await expect(page.locator('#status-select')).toHaveValue('pending_docs', { timeout: 10000 });
    await shot(page, '10-fase07-solicita-documento-pending-docs');

    // ═══ CLIENTE CHECK #2 — documentos pendientes + honorarios/tasa_dnfd pagados + saldo pendiente ═══
    // #sec-pendientes vive en el módulo "Resumen" (activo por defecto al
    // loguearse), NO en "Mis Productos" — se revisa ahí primero.
    await logout(page);
    await login(page, clientEmail, clientPass);
    await expect(page.locator('#sec-pendientes')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#pendientes-list')).toContainText('declaración jurada aclaratoria');
    await shot(page, '11a-cliente-check2-resumen-pendientes');

    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    const productCard2 = page.locator('.fz-product-card', { hasText: 'Analgen E2E Completo' });
    await expect(productCard2).toBeVisible({ timeout: 10000 });
    await expect(productCard2).toContainText('Esperando documentos tuyos');
    await productCard2.locator('.fz-prod-header').click();
    await expect(productCard2).toContainText('Honorarios');
    const badges = productCard2.locator('.badge');
    await expect(badges.filter({ hasText: 'Pagado' })).toHaveCount(2);   // honorarios, tasa_dnfd
    await expect(badges.filter({ hasText: 'Pendiente' })).toHaveCount(1); // saldo
    await page.mouse.move(700, 400);
    await shot(page, '11b-cliente-check2-productos-honorarios-pagados');

    // ═══ TAREA 13: el cliente RESUELVE el pendiente subiendo el documento
    // desde "Subir archivo" (antes decorativo, sin handler) ═══
    await page.locator('a.nav-link', { hasText: 'Resumen' }).click();
    await expect(page.locator('#sec-pendientes')).toBeVisible({ timeout: 10000 });
    await page.locator('#pendientes-list input[type=file]').setInputFiles(docFile('otros_docs_aclaratorio'));
    // El handler hace alert() + reload() — page.on('dialog') ya la acepta.
    await page.waitForURL(/client-dashboard\.html/, { timeout: 10000 });
    await expect(page.locator('#sec-pendientes')).toBeHidden({ timeout: 10000 }); // ya no quedan pendientes
    await shot(page, '11c-cliente-resuelve-pendiente-subiendo');

    await logout(page);

    // ═══ 6. Admin ve el documento subido (ya no "Solicitar", D07/TAREA 13) y
    // retoma: pending_docs -> fase_07 (el select YA ofrece fase_07 sin
    // necesitar override — bug de UI encontrado y arreglado en TAREA 12, ver
    // organizacion/08_PRUEBA_E2E_E2.md) -> 08 (dos confirmaciones) -> 09 -> 10 ═══
    await login(page, 'admin@farmazed.test', 'Farmazed123!');
    await page.goto(`/admin/expediente.html?id=${caseId}`);
    const otrosDocsItem = page.locator('.doc-item', { hasText: 'Otros Documentos Aclaratorios' });
    await expect(otrosDocsItem.getByText('Solicitar')).toHaveCount(0, { timeout: 10000 });
    // getByText('Ver') por substring (no exact) también matchea
    // "PENDIENTE_VERIFICAR" del faddiCode (TAREA 25: otros_docs perdió su
    // código 15.14 por la colisión con declaracion_paises/aprobacion_arr,
    // §H.9-2) — se acota al link real.
    await expect(otrosDocsItem.locator('a', { hasText: 'Ver' })).toBeVisible();
    await expect(page.locator('#status-select')).toHaveValue('pending_docs', { timeout: 10000 });
    const optionsPendingDocs = await page.locator('#status-select option').evaluateAll(opts => opts.map(o => o.value));
    expect(optionsPendingDocs).toContain('fase_07'); // confirma el fix del bug

    await advance('fase_07');
    // Acotado a la entrada más nueva (el historial es desc) — el override de
    // fase_04->fase_05 (TAREA 18/§H.7, cotización fuera de foco de este
    // spec) sigue en el historial más abajo, y es real, no un falso positivo.
    await expect(page.locator('#status-history .field-row').first()).not.toContainText('override'); // no fue un override real
    await advance('fase_08');

    // §H.8/TAREA 21: fase_08 exige DOS confirmaciones (legal + técnica/
    // matrices) antes de poder avanzar a fase_09 — el admin tiene los dos
    // permisos (abogado+admin, regente+admin) y confirma ambas.
    await expect(page.locator('#fase8-card')).toBeVisible({ timeout: 10000 });
    await page.locator('.btn-confirmar-fase8[data-tipo="legal"]').click();
    await page.locator('.btn-confirmar-fase8[data-tipo="tecnica"]').click();
    await expect(page.locator('#fase8-confirmaciones')).not.toContainText('Pendiente', { timeout: 10000 });
    await shot(page, '12-fase08-confirmaciones');

    await advance('fase_09');
    await advance('fase_10');
    await shot(page, '13-fase10-verificacion-originales');

    // ═══ 7. Subsanación real: 10 -> 09 -> 10 (vuelta — §H.8, ya no vuelve a
    // fase_07 como en el modelo de 14 fases) ═══
    await advance('fase_09');
    await shot(page, '14-subsanacion-vuelta-a-fase09');
    await advance('fase_10');
    await shot(page, '15-fase10-segunda-vuelta');

    await advance('fase_11');
    await advance('fase_12'); // §H.8: ya no es control manual
    await shot(page, '16-fase12-ingreso-dnfd-iea');

    await advance('fase_13');

    // ═══ fase_13: saldo de honorarios (concepto honorarios_saldo) — se
    // registra y se ve, pero NO bloquea ninguna fase (§H.8/TAREA 23,
    // instrucción explícita del PM) ═══
    await registerPayment({ tipo: 'cliente_a_farmazed', concepto: 'honorarios_saldo', monto: 2055, comprobanteName: 'saldo-fase13.pdf' });
    await shot(page, '17-fase13-pago-saldo-registrado');

    // ═══ 8. Ciclo observado_dnfd: DNFD pide correcciones, se calcula la
    // fecha límite de subsanación (Art. 22 D.E. 27/2024, §H.8), y tras
    // subsanar reingresa a fase_13 ═══
    await advance('observado_dnfd');
    await expect(page.locator('#plazo-subsanacion-banner')).toContainText('plazo de subsanación', { timeout: 10000 });
    await shot(page, '18-observado-dnfd-plazo');

    await advance('fase_13');
    await advance('aprobado');
    await shot(page, '19-aprobado');

    // ═══ CLIENTE CHECK #3 — aprobado, ambos pagos hechos ═══
    await logout(page);
    await login(page, clientEmail, clientPass);
    await page.locator('a.nav-link', { hasText: 'Mis Productos' }).click();
    const productCard3 = page.locator('.fz-product-card', { hasText: 'Analgen E2E Completo' });
    await expect(productCard3).toBeVisible({ timeout: 10000 });
    await expect(productCard3).toContainText('¡Registro aprobado!');
    await productCard3.locator('.fz-prod-header').click();
    const badges3 = productCard3.locator('.badge');
    await expect(badges3.filter({ hasText: 'Pagado' })).toHaveCount(3); // honorarios, tasa_dnfd, saldo (mef/iea no aplican: sin cotización aceptada)
    await page.mouse.move(700, 400);
    await shot(page, '20-cliente-check3-aprobado-ambos-pagos');
  });
});

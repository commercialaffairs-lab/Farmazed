/**
 * seed_roles.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Siembra el fixture de roles: 2 empresas y 1 usuario por cada uno de los 6
 * roles (7 cuentas — cliente_titular aparece 2 veces, una por empresa, para
 * poder probar el 403 cruzado entre organizaciones). Independiente del seed
 * legacy (scripts/seed_emulador.js) — no comparte UIDs ni casos, para no
 * interferir con los specs de Playwright de e2e/.
 *
 * SOLO EMULADOR — se niega a correr sin FIRESTORE_EMULATOR_HOST.
 *
 * Uso:
 *   FIRESTORE_EMULATOR_HOST=localhost:8090 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIREBASE_PROJECT_ID=demo-farmazed \
 *   node scripts/seed_roles.js
 */

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('❌ FIRESTORE_EMULATOR_HOST no está definido — este script SOLO corre contra el emulador.');
  process.exit(1);
}

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-farmazed' });
}
const db   = admin.firestore();
const auth = admin.auth();

const PASSWORD = 'Farmazed123!'; // solo emulador local

const ORG_ALFA = 'org-alfa';
const ORG_BETA = 'org-beta';

const USERS = [
  { uid: 'role-titular-alfa', email: 'titular-alfa@farmazed.test', name: 'Titular Alfa', role: 'cliente_titular', orgId: ORG_ALFA },
  { uid: 'role-miembro-alfa', email: 'miembro-alfa@farmazed.test', name: 'Miembro Alfa', role: 'cliente_miembro', orgId: ORG_ALFA },
  { uid: 'role-titular-beta', email: 'titular-beta@farmazed.test', name: 'Titular Beta', role: 'cliente_titular', orgId: ORG_BETA },
  { uid: 'role-analista',     email: 'analista@farmazed.test',     name: 'Analista Demo', role: 'analista' },
  { uid: 'role-abogado',      email: 'abogado@farmazed.test',      name: 'Abogado Demo',  role: 'abogado' },
  { uid: 'role-regente',      email: 'regente@farmazed.test',      name: 'Regente Demo',  role: 'regente' },
  { uid: 'role-admin',        email: 'admin-e3@farmazed.test',     name: 'Admin E3',      role: 'admin' },
];

async function upsertUser({ uid, email, name, role, orgId }) {
  // TAREA 32: emailVerified:true — cuentas de prueba, no pasan por el
  // registro abierto (ver seed_emulador.js para la misma nota completa).
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: PASSWORD, displayName: name, emailVerified: true });
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      await auth.createUser({ uid, email, password: PASSWORD, displayName: name, emailVerified: true });
    } else {
      throw e;
    }
  }
  const claims = { role, ...(orgId ? { orgId } : {}), ...(role === 'admin' ? { admin: true } : {}) };
  await auth.setCustomUserClaims(uid, claims);
}

function baseCase(overrides) {
  const now = admin.firestore.Timestamp.now();
  return {
    createdAt: now, updatedAt: now,
    tramiteType: 'medicamentos', tipoSolicitud: 'Nuevo Registro', tipoRegistro: 'Regular',
    tipoMedicamento: [], product: {}, entities: {}, monografia: {},
    assignedTo: null, priority: 'normal', notes: '', faddi: {}, vencimiento: null,
    ...overrides,
  };
}

async function main() {
  console.log('→ Sembrando 2 empresas...');
  const now = admin.firestore.Timestamp.now();
  await db.collection('orgs').doc(ORG_ALFA).set({ nombre: 'Laboratorios Alfa', createdAt: now, createdBy: 'seed_roles' });
  await db.collection('orgs').doc(ORG_BETA).set({ nombre: 'Farmacéutica Beta',  createdAt: now, createdBy: 'seed_roles' });

  console.log('→ Sembrando 1 usuario por rol (7 cuentas)...');
  for (const u of USERS) await upsertUser(u);

  console.log('→ Sembrando casos de prueba (org Alfa, org Beta, y las 3 fases de control)...');
  const asignadosAlfa = { analista: 'role-analista', abogado: 'role-abogado', regente: 'role-regente' };

  // Caso general de org Alfa, en fase_07 (§H.8: ya NO es manual — solo
  // sirve aquí para ownership/403 cruzado, no para probar confirmaciones).
  await db.collection('cases').doc('case-org-alfa').set(baseCase({
    status: 'fase_07', caseCode: 'FZ-MED-REG-2026-0090',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Org Alfa (fase 7)' },
  }));

  // §H.8/TAREA 21: fase_08 exige DOS confirmaciones (legal=abogado,
  // técnica/matrices=regente) antes de avanzar a fase_09 — dedicado, para no
  // interferir con case-docs-test (también en fase_07/fase_08 en otras
  // pruebas).
  await db.collection('cases').doc('case-fase8-test').set(baseCase({
    status: 'fase_08', caseCode: 'FZ-MED-REG-2026-0091',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Fase 8 Test' },
  }));

  // §H.8/TAREA 21: fase_10 la confirma el analista (cambió de dueño —
  // antes, en el modelo de 14 fases, la confirmaba el regente).
  await db.collection('cases').doc('case-fase10-test').set(baseCase({
    status: 'fase_10', caseCode: 'FZ-MED-REG-2026-0092',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Fase 10 Test' },
  }));

  // §H.8/TAREA 21: en el modelo de 13 fases, fase_08 y fase_10 son las
  // ÚNICAS manuales — cualquier otra fase avanza por el analista sin
  // confirmación especial, y ningún otro rol de staff puede mover el
  // status ahí tampoco (STAFF_EXIT_OWNER quedó vacío). Dedicado para
  // probar justamente eso, en una fase secuencial cualquiera.
  await db.collection('cases').doc('case-org-alfa-secuencial').set(baseCase({
    status: 'fase_02', caseCode: 'FZ-MED-REG-2026-0093',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Secuencial Test' },
  }));

  // §H.8/TAREA 21: reciclar fase_08 (subsanación, nuevo ciclo) debe limpiar
  // las dos confirmaciones — dedicado, para no interferir con case-fase8-test.
  await db.collection('cases').doc('case-fase8-recycle-test').set(baseCase({
    status: 'fase_08', caseCode: 'FZ-MED-REG-2026-0097',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Fase 8 Reciclo Test' },
  }));

  // §H.8/TAREA 21: fase_04 -> cerrado exige motivo (cliente no acepta la
  // cotización).
  await db.collection('cases').doc('case-cerrado-test').set(baseCase({
    status: 'fase_04', caseCode: 'FZ-MED-REG-2026-0098',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Cerrado Test' },
  }));

  // §H.8/TAREA 21: al entrar a observado_dnfd se calcula la fecha límite de
  // subsanación — un caso Regular (3 meses) y uno Abreviado (8 días hábiles).
  await db.collection('cases').doc('case-observado-regular-test').set(baseCase({
    status: 'fase_13', caseCode: 'FZ-MED-REG-2026-0099',
    tipoRegistro: 'Regular',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Observado Regular Test' },
  }));
  await db.collection('cases').doc('case-observado-abreviado-test').set(baseCase({
    status: 'fase_13', caseCode: 'FZ-MED-ABR-2026-0100',
    tipoRegistro: 'Abreviado',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Observado Abreviado Test' },
  }));

  // TAREA 22 (ajuste PM sobre TAREA 21): un caso por gate, por CADA vía
  // (REST y MCP) — prueban que tracker/services/transitions.js bloquea
  // igual sin importar cómo se llegue (antes mcp.js le faltaban dos gates
  // completos, un hueco de cumplimiento real).
  const gateCase = (id, code, status, overrides = {}) => db.collection('cases').doc(id).set(baseCase({
    status, caseCode: code,
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: `Producto Gate ${id}` },
    ...overrides,
  }));
  await gateCase('case-gate-transicion-rest', 'FZ-MED-REG-2026-0101', 'fase_02');
  await gateCase('case-gate-transicion-mcp',  'FZ-MED-REG-2026-0102', 'fase_02');
  await gateCase('case-gate-pago-rest',       'FZ-MED-REG-2026-0103', 'fase_05');
  await gateCase('case-gate-pago-mcp',        'FZ-MED-REG-2026-0104', 'fase_05');
  await gateCase('case-gate-cotizacion-rest', 'FZ-MED-REG-2026-0105', 'fase_04');
  await gateCase('case-gate-cotizacion-mcp',  'FZ-MED-REG-2026-0106', 'fase_04');
  await gateCase('case-gate-cerrado-rest',    'FZ-MED-REG-2026-0107', 'fase_04');
  await gateCase('case-gate-cerrado-mcp',     'FZ-MED-REG-2026-0108', 'fase_04');
  await gateCase('case-gate-fase8-rest',      'FZ-MED-REG-2026-0109', 'fase_08');
  await gateCase('case-gate-fase8-mcp',       'FZ-MED-REG-2026-0110', 'fase_08');

  // TAREA 23 (§H.8, Pagos): gate de fase_05 por CONCEPTO — un caso con
  // cotización ACEPTADA marcada esExtranjero+aplicaIEA (modalidad expedita),
  // así el gate exige los 4 conceptos (honorarios+tasa_dnfd+mef+iea), no
  // solo los 2 base. Sembrado directo de la cotización (mismo shape que
  // produce quotes.js) — no hace falta correr el flujo completo de envío/
  // aceptación para esta prueba. En ORG_BETA (no Alfa): admin/cotizaciones.html
  // (quotes.spec.js) filtra por "Laboratorios Alfa" y estas 2 cotizaciones
  // 'aceptada' de más rompían ese locator (strict-mode: 3 tarjetas en vez
  // de 1) — solo se usa el token admin/MCP en estos tests, el org es
  // irrelevante para ellos.
  const gateCaseBeta = (id, code, status) => db.collection('cases').doc(id).set(baseCase({
    status, caseCode: code,
    orgId: ORG_BETA, clientId: 'role-titular-beta', clientEmail: 'titular-beta@farmazed.test', clientName: 'Titular Beta',
    asignados: { analista: null, abogado: null, regente: null }, product: { nombreComercial: `Producto Gate ${id}` },
  }));
  await gateCaseBeta('case-gate-pago-concepto-rest', 'FZ-MED-REG-2026-0111', 'fase_05');
  await gateCaseBeta('case-gate-pago-concepto-mcp',  'FZ-MED-REG-2026-0112', 'fase_05');
  const lineaConcepto = (caseId, caseCode) => ({
    caseId, caseCode, categoriaPrecio: null,
    tarifarioHonorarios: 0, tarifarioTasas: 0, honorariosFarmazed: 0, tasasOficiales: 0, monto: 0,
    ajustado: false, motivoAjuste: null,
    esExtranjero: true, aplicaIEA: true, modalidadIEA: 'expedita',
  });
  await db.collection('quotes').doc('quote-gate-pago-concepto-rest').set({
    orgId: ORG_BETA, caseIds: ['case-gate-pago-concepto-rest'], estado: 'aceptada',
    lineas: [lineaConcepto('case-gate-pago-concepto-rest', 'FZ-MED-REG-2026-0111')],
    total: 0, historial: [], createdAt: now, updatedAt: now,
  });
  await db.collection('quotes').doc('quote-gate-pago-concepto-mcp').set({
    orgId: ORG_BETA, caseIds: ['case-gate-pago-concepto-mcp'], estado: 'aceptada',
    lineas: [lineaConcepto('case-gate-pago-concepto-mcp', 'FZ-MED-REG-2026-0112')],
    total: 0, historial: [], createdAt: now, updatedAt: now,
  });

  // TAREA 25 (§H.9, decisión 1): recibo_iea depende de aplicaIEA de la
  // cotización ACEPTADA — 2 casos en fase_03 (org Beta, mismo criterio que
  // los de arriba: no chocan con el locator "Laboratorios Alfa" de
  // quotes.spec.js) para llevarlos por el flujo real de cotización
  // (borrador -> marcar aplicaIEA -> enviar -> aceptar) y comprobar que el
  // checklist de cada uno refleja su propio valor.
  await db.collection('cases').doc('case-checklist-iea-si').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-REG-2026-0113',
    tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'],
    orgId: ORG_BETA, clientId: 'role-titular-beta', clientEmail: 'titular-beta@farmazed.test', clientName: 'Titular Beta',
    asignados: { analista: null, abogado: null, regente: null }, product: { nombreComercial: 'Producto Checklist IEA Si' },
  }));
  await db.collection('cases').doc('case-checklist-iea-no').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-REG-2026-0114',
    tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'],
    orgId: ORG_BETA, clientId: 'role-titular-beta', clientEmail: 'titular-beta@farmazed.test', clientName: 'Titular Beta',
    asignados: { analista: null, abogado: null, regente: null }, product: { nombreComercial: 'Producto Checklist IEA No' },
  }));

  // TAREA 28 (§H.11): "Prioridad innovadores" es una línea EXTRA de la
  // cotización (no reemplaza la principal) cuando esInnovador=true y la
  // categoría es Síntesis Química/Biológicos/Biotecnológicos, en Abreviado
  // (el xlsx 24-sep solo trae esa fila bajo "Registros Nuevos (Abreviado)").
  // En fase_03, org Beta (mismo criterio de no-colisión con "Laboratorios
  // Alfa" de quotes.spec.js) — el test avanza a fase_04 y revisa que la
  // cotización en borrador trae las 2 líneas.
  await db.collection('cases').doc('case-prioridad-innovadores-test').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-ABR-2026-0115',
    tipoRegistro: 'Abreviado', tipoMedicamento: ['Síntesis Química'], esInnovador: true,
    orgId: ORG_BETA, clientId: 'role-titular-beta', clientEmail: 'titular-beta@farmazed.test', clientName: 'Titular Beta',
    asignados: { analista: null, abogado: null, regente: null }, product: { nombreComercial: 'Producto Prioridad Innovadores Test' },
  }));

  // Ajuste del PM tras la entrega de TAREA 28: "Vacuna = Biológicos" (§H.11)
  // también aplica a "Prioridad innovadores" — mismo caso que el de arriba,
  // pero con Vacuna en vez de Síntesis Química.
  await db.collection('cases').doc('case-prioridad-innovadores-vacuna-test').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-ABR-2026-0116',
    tipoRegistro: 'Abreviado', tipoMedicamento: ['Vacuna'], esInnovador: true,
    orgId: ORG_BETA, clientId: 'role-titular-beta', clientEmail: 'titular-beta@farmazed.test', clientName: 'Titular Beta',
    asignados: { analista: null, abogado: null, regente: null }, product: { nombreComercial: 'Producto Prioridad Innovadores Vacuna Test' },
  }));

  // TAREA 33 (§H.14): caso dedicado para el flujo de pago con PayPal
  // (mock) — org Beta, Regular + Síntesis Química (categoría con fila
  // propia en el tarifario, montos > 0 en honorarios/tasa_dnfd/mef/iea).
  await db.collection('cases').doc('case-pago-paypal-test').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-REG-2026-0117',
    tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'],
    orgId: ORG_BETA, clientId: 'role-titular-beta', clientEmail: 'titular-beta@farmazed.test', clientName: 'Titular Beta',
    asignados: { analista: null, abogado: null, regente: null }, product: { nombreComercial: 'Producto Pago PayPal Test' },
  }));

  // Caso de org Beta — para el 403 cruzado (titular/miembro de Alfa no debe verlo).
  await db.collection('cases').doc('case-org-beta').set(baseCase({
    status: 'draft', caseCode: 'FZ-MED-REG-2026-0094',
    orgId: ORG_BETA, clientId: 'role-titular-beta', clientEmail: 'titular-beta@farmazed.test', clientName: 'Titular Beta',
    asignados: { analista: null, abogado: null, regente: null }, product: { nombreComercial: 'Producto Org Beta' },
  }));

  // Casos dedicados y AISLADOS por prueba — para que las pruebas de
  // documentos/pagos/override no muten el status de case-org-alfa (que las
  // pruebas de lectura/ownership y confirm_7 siguen necesitando en fase_07).
  await db.collection('cases').doc('case-docs-test').set(baseCase({
    status: 'fase_07', caseCode: 'FZ-MED-REG-2026-0080',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Docs Test' },
  }));
  await db.collection('cases').doc('case-payments-test').set(baseCase({
    status: 'fase_05', caseCode: 'FZ-MED-REG-2026-0081',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Pagos Test' },
  }));
  await db.collection('cases').doc('case-override-test').set(baseCase({
    status: 'fase_01', caseCode: 'FZ-MED-REG-2026-0082',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Override Test' },
  }));
  // TAREA 16(b): dedicado para cases.delete — nadie más lo usa.
  await db.collection('cases').doc('case-delete-test').set(baseCase({
    status: 'fase_01', caseCode: 'FZ-MED-REG-2026-0083',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Delete Test' },
  }));
  // TAREA 17 (R14): Abreviado + Suplementos, para probar el filtro de
  // formularios con dos tags a la vez (form-06/07 por Abreviado, form-11/12
  // por Suplementos) sin tocar los demás fixtures.
  await db.collection('cases').doc('case-formularios-test').set(baseCase({
    status: 'fase_01', caseCode: 'FZ-MED-ABR-2026-0084',
    tipoRegistro: 'Abreviado', tipoMedicamento: ['Suplementos'],
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Formularios Test' },
  }));
  // TAREA 18 (R5/R12): 3 casos de org Alfa en fase_03 — un solo `advance('fase_04')`
  // cada uno dispara el borrador automático de cotización (agrupa los 3 en
  // UNA cotización de la empresa; cada línea conserva su propia
  // categoriaPrecio/caseCode). Categorías distintas a propósito para probar
  // que cada línea resuelve la suya sin mezclarse.
  await db.collection('cases').doc('case-quote-test-1').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-ABR-2026-0085',
    tipoRegistro: 'Abreviado', tipoMedicamento: ['Suplementos'],
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Cotización Test 1' },
  }));
  await db.collection('cases').doc('case-quote-test-2').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-REG-2026-0086',
    tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'],
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Cotización Test 2' },
  }));
  await db.collection('cases').doc('case-quote-test-3').set(baseCase({
    status: 'fase_03', caseCode: 'FZ-MED-ABR-2026-0087',
    tipoRegistro: 'Abreviado', tipoMedicamento: ['Síntesis Química'],
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Cotización Test 3' },
  }));
  // TAREA 18, ajuste PM_COMMENTS §H.7: caso SIN orgId en fase_04 (dato sin
  // migrar) — el gate de cotización debe bloquear SIEMPRE, nunca saltarse.
  await db.collection('cases').doc('case-quote-test-sin-org').set(baseCase({
    status: 'fase_04', caseCode: 'FZ-MED-REG-2026-0088',
    orgId: null, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Sin Empresa Test' },
  }));
  // TAREA 19 (R13): dedicado al conteo de páginas del paquete IEA — no
  // comparte faddiDocId con ningún otro test de documentos.
  await db.collection('cases').doc('case-iea-test').set(baseCase({
    status: 'fase_07', caseCode: 'FZ-MED-REG-2026-0089',
    orgId: ORG_ALFA, clientId: 'role-titular-alfa', clientEmail: 'titular-alfa@farmazed.test', clientName: 'Titular Alfa',
    asignados: asignadosAlfa, product: { nombreComercial: 'Producto Paquete IEA Test' },
  }));

  console.log('');
  console.log('✅ Seed de roles completo.');
  console.log(`   Org Alfa (${ORG_ALFA}): titular-alfa@farmazed.test, miembro-alfa@farmazed.test`);
  console.log(`   Org Beta (${ORG_BETA}): titular-beta@farmazed.test`);
  console.log('   Staff: analista@farmazed.test, abogado@farmazed.test, regente@farmazed.test, admin-e3@farmazed.test');
  console.log(`   Password (todas): ${PASSWORD}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌ Seed de roles error:', err);
  process.exit(1);
});

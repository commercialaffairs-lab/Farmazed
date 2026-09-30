// global-setup.js — Deja el caso de prueba en un estado conocido (fase_06)
// antes de cada corrida, para que el spec sea repetible. El resto de la
// siembra (admin, cliente, otros casos, precios) ya la hace run.sh llamando
// a tracker/scripts/seed_emulador.js.
//
// SOLO EMULADOR — se niega si no hay FZ_FIRESTORE_PORT (nunca hay forma de
// que esto apunte a producción por accidente).

const TEST_CASE_ID = 'test-flujo-visual';
const PAGO_CASE_ID       = 'test-pago-visual';  // TAREA 11 / D12 — gate fase_05 (único gate de pago que sigue existiendo, §H.8/TAREA 21)
const DOC_VERSION_ID     = 'test-doc-version';  // TAREA 13 (ajuste) — versionado de documentos

async function clearSubcollection(db, caseId, name) {
  const snap = await db.collection('cases').doc(caseId).collection(name).get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  if (snap.size > 0) await batch.commit();
}

module.exports = async function globalSetup() {
  if (!process.env.FZ_FIRESTORE_PORT) {
    throw new Error('global-setup.js: FZ_FIRESTORE_PORT no está definido — usar e2e/run.sh, no "npx playwright test" directo.');
  }
  process.env.FIRESTORE_EMULATOR_HOST = `localhost:${process.env.FZ_FIRESTORE_PORT}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${process.env.FZ_AUTH_PORT}`;

  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'demo-farmazed' });
  }
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  await db.collection('cases').doc(TEST_CASE_ID).set({
    createdAt: now, updatedAt: now, status: 'fase_06',
    caseCode: 'FZ-MED-REG-2026-0099', tramiteType: 'medicamentos', tipoRegistro: 'Regular',
    clientId: 'seed-client-uid', clientEmail: 'cliente@farmazed.test',
    product: { nombreComercial: 'Analgen Test Visual' },
  });

  // Limpia el historial de corridas anteriores para que cada corrida del
  // spec empiece con una pizarra en blanco.
  await clearSubcollection(db, TEST_CASE_ID, 'statusHistory');

  // D12 (TAREA 11): caso separado en fase_05, sin pagos, para probar el gate
  // 05->06 bloqueado/desbloqueado sin interferir con el flujo de estados.
  await db.collection('cases').doc(PAGO_CASE_ID).set({
    createdAt: now, updatedAt: now, status: 'fase_05',
    caseCode: 'FZ-MED-REG-2026-0098', tramiteType: 'medicamentos', tipoRegistro: 'Regular',
    clientId: 'seed-client-uid', clientEmail: 'cliente@farmazed.test',
    product: { nombreComercial: 'Analgen Test Pago' },
  });
  await clearSubcollection(db, PAGO_CASE_ID, 'statusHistory');
  await clearSubcollection(db, PAGO_CASE_ID, 'payments');

  // §H.8/TAREA 21: los gates de fase_13/fase_14 del modelo de 14 fases se
  // quitaron (esas fases ya no existen con ese significado — fase_13 ahora
  // es "Seguimiento y gestión post-ingreso", sin relación con pagos; la
  // TAREA 22 rehace el desglose de fase_05 por concepto). Los fixtures
  // test-pago-fase13/test-pago-fase14 y sus specs se retiraron con esta
  // tarea — ver e2e/payments.spec.js.

  // TAREA 13 (ajuste de cumplimiento): caso vacío para probar el ciclo
  // subir -> rechazar con motivo -> re-subir -> versión anterior archivada.
  await db.collection('cases').doc(DOC_VERSION_ID).set({
    createdAt: now, updatedAt: now, status: 'fase_07',
    caseCode: 'FZ-MED-REG-2026-0095', tramiteType: 'medicamentos', tipoRegistro: 'Regular',
    clientId: 'seed-client-uid', clientEmail: 'cliente@farmazed.test',
    product: { nombreComercial: 'Analgen Test Versiones' },
  });
  await clearSubcollection(db, DOC_VERSION_ID, 'documents');

  console.log(`→ global-setup: ${TEST_CASE_ID} en fase_06; ${PAGO_CASE_ID} en fase_05 sin pagos; ${DOC_VERSION_ID} en fase_07 sin documentos.`);
};

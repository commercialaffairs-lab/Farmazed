/**
 * seed_emulador.js — Seed idempotente para los emuladores Firebase (dev local).
 *
 * NUNCA toca producción: se niega a correr si FIRESTORE_EMULATOR_HOST no está
 * definido. Ver DEV_LOCAL.md para el flujo completo (levantar emuladores,
 * variables de entorno, cómo correr este script).
 *
 * Crea:
 *   - 1 usuario admin  (admin@farmazed.test)
 *   - 1 usuario cliente (cliente@farmazed.test)
 *   - 3 casos en distintos estados, del cliente de arriba
 *   - las 13 categorías de precios (delega en ../seed_pricing.js)
 *
 * Usa IDs fijos y set() (no add()) en todo — correrlo dos veces sobrescribe
 * los mismos documentos, no los duplica.
 *
 * Uso:
 *   FIRESTORE_EMULATOR_HOST=localhost:8090 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIREBASE_PROJECT_ID=demo-farmazed \
 *   node scripts/seed_emulador.js
 */

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    '❌ FIRESTORE_EMULATOR_HOST no está definido. Este script SOLO corre contra ' +
    'el emulador — abortando para no arriesgar producción. Ver DEV_LOCAL.md.'
  );
  process.exit(1);
}

const path = require('path');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-farmazed' });
}
const db   = admin.firestore();
const auth = admin.auth();

const SEED_PASSWORD = 'Farmazed123!'; // solo emulador local — no es un secreto real

const ADMIN_UID    = 'seed-admin-uid';
const ADMIN_EMAIL  = 'admin@farmazed.test';
const CLIENT_UID   = 'seed-client-uid';
const CLIENT_EMAIL = 'cliente@farmazed.test';

async function upsertAuthUser(uid, email, displayName, isAdmin) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password: SEED_PASSWORD, displayName });
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      await auth.createUser({ uid, email, password: SEED_PASSWORD, displayName });
    } else {
      throw e;
    }
  }
  await auth.setCustomUserClaims(uid, isAdmin ? { admin: true } : {});
}

function daysAgo(n) {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() - n * 24 * 3600 * 1000));
}

// Solo trámites habilitados hoy (F-6): medicamentos, cosmeticos.
// Ver tracker/data/tramites_habilitados.js.
const SEED_CASES = [
  {
    id: 'seed-case-draft',
    status: 'draft',
    caseCode: 'FZ-MED-REG-2026-0001',
    tramiteType: 'medicamentos',
    tipoRegistro: 'Regular',
    productName: 'Analgen 500mg (seed)',
  },
  {
    id: 'seed-case-in-review',
    status: 'in_review',
    caseCode: 'FZ-COS-2026-0002',
    tramiteType: 'cosmeticos',
    tipoRegistro: 'Regular',
    productName: 'Crema Hidratante Seed',
  },
  {
    id: 'seed-case-approved',
    status: 'approved',
    caseCode: 'FZ-MED-ABR-2026-0003',
    tramiteType: 'medicamentos',
    tipoRegistro: 'Abreviado',
    productName: 'Vitaseed Complex',
  },
];

async function seedCases() {
  for (const c of SEED_CASES) {
    await db.collection('cases').doc(c.id).set({
      createdAt:       daysAgo(20),
      updatedAt:       daysAgo(2),
      status:          c.status,
      caseCode:        c.caseCode,
      vencimiento:     null,
      tramiteType:     c.tramiteType,
      tipoSolicitud:   'Nuevo Registro',
      tipoRegistro:    c.tipoRegistro,
      tipoMedicamento: [],
      product:         { nombreComercial: c.productName },
      entities:        {},
      monografia:      {},
      clientId:        CLIENT_UID,
      clientEmail:     CLIENT_EMAIL,
      clientName:      'Cliente Demo',
      assignedTo:      c.status === 'draft' ? null : ADMIN_UID,
      priority:        'normal',
      notes:           '',
      faddi:           {},
    });
  }
  // Deja el contador global consistente con los caseCode de arriba.
  await db.collection('meta').doc('counters').set({ caseSequence: SEED_CASES.length }, { merge: true });
}

function seedPricing() {
  execFileSync('node', ['seed_pricing.js'], {
    cwd:   path.join(__dirname, '..'),
    stdio: 'inherit',
    env:   process.env,
  });
}

// TAREA 23: tarifario del xlsx 24-sep, SOLO emulador (ids `_24sep`, no pisan
// los de seed_pricing.js) — ver organizacion/10_DIFF_PRECIOS_24SEP.md.
function seedPricing24Sep() {
  execFileSync('node', ['scripts/seed_pricing_24sep.js'], {
    cwd:   path.join(__dirname, '..'),
    stdio: 'inherit',
    env:   process.env,
  });
}

async function main() {
  console.log('→ Seeding Auth emulator (admin + cliente)...');
  await upsertAuthUser(ADMIN_UID, ADMIN_EMAIL, 'Admin Demo', true);
  await upsertAuthUser(CLIENT_UID, CLIENT_EMAIL, 'Cliente Demo', false);

  console.log('→ Seeding Firestore: casos...');
  await seedCases();

  console.log('→ Seeding Firestore: precios (delega en seed_pricing.js)...');
  seedPricing();

  console.log('→ Seeding Firestore: tarifario 24-sep (delega en seed_pricing_24sep.js, TAREA 23)...');
  seedPricing24Sep();

  console.log('');
  console.log('✅ Seed del emulador completo (idempotente — puede correr de nuevo sin duplicar).');
  console.log(`   Admin:   ${ADMIN_EMAIL} / ${SEED_PASSWORD}`);
  console.log(`   Cliente: ${CLIENT_EMAIL} / ${SEED_PASSWORD}`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});

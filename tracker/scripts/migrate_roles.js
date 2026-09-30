/**
 * migrate_roles.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Migra las cuentas creadas ANTES del sistema de roles (solo tienen el claim
 * legacy `admin: boolean`, sin `role`): `admin:true` → `role:'admin'`
 * (conserva `admin:true` también, por compatibilidad — ver
 * middleware/auth.js `requireAdmin`); cualquier otra cuenta → `role:
 * 'cliente_titular'` de una empresa PROPIA nueva (una empresa por cuenta
 * migrada — no hay forma de saber, solo con lo que hay hoy, cuáles cuentas
 * legacy pertenecían a la misma empresa real).
 *
 * Además hace un segundo paso: todo caso cuyo `clientId` sea una cuenta
 * recién migrada a `cliente_titular` y no tenga `orgId` todavía, se
 * actualiza con el `orgId` de la empresa que se le acaba de crear — si no,
 * esos casos quedarían huérfanos de organización y nadie los vería en
 * `GET /api/cases` (el filtro nuevo es por `orgId`, con fallback a
 * `clientId` SOLO si la cuenta sigue sin `orgId` — después de migrar, ya no
 * aplica ese fallback).
 *
 * Idempotente: una cuenta que YA tiene `role` (venga de antes o de
 * scripts/seed_roles.js) se salta sin tocarla.
 *
 * Uso: node scripts/migrate_roles.js [--dry-run]
 * `--dry-run` (TAREA 16(c)): calcula y muestra qué cuenta migraría a qué rol
 * y qué casos recibirían orgId, pero NUNCA llama a setCustomUserClaims ni
 * batch.commit() — ver ENTREGA_E1_E3.md, plan de salida a producción.
 *
 * SOLO EMULADOR — se niega a correr sin FIRESTORE_EMULATOR_HOST.
 */

const DRY_RUN = process.argv.includes('--dry-run');

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

async function listAllUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function backfillOrgIdOnCases(clientId, orgId) {
  const snap = await db.collection('cases').where('clientId', '==', clientId).get();
  const toFix = snap.docs.filter(d => !d.data().orgId);
  if (!toFix.length) return 0;
  if (DRY_RUN) return toFix.length;
  const batch = db.batch();
  toFix.forEach(d => batch.update(d.ref, { orgId }));
  await batch.commit();
  return toFix.length;
}

async function main() {
  const users = await listAllUsers();
  let migratedAdmin = 0, migratedCliente = 0, skipped = 0, casesFixed = 0;

  for (const u of users) {
    const claims = u.customClaims || {};
    if (claims.role) { skipped++; continue; } // ya migrada (o sembrada con role desde el inicio)

    if (claims.admin === true) {
      if (!DRY_RUN) await auth.setCustomUserClaims(u.uid, { ...claims, role: 'admin' });
      migratedAdmin++;
      console.log(`  ${DRY_RUN ? '[dry-run] ' : ''}admin:true -> role:'admin'  (${u.email})`);
      continue;
    }

    // Cualquier otra cuenta sin role ni admin: cliente_titular de una
    // empresa propia nueva. En dry-run NO se crea la empresa de verdad (no
    // tendría sentido dejar orgs huérfanas de una corrida de prueba) — se
    // muestra el nombre que se le daría, con un id de mentira para el log.
    const orgName = `Empresa de ${u.displayName || u.email}`;
    let orgId;
    if (DRY_RUN) {
      orgId = '(nueva empresa — no creada, dry-run)';
    } else {
      const now    = admin.firestore.Timestamp.now();
      const orgRef = await db.collection('orgs').add({ nombre: orgName, createdAt: now, createdBy: 'migrate_roles' });
      orgId = orgRef.id;
      await auth.setCustomUserClaims(u.uid, { ...claims, role: 'cliente_titular', orgId });
    }
    migratedCliente++;
    console.log(`  ${DRY_RUN ? '[dry-run] ' : ''}(sin role) -> role:'cliente_titular', orgId:'${orgId}' (${orgName})  (${u.email})`);

    if (!DRY_RUN) {
      const fixed = await backfillOrgIdOnCases(u.uid, orgId);
      casesFixed += fixed;
      if (fixed) console.log(`    ↳ ${fixed} caso(s) de ${u.email} actualizado(s) con orgId`);
    } else {
      const wouldFix = await db.collection('cases').where('clientId', '==', u.uid).get();
      const count = wouldFix.docs.filter(d => !d.data().orgId).length;
      casesFixed += count;
      if (count) console.log(`    ↳ [dry-run] ${count} caso(s) de ${u.email} recibirían orgId`);
    }
  }

  console.log('');
  console.log(`${DRY_RUN ? '🔎 DRY-RUN' : '✅ Migración'} completa: ${migratedAdmin} cuenta(s) -> admin, ${migratedCliente} cuenta(s) -> cliente_titular, ${skipped} ya tenían role (sin tocar), ${casesFixed} caso(s) ${DRY_RUN ? 'recibirían' : 'con'} orgId${DRY_RUN ? '' : ' agregado'}.`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌ Migración error:', err);
  process.exit(1);
});

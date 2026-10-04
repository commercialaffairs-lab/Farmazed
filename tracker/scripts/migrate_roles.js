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
 * REANUDABLE (TAREA 39c): por cada cuenta el orden es (1) empresa con id
 * DETERMINISTA `mig_<uid>` (crearla de nuevo es un no-op, nunca se duplica),
 * (2) `orgId` en sus casos, (3) los claims — LO ÚLTIMO. Una cuenta solo "cuenta
 * como migrada" cuando ya tiene `role`, así que si el script se corta en medio,
 * volver a correrlo rehace los pasos pendientes de esa cuenta y llega al mismo
 * resultado final, sin empresas duplicadas ni casos huérfanos.
 *
 * Idempotente: una cuenta que YA tiene `role` (venga de antes o de
 * scripts/seed_roles.js) se salta sin tocarla.
 *
 * Uso:
 *   emulador:    node scripts/migrate_roles.js [--dry-run]            (escribe, salvo --dry-run)
 *   producción:  node scripts/migrate_roles.js --prod --project=<id>  (DRY-RUN por defecto: lista)
 *                node scripts/migrate_roles.js --prod --project=<id> --confirm   (escribe de verdad)
 *   producción exige --project=<id> explícito (y, si FIREBASE_PROJECT_ID/GOOGLE_CLOUD_PROJECT
 *   están definidos, que coincida), credenciales GCP de la sesión (gcloud auth
 *   application-default login) y NINGÚN FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST.
 *   Ver DEPLOY.md: paso previo OBLIGATORIO al deploy de TAREA 39 (sin role ya no es cliente_titular).
 * `--dry-run` (TAREA 16(c)): calcula y muestra qué cuenta migraría a qué rol
 * y qué casos recibirían orgId, pero NUNCA escribe nada.
 */

/**
 * Decide el modo según argumentos y entorno (función pura — probada en
 * tests/invitacion_squat.test.js y caducidad_migracion.test.js
 * sin tocar nada). Compartida con scripts/backfill_invitaciones.js (mismo patrón):
 *  · EMULADOR (FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST): escribe, salvo `--dry-run`.
 *  · PRODUCCIÓN (sin emuladores): exige `--prod` y `--project=<id>`, es dry-run por
 *    DEFECTO y escribe únicamente con `--prod --project=<id> --confirm`.
 *  `--confirm` sin `--prod`, `--prod` con emuladores y UN solo emulador definido son errores.
 */
function resolverModo(argv, env) {
  // Auth y Firestore son DOS servicios: el script escribe en los dos, así que el modo
  // emulador exige AMBAS variables. Con solo una, la otra mitad iría a producción.
  const hostFirestore = !!env.FIRESTORE_EMULATOR_HOST;
  const hostAuth = !!env.FIREBASE_AUTH_EMULATOR_HOST;
  const enEmulador = hostFirestore && hostAuth;
  const prod = argv.includes('--prod');
  const confirm = argv.includes('--confirm');
  const proyectos = argv.filter(a => a.startsWith('--project='));
  const proyecto = proyectos.length ? proyectos[0].slice('--project='.length) || null : null;
  if (hostFirestore !== hostAuth) return { error: 'Define AMBOS emuladores (FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST) o ninguno: con uno solo, la otra mitad del script escribiría en producción.' };
  if (prod && enEmulador) return { error: '--prod no se combina con los emuladores (apuntaría el emulador como si fuera producción).' };
  if (confirm && !prod) return { error: '--confirm solo vale junto con --prod.' };
  if (!enEmulador && !prod) {
    return { error: 'Sin emuladores definidos: contra PRODUCCIÓN hay que pasar --prod --project=<id> explícitos (por defecto solo lista = dry-run; escribe solo con --prod --project=<id> --confirm).' };
  }
  if (proyectos.length > 1) return { error: '--project=<id> se pasó más de una vez: ambiguo.' };
  if (prod) {
    if (!proyecto) return { error: '--project=<id> es obligatorio con --prod: hay que nombrar el proyecto de producción explícitamente.' };
    const delEntorno = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT;
    if (delEntorno && delEntorno !== proyecto) return { error: `--project=${proyecto} no coincide con el proyecto del entorno (${delEntorno}): se aborta para no escribir en el equivocado.` };
  }
  return { enEmulador, prod, proyecto, dryRun: argv.includes('--dry-run') || (prod && !confirm) };
}

async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

const YA_EXISTE = 6; // código gRPC ALREADY_EXISTS (Firestore .create())

async function backfillOrgIdOnCases(db, clientId, orgId, dryRun) {
  const snap = await db.collection('cases').where('clientId', '==', clientId).get();
  const toFix = snap.docs.filter(d => !d.data().orgId);
  if (!toFix.length) return 0;
  if (dryRun) return toFix.length;
  for (let i = 0; i < toFix.length; i += 400) { // un batch de Firestore admite hasta 500 escrituras
    const batch = db.batch();
    toFix.slice(i, i + 400).forEach(d => batch.update(d.ref, { orgId }));
    await batch.commit(); // un corte entre lotes es seguro: el filtro `!orgId` reanuda
  }
  return toFix.length;
}

/**
 * La migración en sí, con `auth`/`db`/`admin` inyectados (así las pruebas pueden
 * simular un corte a mitad). Devuelve el resumen.
 */
async function migrarCuentas({ auth, db, admin, dryRun, log = console.log }) {
  const prefijo = dryRun ? '[dry-run] ' : '';
  const users = await listAllUsers(auth);
  let migratedAdmin = 0, migratedCliente = 0, skipped = 0, casesFixed = 0;

  for (const u of users) {
    const claims = u.customClaims || {};
    if (claims.role) { skipped++; continue; } // ya migrada (o sembrada con role desde el inicio)

    if (claims.admin === true) {
      if (!dryRun) await auth.setCustomUserClaims(u.uid, { ...claims, role: 'admin' });
      migratedAdmin++;
      log(`  ${prefijo}admin:true -> role:'admin'  (${u.email})`);
      continue;
    }

    // Cualquier otra cuenta sin role ni admin: cliente_titular de una empresa propia
    // (id determinista). Orden reanudable: empresa -> casos -> claims (LO ÚLTIMO).
    // Si la cuenta ya traía un `orgId` en sus claims (p. ej. quedó a medio aceptar una
    // invitación), se respeta: no se le crea otra empresa ni se deja huérfana la suya.
    const orgPrevio = claims.orgId || null;
    const orgId = orgPrevio || `mig_${u.uid}`;
    const orgName = orgPrevio ? `(empresa existente ${orgPrevio})` : `Empresa de ${u.displayName || u.email}`;
    if (!dryRun) {
      if (!orgPrevio) {
        try {
          await db.collection('orgs').doc(orgId).create({ nombre: orgName, createdAt: admin.firestore.Timestamp.now(), createdBy: 'migrate_roles' });
        } catch (e) {
          if (e.code !== YA_EXISTE) throw e; // un corte anterior ya la creó: se sigue con ella
        }
      }
      casesFixed += await backfillOrgIdOnCases(db, u.uid, orgId, false);
      await auth.setCustomUserClaims(u.uid, { ...claims, role: 'cliente_titular', orgId });
    } else {
      casesFixed += await backfillOrgIdOnCases(db, u.uid, orgId, true);
    }
    migratedCliente++;
    log(`  ${prefijo}(sin role) -> role:'cliente_titular', orgId:'${orgId}' (${orgName})  (${u.email})`);
  }

  log('');
  log(`${dryRun ? '🔎 DRY-RUN' : '✅ Migración'} completa: ${migratedAdmin} cuenta(s) -> admin, ${migratedCliente} cuenta(s) -> cliente_titular, ${skipped} ya tenían role (sin tocar), ${casesFixed} caso(s) ${dryRun ? 'recibirían' : 'con'} orgId${dryRun ? '' : ' agregado'}.`);
  return { migratedAdmin, migratedCliente, skipped, casesFixed };
}

if (require.main !== module) {
  module.exports = { resolverModo, migrarCuentas };
} else {
  const modo = resolverModo(process.argv.slice(2), process.env);
  if (modo.error) {
    console.error(`❌ ${modo.error}`);
    process.exit(1);
  }
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: modo.proyecto || process.env.FIREBASE_PROJECT_ID || 'demo-farmazed' });
  if (modo.prod) {
    console.log(`⚠️  PRODUCCIÓN — proyecto "${admin.app().options.projectId}" — ${modo.dryRun ? 'DRY-RUN (no se escribe nada; para aplicar: --prod --project=<id> --confirm)' : 'ESCRIBE de verdad (--prod --confirm)'}`);
  }
  migrarCuentas({ auth: admin.auth(), db: admin.firestore(), admin, dryRun: modo.dryRun })
    .then(() => process.exit(0))
    .catch(err => { console.error('❌ Migración error (se puede volver a correr: es reanudable):', err); process.exit(1); });
}

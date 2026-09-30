/**
 * migrate_status.js — Migra `cases.status` de valores legacy al enum ACTUAL
 * de 21 estados de tracker/data/case_status.js.
 *
 * Historia: D05/D07 armó el enum original con las 14 fases del SVG de
 * Zelky (§H.1, 29-sep). TAREA 21 (30-sep, PM_COMMENTS §H.8 — reemplaza
 * §H.1/§H.3) lo REEMPLAZÓ por el flujo canónico de 13 fases en 5 bloques,
 * tras leer los documentos de Zelky del 26-sep. Esta tabla se actualizó para
 * apuntar a los nombres NUEVOS.
 *
 * ⚠️  SOLO EMULADOR. Se niega a correr si FIRESTORE_EMULATOR_HOST no está
 * definido — NUNCA correr esto contra producción sin que Rick lo confirme.
 * Producción nunca corrió el modelo de 14 fases (nunca se desplegó), así que
 * los valores legacy de abajo (`in_review`, `faddi_ready`, etc.) son los que
 * SÍ podrían existir ahí.
 *
 * ── Legacy pre-fases -> modelo nuevo de 13 fases (§H.8, 30-sep) ─────────────
 *   - `draft`, `submitted`, `pending_docs`, `deleted` — sin cambio de nombre.
 *   - `denied`          -> `denegado`         (terminal)
 *   - `approved`        -> `aprobado`         (terminal)
 *   - `observed`        -> `observado_dnfd`   (no terminal — ver TRANSITIONS)
 *   - `in_review`       -> `fase_08`          (punto de control de
 *                                              documentación — el que más se
 *                                              parece a "en revisión")
 *   - `faddi_ready`     -> `fase_11`          (confección de dossiers, listo
 *                                              para ingresar a FADDI)
 *   - `faddi_submitted` -> `fase_13`          (ya ingresado, en seguimiento
 *                                              post-ingreso — el §H.8 ubica
 *                                              el "ingreso" en fase_12 y el
 *                                              seguimiento en fase_13)
 *   Estos 6 mapeos son los que pidió PM_COMMENTS §H.8 explícitamente.
 *
 * ── `fase_14` (único valor del modelo de 14 fases que NO existe en el de
 *    13 — todo lo demás, fase_01..fase_13, son el MISMO string en ambos
 *    modelos, aunque el SIGNIFICADO de fase_07..fase_13 cambió) ────────────
 *   - `fase_14` (Dossier y presentación) -> `fase_12` (Ingreso ante DNFD e
 *     IEA) — el equivalente semántico más cercano.
 *
 * ── Limitación documentada, no un bug ───────────────────────────────────────
 * `fase_01` a `fase_13` son el MISMO string en el modelo viejo (14 fases) y
 * en el nuevo (13 fases), pero con significado distinto a partir de
 * fase_07 (el modelo nuevo inserta un paso "instrucción al cliente" que no
 * existía, corriendo la numeración). Este script no puede distinguir "un
 * caso que ya nació en el modelo nuevo" de "un caso viejo con ese mismo
 * string y otro significado" — no hay un marcador de versión de esquema en
 * los datos. Como ningún caso de PRODUCCIÓN llegó a usar el modelo de 14
 * fases (nunca se desplegó), esto solo importa para datos sueltos que
 * hubieran quedado en el emulador de sesiones anteriores — y todos los
 * scripts de seed de este repo ya crean datos directo en el modelo nuevo.
 * Si hace falta limpiar datos viejos del emulador, lo más seguro es volver a
 * sembrar (`seed_emulador.js`/`seed_roles.js`), no migrar in situ.
 *
 * ── Uso ──────────────────────────────────────────────────────────────────────
 *   FIRESTORE_EMULATOR_HOST=localhost:8090 \
 *   FIREBASE_PROJECT_ID=demo-farmazed \
 *   node scripts/migrate_status.js [--dry-run]
 *
 * `--dry-run`: calcula y muestra exactamente lo mismo, pero NUNCA llama a
 * batch.commit() — para revisar el resultado antes de escribir nada. Ver
 * ENTREGA_E1_E3.md, plan de salida a producción.
 *
 * Idempotente: un caso cuyo status ya está en el enum de 21 actual (porque
 * ya se migró, o porque nació directo con un valor nuevo) no se toca.
 * Correrlo dos veces seguidas deja "0 casos migrados" la segunda vez.
 */

const DRY_RUN = process.argv.includes('--dry-run');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    '❌ FIRESTORE_EMULATOR_HOST no está definido. Esta migración SOLO corre ' +
    'contra el emulador — la tabla de mapeo es provisional (ver el comentario ' +
    'de este archivo) y no debe tocar producción sin que el PM la confirme.'
  );
  process.exit(1);
}

const admin = require('firebase-admin');
const { CASE_STATUSES, isValidStatus } = require('../data/case_status');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-farmazed' });
}
const db = admin.firestore();

// ─── Tabla de mapeo explícita (única fuente de verdad de esta migración) ────
// legacy -> nuevo (no listado -> falla en voz alta, no pasa desapercibido)
const MAPPING = {
  // Sin cambio de nombre — mismos 4 valores en el enum de 21.
  draft:        'draft',
  submitted:    'submitted',
  pending_docs: 'pending_docs',
  deleted:      'deleted',

  // §H.8 (30-sep) — reemplaza los mapeos provisionales de §H.1.
  denied:           'denegado',
  approved:         'aprobado',
  observed:         'observado_dnfd',
  in_review:        'fase_08',
  faddi_ready:      'fase_11',
  faddi_submitted:  'fase_13',

  // Único valor del modelo de 14 fases que no existe en el de 13 (ver
  // cabecera) — todos los demás fase_01..fase_13 son el mismo string en
  // ambos modelos y no se pueden distinguir de forma confiable.
  fase_14: 'fase_12',
};

// Los valores destino deben, a su vez, existir en el enum de 21 — guard
// estático para que un typo en la tabla de arriba no pase inadvertido.
for (const [legacy, target] of Object.entries(MAPPING)) {
  if (target !== null && !isValidStatus(target)) {
    throw new Error(`migrate_status.js: MAPPING["${legacy}"] = "${target}" no está en CASE_STATUSES (${CASE_STATUSES.join(', ')})`);
  }
}

async function migrate() {
  const snap = await db.collection('cases').get();

  const toMigrate = [];
  const alreadyOk = [];
  const needsDecision = [];
  const unknown = [];

  for (const doc of snap.docs) {
    const status = doc.data().status;

    if (isValidStatus(status)) {
      // Ya está en el enum de 21 (ya migrado, o nació directo con un valor
      // nuevo) — no tocar. Esto es lo que hace la migración idempotente.
      alreadyOk.push(doc.id);
      continue;
    }

    if (!(status in MAPPING)) {
      unknown.push({ id: doc.id, status });
      continue;
    }

    const target = MAPPING[status];
    if (target === null) {
      needsDecision.push({ id: doc.id, status });
      continue;
    }

    toMigrate.push({ id: doc.id, from: status, to: target });
  }

  // Falla en voz alta ANTES de escribir nada si hay valores fuera de la
  // tabla — 07 §1.4 D07: "el script falla en voz alta si encuentra un valor
  // de origen que no este en su tabla, en vez de dejarlo pasar."
  if (unknown.length > 0) {
    console.error('❌ Valores de status fuera de la tabla de mapeo (no se escribió nada):');
    for (const u of unknown) console.error(`   ${u.id}: "${u.status}"`);
    process.exit(1);
  }

  if (needsDecision.length > 0) {
    console.error('⚠️  Casos con status sin destino asignado en MAPPING (no se tocaron):');
    for (const n of needsDecision) console.error(`   ${n.id}: "${n.status}"`);
    console.error('   Ver la tabla MAPPING de este archivo — algún legacy quedó con target: null a propósito.');
  }

  if (toMigrate.length === 0) {
    console.log(`✅ Nada que migrar. ${alreadyOk.length} caso(s) ya en el enum de 21, ${needsDecision.length} pendiente(s) de decisión.`);
    return { migrated: 0, alreadyOk: alreadyOk.length, needsDecision: needsDecision.length };
  }

  if (DRY_RUN) {
    console.log(`🔎 DRY-RUN — se migrarían ${toMigrate.length} caso(s) (nada se escribió):`);
    for (const m of toMigrate) console.log(`   ${m.id}: "${m.from}" -> "${m.to}"`);
    console.log(`   ${alreadyOk.length} ya estaban en el enum de 21.`);
    if (needsDecision.length > 0) console.log(`   ${needsDecision.length} sin destino asignado, quedarían sin tocar.`);
    return { migrated: 0, wouldMigrate: toMigrate.length, alreadyOk: alreadyOk.length, needsDecision: needsDecision.length };
  }

  const batch = db.batch();
  for (const m of toMigrate) {
    batch.update(db.collection('cases').doc(m.id), {
      status: m.to,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }
  await batch.commit();

  console.log(`✅ Migrados ${toMigrate.length} caso(s):`);
  for (const m of toMigrate) console.log(`   ${m.id}: "${m.from}" -> "${m.to}"`);
  console.log(`   ${alreadyOk.length} ya estaban en el enum de 21.`);
  if (needsDecision.length > 0) console.log(`   ${needsDecision.length} sin destino asignado, sin tocar (ver arriba).`);

  return { migrated: toMigrate.length, alreadyOk: alreadyOk.length, needsDecision: needsDecision.length };
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});

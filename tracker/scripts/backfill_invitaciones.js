/**
 * backfill_invitaciones.js — TAREA 39c. Normaliza el correo (trim + minúsculas) de
 * las invitaciones creadas ANTES de TAREA 39b (que sí lo normaliza al crearlas):
 * sin esto, el 409 de `register.js` ("tienes una invitación pendiente") busca por
 * correo en minúsculas y no vería las invitaciones viejas guardadas con mayúsculas
 * o espacios, y el registro abierto podría "ocupar" ese correo.
 *
 * NO toca `expiresAt`: las invitaciones viejas sin él se tratan como creadas + 7
 * días en el código (routes/invitations.js), sin backfill.
 *
 * Mismo patrón y MISMOS modos que migrate_roles.js (resolverModo compartido):
 *   emulador:    node scripts/backfill_invitaciones.js [--dry-run]            (escribe, salvo --dry-run)
 *   producción:  node scripts/backfill_invitaciones.js --prod --project=<id>  (DRY-RUN por defecto: lista)
 *                node scripts/backfill_invitaciones.js --prod --project=<id> --confirm   (escribe de verdad)
 * Idempotente: una segunda corrida no encuentra nada que cambiar. Ver DEPLOY.md.
 */
const { resolverModo } = require('./migrate_roles');
const { enmascararCorreo } = require('../utils/validar_texto');

const LOTE = 400; // un batch de Firestore admite hasta 500 escrituras

async function normalizarInvitaciones({ db, dryRun, log = console.log }) {
  const prefijo = dryRun ? '[dry-run] ' : '';
  const snap = await db.collection('invitations').get();
  const pendientes = [];
  let intactas = 0;
  for (const d of snap.docs) {
    const { email } = d.data();
    const normalizado = String(email ?? '').trim().toLowerCase();
    if (!email || email === normalizado) { intactas++; continue; }
    pendientes.push({ ref: d.ref, normalizado });
    // los correos salen enmascarados (la consola puede quedar en un historial/log de Cloud Shell)
    log(`  ${prefijo}${d.id.slice(0, 6)}…: ${enmascararCorreo(email.trim())} (se normalizaría${email !== email.trim() ? ': espacios' : ''}${email.trim() !== normalizado ? ': mayúsculas' : ''})`);
  }
  if (!dryRun) {
    for (let i = 0; i < pendientes.length; i += LOTE) {
      const batch = db.batch();
      pendientes.slice(i, i + LOTE).forEach(p => batch.update(p.ref, { email: p.normalizado }));
      await batch.commit();
    }
  }
  log(`${dryRun ? '🔎 DRY-RUN' : '✅ Backfill'} completo: ${pendientes.length} invitación(es) ${dryRun ? 'se normalizarían' : 'normalizada(s)'}, ${intactas} ya estaban bien.`);
  return { cambios: pendientes.length, intactas };
}

if (require.main !== module) {
  module.exports = { normalizarInvitaciones };
} else {
  const modo = resolverModo(process.argv.slice(2), process.env);
  if (modo.error) {
    console.error(`❌ ${modo.error}`);
    process.exit(1);
  }
  const admin = require('../utils/firebase_admin.js');
  admin.initializeApp({ projectId: modo.proyecto || process.env.FIREBASE_PROJECT_ID || 'demo-farmazed' });
  if (modo.prod) {
    console.log(`⚠️  PRODUCCIÓN — proyecto "${admin.app().options.projectId}" — ${modo.dryRun ? 'DRY-RUN (no se escribe nada; para aplicar: --prod --project=<id> --confirm)' : 'ESCRIBE de verdad (--prod --confirm)'}`);
  }
  normalizarInvitaciones({ db: admin.firestore(), dryRun: modo.dryRun })
    .then(() => process.exit(0))
    .catch(err => { console.error('❌ Backfill error:', err); process.exit(1); });
}

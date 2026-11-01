/**
 * seed_demo.js — Siembra (o reinicia) las cuentas y datos del modo demo (services/demo.js).
 *
 *   # emuladores (demo local):
 *   FIRESTORE_EMULATOR_HOST=localhost:8090 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   FIREBASE_PROJECT_ID=demo-farmazed node scripts/seed_demo.js
 *
 *   # producción (Cloud Shell, tras el deploy): exige --prod --project=<id> --confirm
 *   node scripts/seed_demo.js --prod --project=farmazed --confirm
 *
 * Variables: DEMO_PASSWORD_CLIENTE y DEMO_PASSWORD_REGENTE (obligatorias la primera vez; nunca en el
 * repo), DEMO_DOMINIO (opcional, por defecto farmazed.com).
 */
const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const proyecto = argv.find(a => a.startsWith('--project='))?.slice('--project='.length);

if (!process.env.FIRESTORE_EMULATOR_HOST && !prod) {
  console.error('❌ Sin FIRESTORE_EMULATOR_HOST este script solo corre con --prod --project=<id> --confirm.');
  process.exit(1);
}
if (prod && (!proyecto || !argv.includes('--confirm'))) {
  console.error('❌ Contra un proyecto real hacen falta --project=<id> y --confirm (reescribe la empresa demo y sus 2 cuentas).');
  process.exit(1);
}

const admin = require('../utils/firebase_admin.js');
if (!admin.apps.length) admin.initializeApp({ projectId: proyecto || process.env.FIREBASE_PROJECT_ID || 'demo-farmazed' });
const { sembrarDemo } = require('../services/demo');

sembrarDemo().then(r => {
  console.log(`✅ Demo sembrada (empresa ${r.orgId}). Cuentas:`);
  for (const c of r.cuentas) console.log(`   ${c.correo.padEnd(30)} ${c.rol}`);
  process.exit(0);
}).catch(err => { console.error('❌ seed_demo:', err); process.exit(1); });

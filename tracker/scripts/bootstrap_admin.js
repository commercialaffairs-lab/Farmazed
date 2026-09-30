/**
 * bootstrap_admin.js — TAREA 16(a): da el PRIMER admin por línea de
 * comandos, con credenciales de GCP — NUNCA por HTTP.
 *
 * Antes de esta tarea, `POST /api/admin/set-role` con `x-admin-key`
 * (`ADMIN_KEY`) era la única forma de dar el primer admin — pero como
 * cualquiera con esa clave se volvía admin sin invitación ni auditoría,
 * quedaba como una puerta trasera permanente al modelo de roles de E3. Ese
 * endpoint ahora exige token de Firebase + rol admin (ver tracker/index.js),
 * lo cual resuelve bien el caso normal ("un admin invita a otro admin") pero
 * deja un problema real: ¿cómo se da el PRIMERÍSIMO admin, cuando todavía no
 * existe ninguno que pueda invitar? Este script es la respuesta — usa
 * credenciales de GCP (Application Default Credentials, vía
 * `gcloud auth application-default login`, o
 * `GOOGLE_APPLICATION_CREDENTIALS` apuntando a una service account key) que
 * ya implican acceso administrativo al proyecto, así que no necesita su
 * propia autenticación.
 *
 * A propósito NO tiene el guardado "SOLO EMULADOR" del resto de scripts/ —
 * su trabajo es justamente poder correr contra producción cuando haga falta
 * (Rick, con sus propias credenciales de gcloud). Contra el emulador
 * funciona igual si FIREBASE_AUTH_EMULATOR_HOST está definido — así es como
 * se probó aquí, sin tocar producción.
 *
 * Uso:
 *   node scripts/bootstrap_admin.js --email=correo@farmazed.com
 *   node scripts/bootstrap_admin.js --uid=abc123XYZ
 *
 * La cuenta de Firebase Auth debe existir de antes (créala manualmente en la
 * consola de Firebase, o con cualquier método que ya tengas, antes de correr
 * esto — este script SOLO asigna el claim, no crea usuarios).
 */

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'farmazed' });
}

function arg(name) {
  const prefix = `--${name}=`;
  const found  = process.argv.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function main() {
  const email = arg('email');
  const uid   = arg('uid');
  if (!email && !uid) {
    console.error('Uso: node scripts/bootstrap_admin.js --email=correo@dominio.com   (o --uid=xxx)');
    process.exit(1);
  }

  const user = uid ? await admin.auth().getUser(uid) : await admin.auth().getUserByEmail(email);
  const existing = user.customClaims || {};

  if (existing.role === 'admin') {
    console.log(`${user.email} (${user.uid}) ya es admin — nada que hacer.`);
    return;
  }

  await admin.auth().setCustomUserClaims(user.uid, { ...existing, admin: true, role: 'admin' });

  console.log(`✅ ${user.email} (${user.uid}) ahora es admin.`);
  console.log('   Debe cerrar sesión y volver a entrar (o esperar a que Firebase renueve su token, hasta 1 hora) para que el rol tome efecto.');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

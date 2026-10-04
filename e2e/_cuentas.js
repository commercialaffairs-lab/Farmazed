// e2e/_cuentas.js — TAREA 42. Cuentas de cliente listas para usar, creadas por el Admin SDK
// contra el emulador (el registro abierto exige verificar el correo y completar la captación:
// eso ya lo recorren registro.spec.js y plan_*.spec.js; los demás specs solo necesitan un cliente).
const admin = require('firebase-admin');

async function crearTitularVerificado(email, password, nombre) {
  process.env.FIRESTORE_EMULATOR_HOST = `localhost:${process.env.FZ_FIRESTORE_PORT}`;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${process.env.FZ_AUTH_PORT}`;
  if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });
  const orgId = `org-e2e-${Date.now()}`;
  await admin.firestore().collection('orgs').doc(orgId).set({ nombre: `${nombre} Co`, createdAt: admin.firestore.Timestamp.now() });
  const u = await admin.auth().createUser({ email, password, displayName: nombre, emailVerified: true });
  await admin.auth().setCustomUserClaims(u.uid, { role: 'cliente_titular', orgId });
  return { uid: u.uid, orgId };
}

module.exports = { crearTitularVerificado };

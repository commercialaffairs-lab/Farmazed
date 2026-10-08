/**
 * firebase_admin.js — firebase-admin 14 quitó la API de namespace (`admin.auth()`,
 * `admin.firestore()`, `admin.firestore.FieldValue`, `admin.apps`…). Este módulo la expone igual
 * sobre las APIs modulares, para no reescribir ~200 llamadas: todo el tracker hace
 * `require('…/utils/firebase_admin')` donde antes hacía `require('firebase-admin')`.
 */
const app = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

module.exports = {
  initializeApp: app.initializeApp,
  get apps() { return app.getApps(); },
  app: (nombre) => app.getApp(nombre),
  credential: { applicationDefault: app.applicationDefault, cert: app.cert },
  auth: () => getAuth(),
  firestore: Object.assign(() => getFirestore(), { FieldValue, Timestamp }),
  storage: () => getStorage(),
};

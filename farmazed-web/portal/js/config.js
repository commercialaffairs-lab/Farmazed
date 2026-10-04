/**
 * Farmazed Portal — Configuration
 * 
 * ⚠️  DEVELOPER TOUCHPOINT #1
 * Fill in your Firebase project config below.
 * Get it from: Firebase Console → Project Settings → General → Your apps → SDK setup
 */
const FIREBASE_CONFIG_PROD = {
  apiKey:            "AIzaSyDVsZxaNW48VFF68bz-SYnOwzR6O6Fio_o",
  authDomain:        "farmazed.firebaseapp.com",
  projectId:         "farmazed",
  storageBucket:     "farmazed.firebasestorage.app",
  messagingSenderId: "267037695065",
  appId:             "1:267037695065:web:d2d8864b539b3b9469a548",
};

const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// En local, un proyecto "demo-" apunta el SDK al modo offline de los
// emuladores — no hay forma de que esto llegue a producción por accidente.
// Ver DEV_LOCAL.md.
const FIREBASE_CONFIG_LOCAL = {
  apiKey:            "demo-api-key",
  authDomain:        "demo-farmazed.firebaseapp.com",
  projectId:         "demo-farmazed",
  storageBucket:     "demo-farmazed.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:0000000000000000000000",
};

const FIREBASE_CONFIG = IS_LOCAL ? FIREBASE_CONFIG_LOCAL : FIREBASE_CONFIG_PROD;

/**
 * ⚠️  DEVELOPER TOUCHPOINT #2
 * API base URL — set to your deployed Cloud Run URL or localhost for dev.
 */
// Puerto del tracker en local: 8080 por convención, salvo que algo (ej.
// e2e/run.sh, cuando 8080 ya está ocupado en la máquina) pida otro puerto
// via ?apiPort= en la URL o localStorage — nunca vía editar este archivo.
// Solo aplica dentro de IS_LOCAL, nunca afecta producción.
function localApiPort() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('apiPort');
    if (fromQuery) return fromQuery;
    const fromStorage = localStorage.getItem('fzApiPort');
    if (fromStorage) return fromStorage;
  } catch (e) { /* localStorage puede fallar en modo privado — usar el default */ }
  return '8080';
}

// TAREA 31: usa el MISMO hostname con el que se cargó esta página
// (`window.location.hostname`), no un 'localhost' fijo — si alguien entra
// por `127.0.0.1` (p.ej. un túnel SSH que resuelve así, como el de Rick
// desde Argus), las llamadas a la API deben salir desde ese mismo origen,
// no saltar a otro (eso rompe CORS: el navegador manda el Origin de la
// página, no el host al que apunta el fetch — pero mezclar hosts también
// puede fallar la resolución DNS/túnel si solo uno de los dos está
// tuneleado). Sigue dentro de IS_LOCAL, nunca afecta producción.
const API_BASE = IS_LOCAL
  ? `http://${window.location.hostname}:${localApiPort()}`
  : 'https://api.farmazed.com';   // update after deploying tracker/ to Cloud Run

// TAREA 32: mismo mecanismo que `localApiPort()` arriba, pero para el
// emulador de Auth — hacía falta cuando una corrida de pruebas necesita su
// PROPIO emulador de Auth, en un puerto distinto al de siempre (9099), para
// no interferir con otra corrida que ya lo esté usando (p.ej. la demo de
// Rick en tmux farmazed-demo, TAREA 30). `auth.js` (connectAuthEmulator) es
// el único lector — nunca afecta producción (ver IS_LOCAL ahí).
function localAuthPort() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('authPort');
    if (fromQuery) return fromQuery;
    const fromStorage = localStorage.getItem('fzAuthPort');
    if (fromStorage) return fromStorage;
  } catch (e) { /* localStorage puede fallar en modo privado — usar el default */ }
  return '9099';
}

/**
 * Feature flags. Ver PM_COMMENTS.md §H.2 (29-sep).
 *
 * `clientePrecios`: módulo "Precios" del portal cliente (TAREA 10/11) —
 * alcance nuevo, no pedido originalmente. Mostrar el tarifario completo al
 * cliente es una decisión comercial de Rick, no solo técnica — 5 de los 13
 * montos pueden estar subfacturados frente al xlsx canónico (ver
 * organizacion/05_DIFF_PRECIOS_D09.md). Apagado por defecto: ni el link del
 * nav se agrega, ni el módulo carga datos. Encendible SOLO dentro de
 * IS_LOCAL (nunca en producción, pase lo que pase en la URL/localStorage) —
 * así el spec de e2e lo puede probar sin que quede prendido para nadie más.
 */
function isFeatureOn(name) {
  if (!IS_LOCAL) return false;
  try {
    if (new URLSearchParams(window.location.search).get(`feature_${name}`) === '1') return true;
    if (localStorage.getItem(`feature_${name}`) === '1') return true;
  } catch (e) { /* localStorage puede fallar en modo privado */ }
  return false;
}
const FEATURES = {
  clientePrecios: isFeatureOn('clientePrecios'),
};

export { FIREBASE_CONFIG, API_BASE, IS_LOCAL, FEATURES, localAuthPort };

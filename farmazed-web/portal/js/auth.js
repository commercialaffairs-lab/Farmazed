/**
 * Farmazed Portal — Auth helpers (Firebase Auth v10 modular SDK)
 */
import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, updateProfile }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { FIREBASE_CONFIG, API_BASE, IS_LOCAL } from './config.js';

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);

// Solo en localhost: nunca toca el Auth real de producción. Ver DEV_LOCAL.md.
if (IS_LOCAL) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
}

// ── Token cache (refreshed by onAuthStateChanged) ─────────────────────────────
let _currentToken = null;
let _currentUser  = null;

onAuthStateChanged(auth, async (user) => {
  _currentUser  = user;
  _currentToken = user ? await user.getIdToken() : null;
});

/** Register new client */
async function register(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  _currentToken = await cred.user.getIdToken();
  _currentUser  = cred.user;
  return cred.user;
}

/** Login */
async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  _currentToken = await cred.user.getIdToken();
  _currentUser  = cred.user;
  return cred.user;
}

/** Logout */
async function logout() {
  await signOut(auth);
  _currentToken = null;
  _currentUser  = null;
  window.location.href = '/login.html';
}

/**
 * Get fresh token (auto-refresh).
 *
 * TAREA 26: causa raíz de un flake e2e visto muchas veces con distintos
 * síntomas ("Invalid or expired token", "dialog.accept: Not attached a una
 * página activa" en el siguiente test, etc.) — justo después de un redirect
 * a una página nueva (p.ej. tras login), `_currentUser` arranca en `null` y
 * solo se llena cuando `onAuthStateChanged` dispara de forma ASÍNCRONA al
 * restaurar la sesión persistida por Firebase. Si algo llama a `getToken()`
 * (cualquier request autenticado de api.js) en esa ventana — real en la app,
 * no solo en las pruebas: un clic inmediato tras el redirect a un dashboard —
 * `_currentUser` seguía en `null` y esta función devolvía `null` sin llegar
 * a intentarlo, mandando un token inválido al backend. `auth.authStateReady()`
 * (Firebase v10.7+) resuelve en cuanto el SDK terminó de resolver el estado
 * inicial de sesión — de ahí en más, `auth.currentUser` es la fuente de
 * verdad real, no la variable de módulo que puede ir un paso atrás.
 */
async function getToken() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return null;
  _currentUser  = user;
  _currentToken = await user.getIdToken(/* forceRefresh= */ false);
  return _currentToken;
}

/**
 * Guard: if user is not logged in, redirect to login.
 * Call at the top of every protected page.
 */
function requireLogin(redirectTo = '/login.html') {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        _currentUser  = user;
        _currentToken = await user.getIdToken();
        resolve(user);
      }
    });
  });
}

/** Check if current user has admin claim */
async function isAdmin() {
  if (!_currentUser) return false;
  const result = await _currentUser.getIdTokenResult();
  return !!result.claims.admin || result.claims.role === 'admin';
}

// TAREA 15 (E3 parte 2, PM_COMMENTS §H.4): helpers de rol para las páginas
// del back-office. El FRONT solo lee estos valores para decidir A QUÉ
// PÁGINA dejar entrar — qué puede HACER dentro de cada página sigue
// saliendo de GET /api/me/permissions (tracker/middleware/permissions.js),
// nunca de un if de rol repetido aquí.
const STAFF_ROLES = ['analista', 'abogado', 'regente'];

/** Rol efectivo (claim `role`, o el fallback legacy — mismo criterio que
 * effectiveRole() en el backend: admin:true -> 'admin', si no
 * 'cliente_titular'). */
async function getRole() {
  if (!_currentUser) return null;
  const result = await _currentUser.getIdTokenResult();
  if (result.claims.role) return result.claims.role;
  return result.claims.admin ? 'admin' : 'cliente_titular';
}

async function getOrgId() {
  if (!_currentUser) return null;
  const result = await _currentUser.getIdTokenResult();
  return result.claims.orgId || null;
}

/** ¿Analista, abogado o regente? (empleado Farmazed, no admin ni cliente). */
async function isStaff() {
  return STAFF_ROLES.includes(await getRole());
}

/** ¿Puede entrar a las páginas de back-office (casos.html/expediente.html)?
 * admin ve todo; staff ve lo suyo (el backend ya filtra por asignación). */
async function hasBackofficeAccess() {
  return (await isAdmin()) || (await isStaff());
}

export {
  auth, register, login, logout, getToken, requireLogin, isAdmin, API_BASE,
  getRole, getOrgId, isStaff, hasBackofficeAccess,
};

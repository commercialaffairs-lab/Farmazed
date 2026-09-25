/**
 * Farmazed Portal — Auth helpers (Firebase Auth v10 modular SDK)
 */
import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, updateProfile }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { FIREBASE_CONFIG, API_BASE } from './config.js';

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);

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

/** Get fresh token (auto-refresh) */
async function getToken() {
  if (!_currentUser) return null;
  _currentToken = await _currentUser.getIdToken(/* forceRefresh= */ false);
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
  return !!result.claims.admin;
}

export { auth, register, login, logout, getToken, requireLogin, isAdmin, API_BASE };

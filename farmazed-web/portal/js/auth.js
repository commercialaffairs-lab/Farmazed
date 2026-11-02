/**
 * Farmazed Portal — Auth helpers (Firebase Auth v10 modular SDK)
 */
import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, updateProfile }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { FIREBASE_CONFIG, API_BASE, IS_LOCAL, AUTH_REAL, localAuthPort } from './config.js';

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);

// Idiomas (farmazed-web/i18n/README.md): i18n.js es un script clásico del <head> de las páginas
// traducidas. Este módulo también lo cargan páginas sin esa capa (login, verificar-correo…), por eso
// el fallback devuelve el español tal cual.
const i18n = () => window.FZI18N || null;
const t = (texto, vars) => (i18n() ? i18n().t(texto, vars) : String(texto ?? ''));

/**
 * Pinta un texto (o un atributo) traducido y deja el elemento preparado para retraducirse al cambiar
 * de idioma. Texto: `data-i18n` + data-i18n-es (la capa lo repasa sola). Atributo: se vuelve a poner
 * desde onCambio (no se usa data-i18n-attr: su clave data-* lleva un guion y el navegador la rechaza).
 */
function marcarTraducible(el, textoEs, atributo) {
  if (atributo) {
    el.setAttribute(atributo, t(textoEs));
    i18n()?.onCambio(() => { el.setAttribute(atributo, t(textoEs)); });
    return el;
  }
  el.dataset.i18nEs = textoEs;
  el.setAttribute('data-i18n', '');
  el.textContent = t(textoEs);
  return el;
}

// Solo en localhost: nunca toca el Auth real de producción. Ver DEV_LOCAL.md.
// TAREA 32: mismo hostname de la página (no 'localhost' fijo, ver TAREA 31 en
// config.js) y puerto configurable (localAuthPort() — 9099 por defecto, para
// cuando una corrida de pruebas necesita su propio emulador de Auth sin
// pisar el de otra corrida ya viva, p.ej. la demo de Rick).
if (IS_LOCAL && !AUTH_REAL) { // AUTH_REAL: proyecto de pruebas de verdad (correos reales), ver config.js
  connectAuthEmulator(auth, `http://${window.location.hostname}:${localAuthPort()}`, { disableWarnings: true });
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

/**
 * Guard de las páginas protegidas de verdad (TAREA 32, §H.13): además de
 * exigir sesión (requireLogin), exige correo verificado — el registro
 * abierto crea la cuenta con `emailVerified:false` hasta que Firebase
 * confirme el link que manda por correo (en el emulador, sale en su
 * consola/UI, ver DEV_LOCAL.md). Las cuentas de invitación (titular/
 * miembro/empleado) quedan `emailVerified:true` automáticamente al aceptar
 * — Farmazed ya validó ese correo al invitarlo, nunca pasan por esta
 * pantalla. `login.html` no usa este guard (ahí no hay nada que proteger
 * todavía) — lo usan el resto de las páginas (dashboards, wizard, admin/*).
 */
async function requireVerifiedLogin(redirectToLogin = '/login.html', redirectToVerify = '/verificar-correo.html') {
  const user = await requireLogin(redirectToLogin);
  if (!user.emailVerified) {
    window.location.href = redirectToVerify;
    return null;
  }
  // TAREA 34 (encontrado con e2e real, no es solo cosmético): `user.emailVerified`
  // es un dato de PERFIL que Firebase puede refrescar solo al restaurar la
  // sesión — pero el ID TOKEN cacheado (el que `getToken()`/`api.js` mandan
  // en cada llamada) sigue con `email_verified:false` grabado adentro hasta
  // que algo lo fuerce a renovarse. `requireAuth` (backend) exige ese claim
  // del TOKEN, no del perfil — sin este refresh, cualquier llamada a la API
  // justo después de entrar (sin haber pasado por el botón "Ya verifiqué,
  // continuar" de verificar-correo.html, que SÍ fuerza el refresh) daba 403
  // aunque la pantalla ya hubiera dejado pasar al usuario.
  await user.getIdToken(true);
  return user;
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

/** ¿Cuenta de demostración? (claim `demo:true`, services/demo.js). */
async function esDemo() {
  if (!_currentUser) return false;
  return (await _currentUser.getIdTokenResult()).claims.demo === true;
}

/**
 * Botón [Reiniciar cuenta demo] (Rick, 01-nov): solo para cuentas demo. Lo pinta dentro del
 * contenedor que se le pase; al confirmar llama a POST /api/demo/reiniciar y cierra la sesión
 * (el reinicio revoca los tokens: la persona vuelve a entrar y arranca el recorrido de cero).
 */
async function montarBotonDemo(contenedor) {
  if (!contenedor || !(await esDemo())) return null;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-reiniciar-demo';
  btn.className = 'btn btn-sm btn-warning fw-semibold';
  // Texto en un <span data-i18n> y título con data-i18n-attr: la capa los retraduce al cambiar de idioma.
  btn.appendChild(marcarTraducible(document.createElement('span'), 'Reiniciar cuenta demo'));
  marcarTraducible(btn, 'Vuelve a dejar la cuenta de demostración como al principio del recorrido', 'title');
  btn.addEventListener('click', async () => {
    const { confirmar, avisar } = await import('./dialogos.js');
    if (!(await confirmar(t('Se borrarán los cambios que hiciste en la demo y todo volverá al estado inicial. ¿Reiniciar?')))) return;
    btn.disabled = true;
    try {
      const { default: api } = await import('./api.js');
      await api.reiniciarDemo();
      await avisar(t('Demo reiniciada. Vuelve a iniciar sesión para empezar el recorrido desde el principio.'));
      await logout();
    } catch (err) {
      btn.disabled = false;
      await avisar(t('Error: {error}', { error: err.message }));
    }
  });
  contenedor.prepend(btn);
  return btn;
}

/**
 * Enlace "Ayuda" del topbar del back-office → manual de usuario (farmazed-web/manual/, generado por
 * tracker/scripts/generar_manual.js, ES/EN/FR/PT). Para todo el personal, no solo la demo: el manual
 * también sirve de referencia del flujo. Se inserta antes del nombre del usuario (#user-name); en
 * las páginas sin ese elemento (expediente.html, topbar oscuro) se cuelga del bloque derecho del topbar.
 */
// Manual del regente (solo la demo tiene recorrido de regente; Rick, 01-nov-2026): farmazed-web/manual/regente/.
const manualUrl = (idioma) => `/manual/regente/${encodeURIComponent(idioma || 'es')}.html`;

function montarEnlaceAyuda(nombre) {
  if (document.getElementById('tb-ayuda')) return null;
  const topbar = nombre?.parentElement || document.querySelector('.topbar');
  if (!topbar) return null;
  const a = document.createElement('a');
  a.id = 'tb-ayuda';
  a.href = manualUrl(i18n()?.idioma());
  a.target = '_blank';
  a.rel = 'noopener';
  marcarTraducible(a, 'Manual de usuario (español, inglés, francés y portugués)', 'title');
  a.innerHTML = '<i class="bi bi-question-circle me-1"></i>';
  a.appendChild(marcarTraducible(document.createElement('span'), 'Ayuda'));
  if (nombre) {
    a.className = 'small ms-auto me-3 text-decoration-none';
    nombre.insertAdjacentElement('beforebegin', a);
  } else {
    a.className = 'small text-white-50 text-decoration-none';
    (topbar.querySelector('.ms-auto') || topbar).append(a);
  }
  // El manual se abre en el idioma activo (recorrido.js hace lo mismo para las cuentas demo).
  i18n()?.onCambio((idioma) => { a.href = manualUrl(idioma); });
  return a;
}

/**
 * Selector ES · EN · FR · PT del topbar del back-office, junto al enlace "Ayuda" (o antes del nombre
 * del usuario, o en el bloque derecho del topbar oscuro). Solo si la página carga i18n.js; idempotente.
 */
function montarSelectorIdioma(nombre) {
  if (!i18n() || document.getElementById('fz-idiomas-topbar')) return null;
  const topbar = nombre?.parentElement || document.querySelector('.topbar');
  if (!topbar) return null;
  const wrapper = document.createElement('span');
  wrapper.id = 'fz-idiomas-topbar';
  wrapper.className = 'me-3 d-inline-flex align-items-center';
  const ayuda = document.getElementById('tb-ayuda');
  if (ayuda) {
    // "Ayuda" llevaba el ms-auto que empuja el bloque a la derecha: pasa al selector, que ahora va primero.
    if (ayuda.classList.contains('ms-auto')) { ayuda.classList.remove('ms-auto'); wrapper.classList.add('ms-auto'); }
    ayuda.insertAdjacentElement('beforebegin', wrapper);
  } else if (nombre) {
    wrapper.classList.add('ms-auto');
    nombre.insertAdjacentElement('beforebegin', wrapper);
  } else {
    (topbar.querySelector('.ms-auto') || topbar).append(wrapper);
  }
  try {
    i18n().montarSelector(wrapper, { oscuro: true });
  } catch (err) {
    // Un fallo del selector no puede tumbar el arranque del back-office (initBackoffice).
    console.error('[i18n] no se pudo montar el selector de idioma', err);
    wrapper.remove();
    return null;
  }
  return wrapper;
}

/**
 * Panel "Recorrido demo" del back-office (regente demo). A dónde lleva "Ir al paso" en cada paso
 * (services/demo_recorrido.js, PASOS_REGENTE). Import dinámico: recorrido.js importa este módulo.
 */
const DESTINOS_RECORRIDO_STAFF = {
  documento: '/admin/expediente.html?id=demo-caso-3',
  cotejo:    '/admin/expediente.html?id=demo-caso-3',
  lead:      '/admin/leads.html',
};
async function montarRecorridoBackoffice() {
  if (!(await esDemo())) return null;
  const { montarRecorrido } = await import('./recorrido.js');
  return montarRecorrido({ irA: (paso) => {
    const destino = DESTINOS_RECORRIDO_STAFF[paso];
    if (!destino) return;
    if (window.location.pathname + window.location.search === destino) window.scrollTo({ top: 0, behavior: 'smooth' });
    else window.location.href = destino;
  } });
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

/** Escapa texto de usuario/BD antes de meterlo en innerHTML (C1, TAREA 37). */
const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => HTML_ESC[c]);
}

/**
 * Arranque común de las páginas del back-office (admin/staff): login verificado, acceso de
 * back-office (si no, al portal del cliente), nombre y "Cerrar sesión" en el menú, y los enlaces
 * solo-admin (Empresas, Precios, Configuración) visibles para el admin. Devuelve `{ user, admin }`,
 * o `null` si ya se redirigió (login, verificar correo o portal del cliente): la página debe parar.
 */
// Rótulos en español (clave del diccionario); se traducen al pintarlos: t('Analista'), t('Abogado'),
// t('Regente'), t('Admin Panel'), t('Personal') — escritos aquí como literales para la prueba de cobertura.
const ROTULO_STAFF = { analista: 'Analista', abogado: 'Abogado', regente: 'Regente' };

async function initBackoffice() {
  const user = await requireVerifiedLogin('/login.html');
  if (!user) return null; // en camino a verificar-correo.html
  if (!(await hasBackofficeAccess())) { window.location.href = '/client-dashboard.html'; return null; }
  const nombre = document.getElementById('user-name') || document.getElementById('admin-name');
  if (nombre) nombre.textContent = user.displayName || user.email;
  document.getElementById('sidebar-logout')?.addEventListener('click', logout);
  const admin = await isAdmin();
  await montarBotonDemo(nombre?.parentElement || document.querySelector('.topbar'));
  montarEnlaceAyuda(nombre);
  montarSelectorIdioma(nombre);
  await montarRecorridoBackoffice();
  const rotulo = document.getElementById('sidebar-rol');
  if (rotulo) marcarTraducible(rotulo, admin ? 'Admin Panel' : (ROTULO_STAFF[await getRole()] || 'Personal'));
  if (admin) {
    for (const id of ['nav-empresas', 'nav-precios', 'nav-finanzas', 'nav-configuracion']) {
      const enlace = document.getElementById(id);
      if (enlace) enlace.style.display = '';
    }
  }
  return { user, admin };
}

export {
  initBackoffice, esc, auth, register, login, logout, getToken, requireLogin, requireVerifiedLogin, isAdmin, API_BASE,
  getRole, getOrgId, isStaff, hasBackofficeAccess, esDemo, montarBotonDemo,
};

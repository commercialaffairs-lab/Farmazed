/**
 * Farmazed Portal — Auth helpers (Firebase Auth v10 modular SDK)
 */
import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword }
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
 * Cambio de contraseña desde Configuración (admin/configuracion.html). Firebase exige volver a
 * autenticar con la contraseña actual justo antes de cambiarla: si no coincide lanza
 * auth/wrong-password o auth/invalid-credential; si la nueva no pasa la política, auth/weak-password.
 * La página valida antes (mínimo 10 caracteres con letras y números) y traduce esos códigos.
 */
async function cambiarContrasena(actual, nueva) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || !user.email) throw Object.assign(new Error(t('No hay una sesión activa.')), { code: 'auth/no-current-user' });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, actual));
  await updatePassword(user, nueva);
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
  if (result.claims.demo === true && result.claims.simulacion === true) return perfilSimulacion() === 'admin'; // simulación: manda la pestaña
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
  // Simulación: el rol es el perfil elegido en el topbar (el tracker aplica el mismo criterio con X-Fz-Perfil).
  if (result.claims.demo === true && result.claims.simulacion === true) return perfilSimulacion();
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

// ── Simulación (Rick, 14-nov-2026) ─────────────────────────────────────────────────────────────────
// Una sola cuenta (simulacion@farmazed.com, claims demo:true + simulacion:true) para entrenar al personal: el topbar
// muestra una pestaña por perfil y al pulsarla cambia el layout. El perfil elegido se guarda en localStorage y viaja
// al tracker en la cabecera X-Fz-Perfil (api.js): allí pasa a ser el rol efectivo (middleware/auth.js). Para el resto
// de cuentas la cabecera no tiene efecto. Rótulos = claves del diccionario (se retraducen al cambiar de idioma).
const PERFILES_SIM = [
  { id: 'cliente_titular', rotulo: 'Cliente',                   destino: '/client-dashboard.html' },
  { id: 'admin',           rotulo: 'Administrador',             destino: '/admin/bandeja.html' },
  { id: 'regente',         rotulo: 'Responsable Farmacéutico',  destino: '/admin/bandeja.html' },
  { id: 'abogado',         rotulo: 'Responsable Legal',         destino: '/admin/bandeja.html' },
];
const CLAVE_PERFIL_SIM = 'fzPerfilSim';
const PERFIL_SIM_POR_DEFECTO = 'cliente_titular';

/** ¿La cuenta de simulación? (claims demo:true + simulacion:true). */
async function esSimulacion() {
  if (!_currentUser) return false;
  const { claims } = await _currentUser.getIdTokenResult();
  return claims.demo === true && claims.simulacion === true;
}

/** Perfil elegido en el topbar (válido o el de por defecto, Cliente). */
function perfilSimulacion() {
  try {
    const v = localStorage.getItem(CLAVE_PERFIL_SIM);
    return PERFILES_SIM.some(p => p.id === v) ? v : PERFIL_SIM_POR_DEFECTO;
  } catch (e) { return PERFIL_SIM_POR_DEFECTO; }
}

function fijarPerfilSimulacion(id) {
  if (!PERFILES_SIM.some(p => p.id === id)) return false;
  try { localStorage.setItem(CLAVE_PERFIL_SIM, id); } catch (e) { /* sin localStorage: el perfil no se recuerda */ }
  return true;
}

/** Cabecera que api.js añade a cada petición: el perfil elegido (el tracker solo la honra en la cuenta de simulación). */
function cabecerasPerfil() {
  try {
    const v = localStorage.getItem(CLAVE_PERFIL_SIM);
    return v && PERFILES_SIM.some(p => p.id === v) ? { 'X-Fz-Perfil': v } : {};
  } catch (e) { return {}; }
}

/** Cambia de perfil y lleva al layout de ese perfil (portal del cliente o back-office). */
function cambiarPerfilSimulacion(id) {
  const perfil = PERFILES_SIM.find(p => p.id === id);
  if (!perfil || !fijarPerfilSimulacion(id)) return;
  window.location.href = perfil.destino;
}

const CSS_SIM = `
#fz-sim-perfiles{display:inline-flex;align-items:center;gap:.3rem;background:#111827;border:2px solid #f59e0b;border-radius:999px;padding:.25rem .45rem;margin:0 .75rem;flex-wrap:wrap}
#fz-sim-perfiles .fz-sim-titulo{font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:.68rem;color:#fbbf24;padding:0 .45rem}
#fz-sim-perfiles .fz-sim-pestana{border:0;border-radius:999px;padding:.4rem .85rem;font-weight:800;font-size:.86rem;letter-spacing:.02em;background:transparent;color:#fff;cursor:pointer;line-height:1;white-space:nowrap}
#fz-sim-perfiles .fz-sim-pestana:hover{background:rgba(255,255,255,.14)}
#fz-sim-perfiles .fz-sim-pestana:focus-visible{outline:2px solid #fbbf24;outline-offset:2px}
#fz-sim-perfiles .fz-sim-pestana.activa{background:#f59e0b;color:#111827}
@media (max-width:991px){#fz-sim-perfiles .fz-sim-titulo{display:none}#fz-sim-perfiles .fz-sim-pestana{padding:.35rem .6rem;font-size:.78rem}}
/* En la simulación el topbar queda por encima de las capas modales del portal (p. ej. la captación inicial, z-index 2000):
   el personal debe poder cambiar de perfil en cualquier momento. */
body.fz-simulacion .topbar{z-index:2100}
body.fz-simulacion #btn-reiniciar-demo{margin-right:.9rem}
`;
function instalarCssSim() {
  if (document.getElementById('fz-sim-css')) return;
  const style = document.createElement('style');
  style.id = 'fz-sim-css';
  style.textContent = CSS_SIM;
  document.head.appendChild(style);
}

/**
 * Pestañas de perfil del topbar (solo en la cuenta de simulación). Se insertan antes de `antesDe` si se pasa (el nombre
 * del usuario en el back-office) o al principio del contenedor (el <li> del topbar del portal del cliente).
 */
async function montarPestanasSimulacion(contenedor, { antesDe = null } = {}) {
  if ((!contenedor && !antesDe) || document.getElementById('fz-sim-perfiles') || !(await esSimulacion())) return null;
  instalarCssSim();
  document.body.classList.add('fz-simulacion');
  const actual = perfilSimulacion();
  const nav = document.createElement('nav');
  nav.id = 'fz-sim-perfiles';
  marcarTraducible(nav, 'Perfil de la simulación', 'aria-label');
  const titulo = marcarTraducible(document.createElement('span'), 'Simulación');
  titulo.className = 'fz-sim-titulo';
  nav.append(titulo);
  for (const p of PERFILES_SIM) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `fz-sim-pestana${p.id === actual ? ' activa' : ''}`;
    b.dataset.perfil = p.id;
    b.setAttribute('aria-pressed', String(p.id === actual));
    marcarTraducible(b, p.rotulo);
    b.addEventListener('click', () => cambiarPerfilSimulacion(p.id));
    nav.append(b);
  }
  if (antesDe) antesDe.insertAdjacentElement('beforebegin', nav);
  else contenedor.prepend(nav);
  return nav;
}

/**
 * Botón [Reiniciar cuenta demo] (Rick, 01-nov): solo para cuentas demo. Lo pinta dentro del
 * contenedor que se le pase; al confirmar llama a POST /api/demo/reiniciar y cierra la sesión
 * (el reinicio revoca los tokens: la persona vuelve a entrar y arranca el recorrido de cero).
 */
async function montarBotonDemo(contenedor) {
  if (!contenedor || !(await esDemo())) return null;
  const sim = await esSimulacion(); // simulación: mismo botón, rótulos propios (reinicia solo sim-org)
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-reiniciar-demo';
  btn.className = 'btn btn-sm btn-warning fw-semibold';
  // Texto en un <span data-i18n> y título con data-i18n-attr: la capa los retraduce al cambiar de idioma.
  btn.appendChild(marcarTraducible(document.createElement('span'), sim ? 'Reiniciar simulación' : 'Reiniciar cuenta demo'));
  marcarTraducible(btn, sim ? 'Vuelve a dejar la simulación como al principio del recorrido' : 'Vuelve a dejar la cuenta de demostración como al principio del recorrido', 'title');
  btn.addEventListener('click', async () => {
    const { confirmar, avisar } = await import('./dialogos.js');
    const pregunta = sim
      ? t('Se borrarán los cambios que hiciste en la simulación y todo volverá al estado inicial. ¿Reiniciar?')
      : t('Se borrarán los cambios que hiciste en la demo y todo volverá al estado inicial. ¿Reiniciar?');
    if (!(await confirmar(pregunta))) return;
    btn.disabled = true;
    try {
      const { default: api } = await import('./api.js');
      await api.reiniciarDemo();
      await avisar(sim
        ? t('Simulación reiniciada. Vuelve a iniciar sesión para empezar desde el principio.')
        : t('Demo reiniciada. Vuelve a iniciar sesión para empezar el recorrido desde el principio.'));
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
// Manual del personal: el del Responsable Farmacéutico (manual/regente/) para todos salvo el Responsable Legal
// (rol `abogado`), que tiene el suyo (manual/legal/). Solo las cuentas demo tienen recorrido guiado.
let carpetaManual = 'regente';
const manualUrl = (idioma) => `/manual/${carpetaManual}/${encodeURIComponent(idioma || 'es')}.html`;
export const urlManualPersonal = manualUrl;

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
 * Panel "Recorrido demo" del back-office (personal demo: regente/farmacéutico, legal y admin). A dónde lleva "Ir al paso" en cada paso
 * (services/demo_recorrido.js, PASOS_REGENTE, PASOS_LEGAL y PASOS_ADMIN). Import dinámico: recorrido.js importa este módulo.
 */
// Los ids de los expedientes llegan en la respuesta del recorrido (extra.ids: demo-caso-3 en la demo, sim-caso-3 en la
// simulación), así el mismo panel sirve para los dos ámbitos.
const DESTINOS_RECORRIDO_STAFF = {
  documento: (ids) => `/admin/expediente.html?id=${encodeURIComponent(ids.caso3)}`,
  cotejo:    (ids) => `/admin/expediente.html?id=${encodeURIComponent(ids.caso3)}`,
  lead:      () => '/admin/leads.html',
  // Recorrido del Responsable Legal (PASOS_LEGAL): documento y confirmacion usan el caso 3; el pedido, el caso 2.
  pedido:       (ids) => `/admin/expediente.html?id=${encodeURIComponent(ids.caso2)}`,
  confirmacion: (ids) => `/admin/expediente.html?id=${encodeURIComponent(ids.caso3)}`,
  // Recorrido del admin demo (PASOS_ADMIN): la cotización en borrador del Producto 4 y el pago en Finanzas; el lead es el mismo.
  cotizacion:   () => '/admin/cotizaciones.html',
  pago:         () => '/admin/finanzas.html',
};
const IDS_DEMO_POR_DEFECTO = { caso2: 'demo-caso-2', caso3: 'demo-caso-3', caso4: 'demo-caso-4' };
async function montarRecorridoBackoffice() {
  if (!(await esDemo())) return null;
  const { montarRecorrido } = await import('./recorrido.js');
  return montarRecorrido({ irA: (paso) => {
    const ids = window.__fzRecorrido?.estado()?.extra?.ids || IDS_DEMO_POR_DEFECTO;
    const destino = DESTINOS_RECORRIDO_STAFF[paso]?.(ids);
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
 * Menú lateral compartido del back-office (Rick, 02-nov-2026): cada página llevaba su copia a mano y se
 * desfasaron (Configuración solo se veía en Empresas, casos.html tenía un "QR Scans" muerto y sin Precios…).
 * Ahora la página solo pone `<nav id="fz-sidebar" data-activo="clave">` y initBackoffice lo rellena aquí.
 * Rótulos = claves del diccionario (se traducen con marcarTraducible y se retraducen al cambiar de idioma).
 */
const MENU_GESTION = [
  { clave: 'casos',         href: '/admin/casos.html',         icono: 'bi-folder2-open',      rotulo: 'Expedientes' },
  { clave: 'bandeja',       href: '/admin/bandeja.html',       icono: 'bi-inbox',             rotulo: 'Mi Bandeja' },
  { clave: 'leads',         href: '/admin/leads.html',         icono: 'bi-person-lines-fill', rotulo: 'Leads' },
  { clave: 'cotizaciones',  href: '/admin/cotizaciones.html',  icono: 'bi-receipt',           rotulo: 'Cotizaciones' },
  { clave: 'formularios',   href: '/admin/formularios.html',   icono: 'bi-file-earmark-text', rotulo: 'Formularios' },
  // Empresas la ve quien tenga el permiso orgs.list (admin y el staff que lo tenga), en TODAS las páginas por igual.
  { clave: 'empresas',      href: '/admin/empresas.html',      icono: 'bi-building',          rotulo: 'Empresas', requiere: 'orgs.list' },
  { clave: 'precios',       href: '/admin/precios.html',       icono: 'bi-cash-coin',         rotulo: 'Precios',  soloAdmin: true },
  { clave: 'finanzas',      href: '/admin/finanzas.html',      icono: 'bi-graph-up-arrow',    rotulo: 'Finanzas', soloAdmin: true },
];
const MENU_SISTEMA = [
  { clave: 'configuracion', href: '/admin/configuracion.html', icono: 'bi-gear',              rotulo: 'Configuración' },
  { clave: 'logout',        href: '#', id: 'sidebar-logout',   icono: 'bi-box-arrow-left',    rotulo: 'Cerrar Sesión' },
];
// Bloque de marca: el mismo de siempre, con #sidebar-rol para que initBackoffice ponga el rol (t('Admin Panel')).
const SIDEBAR_MARCA = '<div class="px-4 mb-4"><div style="font-family:Georgia,serif;color:#fff;font-size:1.2rem;font-weight:700">Farmazed</div><div id="sidebar-rol" style="color:rgba(255,255,255,.4);font-size:.72rem">Admin Panel</div></div>';

function enlaceSidebar({ clave, href, icono, rotulo, id }, activo) {
  const a = document.createElement('a');
  a.href = href;
  if (id) a.id = id;
  if (clave === activo) a.className = 'active';
  const i = document.createElement('i');
  i.className = `bi ${icono} me-2`;
  a.append(i, marcarTraducible(document.createElement('span'), rotulo));
  return a;
}

function etiquetaSidebar(texto) {
  const div = document.createElement('div');
  div.className = 'section-label';
  return marcarTraducible(div, texto);
}

/**
 * Pinta el menú lateral dentro de #fz-sidebar (si la página lo tiene). `activo` es la clave de la página
 * (por defecto, data-activo del <nav>); los enlaces solo-admin se pintan únicamente si `admin` es true.
 * Devuelve el <nav>, o null si la página no tiene menú (expediente.html solo lleva un enlace de vuelta).
 */
function montarSidebar(activo, { admin = false, permisos = [] } = {}) {
  const nav = document.getElementById('fz-sidebar');
  if (!nav) return null;
  const clave = activo ?? nav.dataset.activo ?? '';
  const visible = (e) => admin || (!e.soloAdmin && (!e.requiere || permisos.includes(e.requiere)));
  nav.replaceChildren();
  nav.insertAdjacentHTML('beforeend', SIDEBAR_MARCA);
  nav.append(etiquetaSidebar('Gestión'), ...MENU_GESTION.filter(visible).map(e => enlaceSidebar(e, clave)));
  nav.append(etiquetaSidebar('Sistema'), ...MENU_SISTEMA.map(e => enlaceSidebar(e, clave)));
  return nav;
}

/**
 * Muestra en el menú ya pintado una entrada de Gestión que no esté (p.ej. "Empresas" para el staff con
 * permiso orgs.list, TAREA 35 en bandeja.html): la inserta en su posición, sin repetir el markup en la página.
 */
function mostrarEnlaceSidebar(clave) {
  const nav = document.getElementById('fz-sidebar');
  const indice = MENU_GESTION.findIndex(e => e.clave === clave);
  if (!nav || indice < 0) return null;
  const entrada = MENU_GESTION[indice];
  const existente = nav.querySelector(`a[href="${entrada.href}"]`);
  if (existente) return existente;
  const siguiente = MENU_GESTION.slice(indice + 1).map(e => nav.querySelector(`a[href="${e.href}"]`)).find(Boolean)
    || nav.querySelectorAll('.section-label')[1];
  const enlace = enlaceSidebar(entrada, nav.dataset.activo ?? '');
  siguiente ? siguiente.insertAdjacentElement('beforebegin', enlace) : nav.append(enlace);
  return enlace;
}

/**
 * Arranque común de las páginas del back-office (admin/staff): login verificado, acceso de
 * back-office (si no, al portal del cliente), menú lateral (montarSidebar: los enlaces solo-admin
 * —Empresas, Precios, Finanzas— solo para el admin; Configuración la ve todo el personal), nombre
 * y "Cerrar sesión". Devuelve `{ user, admin }`,
 * o `null` si ya se redirigió (login, verificar correo o portal del cliente): la página debe parar.
 */
// Rótulos en español (clave del diccionario); se traducen al pintarlos: t('Analista'), t('Responsable Legal'),
// t('Responsable Farmacéutico'), t('Admin Panel'), t('Personal') — escritos aquí como literales para la prueba de cobertura.
const ROTULO_STAFF = { analista: 'Analista', abogado: 'Responsable Legal', regente: 'Responsable Farmacéutico' };

async function initBackoffice() {
  const user = await requireVerifiedLogin('/login.html');
  if (!user) return null; // en camino a verificar-correo.html
  if (!(await hasBackofficeAccess())) { window.location.href = '/client-dashboard.html'; return null; }
  const nombre = document.getElementById('user-name') || document.getElementById('admin-name');
  if (nombre) nombre.textContent = user.displayName || user.email;
  const admin = await isAdmin();
  // Los permisos reales de la cuenta deciden las entradas condicionadas (Empresas = orgs.list) en todas las
  // páginas por igual; si la consulta falla, el menú se pinta sin ellas en vez de no pintarse.
  let permisos = [];
  if (!admin) {
    try {
      const r = await fetch(`${API_BASE}/api/me/permissions`, { headers: { Authorization: `Bearer ${await getToken()}`, ...cabecerasPerfil() } });
      if (r.ok) permisos = (await r.json()).permissions || [];
    } catch (e) { /* sin permisos conocidos: menú básico */ }
  }
  // Orden: pintar el menú → colgar "Cerrar sesión" → rótulo del rol (los tres viven dentro de #fz-sidebar).
  montarSidebar(undefined, { admin, permisos });
  document.getElementById('sidebar-logout')?.addEventListener('click', logout);
  await montarBotonDemo(nombre?.parentElement || document.querySelector('.topbar'));
  // Simulación: pestañas de perfil en el topbar, antes del nombre (o al principio del topbar oscuro de expediente.html).
  await montarPestanasSimulacion(document.querySelector('.topbar'), { antesDe: document.getElementById('btn-reiniciar-demo') || nombre });
  const rolActual = await getRole();
  if (rolActual === 'abogado') carpetaManual = 'legal';
  else if (rolActual === 'admin') carpetaManual = 'admin'; // manual/admin/ (admin.demo)
  montarEnlaceAyuda(nombre);
  montarSelectorIdioma(nombre);
  await montarRecorridoBackoffice();
  const rotulo = document.getElementById('sidebar-rol');
  if (rotulo) marcarTraducible(rotulo, admin ? 'Admin Panel' : (ROTULO_STAFF[await getRole()] || 'Personal'));
  return { user, admin };
}

export {
  initBackoffice, montarSidebar, mostrarEnlaceSidebar, esc, auth, register, login, logout, getToken, requireLogin, requireVerifiedLogin, isAdmin, API_BASE,
  getRole, getOrgId, isStaff, hasBackofficeAccess, esDemo, montarBotonDemo, cambiarContrasena,
  esSimulacion, perfilSimulacion, fijarPerfilSimulacion, cambiarPerfilSimulacion, cabecerasPerfil, montarPestanasSimulacion,
};

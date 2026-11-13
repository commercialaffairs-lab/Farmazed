/**
 * demo_admin.js — Aislamiento del admin demo (TAREA 64, Rick 13-nov). El rol admin se salta casi todos los filtros
 * ("ve todo"); admin.demo (claim demo:true + role admin) NO debe: solo lee y escribe lo de la empresa demo
 * (demo:true o `demo-org`, ver utils/demo_scope.js) y lo GLOBAL lo ve pero no lo guarda.
 *
 * Dos capas:
 *  1) Aquí, DENEGAR POR DEFECTO: para el admin demo todo método que no sea GET/HEAD/OPTIONS se rechaza con 403
 *     "en la demo no se guarda", salvo la lista PERMITIDAS (escrituras sobre datos de la demo: casos, documentos,
 *     mensajes, cotizaciones, leads, reinicio...). Una ruta global nueva queda cerrada sin tocar nada. La ruta se
 *     compara normalizada (minúsculas, sin query, sin barras repetidas ni final): Express enruta sin distinguir
 *     mayúsculas y /API/ADMIN/set-role llega al mismo handler que /api/admin/set-role. Corre dentro de requireAuth.
 *  2) En cada ruta que listaba o abría datos sin filtrar (casos, cotizaciones, facturas, empresas, usuarios,
 *     invitaciones, revisiones, escaneos QR...): filtro por esAdminDemo/esDocDemo. canAccessCase y canAccessQuote
 *     ya lo aplican, y asignar personal a un caso solo vale con cuentas demo (routes/cases.js).
 * Pruebas: tests/demo.test.js y tests/permissions.test.js.
 */
const { esAdminDemo } = require('../utils/demo_scope');

const AVISO = 'En la demo no se guarda: esta acción es global (afecta a toda la plataforma) y solo se simula.';

const SEG = '[^/]+';
// Escrituras que el admin demo SÍ puede hacer (cada ruta filtra además por demo-org). Todo lo demás se rechaza.
const ESCRITURAS_PERMITIDAS = [
  ['POST',   '^/api/cases$'],
  ['PATCH',  `^/api/cases/${SEG}$`],
  ['DELETE', `^/api/cases/${SEG}$`],
  ['POST',   `^/api/cases/${SEG}/confirmaciones/fase8$`],
  ['POST',   `^/api/cases/${SEG}/documents$`],
  ['POST',   `^/api/cases/${SEG}/documents/request$`],
  ['PATCH',  `^/api/cases/${SEG}/documents/${SEG}$`],
  ['DELETE', `^/api/cases/${SEG}/documents/${SEG}$`],
  ['POST',   `^/api/cases/${SEG}/messages$`],
  ['POST',   `^/api/cases/${SEG}/payments$`],
  ['PATCH',  `^/api/quotes/${SEG}/lineas/${SEG}$`],
  ['POST',   `^/api/quotes/${SEG}/send$`],                                                  // envío simulado
  ['PUT',    `^/api/quotes/${SEG}/lineas/${SEG}/pago-externo$`],
  ['POST',   `^/api/quotes/${SEG}/lineas/${SEG}/pago-externo/confirmar$`],
  ['PATCH',  `^/api/contact-leads/${SEG}$`],
  ['POST',   `^/api/orgs/${SEG}/leads/revisar$`],
  ['PUT',    `^/api/orgs/${SEG}/diagnostico$`],
  ['POST',   '^/api/demo/reiniciar$'],
  ['PUT',    '^/api/me/preferencias$'],
].map(([metodo, patron]) => [metodo, new RegExp(patron)]);

const LECTURAS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Ruta comparable: sin query/fragmento, decodificada, en minúsculas, sin barras repetidas ni final. */
function normalizarRuta(url) {
  let ruta = String(url || '').split(/[?#]/)[0];
  try { ruta = decodeURIComponent(ruta); } catch { /* se compara tal cual */ }
  return ruta.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

/** true si ya respondió (el admin demo intentó una escritura fuera de la lista permitida). */
function bloquearEscrituraGlobal(req, res) {
  if (!esAdminDemo(req.user) || LECTURAS.has(String(req.method).toUpperCase())) return false;
  const ruta = normalizarRuta(req.originalUrl);
  const metodo = String(req.method).toUpperCase();
  if (ESCRITURAS_PERMITIDAS.some(([m, re]) => m === metodo && re.test(ruta))) return false;
  res.status(403).json({ error: AVISO, demoNoGuarda: true });
  return true;
}

module.exports = { bloquearEscrituraGlobal, normalizarRuta, ESCRITURAS_PERMITIDAS, AVISO };

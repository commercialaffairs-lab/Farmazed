/**
 * recorrido_cliente.js — Recorrido guiado para clientes REALES (Rick, 01-nov-2026: "clients will be
 * from the demo version and also from the settings section in some part to be added and easy to
 * activate").
 *
 * El panel del portal (farmazed-web/portal/js/recorrido.js) pide aquí (GET /api/me/recorrido) en qué
 * paso va la empresa de la persona cuando activó el recorrido en "Mi cuenta". Como en la demo, el
 * progreso NO se guarda: se deduce de los datos de la empresa (¿ya hay captación?, ¿ya creó un
 * producto?, ¿subió documentos?, ¿aceptó y pagó una cotización?, ¿escribió un mensaje?). Los textos
 * son la variante `clienteReal` de demo_recorrido_textos.js (sin referencias a datos de ejemplo).
 */
const admin = require('../utils/firebase_admin.js');
const { IDIOMAS, IDIOMA_POR_DEFECTO, ETIQUETAS_PANEL, normalizarIdioma, pasosEnIdioma } = require('./demo_recorrido_textos');

const db = () => admin.firestore();

// Un documento cuenta como "subido" cuando ya tiene archivo (en cualquier estado de revisión).
const DOC_SUBIDO = ['uploaded', 'reviewing', 'approved', 'rejected'];
// Pagada por PayPal (captura) o por Rapid PayPro (routes/pago_externo.js confirma línea a línea en
// `lineas[].pagoExterno.estado`): cualquiera de las dos vías cuenta.
const cotizacionPagada = (q) => q.pagoPaypal?.estado === 'capturada'
  || (Array.isArray(q.lineas) && q.lineas.some(l => l.pagoExterno?.estado === 'confirmado'));

// El panel sondea cada pocos segundos por pestaña abierta: las lecturas se acotan a lo mínimo
// (campos seleccionados, sondas `limit(1)` por caso con corte en cuanto hay un sí) y el resultado se
// recuerda unos segundos por empresa.
const CACHE_MS = 10 * 1000;
const cache = new Map(); // orgId → { hasta, valor }

/** ¿Algún caso tiene al menos un documento del estado dado / un mensaje del cliente? Para en el primer sí. */
async function algunCasoCon(casos, consulta) {
  for (const caso of casos) {
    const snap = await consulta(caso.ref).limit(1).get();
    if (!snap.empty) return true;
  }
  return false;
}

async function leerEstadoEmpresa(orgId) {
  const [org, casosSnap, cotizacionesSnap] = await Promise.all([
    db().collection('orgs').doc(orgId).get(),
    db().collection('cases').where('orgId', '==', orgId).select('status').limit(200).get(),
    db().collection('quotes').where('orgId', '==', orgId).select('estado', 'pagoPaypal', 'lineas').limit(100).get(),
  ]);
  const casos = casosSnap.docs.filter(d => d.data().status !== 'deleted');
  const cotizaciones = cotizacionesSnap.docs.map(d => d.data());
  const [documento, mensaje] = await Promise.all([
    algunCasoCon(casos, (ref) => ref.collection('documents').where('status', 'in', DOC_SUBIDO)),
    algunCasoCon(casos, (ref) => ref.collection('messages').where('senderRole', '==', 'client')),
  ]);

  const hecho = {
    captacion:  !!(org.exists && org.data().captacion),
    producto:   casos.length > 0,
    documento,
    cotizacion: cotizaciones.some(q => q.estado === 'aceptada' || cotizacionPagada(q)),
    pago:       cotizaciones.some(cotizacionPagada),
    mensaje,
  };
  // "Ir al paso" de documentos retoma el borrador en el asistente (?caseId=), como en la demo.
  const borrador = casos.find(c => c.data().status === 'draft');
  return { hecho, extra: { casoPropioId: borrador ? borrador.id : null } };
}

async function estadoEmpresa(orgId) {
  const ahora = Date.now();
  const guardado = cache.get(orgId);
  if (guardado && guardado.hasta > ahora) return guardado.valor;
  const valor = await leerEstadoEmpresa(orgId);
  cache.set(orgId, { hasta: ahora + CACHE_MS, valor });
  return valor;
}

/** Olvida lo recordado de una empresa (lo usan las pruebas; en producción basta esperar CACHE_MS). */
function olvidarEmpresa(orgId) { if (orgId) cache.delete(orgId); else cache.clear(); }

/**
 * Estado del recorrido guiado de la empresa de `user` (claims del token: orgId) en el idioma pedido.
 * Misma forma que services/demo_recorrido.js (el panel es el mismo), con `variante: 'real'` y los
 * rótulos de cliente real (título "Recorrido guiado", cierre sin botón de reinicio).
 */
async function recorridoCliente(user, idiomaPedido = IDIOMA_POR_DEFECTO) {
  const idioma = normalizarIdioma(idiomaPedido);
  const { hecho, extra } = await estadoEmpresa(user.orgId);
  const lista = pasosEnIdioma('clienteReal', idioma).map(p => ({ ...p, hecho: !!hecho[p.id] }));
  const actual = lista.find(p => !p.hecho)?.id || null;
  const et = ETIQUETAS_PANEL[idioma];
  const etiquetas = { ...et, titulo: et.tituloCliente, pildora: et.pildoraCliente, completoTexto: et.completoTextoCliente, error: et.errorCliente };
  return {
    rol: 'cliente', variante: 'real', idioma, idiomas: IDIOMAS, etiquetas,
    pasos: lista, actual, completado: actual === null, hechos: lista.filter(p => p.hecho).length, total: lista.length, extra,
  };
}

module.exports = { recorridoCliente, olvidarEmpresa, CACHE_MS };

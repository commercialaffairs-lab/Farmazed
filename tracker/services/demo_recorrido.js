/**
 * demo_recorrido.js — Recorrido guiado del modo demo (plan de PENDIENTES.md, punto 2).
 *
 * El panel "Recorrido demo" (farmazed-web/portal/js/recorrido.js) pregunta aquí en qué paso va
 * la cuenta de demostración. El progreso NO se guarda: se deduce de los datos demo tal como están
 * en Firestore (¿ya hay captación?, ¿ya existe el producto del cliente?, ¿la cotización 2 está
 * pagada?…), así el reinicio ([Reiniciar cuenta demo]) vuelve al paso 1 sin nada más que hacer y
 * el panel nunca se desincroniza de lo que la persona hizo de verdad.
 *
 * Los textos de los pasos (español y traducciones EN/FR/PT) y los rótulos del panel viven en
 * demo_recorrido_textos.js: una sola fuente para el panel y para el manual de usuario.
 * `recorridoDemo(user, idioma)` devuelve todo ya traducido; el front no trae tablas de textos.
 */
const admin = require('../utils/firebase_admin.js');
const { DEMO_ORG_ID, CASOS_SEMBRADOS, DOC_REGENTE_ID, MENSAJES_SEMBRADOS } = require('./demo');
const {
  IDIOMAS, IDIOMA_POR_DEFECTO, PASOS_CLIENTE, PASOS_REGENTE, NOTAS, ETIQUETAS_PANEL, normalizarIdioma, pasosEnIdioma,
} = require('./demo_recorrido_textos');

const db = () => admin.firestore();

const esSembrado = (id) => CASOS_SEMBRADOS.includes(id);

async function estadoCliente() {
  const [org, casosSnap, cotizacion] = await Promise.all([
    db().collection('orgs').doc(DEMO_ORG_ID).get(),
    db().collection('cases').where('orgId', '==', DEMO_ORG_ID).get(),
    db().collection('quotes').doc('demo-cotizacion-2').get(),
  ]);
  const casos = casosSnap.docs.filter(d => d.data().status !== 'deleted');
  const propios = casos.filter(d => !esSembrado(d.id));
  const [docsPropios, mensajes] = await Promise.all([
    Promise.all(propios.map(c => c.ref.collection('documents').get())),
    Promise.all(casos.map(c => c.ref.collection('messages').get())),
  ]);
  const q = cotizacion.exists ? cotizacion.data() : {};
  const subioDocumento = docsPropios.some(snap => snap.docs.some(d => d.data().status !== 'requested'));
  const escribio = mensajes.some(snap => snap.docs.some(m => !MENSAJES_SEMBRADOS.includes(m.id) && m.data().senderRole === 'client'));

  const hecho = {
    captacion:  !!(org.exists && org.data().captacion),
    producto:   propios.length > 0,
    documento:  subioDocumento,
    cotizacion: q.estado === 'aceptada',
    pago:       q.pagoPaypal?.estado === 'capturada',
    mensaje:    escribio,
  };
  // Avisos por paso: id del texto (demo_recorrido_textos.js NOTAS), se traduce al responder.
  const notas = {};
  if (q.estado === 'rechazada') notas.cotizacion = 'rechazada';
  // El portal retoma el borrador del cliente en el asistente (?caseId=) desde "Ir al paso".
  const extra = { casoPropioId: propios[0]?.id || null };
  return { hecho, notas, extra };
}

async function estadoRegente() {
  const caso3 = db().collection('cases').doc('demo-caso-3');
  const [caso, doc, lead] = await Promise.all([
    caso3.get(),
    caso3.collection('documents').doc(DOC_REGENTE_ID).get(),
    db().collection('contactLeads').doc('demo-lead-1').get(),
  ]);
  const l = lead.exists ? lead.data() : {};
  const hecho = {
    documento: doc.exists && ['approved', 'rejected'].includes(doc.data().status),
    cotejo:    !!(caso.exists && caso.data().confirmacionesFase8?.tecnica),
    lead:      lead.exists && ((!!l.estado && l.estado !== 'nuevo') || !!l.notas),
  };
  return { hecho, notas: {} };
}

/**
 * Estado del recorrido para una cuenta demo (`user` = claims del token: role, demo) en el idioma
 * pedido ('es' | 'en' | 'fr' | 'pt'; cualquier otro valor cae al español).
 * `actual` es el primer paso no hecho (los pasos van en orden); `null` si ya está todo.
 */
async function recorridoDemo(user, idiomaPedido = IDIOMA_POR_DEFECTO) {
  const idioma = normalizarIdioma(idiomaPedido);
  const rol = user.role === 'regente' ? 'regente' : 'cliente';
  const { hecho, notas, extra = {} } = rol === 'regente' ? await estadoRegente() : await estadoCliente();
  const lista = pasosEnIdioma(rol, idioma).map(p => ({
    ...p,
    hecho: !!hecho[p.id],
    ...(notas[p.id] ? { nota: NOTAS[idioma][notas[p.id]] } : {}),
  }));
  const actual = lista.find(p => !p.hecho)?.id || null;
  return {
    rol, idioma, idiomas: IDIOMAS, etiquetas: ETIQUETAS_PANEL[idioma],
    pasos: lista, actual, completado: actual === null, hechos: lista.filter(p => p.hecho).length, total: lista.length, extra,
  };
}

module.exports = { recorridoDemo, PASOS_CLIENTE, PASOS_REGENTE };

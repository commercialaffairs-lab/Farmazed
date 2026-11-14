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
 *
 * SIMULACIÓN (Rick, 14-nov-2026): la misma lógica sobre el ámbito `sim-org` (ids `sim-caso-3`…). El rol
 * es el PERFIL elegido en el topbar (middleware/auth.js), así que el panel cambia con la pestaña; algunos
 * pasos tienen un texto propio (demo_recorrido_textos.js SIM_PASOS) y, al completar el tramo, la respuesta
 * trae `siguientePerfil` para seguir la secuencia Cliente → Admin → Farmacéutico → Legal → Cliente.
 */
const admin = require('../utils/firebase_admin.js');
const { idsDe } = require('./demo');
const { ambitoDe, esSimulacion, DEMO_ORG_ID } = require('../utils/demo_scope');
const {
  IDIOMAS, IDIOMA_POR_DEFECTO, PASOS_CLIENTE, PASOS_REGENTE, PASOS_LEGAL, PASOS_ADMIN, NOTAS, ETIQUETAS_PANEL, SIM_PERFILES,
  normalizarIdioma, pasosEnIdioma, etiquetasSimulacion,
} = require('./demo_recorrido_textos');

const db = () => admin.firestore();

async function estadoCliente(orgId, I) {
  const esSembrado = (id) => I.casosSembrados.includes(id);
  const [org, casosSnap, cotizacion] = await Promise.all([
    db().collection('orgs').doc(orgId).get(),
    db().collection('cases').where('orgId', '==', orgId).get(),
    db().collection('quotes').doc(I.cotizacion2).get(),
  ]);
  const casos = casosSnap.docs.filter(d => d.data().status !== 'deleted');
  const propios = casos.filter(d => !esSembrado(d.id));
  const [docsPropios, mensajes] = await Promise.all([
    Promise.all(propios.map(c => c.ref.collection('documents').get())),
    Promise.all(casos.map(c => c.ref.collection('messages').get())),
  ]);
  const q = cotizacion.exists ? cotizacion.data() : {};
  const subioDocumento = docsPropios.some(snap => snap.docs.some(d => d.data().status !== 'requested'));
  const escribio = mensajes.some(snap => snap.docs.some(m => !I.mensajesSembrados.includes(m.id) && m.data().senderRole === 'client'));

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

async function estadoRegente(orgId, I) {
  const caso3 = db().collection('cases').doc(I.caso3);
  const [caso, doc, lead] = await Promise.all([
    caso3.get(),
    caso3.collection('documents').doc(I.docRegente).get(),
    db().collection('contactLeads').doc(I.lead).get(),
  ]);
  const l = lead.exists ? lead.data() : {};
  const hecho = {
    documento: doc.exists && ['approved', 'rejected'].includes(doc.data().status),
    cotejo:    !!(caso.exists && caso.data().confirmacionesFase8?.tecnica),
    lead:      lead.exists && ((!!l.estado && l.estado !== 'nuevo') || !!l.notas),
  };
  return { hecho, notas: {} };
}

async function estadoLegal(orgId, I) {
  const caso3 = db().collection('cases').doc(I.caso3);
  const [caso, doc, pedidos] = await Promise.all([
    caso3.get(),
    caso3.collection('documents').doc(I.docLegal).get(),
    db().collection('cases').doc(I.caso2).collection('documents').get(), // el seed no deja documentos en el Producto 2
  ]);
  const hecho = {
    documento:    doc.exists && ['approved', 'rejected'].includes(doc.data().status),
    pedido:       !pedidos.empty,
    confirmacion: !!(caso.exists && caso.data().confirmacionesFase8?.legal),
  };
  return { hecho, notas: {} };
}

async function estadoAdmin(orgId, I) {
  const [cotizacion, lead] = await Promise.all([
    db().collection('quotes').doc(I.cotizacion4).get(),
    db().collection('contactLeads').doc(I.lead).get(),
  ]);
  const q = cotizacion.exists ? cotizacion.data() : {};
  const l = lead.exists ? lead.data() : {};
  const hecho = {
    cotizacion: cotizacion.exists && q.estado !== 'borrador',                               // enviada (o ya respondida)
    lead:       lead.exists && ((!!l.estado && l.estado !== 'nuevo') || !!l.notas),
    pago:       q.pagoPaypal?.estado === 'capturada',                                        // lo paga el cliente (demo: cliente.demo; simulación: la pestaña Cliente)
  };
  return { hecho, notas: {} };
}

const ESTADO_POR_ROL = { cliente: estadoCliente, regente: estadoRegente, legal: estadoLegal, admin: estadoAdmin };

// Secuencia de la simulación: al terminar el tramo de un perfil, el panel propone el siguiente.
const SIGUIENTE_PERFIL = { cliente: 'admin', admin: 'regente', regente: 'abogado', legal: 'cliente_titular' };

/**
 * Estado del recorrido para una cuenta demo (`user` = claims del token: role, demo, simulacion, orgId) en el
 * idioma pedido ('es' | 'en' | 'fr' | 'pt'; cualquier otro valor cae al español).
 * `actual` es el primer paso no hecho (los pasos van en orden); `null` si ya está todo.
 */
async function recorridoDemo(user, idiomaPedido = IDIOMA_POR_DEFECTO) {
  const idioma = normalizarIdioma(idiomaPedido);
  const rol = user.role === 'regente' ? 'regente' : user.role === 'abogado' ? 'legal' : user.role === 'admin' ? 'admin' : 'cliente';
  const simulacion = esSimulacion(user);
  const orgId = ambitoDe(user) || DEMO_ORG_ID;
  const I = idsDe(orgId);
  const { hecho, notas, extra = {} } = await ESTADO_POR_ROL[rol](orgId, I);
  const lista = pasosEnIdioma(rol, idioma, { simulacion }).map(p => ({
    ...p,
    hecho: !!hecho[p.id],
    ...(notas[p.id] ? { nota: NOTAS[idioma][notas[p.id]] } : {}),
  }));
  const actual = lista.find(p => !p.hecho)?.id || null;
  const etiquetas = simulacion ? etiquetasSimulacion(idioma) : ETIQUETAS_PANEL[idioma];
  const siguiente = SIGUIENTE_PERFIL[rol];
  return {
    rol, idioma, idiomas: IDIOMAS, etiquetas,
    pasos: lista, actual, completado: actual === null, hechos: lista.filter(p => p.hecho).length, total: lista.length,
    // Ids del ámbito para que el front navegue al expediente correcto ("Ir al paso": demo-caso-3 / sim-caso-3).
    extra: { ...extra, ids: { caso2: I.caso2, caso3: I.caso3, caso4: I.caso4 } },
    simulacion,
    ...(simulacion ? { perfil: user.role, siguientePerfil: { perfil: siguiente, rotulo: SIM_PERFILES[idioma][siguiente] } } : {}),
  };
}

module.exports = { recorridoDemo, PASOS_CLIENTE, PASOS_REGENTE, PASOS_LEGAL, PASOS_ADMIN };

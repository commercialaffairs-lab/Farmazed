/**
 * demo.test.js — Modo demo (Rick, 01-nov-2026): cuentas de demostración, estado inicial,
 * aislamiento, pago siempre con el proveedor de prueba, sin correos y reinicio.
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 node --test tracker/tests/demo.test.js
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { admin, db, api, idTokenFor, crearTitular, crearCaso, crearUsuario } = require('./_fixtures');
// Claves solo de prueba (emulador): en producción salen de Secret Manager, nunca del repo.
process.env.DEMO_PASSWORD_CLIENTE ||= 'Prueba-cliente-123!';
process.env.DEMO_PASSWORD_REGENTE ||= 'Prueba-regente-123!';
process.env.DEMO_PASSWORD_FARMACEUTICO ||= 'Prueba-farmaceutico-123!';
process.env.DEMO_PASSWORD_LEGAL ||= 'Prueba-legal-123!';
process.env.DEMO_PASSWORD_ADMIN ||= 'Prueba-admin-123!';
// El seed sube el PDF de ejemplo a Storage desde ESTE proceso (no desde el tracker): services/storage.js
// lee la config (tracker/config.js), que exige el proyecto del emulador.
process.env.FIREBASE_PROJECT_ID ||= 'demo-farmazed';
const { sembrarDemo, esCorreoDemo, DEMO_ORG_ID, CUENTAS } = require('../services/demo');
const { TRADUCCIONES, ETIQUETAS_PANEL } = require('../services/demo_recorrido_textos');

const cuenta = (uid) => CUENTAS.find(c => c.uid === uid);
const tokenDemo = (uid) => idTokenFor(cuenta(uid).correo, cuenta(uid).password);

describe('Modo demo — cuentas, datos de ejemplo y reinicio', () => {
  let real, casoReal, tCliente, tRegente, tFarmaceutico, tLegal, tAdmin;

  before(async () => {
    real = await crearTitular('demo-real');
    casoReal = await crearCaso('demo-real', { orgId: real.orgId, clientId: real.uid });
    await sembrarDemo();
    tCliente = await tokenDemo('demo-cliente');
    tRegente = await tokenDemo('demo-regente');
    tFarmaceutico = await tokenDemo('demo-farmaceutico');
    tLegal = await tokenDemo('demo-legal');
    tAdmin = await tokenDemo('demo-admin');
  });

  test('las dos cuentas existen con claim demo:true, su rol y entran', async () => {
    const cli = await admin.auth().getUser('demo-cliente');
    const reg = await admin.auth().getUser('demo-regente');
    assert.deepEqual([cli.customClaims.demo, cli.customClaims.role, cli.customClaims.orgId], [true, 'cliente_titular', DEMO_ORG_ID]);
    assert.deepEqual([reg.customClaims.demo, reg.customClaims.role, reg.customClaims.orgId], [true, 'regente', undefined]);
    const estado = await api(tCliente, 'GET', '/api/demo/estado');
    assert.equal(estado.status, 200);
    assert.equal(estado.json.demo, true);
  });

  test('estado inicial: empresa sin captación con prefill, 3 productos, cotización 2 enviada, 3 pagada, 4 en borrador, lead', async () => {
    const org = await api(tCliente, 'GET', '/api/me/org');
    assert.equal(org.json.nombre, 'Laboratorios Ejemplo S.A.');
    assert.equal(org.json.captacion, undefined);
    assert.deepEqual(org.json.prefillCaptacion.categoriasProducto, ['medicamentos']);

    const casos = await api(tCliente, 'GET', '/api/cases');
    assert.deepEqual(casos.json.cases.map(c => c.caseCode).sort(), ['FZ-DEMO-2026-0002', 'FZ-DEMO-2026-0003', 'FZ-DEMO-2026-0004']);

    const q2 = (await db.collection('quotes').doc('demo-cotizacion-2').get()).data();
    const q3 = (await db.collection('quotes').doc('demo-cotizacion-3').get()).data();
    assert.equal(q2.estado, 'enviada');
    assert.equal(q3.estado, 'aceptada');
    assert.equal(q3.pagoPaypal.estado, 'capturada');
    assert.equal((await db.collection('quotes').doc('demo-cotizacion-4').get()).data().estado, 'borrador');
    const pagos = await db.collection('cases').doc('demo-caso-3').collection('payments').get();
    assert.equal(pagos.size, 4);
    assert.equal(pagos.docs.reduce((s, d) => s + d.data().monto, 0), 4130);

    const lead = (await db.collection('contactLeads').doc('demo-lead-1').get()).data();
    assert.equal(lead.estado, 'nuevo');
    assert.equal(lead.demo, true);
  });

  test('el regente demo solo ve los casos de ejemplo que tiene asignados', async () => {
    const casos = await api(tRegente, 'GET', '/api/cases');
    assert.equal(casos.status, 200);
    assert.deepEqual(casos.json.cases.map(c => c.caseCode).sort(), ['FZ-DEMO-2026-0002', 'FZ-DEMO-2026-0003', 'FZ-DEMO-2026-0004']);
    const ajeno = await api(tRegente, 'GET', `/api/cases/${casoReal}`);
    assert.equal(ajeno.status, 403);
  });

  test('recorrido: estado inicial del cliente (6 pasos) y del regente (3 pasos); 403 a una cuenta normal', async () => {
    assert.equal((await api(real.token, 'GET', '/api/demo/recorrido')).status, 403);

    const cli = await api(tCliente, 'GET', '/api/demo/recorrido');
    assert.equal(cli.status, 200, JSON.stringify(cli.json));
    assert.equal(cli.json.rol, 'cliente');
    assert.deepEqual(cli.json.pasos.map(p => p.id), ['captacion', 'producto', 'documento', 'cotizacion', 'pago', 'mensaje']);
    assert.equal(cli.json.pasos.every(p => p.hecho === false && p.titulo && p.descripcion), true);
    assert.deepEqual([cli.json.actual, cli.json.hechos, cli.json.total, cli.json.completado], ['captacion', 0, 6, false]);
    assert.equal(cli.json.extra.casoPropioId, null);

    const reg = await api(tRegente, 'GET', '/api/demo/recorrido');
    assert.equal(reg.json.rol, 'regente');
    assert.deepEqual(reg.json.pasos.map(p => p.id), ['documento', 'cotejo', 'lead']);
    assert.equal(reg.json.actual, 'documento');
    assert.equal(reg.json.pasos.find(p => p.id === 'cotejo').hecho, false);

    // El seed deja un documento subido en el Producto 3 (con su PDF en Storage) para que el regente lo revise.
    const docs = await api(tRegente, 'GET', '/api/cases/demo-caso-3/documents');
    const formula = docs.json.documents.find(d => d.faddiDocId === 'formula');
    assert.equal(formula?.status, 'uploaded');
    assert.equal(formula.fileName, 'formula-cuali-cuantitativa-ejemplo.pdf');
    assert.equal((await db.collection('cases').doc('demo-caso-3').collection('documents').doc('demo-doc-3-formula').get()).data().storagePath.startsWith('cases/demo-caso-3/'), true);
  });

  test('recorrido en 4 idiomas: ?idioma=en|fr|pt traduce pasos y rótulos; sin idioma o desconocido → español', async () => {
    const es = await api(tCliente, 'GET', '/api/demo/recorrido');
    assert.deepEqual([es.json.idioma, es.json.idiomas, es.json.etiquetas.ir], ['es', ['es', 'en', 'fr', 'pt'], 'Ir al paso']);

    const en = await api(tCliente, 'GET', '/api/demo/recorrido?idioma=en');
    assert.equal(en.status, 200);
    assert.equal(en.json.idioma, 'en');
    assert.equal(en.json.pasos[0].titulo, TRADUCCIONES.en.cliente.captacion.titulo);
    assert.equal(en.json.pasos[3].descripcion, TRADUCCIONES.en.cliente.cotizacion.descripcion);
    assert.deepEqual(en.json.etiquetas, ETIQUETAS_PANEL.en);
    assert.deepEqual(en.json.pasos.map(p => p.id), es.json.pasos.map(p => p.id), 'mismos ids y orden en todos los idiomas');
    assert.deepEqual([en.json.actual, en.json.hechos, en.json.total], [es.json.actual, es.json.hechos, es.json.total]);

    const pt = await api(tRegente, 'GET', '/api/demo/recorrido?idioma=pt-BR');
    assert.equal(pt.json.idioma, 'pt');
    assert.equal(pt.json.pasos.find(p => p.id === 'cotejo').titulo, TRADUCCIONES.pt.regente.cotejo.titulo);

    const fr = await api(tRegente, 'GET', '/api/demo/recorrido?idioma=fr');
    assert.equal(fr.json.pasos[0].titulo, TRADUCCIONES.fr.regente.documento.titulo);

    const raro = await api(tCliente, 'GET', '/api/demo/recorrido?idioma=<script>');
    assert.equal(raro.status, 200);
    assert.equal(raro.json.idioma, 'es');
    assert.equal(raro.json.pasos[0].titulo, es.json.pasos[0].titulo);
  });

  test('recorrido guiado de un cliente REAL: preferencia en el tracker y GET /api/me/recorrido con la variante real', async () => {
    // Preferencias: por defecto apagado; se enciende/apaga con PUT; solo claves conocidas y booleanas.
    assert.deepEqual((await api(real.token, 'GET', '/api/me/preferencias')).json, { recorridoGuiado: false });
    assert.equal((await api(real.token, 'PUT', '/api/me/preferencias', { recorridoGuiado: 'sí' })).status, 400);
    assert.equal((await api(real.token, 'PUT', '/api/me/preferencias', { otraCosa: true })).status, 400);
    assert.equal((await api(real.token, 'PUT', '/api/me/preferencias', {})).status, 400);
    assert.deepEqual((await api(real.token, 'PUT', '/api/me/preferencias', { recorridoGuiado: true })).json, { recorridoGuiado: true });
    assert.deepEqual((await api(real.token, 'GET', '/api/me/preferencias')).json, { recorridoGuiado: true });

    // El recorrido real: mismos ids que la demo, textos de la variante clienteReal, progreso según la empresa.
    const r = await api(real.token, 'GET', '/api/me/recorrido?idioma=en');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual([r.json.rol, r.json.variante, r.json.idioma], ['cliente', 'real', 'en']);
    assert.deepEqual(r.json.pasos.map(p => p.id), ['captacion', 'producto', 'documento', 'cotizacion', 'pago', 'mensaje']);
    assert.equal(r.json.pasos[1].titulo, TRADUCCIONES.en.clienteReal.producto.titulo);
    assert.equal(r.json.etiquetas.titulo, ETIQUETAS_PANEL.en.tituloCliente);
    assert.ok(!r.json.etiquetas.completoTexto.includes('['), 'el cierre del cliente real no cita el botón de reinicio');
    assert.equal(r.json.pasos.find(p => p.id === 'producto').hecho, true, 'la empresa real ya tiene un caso creado en el before()');
    assert.equal(r.json.pasos.find(p => p.id === 'pago').hecho, false);
    assert.equal(r.json.total, 6);

    // Pago por Rapid PayPro (routes/pago_externo.js confirma por línea): también completa cotización y pago.
    // El servicio recuerda el estado unos segundos por empresa: se invalida como haría el paso del tiempo.
    await db.collection('quotes').doc('recorrido-real-q1').set({ orgId: real.orgId, estado: 'enviada', caseIds: [casoReal], lineas: [{ caseId: casoReal, pagoExterno: { estado: 'confirmado' } }] });
    const { olvidarEmpresa } = require('../services/recorrido_cliente');
    olvidarEmpresa(real.orgId);
    // El tracker bajo prueba es otro proceso: su caché expira sola (CACHE_MS), por eso se espera.
    await new Promise(r => setTimeout(r, require('../services/recorrido_cliente').CACHE_MS + 200));
    const r2 = await api(real.token, 'GET', '/api/me/recorrido');
    assert.equal(r2.json.pasos.find(p => p.id === 'cotizacion').hecho, true, 'una cotización pagada cuenta como aceptada');
    assert.equal(r2.json.pasos.find(p => p.id === 'pago').hecho, true, 'pago por Rapid PayPro');
    await db.collection('quotes').doc('recorrido-real-q1').delete();

    // Solo clientes: el regente demo (personal) recibe 403; la cuenta demo cliente también puede pedirlo (es cliente).
    assert.equal((await api(tRegente, 'GET', '/api/me/recorrido')).status, 403);
    assert.equal((await api(tCliente, 'GET', '/api/me/recorrido')).status, 200);

    await api(real.token, 'PUT', '/api/me/preferencias', { recorridoGuiado: false });
    assert.deepEqual((await api(real.token, 'GET', '/api/me/preferencias')).json, { recorridoGuiado: false });
  });

  test('el personal demo no ve ni toca empresas, captaciones ni leads reales', async () => {
    // Empresa real con captación pendiente de revisar + lead real del formulario público.
    await db.collection('orgs').doc(real.orgId).set({ captacion: { paisYNombreFabricante: 'Real — Lab', categoriasProducto: ['medicamentos'], revisadoPorFarmazed: false } }, { merge: true });
    const leadReal = await api(null, 'POST', '/api/contact-leads', { nombre: 'Lead Real', correo: `lead-real-${Date.now()}@farmazed.test` });
    assert.equal(leadReal.status, 201);

    const orgs = await api(tRegente, 'GET', '/api/orgs');
    assert.deepEqual(orgs.json.orgs.map(o => o.id), [DEMO_ORG_ID]);
    const capt = await api(tRegente, 'GET', '/api/orgs/leads');
    assert.equal(capt.json.leads.some(o => o.id === real.orgId), false);
    const leads = await api(tRegente, 'GET', '/api/contact-leads?todos=1');
    assert.equal(leads.json.leads.every(l => l.demo === true), true);
    assert.equal((await api(tRegente, 'PATCH', `/api/contact-leads/${leadReal.json.id}`, { notas: 'x' })).status, 403);
    assert.equal((await api(tRegente, 'POST', `/api/orgs/${real.orgId}/leads/revisar`)).status, 403);
    assert.equal((await api(tRegente, 'PUT', `/api/orgs/${real.orgId}/diagnostico`, { clasificacion: 'a', rutaRecomendada: 'b', requisitosAplicables: 'c', estimadoTiempos: 'd', estimadoCostos: 'e' })).status, 403);
    // y el lead demo sí lo puede trabajar
    assert.equal((await api(tRegente, 'PATCH', '/api/contact-leads/demo-lead-1', { notas: 'Llamar el lunes' })).status, 200);
  });

  test('recorrido del cliente: captación, producto, documento y mensaje se marcan solos al hacerlos', async () => {
    const capt = await api(tCliente, 'PATCH', '/api/orgs/mine/captacion', {
      paisYNombreFabricante: 'Panamá — Laboratorios Ejemplo S.A.', categoriasProducto: ['medicamentos'],
      numeroProductosPorCategoria: '3', productosPorCategoria: { medicamentos: 3 },
      registroPrevioAutoridadReconocida: false, clienteNuevoOYaRegistrado: 'nuevo', productoConModificacionEnCurso: false,
    });
    assert.equal(capt.status, 200, JSON.stringify(capt.json));

    const caso = await api(tCliente, 'POST', '/api/cases', { tramiteType: 'medicamentos', tipoSolicitud: 'Nuevo Registro', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
    assert.ok([200, 201].includes(caso.status), JSON.stringify(caso.json));
    const casoId = caso.json.id;

    let r = await api(tCliente, 'GET', '/api/demo/recorrido');
    assert.deepEqual(r.json.pasos.filter(p => p.hecho).map(p => p.id), ['captacion', 'producto']);
    assert.deepEqual([r.json.actual, r.json.extra.casoPropioId], ['documento', casoId]);

    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from('%PDF-1.4 documento demo')], { type: 'application/pdf' }), 'documento-ejemplo.pdf');
    fd.append('faddiDocId', 'poder'); fd.append('faddiCode', '15.2'); fd.append('faddiDocName', 'Poder Original'); fd.append('faddiStep', '15');
    const subida = await api(tCliente, 'POST', `/api/cases/${casoId}/documents`, fd);
    assert.ok([200, 201].includes(subida.status), subida.text);

    const msg = await api(tCliente, 'POST', '/api/cases/demo-caso-3/messages', { text: 'Hola, ¿cuándo pasamos a los originales?' });
    assert.equal(msg.status, 201, msg.text);

    r = await api(tCliente, 'GET', '/api/demo/recorrido');
    assert.deepEqual(r.json.pasos.filter(p => p.hecho).map(p => p.id), ['captacion', 'producto', 'documento', 'mensaje']);
    assert.equal(r.json.actual, 'cotizacion'); // el primer paso no hecho, en orden
  });

  test('sin credenciales sandbox una cuenta demo paga con el mock, aunque el entorno esté en PayPal', async () => {
    const { getProvider } = require('../services/payments');
    const previo = process.env.PAYMENTS_PROVIDER;
    process.env.PAYMENTS_PROVIDER = 'paypal';
    try { assert.equal(getProvider({ demo: true }).name, 'mock'); }
    finally { if (previo === undefined) delete process.env.PAYMENTS_PROVIDER; else process.env.PAYMENTS_PROVIDER = previo; }

    const acepta = await api(tCliente, 'POST', '/api/quotes/demo-cotizacion-2/respond', { decision: 'aceptada' });
    assert.equal(acepta.status, 200);
    const orden = await api(tCliente, 'POST', '/api/quotes/demo-cotizacion-2/pago/crear-orden');
    assert.equal(orden.status, 201);
    assert.match(orden.json.orderId, /^mock-/);
  });

  test('al capturar el pago demo, el caso avanza solo fase_04 -> fase_06 y el recorrido queda completo', async () => {
    const { orderId } = (await db.collection('quotes').doc('demo-cotizacion-2').get()).data().pagoPaypal;
    const captura = await api(tCliente, 'POST', '/api/quotes/demo-cotizacion-2/pago/capturar', { orderId });
    assert.equal(captura.status, 200, captura.text);
    assert.deepEqual(captura.json.avanceDemo, [{ caseId: 'demo-caso-2', to: 'fase_05' }, { caseId: 'demo-caso-2', to: 'fase_06' }]);

    assert.equal((await db.collection('cases').doc('demo-caso-2').get()).data().status, 'fase_06');
    const historial = await db.collection('cases').doc('demo-caso-2').collection('statusHistory').get();
    assert.deepEqual(historial.docs.map(d => d.data().to).sort(), ['fase_05', 'fase_06']);
    assert.equal(historial.docs.every(d => d.data().by === 'demo-automatico' && d.data().override === false), true);
    // el caso real de otra empresa no se tocó
    assert.equal((await db.collection('cases').doc(casoReal).get()).data().status, 'fase_01');

    const r = await api(tCliente, 'GET', '/api/demo/recorrido');
    assert.deepEqual([r.json.completado, r.json.hechos, r.json.actual], [true, 6, null]);
  });

  test('recorrido del regente: revisar el documento, confirmar el cotejo técnico y atender el lead', async () => {
    const revision = await api(tRegente, 'PATCH', '/api/cases/demo-caso-3/documents/demo-doc-3-formula', { status: 'approved', reviewNotes: '' });
    assert.equal(revision.status, 200, revision.text);
    let r = await api(tRegente, 'GET', '/api/demo/recorrido');
    assert.equal(r.json.pasos.find(p => p.id === 'documento').hecho, true);
    assert.equal(r.json.actual, 'cotejo');

    const cotejo = await api(tRegente, 'POST', '/api/cases/demo-caso-3/confirmaciones/fase8', { tipo: 'tecnica' });
    assert.equal(cotejo.status, 200, cotejo.text);
    const lead = await api(tRegente, 'PATCH', '/api/contact-leads/demo-lead-1', { estado: 'contactado' });
    assert.equal(lead.status, 200, lead.text);

    r = await api(tRegente, 'GET', '/api/demo/recorrido');
    assert.deepEqual([r.json.completado, r.json.hechos, r.json.total], [true, 3, 3]);
  });

  test('farmaceutico.demo y legal.demo: existen con su rol, claim demo:true y entran', async () => {
    assert.deepEqual(CUENTAS.map(c => c.correo), ['cliente.demo@farmazed.com', 'regente.demo@farmazed.com', 'farmaceutico.demo@farmazed.com', 'legal.demo@farmazed.com', 'admin.demo@farmazed.com']);
    const far = await admin.auth().getUser('demo-farmaceutico');
    const leg = await admin.auth().getUser('demo-legal');
    assert.deepEqual([far.displayName, far.customClaims.role, far.customClaims.demo, far.customClaims.orgId], ['Responsable Farmacéutico Ejemplo', 'regente', true, undefined]);
    assert.deepEqual([leg.displayName, leg.customClaims.role, leg.customClaims.demo, leg.customClaims.orgId], ['Responsable Legal Ejemplo', 'abogado', true, undefined]);
    for (const t of [tFarmaceutico, tLegal]) assert.equal((await api(t, 'GET', '/api/demo/estado')).json.demo, true);
  });

  test('farmaceutico.demo y legal.demo ven los mismos casos de ejemplo y ninguno ajeno', async () => {
    for (const t of [tFarmaceutico, tLegal]) {
      const casos = await api(t, 'GET', '/api/cases');
      assert.equal(casos.status, 200);
      assert.deepEqual(casos.json.cases.map(c => c.caseCode).sort(), ['FZ-DEMO-2026-0002', 'FZ-DEMO-2026-0003', 'FZ-DEMO-2026-0004']);
      assert.equal((await api(t, 'GET', `/api/cases/${casoReal}`)).status, 403);
      assert.equal((await api(t, 'GET', '/api/cases/demo-caso-3')).status, 200);
    }
    const far = await api(tFarmaceutico, 'GET', '/api/demo/recorrido');
    assert.equal(far.json.rol, 'regente');
    assert.deepEqual(far.json.pasos.map(p => p.id), ['documento', 'cotejo', 'lead']);
    const leg = await api(tLegal, 'GET', '/api/demo/recorrido');
    assert.equal(leg.json.rol, 'legal');
    assert.deepEqual(leg.json.pasos.map(p => p.id), ['documento', 'pedido', 'confirmacion']);
    assert.deepEqual([leg.json.actual, leg.json.hechos, leg.json.total], ['documento', 0, 3]);
    for (const idioma of ['en', 'fr', 'pt']) {
      const trad = await api(tLegal, 'GET', `/api/demo/recorrido?idioma=${idioma}`);
      assert.equal(trad.json.pasos.every(p => p.titulo && p.descripcion), true);
      assert.notEqual(trad.json.pasos[0].titulo, leg.json.pasos[0].titulo, `${idioma}: el paso debe venir traducido`);
    }
    // El Responsable Legal tiene sembrado un poder (15.2) para revisar.
    const docs = await api(tLegal, 'GET', '/api/cases/demo-caso-3/documents');
    assert.equal(docs.json.documents.find(d => d.faddiDocId === 'poder')?.status, 'uploaded');
  });

  test('recorrido del Responsable Legal: revisar el poder, pedir un documento y confirmar la parte legal de la fase 8', async () => {
    const revision = await api(tLegal, 'PATCH', '/api/cases/demo-caso-3/documents/demo-doc-3-poder', { status: 'approved', reviewNotes: '' });
    assert.equal(revision.status, 200, revision.text);
    let r = await api(tLegal, 'GET', '/api/demo/recorrido');
    assert.deepEqual([r.json.pasos.find(p => p.id === 'documento').hecho, r.json.actual], [true, 'pedido']);

    const pedido = await api(tLegal, 'POST', '/api/cases/demo-caso-2/documents/request', { faddiDocId: 'declaracion_jurada', message: 'Falta la declaración jurada firmada' });
    assert.equal(pedido.status, 200, pedido.text);
    r = await api(tLegal, 'GET', '/api/demo/recorrido');
    assert.equal(r.json.actual, 'confirmacion');

    // Solo la parte legal: la técnica sigue siendo del Responsable Farmacéutico.
    assert.equal((await api(tFarmaceutico, 'POST', '/api/cases/demo-caso-3/confirmaciones/fase8', { tipo: 'legal' })).status, 403);
    const conf = await api(tLegal, 'POST', '/api/cases/demo-caso-3/confirmaciones/fase8', { tipo: 'legal' });
    assert.equal(conf.status, 200, conf.text);
    assert.equal((await api(tLegal, 'POST', '/api/cases/demo-caso-3/confirmaciones/fase8', { tipo: 'tecnica' })).status, 403);
    r = await api(tLegal, 'GET', '/api/demo/recorrido');
    assert.deepEqual([r.json.completado, r.json.hechos, r.json.total], [true, 3, 3]);
  });

  test('admin.demo: existe con rol admin y claim demo:true, entra y su recorrido arranca en el paso 1', async () => {
    const adm = await admin.auth().getUser('demo-admin');
    assert.deepEqual([adm.displayName, adm.customClaims.role, adm.customClaims.demo, adm.customClaims.orgId], ['Administrador Ejemplo', 'admin', true, undefined]);
    assert.equal((await api(tAdmin, 'GET', '/api/demo/estado')).json.demo, true);
    const r = await api(tAdmin, 'GET', '/api/demo/recorrido');
    assert.equal(r.json.rol, 'admin');
    assert.deepEqual(r.json.pasos.map(p => p.id), ['cotizacion', 'lead', 'pago']);
    assert.equal(r.json.actual, 'cotizacion'); // (el lead ya lo trabajó el regente demo en una prueba anterior: comparte el dato)
    assert.equal(r.json.pasos.find(p => p.id === 'cotizacion').hecho, false);
    assert.equal(r.json.total, 3);
    for (const idioma of ['en', 'fr', 'pt']) {
      const trad = await api(tAdmin, 'GET', `/api/demo/recorrido?idioma=${idioma}`);
      assert.notEqual(trad.json.pasos[0].titulo, r.json.pasos[0].titulo, `${idioma}: el paso debe venir traducido`);
    }
  });

  test('admin.demo NO ve ni modifica nada real: casos, cotizaciones, facturas, empresas, leads, usuarios, invitaciones y revisiones', async () => {
    // Datos REALES (de otra empresa, sin demo:true) de cada tipo que el admin suele ver sin filtro.
    const ahora = admin.firestore.Timestamp.now();
    const staffReal = await crearUsuario('staff-real', { role: 'analista' });
    await db.collection('quotes').doc('real-quote-t64').set({ orgId: real.orgId, caseIds: [casoReal], estado: 'borrador', lineas: [{ caseId: casoReal, tipo: 'principal', honorariosFarmazed: 100, tasasOficiales: 0, monto: 100, conceptos: { honorarios: 100 } }], total: 100, historial: [], createdAt: ahora, updatedAt: ahora });
    await db.collection('facturas').doc('fac_real_t64').set({ orgId: real.orgId, estado: 'emitida', origen: 'paypal', creadaEn: ahora, caseIds: [casoReal] });
    await db.collection('invitations').doc('inv-real-t64').set({ orgId: real.orgId, email: 'real@ejemplo.test', role: 'cliente_miembro', createdAt: ahora });
    const { COLECCION } = require('../services/revisiones_pago');
    await db.collection(COLECCION).doc('rev-real-t64').set({ resuelta: false, creadaEn: ahora, orgId: real.orgId, motivo: 'revisión real' });
    await db.collection('cases').doc(casoReal).collection('payments').doc('pago-real-t64').set({ tipo: 'cliente_a_farmazed', concepto: 'honorarios', monto: 100, fecha: ahora, origen: 'paypal', createdAt: ahora });
    const leadReal = await api(null, 'POST', '/api/contact-leads', { nombre: 'Lead Real 2', correo: `lead-real2-${Date.now()}@farmazed.test` });
    assert.equal(leadReal.status, 201);
    await db.collection('orgs').doc(real.orgId).set({ captacion: { paisYNombreFabricante: 'Real', categoriasProducto: ['medicamentos'], revisadoPorFarmazed: false } }, { merge: true });

    // ── LECTURA: solo lo de la empresa demo ──
    const casos = await api(tAdmin, 'GET', '/api/cases');
    assert.equal(casos.status, 200);
    assert.ok(casos.json.cases.length >= 3 && casos.json.cases.every(c => c.orgId === DEMO_ORG_ID), 'solo casos de demo-org');
    assert.equal(casos.json.cases.some(c => c.id === casoReal), false);
    for (const [metodo, ruta, cuerpo] of [
      ['GET', `/api/cases/${casoReal}`], ['PATCH', `/api/cases/${casoReal}`, { notes: 'x' }], ['DELETE', `/api/cases/${casoReal}`],
      ['GET', `/api/cases/${casoReal}/documents`], ['GET', `/api/cases/${casoReal}/messages`], ['POST', `/api/cases/${casoReal}/messages`, { text: 'hola' }],
      ['GET', `/api/cases/${casoReal}/payments`], ['GET', `/api/cases/${casoReal}/history`], ['GET', `/api/cases/${casoReal}/checklist`],
    ]) assert.equal((await api(tAdmin, metodo, ruta, cuerpo)).status, 403, `${metodo} ${ruta}`);

    const quotes = await api(tAdmin, 'GET', '/api/quotes');
    assert.ok(quotes.json.quotes.length >= 3 && quotes.json.quotes.every(q => q.orgId === DEMO_ORG_ID));
    assert.equal((await api(tAdmin, 'GET', '/api/quotes/real-quote-t64')).status, 403);
    assert.equal((await api(tAdmin, 'PATCH', `/api/quotes/real-quote-t64/lineas/${casoReal}`, { honorariosFarmazed: 1, motivo: 'x' })).status, 403);
    assert.equal((await api(tAdmin, 'POST', '/api/quotes/real-quote-t64/send')).status, 403);
    assert.equal((await api(tAdmin, 'PUT', `/api/quotes/real-quote-t64/lineas/${casoReal}/pago-externo`, { url: 'https://link.rapidpaypro.com/x' })).status, 403);
    assert.equal((await db.collection('quotes').doc('real-quote-t64').get()).data().estado, 'borrador', 'la cotización real no se envió');

    const facturas = await api(tAdmin, 'GET', '/api/facturas');
    assert.equal(facturas.status, 200);
    assert.equal(facturas.json.facturas.some(f => f.id === 'fac_real_t64'), false);
    assert.equal((await api(tAdmin, 'GET', '/api/facturas/fac_real_t64')).status, 403);
    assert.equal((await api(tAdmin, 'GET', '/api/facturas/fac_real_t64/estado-pac')).status, 403);
    const sinFactura = await api(tAdmin, 'GET', '/api/facturas/sin-factura');
    assert.equal(sinFactura.json.pagos.some(p => p.caseId === casoReal), false);

    const orgs = await api(tAdmin, 'GET', '/api/orgs');
    assert.deepEqual(orgs.json.orgs.map(o => o.id), [DEMO_ORG_ID]);
    assert.equal((await api(tAdmin, 'GET', `/api/orgs/${real.orgId}/members`)).status, 403);
    assert.equal((await api(tAdmin, 'GET', '/api/orgs/leads')).json.leads.some(o => o.id === real.orgId), false);
    assert.equal((await api(tAdmin, 'POST', `/api/orgs/${real.orgId}/leads/revisar`)).status, 403);
    assert.equal((await api(tAdmin, 'PUT', `/api/orgs/${real.orgId}/diagnostico`, { clasificacion: 'a', rutaRecomendada: 'b', requisitosAplicables: 'c', estimadoTiempos: 'd', estimadoCostos: 'e' })).status, 403);

    const leads = await api(tAdmin, 'GET', '/api/contact-leads?todos=1');
    assert.ok(leads.json.leads.length >= 1 && leads.json.leads.every(l => l.demo === true));
    assert.equal((await api(tAdmin, 'PATCH', `/api/contact-leads/${leadReal.json.id}`, { notas: 'x' })).status, 403);

    const empleados = await api(tAdmin, 'GET', '/api/employees');
    assert.ok(empleados.json.employees.length >= 4, 've al personal demo');
    for (const e of empleados.json.employees) assert.equal((await admin.auth().getUser(e.uid)).customClaims?.demo, true, `${e.email} no es una cuenta demo`);
    assert.equal(empleados.json.employees.some(e => e.uid === staffReal.uid), false);
    assert.equal((await api(tAdmin, 'GET', '/api/invitations')).json.invitations.some(i => i.id === 'inv-real-t64'), false);
    assert.equal((await api(tAdmin, 'GET', '/api/admin/revisiones-pago')).json.revisiones.some(r => r.id === 'rev-real-t64'), false);

    // ── ESCRITURA GLOBAL: se ve pero no se guarda (403 con aviso, sin tocar nada) ──
    const antesOrgs = (await db.collection('orgs').get()).size;
    const antesInvitaciones = (await db.collection('invitations').get()).size;
    const globales = [
      ['PATCH', '/api/admin/pricing/med_regular_sintesis_24sep', { components: { honorarios_farmazed: 1 } }],
      ['PUT', '/api/facturas/config', { emisor: { razonSocial: 'Hackeada S.A.' } }],
      ['POST', '/api/facturas/procesar-pendientes'], ['POST', '/api/facturas/desde-pagos', { caseId: casoReal, paymentIds: ['pago-real-t64'] }],
      ['POST', '/api/facturas/fac_real_t64/emitir'], ['POST', '/api/facturas/fac_real_t64/anular', { motivo: 'x' }],
      ['POST', '/api/admin/revisiones-pago/rev-real-t64/resolver', { nota: 'x' }],
      ['POST', '/api/employees/restablecer-contrasena', { correo: staffReal.email }],
      ['PUT', '/api/subscription/plan', { nombre: 'Plan X', monto: 1, periodo: 'mensual' }],
      ['POST', '/api/invitations/empleado', { email: 'nuevo-staff@real.test', role: 'analista' }],
      ['POST', '/api/invitations/titular', { email: 'nuevo-titular@real.test', empresa: 'Real S.A.' }],
      ['POST', `/api/contact-leads/${leadReal.json.id}/invitar`],
      ['POST', '/api/orgs', { nombre: 'Empresa nueva' }],
      ['PATCH', '/api/orgs/mine/captacion', { orgId: real.orgId, paisYNombreFabricante: 'Otro' }],
      ['PUT', `/api/empresarial/${real.orgId}/condiciones`, {}],
    ];
    for (const [metodo, ruta, cuerpo] of globales) {
      const r = await api(tAdmin, metodo, ruta, cuerpo);
      assert.equal(r.status, 403, `${metodo} ${ruta}: ${r.text}`);
      assert.equal(r.json.demoNoGuarda, true, `${metodo} ${ruta}`);
      assert.match(r.json.error, /en la demo no se guarda/i);
    }
    assert.equal((await db.collection('orgs').get()).size, antesOrgs);
    assert.equal((await db.collection('invitations').get()).size, antesInvitaciones);
    assert.equal((await db.collection('pricing').doc('med_regular_sintesis_24sep').get()).data()?.honorarios_farmazed, undefined);
    assert.equal((await db.collection(COLECCION).doc('rev-real-t64').get()).data().resuelta, false);
    assert.equal((await db.collection('facturas').doc('fac_real_t64').get()).data().estado, 'emitida');
    assert.equal((await admin.auth().getUserByEmail(staffReal.email)).email, staffReal.email); // la cuenta real sigue ahí, sin correo de restablecer
    // y las LECTURAS de lo global siguen permitidas
    for (const ruta of ['/api/admin/pricing', '/api/facturas/config', '/api/admin/estado', '/api/subscription/plan']) {
      assert.equal((await api(tAdmin, 'GET', ruta)).status, 200, ruta);
    }
  });

  test('admin.demo: no puede dar/quitar el rol admin (set-role) ni esquivar el bloqueo con mayúsculas, barras o rutas no listadas', async () => {
    const antes = (await admin.auth().getUser(real.uid)).customClaims;
    for (const [metodo, ruta, cuerpo] of [
      ['POST', '/api/admin/set-role', { uid: real.uid, admin: true }],
      ['POST', '/API/ADMIN/SET-ROLE', { uid: real.uid, admin: true }],
      ['POST', '/api/admin/set-role/', { uid: real.uid, admin: true }],
      ['PATCH', '/API/ADMIN/PRICING/med_regular_sintesis_24sep', { components: { honorarios_farmazed: 1 } }],
      ['PUT', '/Api/Facturas/Config', { emisor: { razonSocial: 'X' } }],
      ['POST', '/api/INVITATIONS/empleado', { email: 'otro@real.test', role: 'analista' }],
      ['POST', '/api/orgs/', { nombre: 'Otra' }],
    ]) {
      const r = await api(tAdmin, metodo, ruta, cuerpo);
      assert.equal(r.status, 403, `${metodo} ${ruta}: ${r.text}`);
      assert.equal(r.json.demoNoGuarda, true, `${metodo} ${ruta}`);
    }
    const despues = (await admin.auth().getUser(real.uid)).customClaims;
    assert.deepEqual(despues, antes, 'los claims de la cuenta real no cambiaron');
    assert.equal((await db.collection('pricing').doc('med_regular_sintesis_24sep').get()).data()?.honorarios_farmazed, undefined);
  });

  test('admin.demo: GET /api/scans no devuelve escaneos QR reales; GET /api/admin/estado no revela el remitente ni la revisión', async () => {
    await db.collection('qr_scans').add({ timestamp: admin.firestore.Timestamp.now(), ip: '203.0.113.77', device: 'móvil', ua: 'UA-real-t64' });
    const scans = await api(tAdmin, 'GET', '/api/scans');
    assert.equal(scans.status, 200);
    assert.deepEqual(scans.json, { total: 0, scans: [] });
    assert.doesNotMatch(scans.text, /203\.0\.113\.77|UA-real-t64/);

    const estado = await api(tAdmin, 'GET', '/api/admin/estado');
    assert.equal(estado.status, 200);
    assert.equal(estado.json.correo.remitente, null);
    assert.equal(estado.json.revision, null);
    // las lecturas globales permitidas no traen secretos: ningún valor parecido a una credencial
    for (const ruta of ['/api/admin/estado', '/api/facturas/config', '/api/admin/pricing', '/api/subscription/plan']) {
      const r = await api(tAdmin, 'GET', ruta);
      assert.doesNotMatch(r.text, /secret|password|clave|token|api[_-]?key|PAYPAL_|MCP_KEY/i, ruta);
    }
  });

  test('admin.demo: un caso nuevo nace en demo-org con demo:true y NO consume el contador real de códigos', async () => {
    const contador = async () => (await db.collection('meta').doc('counters').get()).data()?.caseSequence ?? 0;
    const antes = await contador();
    const r = await api(tAdmin, 'POST', '/api/cases', { tramiteType: 'medicamentos', tipoSolicitud: 'Nuevo Registro', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
    assert.equal(r.status, 201, r.text);
    assert.match(r.json.caseCode, /^FZ-DEMO-\d{4}-A\d{4}$/);
    assert.equal(await contador(), antes, 'el contador global no se movió');
    const caso = (await db.collection('cases').doc(r.json.id).get()).data();
    assert.deepEqual([caso.orgId, caso.demo], [DEMO_ORG_ID, true]);
    assert.equal((await api(tAdmin, 'GET', `/api/cases/${r.json.id}`)).status, 200);
    // aunque mande otra empresa en el cuerpo, el caso es de la demo (el cuerpo no se usa para orgId)
    const r2 = await api(tAdmin, 'POST', '/api/cases', { tramiteType: 'medicamentos', orgId: real.orgId });
    assert.equal((await db.collection('cases').doc(r2.json.id).get()).data().orgId, DEMO_ORG_ID);
  });

  test('envío de cotización simulado de punta a punta: admin.demo la envía sin correo y cliente.demo la ve', async () => {
    const previos = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].map(k => [k, process.env[k]]);
    Object.assign(process.env, { SMTP_HOST: 'smtp.invalid', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'Farmazed <no-reply@farmazed.test>' });
    try {
      const { correoConfigurado, enviarInvitacion } = require('../services/correo');
      assert.equal(correoConfigurado(), true);
      const q4 = await api(tAdmin, 'GET', '/api/quotes/demo-cotizacion-4');
      assert.equal(q4.json.estado, 'borrador');
      assert.equal((await api(tCliente, 'GET', '/api/quotes')).json.quotes.find(q => q.id === 'demo-cotizacion-4')?.estado, 'borrador');
      const envio = await api(tAdmin, 'POST', '/api/quotes/demo-cotizacion-4/send');
      assert.equal(envio.status, 200, envio.text);
      assert.equal(envio.json.simulado, true);
      assert.match(envio.json.aviso, /simulado/i);
      assert.equal(envio.json.estado, 'enviada');
      // cualquier correo a una cuenta demo queda bloqueado en el servicio de correo
      assert.equal(await enviarInvitacion({ correo: 'cliente.demo@farmazed.com', rol: 'cliente', empresa: null, enlace: 'https://x.test' }), false);
    } finally {
      for (const [k, v] of previos) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
    const visto = (await api(tCliente, 'GET', '/api/quotes')).json.quotes.find(q => q.id === 'demo-cotizacion-4');
    assert.equal(visto.estado, 'enviada');
    const r = await api(tAdmin, 'GET', '/api/demo/recorrido');
    assert.deepEqual([r.json.pasos.find(p => p.id === 'cotizacion').hecho, r.json.actual], [true, 'pago']); // el lead ya estaba trabajado
    // una cotización de un caso REAL enviada por un cliente real no se vio afectada (ya comprobado arriba)
  });

  test('cliente.demo paga la cotización 4; el pago queda marcado demo, no factura de verdad, el webhook lo ignora y el recorrido del admin se completa', async () => {
    assert.equal((await api(tCliente, 'POST', '/api/quotes/demo-cotizacion-4/respond', { decision: 'aceptada' })).status, 200);
    const orden = await api(tCliente, 'POST', '/api/quotes/demo-cotizacion-4/pago/crear-orden');
    assert.equal(orden.status, 201, orden.text);
    const captura = await api(tCliente, 'POST', '/api/quotes/demo-cotizacion-4/pago/capturar', { orderId: orden.json.orderId });
    assert.equal(captura.status, 200, captura.text);
    assert.deepEqual(captura.json.avanceDemo.map(a => a.to), ['fase_05', 'fase_06']);
    assert.equal((await db.collection('cases').doc('demo-caso-4').get()).data().status, 'fase_06');

    const pagos = await db.collection('cases').doc('demo-caso-4').collection('payments').get();
    assert.ok(pagos.size >= 1 && pagos.docs.every(d => d.data().demo === true), 'todos los pagos de la demo llevan demo:true');

    // El webhook de PayPal no concilia ni factura ni abre revisiones para un pago demo.
    const { procesarEvento } = require('../services/paypal_webhook');
    const q4 = (await db.collection('quotes').doc('demo-cotizacion-4').get()).data();
    const eventosAntes = (await db.collection('paypal_eventos').get()).size;
    const resultado = await procesarEvento({ id: 'evt-demo-t64', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-DEMO-T64', supplementary_data: { related_ids: { order_id: q4.pagoPaypal.orderId } } } });
    assert.equal(resultado, 'ignorado_demo');
    assert.equal((await db.collection('paypal_eventos').get()).size, eventosAntes);

    // La factura de un pago demo se crea marcada demo (PAC simulado), nunca con el PAC real.
    await new Promise(r => setTimeout(r, 1500));
    const facturasDemo = await db.collection('facturas').where('orgId', '==', DEMO_ORG_ID).get();
    assert.ok(facturasDemo.docs.every(d => d.data().demo === true), 'las facturas de la demo son simuladas');

    // El admin completa el recorrido: lead trabajado + pago capturado.
    assert.equal((await api(tAdmin, 'PATCH', '/api/contact-leads/demo-lead-1', { estado: 'contactado' })).status, 200);
    const r = await api(tAdmin, 'GET', '/api/demo/recorrido');
    assert.deepEqual([r.json.completado, r.json.hechos, r.json.total], [true, 3, 3]);
  });

  test('el admin demo ve la factura de la demo en Finanzas, y no puede emitirla (global)', async () => {
    const lista = await api(tAdmin, 'GET', '/api/facturas');
    assert.equal(lista.status, 200);
    assert.ok(lista.json.facturas.every(f => f.orgId === DEMO_ORG_ID));
    if (lista.json.facturas[0]) {
      assert.equal((await api(tAdmin, 'GET', `/api/facturas/${lista.json.facturas[0].id}`)).status, 200);
      assert.equal((await api(tAdmin, 'POST', `/api/facturas/${lista.json.facturas[0].id}/emitir`)).status, 403);
    }
  });

  test('la cuenta demo no puede invitar miembros (mandaría correos reales)', async () => {
    const inv = await api(tCliente, 'POST', '/api/invitations/miembro', { email: 'alguien@ejemplo.test' });
    assert.equal(inv.status, 403);
    assert.equal((await db.collection('invitations').where('orgId', '==', DEMO_ORG_ID).get()).size, 0);
  });

  test('a las cuentas *.demo@ no se les manda ningún correo', async () => {
    assert.equal(esCorreoDemo('cliente.demo@farmazed.com'), true);
    for (const c of CUENTAS) assert.equal(esCorreoDemo(c.correo), true, c.correo);
    assert.equal(esCorreoDemo('richy@gmail.com'), false);
    const previos = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].map(k => [k, process.env[k]]);
    Object.assign(process.env, { SMTP_HOST: 'smtp.invalid', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'Farmazed <no-reply@farmazed.test>' });
    try {
      const { enviarInvitacion, correoConfigurado } = require('../services/correo');
      assert.equal(correoConfigurado(), true);
      for (const c of CUENTAS) assert.equal(await enviarInvitacion({ correo: c.correo, rol: 'rol', empresa: null, enlace: 'https://x.test' }), false, c.correo);
    } finally {
      for (const [k, v] of previos) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  });

  test('reiniciar: 403 a una cuenta normal; la demo vuelve al inicio, no toca datos reales, revoca la sesión y limita a 1/min', async () => {
    const normal = await api(real.token, 'POST', '/api/demo/reiniciar');
    assert.equal(normal.status, 403);

    const r = await api(tCliente, 'POST', '/api/demo/reiniciar');
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.reiniciada, true);

    const q2 = (await db.collection('quotes').doc('demo-cotizacion-2').get()).data();
    assert.equal(q2.estado, 'enviada');
    assert.equal(q2.pagoPaypal, undefined);
    assert.equal((await db.collection('cases').doc(casoReal).get()).exists, true);
    assert.equal((await db.collection('orgs').doc(real.orgId).get()).exists, true);

    const viejo = await api(tCliente, 'GET', '/api/cases');
    assert.equal(viejo.status, 401); // la sesión anterior quedó revocada

    const nuevo = await tokenDemo('demo-cliente');
    const otraVez = await api(nuevo, 'POST', '/api/demo/reiniciar');
    assert.equal(otraVez.status, 429);
  });
});

// TAREA 64 — Pagos de las cuentas demo: PayPal SANDBOX con credenciales sandbox, mock sin ellas, JAMÁS la API live.
// Prueba unitaria pura (fetch simulado): nada sale a la red.
describe('Pagos demo — proveedor sandbox, mock sin credenciales, nunca live', () => {
  const { getProvider } = require('../services/payments');
  const CLAVES = ['PAYPAL_ENV', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_SANDBOX_CLIENT_ID', 'PAYPAL_SANDBOX_CLIENT_SECRET', 'PAYMENTS_PROVIDER'];
  let guardado, fetchOriginal, llamadas;
  const entorno = (vars) => { for (const k of CLAVES) delete process.env[k]; Object.assign(process.env, vars); };
  const basic = (id, secreto) => `Basic ${Buffer.from(`${id}:${secreto}`).toString('base64')}`;

  const { beforeEach, afterEach } = require('node:test');
  beforeEach(() => {
    guardado = Object.fromEntries(CLAVES.map(k => [k, process.env[k]]));
    fetchOriginal = globalThis.fetch;
    llamadas = [];
    globalThis.fetch = async (url, opciones = {}) => {
      llamadas.push({ url: String(url), autorizacion: opciones.headers?.Authorization });
      const cuerpo = String(url).endsWith('/v1/oauth2/token') ? { access_token: 'tok', expires_in: 3600 }
        : { id: 'ORD-1', status: 'CREATED', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD-1' }] };
      return { ok: true, status: 200, text: async () => JSON.stringify(cuerpo) };
    };
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    for (const k of CLAVES) { if (guardado[k] === undefined) delete process.env[k]; else process.env[k] = guardado[k]; }
  });

  const crearOrden = (proveedor) => proveedor.createOrder({ amount: 10, currency: 'USD', referenceId: 'q1', description: 'x', returnUrl: 'http://localhost/ok', cancelUrl: 'http://localhost/no' });

  test('con PAYPAL_SANDBOX_*: PayPal sandbox (api-m.sandbox.paypal.com) con ESAS credenciales, aunque el entorno sea live', async () => {
    entorno({ PAYPAL_ENV: 'live', PAYPAL_CLIENT_ID: 'id-LIVE', PAYPAL_CLIENT_SECRET: 'secreto-LIVE', PAYPAL_WEBHOOK_ID: 'wh', PAYPAL_SANDBOX_CLIENT_ID: 'id-sandbox', PAYPAL_SANDBOX_CLIENT_SECRET: 'secreto-sandbox' });
    const p = getProvider({ demo: true });
    assert.equal(p.name, 'paypal');
    const orden = await crearOrden(p);
    assert.match(orden.approveUrl, /^https:\/\/www\.sandbox\.paypal\.com\//);
    assert.ok(llamadas.length >= 2 && llamadas.every(l => l.url.startsWith('https://api-m.sandbox.paypal.com/')), JSON.stringify(llamadas));
    assert.equal(llamadas[0].autorizacion, basic('id-sandbox', 'secreto-sandbox'));
    assert.equal(llamadas.some(l => /id-LIVE|api-m\.paypal\.com/.test(`${l.url}${l.autorizacion}`)), false);
  });

  test('sin PAYPAL_SANDBOX_* pero con PAYPAL_ENV=sandbox: sirven PAYPAL_CLIENT_ID/SECRET (el .env local)', async () => {
    entorno({ PAYPAL_ENV: 'sandbox', PAYPAL_CLIENT_ID: 'id-local', PAYPAL_CLIENT_SECRET: 'secreto-local' });
    const p = getProvider({ demo: true });
    assert.equal(p.name, 'paypal');
    await crearOrden(p);
    assert.equal(llamadas[0].url, 'https://api-m.sandbox.paypal.com/v1/oauth2/token');
    assert.equal(llamadas[0].autorizacion, basic('id-local', 'secreto-local'));
  });

  test('PAYPAL_ENV=live y solo credenciales live: la cuenta demo usa el mock y NO hay ninguna llamada a PayPal', async () => {
    entorno({ PAYPAL_ENV: 'live', PAYPAL_CLIENT_ID: 'id-LIVE', PAYPAL_CLIENT_SECRET: 'secreto-LIVE', PAYPAL_WEBHOOK_ID: 'wh' });
    const p = getProvider({ demo: true });
    assert.equal(p.name, 'mock');
    const orden = await crearOrden(p);
    assert.match(orden.orderId, /^mock-/);
    assert.equal(llamadas.length, 0);
  });

  test('sin ninguna credencial, o con los marcadores <...> de .env.example: mock', async () => {
    entorno({});
    assert.equal(getProvider({ demo: true }).name, 'mock');
    entorno({ PAYPAL_ENV: 'sandbox', PAYPAL_CLIENT_ID: '<client-id-de-la-app-paypal>', PAYPAL_CLIENT_SECRET: '<secret-de-la-app-paypal>', PAYPAL_SANDBOX_CLIENT_ID: '', PAYPAL_SANDBOX_CLIENT_SECRET: '' });
    assert.equal(getProvider({ demo: true }).name, 'mock');
    assert.equal(llamadas.length, 0);
  });
});

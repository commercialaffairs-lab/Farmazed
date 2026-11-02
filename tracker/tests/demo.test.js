/**
 * demo.test.js — Modo demo (Rick, 01-nov-2026): cuentas de demostración, estado inicial,
 * aislamiento, pago siempre con el proveedor de prueba, sin correos y reinicio.
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 node --test tracker/tests/demo.test.js
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { admin, db, api, idTokenFor, crearTitular, crearCaso } = require('./_fixtures');
// Claves solo de prueba (emulador): en producción salen de Secret Manager, nunca del repo.
process.env.DEMO_PASSWORD_CLIENTE ||= 'Prueba-cliente-123!';
process.env.DEMO_PASSWORD_REGENTE ||= 'Prueba-regente-123!';
// El seed sube el PDF de ejemplo a Storage desde ESTE proceso (no desde el tracker): services/storage.js
// lee la config (tracker/config.js), que exige el proyecto del emulador.
process.env.FIREBASE_PROJECT_ID ||= 'demo-farmazed';
const { sembrarDemo, esCorreoDemo, DEMO_ORG_ID, CUENTAS } = require('../services/demo');
const { TRADUCCIONES, ETIQUETAS_PANEL } = require('../services/demo_recorrido_textos');

const cuenta = (uid) => CUENTAS.find(c => c.uid === uid);
const tokenDemo = (uid) => idTokenFor(cuenta(uid).correo, cuenta(uid).password);

describe('Modo demo — cuentas, datos de ejemplo y reinicio', () => {
  let real, casoReal, tCliente, tRegente;

  before(async () => {
    real = await crearTitular('demo-real');
    casoReal = await crearCaso('demo-real', { orgId: real.orgId, clientId: real.uid });
    await sembrarDemo();
    tCliente = await tokenDemo('demo-cliente');
    tRegente = await tokenDemo('demo-regente');
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

  test('estado inicial: empresa sin captación con prefill, 2 productos, cotización 2 enviada, 3 pagada, lead', async () => {
    const org = await api(tCliente, 'GET', '/api/me/org');
    assert.equal(org.json.nombre, 'Laboratorios Ejemplo S.A.');
    assert.equal(org.json.captacion, undefined);
    assert.deepEqual(org.json.prefillCaptacion.categoriasProducto, ['medicamentos']);

    const casos = await api(tCliente, 'GET', '/api/cases');
    assert.deepEqual(casos.json.cases.map(c => c.caseCode).sort(), ['FZ-DEMO-2026-0002', 'FZ-DEMO-2026-0003']);

    const q2 = (await db.collection('quotes').doc('demo-cotizacion-2').get()).data();
    const q3 = (await db.collection('quotes').doc('demo-cotizacion-3').get()).data();
    assert.equal(q2.estado, 'enviada');
    assert.equal(q3.estado, 'aceptada');
    assert.equal(q3.pagoPaypal.estado, 'capturada');
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
    assert.deepEqual(casos.json.cases.map(c => c.caseCode).sort(), ['FZ-DEMO-2026-0002', 'FZ-DEMO-2026-0003']);
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

  test('una cuenta demo paga siempre con el proveedor de prueba, aunque el entorno esté en PayPal', async () => {
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

  test('la cuenta demo no puede invitar miembros (mandaría correos reales)', async () => {
    const inv = await api(tCliente, 'POST', '/api/invitations/miembro', { email: 'alguien@ejemplo.test' });
    assert.equal(inv.status, 403);
    assert.equal((await db.collection('invitations').where('orgId', '==', DEMO_ORG_ID).get()).size, 0);
  });

  test('a las cuentas *.demo@ no se les manda ningún correo', async () => {
    assert.equal(esCorreoDemo('cliente.demo@farmazed.com'), true);
    assert.equal(esCorreoDemo('richy@gmail.com'), false);
    const previos = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].map(k => [k, process.env[k]]);
    Object.assign(process.env, { SMTP_HOST: 'smtp.invalid', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'Farmazed <no-reply@farmazed.test>' });
    try {
      const { enviarInvitacion, correoConfigurado } = require('../services/correo');
      assert.equal(correoConfigurado(), true);
      assert.equal(await enviarInvitacion({ correo: 'regente.demo@farmazed.com', rol: 'regente', empresa: null, enlace: 'https://x.test' }), false);
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

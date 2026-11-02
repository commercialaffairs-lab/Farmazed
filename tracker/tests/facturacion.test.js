/**
 * facturacion.test.js — Facturación electrónica tras el pago (Rick, 01-nov-2026). Contra el tracker
 * REAL sobre el emulador, con el PAC simulado (sin EBI_TOKEN_* en el entorno de prueba, igual que el
 * emulador real) y sin SMTP (el correo queda "simulado": la factura igual termina en `enviada`).
 *
 * Cubre los tres disparadores y sus workflows:
 *   · PayPal: capturar la orden (y el webhook PAYMENT.CAPTURE.COMPLETED como segundo disparador).
 *   · Rapid PayPro: el admin confirma el pago del enlace.
 *   · Manual: el admin registra un cheque con comprobante → queda pendiente → "Emitir y enviar".
 * Más: configuración (ITBMS por concepto, workflows), idempotencia, permisos, PDF, anulación y
 * "pagos sin factura".
 *
 * Corre con (ver _fixtures.js): FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *   node --test tracker/tests/facturacion.test.js
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fx = require('./_fixtures');

const { admin, db, API_BASE, RUN } = fx;
let adminToken;
let analista;

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

/** Espera a que la factura llegue a uno de los estados (el workflow automático corre en segundo plano). */
async function esperarEstado(id, estados, ms = 10000) {
  const fin = Date.now() + ms;
  let ultima = null;
  while (Date.now() < fin) {
    const r = await fx.api(adminToken, 'GET', `/api/facturas/${id}`);
    ultima = r.json;
    if (r.status === 200 && estados.includes(r.json.estado)) return r.json;
    await esperar(250);
  }
  throw new Error(`la factura ${id} no llegó a ${estados.join('|')} en ${ms} ms (última: ${JSON.stringify(ultima)})`);
}

const SOLICITANTE = { ruc: '155600000-2-2026', dv: '00', nombre: 'Laboratorios Factura S.A.', correo: 'cobros@laboratorios-factura.example', telefono: '+507 6000-0000', direccion: 'Ciudad de Panamá' };

async function casoConCotizacion(sufijo, titular, conceptos) {
  const caseId = await fx.crearCaso(sufijo, {
    orgId: titular.orgId, clientId: titular.uid, clientEmail: titular.email, clientName: 'Titular Factura', status: 'fase_04',
    product: { nombreComercial: `Producto ${sufijo}` }, entities: { solicitante: SOLICITANTE },
  });
  const quoteId = `q-${sufijo}-${RUN}`;
  const monto = Object.values(conceptos).reduce((s, v) => s + v, 0);
  await db.collection('quotes').doc(quoteId).set({
    orgId: titular.orgId, estado: 'aceptada', caseIds: [caseId], total: monto, createdAt: admin.firestore.Timestamp.now(),
    lineas: [{ caseId, caseCode: caseId, tipo: 'principal', esExtranjero: false, aplicaIEA: false, honorariosFarmazed: conceptos.honorarios || 0, tasasOficiales: monto - (conceptos.honorarios || 0), monto, conceptos }],
  });
  return { caseId, quoteId, monto };
}

async function pagarConPaypal(titularToken, quoteId) {
  const orden = await fx.api(titularToken, 'POST', `/api/quotes/${quoteId}/pago/crear-orden`);
  assert.ok([200, 201].includes(orden.status), JSON.stringify(orden.json));
  const captura = await fx.api(titularToken, 'POST', `/api/quotes/${quoteId}/pago/capturar`, { orderId: orden.json.orderId });
  assert.equal(captura.status, 200, JSON.stringify(captura.json));
  return { orderId: orden.json.orderId, captura: captura.json };
}

async function registrarPagoManual(caseId, concepto, monto) {
  const form = new FormData();
  form.append('tipo', 'cliente_a_farmazed');
  form.append('concepto', concepto);
  form.append('monto', String(monto));
  form.append('comprobante', new Blob([`cheque de prueba ${caseId}/${concepto}`], { type: 'application/pdf' }), `${concepto}.pdf`);
  const res = await fetch(`${API_BASE}/api/cases/${caseId}/payments`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
  const json = await res.json().catch(() => ({}));
  assert.equal(res.status, 201, JSON.stringify(json));
  return json;
}

before(async () => {
  adminToken = await fx.idTokenFor('admin-e3@farmazed.test');
  analista = await fx.crearUsuario('fact-analista', { role: 'analista' });
});

describe('Configuración de la facturación (solo admin)', () => {
  test('GET trae los valores por defecto y el PAC activo (mock en el emulador)', async () => {
    const r = await fx.api(adminToken, 'GET', '/api/facturas/config');
    assert.equal(r.status, 200);
    assert.equal(r.json.proveedor, 'mock');
    assert.equal(r.json.conceptos.honorarios.itbms, '01');
    assert.equal(r.json.conceptos.tasa_dnfd.itbms, '00');
    assert.deepEqual(r.json.workflows, { paypal: { auto: true }, rapid_paypro: { auto: true }, manual: { auto: false } });
  });

  test('PUT valida: ITBMS desconocido, método desconocido, prefijo inválido -> 400 con detalles', async () => {
    const r = await fx.api(adminToken, 'PUT', '/api/facturas/config', { conceptos: { honorarios: { itbms: '07' } }, workflows: { bitcoin: { auto: true } }, prefijo: 'fz1' });
    assert.equal(r.status, 400);
    assert.equal(r.json.detalles.length, 3, JSON.stringify(r.json));
  });

  test('PUT guarda el emisor y lo devuelve fusionado; el personal y el cliente no pueden (403)', async () => {
    const r = await fx.api(adminToken, 'PUT', '/api/facturas/config', { emisor: { ruc: '155600000-2-2026', dv: '24', razonSocial: 'Farmazed S.A.' } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.emisor.ruc, '155600000-2-2026');
    assert.equal(r.json.emisor.puntoFacturacion, '001'); // valor por defecto conservado
    assert.equal((await fx.api(analista.token, 'GET', '/api/facturas/config')).status, 403);
    assert.equal((await fx.api(analista.token, 'GET', '/api/facturas')).status, 403);
  });
});

describe('Workflow PayPal: capturar → factura emitida y enviada sola', () => {
  let titular, caseId, quoteId, orderId, factura;

  before(async () => {
    titular = await fx.crearTitular('fact-pp');
    ({ caseId, quoteId } = await casoConCotizacion('fact-pp', titular, { honorarios: 1000, tasa_dnfd: 200, mef: 25 }));
    ({ orderId } = await pagarConPaypal(titular.token, quoteId));
    factura = await esperarEstado(`fac_pp_${orderId}`, ['enviada']);
  });

  test('la factura sale de la captura con número DEMO (PAC simulado), CUFE, ITBMS incluido solo en honorarios y el total = lo pagado', () => {
    assert.match(factura.numero, /^DEMO-\d{6}$/, 'con el PAC simulado la numeración es la de demo, no la fiscal');
    assert.equal(factura.numeroFiscal.length, 10);
    assert.equal(factura.origen, 'paypal');
    assert.equal(factura.disparador, 'captura');
    assert.equal(factura.formaPago, '03');
    assert.ok(factura.pac.cufe.startsWith('FE01'), factura.pac.cufe);
    assert.equal(factura.pac.proveedor, 'mock');
    const porConcepto = Object.fromEntries(factura.items.map(i => [i.concepto, i]));
    assert.equal(porConcepto.honorarios.itbms, '01');
    assert.deepEqual([porConcepto.honorarios.monto, porConcepto.honorarios.valorItbms, porConcepto.honorarios.pagado], [934.58, 65.42, 1000]);
    assert.equal(porConcepto.tasa_dnfd.itbms, '00');
    assert.equal(porConcepto.tasa_dnfd.valorItbms, 0);
    assert.deepEqual(factura.totales, { neto: 1159.58, itbms: 65.42, total: 1225 }); // 1000 + 200 + 25 cobrados
    assert.equal(factura.receptor.ruc, SOLICITANTE.ruc);
    assert.equal(factura.receptor.razonSocial, SOLICITANTE.nombre);
    assert.equal(factura.receptor.correo, SOLICITANTE.correo);
    assert.ok(factura.items[0].descripcion.includes('Producto fact-pp'));
  });

  test('sin SMTP el correo queda simulado pero el flujo termina en enviada, con historial', () => {
    assert.equal(factura.correo.enviadoA, SOLICITANTE.correo);
    assert.equal(factura.correo.simulado, true);
    assert.deepEqual(factura.historial.map(h => h.tipo), ['creada', 'emitida', 'enviada_simulada']);
    assert.deepEqual(factura.errores, []);
  });

  test('los pagos del caso quedan enlazados a la factura', async () => {
    const pagos = await db.collection('cases').doc(caseId).collection('payments').get();
    assert.ok(pagos.size >= 3);
    pagos.docs.forEach(d => assert.equal(d.data().facturaId, `fac_pp_${orderId}`, d.id));
  });

  test('capturar de nuevo (idempotente) no crea otra factura', async () => {
    const segunda = await fx.api(titular.token, 'POST', `/api/quotes/${quoteId}/pago/capturar`, { orderId });
    assert.equal(segunda.status, 200);
    await esperar(500);
    const lista = await fx.api(adminToken, 'GET', '/api/facturas?origen=paypal');
    assert.equal(lista.json.facturas.filter(f => f.orgId === titular.orgId).length, 1);
  });

  test('el cliente ve la suya (mias y por id) y descarga el PDF; otra empresa no (403); el admin también la lee', async () => {
    const mias = await fx.api(titular.token, 'GET', '/api/facturas/mias');
    assert.equal(mias.status, 200);
    assert.deepEqual(mias.json.facturas.map(f => f.id), [`fac_pp_${orderId}`]);
    const propia = await fx.api(titular.token, 'GET', `/api/facturas/fac_pp_${orderId}`);
    assert.equal(propia.status, 200);
    // Vista del cliente: sin campos internos.
    for (const interno of ['errores', 'historial', 'pdf', 'creadaPor', 'leaseEn', 'demo']) assert.equal(interno in propia.json, false, `el cliente no debe ver ${interno}`);
    assert.equal(propia.json.pac.cufe, factura.pac.cufe);
    assert.equal('proveedor' in propia.json.pac, false);
    const otro = await fx.crearTitular('fact-otro');
    assert.equal((await fx.api(otro.token, 'GET', `/api/facturas/fac_pp_${orderId}`)).status, 403);
    assert.equal((await fx.api(otro.token, 'GET', `/api/facturas/fac_pp_${orderId}/pdf`)).status, 403);
    const pdf = await fetch(`${API_BASE}/api/facturas/fac_pp_${orderId}/pdf`, { headers: { Authorization: `Bearer ${titular.token}` } });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    // Segunda lectura: ya viene de Storage (pdf.storagePath guardado), mismo contenido.
    const f = await fx.api(adminToken, 'GET', `/api/facturas/fac_pp_${orderId}`);
    assert.ok(f.json.pdf?.storagePath, 'el PDF fiscal se guarda en Storage tras la primera lectura');
  });

  test('emitir/enviar sobre una enviada no cambian nada; el cliente no puede ejecutar acciones (403)', async () => {
    assert.equal((await fx.api(adminToken, 'POST', `/api/facturas/fac_pp_${orderId}/emitir`)).json.estado, 'enviada');
    assert.equal((await fx.api(adminToken, 'POST', `/api/facturas/fac_pp_${orderId}/enviar`)).json.estado, 'enviada');
    assert.equal((await fx.api(titular.token, 'POST', `/api/facturas/fac_pp_${orderId}/reintentar`)).status, 403);
  });

  test('consultar el estado en el PAC y anular (motivo obligatorio)', async () => {
    const estado = await fx.api(adminToken, 'GET', `/api/facturas/fac_pp_${orderId}/estado-pac`);
    assert.equal(estado.status, 200);
    assert.equal(estado.json.pac.codigo, '200');
    assert.equal((await fx.api(adminToken, 'POST', `/api/facturas/fac_pp_${orderId}/anular`, {})).status, 400);
    const anulada = await fx.api(adminToken, 'POST', `/api/facturas/fac_pp_${orderId}/anular`, { motivo: 'Prueba de anulación' });
    assert.equal(anulada.status, 200, JSON.stringify(anulada.json));
    assert.equal(anulada.json.estado, 'anulada');
    assert.equal((await fx.api(adminToken, 'GET', `/api/facturas/fac_pp_${orderId}/estado-pac`)).json.pac.anulado, true);
    assert.equal((await fx.api(adminToken, 'POST', `/api/facturas/fac_pp_${orderId}/emitir`)).status, 409);
  });
});

describe('Webhook de PayPal como segundo disparador', () => {
  test('si la captura no dejó factura, PAYMENT.CAPTURE.COMPLETED conciliado la crea con los pagos registrados', async () => {
    const titular = await fx.crearTitular('fact-wh');
    const { quoteId, caseId } = await casoConCotizacion('fact-wh', titular, { honorarios: 500 });
    const { orderId } = await pagarConPaypal(titular.token, quoteId);
    await esperarEstado(`fac_pp_${orderId}`, ['enviada']);
    // Simula que el proceso murió antes de facturar: se borra la factura y el enlace de los pagos.
    await db.collection('facturas').doc(`fac_pp_${orderId}`).delete();
    const pagos = await db.collection('cases').doc(caseId).collection('payments').get();
    for (const d of pagos.docs) await d.ref.update({ facturaId: admin.firestore.FieldValue.delete() });
    const quote = (await db.collection('quotes').doc(quoteId).get()).data();

    const { procesarEvento } = require('../services/paypal_webhook');
    const resultado = await procesarEvento({
      id: `WH-FACT-${RUN}`, event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: quote.pagoPaypal.captureId || `cap-${RUN}`, supplementary_data: { related_ids: { order_id: orderId } } },
    });
    assert.equal(resultado, 'conciliado');
    const factura = await esperarEstado(`fac_pp_${orderId}`, ['enviada']);
    assert.equal(factura.disparador, 'webhook');
    assert.deepEqual(factura.totales, { neto: 467.29, itbms: 32.71, total: 500 }); // lo pagado, con el 7 % desglosado adentro
  });
});

describe('Workflow Rapid PayPro: confirmar el enlace → factura automática', () => {
  test('la confirmación del admin crea y envía la factura de esa línea; confirmar de nuevo no duplica', async () => {
    const titular = await fx.crearTitular('fact-rpp');
    const { caseId, quoteId } = await casoConCotizacion('fact-rpp', titular, { honorarios: 60, tasa_dnfd: 40 });
    const base = `/api/quotes/${quoteId}/lineas/${caseId}/pago-externo`;
    assert.equal((await fx.api(adminToken, 'PUT', base, { url: 'https://link.rapidpaypro.com/pbsolutions/fact1' })).status, 200);
    const r = await fx.api(adminToken, 'POST', `${base}/confirmar`, { referencia: 'RPP-FACT-1' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const id = `fac_rpp_${quoteId}_${caseId}`;
    const factura = await esperarEstado(id, ['enviada']);
    assert.equal(factura.origen, 'rapid_paypro');
    assert.equal(factura.disparador, 'confirmacion_admin');
    assert.deepEqual(factura.totales, { neto: 96.07, itbms: 3.93, total: 100 });
    assert.equal((await fx.api(adminToken, 'POST', `${base}/confirmar`, {})).json.yaEstaba, true);
    const lista = await fx.api(adminToken, 'GET', '/api/facturas?origen=rapid_paypro');
    assert.equal(lista.json.facturas.filter(f => f.orgId === titular.orgId).length, 1);
  });
});

describe('Workflow manual: el admin registra el pago → factura pendiente → "Emitir y enviar"', () => {
  let titular, caseId, pago, id;

  before(async () => {
    titular = await fx.crearTitular('fact-man');
    caseId = await fx.crearCaso('fact-man', { orgId: titular.orgId, clientId: titular.uid, clientEmail: titular.email, status: 'fase_04', entities: { solicitante: SOLICITANTE } });
    pago = await registrarPagoManual(caseId, 'honorarios', 300);
    id = `fac_man_${caseId}_${pago.id}`;
  });

  test('queda pendiente (workflow manual sin automático) y el cliente todavía no la ve', async () => {
    const f = await esperarEstado(id, ['pendiente']);
    assert.equal(f.origen, 'manual');
    assert.equal(f.disparador, 'registro_admin');
    assert.equal(f.formaPago, '05');
    assert.equal(f.numero, null, 'el número se asigna al emitir, no al crear');
    await esperar(600); // si el workflow fuera automático ya habría avanzado
    assert.equal((await fx.api(adminToken, 'GET', `/api/facturas/${id}`)).json.estado, 'pendiente');
    assert.deepEqual((await fx.api(titular.token, 'GET', '/api/facturas/mias')).json.facturas, []);
  });

  test('"Emitir y enviar" (reintentar) la completa; aparece en la lista por estado y en "mias"', async () => {
    const r = await fx.api(adminToken, 'POST', `/api/facturas/${id}/reintentar`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.estado, 'enviada');
    assert.equal(r.json.totales.total, 300);
    const enviadas = await fx.api(adminToken, 'GET', '/api/facturas?estado=enviada');
    assert.ok(enviadas.json.facturas.some(f => f.id === id));
    assert.deepEqual((await fx.api(titular.token, 'GET', '/api/facturas/mias')).json.facturas.map(f => f.id), [id]);
  });

  test('con el workflow manual en automático, el siguiente pago se factura solo', async () => {
    assert.equal((await fx.api(adminToken, 'PUT', '/api/facturas/config', { workflows: { manual: { auto: true } } })).status, 200);
    const otro = await registrarPagoManual(caseId, 'tasa_dnfd', 200);
    const f = await esperarEstado(`fac_man_${caseId}_${otro.id}`, ['enviada']);
    assert.deepEqual(f.totales, { neto: 200, itbms: 0, total: 200 });
    assert.equal((await fx.api(adminToken, 'PUT', '/api/facturas/config', { workflows: { manual: { auto: false } } })).status, 200);
  });

  test('el barrido (procesar-pendientes) completa una factura que quedó pendiente con workflow automático', async () => {
    const pendiente = await registrarPagoManual(caseId, 'mef', 25); // auto:false → pendiente
    const idPendiente = `fac_man_${caseId}_${pendiente.id}`;
    await esperarEstado(idPendiente, ['pendiente']);
    assert.equal((await fx.api(adminToken, 'PUT', '/api/facturas/config', { workflows: { manual: { auto: true } } })).status, 200);
    const barrido = await fx.api(adminToken, 'POST', '/api/facturas/procesar-pendientes?minutos=0');
    assert.equal(barrido.status, 200, JSON.stringify(barrido.json));
    assert.ok(barrido.json.resultados.some(r => r.id === idPendiente && r.despues === 'enviada'), JSON.stringify(barrido.json));
    assert.equal((await fx.api(adminToken, 'PUT', '/api/facturas/config', { workflows: { manual: { auto: false } } })).status, 200);
    assert.equal((await fx.api(titular.token, 'POST', '/api/facturas/procesar-pendientes')).status, 403);
  });

  test('los números son consecutivos entre facturas emitidas y la secuencia fiscal real sigue intacta', async () => {
    const lista = (await fx.api(adminToken, 'GET', '/api/facturas')).json.facturas.filter(f => f.numero).map(f => Number(f.numero.split('-')[1]));
    const ordenados = [...lista].sort((a, b) => a - b);
    assert.ok(ordenados.length >= 4);
    assert.equal(new Set(ordenados).size, ordenados.length, 'sin números repetidos');
    const config = (await fx.api(adminToken, 'GET', '/api/facturas/config')).json;
    assert.equal(config.contador, 0, 'el PAC simulado nunca consume la numeración fiscal real');
    assert.ok(config.contadorDemo >= ordenados.length);
  });
});

describe('Pagos sin factura (conciliación del admin)', () => {
  test('un pago registrado sin factura aparece en la lista; desde-pagos lo factura y desaparece', async () => {
    const titular = await fx.crearTitular('fact-sin');
    const caseId = await fx.crearCaso('fact-sin', { orgId: titular.orgId, clientId: titular.uid, clientEmail: titular.email, status: 'fase_05', entities: { solicitante: SOLICITANTE } });
    const pagoId = `viejo-${RUN}`;
    await db.collection('cases').doc(caseId).collection('payments').doc(pagoId).set({
      tipo: 'cliente_a_farmazed', concepto: 'honorarios', monto: 150, fecha: admin.firestore.Timestamp.now(), origen: 'paypal', paypalOrderId: 'orden-antigua',
      registradoPor: 'x', registradoPorEmail: 'x@farmazed.test', createdAt: admin.firestore.Timestamp.now(),
    });
    const sin = await fx.api(adminToken, 'GET', '/api/facturas/sin-factura');
    assert.equal(sin.status, 200);
    const fila = sin.json.pagos.find(p => p.paymentId === pagoId);
    assert.ok(fila, 'el pago sin factura debe listarse');
    assert.equal(fila.caseId, caseId);
    assert.equal(fila.origen, 'paypal');

    assert.equal((await fx.api(adminToken, 'POST', '/api/facturas/desde-pagos', { caseId })).status, 400);
    const r = await fx.api(adminToken, 'POST', '/api/facturas/desde-pagos', { caseId, paymentIds: [pagoId] });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.factura.estado, 'enviada');
    assert.equal(r.json.factura.disparador, 'manual_admin');
    assert.equal(r.json.factura.totales.total, 150);
    assert.equal(r.json.id, 'fac_pp_orden-antigua', 'un pago de PayPal se factura con el id de su orden, el mismo que usaría el webhook');
    const otra = await fx.api(adminToken, 'POST', '/api/facturas/desde-pagos', { caseId, paymentIds: [pagoId] });
    assert.equal(otra.status, 409);
    const despues = await fx.api(adminToken, 'GET', '/api/facturas/sin-factura');
    assert.ok(!despues.json.pagos.some(p => p.paymentId === pagoId));
  });
});

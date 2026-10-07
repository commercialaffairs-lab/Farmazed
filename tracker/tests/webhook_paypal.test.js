/**
 * webhook_paypal.test.js — Efectos del webhook de PayPal (services/paypal_webhook.js), el
 * cambio de plan entre el plan global y el Plan Empresarial (services/suscripciones.js) y la
 * cola de pagos por revisar del admin. Contra el tracker REAL sobre el emulador, proveedor
 * `mock` (su verifyWebhookSignature siempre es válida: aquí se prueban los EFECTOS; la firma
 * la cubre paypal_contrato.test.js).
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *     node --test tracker/tests/webhook_paypal.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fx     = require('./_fixtures');

const { admin, db, RUN } = fx;
const ahora = () => admin.firestore.Timestamp.now();
let adminToken, n = 0;

const evento = (event_type, resource, id = `WH-${RUN}-${++n}`) => ({ id, event_type, resource });
const webhook = (body) => fx.api(null, 'POST', '/api/webhooks/paypal', body);
const org = async (orgId) => (await db.collection('orgs').doc(orgId).get()).data();
const revision = async (id) => (await db.collection('revisiones_pago').doc(id).get()).data();

// Empresa con una suscripción ya guardada (como la deja POST /subscribe con PayPal real: 'pendiente').
async function empresaCon(sufijo, campos) {
  const orgId = `wh-${sufijo}-${RUN}`;
  await db.collection('orgs').doc(orgId).set({ nombre: `WH ${sufijo}`, createdAt: ahora(), ...campos });
  return orgId;
}
const suscripcion = (subscriptionId, estado = 'pendiente', extra = {}) =>
  ({ estado, tipo: 'global', proveedor: 'paypal', subscriptionId, planId: 'P-1', creadaEn: ahora(), actualizadaEn: ahora(), ...extra });

before(async () => {
  adminToken = await fx.idTokenFor('admin-e3@farmazed.test');
});

describe('Webhook — eventos de suscripción', () => {
  test('ACTIVATED pasa la suscripción de pendiente a activa; el mismo evento otra vez no hace nada', async () => {
    const orgId = await empresaCon('act', { suscripcion: suscripcion('I-ACT') });
    const ev = evento('BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-ACT', custom_id: orgId });

    assert.equal((await webhook(ev)).status, 200);
    assert.equal((await org(orgId)).suscripcion.estado, 'activa');

    await db.collection('orgs').doc(orgId).update({ 'suscripcion.estado': 'suspendida' });
    assert.equal((await webhook(ev)).status, 200, 'un evento repetido se acusa igual');
    assert.equal((await org(orgId)).suscripcion.estado, 'suspendida', 'pero no se vuelve a aplicar');
  });

  test('sin custom_id, la empresa se encuentra por el id de la suscripción', async () => {
    const orgId = await empresaCon('sincustom', { suscripcion: suscripcion(`I-SC-${RUN}`) });
    await webhook(evento('BILLING.SUBSCRIPTION.ACTIVATED', { id: `I-SC-${RUN}` }));
    assert.equal((await org(orgId)).suscripcion.estado, 'activa');
  });

  test('CANCELLED y EXPIRED -> cancelada; SUSPENDED -> suspendida', async () => {
    for (const [tipo, esperado] of [['CANCELLED', 'cancelada'], ['EXPIRED', 'cancelada'], ['SUSPENDED', 'suspendida']]) {
      const orgId = await empresaCon(tipo.toLowerCase(), { suscripcion: suscripcion(`I-${tipo}`, 'activa') });
      await webhook(evento(`BILLING.SUBSCRIPTION.${tipo}`, { id: `I-${tipo}`, custom_id: orgId }));
      assert.equal((await org(orgId)).suscripcion.estado, esperado, tipo);
    }
  });

  test('una suscripción cancelada no revive con un ACTIVATED atrasado', async () => {
    const orgId = await empresaCon('tardio', { suscripcion: suscripcion('I-TARDE', 'cancelada') });
    await webhook(evento('BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-TARDE', custom_id: orgId }));
    assert.equal((await org(orgId)).suscripcion.estado, 'cancelada');
  });

  test('PAYMENT.FAILED no cambia el estado: lo marca y abre una revisión para el admin', async () => {
    const orgId = await empresaCon('fallo', { suscripcion: suscripcion('I-FALLO', 'activa') });
    const ev = evento('BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id: 'I-FALLO', custom_id: orgId });
    await webhook(ev);
    const s = (await org(orgId)).suscripcion;
    assert.equal(s.estado, 'activa');
    assert.ok(s.pagoFallidoEn);
    const rev = await revision(ev.id);
    assert.equal(rev.resuelta, false);
    assert.equal(rev.orgId, orgId);
    assert.equal(rev.eventType, 'BILLING.SUBSCRIPTION.PAYMENT.FAILED');
  });

  test('ACTIVATED de una suscripción que no es la de la empresa -> revisión, la vigente no se toca', async () => {
    const orgId = await empresaCon('ajena', { suscripcion: suscripcion('I-MIA', 'activa') });
    const ev = evento('BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-OTRA', custom_id: orgId });
    await webhook(ev);
    assert.equal((await org(orgId)).suscripcion.subscriptionId, 'I-MIA');
    assert.match((await revision(ev.id)).motivo, /no es la vigente/);
  });

  test('un evento sin id (no se puede garantizar "una sola vez") o de un tipo sin acción -> 200 sin efectos', async () => {
    const orgId = await empresaCon('sinid', { suscripcion: suscripcion('I-SINID') });
    assert.equal((await webhook({ event_type: 'BILLING.SUBSCRIPTION.ACTIVATED', resource: { id: 'I-SINID', custom_id: orgId } })).status, 200);
    assert.equal((await webhook(evento('CUSTOMER.DISPUTE.CREATED', { id: 'I-SINID', custom_id: orgId }))).status, 200);
    assert.equal((await org(orgId)).suscripcion.estado, 'pendiente');
  });
});

describe('Cambio de plan — una sola suscripción, la nueva rige al cierre del ciclo', () => {
  const MES_MS = 31 * 24 * 3600 * 1000;
  let titular;

  before(async () => {
    titular = await fx.crearTitular('wh-cambio');
    const plan = await fx.api(adminToken, 'PUT', '/api/subscription/plan', { nombre: 'Uso de plataforma', monto: 50, periodo: 'mensual' });
    assert.equal(plan.status, 200, JSON.stringify(plan.json));
    assert.equal((await fx.api(titular.token, 'POST', '/api/subscription/subscribe')).status, 201);
    assert.equal((await fx.api(titular.token, 'POST', '/api/empresarial/solicitar', { productosEstimados: '10 productos' })).status, 201);
    const analista = await admin.auth().getUserByEmail('analista@farmazed.test');
    const cond = await fx.api(adminToken, 'PUT', `/api/empresarial/${titular.orgId}/condiciones`, { monto: 500, periodo: 'anual', gestorCuenta: analista.uid });
    assert.equal(cond.status, 200, JSON.stringify(cond.json));
  });

  test('con el plan global activo, suscribirse otra vez al global -> 409', async () => {
    assert.equal((await fx.api(titular.token, 'POST', '/api/subscription/subscribe')).status, 409);
  });

  test('global -> empresarial: queda UNA suscripción (la nueva) que rige cuando termina el ciclo de la anterior', async () => {
    const global = (await org(titular.orgId)).suscripcion;
    assert.equal(global.tipo, 'global');

    const r = await fx.api(titular.token, 'POST', '/api/empresarial/aceptar');
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.cambioDePlan, true);

    const o = await org(titular.orgId);
    assert.equal(o.cambioDePlan, undefined, 'el cambio ya entró en vigor (el mock activa de una)');
    assert.equal(o.suscripcion.estado, 'activa');
    assert.equal(o.suscripcion.tipo, 'empresarial');
    assert.equal(o.suscripcion.subscriptionId, r.json.subscriptionId);
    assert.equal(o.suscripcion.anterior.tipo, 'global');
    assert.equal(o.suscripcion.anterior.subscriptionId, global.subscriptionId);
    assert.equal(o.propuestaEmpresarial.estado, 'aceptada');

    // el ciclo mensual ya facturado se respeta: la nueva rige ~1 mes después, no hoy
    const rige = o.suscripcion.rigeDesde.toMillis();
    assert.ok(rige > Date.now() + 27 * 24 * 3600 * 1000 && rige < Date.now() + MES_MS + 60_000, new Date(rige).toISOString());
    assert.equal(o.suscripcion.anterior.vigenteHasta.toMillis(), rige);
  });

  test('con el Empresarial activo, aceptar otra vez -> 409', async () => {
    assert.equal((await fx.api(titular.token, 'POST', '/api/empresarial/aceptar')).status, 409);
  });

  test('empresarial -> global: el camino de vuelta también es un cambio de plan, y la empresa deja de tener gestor', async () => {
    const antes = await org(titular.orgId);
    const empresarial = antes.suscripcion;
    const gestor = antes.propuestaEmpresarial.gestorCuenta;
    assert.ok(gestor);
    const r = await fx.api(titular.token, 'POST', '/api/subscription/subscribe');
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const o = await org(titular.orgId);
    assert.equal(o.suscripcion.tipo, 'global');
    assert.equal(o.suscripcion.anterior.subscriptionId, empresarial.subscriptionId);
    // la empresarial empezaba a cobrarse en `rigeDesde`: la global nueva rige desde ese mismo día
    assert.equal(o.suscripcion.rigeDesde.toMillis(), empresarial.rigeDesde.toMillis());
    // decisión de Rick (06-oct): conserva su información, pero el gestor era parte del plan
    assert.equal(o.propuestaEmpresarial.gestorCuenta, null);
    assert.equal(o.propuestaEmpresarial.gestorCuentaAnterior, gestor);
    assert.ok(o.propuestaEmpresarial.gestorHasta);
    assert.equal(o.propuestaEmpresarial.productosEstimados, '10 productos', 'la solicitud original se conserva');
  });

  test('sin gestor no se puede re-aceptar: Farmazed define condiciones nuevas y entonces sí', async () => {
    const sinCondiciones = await fx.api(titular.token, 'POST', '/api/empresarial/aceptar');
    assert.equal(sinCondiciones.status, 400);
    assert.match(sinCondiciones.json.error, /condiciones de nuevo/);

    const analista = await admin.auth().getUserByEmail('analista@farmazed.test');
    const cond = await fx.api(adminToken, 'PUT', `/api/empresarial/${titular.orgId}/condiciones`, { monto: 600, periodo: 'mensual', gestorCuenta: analista.uid });
    assert.equal(cond.status, 200, JSON.stringify(cond.json));
    assert.equal(cond.json.gestorHasta, undefined, 'el plan nuevo no arrastra la fecha de fin del anterior');

    const r = await fx.api(titular.token, 'POST', '/api/empresarial/aceptar'); // global activa -> cambio de plan
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await org(titular.orgId)).suscripcion.tipo, 'empresarial');
  });

  test('cancelar la suscripción Empresarial la deja cancelada y sin gestor; para volver hacen falta condiciones nuevas', async () => {
    assert.equal((await fx.api(titular.token, 'POST', '/api/subscription/cancel')).status, 200);
    const o = await org(titular.orgId);
    assert.equal(o.suscripcion.estado, 'cancelada');
    assert.equal(o.propuestaEmpresarial.gestorCuenta, null);
    assert.equal((await fx.api(titular.token, 'POST', '/api/empresarial/aceptar')).status, 400);
    const analista = await admin.auth().getUserByEmail('analista@farmazed.test');
    assert.equal((await fx.api(adminToken, 'PUT', `/api/empresarial/${titular.orgId}/condiciones`, { monto: 600, periodo: 'mensual', gestorCuenta: analista.uid })).status, 200);
    const r = await fx.api(titular.token, 'POST', '/api/empresarial/aceptar');
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.cambioDePlan, false);
    assert.equal((await org(titular.orgId)).suscripcion.tipo, 'empresarial');
  });

  test('PayPal real: el cambio queda pendiente y entra en vigor con el ACTIVATED del webhook', async () => {
    const rigeDesde = admin.firestore.Timestamp.fromMillis(Date.now() + MES_MS);
    const orgId = await empresaCon('cambio-wh', {
      suscripcion: suscripcion('I-VIEJA', 'activa'),
      cambioDePlan: suscripcion('I-NUEVA', 'pendiente', { tipo: 'empresarial', rigeDesde }),
    });
    await webhook(evento('BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-NUEVA', custom_id: orgId }));

    const o = await org(orgId);
    assert.equal(o.cambioDePlan, undefined);
    assert.equal(o.suscripcion.subscriptionId, 'I-NUEVA');
    assert.equal(o.suscripcion.estado, 'activa');
    assert.equal(o.suscripcion.tipo, 'empresarial');
    assert.deepEqual(
      { ...o.suscripcion.anterior, vigenteHasta: o.suscripcion.anterior.vigenteHasta.toMillis() },
      { tipo: 'global', subscriptionId: 'I-VIEJA', planId: 'P-1', vigenteHasta: rigeDesde.toMillis() },
    );
    // El mock no conoce 'I-VIEJA': cancelarla falla, y eso NO puede pasar en silencio (cobraría doble).
    const rev = await revision('cambio-I-VIEJA');
    assert.equal(rev.orgId, orgId);
    assert.match(rev.motivo, /no se pudo cancelar/);

    // La anterior termina después: no toca a la nueva.
    await webhook(evento('BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-VIEJA', custom_id: orgId }));
    assert.equal((await org(orgId)).suscripcion.estado, 'activa');
  });

  test('PayPal cancela una suscripción Empresarial (CANCELLED/EXPIRED): la empresa queda sin gestor', async () => {
    const orgId = await empresaCon('fin-emp', {
      suscripcion: suscripcion('I-EMP-FIN', 'activa', { tipo: 'empresarial', planId: 'P-EMP' }),
      propuestaEmpresarial: { estado: 'aceptada', planId: 'P-EMP', gestorCuenta: 'uid-gestor', gestorCuentaEmail: 'analista@farmazed.test', productosEstimados: '4' },
    });
    await webhook(evento('BILLING.SUBSCRIPTION.EXPIRED', { id: 'I-EMP-FIN', custom_id: orgId }));
    const o = await org(orgId);
    assert.equal(o.suscripcion.estado, 'cancelada');
    assert.equal(o.propuestaEmpresarial.gestorCuenta, null);
    assert.equal(o.propuestaEmpresarial.gestorCuentaAnterior, 'uid-gestor');
    assert.equal(o.propuestaEmpresarial.productosEstimados, '4');
  });

  test('el titular no aprueba el cambio y PayPal lo expira: se descarta y la vigente sigue igual', async () => {
    const orgId = await empresaCon('cambio-exp', {
      suscripcion: suscripcion('I-SIGUE', 'activa'),
      cambioDePlan: suscripcion('I-NUNCA', 'pendiente', { tipo: 'empresarial' }),
    });
    await webhook(evento('BILLING.SUBSCRIPTION.EXPIRED', { id: 'I-NUNCA', custom_id: orgId }));
    const o = await org(orgId);
    assert.equal(o.cambioDePlan, undefined);
    assert.equal(o.suscripcion.subscriptionId, 'I-SIGUE');
    assert.equal(o.suscripcion.estado, 'activa');
  });
});

describe('Webhook — cobros de cotizaciones', () => {
  async function cotizacion(sufijo, pagoPaypal) {
    const id = `wh-q-${sufijo}-${RUN}`;
    await db.collection('quotes').doc(id).set({ orgId: 'org-alfa', estado: 'aceptada', caseIds: [], lineas: [], total: 100, createdAt: ahora(), pagoPaypal });
    return id;
  }
  const pago = async (id) => (await db.collection('quotes').doc(id).get()).data().pagoPaypal;

  test('CAPTURE.COMPLETED de un pago ya registrado -> conciliado, sin revisión', async () => {
    const q = await cotizacion('ok', { estado: 'capturada', orderId: `O-ok-${RUN}`, captureId: `C-ok-${RUN}` });
    const ev = evento('PAYMENT.CAPTURE.COMPLETED', { id: `C-ok-${RUN}` });
    assert.equal((await webhook(ev)).status, 200);
    assert.ok((await pago(q)).conciliadoEn);
    assert.equal(await revision(ev.id), undefined);
  });

  test('CAPTURE.COMPLETED mientras la captura se está registrando -> 503 (PayPal reintenta) y luego concilia', async () => {
    const q = await cotizacion('curso', { estado: 'capturando', orderId: `O-curso-${RUN}` });
    const ev = evento('PAYMENT.CAPTURE.COMPLETED', { id: `C-curso-${RUN}`, supplementary_data: { related_ids: { order_id: `O-curso-${RUN}` } } });
    assert.equal((await webhook(ev)).status, 503);
    assert.equal(await revision(ev.id), undefined, 'todavía no es un problema');

    await db.collection('quotes').doc(q).update({ 'pagoPaypal.estado': 'capturada', 'pagoPaypal.captureId': `C-curso-${RUN}` });
    assert.equal((await webhook(ev)).status, 200, 'el reintento del mismo evento sí se procesa');
    assert.ok((await pago(q)).conciliadoEn);
  });

  test('CAPTURE.COMPLETED de un cobro que no está registrado -> revisión', async () => {
    const sinCotizacion = evento('PAYMENT.CAPTURE.COMPLETED', { id: `C-huerfano-${RUN}` });
    await webhook(sinCotizacion);
    assert.match((await revision(sinCotizacion.id)).motivo, /no corresponde a ninguna cotización/);

    const q = await cotizacion('sinreg', { estado: 'captura_sin_registrar', orderId: `O-sinreg-${RUN}`, captureId: `C-sinreg-${RUN}` });
    const sinRegistrar = evento('PAYMENT.CAPTURE.COMPLETED', { id: `C-sinreg-${RUN}` });
    await webhook(sinRegistrar);
    const rev = await revision(sinRegistrar.id);
    assert.equal(rev.quoteId, q);
    assert.match(rev.motivo, /captura_sin_registrar/);
  });

  test('REFUNDED (la captura viene en el enlace "up") y DENIED -> incidencia en la cotización + revisión', async () => {
    const q = await cotizacion('reemb', { estado: 'capturada', orderId: `O-reemb-${RUN}`, captureId: `C-reemb-${RUN}` });
    const reembolso = evento('PAYMENT.CAPTURE.REFUNDED', {
      id: `R-${RUN}`, links: [{ rel: 'up', href: `https://api-m.paypal.com/v2/payments/captures/C-reemb-${RUN}` }],
    });
    await webhook(reembolso);
    assert.equal((await pago(q)).incidencia.tipo, 'reembolsado');
    assert.equal((await pago(q)).estado, 'capturada', 'el estado del pago no se toca: lo decide el admin');
    assert.equal((await revision(reembolso.id)).quoteId, q);

    const q2 = await cotizacion('deneg', { estado: 'creada', orderId: `O-deneg-${RUN}` });
    const denegado = evento('PAYMENT.CAPTURE.DENIED', { id: `C-deneg-${RUN}`, supplementary_data: { related_ids: { order_id: `O-deneg-${RUN}` } } });
    await webhook(denegado);
    assert.equal((await pago(q2)).incidencia.tipo, 'denegado');
    assert.equal((await revision(denegado.id)).quoteId, q2);
  });
});

describe('Pagos por revisar — solo admin', () => {
  let titular, idRevision;

  before(async () => {
    titular = await fx.crearTitular('wh-rev');
    const ev = evento('PAYMENT.CAPTURE.COMPLETED', { id: `C-lista-${RUN}` });
    await webhook(ev);
    idRevision = ev.id;
  });

  test('sin sesión 401; un cliente 403', async () => {
    assert.equal((await fx.api(null, 'GET', '/api/admin/revisiones-pago')).status, 401);
    assert.equal((await fx.api(titular.token, 'GET', '/api/admin/revisiones-pago')).status, 403);
    assert.equal((await fx.api(titular.token, 'POST', `/api/admin/revisiones-pago/${idRevision}/resolver`, {})).status, 403);
  });

  test('el admin la ve en la lista, la resuelve con una nota y deja de salir', async () => {
    const antes = await fx.api(adminToken, 'GET', '/api/admin/revisiones-pago');
    assert.equal(antes.status, 200);
    const fila = antes.json.revisiones.find(r => r.id === idRevision);
    assert.ok(fila, 'la revisión abierta está en la lista');
    assert.equal(typeof fila.creadaEn, 'string');

    assert.equal((await fx.api(adminToken, 'POST', `/api/admin/revisiones-pago/${idRevision}/resolver`, { nota: 123 })).status, 400);
    assert.equal((await fx.api(adminToken, 'POST', `/api/admin/revisiones-pago/${idRevision}/resolver`, { nota: 'Era una prueba de sandbox.' })).status, 200);

    const guardada = await revision(idRevision);
    assert.equal(guardada.resuelta, true);
    assert.equal(guardada.nota, 'Era una prueba de sandbox.');
    const despues = await fx.api(adminToken, 'GET', '/api/admin/revisiones-pago');
    assert.ok(!despues.json.revisiones.some(r => r.id === idRevision));
  });

  test('resolver una que no existe -> 404', async () => {
    assert.equal((await fx.api(adminToken, 'POST', `/api/admin/revisiones-pago/no-existe-${RUN}/resolver`, {})).status, 404);
  });
});

describe('Webhook — rate limit', () => {
  test('301 llamadas en un minuto desde la misma IP -> la última da 429', async () => {
    const ip = require('./_ip').ipUnica();
    let ultimo;
    for (let i = 0; i < 301; i++) ultimo = await fx.api(null, 'POST', '/api/webhooks/paypal', evento('X.IGNORADO', {}), { 'X-Forwarded-For': ip });
    assert.equal(ultimo.status, 429);
  });
});

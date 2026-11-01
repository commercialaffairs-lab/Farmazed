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
const { sembrarDemo, esCorreoDemo, DEMO_ORG_ID, CUENTAS } = require('../services/demo');

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

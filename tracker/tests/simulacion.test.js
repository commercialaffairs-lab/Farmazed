/**
 * simulacion.test.js — Cuenta de SIMULACIÓN (Rick, 14-nov-2026): una sola cuenta genérica
 * (simulacion@farmazed.com, claims demo:true + simulacion:true + orgId sim-org) que cambia de PERFIL con la
 * cabecera X-Fz-Perfil y recorre el flujo de la A a la Z sobre los mismos datos; ámbito aislado de la demo y de lo real.
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 node --test tracker/tests/simulacion.test.js
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { admin, db, api, idTokenFor, crearTitular, crearCaso } = require('./_fixtures');
// Claves solo de prueba (emulador): en producción salen de Secret Manager, nunca del repo.
process.env.DEMO_PASSWORD_CLIENTE ||= 'Prueba-cliente-123!';
process.env.DEMO_PASSWORD_REGENTE ||= 'Prueba-regente-123!';
process.env.DEMO_PASSWORD_FARMACEUTICO ||= 'Prueba-farmaceutico-123!';
process.env.DEMO_PASSWORD_LEGAL ||= 'Prueba-legal-123!';
process.env.DEMO_PASSWORD_ADMIN ||= 'Prueba-admin-123!';
process.env.DEMO_PASSWORD_SIMULACION ||= 'Prueba-simulacion-123!';
process.env.FIREBASE_PROJECT_ID ||= 'demo-farmazed';
const { sembrarDemo, esCorreoDemo, DEMO_ORG_ID, SIM_ORG_ID, CUENTAS, CUENTA_SIMULACION, idsDe } = require('../services/demo');
const { getProvider } = require('../services/payments');
const { SIM_PERFILES } = require('../services/demo_recorrido_textos');

const S = idsDe(SIM_ORG_ID);
const perfil = (p) => ({ 'X-Fz-Perfil': p });
const cuentaDemo = (uid) => CUENTAS.find(c => c.uid === uid);

describe('Simulación — una cuenta, cuatro perfiles, ámbito sim-org aislado', () => {
  let real, casoReal, tSim, tCliDemo, tAdminDemo, tRegDemo, tAdminReal, casoSimId;

  before(async () => {
    real = await crearTitular('sim-real');
    casoReal = await crearCaso('sim-real', { orgId: real.orgId, clientId: real.uid });
    await sembrarDemo(DEMO_ORG_ID);
    await sembrarDemo(SIM_ORG_ID);
    tSim = await idTokenFor(CUENTA_SIMULACION.correo, CUENTA_SIMULACION.password);
    tCliDemo = await idTokenFor(cuentaDemo('demo-cliente').correo, cuentaDemo('demo-cliente').password);
    tAdminDemo = await idTokenFor(cuentaDemo('demo-admin').correo, cuentaDemo('demo-admin').password);
    tRegDemo = await idTokenFor(cuentaDemo('demo-regente').correo, cuentaDemo('demo-regente').password);
    tAdminReal = await idTokenFor('admin-e3@farmazed.test');
  });

  test('la cuenta existe con claims demo+simulacion, orgId sim-org y perfil por defecto cliente; /api/demo/estado lo refleja', async () => {
    const u = await admin.auth().getUser('demo-simulacion');
    assert.deepEqual(
      [u.email, u.customClaims.demo, u.customClaims.simulacion, u.customClaims.role, u.customClaims.orgId],
      ['simulacion@farmazed.com', true, true, 'cliente_titular', SIM_ORG_ID],
    );
    const sinCabecera = await api(tSim, 'GET', '/api/demo/estado');
    assert.equal(sinCabecera.status, 200);
    assert.deepEqual([sinCabecera.json.demo, sinCabecera.json.simulacion, sinCabecera.json.perfil, sinCabecera.json.orgId], [true, true, 'cliente_titular', SIM_ORG_ID]);
    assert.deepEqual(sinCabecera.json.perfiles, ['cliente_titular', 'admin', 'regente', 'abogado']);
    assert.deepEqual(sinCabecera.json.cuentas.map(c => c.correo), ['simulacion@farmazed.com']);
    // Panel de pago de prueba (14-nov-2026): cómo paga esta cuenta y la cuenta compradora sandbox (si está configurada).
    assert.ok(['mock', 'paypal-sandbox'].includes(sinCabecera.json.pagoDemo?.proveedor), 'pagoDemo.proveedor');
    assert.ok('comprador' in sinCabecera.json.pagoDemo, 'pagoDemo.comprador (null si no hay PAYPAL_SANDBOX_COMPRADOR_*)');
    const comoAdmin = await api(tSim, 'GET', '/api/demo/estado', undefined, perfil('admin'));
    assert.equal(comoAdmin.json.perfil, 'admin');
    const invalido = await api(tSim, 'GET', '/api/demo/estado', undefined, perfil('superusuario'));
    assert.equal(invalido.json.perfil, 'cliente_titular', 'un perfil desconocido se ignora');
    // La cuenta demo clásica no cambia: estado sin simulación.
    const demo = await api(tCliDemo, 'GET', '/api/demo/estado');
    assert.deepEqual([demo.json.simulacion, demo.json.perfil, demo.json.orgId], [false, null, DEMO_ORG_ID]);
    assert.ok(demo.json.pagoDemo && 'comprador' in demo.json.pagoDemo, 'las cuentas demo clásicas también reciben pagoDemo');
  });

  test('estado inicial de sim-org: empresa propia, 3 expedientes FZ-SIM, cotización 4 en borrador, lead sim:true', async () => {
    const org = await api(tSim, 'GET', '/api/me/org');
    assert.equal(org.json.nombre, 'Laboratorio Simulación S.A.');
    const casos = await api(tSim, 'GET', '/api/cases');
    assert.deepEqual(casos.json.cases.map(c => c.caseCode).sort(), ['FZ-SIM-2026-0002', 'FZ-SIM-2026-0003', 'FZ-SIM-2026-0004']);
    assert.ok(casos.json.cases.every(c => c.orgId === SIM_ORG_ID && c.demo === true && c.sim === true));
    assert.equal((await db.collection('quotes').doc(S.cotizacion4).get()).data().estado, 'borrador');
    const lead = (await db.collection('contactLeads').doc(S.lead).get()).data();
    assert.deepEqual([lead.demo, lead.sim, lead.estado], [true, true, 'nuevo']);
    // La demo clásica sigue intacta y sin la marca sim.
    assert.equal((await db.collection('contactLeads').doc('demo-lead-1').get()).data().sim, undefined);
  });

  test('continuidad A→Z: el caso creado como Cliente lo ven Admin, Responsable Farmacéutico y Legal; código FZ-SIM sin gastar el contador', async () => {
    const contadorAntes = (await db.collection('meta').doc('counters').get()).data();
    const creado = await api(tSim, 'POST', '/api/cases', { tramiteType: 'medicamentos', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'], product: { nombreComercial: 'Producto Simulación 1' } });
    assert.equal(creado.status, 201, JSON.stringify(creado.json));
    casoSimId = creado.json.id;
    assert.match(creado.json.caseCode, /^FZ-SIM-\d{4}-A\d{4}$/);
    assert.deepEqual([creado.json.orgId, creado.json.demo, creado.json.sim], [SIM_ORG_ID, true, true]);
    assert.deepEqual((await db.collection('meta').doc('counters').get()).data(), contadorAntes, 'el contador global de códigos no se mueve');

    for (const p of ['admin', 'regente', 'abogado']) {
      const lista = await api(tSim, 'GET', '/api/cases', undefined, perfil(p));
      assert.equal(lista.status, 200, `${p}: ${JSON.stringify(lista.json)}`);
      assert.ok(lista.json.cases.some(c => c.id === casoSimId), `${p} debería ver el caso creado como cliente`);
      assert.ok(lista.json.cases.every(c => c.orgId === SIM_ORG_ID), `${p} solo ve sim-org`);
      const detalle = await api(tSim, 'GET', `/api/cases/${casoSimId}`, undefined, perfil(p));
      assert.equal(detalle.status, 200, `${p} abre el expediente`);
    }
    const permisos = await api(tSim, 'GET', '/api/me/permissions', undefined, perfil('regente'));
    assert.equal(permisos.json.role, 'regente');
  });

  test('aislamiento: la simulación no ve la demo ni lo real; la demo no ve la simulación; la cabecera no afecta a una cuenta real', async () => {
    const comoAdmin = await api(tSim, 'GET', '/api/cases', undefined, perfil('admin'));
    assert.ok(comoAdmin.json.cases.every(c => c.caseCode.startsWith('FZ-SIM')), 'el admin de la simulación solo ve FZ-SIM');
    assert.equal((await api(tSim, 'GET', '/api/cases/demo-caso-3', undefined, perfil('admin'))).status, 403);
    assert.equal((await api(tSim, 'GET', `/api/cases/${casoReal}`, undefined, perfil('admin'))).status, 403);
    assert.equal((await api(tSim, 'GET', '/api/cases/demo-caso-3', undefined, perfil('regente'))).status, 403);
    assert.equal((await api(tSim, 'GET', '/api/quotes/demo-cotizacion-4', undefined, perfil('admin'))).status, 403);

    const adminDemo = await api(tAdminDemo, 'GET', '/api/cases');
    assert.ok(adminDemo.json.cases.length > 0 && adminDemo.json.cases.every(c => c.caseCode.startsWith('FZ-DEMO')), 'admin.demo solo ve FZ-DEMO');
    assert.equal((await api(tAdminDemo, 'GET', `/api/cases/${S.caso3}`)).status, 403);
    assert.equal((await api(tRegDemo, 'GET', `/api/cases/${S.caso3}`)).status, 403);
    assert.ok(!(await api(tRegDemo, 'GET', '/api/cases')).json.cases.some(c => c.orgId === SIM_ORG_ID));
    const leadsDemo = await api(tAdminDemo, 'GET', '/api/contact-leads');
    assert.ok(!leadsDemo.json.leads.some(l => l.id === S.lead), 'el admin demo no ve el lead de la simulación');
    const leadsSim = await api(tSim, 'GET', '/api/contact-leads', undefined, perfil('admin'));
    assert.deepEqual(leadsSim.json.leads.map(l => l.id), [S.lead]);

    // Una cuenta real con la cabecera no gana nada: sigue siendo cliente.
    assert.equal((await api(real.token, 'GET', '/api/admin/estado', undefined, perfil('admin'))).status, 403);
    assert.equal((await api(real.token, 'GET', '/api/me/permissions', undefined, perfil('admin'))).json.role, 'cliente_titular');
    assert.equal((await api(real.token, 'GET', '/api/demo/estado')).json.pagoDemo, null, 'una cuenta real nunca recibe la cuenta compradora de prueba');
  });

  test('perfil Admin: ajusta y envía la cotización 4 (envío simulado); el Cliente la ve enviada; lo global se ve pero no se guarda', async () => {
    const enviada = await api(tSim, 'POST', `/api/quotes/${S.cotizacion4}/send`, {}, perfil('admin'));
    assert.equal(enviada.status, 200, JSON.stringify(enviada.json));
    assert.equal(enviada.json.simulado, true);
    assert.match(enviada.json.aviso, /simulación/i);
    assert.match(enviada.json.aviso, /pestaña Cliente/);
    const comoCliente = await api(tSim, 'GET', `/api/quotes/${S.cotizacion4}`);
    assert.equal(comoCliente.status, 200);
    assert.equal(comoCliente.json.estado, 'enviada');
    // Finanzas: solo facturas/pagos de sim-org; precios: se leen pero no se guardan.
    assert.equal((await api(tSim, 'GET', '/api/facturas', undefined, perfil('admin'))).status, 200);
    const precios = await api(tSim, 'GET', '/api/admin/pricing', undefined, perfil('admin'));
    assert.equal(precios.status, 200);
    const guardar = await api(tSim, 'PATCH', '/api/admin/pricing/cualquiera', { honorarios: 1 }, perfil('admin'));
    assert.equal(guardar.status, 403);
    assert.equal(guardar.json.demoNoGuarda, true);
    // Sin el perfil admin, la cuenta no puede enviar cotizaciones (es cliente).
    assert.equal((await api(tSim, 'POST', `/api/quotes/${S.cotizacion2}/send`, {})).status, 403);
  });

  test('recorrido por perfil: los pasos del rol elegido, textos de la simulación y el siguiente perfil de la secuencia', async () => {
    const esperado = { cliente_titular: ['cliente', 'admin'], admin: ['admin', 'regente'], regente: ['regente', 'abogado'], abogado: ['legal', 'cliente_titular'] };
    for (const [p, [rol, siguiente]] of Object.entries(esperado)) {
      const r = await api(tSim, 'GET', '/api/demo/recorrido?idioma=es', undefined, perfil(p));
      assert.equal(r.status, 200, `${p}: ${JSON.stringify(r.json)}`);
      assert.deepEqual([r.json.rol, r.json.simulacion, r.json.perfil, r.json.siguientePerfil.perfil], [rol, true, p, siguiente]);
      assert.equal(r.json.siguientePerfil.rotulo, SIM_PERFILES.es[siguiente]);
      assert.equal(r.json.etiquetas.titulo, 'Simulación');
      assert.match(r.json.etiquetas.completoTexto, /\[Reiniciar simulación\]/);
      assert.deepEqual(r.json.extra.ids, { caso2: S.caso2, caso3: S.caso3, caso4: S.caso4 });
    }
    const adminEs = await api(tSim, 'GET', '/api/demo/recorrido?idioma=es', undefined, perfil('admin'));
    const cot = adminEs.json.pasos.find(x => x.id === 'cotizacion');
    assert.equal(cot.hecho, true, 'la cotización 4 ya se envió en la prueba anterior');
    assert.match(cot.descripcion, /pestaña "Cliente"/);
    assert.doesNotMatch(cot.descripcion, /cliente\.demo/);
    const adminEn = await api(tSim, 'GET', '/api/demo/recorrido?idioma=en', undefined, perfil('admin'));
    assert.match(adminEn.json.pasos.find(x => x.id === 'pago').descripcion, /"Client" tab/);
    // La demo clásica conserva sus textos y no trae siguientePerfil.
    const demo = await api(tCliDemo, 'GET', '/api/demo/recorrido?idioma=es');
    assert.equal(demo.json.simulacion, false);
    assert.equal(demo.json.siguientePerfil, undefined);
    assert.equal(demo.json.etiquetas.titulo, 'Recorrido demo');
  });

  test('sin correos ni dinero real: simulacion@ cuenta como correo demo y paga con el proveedor de prueba (sandbox/mock)', () => {
    assert.equal(esCorreoDemo('simulacion@farmazed.com'), true);
    assert.equal(esCorreoDemo('cliente.demo@farmazed.com'), true);
    assert.equal(esCorreoDemo('simulador@farmazed.com'), false);
    const proveedorSim = getProvider({ uid: 'demo-simulacion', demo: true, simulacion: true, role: 'cliente_titular' });
    const proveedorDemo = getProvider({ uid: 'demo-cliente', demo: true, role: 'cliente_titular' });
    assert.ok(proveedorSim && typeof proveedorSim === 'object');
    assert.equal(proveedorSim, proveedorDemo, 'misma regla que las cuentas demo: nunca la API live');
  });

  // No se reinicia con cliente.demo aquí: el límite de 1 reinicio/minuto es por cuenta y lo necesita tests/demo.test.js
  // (las suites comparten el mismo tracker). El reinicio de la demo lo hace el admin real indicando el ámbito.
  test('reiniciar: la simulación vuelve a su inicio sin tocar la demo; el admin real reinicia un ámbito concreto (la demo) sin tocar sim-org', async () => {
    const simReinicio = await api(tSim, 'POST', '/api/demo/reiniciar');
    assert.equal(simReinicio.status, 200, JSON.stringify(simReinicio.json));
    assert.equal(simReinicio.json.ambito, SIM_ORG_ID);
    assert.equal((await db.collection('cases').doc(casoSimId).get()).exists, false, 'el caso creado en la simulación desaparece');
    assert.equal((await db.collection('quotes').doc(S.cotizacion4).get()).data().estado, 'borrador', 'la cotización 4 vuelve a borrador');
    assert.ok((await db.collection('cases').doc('demo-caso-3').get()).exists, 'la demo sigue ahí');
    assert.ok((await db.collection('cases').doc(casoReal).get()).exists, 'lo real sigue ahí');

    assert.equal((await api(tAdminReal, 'POST', '/api/demo/reiniciar', {})).status, 403, 'el admin real sin ámbito no reinicia nada');
    assert.equal((await api(real.token, 'POST', '/api/demo/reiniciar', { ambito: SIM_ORG_ID })).status, 403, 'un cliente real no reinicia aunque mande el ámbito');
    // Dejar una huella en sim-org y reiniciar la DEMO como admin real: la huella sobrevive.
    await db.collection('cases').doc(S.caso3).update({ notes: 'huella-sim' });
    const porAdmin = await api(tAdminReal, 'POST', '/api/demo/reiniciar', { ambito: DEMO_ORG_ID });
    assert.equal(porAdmin.status, 200, JSON.stringify(porAdmin.json));
    assert.equal(porAdmin.json.ambito, DEMO_ORG_ID);
    assert.equal((await db.collection('cases').doc(S.caso3).get()).data().notes, 'huella-sim', 'el reinicio de la demo no toca la simulación');
    assert.equal((await db.collection('quotes').doc('demo-cotizacion-4').get()).data().estado, 'borrador');
  });
});

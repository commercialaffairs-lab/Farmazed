/**
 * pagos_rapidpaypro.test.js — Rapid PayPro por enlace de pago (routes/pago_externo.js, 07-oct):
 * el admin guarda un enlace por producto, el cliente lo ve, y al confirmar el pago se registran
 * los pagos por concepto (origen 'rapidpaypro') que destraban fase_05, sin duplicar y sin
 * mezclarse con PayPal. Contra el tracker REAL sobre el emulador.
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fx     = require('./_fixtures');

const { admin, db, RUN } = fx;
let adminToken, titular, quoteId, caseId;
const base = () => `/api/quotes/${quoteId}/lineas/${caseId}/pago-externo`;
const quote = async () => (await db.collection('quotes').doc(quoteId).get()).data();
const pagos = async () => (await db.collection('cases').doc(caseId).collection('payments').get()).docs.map(d => d.data());

before(async () => {
  adminToken = await fx.idTokenFor('admin-e3@farmazed.test');
  titular = await fx.crearTitular('rpp');
  caseId = await fx.crearCaso('rpp', { orgId: titular.orgId, clientId: titular.uid, status: 'fase_04' });
  quoteId = `q-rpp-${RUN}`;
  await db.collection('quotes').doc(quoteId).set({
    orgId: titular.orgId, estado: 'aceptada', caseIds: [caseId], total: 100, createdAt: admin.firestore.Timestamp.now(),
    lineas: [{ caseId, caseCode: caseId, tipo: 'principal', esExtranjero: false, aplicaIEA: false, honorariosFarmazed: 60, tasasOficiales: 40, monto: 100, conceptos: { honorarios: 60, tasa_dnfd: 40 } }],
  });
});

describe('Enlace de Rapid PayPro por producto', () => {
  test('el titular no puede ponerlo (403); el admin sí, y solo https de rapidpaypro.com', async () => {
    assert.equal((await fx.api(titular.token, 'PUT', base(), { url: 'https://link.rapidpaypro.com/x/1' })).status, 403);
    assert.equal((await fx.api(adminToken, 'PUT', base(), { url: 'http://link.rapidpaypro.com/x/1' })).status, 400);
    assert.equal((await fx.api(adminToken, 'PUT', base(), { url: 'https://evil.example.com/rapidpaypro.com' })).status, 400);
    const ok = await fx.api(adminToken, 'PUT', base(), { url: 'https://link.rapidpaypro.com/pbsolutions/abc123' });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.pagoExterno.estado, 'pendiente');
  });

  test('el cliente ve el enlace en su cotización', async () => {
    const r = await fx.api(titular.token, 'GET', '/api/quotes');
    const q = r.json.quotes.find(x => x.id === quoteId);
    assert.equal(q.lineas[0].pagoExterno.url, 'https://link.rapidpaypro.com/pbsolutions/abc123');
  });

  test('confirmar antes de pagar: solo admin con payments.create; sin referencia válida -> 400', async () => {
    assert.equal((await fx.api(titular.token, 'POST', base() + '/confirmar', {})).status, 403);
    assert.equal((await fx.api(adminToken, 'POST', base() + '/confirmar', { referencia: 'x'.repeat(121) })).status, 400);
  });

  test('confirmar registra los pagos por concepto (origen rapidpaypro) y destraba fase_05; repetir no duplica', async () => {
    const r = await fx.api(adminToken, 'POST', base() + '/confirmar', { referencia: 'RPP-0001' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.deepEqual(r.json.pagos.map(p => [p.concepto, p.monto]).sort(), [['honorarios', 60], ['tasa_dnfd', 40]]);
    const p = await pagos();
    assert.equal(p.length, 2);
    assert.ok(p.every(x => x.origen === 'rapidpaypro' && x.tipo === 'cliente_a_farmazed'));
    const q = await quote();
    assert.equal(q.lineas[0].pagoExterno.estado, 'confirmado');
    assert.equal(q.lineas[0].pagoExterno.referencia, 'RPP-0001');
    assert.equal(q.historial.at(-1).tipo, 'pago_externo_confirmado');

    const otra = await fx.api(adminToken, 'POST', base() + '/confirmar', {});
    assert.equal(otra.json.yaEstaba, true);
    assert.equal((await pagos()).length, 2, 'confirmar dos veces no duplica pagos');

    // el gate de fase_05: con honorarios y tasa_dnfd pagados, el caso avanza a fase_05
    const avance = await fx.api(adminToken, 'PATCH', `/api/cases/${caseId}`, { status: 'fase_05' });
    assert.equal(avance.status, 200, JSON.stringify(avance.json));
  });

  test('con un producto pagado por Rapid PayPro, PayPal no cobra la cotización (409) y el enlace ya no se cambia', async () => {
    assert.equal((await fx.api(titular.token, 'POST', `/api/quotes/${quoteId}/pago/crear-orden`)).status, 409);
    assert.equal((await fx.api(adminToken, 'PUT', base(), { url: 'https://link.rapidpaypro.com/pbsolutions/otro' })).status, 409);
  });
});

/**
 * estructura.test.js — TAREA 41. Estructura y atomicidad del backend:
 *  - applyTransition(): transiciones concurrentes consistentes y statusHistory atómico;
 *  - validación de pagos manuales (monto/fecha) ANTES de subir nada a Storage;
 *  - precio ausente al cotizar = error explícito (y el fallo de la línea del borrador queda
 *    visible, ya no se traga);
 *  - createOrg() único.
 * (El CORS sin comodines de subdominio se prueba en config.test.js.)
 *
 *   FZ_API_PORT=8070 FZ_AUTH_PORT=9198 FZ_FIRESTORE_PORT=8190 \
 *   STORAGE_EMULATOR_HOST=http://localhost:9298 GCS_BUCKET=demo-farmazed.appspot.com \
 *     node --test tracker/tests/estructura.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const admin  = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('estructura.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const db       = admin.firestore();
const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';
const RUN      = Date.now();

async function tokenFor(email) {
  const res = await fetch(`http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function api(token, method, path, body, extra = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const { ipUnica } = require('./_ip');
const nuevoCaso = async (sufijo, campos = {}) => {
  const id = `t41-${sufijo}-${RUN}`;
  await db.collection('cases').doc(id).set({
    status: 'fase_01', caseCode: `T41-${sufijo}`, orgId: 'org-beta', clientId: 'role-titular-beta',
    asignados: { analista: null, abogado: null, regente: null }, createdAt: admin.firestore.Timestamp.now(), ...campos,
  });
  return id;
};
const historial = async (id) => (await db.collection('cases').doc(id).collection('statusHistory').orderBy('at', 'asc').get()).docs.map(d => d.data());

let adm;
before(async () => { adm = await tokenFor('admin-e3@farmazed.test'); });

describe('applyTransition — concurrencia y atomicidad', () => {
  test('dos peticiones idénticas en paralelo -> UNA sola transición registrada (la otra ve el status nuevo)', async () => {
    const id = await nuevoCaso('par');
    const resp = await Promise.all([1, 2].map(() => api(adm, 'PATCH', `/api/cases/${id}`, { status: 'fase_02' })));
    assert.ok(resp.every(r => r.status === 200), JSON.stringify(resp));
    const h = await historial(id);
    assert.equal(h.length, 1, `una sola entrada de historial, no ${h.length}`);
    assert.equal((await db.collection('cases').doc(id).get()).data().status, 'fase_02');
  });

  test('dos transiciones DISTINTAS en paralelo -> el historial es una cadena coherente (cada "from" es el "to" anterior)', async () => {
    const id = await nuevoCaso('cadena');
    const [a, b] = await Promise.all([
      api(adm, 'PATCH', `/api/cases/${id}`, { status: 'fase_02' }),
      api(adm, 'PATCH', `/api/cases/${id}`, { status: 'cerrado', reason: 'prueba de concurrencia' }),
    ]);
    assert.ok([a, b].some(r => r.status === 200), JSON.stringify([a, b]));
    const h = await historial(id);
    assert.equal(h[0].from, 'fase_01');
    for (let i = 1; i < h.length; i++) assert.equal(h[i].from, h[i - 1].to, `entrada ${i} rompe la cadena: ${JSON.stringify(h)}`);
    assert.equal((await db.collection('cases').doc(id).get()).data().status, h[h.length - 1].to, 'el status final es el último "to"');
  });

  test('si falla la escritura del historial, el status NO cambia (update + historial en una sola transacción)', async () => {
    const { applyTransition } = require('../services/transitions');
    const id = await nuevoCaso('atomico');
    // db "con fallo": la transacción es la real, pero cualquier t.set/create (el historial) lanza antes de confirmar
    const dbFalla = {
      collection: (...a) => db.collection(...a),
      runTransaction: (fn, opts) => db.runTransaction((t) => fn(new Proxy(t, {
        get(obj, prop) {
          if (prop === 'set' || prop === 'create') return () => { throw new Error('fallo simulado escribiendo statusHistory'); };
          const v = obj[prop];
          return typeof v === 'function' ? v.bind(obj) : v;
        },
      })), opts),
    };
    await assert.rejects(
      applyTransition({ caseId: id, to: 'fase_02', update: { status: 'fase_02', updatedAt: admin.firestore.Timestamp.now() }, actor: { uid: 'u', email: 'u@x.test' }, db: dbFalla }),
      /fallo simulado/);
    assert.equal((await db.collection('cases').doc(id).get()).data().status, 'fase_01', 'el status quedó intacto');
    assert.equal((await historial(id)).length, 0);

    // control: sin fallo, se escriben las dos cosas juntas
    const ok = await applyTransition({ caseId: id, to: 'fase_02', update: { status: 'fase_02', updatedAt: admin.firestore.Timestamp.now() }, actor: { uid: 'u', email: 'u@x.test' } });
    assert.equal(ok.ok, true);
    assert.equal((await db.collection('cases').doc(id).get()).data().status, 'fase_02');
    assert.equal((await historial(id)).length, 1);
  });

  test('status igual al actual (noop): se escriben los demás campos y NO hay historial; override con motivo queda registrado', async () => {
    const id = await nuevoCaso('noop');
    const r = await api(adm, 'PATCH', `/api/cases/${id}`, { status: 'fase_01', notes: 'solo notas' });
    assert.equal(r.status, 200);
    assert.equal((await db.collection('cases').doc(id).get()).data().notes, 'solo notas');
    assert.equal((await historial(id)).length, 0);

    const salto = await api(adm, 'PATCH', `/api/cases/${id}`, { status: 'fase_09', override: true, reason: 'prueba de override' });
    assert.equal(salto.status, 200, JSON.stringify(salto.json));
    const h = await historial(id);
    assert.equal(h.length, 1);
    assert.deepEqual([h[0].from, h[0].to, h[0].override, h[0].reason], ['fase_01', 'fase_09', true, 'prueba de override']);
  });

  test('un staff NO autorizado para mover el caso recibe 403 con "from" y no se escribe nada (autorizar dentro de la transacción)', async () => {
    const id = await nuevoCaso('rol', { asignados: { analista: null, abogado: 'role-abogado', regente: null } });
    const abogado = await tokenFor('abogado@farmazed.test');
    const r = await api(abogado, 'PATCH', `/api/cases/${id}`, { status: 'fase_02' });
    assert.equal(r.status, 403);
    assert.equal(r.json.from, 'fase_01');
    assert.equal((await db.collection('cases').doc(id).get()).data().status, 'fase_01');
    assert.equal((await historial(id)).length, 0);
  });

  test('el gate rechaza con 400 y no escribe nada (REST)', async () => {
    const id = await nuevoCaso('gate');
    const r = await api(adm, 'PATCH', `/api/cases/${id}`, { status: 'fase_09' }); // salto inválido sin override
    assert.equal(r.status, 400);
    assert.equal((await db.collection('cases').doc(id).get()).data().status, 'fase_01');
    assert.equal((await historial(id)).length, 0);
  });

  test('el error de la línea del borrador de cotización YA NO se traga: queda marcado en el caso y se avisa en la respuesta', async () => {
    const fila = db.collection('pricing').doc('med_regular_sintesis_24sep');
    const antes = await fila.get();
    assert.ok(antes.exists, 'el fixture del tarifario 24-sep debe tener esta fila');
    await fila.delete();
    try {
      const id = await nuevoCaso('aviso', { status: 'fase_03', tramiteType: 'medicamentos', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
      const r = await api(adm, 'PATCH', `/api/cases/${id}`, { status: 'fase_04' });
      assert.equal(r.status, 200, 'la transición SÍ se hizo: no es un 500');
      assert.ok(Array.isArray(r.json.avisos) && r.json.avisos.length === 1, JSON.stringify(r.json));
      assert.match(r.json.avisos[0], /med_regular_sintesis_24sep/);
      const caso = (await db.collection('cases').doc(id).get()).data();
      assert.equal(caso.status, 'fase_04');
      assert.match(caso.cotizacionBorradorError.mensaje, /med_regular_sintesis_24sep/);
    } finally {
      await fila.set(antes.data());
    }
  });
});

describe('Cotizar con precio ausente', () => {
  test('tarifarioDe: la fila de precio inexistente es un error explícito, no una línea de $0', async () => {
    const { tarifarioDe } = require('../services/quotes');
    await assert.rejects(tarifarioDe(`categoria-que-no-existe-${RUN}`), /Falta la fila de precio/);
  });

  test('tarifarioDe: una fila sin componentes también es error; sin categoría (ruta no tarifada) sigue en cero', async () => {
    const { tarifarioDe } = require('../services/quotes');
    const id = `t41-sin-componentes-${RUN}`;
    await db.collection('pricing').doc(id).set({ name: 'x' });
    await assert.rejects(tarifarioDe(id), /no tiene componentes/);
    const cero = await tarifarioDe(null);
    assert.equal(cero.honorariosFarmazed, 0);
    assert.equal(cero.tasasOficiales, 0);
  });
});

describe('Pagos manuales: validar ANTES de subir', () => {
  const storage = process.env.STORAGE_EMULATOR_HOST ? new Storage({ projectId: 'demo-farmazed', apiEndpoint: process.env.STORAGE_EMULATOR_HOST }) : null;
  const blobsDe = async (caso) => storage ? (await storage.bucket(process.env.GCS_BUCKET).getFiles({ prefix: `cases/${caso}/` }))[0].length : null;

  const pago = (campos) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ tipo: 'cliente_a_farmazed', concepto: 'honorarios', ...campos })) if (v !== undefined) fd.append(k, v);
    fd.append('comprobante', new Blob(['%PDF-1.4 prueba'], { type: 'application/pdf' }), 'comprobante.pdf');
    return fd;
  };

  test('monto 0 / negativo / Infinity / texto / vacío / fecha basura -> 400 y NO queda ningún blob en Storage', async () => {
    assert.ok(storage, 'STORAGE_EMULATOR_HOST y GCS_BUCKET deben estar definidos para esta prueba');
    const id = await nuevoCaso('pagos');
    const malos = [
      { monto: '0' }, { monto: '-5' }, { monto: 'Infinity' }, { monto: '1e999' }, { monto: 'abc' }, { monto: '' },
      { monto: '100', fecha: 'basura' }, { monto: '100', fecha: '2026-13-45' },
    ];
    for (const campos of malos) {
      const r = await api(adm, 'POST', `/api/cases/${id}/payments`, pago(campos));
      assert.equal(r.status, 400, `${JSON.stringify(campos)} -> ${r.status} ${JSON.stringify(r.json)}`);
    }
    assert.equal(await blobsDe(id), 0, 'ninguna petición inválida dejó un comprobante huérfano');
    assert.equal((await db.collection('cases').doc(id).collection('payments').get()).size, 0);
  });

  test('un pago válido sí se registra (con y sin fecha) y su comprobante queda en Storage', async () => {
    const id = await nuevoCaso('pagos-ok');
    const sinFecha = await api(adm, 'POST', `/api/cases/${id}/payments`, pago({ monto: '100.50' }));
    assert.equal(sinFecha.status, 201, JSON.stringify(sinFecha.json));
    const conFecha = await api(adm, 'POST', `/api/cases/${id}/payments`, pago({ monto: '25', concepto: 'tasa_dnfd', fecha: '2026-10-04' }));
    assert.equal(conFecha.status, 201, JSON.stringify(conFecha.json));
    assert.equal(sinFecha.json.monto, 100.5);
    if (storage) assert.equal(await blobsDe(id), 2);
  });

  test('createConceptPayment: un monto NaN/undefined/negativo es error (ya no se vuelve un pago de $0)', async () => {
    const { createConceptPayment } = require('../services/payments_ledger');
    for (const monto of [undefined, NaN, 'abc', -1, Infinity]) {
      await assert.rejects(createConceptPayment(`t41-nan-${RUN}`, { concepto: 'honorarios', monto, registradoPor: 'u', registradoPorEmail: 'u@x' }), /monto inválido/, String(monto));
    }
  });
});

describe('createOrg único', () => {
  const base = (d) => ({ nombre: d.nombre, tieneCreatedAt: !!d.createdAt, createdBy: d.createdBy });

  test('orgs, invitations/titular y contact-leads/invitar producen el mismo documento base (nombre con trim, createdAt, createdBy)', async () => {
    const o = await api(adm, 'POST', '/api/orgs', { nombre: `  Org Directa ${RUN}  ` });
    assert.equal(o.status, 201, JSON.stringify(o.json));
    const t = await api(adm, 'POST', '/api/invitations/titular', { email: `t41-titular-${RUN}@farmazed.test`, orgName: `  Org Titular ${RUN}  ` });
    assert.equal(t.status, 201, JSON.stringify(t.json));

    const lead = await api(null, 'POST', '/api/contact-leads', { nombre: 'Lead', correo: `t41-lead-${RUN}@farmazed.test` }, { 'X-Forwarded-For': ipUnica() });
    assert.equal(lead.status, 201, JSON.stringify(lead.json));
    const inv = await api(adm, 'POST', `/api/contact-leads/${lead.json.id}/invitar`, { orgName: `  Org Lead ${RUN}  ` });
    assert.equal(inv.status, 201, JSON.stringify(inv.json));

    const docs = await Promise.all([o.json.id, t.json.orgId, inv.json.orgId].map(async id => (await db.collection('orgs').doc(id).get()).data()));
    const uidAdmin = (await admin.auth().getUserByEmail('admin-e3@farmazed.test')).uid;
    for (const d of docs) {
      assert.deepEqual(base(d), { nombre: d.nombre.trim(), tieneCreatedAt: true, createdBy: uidAdmin }, 'nombre sin espacios sobrantes y createdBy = quien la creó');
    }
    assert.equal(docs[2].plan, 'consulta', 'el plan solo está donde se pasó');
    assert.equal(docs[0].plan, undefined);
  });

  test('el auto-registro usa el mismo createOrg (createdBy null) con pais/telefonoContacto/plan', async () => {
    const correo = `t41-reg-${RUN}@farmazed.test`;
    const r = await api(null, 'POST', '/api/register', { nombre: 'Reg', correo, password: PASSWORD, telefono: '+507 6000-0000', empresa: `  Empresa Reg ${RUN} `, pais: 'Panamá', plan: 'registro' }, { 'X-Forwarded-For': ipUnica() });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const d = (await db.collection('orgs').doc(r.json.orgId).get()).data();
    assert.equal(d.nombre, `Empresa Reg ${RUN}`);
    assert.equal(d.createdBy, null);
    assert.equal(d.pais, 'Panamá');
    assert.equal(d.telefonoContacto, '+507 6000-0000');
    assert.equal(d.plan, 'registro');
    assert.ok(d.createdAt);
  });
});

describe('Borrador de cotización: dos casos de la misma empresa en paralelo', () => {
  test('salir a la vez de fase_03 deja UN borrador con las dos líneas (sin duplicar ni pisarse)', async () => {
    const orgId = `t43-org-${RUN}`;
    await db.collection('orgs').doc(orgId).set({ nombre: 'T43 paralelo', createdAt: admin.firestore.Timestamp.now() });
    const campos = { status: 'fase_03', orgId, tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'], tramiteType: 'medicamentos' };
    const ids = await Promise.all([1, 2, 3, 4].map(n => nuevoCaso(`par${n}`, campos)));
    const rs = await Promise.all(ids.map(id => api(adm, 'PATCH', `/api/cases/${id}`, { status: 'fase_04' })));
    rs.forEach(r => assert.equal(r.status, 200, JSON.stringify(r.json)));

    const borradores = (await db.collection('quotes').where('orgId', '==', orgId).where('estado', '==', 'borrador').get()).docs;
    assert.equal(borradores.length, 1, 'un solo borrador por empresa');
    assert.deepEqual([...borradores[0].data().caseIds].sort(), [...ids].sort(), 'los 4 casos, ninguna línea perdida');
    assert.equal(borradores[0].data().lineas.length, 4);
  });
});

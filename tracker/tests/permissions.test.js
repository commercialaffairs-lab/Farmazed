/**
 * permissions.test.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Matriz endpoint × rol contra el tracker REAL corriendo sobre el emulador
 * (node:test nativo — sin dependencias nuevas). Corre con
 * tracker/scripts/run_permission_tests.sh, que levanta emuladores + tracker
 * + siembra tracker/scripts/seed_roles.js antes de esto.
 *
 * Convención de "permitido" en estas pruebas: NO 403. Un endpoint puede
 * seguir devolviendo 400 por datos faltantes/estado del caso — eso no es un
 * fallo de PERMISOS, es el endpoint funcionando normalmente después de
 * pasar el gate de rol. Lo que se prueba aquí es exactamente ese gate.
 *
 * Orden del archivo IMPORTA: los grupos de solo-lectura van primero; los
 * grupos que mutan un caso (confirm_7/8/10/12, override) van al final, y
 * dentro de cada uno los roles NO permitidos se prueban antes que el
 * permitido (que sí cambia el estado del caso, al ser la última prueba que
 * lo necesita).
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const admin  = require('../utils/firebase_admin.js');

const AUTH_PORT      = process.env.FZ_AUTH_PORT;
const API_PORT       = process.env.FZ_API_PORT;
const FIRESTORE_PORT = process.env.FZ_FIRESTORE_PORT;
if (!AUTH_PORT || !API_PORT || !FIRESTORE_PORT) {
  throw new Error('permissions.test.js: FZ_AUTH_PORT / FZ_API_PORT / FZ_FIRESTORE_PORT no definidos — usar run_permission_tests.sh, no "node --test" directo.');
}
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${AUTH_PORT}`;
process.env.FIRESTORE_EMULATOR_HOST     = `localhost:${FIRESTORE_PORT}`;
if (!admin.apps.length) admin.initializeApp({ projectId: 'demo-farmazed' });

const API_BASE = `http://localhost:${API_PORT}`;
const PASSWORD = 'Farmazed123!';

const EMAILS = {
  cliente_titular: 'titular-alfa@farmazed.test',
  cliente_miembro: 'miembro-alfa@farmazed.test',
  titular_beta:    'titular-beta@farmazed.test',
  analista:        'analista@farmazed.test',
  abogado:         'abogado@farmazed.test',
  regente:         'regente@farmazed.test',
  admin:           'admin-e3@farmazed.test',
};

const tokens = {};

async function idTokenFor(email) {
  const res = await fetch(
    `http://localhost:${AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`No se pudo autenticar ${email}: ${JSON.stringify(data)}`);
  return data.idToken;
}

// Para los endpoints multipart (documents.upload, payments.create) mandar
// un body JSON vacío alcanza: multer ignora el parseo si el Content-Type no
// es multipart y deja `req.file` undefined — el gate de permiso (que corre
// ANTES de multer en la cadena) ya se probó para entonces; lo único que
// interesa aquí es distinguir 403 (rol) de cualquier otro código.
async function api(role, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokens[role]}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

before(async () => {
  for (const [key, email] of Object.entries(EMAILS)) {
    tokens[key] = await idTokenFor(email);
  }
});

// ═══ cases.create — solo cliente_titular, cliente_miembro, admin ═══════════════
describe('cases.create', () => {
  test('cliente_titular puede crear un caso', async () => {
    const { status } = await api('cliente_titular', 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 201);
  });
  test('cliente_miembro puede crear un caso', async () => {
    const { status } = await api('cliente_miembro', 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 201);
  });
  test('admin puede crear un caso', async () => {
    const { status } = await api('admin', 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 201);
  });
  test('analista NO puede crear un caso', async () => {
    const { status } = await api('analista', 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 403);
  });
  test('abogado NO puede crear un caso', async () => {
    const { status } = await api('abogado', 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 403);
  });
  test('regente NO puede crear un caso', async () => {
    const { status } = await api('regente', 'POST', '/api/cases', { tramiteType: 'medicamentos' });
    assert.equal(status, 403);
  });
});

// ═══ cases.list — filtrado por org/asignación ══════════════════════════════════
describe('cases.list — ownership', () => {
  test('titular_alfa ve case-org-alfa, no case-org-beta', async () => {
    const { status, json } = await api('cliente_titular', 'GET', '/api/cases');
    assert.equal(status, 200);
    const ids = json.cases.map(c => c.id);
    assert.ok(ids.includes('case-org-alfa'));
    assert.ok(!ids.includes('case-org-beta'));
  });
  test('titular_beta ve case-org-beta, no case-org-alfa', async () => {
    const { status, json } = await api('titular_beta', 'GET', '/api/cases');
    assert.equal(status, 200);
    const ids = json.cases.map(c => c.id);
    assert.ok(ids.includes('case-org-beta'));
    assert.ok(!ids.includes('case-org-alfa'));
  });
  test('analista solo ve los casos que tiene asignados (org Alfa), no case-org-beta', async () => {
    const { status, json } = await api('analista', 'GET', '/api/cases');
    assert.equal(status, 200);
    const ids = json.cases.map(c => c.id);
    assert.ok(ids.includes('case-org-alfa'));
    assert.ok(!ids.includes('case-org-beta'));
  });
  test('admin ve ambas empresas', async () => {
    const { status, json } = await api('admin', 'GET', '/api/cases');
    assert.equal(status, 200);
    const ids = json.cases.map(c => c.id);
    assert.ok(ids.includes('case-org-alfa'));
    assert.ok(ids.includes('case-org-beta'));
  });
});

// ═══ cases.read — el escenario pedido explícitamente: cliente de A, caso de B ══
describe('cases.read — 403 cruzado entre empresas', () => {
  test('titular_beta recibe 403 al leer un caso de la empresa Alfa', async () => {
    const { status } = await api('titular_beta', 'GET', '/api/cases/case-org-alfa');
    assert.equal(status, 403);
  });
  test('miembro_alfa SÍ puede leer un caso de su propia empresa (Alfa)', async () => {
    const { status } = await api('cliente_miembro', 'GET', '/api/cases/case-org-alfa');
    assert.equal(status, 200);
  });
  test('abogado (asignado) SÍ puede leer case-org-alfa', async () => {
    const { status } = await api('abogado', 'GET', '/api/cases/case-org-alfa');
    assert.equal(status, 200);
  });
});

// ═══ documents.* — role gate (caso aislado: case-docs-test) ════════════════════
describe('documents.upload — solo cliente_titular/cliente_miembro/admin', () => {
  test('cliente_titular pasa el gate (llega al 400 por falta de archivo, no 403)', async () => {
    const { status } = await api('cliente_titular', 'POST', '/api/cases/case-docs-test/documents', {});
    assert.notEqual(status, 403);
  });
  test('analista NO puede subir un documento de cliente', async () => {
    const { status } = await api('analista', 'POST', '/api/cases/case-docs-test/documents', {});
    assert.equal(status, 403);
  });
});

describe('documents.request — analista/abogado/regente/admin, no cliente', () => {
  test('analista puede solicitar un documento', async () => {
    const { status } = await api('analista', 'POST', '/api/cases/case-docs-test/documents/request', { faddiDocId: 'poder', message: 'test' });
    assert.equal(status, 200);
  });
  test('abogado puede solicitar un documento', async () => {
    const { status } = await api('abogado', 'POST', '/api/cases/case-docs-test/documents/request', { faddiDocId: 'clv', message: 'test' });
    assert.equal(status, 200);
  });
  test('regente puede solicitar un documento', async () => {
    const { status } = await api('regente', 'POST', '/api/cases/case-docs-test/documents/request', { faddiDocId: 'bpm', message: 'test' });
    assert.equal(status, 200);
  });
  test('cliente_titular NO puede solicitarse un documento a sí mismo', async () => {
    const { status } = await api('cliente_titular', 'POST', '/api/cases/case-docs-test/documents/request', { faddiDocId: 'formula', message: 'test' });
    assert.equal(status, 403);
  });
});

describe('documents.review — analista/abogado/regente/admin, no cliente', () => {
  test('cliente_titular NO puede aprobar/rechazar un documento', async () => {
    const { status } = await api('cliente_titular', 'PATCH', '/api/cases/case-docs-test/documents/algun-doc-id', { status: 'approved' });
    assert.equal(status, 403);
  });
  test('analista puede intentar revisar un documento (pasa el gate; 404 porque el id no existe, no 403)', async () => {
    const { status } = await api('analista', 'PATCH', '/api/cases/case-docs-test/documents/no-existe', { status: 'approved' });
    assert.equal(status, 404);
  });
});

// ═══ payments.create — solo admin (caso aislado: case-payments-test) ═══════════
describe('payments.create — solo admin', () => {
  test('admin pasa el gate (llega al 400 por falta de comprobante, no 403)', async () => {
    const { status } = await api('admin', 'POST', '/api/cases/case-payments-test/payments', {});
    assert.notEqual(status, 403);
  });
  test('cliente_titular NO puede registrar un pago', async () => {
    const { status } = await api('cliente_titular', 'POST', '/api/cases/case-payments-test/payments', {});
    assert.equal(status, 403);
  });
  test('analista NO puede registrar un pago', async () => {
    const { status } = await api('analista', 'POST', '/api/cases/case-payments-test/payments', {});
    assert.equal(status, 403);
  });
});

// ═══ orgs.list / orgs.manage / invitations.* — TAREA 35: listar es staff+admin,
// crear y ver miembros siguen siendo solo admin ═══════════════════════════════
describe('orgs.list — staff y admin', () => {
  test('admin puede listar empresas', async () => {
    const { status } = await api('admin', 'GET', '/api/orgs');
    assert.equal(status, 200);
  });
  test('analista puede listar empresas (necesita encontrar la empresa para cargar el diagnóstico)', async () => {
    const { status } = await api('analista', 'GET', '/api/orgs');
    assert.equal(status, 200);
  });
  test('abogado y regente también pueden listar empresas', async () => {
    assert.equal((await api('abogado', 'GET', '/api/orgs')).status, 200);
    assert.equal((await api('regente', 'GET', '/api/orgs')).status, 200);
  });
  test('cliente_titular NO puede listar empresas', async () => {
    const { status } = await api('cliente_titular', 'GET', '/api/orgs');
    assert.equal(status, 403);
  });
});

describe('orgs.manage — crear empresa directa y ver miembros, solo admin', () => {
  test('admin puede crear una empresa directamente', async () => {
    const { status } = await api('admin', 'POST', '/api/orgs', { nombre: 'Empresa Directa Admin Test' });
    assert.equal(status, 201);
  });
  test('analista NO puede crear una empresa directamente (sí puede listar, no crear)', async () => {
    const { status } = await api('analista', 'POST', '/api/orgs', { nombre: 'Empresa Directa Analista Test' });
    assert.equal(status, 403);
  });
  test('admin puede ver los miembros de cualquier empresa', async () => {
    const { status } = await api('admin', 'GET', '/api/orgs/org-alfa/members');
    assert.notEqual(status, 403);
  });
  test('analista NO puede ver los miembros de una empresa (sí puede listar, no entrar al detalle)', async () => {
    const { status } = await api('analista', 'GET', '/api/orgs/org-alfa/members');
    assert.equal(status, 403);
  });
});

describe('invitations.*', () => {
  test('admin puede invitar a un titular (crea empresa)', async () => {
    const { status } = await api('admin', 'POST', '/api/invitations/titular', { email: 'nuevo-titular@test.com', orgName: 'Empresa Nueva' });
    assert.equal(status, 201);
  });
  test('admin puede invitar a un empleado', async () => {
    const { status } = await api('admin', 'POST', '/api/invitations/empleado', { email: 'nuevo-analista@test.com', role: 'analista' });
    assert.equal(status, 201);
  });
  test('cliente_titular NO puede invitar a un empleado', async () => {
    const { status } = await api('cliente_titular', 'POST', '/api/invitations/empleado', { email: 'x@test.com', role: 'analista' });
    assert.equal(status, 403);
  });
  test('cliente_titular SÍ puede invitar a un miembro (de su propia empresa — orgId sale del token, no del body)', async () => {
    const { status, json } = await api('cliente_titular', 'POST', '/api/invitations/miembro', { email: 'nuevo-miembro@test.com' });
    assert.equal(status, 201);
    assert.equal(json.orgId, 'org-alfa'); // nunca la empresa que el body pudiera intentar mandar
  });
  test('admin NO puede usar la ruta de invitar miembro (es del titular, no del admin)', async () => {
    const { status } = await api('admin', 'POST', '/api/invitations/miembro', { email: 'x@test.com' });
    assert.equal(status, 403);
  });
});

// ═══ cases.assign — solo admin ═════════════════════════════════════════════════
describe('cases.assign', () => {
  test('cliente_titular no puede reasignar (el campo se ignora, sigue sin cambio)', async () => {
    const before = await api('admin', 'GET', '/api/cases/case-docs-test');
    const { status } = await api('cliente_titular', 'PATCH', '/api/cases/case-docs-test', { asignados: { analista: 'otro-uid', abogado: null, regente: null } });
    assert.equal(status, 400); // el cliente no puede PATCHear fuera de 'draft' — case-docs-test está en fase_07
    const after = await api('admin', 'GET', '/api/cases/case-docs-test');
    assert.deepEqual(after.json.asignados, before.json.asignados);
  });
  test('admin puede reasignar', async () => {
    const { status, json } = await api('admin', 'PATCH', '/api/cases/case-docs-test', { asignados: { analista: 'role-analista', abogado: 'role-abogado', regente: 'role-regente' } });
    assert.equal(status, 200);
    assert.deepEqual(json.asignados, { analista: 'role-analista', abogado: 'role-abogado', regente: 'role-regente' });
  });
});

// ═══ §H.8/TAREA 21 — fase_08 exige DOS confirmaciones (legal=abogado,
// técnica/matrices=regente) antes de avanzar a fase_09. Caso aislado:
// case-fase8-test. ════════════════════════════════════════════════════════════
describe('fase_08 — dos confirmaciones (legal + técnica) antes de avanzar', () => {
  test('sin ninguna confirmación, ni el analista puede avanzar a fase_09 (400, no 403 — el rol sí puede, falta el dato)', async () => {
    const { status, json } = await api('analista', 'PATCH', '/api/cases/case-fase8-test', { status: 'fase_09' });
    assert.equal(status, 400);
    assert.match(json.error, /dos confirmaciones/);
  });

  test('POST confirmaciones/fase8 tipo:legal — solo abogado (o admin)', async () => {
    assert.equal((await api('analista', 'POST', '/api/cases/case-fase8-test/confirmaciones/fase8', { tipo: 'legal' })).status, 403);
    assert.equal((await api('regente', 'POST', '/api/cases/case-fase8-test/confirmaciones/fase8', { tipo: 'legal' })).status, 403);
    const ok = await api('abogado', 'POST', '/api/cases/case-fase8-test/confirmaciones/fase8', { tipo: 'legal' });
    assert.equal(ok.status, 200);
    assert.ok(ok.json.confirmacionesFase8.legal);
  });

  test('con solo la confirmación legal, avanzar a fase_09 sigue bloqueado (falta la técnica)', async () => {
    const { status, json } = await api('analista', 'PATCH', '/api/cases/case-fase8-test', { status: 'fase_09' });
    assert.equal(status, 400);
    assert.match(json.error, /técnica/);
  });

  test('POST confirmaciones/fase8 tipo:tecnica — solo regente (o admin)', async () => {
    assert.equal((await api('analista', 'POST', '/api/cases/case-fase8-test/confirmaciones/fase8', { tipo: 'tecnica' })).status, 403);
    assert.equal((await api('abogado', 'POST', '/api/cases/case-fase8-test/confirmaciones/fase8', { tipo: 'tecnica' })).status, 403);
    const ok = await api('regente', 'POST', '/api/cases/case-fase8-test/confirmaciones/fase8', { tipo: 'tecnica' });
    assert.equal(ok.status, 200);
    assert.ok(ok.json.confirmacionesFase8.tecnica);
  });

  test('abogado/regente NO mueven el status ellos mismos, ni con las dos confirmaciones ya completas', async () => {
    assert.equal((await api('abogado', 'PATCH', '/api/cases/case-fase8-test', { status: 'fase_09' })).status, 403);
    assert.equal((await api('regente', 'PATCH', '/api/cases/case-fase8-test', { status: 'fase_09' })).status, 403);
  });

  test('con las dos confirmaciones, el analista SÍ avanza fase_08 -> fase_09', async () => {
    const { status, json } = await api('analista', 'PATCH', '/api/cases/case-fase8-test', { status: 'fase_09' });
    assert.equal(status, 200);
    assert.equal(json.status, 'fase_09');
  });
});

// ═══ §H.8/TAREA 21 — fase_08 -> fase_08 (subsanación, nuevo ciclo): se
// registra como transición real y limpia las dos confirmaciones. ═══════════════
describe('fase_08 -> fase_08 (subsanación) limpia las confirmaciones', () => {
  test('confirmar las dos, reciclar la fase, y verificar que quedaron en null', async () => {
    await api('abogado', 'POST', '/api/cases/case-fase8-recycle-test/confirmaciones/fase8', { tipo: 'legal' });
    await api('regente', 'POST', '/api/cases/case-fase8-recycle-test/confirmaciones/fase8', { tipo: 'tecnica' });

    const antes = await api('admin', 'GET', '/api/cases/case-fase8-recycle-test');
    assert.ok(antes.json.confirmacionesFase8.legal);
    assert.ok(antes.json.confirmacionesFase8.tecnica);

    const reciclo = await api('analista', 'PATCH', '/api/cases/case-fase8-recycle-test', { status: 'fase_08' });
    assert.equal(reciclo.status, 200);

    const despues = await api('admin', 'GET', '/api/cases/case-fase8-recycle-test');
    assert.equal(despues.json.confirmacionesFase8.legal, null);
    assert.equal(despues.json.confirmacionesFase8.tecnica, null);

    const hist = await api('admin', 'GET', '/api/cases/case-fase8-recycle-test/history');
    assert.ok(hist.json.history.some(h => h.from === 'fase_08' && h.to === 'fase_08'), 'el reciclo debe quedar en el historial');
  });
});

// ═══ §H.8/TAREA 21 — fase_10 la confirma el ANALISTA (cambió de dueño
// respecto al modelo de 14 fases, donde la confirmaba el regente). ═════════════
describe('fase_10 — la confirma el analista', () => {
  test('abogado NO puede mover el caso fuera de fase_10', async () => {
    const { status } = await api('abogado', 'PATCH', '/api/cases/case-fase10-test', { status: 'fase_11' });
    assert.equal(status, 403);
  });
  test('regente NO puede mover el caso fuera de fase_10 (cambió respecto al modelo viejo)', async () => {
    const { status } = await api('regente', 'PATCH', '/api/cases/case-fase10-test', { status: 'fase_11' });
    assert.equal(status, 403);
  });
  test('analista SÍ puede confirmar fase_10 -> fase_11', async () => {
    const { status, json } = await api('analista', 'PATCH', '/api/cases/case-fase10-test', { status: 'fase_11' });
    assert.equal(status, 200);
    assert.equal(json.status, 'fase_11');
  });
});

// ═══ §H.8/TAREA 21 — fuera de fase_08/fase_10, SOLO el analista mueve el
// status (abogado/regente nunca lo hacen directo, ni en fases secuenciales
// sin control). ════════════════════════════════════════════════════════════════
describe('Fases secuenciales — solo el analista mueve el status', () => {
  test('abogado NO puede', async () => {
    assert.equal((await api('abogado', 'PATCH', '/api/cases/case-org-alfa-secuencial', { status: 'fase_03' })).status, 403);
  });
  test('regente NO puede', async () => {
    assert.equal((await api('regente', 'PATCH', '/api/cases/case-org-alfa-secuencial', { status: 'fase_03' })).status, 403);
  });
  test('analista SÍ puede', async () => {
    const { status, json } = await api('analista', 'PATCH', '/api/cases/case-org-alfa-secuencial', { status: 'fase_03' });
    assert.equal(status, 200);
    assert.equal(json.status, 'fase_03');
  });
});

// ═══ §H.8/TAREA 21 — fase_04 -> cerrado exige motivo (cliente no acepta la
// cotización). ══════════════════════════════════════════════════════════════════
describe('fase_04 -> cerrado exige motivo', () => {
  test('sin reason, 400', async () => {
    const { status, json } = await api('admin', 'PATCH', '/api/cases/case-cerrado-test', { status: 'cerrado' });
    assert.equal(status, 400);
    assert.match(json.error, /reason/);
  });
  test('con reason, 200 y queda en el historial', async () => {
    const { status } = await api('admin', 'PATCH', '/api/cases/case-cerrado-test', { status: 'cerrado', reason: 'Cliente no aceptó la cotización — precio' });
    assert.equal(status, 200);
    const hist = await api('admin', 'GET', '/api/cases/case-cerrado-test/history');
    const entry = hist.json.history.find(h => h.to === 'cerrado');
    assert.equal(entry.reason, 'Cliente no aceptó la cotización — precio');
  });
});

// ═══ §H.8/TAREA 21 — al entrar a observado_dnfd se calcula la fecha límite
// de subsanación (Art. 22 D.E. 27/2024): Regular 3 meses, Abreviado 8 días
// hábiles. ═══════════════════════════════════════════════════════════════════════
describe('observado_dnfd — fecha límite de subsanación', () => {
  test('Regular: fecha límite ~3 meses después, sin nota', async () => {
    const { status, json } = await api('admin', 'PATCH', '/api/cases/case-observado-regular-test', { status: 'observado_dnfd' });
    assert.equal(status, 200);
    const c = await api('admin', 'GET', '/api/cases/case-observado-regular-test');
    assert.equal(c.json.fechaLimiteSubsanacionNota, null);
    const dias = (new Date(c.json.fechaLimiteSubsanacion) - new Date()) / 86400000;
    assert.ok(dias > 85 && dias < 95, `esperaba ~90 días, dio ${dias}`);
  });

  test('Abreviado: fecha límite ~8 días hábiles después, sin nota', async () => {
    const { status } = await api('admin', 'PATCH', '/api/cases/case-observado-abreviado-test', { status: 'observado_dnfd' });
    assert.equal(status, 200);
    const c = await api('admin', 'GET', '/api/cases/case-observado-abreviado-test');
    assert.equal(c.json.fechaLimiteSubsanacionNota, null);
    const dias = (new Date(c.json.fechaLimiteSubsanacion) - new Date()) / 86400000;
    assert.ok(dias >= 8 && dias <= 12, `esperaba entre 8 y 12 días corridos (8 hábiles), dio ${dias}`);
  });

  test('observado_dnfd -> fase_13 (DNFD subsanado, reingresa)', async () => {
    const { status, json } = await api('admin', 'PATCH', '/api/cases/case-observado-regular-test', { status: 'fase_13' });
    assert.equal(status, 200);
    assert.equal(json.status, 'fase_13');
  });
});

// ═══ cases.override — solo admin (caso aislado: case-override-test) ════════════
describe('cases.override — solo admin', () => {
  test('analista con override:true en un salto inválido sigue bloqueado (override se ignora si no es admin)', async () => {
    const { status } = await api('analista', 'PATCH', '/api/cases/case-override-test', { status: 'fase_09', override: true, reason: 'x' });
    assert.equal(status, 400);
  });
  test('admin con override:true SÍ fuerza el salto inválido', async () => {
    const { status, json } = await api('admin', 'PATCH', '/api/cases/case-override-test', { status: 'fase_09', override: true, reason: 'prueba de permisos' });
    assert.equal(status, 200);
    assert.equal(json.status, 'fase_09');
  });
});

// ═══ cases.edit_faddi / cases.edit_notes — staff + admin, nunca cliente ════════
describe('cases.edit_faddi / cases.edit_notes', () => {
  test('cliente_titular NO puede editar el seguimiento FADDI ni las notas (caso no está en borrador)', async () => {
    const { status } = await api('cliente_titular', 'PATCH', '/api/cases/case-docs-test', { faddi: { expedienteNumber: 'X' }, notes: 'nota de prueba' });
    assert.equal(status, 400); // bloqueado por "no está en borrador" — el campo tampoco está en CLIENT_FIELDS
  });
  test('analista SÍ puede editar FADDI tracking y notas internas', async () => {
    const { status, json } = await api('analista', 'PATCH', '/api/cases/case-docs-test', { faddi: { expedienteNumber: 'EXP-123' }, notes: 'nota del analista' });
    assert.equal(status, 200);
    assert.deepEqual(json.faddi, { expedienteNumber: 'EXP-123' });
    assert.equal(json.notes, 'nota del analista');
  });
});

// ═══ cases.edit_via_categoria — TAREA 26 (§H.9-2): fase_03 la confirma
// Farmazed (vía + categoría + esInnovador juntos), no el cliente ═══════════════
describe('cases.edit_via_categoria', () => {
  test('cliente_titular NO puede confirmar vía/categoría/esInnovador (caso no está en borrador)', async () => {
    const { status } = await api('cliente_titular', 'PATCH', '/api/cases/case-docs-test', {
      tipoRegistro: 'Abreviado', tipoMedicamento: ['Síntesis Química'], esInnovador: true,
    });
    assert.equal(status, 400); // bloqueado por "no está en borrador"
  });
  test('analista SÍ puede confirmar vía, categoría y esInnovador juntos', async () => {
    const { status, json } = await api('analista', 'PATCH', '/api/cases/case-docs-test', {
      tipoRegistro: 'Abreviado', tipoMedicamento: ['Síntesis Química'], esInnovador: true,
    });
    assert.equal(status, 200);
    assert.equal(json.tipoRegistro, 'Abreviado');
    assert.deepEqual(json.tipoMedicamento, ['Síntesis Química']);
    assert.equal(json.esInnovador, true);
  });
  test('el checklist de ese caso refleja esInnovador=true (estudios_clinicos_sq obligatorio)', async () => {
    const { json } = await api('admin', 'GET', '/api/cases/case-docs-test/checklist');
    const doc = json.checklist.find(d => d.id === 'estudios_clinicos_sq');
    assert.ok(doc);
    assert.equal(doc.required, true);
  });

  // TAREA 28 (§H.11): representacion entra en el mismo PATCH/permiso.
  test('analista SÍ puede confirmar representacion, y los formularios del caso lo reflejan', async () => {
    const r1 = await api('analista', 'PATCH', '/api/cases/case-docs-test', { representacion: 'titular_directo' });
    assert.equal(r1.status, 200);
    assert.equal(r1.json.representacion, 'titular_directo');

    const f1 = await api('admin', 'GET', '/api/cases/case-docs-test/formularios');
    assert.ok(f1.json.aplicables.some(f => f.id === 'form-01'), 'form-01 debería aplicar con titular_directo');
    assert.ok(!f1.json.aplicables.some(f => f.id === 'form-02'));
    assert.ok(f1.json.aplicables.some(f => f.id === 'form-03'), 'form-03 aplica siempre');
    assert.ok(f1.json.aplicables.some(f => f.id === 'form-10'), 'form-10 aplica a todo registro nuevo');

    const r2 = await api('analista', 'PATCH', '/api/cases/case-docs-test', { representacion: 'casa_matriz_distribuidor' });
    assert.equal(r2.status, 200);
    const f2 = await api('admin', 'GET', '/api/cases/case-docs-test/formularios');
    assert.ok(f2.json.aplicables.some(f => f.id === 'form-02'), 'form-02 debería aplicar con casa_matriz_distribuidor');
    assert.ok(!f2.json.aplicables.some(f => f.id === 'form-01'));
  });
});

// ═══ cases.delete / documents.delete — TAREA 16(b) ═════════════════════════════
describe('cases.delete / documents.delete', () => {
  test('cliente_titular NO puede eliminar un caso', async () => {
    const { status } = await api('cliente_titular', 'DELETE', '/api/cases/case-delete-test');
    assert.equal(status, 403);
  });
  test('admin SÍ puede eliminar (soft delete) un caso', async () => {
    const { status, json } = await api('admin', 'DELETE', '/api/cases/case-delete-test');
    assert.equal(status, 200);
    assert.equal(json.deleted, true);
  });
  test('analista NO puede borrar un documento (aunque el caso le esté asignado)', async () => {
    const { status } = await api('analista', 'DELETE', '/api/cases/case-docs-test/documents/no-existe');
    assert.equal(status, 403);
  });
});

// ═══ admin.set_role — TAREA 16(a): cierre de la puerta trasera de ADMIN_KEY ════
describe('admin.set_role — solo admin, con auditoría', () => {
  let throwawayUid;

  before(async () => {
    const user = await admin.auth().createUser({ email: `throwaway-set-role-${Date.now()}@test.com`, password: PASSWORD });
    throwawayUid = user.uid;
  });

  test('analista NO puede llamar a set-role', async () => {
    const { status } = await api('analista', 'POST', '/api/admin/set-role', { uid: throwawayUid, admin: true });
    assert.equal(status, 403);
  });

  test('admin SÍ puede dar el rol admin, y queda en adminAuditLog', async () => {
    const { status } = await api('admin', 'POST', '/api/admin/set-role', { uid: throwawayUid, admin: true });
    assert.equal(status, 200);

    const user = await admin.auth().getUser(throwawayUid);
    assert.equal(user.customClaims.role, 'admin');
    assert.equal(user.customClaims.admin, true);

    const logSnap = await admin.firestore().collection('adminAuditLog')
      .where('targetUid', '==', throwawayUid).limit(1).get();
    assert.equal(logSnap.empty, false, 'no quedó registro en adminAuditLog');
    assert.equal(logSnap.docs[0].data().action, 'set_role');
  });

  test('revocar el rol admin no borra el resto de los claims (merge, no reemplazo)', async () => {
    // Se le da un orgId de prueba directo (simulando que ya tenía uno de
    // antes) para confirmar que quitar `admin` no lo pisa.
    const before = await admin.auth().getUser(throwawayUid);
    await admin.auth().setCustomUserClaims(throwawayUid, { ...before.customClaims, orgId: 'org-de-prueba' });

    const { status } = await api('admin', 'POST', '/api/admin/set-role', { uid: throwawayUid, admin: false });
    assert.equal(status, 200);

    const after = await admin.auth().getUser(throwawayUid);
    assert.equal(after.customClaims.admin, undefined);
    assert.equal(after.customClaims.role, undefined);
    assert.equal(after.customClaims.orgId, 'org-de-prueba'); // sobrevivió
  });
});

// ═══ formularios.read (R14, TAREA 17) ══════════════════════════════════════════
describe('formularios.read', () => {
  test('cualquier rol autenticado ve la biblioteca completa (13)', async () => {
    const { status, json } = await api('cliente_titular', 'GET', '/api/formularios');
    assert.equal(status, 200);
    assert.equal(json.total, 13);
  });

  test('GET /api/cases/:id/formularios filtra por tipoRegistro + tipoMedicamento del caso', async () => {
    // case-formularios-test: Abreviado + Suplementos, representacion sin confirmar.
    const { status, json } = await api('cliente_titular', 'GET', '/api/cases/case-formularios-test/formularios');
    assert.equal(status, 200);
    const idsAplicables = json.aplicables.map(f => f.id);
    assert.ok(idsAplicables.includes('form-06'), 'form-06 (Abreviado) debería aplicar');
    assert.ok(idsAplicables.includes('form-07'), 'form-07 (Abreviado) debería aplicar');
    assert.ok(idsAplicables.includes('form-11'), 'form-11 (Suplementos) debería aplicar');
    assert.ok(idsAplicables.includes('form-12'), 'form-12 (Suplementos) debería aplicar');
    assert.ok(!idsAplicables.includes('form-09'), 'form-09 (Reconocimiento Mutuo) NO debería aplicar');
    // TAREA 28 (§H.11): F3 aplica siempre y F10 a todo registro nuevo — ya
    // no son "por_confirmar" (antes sí, antes de que Zelky confirmara su
    // condición real).
    assert.ok(idsAplicables.includes('form-03'), 'form-03 aplica siempre');
    assert.ok(idsAplicables.includes('form-10'), 'form-10 aplica a todo registro nuevo');
    const idsPorConfirmar = json.porConfirmar.map(f => f.id);
    assert.deepEqual(idsPorConfirmar.sort(), ['form-01', 'form-02']); // representacion sin confirmar en este caso
  });

  test('titular_beta NO puede leer los formularios de un caso de otra empresa', async () => {
    const { status } = await api('titular_beta', 'GET', '/api/cases/case-formularios-test/formularios');
    assert.equal(status, 403);
  });
});

// ═══ quotes.* (R5/R12, TAREA 18) — usa case-quote-test-1/2/3 (org Alfa,
// fase_03) de seed_roles.js. Muta esos 3 casos (fase_03 -> fase_04 -> _05),
// por eso va al final, como el resto de los grupos que mutan estado. ═══════════
describe('quotes.* — borrador automático, ajuste, envío, aceptación', () => {
  let quoteId;

  test('quotes.read: staff (analista) 403; cliente y admin sí', async () => {
    assert.equal((await api('analista', 'GET', '/api/quotes')).status, 403);
    assert.equal((await api('cliente_titular', 'GET', '/api/quotes')).status, 200);
    assert.equal((await api('admin', 'GET', '/api/quotes')).status, 200);
  });

  // PM_COMMENTS §H.7: excluir del gate los casos sin orgId abría un hueco de
  // cumplimiento — con alta por invitación todo cliente tiene empresa, así
  // que un caso sin orgId es dato SIN MIGRAR, no un caso legítimamente
  // exento. El gate bloquea SIEMPRE; solo el override lo pasa.
  test('sin orgId (dato sin migrar), el gate bloquea SIEMPRE aunque no haya cotización posible; con override, avanza', async () => {
    const bloqueado = await api('admin', 'PATCH', '/api/cases/case-quote-test-sin-org', { status: 'fase_05' });
    assert.equal(bloqueado.status, 400);
    assert.match(bloqueado.json.error, /empresa asignada/);

    const forzado = await api('admin', 'PATCH', '/api/cases/case-quote-test-sin-org', { status: 'fase_05', override: true, reason: 'dato sin migrar, prueba de gate' });
    assert.equal(forzado.status, 200);
  });

  test('fase_03 -> fase_04 de case-quote-test-1 crea un borrador con su línea', async () => {
    const patch = await api('admin', 'PATCH', '/api/cases/case-quote-test-1', { status: 'fase_04' });
    assert.equal(patch.status, 200);

    const { json } = await api('admin', 'GET', '/api/quotes');
    const quote = json.quotes.find(q => q.orgId === 'org-alfa' && q.estado === 'borrador' && q.caseIds.includes('case-quote-test-1'));
    assert.ok(quote, 'debería existir un borrador de org-alfa con case-quote-test-1');
    quoteId = quote.id;

    const linea = quote.lineas.find(l => l.caseId === 'case-quote-test-1');
    // TAREA 23 (§H.8, Precios): resolverCategoriaPrecio() usa el tarifario
    // _24sep en el emulador (organizacion/10_DIFF_PRECIOS_24SEP.md) — mismo
    // precio (4580), id más fino (separa Suplementos de Homeopático/
    // Radiofármaco, que antes compartían 'med_abreviado_suplemento').
    assert.equal(linea.categoriaPrecio, 'med_abreviado_suplementos_24sep'); // Abreviado + Suplementos
    assert.equal(linea.honorariosFarmazed, 2055);
    assert.equal(linea.tasasOficiales, 2525);
    assert.equal(linea.monto, 4580);
  });

  test('sin cotización aceptada, fase_04 -> fase_05 se bloquea; con override, avanza', async () => {
    const bloqueado = await api('admin', 'PATCH', '/api/cases/case-quote-test-1', { status: 'fase_05' });
    assert.equal(bloqueado.status, 400);

    const forzado = await api('admin', 'PATCH', '/api/cases/case-quote-test-1', { status: 'fase_05', override: true, reason: 'prueba de gate' });
    assert.equal(forzado.status, 200);
  });

  test('fase_03 -> fase_04 de case-quote-test-2 y case-quote-test-3 agrega sus líneas al MISMO borrador (R5: agrupa)', async () => {
    assert.equal((await api('admin', 'PATCH', '/api/cases/case-quote-test-2', { status: 'fase_04' })).status, 200);
    assert.equal((await api('admin', 'PATCH', '/api/cases/case-quote-test-3', { status: 'fase_04' })).status, 200);

    const { json } = await api('admin', 'GET', `/api/quotes/${quoteId}`);
    assert.deepEqual(json.caseIds.sort(), ['case-quote-test-1', 'case-quote-test-2', 'case-quote-test-3']);
    assert.equal(json.lineas.length, 3);
    // TAREA 23: ids _24sep (ver nota arriba). "Síntesis química Regular" SÍ
    // cambió de precio en el xlsx 24-sep: 3930 -> 4130 (organizacion/
    // 10_DIFF_PRECIOS_24SEP.md, sección 1).
    assert.equal(json.lineas.find(l => l.caseId === 'case-quote-test-2').categoriaPrecio, 'med_regular_sintesis_24sep');
    assert.equal(json.lineas.find(l => l.caseId === 'case-quote-test-3').categoriaPrecio, 'med_abreviado_sintesis_24sep');
    assert.equal(json.total, 4580 + 4130 + 4580);
  });

  test('quotes.edit: solo admin; ajustar un monto sin motivo da 400, con motivo da 200', async () => {
    assert.equal((await api('cliente_miembro', 'PATCH', `/api/quotes/${quoteId}/lineas/case-quote-test-1`, { honorariosFarmazed: 1300 })).status, 403);

    const sinMotivo = await api('admin', 'PATCH', `/api/quotes/${quoteId}/lineas/case-quote-test-1`, { honorariosFarmazed: 1300 });
    assert.equal(sinMotivo.status, 400);

    const conMotivo = await api('admin', 'PATCH', `/api/quotes/${quoteId}/lineas/case-quote-test-1`, { honorariosFarmazed: 1300, motivo: 'ajuste comercial acordado con el cliente' });
    assert.equal(conMotivo.status, 200);
    const linea = conMotivo.json.lineas.find(l => l.caseId === 'case-quote-test-1');
    assert.equal(linea.ajustado, true);
    assert.equal(linea.monto, 1300 + 2525);
    assert.equal(conMotivo.json.total, (1300 + 2525) + 4130 + 4580); // TAREA 23: case-quote-test-2 ahora es 4130 (ver arriba)
  });

  test('quotes.send: solo admin; cliente_miembro 403', async () => {
    assert.equal((await api('cliente_miembro', 'POST', `/api/quotes/${quoteId}/send`)).status, 403);
    const enviada = await api('admin', 'POST', `/api/quotes/${quoteId}/send`);
    assert.equal(enviada.status, 200);
    assert.equal(enviada.json.estado, 'enviada');

    // Ya no se puede ajustar una cotización enviada.
    assert.equal((await api('admin', 'PATCH', `/api/quotes/${quoteId}/lineas/case-quote-test-2`, { honorariosFarmazed: 1, motivo: 'x' })).status, 400);
  });

  test('quotes.accept: titular_beta no la ve (403 cruzado); cliente_miembro no puede responder (403); cliente_titular acepta', async () => {
    assert.equal((await api('titular_beta', 'GET', `/api/quotes/${quoteId}`)).status, 403);
    assert.equal((await api('cliente_miembro', 'POST', `/api/quotes/${quoteId}/respond`, { decision: 'aceptada' })).status, 403);

    const aceptada = await api('cliente_titular', 'POST', `/api/quotes/${quoteId}/respond`, { decision: 'aceptada' });
    assert.equal(aceptada.status, 200);
    assert.equal(aceptada.json.estado, 'aceptada');
  });

  test('con la cotización aceptada, case-quote-test-2 y -3 avanzan fase_04 -> fase_05 SIN override, cada uno con su caseCode', async () => {
    const c2 = await api('admin', 'PATCH', '/api/cases/case-quote-test-2', { status: 'fase_05' });
    assert.equal(c2.status, 200);
    const c3 = await api('admin', 'PATCH', '/api/cases/case-quote-test-3', { status: 'fase_05' });
    assert.equal(c3.status, 200);

    const g2 = await api('admin', 'GET', '/api/cases/case-quote-test-2');
    assert.equal(g2.json.status, 'fase_05');
    assert.equal(g2.json.caseCode, 'FZ-MED-REG-2026-0086');
    const g3 = await api('admin', 'GET', '/api/cases/case-quote-test-3');
    assert.equal(g3.json.status, 'fase_05');
    assert.equal(g3.json.caseCode, 'FZ-MED-ABR-2026-0087');
  });
});

// ═══ "Prioridad innovadores" — línea EXTRA de la cotización, TAREA 28
// (§H.11): cargo adicional (no reemplaza la principal) cuando esInnovador y
// la categoría es SQ/Biológicos/Biotecnológicos, en Abreviado ════════════════
describe('Cotización — línea extra de "Prioridad innovadores"', () => {
  test('fase_03 -> fase_04 de un caso Abreviado+SQ+esInnovador=true crea 2 líneas (principal + extra)', async () => {
    const patch = await api('admin', 'PATCH', '/api/cases/case-prioridad-innovadores-test', { status: 'fase_04' });
    assert.equal(patch.status, 200);

    const { json } = await api('admin', 'GET', '/api/quotes');
    const quote = json.quotes.find(q => q.orgId === 'org-beta' && q.estado === 'borrador' && q.caseIds.includes('case-prioridad-innovadores-test'));
    assert.ok(quote, 'debería existir un borrador de org-beta con case-prioridad-innovadores-test');

    const lineasDelCaso = quote.lineas.filter(l => l.caseId === 'case-prioridad-innovadores-test');
    assert.equal(lineasDelCaso.length, 2, 'principal + prioridad_innovadores');

    const principal = lineasDelCaso.find(l => (l.tipo || 'principal') === 'principal');
    const extra      = lineasDelCaso.find(l => l.tipo === 'prioridad_innovadores');
    assert.ok(principal);
    assert.ok(extra);
    assert.equal(principal.categoriaPrecio, 'med_abreviado_sintesis_24sep');
    assert.equal(extra.categoriaPrecio, 'med_abreviado_prioridad_innovadores_24sep');
    assert.equal(extra.honorariosFarmazed, 1855);
    assert.equal(extra.tasasOficiales, 2525);
    assert.equal(extra.ajustado, true); // provisional desde que se crea
    assert.match(extra.motivoAjuste, /provisional/i);
  });

  test('el admin puede ajustar la línea extra por separado (PATCH .../lineas/:caseId con tipo:"prioridad_innovadores")', async () => {
    const { json } = await api('admin', 'GET', '/api/quotes');
    const quote = json.quotes.find(q => q.orgId === 'org-beta' && q.estado === 'borrador' && q.caseIds.includes('case-prioridad-innovadores-test'));

    const ajuste = await api('admin', 'PATCH', `/api/quotes/${quote.id}/lineas/case-prioridad-innovadores-test`, {
      tipo: 'prioridad_innovadores', honorariosFarmazed: 0, tasasOficiales: 0, motivo: 'No corresponde para este caso — se revisó y se descarta',
    });
    assert.equal(ajuste.status, 200);
    const extra = ajuste.json.lineas.find(l => l.caseId === 'case-prioridad-innovadores-test' && l.tipo === 'prioridad_innovadores');
    assert.equal(extra.monto, 0);

    // La línea principal sigue intacta — el PATCH con tipo distinto no la tocó.
    const principal = ajuste.json.lineas.find(l => l.caseId === 'case-prioridad-innovadores-test' && (l.tipo || 'principal') === 'principal');
    assert.equal(principal.categoriaPrecio, 'med_abreviado_sintesis_24sep');
    assert.equal(principal.ajustado, false);
  });

  // Ajuste del PM tras la entrega: "Vacuna = Biológicos" (§H.11) también
  // aplica aquí — Zelky no la excluyó de "Prioridad innovadores", solo no
  // la nombró en la primera ronda.
  test('Vacuna+esInnovador=true también dispara la línea extra (Vacuna = Biológicos, §H.11)', async () => {
    const patch = await api('admin', 'PATCH', '/api/cases/case-prioridad-innovadores-vacuna-test', { status: 'fase_04' });
    assert.equal(patch.status, 200);

    const { json } = await api('admin', 'GET', '/api/quotes');
    const quote = json.quotes.find(q => q.orgId === 'org-beta' && q.estado === 'borrador' && q.caseIds.includes('case-prioridad-innovadores-vacuna-test'));
    assert.ok(quote, 'debería existir un borrador de org-beta con case-prioridad-innovadores-vacuna-test');

    const lineasDelCaso = quote.lineas.filter(l => l.caseId === 'case-prioridad-innovadores-vacuna-test');
    assert.equal(lineasDelCaso.length, 2, 'principal + prioridad_innovadores');

    const principal = lineasDelCaso.find(l => (l.tipo || 'principal') === 'principal');
    const extra      = lineasDelCaso.find(l => l.tipo === 'prioridad_innovadores');
    assert.ok(principal);
    assert.ok(extra);
    assert.equal(principal.categoriaPrecio, 'med_abreviado_biologicos_24sep'); // Vacuna = Biológicos
    assert.equal(extra.categoriaPrecio, 'med_abreviado_prioridad_innovadores_24sep');
    assert.equal(extra.ajustado, true);
  });
});

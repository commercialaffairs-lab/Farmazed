/**
 * orgs.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Colección `orgs`: una empresa cliente. `cases.orgId` (no `clientId`) es lo
 * que decide qué casos ve un cliente — un caso pertenece a la EMPRESA, no a
 * la persona que lo creó (R7: "empresa con varios usuarios").
 *
 * Alta normal de una empresa: POST /api/invitations/titular (admin) crea la
 * empresa Y la invitación juntas — este archivo solo expone lectura/edición
 * directa para el admin (gestión, no alta).
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, effectiveRole } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { TRAMITE_TYPES } = require('../data/faddi_checklists');
const { textoError } = require('../utils/validar_texto');
const { createOrg } = require('../services/orgs');

const router = Router();
const db     = () => admin.firestore();

// ─── GET /api/orgs (staff + admin, TAREA 35) ──────────────────────────────────
router.get('/', requireAuth, requirePermission('orgs.list'), async (req, res) => {
  try {
    const snap = await db().collection('orgs').orderBy('createdAt', 'desc').get();
    const orgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(serializeTimestamps({ total: orgs.length, orgs }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/orgs (admin) ───────────────────────────────────────────────────
// Uso directo (sin invitación) — p.ej. para pruebas o alta manual del admin.
router.post('/', requireAuth, requirePermission('orgs.manage'), async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre is required' });
    const errorNombre = textoError('nombre', nombre, 120);
    if (errorNombre) return res.status(400).json({ error: errorNombre });

    const ref = await createOrg({ nombre, createdBy: req.user.uid });

    res.status(201).json(serializeTimestamps({ id: ref.id, ...(await ref.get()).data() }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/orgs/:orgId/members (admin) ────────────────────────────────────
// El propio titular/miembro usa GET /api/me/org para ver los suyos — esta es
// la vista del admin sobre CUALQUIER empresa (gestión de empresas y
// empleados, TAREA 15).
router.get('/:orgId/members', requireAuth, requirePermission('orgs.manage'), async (req, res) => {
  try {
    const orgSnap = await db().collection('orgs').doc(req.params.orgId).get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });

    const usersResult = await admin.auth().listUsers(1000);
    const members = usersResult.users
      .filter(u => u.customClaims?.orgId === req.params.orgId)
      .map(u => ({ uid: u.uid, email: u.email, displayName: u.displayName || u.email, role: u.customClaims?.role }));

    res.json(serializeTimestamps({ id: orgSnap.id, ...orgSnap.data(), members }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Captación de información preliminar (TAREA 32, §H.13, Fase 2 Zelky) ──────
// Los 6 campos que el PM pidió, literal: país y nombre del laboratorio
// fabricante (un solo campo de texto — así vino la pregunta de Zelky),
// categoría(s) de producto, número de productos por categoría, ¿registro
// previo ante autoridad reconocida?, ¿cliente nuevo o ya tiene productos
// registrados en Panamá?, ¿algún producto con modificación en curso?
//
// "Se pide una sola vez" es una decisión de UI (el front solo MUESTRA la
// pantalla bloqueante si `org.captacion` no existe todavía), no una
// inmutabilidad del dato en el backend — el mismo PATCH sirve para la
// primera vez y para "editar después desde Mi Empresa" (instrucción
// explícita del PM: sí se puede editar más adelante).
const CAPTACION_CAMPOS = [
  'paisYNombreFabricante', 'categoriasProducto', 'numeroProductosPorCategoria', 'productosPorCategoria',
  'registroPrevioAutoridadReconocida', 'clienteNuevoOYaRegistrado', 'productoConModificacionEnCurso',
];

function validarCaptacion(body) {
  const { paisYNombreFabricante, categoriasProducto, numeroProductosPorCategoria,
          registroPrevioAutoridadReconocida, clienteNuevoOYaRegistrado, productoConModificacionEnCurso } = body;
  const errorTexto = textoError('País y nombre del laboratorio fabricante', paisYNombreFabricante, 200)
    || textoError('Número de productos por categoría', numeroProductosPorCategoria, 120);
  if (errorTexto) return errorTexto;
  if (!Array.isArray(categoriasProducto) || categoriasProducto.length === 0) {
    return 'Selecciona al menos una categoría de producto.';
  }
  if (categoriasProducto.some(c => !TRAMITE_TYPES.includes(c))) {
    return `categoriasProducto debe ser un subconjunto de: ${TRAMITE_TYPES.join(', ')}`;
  }
  // Contadores del portal (07-oct): {categoria: entero 1..999}, solo categorías marcadas. Opcional:
  // `numeroProductosPorCategoria` (texto) sigue siendo el campo de siempre y el que muestra la bandeja.
  const { productosPorCategoria } = body;
  if (productosPorCategoria !== undefined) {
    if (!productosPorCategoria || typeof productosPorCategoria !== 'object' || Array.isArray(productosPorCategoria)) {
      return 'productosPorCategoria debe ser un objeto {categoria: cantidad}.';
    }
    for (const [cat, n] of Object.entries(productosPorCategoria)) {
      if (!categoriasProducto.includes(cat)) return `productosPorCategoria: "${cat}" no está entre las categorías marcadas.`;
      if (!Number.isInteger(n) || n < 1 || n > 999) return `productosPorCategoria: la cantidad de "${cat}" debe ser un entero entre 1 y 999.`;
    }
  }
  if (typeof registroPrevioAutoridadReconocida !== 'boolean') {
    return 'registroPrevioAutoridadReconocida debe ser true/false.';
  }
  if (!['nuevo', 'ya_registrado'].includes(clienteNuevoOYaRegistrado)) {
    return `clienteNuevoOYaRegistrado debe ser 'nuevo' o 'ya_registrado'.`;
  }
  if (typeof productoConModificacionEnCurso !== 'boolean') {
    return 'productoConModificacionEnCurso debe ser true/false.';
  }
  return null;
}

// ─── PATCH /api/orgs/mine/captacion (cliente_titular, admin) ──────────────────
// Sin :orgId en la URL — el titular nunca manda el id de su propia empresa,
// sale del claim (req.user.orgId), igual que invitations.js POST /miembro.
// El admin SÍ puede mandar orgId en el body (gestión manual desde
// admin/empresas.html) — es el único rol al que esto tiene sentido pedirle.
router.patch('/mine/captacion', requireAuth, requirePermission('orgs.edit_captacion'), async (req, res) => {
  try {
    const role = effectiveRole(req.user);
    let orgId;
    if (role === 'admin') {
      orgId = req.body.orgId || req.user.orgId;
      if (!orgId) return res.status(400).json({ error: 'orgId is required (admin)' });
    } else {
      orgId = req.user.orgId;
      if (!orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });
    }

    const errorValidacion = validarCaptacion(req.body);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const orgRef  = db().collection('orgs').doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });

    const now = admin.firestore.Timestamp.now();
    const yaExistia = !!orgSnap.data().captacion;
    const captacion = {};
    for (const campo of CAPTACION_CAMPOS) {
      const v = req.body[campo];
      // Un campo opcional ausente (p. ej. productosPorCategoria desde clientes viejos) se guarda
      // como null: Firestore rechaza `undefined`.
      captacion[campo] = typeof v === 'string' ? v.trim() : (v === undefined ? null : v);
    }
    captacion.revisadoPorFarmazed = yaExistia ? (orgSnap.data().captacion.revisadoPorFarmazed ?? false) : false;
    captacion.completadaPor = req.user.uid;
    captacion.completadaEn  = yaExistia ? orgSnap.data().captacion.completadaEn : now;
    captacion.actualizadaEn = now;

    await orgRef.update({ captacion });
    res.json(serializeTimestamps({ id: orgId, captacion }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/orgs/leads (staff, admin) ───────────────────────────────────────
// "Cliente nuevo — revisar captación" en la bandeja: empresas con la
// captación ya completada pero que Farmazed todavía no marcó como revisada.
router.get('/leads', requireAuth, requirePermission('orgs.read_leads'), async (req, res) => {
  try {
    const snap = await db().collection('orgs').where('captacion.revisadoPorFarmazed', '==', false).get();
    const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(serializeTimestamps({ total: leads.length, leads }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/orgs/:orgId/leads/revisar (staff, admin) ───────────────────────
router.post('/:orgId/leads/revisar', requireAuth, requirePermission('orgs.read_leads'), async (req, res) => {
  try {
    const orgRef  = db().collection('orgs').doc(req.params.orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    if (!orgSnap.data().captacion) return res.status(400).json({ error: 'Esta empresa todavía no tiene captación completada.' });

    await orgRef.update({
      'captacion.revisadoPorFarmazed': true,
      'captacion.revisadoPor':         req.user.uid,
      'captacion.revisadoEn':          admin.firestore.Timestamp.now(),
    });
    res.json({ revisado: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/orgs/mine/plan (cliente_titular) — TAREA 34, §H.15 ────────────
// El titular elige/sube de plan — "puede pedir subir de plan" (instrucción
// literal). Sin restricción de qué transición vale (no se especificó
// ninguna) — el CTA "Contratar el registro" (Plan Consulta -> Registro) y
// "aceptar la propuesta" (Empresarial) usan este mismo endpoint.
const PLANES = ['consulta', 'registro', 'empresarial'];
router.patch('/mine/plan', requireAuth, requirePermission('orgs.set_plan'), async (req, res) => {
  try {
    if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });
    const { plan } = req.body;
    if (!PLANES.includes(plan)) {
      return res.status(400).json({ error: `plan inválido: "${plan}". Válidos: ${PLANES.join(', ')}`, validos: PLANES });
    }
    await db().collection('orgs').doc(req.user.orgId).update({ plan });
    res.json({ plan });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Diagnóstico regulatorio (Plan Consulta) — TAREA 34, §H.15 ────────────────
// "El staff hace el diagnóstico regulatorio: clasificación del producto,
// ruta recomendada, requisitos aplicables, estimado de tiempos y costos
// oficiales. Se entrega en el portal como 'Diagnóstico'." Vive en la EMPRESA
// (no en un caso — "sin dossier ni trámite", Plan Consulta no crea casos).
const DIAGNOSTICO_CAMPOS = ['clasificacion', 'rutaRecomendada', 'requisitosAplicables', 'estimadoTiempos', 'estimadoCostos'];

function validarDiagnostico(body) {
  for (const campo of DIAGNOSTICO_CAMPOS) {
    const error = textoError(campo, body[campo], 500);
    if (error) return error;
  }
  return null;
}

// ─── PUT /api/orgs/:orgId/diagnostico (staff, admin) ──────────────────────────
router.put('/:orgId/diagnostico', requireAuth, requirePermission('orgs.edit_diagnostico'), async (req, res) => {
  try {
    const errorValidacion = validarDiagnostico(req.body || {});
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const orgRef  = db().collection('orgs').doc(req.params.orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });

    const now = admin.firestore.Timestamp.now();
    const diagnostico = {};
    for (const campo of DIAGNOSTICO_CAMPOS) diagnostico[campo] = req.body[campo].trim();
    diagnostico.creadoPor = req.user.uid;
    diagnostico.creadoEn  = orgSnap.data().diagnostico?.creadoEn || now;
    diagnostico.actualizadoEn = now;

    await orgRef.update({ diagnostico });
    res.json(serializeTimestamps({ id: req.params.orgId, diagnostico }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

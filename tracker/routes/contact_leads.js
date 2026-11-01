/**
 * contact_leads.js — TAREA 34 (PM_COMMENTS §H.15) + CRM básico de leads (decisión de Rick,
 * 31-oct-2026). Primer contacto SIN cuenta: el formulario "Solicitar cuenta"
 * (solicitar-cuenta.html) y el de contacto (contacto.html) crean un lead; el staff lo trabaja
 * en admin/leads.html (estado, notas, datos) y el admin lo convierte en invitación de titular
 * (reusa invitations.js). Distinto de orgs.read_leads/captación (orgs.js), que son empresas
 * que YA tienen cuenta.
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/contact-leads', contactLeadsRouter);
 */

const { Router } = require('express');
const admin       = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const invitationsRouter = require('./invitations');
const { textoError, trimOrNull } = require('../utils/validar_texto');
const { crearLimitador } = require('../utils/rate_limit');
const { createOrg } = require('../services/orgs');
const { visibleParaDemo } = require('../services/demo'); // el personal demo solo ve leads demo:true

const router = Router();
const db     = () => admin.firestore();

// Rate limit por IP: utils/rate_limit.js (TAREA 39), el mismo que register.js.
const limitador = crearLimitador({ ventanaMs: 10 * 60 * 1000, max: 5 });

// Catálogos del formulario "Solicitar cuenta" y del CRM (admin/leads.html muestra los mismos).
const TIPOS_SOLICITANTE = ['empresa', 'regente', 'abogado'];
const INTERESES   = ['medicamentos', 'cosmeticos', 'higienicos', 'plaguicidas', 'excepcion', 'publicidad'];
const INTENCIONES = ['informacion', 'cuenta'];
const FUENTES     = ['youtube', 'instagram', 'facebook', 'referido', 'google', 'linkedin', 'x', 'otro'];
const PLANES      = ['consulta', 'registro', 'empresarial'];
const ESTADOS     = ['nuevo', 'contactado', 'calificado', 'invitado', 'descartado'];

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function websiteValido(url) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') ? u.href : null;
  } catch { return null; }
}

/**
 * Valida y normaliza los campos del lead (POST público y PATCH del CRM comparten reglas).
 * `parcial:true` (PATCH) acepta solo los campos presentes. Devuelve { datos } o { error }.
 */
function normalizarLead(body, { parcial = false } = {}) {
  const b = body || {};
  const datos = {};
  const texto = (campo, etiqueta, max, requerido) => {
    if (parcial && b[campo] === undefined) return null;
    const err = textoError(etiqueta, b[campo], max, requerido);
    if (err) return err;
    datos[campo] = requerido ? b[campo].trim() : trimOrNull(b[campo]);
    return null;
  };
  const error = texto('nombre', 'El nombre', 120, !parcial)
    || texto('empresa', 'La empresa', 120, false)
    || texto('tipoProducto', 'El tipo de producto', 120, false)
    || texto('mensaje', 'El mensaje', 1000, false)
    || texto('telefono', 'El teléfono', 40, false)
    || texto('pais', 'El país', 80, false)
    || (parcial ? texto('notas', 'Las notas', 2000, false) : null);
  if (error) return { error };

  if (!parcial || b.correo !== undefined) {
    const errCorreo = textoError('El correo', b.correo, 254);
    if (errCorreo) return { error: errCorreo };
    if (!CORREO_VALIDO.test(b.correo.trim())) return { error: 'Correo inválido.' };
    datos.correo = b.correo.trim();
  }
  if (b.tipoSolicitante != null) {
    if (!TIPOS_SOLICITANTE.includes(b.tipoSolicitante)) return { error: 'Tipo de solicitante inválido.' };
    datos.tipoSolicitante = b.tipoSolicitante;
  } else if (!parcial) datos.tipoSolicitante = null;
  if (b.website !== undefined) {
    const w = trimOrNull(b.website);
    if (w && (w.length > 200 || !websiteValido(w))) return { error: 'El sitio web no es una dirección válida.' };
    datos.website = w ? websiteValido(w) : null;
  }
  if (b.cantidadProductos !== undefined && b.cantidadProductos !== null && b.cantidadProductos !== '') {
    const n = Number(b.cantidadProductos);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'La cantidad de productos debe ser un número entero.' };
    datos.cantidadProductos = n;
  } else if (!parcial) datos.cantidadProductos = null;
  if (b.interes !== undefined) {
    const lista = b.interes == null ? [] : (Array.isArray(b.interes) ? b.interes : [b.interes]);
    if (lista.some(i => !INTERESES.includes(i))) return { error: 'Tipo de producto de interés inválido.' };
    datos.interes = lista;
  } else if (!parcial) datos.interes = [];
  const catalogo = (campo, lista, etiqueta) => {
    if (b[campo] === undefined) { if (!parcial) datos[campo] = null; return null; }
    if (b[campo] != null && !lista.includes(b[campo])) return `${etiqueta} inválido.`;
    datos[campo] = b[campo] || null;
    return null;
  };
  const errCat = catalogo('intencion', INTENCIONES, 'Motivo de la solicitud')
    || catalogo('fuente', FUENTES, 'Fuente')
    || catalogo('plan', PLANES, 'Plan');
  if (errCat) return { error: errCat };
  return { datos };
}

// ─── POST /api/contact-leads (público) ────────────────────────────────────────
router.post('/', async (req, res) => {
  if (limitador.estaLimitado(req.ip)) {
    return res.status(429).json({ error: 'Demasiados mensajes desde esta dirección. Intenta de nuevo más tarde.' });
  }
  const { datos, error } = normalizarLead(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const now = admin.firestore.Timestamp.now();
    const leadData = { ...datos, estado: 'nuevo', notas: null, invitado: false, createdAt: now, actualizadoEn: now, actualizadoPor: null };
    const ref = await db().collection('contactLeads').add(leadData);
    res.status(201).json(serializeTimestamps({ id: ref.id, ...leadData }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/contact-leads (staff, admin) ────────────────────────────────────
// Por defecto solo los pendientes de invitar (bandeja); `?todos=1` devuelve el histórico
// completo para el CRM (admin/leads.html). Los leads viejos sin `estado` se muestran como 'nuevo'.
router.get('/', requireAuth, requirePermission('contact_leads.read'), async (req, res) => {
  try {
    let query = db().collection('contactLeads').orderBy('createdAt', 'desc');
    if (req.query.todos !== '1') query = query.where('invitado', '==', false);
    const snap = await query.get();
    const leads = snap.docs.map(d => ({ id: d.id, estado: d.data().invitado ? 'invitado' : 'nuevo', ...d.data() })).filter(l => visibleParaDemo(req.user, l));
    const catalogos = { tipos: TIPOS_SOLICITANTE, intereses: INTERESES, intenciones: INTENCIONES, fuentes: FUENTES, estados: ESTADOS };
    res.json(serializeTimestamps({ total: leads.length, leads, catalogos }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PATCH /api/contact-leads/:id (staff, admin) — CRM: estado, notas y datos ──
router.patch('/:id', requireAuth, requirePermission('contact_leads.edit'), async (req, res) => {
  try {
    const ref  = db().collection('contactLeads').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = snap.data();
    if (!visibleParaDemo(req.user, lead)) return res.status(403).json({ error: 'Forbidden' });

    const { datos, error } = normalizarLead(req.body, { parcial: true });
    if (error) return res.status(400).json({ error });
    if (req.body?.estado !== undefined) {
      if (!ESTADOS.includes(req.body.estado)) return res.status(400).json({ error: 'Estado inválido.' });
      // 'invitado' lo pone solo POST /:id/invitar (crea empresa + invitación); y un lead invitado no se reabre.
      if (lead.invitado) return res.status(409).json({ error: 'Este lead ya fue invitado; su estado no se cambia a mano.' });
      if (req.body.estado === 'invitado') return res.status(409).json({ error: 'Para pasar a "invitado" usa "Invitar a crear cuenta".' });
      datos.estado = req.body.estado;
    }
    if (!Object.keys(datos).length) return res.status(400).json({ error: 'Nada que actualizar.' });

    const cambios = { ...datos, actualizadoEn: admin.firestore.Timestamp.now(), actualizadoPor: req.user.uid };
    await ref.update(cambios);
    res.json(serializeTimestamps({ id: ref.id, ...lead, ...cambios }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/contact-leads/:id/invitar (admin) ──────────────────────────────
// Body: { orgName } — crea la empresa + invitación de titular (misma función que
// invitations.js POST /titular) con el correo del lead, manda el correo de invitación y
// marca el lead invitado (desaparece de la bandeja; en el CRM queda con estado 'invitado').
router.post('/:id/invitar', requireAuth, requirePermission('invitations.create_org'), async (req, res) => {
  try {
    const { orgName } = req.body;
    const errorOrg = textoError('orgName', orgName, 120);
    if (errorOrg) return res.status(400).json({ error: errorOrg });

    const ref  = db().collection('contactLeads').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Lead no encontrado' });
    const lead = snap.data();
    if (lead.invitado) return res.status(409).json({ error: 'Este lead ya fue invitado.' });

    const categorias = Array.isArray(lead.interes) ? lead.interes : [];
    const orgRef = await createOrg({
      nombre: orgName, plan: PLANES.includes(lead.plan) ? lead.plan : 'consulta',
      pais: lead.pais || null, telefonoContacto: lead.telefono || null, website: lead.website || null,
      createdBy: req.user.uid, leadId: ref.id,
      prefillCaptacion: {
        paisYNombreFabricante: [lead.pais, lead.empresa].filter(Boolean).join(' — ') || null,
        categoriasProducto: categorias,
        // Solo con una categoría se sabe a cuál va el total; con varias el cliente reparte.
        productosPorCategoria: categorias.length === 1 && Number.isInteger(lead.cantidadProductos) && lead.cantidadProductos > 0
          ? { [categorias[0]]: Math.min(lead.cantidadProductos, 999) } : {},
      },
    });
    const invite = await invitationsRouter.createInvitation({
      email: lead.correo, role: 'cliente_titular', orgId: orgRef.id, invitedBy: req.user.uid,
    });
    const correoEnviado = await invitationsRouter.enviarCorreoInvitacion(invite, orgName);

    const now = admin.firestore.Timestamp.now();
    await ref.update({
      invitado: true, estado: 'invitado', invitadoEn: now, invitadoPor: req.user.uid, orgIdCreado: orgRef.id,
      actualizadoEn: now, actualizadoPor: req.user.uid,
    });
    res.status(201).json(serializeTimestamps({ ...invite, orgId: orgRef.id, correoEnviado }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

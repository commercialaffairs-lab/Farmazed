/**
 * contact_leads.js — TAREA 34 (PM_COMMENTS §H.15). Formulario "Enviar
 * consulta" del hero (`index.html`, `contact-form2`) — Fase 1 de Zelky
 * ("primer contacto"), pero SIN CUENTA todavía (a diferencia de
 * orgs.read_leads/captación en orgs.js, TAREA 32, que son empresas que ya
 * se registraron). Visible para staff/admin en la bandeja, con la opción
 * de invitar al contacto a crear su cuenta (reusa invitations.js).
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

const router = Router();
const db     = () => admin.firestore();

// Rate limit por IP: utils/rate_limit.js (TAREA 39), el mismo que register.js.
const limitador = crearLimitador({ ventanaMs: 10 * 60 * 1000, max: 5 });

// ─── POST /api/contact-leads (público) ────────────────────────────────────────
router.post('/', async (req, res) => {
  if (limitador.estaLimitado(req.ip)) {
    return res.status(429).json({ error: 'Demasiados mensajes desde esta dirección. Intenta de nuevo más tarde.' });
  }

  const { nombre, empresa, correo, tipoProducto, mensaje } = req.body || {};
  const errorTexto = textoError('El nombre', nombre, 120)
    || textoError('La empresa', empresa, 120, false)
    || textoError('El tipo de producto', tipoProducto, 120, false)
    || textoError('El mensaje', mensaje, 1000, false) // contacto.html: texto libre, opcional
    || textoError('El correo', correo, 254);
  if (errorTexto) return res.status(400).json({ error: errorTexto });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return res.status(400).json({ error: 'Correo inválido.' });

  try {
    const now = admin.firestore.Timestamp.now();
    const leadData = {
      nombre: nombre.trim(), empresa: trimOrNull(empresa), correo: correo.trim(), tipoProducto: trimOrNull(tipoProducto), mensaje: trimOrNull(mensaje),
      invitado: false, createdAt: now,
    };
    const ref = await db().collection('contactLeads').add(leadData);
    res.status(201).json(serializeTimestamps({ id: ref.id, ...leadData }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/contact-leads (staff, admin) ────────────────────────────────────
router.get('/', requireAuth, requirePermission('contact_leads.read'), async (req, res) => {
  try {
    const snap = await db().collection('contactLeads').where('invitado', '==', false).orderBy('createdAt', 'desc').get();
    const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(serializeTimestamps({ total: leads.length, leads }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/contact-leads/:id/invitar (admin) ──────────────────────────────
// Body: { orgName } — crea la empresa + invitación de titular (misma
// función que invitations.js POST /titular) con el correo del lead, y lo
// marca invitado para que desaparezca de la bandeja.
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

    const orgRef = await createOrg({ nombre: orgName, plan: 'consulta', createdBy: req.user.uid });
    const invite = await invitationsRouter.createInvitation({
      email: lead.correo, role: 'cliente_titular', orgId: orgRef.id, invitedBy: req.user.uid,
    });

    await ref.update({ invitado: true, invitadoEn: admin.firestore.Timestamp.now(), invitadoPor: req.user.uid, orgIdCreado: orgRef.id });
    res.status(201).json(serializeTimestamps({ ...invite, orgId: orgRef.id }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

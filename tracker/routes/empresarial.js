/**
 * empresarial.js — TAREA 34 (PM_COMMENTS §H.15). Plan Empresarial ("a
 * convenir"): el titular envía una solicitud de propuesta (productos
 * estimados + necesidades), el admin define condiciones (monto/período —
 * reusa el MECANISMO de suscripción de TAREA 33, PayPal Subscriptions API,
 * pero con un plan PROPIO de esta empresa, no el plan global de
 * `subscription.js` — es "a convenir" por empresa, no un precio único) y
 * asigna un gestor de cuenta (analista); el titular acepta y se suscribe.
 *
 * Estado vive en `orgs/{orgId}.propuestaEmpresarial` — visible ya en
 * `GET /api/me/org` (spread completo). La suscripción resultante usa el
 * MISMO campo `orgs/{orgId}.suscripcion` que `subscription.js` (es la misma
 * cosa de cara al resto del sistema: una empresa suscrita, no importa si
 * fue al plan global o a uno empresarial a medida).
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/empresarial', empresarialRouter);
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { textoError } = require('../utils/validar_texto');
const { getProvider } = require('../services/payments');
const { HttpError, responderError } = require('../utils/http_error');
const { reservarSuscripcion, liberarSuscripcion, guardarSuscripcion, claveSuscripcion } = require('./subscription');

const router = Router();
const db     = () => admin.firestore();

// ─── POST /api/empresarial/solicitar (cliente_titular) ───────────────────────
router.post('/solicitar', requireAuth, requirePermission('empresarial.solicitar'), async (req, res) => {
  try {
    if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });

    const { productosEstimados, necesidades } = req.body;
    const errorProductos = textoError('productosEstimados', productosEstimados, 1000);
    if (errorProductos) return res.status(400).json({ error: errorProductos });
    const nec = necesidades || {};

    const orgRef  = db().collection('orgs').doc(req.user.orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    if (orgSnap.data().propuestaEmpresarial) {
      return res.status(409).json({ error: 'Ya hay una solicitud de propuesta para esta empresa.' });
    }

    const now = admin.firestore.Timestamp.now();
    const propuestaEmpresarial = {
      estado: 'solicitada',
      productosEstimados: productosEstimados.trim(),
      necesidades: {
        modificaciones: !!nec.modificaciones,
        etiquetado:     !!nec.etiquetado,
        informes:       !!nec.informes,
      },
      solicitadaPor: req.user.uid, solicitadaEn: now,
    };
    await orgRef.update({ propuestaEmpresarial });
    res.status(201).json(serializeTimestamps(propuestaEmpresarial));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/empresarial/:orgId/condiciones (admin) ──────────────────────────
router.put('/:orgId/condiciones', requireAuth, requirePermission('empresarial.manage'), async (req, res) => {
  try {
    const { monto, periodo, gestorCuenta } = req.body;
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) return res.status(400).json({ error: 'monto debe ser un número > 0' });
    if (!['mensual', 'anual'].includes(periodo)) {
      return res.status(400).json({ error: `periodo inválido: "${periodo}". Válidos: mensual, anual` });
    }
    if (!gestorCuenta) return res.status(400).json({ error: 'gestorCuenta (uid del analista) es obligatorio.' });

    const gestorRecord = await admin.auth().getUser(gestorCuenta).catch(() => null);
    if (!gestorRecord || gestorRecord.customClaims?.role !== 'analista') {
      return res.status(400).json({ error: 'gestorCuenta debe ser el uid de una cuenta con rol analista.' });
    }

    const orgRef  = db().collection('orgs').doc(req.params.orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    const propuesta = orgSnap.data().propuestaEmpresarial;
    if (!propuesta || propuesta.estado !== 'solicitada') {
      return res.status(400).json({ error: `Esta empresa no tiene una solicitud 'solicitada' pendiente (estado actual: ${propuesta?.estado || 'sin solicitud'}).` });
    }

    const provider = getProvider();
    const { planId } = await provider.createPlan({
      nombre: `Plan Empresarial — ${orgSnap.data().nombre}`, monto: montoNum, periodo,
    });

    const now = admin.firestore.Timestamp.now();
    const propuestaActualizada = {
      ...propuesta,
      estado: 'condiciones_definidas',
      monto: montoNum, periodo, planId, proveedor: provider.name,
      gestorCuenta, gestorCuentaEmail: gestorRecord.email,
      condicionesDefinidasPor: req.user.uid, condicionesDefinidasEn: now,
    };
    await orgRef.update({ propuestaEmpresarial: propuestaActualizada });
    res.json(serializeTimestamps(propuestaActualizada));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/empresarial/aceptar (cliente_titular) ──────────────────────────
// Mismo mecanismo que subscription.js POST /subscribe, pero con el plan
// PROPIO de esta empresa (propuestaEmpresarial.planId), no el global.
router.post('/aceptar', requireAuth, requirePermission('empresarial.solicitar'), async (req, res) => {
  try {
    if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });

    const orgRef = db().collection('orgs').doc(req.user.orgId);
    let propuesta;
    const previa = await reservarSuscripcion(orgRef, (org) => {
      propuesta = org.propuestaEmpresarial;
      if (!propuesta || propuesta.estado !== 'condiciones_definidas') {
        throw new HttpError(400, { error: `Todavía no hay condiciones definidas para aceptar (estado actual: ${propuesta?.estado || 'sin solicitud'}).` });
      }
    });

    let provider, subscriptionId, status, approveUrl;
    try {
      provider = getProvider();
      ({ subscriptionId, status, approveUrl } = await provider.createSubscription({
        planId: propuesta.planId, referenceId: req.user.orgId,
        requestId: claveSuscripcion(req.user.orgId, propuesta.planId), // un reintento inmediato no crea otra suscripción
      }));
    } catch (e) {
      await liberarSuscripcion(orgRef, previa);
      throw e;
    }

    const now = admin.firestore.Timestamp.now();
    const suscripcion = {
      estado: status === 'ACTIVE' ? 'activa' : 'pendiente',
      proveedor: provider.name,
      subscriptionId, planId: propuesta.planId,
      creadaEn: now, actualizadaEn: now,
    };
    await guardarSuscripcion(orgRef, provider, subscriptionId, previa, {
      suscripcion,
      'propuestaEmpresarial.estado': 'aceptada',
      'propuestaEmpresarial.aceptadaEn': now,
    });

    res.status(201).json(serializeTimestamps({ ...suscripcion, approveUrl }));
  } catch (e) {
    responderError(res, e);
  }
});

module.exports = router;

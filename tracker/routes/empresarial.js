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
 * fue al plan global o a uno empresarial a medida). Una empresa tiene UNA
 * sola: aceptar teniendo activo el plan global es un cambio de plan (ver
 * services/suscripciones.js).
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/empresarial', empresarialRouter);
 */

const { Router } = require('express');
const admin       = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { textoError } = require('../utils/validar_texto');
const { getProvider } = require('../services/payments');
const { suscribirEmpresa } = require('../services/suscripciones');
const { HttpError, responderError } = require('../utils/http_error');

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
    // También se redefinen las condiciones de una propuesta 'aceptada' cuyo plan terminó (sin gestor):
    // la empresa conserva su historial, pero el plan nuevo se acuerda de nuevo.
    const planTerminado = propuesta?.estado === 'aceptada' && !propuesta.gestorCuenta;
    if (!propuesta || (propuesta.estado !== 'solicitada' && !planTerminado)) {
      return res.status(400).json({ error: `Esta empresa no tiene una solicitud 'solicitada' pendiente (estado actual: ${propuesta?.estado || 'sin solicitud'}).` });
    }

    const provider = getProvider();
    const { planId } = await provider.createPlan({
      nombre: `Plan Empresarial — ${orgSnap.data().nombre}`, monto: montoNum, periodo,
    });

    const now = admin.firestore.Timestamp.now();
    const { gestorHasta, ...propuestaBase } = propuesta; // el plan nuevo empieza sin fecha de fin
    const propuestaActualizada = {
      ...propuestaBase,
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
    // 'aceptada' también vale: la empresa aceptó antes y ya no tiene el Plan Empresarial activo
    // (no terminó de aprobarlo en PayPal, lo canceló o se pasó al plan global) — las condiciones
    // acordadas siguen siendo las mismas. Con el Empresarial activo, suscribirEmpresa responde 409.
    const suscripcion = await suscribirEmpresa(orgRef, 'empresarial', (org) => {
      const propuesta = org.propuestaEmpresarial;
      if (!propuesta || !['condiciones_definidas', 'aceptada'].includes(propuesta.estado)) {
        throw new HttpError(400, { error: `Todavía no hay condiciones definidas para aceptar (estado actual: ${propuesta?.estado || 'sin solicitud'}).` });
      }
      if (propuesta.estado === 'aceptada' && !propuesta.gestorCuenta) {
        throw new HttpError(400, { error: 'El Plan Empresarial anterior terminó: Farmazed debe definir las condiciones de nuevo antes de aceptar.' });
      }
      return propuesta.planId;
    }, (ahora) => ({
      'propuestaEmpresarial.estado': 'aceptada',
      'propuestaEmpresarial.aceptadaEn': ahora,
    }));

    res.status(201).json(serializeTimestamps(suscripcion));
  } catch (e) {
    responderError(res, e);
  }
});

module.exports = router;

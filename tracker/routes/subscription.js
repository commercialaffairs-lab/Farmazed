/**
 * subscription.js — TAREA 33 (PM_COMMENTS §H.14). Plan recurrente de "costo
 * por uso de la plataforma" (Zelky, Fase 5) — SEPARADO del pago de cada
 * cotización (ver quotes.js, `/:id/pago/*`). Decisiones de Rick: el admin
 * define/edita UN plan (nombre, monto, período mensual|anual) — los montos
 * quedan por definir por Rick/Zelky, nada hardcodeado aquí. El titular
 * suscribe a SU empresa; el estado (activa/pendiente/cancelada) vive en
 * `orgs/{orgId}.suscripcion` — YA visible en `GET /api/me/org` (spread del
 * doc completo, TAREA 15), no hace falta un endpoint de lectura aparte.
 *
 * Una empresa tiene UNA sola suscripción: este plan global o su Plan
 * Empresarial (empresarial.js). Suscribirse aquí teniendo el Empresarial
 * activo es un cambio de plan (ver services/suscripciones.js).
 *
 * NO bloquea trámites (instrucción explícita) — ningún gate de
 * transitions.js la consulta.
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/subscription', subscriptionRouter);
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { getProvider } = require('../services/payments');
const { suscribirEmpresa, tipoDeSuscripcion, camposFinPlanEmpresarial } = require('../services/suscripciones');
const { responderError } = require('../utils/http_error');

const router = Router();
const db     = () => admin.firestore();
const PLAN_DOC = 'plan_suscripcion';

const PERIODOS = ['mensual', 'anual'];

// ─── GET /api/subscription/plan (público — un precio no es un secreto) ───────
router.get('/plan', async (req, res) => {
  try {
    const snap = await db().collection('meta').doc(PLAN_DOC).get();
    if (!snap.exists) return res.json({ plan: null });
    res.json(serializeTimestamps({ plan: snap.data() }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/subscription/plan (admin) ───────────────────────────────────────
router.put('/plan', requireAuth, requirePermission('subscription.manage_plan'), async (req, res) => {
  try {
    const { nombre, monto, periodo } = req.body;
    if (!nombre || !String(nombre).trim()) return res.status(400).json({ error: 'nombre es obligatorio' });
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) return res.status(400).json({ error: 'monto debe ser un número > 0' });
    if (!PERIODOS.includes(periodo)) {
      return res.status(400).json({ error: `periodo inválido: "${periodo}". Válidos: ${PERIODOS.join(', ')}`, validos: PERIODOS });
    }

    // Crea/actualiza el plan también en el proveedor (PayPal real o mock) —
    // sin esto no habría `planId` al que suscribir a nadie. Un plan nuevo
    // en PayPal cada vez que se edita (PayPal no permite cambiar el monto
    // de un plan existente con suscriptores activos sin un flujo de
    // "revisión de precio" aparte — fuera de alcance; esto es "el admin
    // define/edita EL plan" al nivel que pidió esta tarea, no migración de
    // suscriptores entre precios).
    const provider = getProvider();
    const { planId } = await provider.createPlan({ nombre, monto: montoNum, periodo });

    const now = admin.firestore.Timestamp.now();
    const planData = {
      nombre, monto: montoNum, periodo, planId,
      proveedor: provider.name,
      actualizadoEn: now, actualizadoPor: req.user.uid,
    };
    await db().collection('meta').doc(PLAN_DOC).set(planData, { merge: true });
    res.json(serializeTimestamps(planData));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/subscription/subscribe (cliente_titular) ──────────────────────
router.post('/subscribe', requireAuth, requirePermission('subscription.subscribe'), async (req, res) => {
  try {
    if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });

    const planSnap = await db().collection('meta').doc(PLAN_DOC).get();
    if (!planSnap.exists) return res.status(400).json({ error: 'Todavía no hay un plan de suscripción configurado.' });
    const plan = planSnap.data();

    const orgRef = db().collection('orgs').doc(req.user.orgId);
    const suscripcion = await suscribirEmpresa(orgRef, 'global', () => plan.planId);
    res.status(201).json(serializeTimestamps(suscripcion));
  } catch (e) {
    responderError(res, e);
  }
});

// ─── POST /api/subscription/cancel (cliente_titular) ──────────────────────────
router.post('/cancel', requireAuth, requirePermission('subscription.subscribe'), async (req, res) => {
  try {
    if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene una empresa asociada — contacta a Farmazed.' });

    const orgRef  = db().collection('orgs').doc(req.user.orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) return res.status(404).json({ error: 'Empresa no encontrada' });
    const org = orgSnap.data();
    const { suscripcion, cambioDePlan } = org;
    // Cancelar es idempotente (TAREA 38): ya cancelada -> 200, no 400.
    if (suscripcion?.estado === 'cancelada') return res.json({ estado: 'cancelada', yaEstaba: true });
    if (!suscripcion?.subscriptionId) {
      return res.status(400).json({ error: 'Esta empresa no tiene una suscripción activa/pendiente que cancelar.' });
    }

    const provider = getProvider();
    await provider.cancelSubscription(suscripcion.subscriptionId);
    // Un cambio de plan a medio aprobar se descarta con la suscripción (PayPal no deja cancelar
    // una que nadie aprobó: si alguien la aprueba después, el webhook la manda a revisión).
    if (cambioDePlan?.subscriptionId) {
      await provider.cancelSubscription(cambioDePlan.subscriptionId)
        .catch(err => console.error('[subscription] cambio de plan pendiente sin cancelar en el proveedor', { orgId: orgRef.id, subscriptionId: cambioDePlan.subscriptionId, error: err.message }));
    }

    const now = admin.firestore.Timestamp.now();
    await orgRef.update({
      'suscripcion.estado': 'cancelada', 'suscripcion.actualizadaEn': now,
      cambioDePlan: admin.firestore.FieldValue.delete(),
      ...(tipoDeSuscripcion(org) === 'empresarial' ? camposFinPlanEmpresarial(org, now) : {}), // termina el plan: sin gestor
    });
    res.json({ estado: 'cancelada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

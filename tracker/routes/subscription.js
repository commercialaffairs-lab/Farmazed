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
const { HttpError, responderError } = require('../utils/http_error');

const router = Router();
const db     = () => admin.firestore();
const PLAN_DOC = 'plan_suscripcion';

const PERIODOS = ['mensual', 'anual'];

// TAREA 38 (H8): subscribe/aceptar reservan 'pendiente' (sin subscriptionId)
// dentro de una runTransaction ANTES de llamar al proveedor — dos clics en
// paralelo ya no crean dos suscripciones en PayPal (el segundo recibe 409). Una
// reserva más vieja que RESERVA_TTL_MS se da por abandonada y se retoma.
const RESERVA_TTL_MS = 2 * 60 * 1000;

/** Devuelve la `suscripcion` previa (o null) para poder liberarla si el proveedor falla.
 *  `validar(orgData)` aplica los chequeos propios de cada ruta (lanza HttpError). */
// Clave de idempotencia de PayPal para crear la suscripción: estable dentro de la misma hora (un reintento
// tras un corte no abre otra) y distinta después (volver a suscribirse tras cancelar sí crea una nueva).
const claveSuscripcion = (orgId, planId) => `sub-${orgId}-${planId}-${Math.floor(Date.now() / 3_600_000)}`;

async function reservarSuscripcion(orgRef, validar) {
  return db().runTransaction(async (t) => {
    const snap = await t.get(orgRef);
    if (!snap.exists) throw new HttpError(404, { error: 'Empresa no encontrada' });
    const org = snap.data();
    validar(org);
    const previa = org.suscripcion || null;
    const reservadaMs = previa?.reservadaEn?.toMillis?.();
    if (previa?.estado === 'pendiente' && !previa.subscriptionId && reservadaMs && Date.now() - reservadaMs < RESERVA_TTL_MS) {
      throw new HttpError(409, { error: 'Ya se está creando la suscripción — espera un momento.' });
    }
    t.update(orgRef, { suscripcion: { estado: 'pendiente', reservadaEn: admin.firestore.Timestamp.now() } });
    return previa;
  });
}

// El proveedor ya creó la suscripción pero Firestore no la guardó: se cancela en el
// proveedor (si no, quedaría una suscripción viva que nadie conoce) y se libera la reserva.
async function guardarSuscripcion(orgRef, provider, subscriptionId, previa, campos) {
  try {
    await orgRef.update(campos);
  } catch (e) {
    console.error('[subscription] creada en el proveedor pero no guardada', { orgId: orgRef.id, subscriptionId, error: e.message });
    await provider.cancelSubscription(subscriptionId)
      .catch(err => console.error('[subscription] tampoco se pudo cancelar — cancelar a mano', { orgId: orgRef.id, subscriptionId, error: err.message }));
    await liberarSuscripcion(orgRef, previa);
    throw e;
  }
}

const liberarSuscripcion = (orgRef, previa) =>
  orgRef.update({ suscripcion: previa ?? admin.firestore.FieldValue.delete() })
    .catch(err => console.error('[subscription] no se pudo liberar la reserva', { orgId: orgRef.id, error: err.message }));

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
    const previa = await reservarSuscripcion(orgRef, (org) => {
      if (org.suscripcion?.estado === 'activa') throw new HttpError(409, { error: 'Esta empresa ya tiene una suscripción activa.' });
    });

    let provider, subscriptionId, status, approveUrl;
    try {
      provider = getProvider();
      ({ subscriptionId, status, approveUrl } = await provider.createSubscription({
        planId: plan.planId, referenceId: req.user.orgId,
        requestId: claveSuscripcion(req.user.orgId, plan.planId), // un reintento inmediato no crea otra suscripción
      }));
    } catch (e) {
      await liberarSuscripcion(orgRef, previa);
      throw e;
    }

    // 'ACTIVE' (mock, o PayPal si no exige aprobación) -> 'activa' de una;
    // cualquier otro estado inicial de PayPal real (normalmente
    // 'APPROVAL_PENDING' hasta que el titular aprueba en el checkout
    // hospedado) -> 'pendiente', el webhook (o una consulta manual,
    // GET /v1/billing/subscriptions/{id}) la pasaría a 'activa' después —
    // sin uso real en local, no hay URL pública que PayPal pueda avisar.
    const now = admin.firestore.Timestamp.now();
    const suscripcion = {
      estado: status === 'ACTIVE' ? 'activa' : 'pendiente',
      proveedor: provider.name,
      subscriptionId, planId: plan.planId,
      creadaEn: now, actualizadaEn: now,
    };
    await guardarSuscripcion(orgRef, provider, subscriptionId, previa, { suscripcion });

    res.status(201).json(serializeTimestamps({ ...suscripcion, approveUrl }));
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
    const suscripcion = orgSnap.data().suscripcion;
    // Cancelar es idempotente (TAREA 38): ya cancelada -> 200, no 400.
    if (suscripcion?.estado === 'cancelada') return res.json({ estado: 'cancelada', yaEstaba: true });
    if (!suscripcion?.subscriptionId) {
      return res.status(400).json({ error: 'Esta empresa no tiene una suscripción activa/pendiente que cancelar.' });
    }

    const provider = getProvider();
    await provider.cancelSubscription(suscripcion.subscriptionId);

    const now = admin.firestore.Timestamp.now();
    await orgRef.update({ 'suscripcion.estado': 'cancelada', 'suscripcion.actualizadaEn': now });
    res.json({ estado: 'cancelada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.reservarSuscripcion  = reservarSuscripcion;
router.liberarSuscripcion   = liberarSuscripcion;
router.guardarSuscripcion   = guardarSuscripcion;
router.claveSuscripcion     = claveSuscripcion;

module.exports = router;

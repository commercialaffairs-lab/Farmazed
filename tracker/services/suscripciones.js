/**
 * suscripciones.js — La suscripción de una empresa (`orgs/{id}.suscripcion`). Una empresa
 * tiene UNA sola a la vez: al plan global (routes/subscription.js) o a su Plan Empresarial
 * (routes/empresarial.js). Decisión de Rick (05-oct): es una o la otra, y se puede cambiar
 * de una a la otra — la actual se cobra hasta terminar el ciclo ya facturado y ese mismo
 * día empieza a regir (y a cobrarse) la nueva.
 *
 * Cambio de plan, paso a paso:
 *  1. Se pide al proveedor la fecha del próximo cobro de la suscripción vigente (`rigeDesde`).
 *  2. Se crea la suscripción nueva con inicio en esa fecha y se guarda en `orgs/{id}.cambioDePlan`
 *     ('pendiente' hasta que el titular la aprueba en PayPal). La vigente no se toca: si el
 *     titular abandona la aprobación, sigue con su plan de siempre.
 *  3. Al activarse la nueva (webhook ACTIVATED; el mock la activa de una) pasa a ser
 *     `suscripcion` — con `anterior.vigenteHasta` — y la anterior se cancela en el proveedor:
 *     ya no vuelve a cobrar, y el ciclo que estaba pagado se respeta.
 *
 * TAREA 38 (H8): se reserva 'pendiente' (sin subscriptionId) dentro de una runTransaction
 * ANTES de llamar al proveedor — dos clics en paralelo no crean dos suscripciones en PayPal
 * (el segundo recibe 409). Una reserva más vieja que RESERVA_TTL_MS se da por abandonada.
 */
const admin = require('firebase-admin');
const { getProvider, urlsDeRetorno } = require('./payments');
const { abrirRevision } = require('./revisiones_pago');
const { HttpError } = require('../utils/http_error');

const db = () => admin.firestore();
const RESERVA_TTL_MS = 2 * 60 * 1000;

// Clave de idempotencia de PayPal para crear la suscripción: estable dentro de la misma hora (un reintento
// tras un corte no abre otra) y distinta después (volver a suscribirse tras cancelar sí crea una nueva).
const claveSuscripcion = (orgId, planId) => `sub-${orgId}-${planId}-${Math.floor(Date.now() / 3_600_000)}`;

/** 'global' | 'empresarial' | null. Las suscripciones anteriores al campo `tipo` no lo traen:
 *  es empresarial si su plan es el de la propuesta de la empresa. */
function tipoDeSuscripcion(org) {
  const s = org?.suscripcion;
  if (!s) return null;
  return s.tipo || (s.planId && s.planId === org.propuestaEmpresarial?.planId ? 'empresarial' : 'global');
}

/**
 * Reserva el lugar de la suscripción nueva. `resolverPlan(org)` valida lo propio de cada ruta
 * (lanza HttpError) y devuelve el planId. Si la empresa ya tiene una suscripción activa del
 * OTRO tipo, la reserva va en `cambioDePlan` (la vigente no se toca); si es del mismo tipo, 409.
 */
async function reservarSuscripcion(orgRef, tipo, resolverPlan) {
  return db().runTransaction(async (t) => {
    const snap = await t.get(orgRef);
    if (!snap.exists) throw new HttpError(404, { error: 'Empresa no encontrada' });
    const org = snap.data();
    const planId = resolverPlan(org);
    const vigente = org.suscripcion?.estado === 'activa' ? org.suscripcion : null;
    if (vigente && tipoDeSuscripcion(org) === tipo) {
      throw new HttpError(409, { error: 'Esta empresa ya tiene una suscripción activa a este plan.' });
    }
    const campo = vigente ? 'cambioDePlan' : 'suscripcion';
    const previa = org[campo] || null;
    const reservadaMs = previa?.reservadaEn?.toMillis?.();
    if (previa?.estado === 'pendiente' && !previa.subscriptionId && reservadaMs && Date.now() - reservadaMs < RESERVA_TTL_MS) {
      throw new HttpError(409, { error: 'Ya se está creando la suscripción — espera un momento.' });
    }
    t.update(orgRef, { [campo]: { estado: 'pendiente', reservadaEn: admin.firestore.Timestamp.now() } });
    return { campo, previa, vigente, planId };
  });
}

const liberarSuscripcion = (orgRef, campo, previa) =>
  orgRef.update({ [campo]: previa ?? admin.firestore.FieldValue.delete() })
    .catch(err => console.error('[subscription] no se pudo liberar la reserva', { orgId: orgRef.id, error: err.message }));

// El proveedor ya creó la suscripción pero Firestore no la guardó: se cancela en el
// proveedor (si no, quedaría una suscripción viva que nadie conoce) y se libera la reserva.
async function guardarSuscripcion(orgRef, provider, subscriptionId, campo, previa, campos) {
  try {
    await orgRef.update(campos);
  } catch (e) {
    console.error('[subscription] creada en el proveedor pero no guardada', { orgId: orgRef.id, subscriptionId, error: e.message });
    await provider.cancelSubscription(subscriptionId)
      .catch(err => console.error('[subscription] tampoco se pudo cancelar — cancelar a mano', { orgId: orgRef.id, subscriptionId, error: err.message }));
    await liberarSuscripcion(orgRef, campo, previa);
    throw e;
  }
}

/** Lo que se escribe en la empresa cuando su `cambioDePlan` entra en vigor (sin efectos: lo usa
 *  también el webhook dentro de su propia transacción). */
function cambiosDeCambioDePlan(org, ahora) {
  const { cambioDePlan: cambio, suscripcion: previa } = org;
  const anterior = previa?.subscriptionId
    ? { tipo: tipoDeSuscripcion(org), subscriptionId: previa.subscriptionId, planId: previa.planId || null, vigenteHasta: cambio.rigeDesde || null }
    : null;
  return {
    suscripcion: { ...cambio, estado: 'activa', actualizadaEn: ahora, ...(anterior ? { anterior } : {}) },
    cambioDePlan: admin.firestore.FieldValue.delete(),
  };
}

// La suscripción que se reemplazó deja de cobrar. Si el proveedor no la cancela, lo tiene que
// hacer el admin a mano antes de la fecha de corte: si no, la empresa pagaría las dos.
async function cancelarAnterior(orgId, subscriptionId) {
  try {
    await getProvider().cancelSubscription(subscriptionId);
  } catch (e) {
    await abrirRevision(`cambio-${subscriptionId}`, {
      motivo: 'Cambio de plan: la suscripción anterior no se pudo cancelar en PayPal. Cancelarla a mano antes de su próximo cobro, o la empresa pagará las dos.',
      origen: 'cambio_de_plan', orgId, recursoId: subscriptionId,
    }).catch(err => console.error('[subscription] suscripción anterior sin cancelar y sin revisión abierta', { orgId, subscriptionId, error: err.message }));
  }
}

/** Pone en vigor el `cambioDePlan` de la empresa si es `subscriptionId`. Devuelve si lo aplicó. */
async function aplicarCambioDePlan(orgRef, subscriptionId) {
  const anterior = await db().runTransaction(async (t) => {
    const org = (await t.get(orgRef)).data();
    if (org?.cambioDePlan?.subscriptionId !== subscriptionId) return null;
    t.update(orgRef, cambiosDeCambioDePlan(org, admin.firestore.Timestamp.now()));
    return org.suscripcion || {};
  });
  if (anterior?.subscriptionId) await cancelarAnterior(orgRef.id, anterior.subscriptionId);
  return anterior !== null;
}

/**
 * Suscribe a la empresa al plan `tipo` (o programa el cambio si ya tiene activa una del otro tipo).
 * `extra(ahora)`: campos adicionales de la empresa que se guardan junto con la suscripción.
 */
async function suscribirEmpresa(orgRef, tipo, resolverPlan, extra = () => ({})) {
  const { campo, previa, vigente, planId } = await reservarSuscripcion(orgRef, tipo, resolverPlan);

  let provider, creada, rigeDesde = null;
  try {
    provider = getProvider();
    if (vigente) {
      const { nextBillingTime } = await provider.getSubscription(vigente.subscriptionId);
      if (!nextBillingTime || !(Date.parse(nextBillingTime) > Date.now())) {
        throw new HttpError(409, { error: 'No se pudo determinar cuándo termina el ciclo de tu suscripción actual — contacta a Farmazed para hacer el cambio de plan.' });
      }
      rigeDesde = nextBillingTime;
    }
    creada = await provider.createSubscription({
      planId, referenceId: orgRef.id,
      requestId: claveSuscripcion(orgRef.id, planId), // un reintento inmediato no crea otra suscripción
      ...(rigeDesde ? { startTime: rigeDesde } : {}),
      ...urlsDeRetorno('suscripcion'),
    });
  } catch (e) {
    await liberarSuscripcion(orgRef, campo, previa);
    throw e;
  }

  // 'ACTIVE' (mock, o PayPal si no exige aprobación) -> 'activa' de una; cualquier otro estado
  // inicial de PayPal real (normalmente 'APPROVAL_PENDING' hasta que el titular aprueba en el
  // checkout hospedado) -> 'pendiente', y el webhook la pasa a 'activa' (services/paypal_webhook.js).
  const ahora = admin.firestore.Timestamp.now();
  const nueva = {
    estado: creada.status === 'ACTIVE' ? 'activa' : 'pendiente',
    tipo, proveedor: provider.name,
    subscriptionId: creada.subscriptionId, planId,
    creadaEn: ahora, actualizadaEn: ahora,
    ...(rigeDesde ? { rigeDesde: admin.firestore.Timestamp.fromDate(new Date(rigeDesde)) } : {}),
  };
  await guardarSuscripcion(orgRef, provider, creada.subscriptionId, campo, previa, { [campo]: nueva, ...extra(ahora) });
  if (vigente && nueva.estado === 'activa') await aplicarCambioDePlan(orgRef, creada.subscriptionId);
  // Una suspendida (cobros fallidos) que se reemplaza no debe poder reactivarse y volver a cobrar.
  if (!vigente && previa?.estado === 'suspendida' && previa.subscriptionId) await cancelarAnterior(orgRef.id, previa.subscriptionId);

  return { ...nueva, approveUrl: creada.approveUrl, cambioDePlan: !!vigente };
}

module.exports = { tipoDeSuscripcion, suscribirEmpresa, aplicarCambioDePlan, cambiosDeCambioDePlan, cancelarAnterior, claveSuscripcion };

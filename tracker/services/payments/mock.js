/**
 * mock.js — TAREA 33 (PM_COMMENTS §H.14). Adaptador de pruebas del
 * proveedor de pagos — misma interfaz que paypal.js (ver index.js), sin
 * llamar a ningún servicio externo. Activo por defecto en el emulador y en
 * cualquier entorno sin `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`/
 * `PAYPAL_ENV` — "todo corre con mock hasta que Rick cree la app sandbox"
 * (instrucción explícita).
 *
 * Estado en memoria (Map) — no sobrevive un restart, no se comparte entre
 * instancias. Para el emulador/tests alcanza; nunca se usa en producción
 * (ahí SIEMPRE hay credenciales reales, ver index.js).
 */

const orders = new Map();        // orderId -> { amount, currency, referenceId, status, captureId? }
const plans = new Map();         // planId -> { nombre, monto, periodo }
const subscriptions = new Map(); // subscriptionId -> { planId, status }

function uuid() {
  return 'mock-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function createOrder({ amount, currency, referenceId, description }) {
  const orderId = uuid();
  // PayPal devuelve el monto con 2 decimales ("0.30"), no el float crudo del
  // llamador (0.30000000000000004) — el mock lo imita para que la comparación
  // de montos del servidor se pruebe contra lo que de verdad pasa (TAREA 38).
  orders.set(orderId, { amount: Number(Number(amount).toFixed(2)), currency, referenceId, description, status: 'CREATED' });
  // Sin app sandbox no hay checkout real al que redirigir — el front del
  // mock "aprueba" localmente (ver farmazed-web, botón de pago) y llama
  // directo a capturar. approveUrl queda null a propósito: su presencia (o
  // no) es la señal de "hay redirect real" vs. "mock, sigue de una".
  return { orderId, status: 'CREATED', approveUrl: null };
}

async function getOrder(orderId) {
  const order = orders.get(orderId);
  if (!order) throw new Error(`mock: orden "${orderId}" no existe`);
  return { orderId, status: order.status, amount: order.amount, currency: order.currency, captureId: order.captureId };
}

async function captureOrder(orderId) {
  const order = orders.get(orderId);
  if (!order) throw new Error(`mock: orden "${orderId}" no existe`);
  if (order.status === 'COMPLETED') {
    // Idempotente también a este nivel — capturar 2 veces en el proveedor
    // mismo no duplica nada ahí tampoco (igual que PayPal real).
    return { orderId, status: 'COMPLETED', amount: order.amount, currency: order.currency, captureId: order.captureId };
  }
  order.status = 'COMPLETED';
  order.captureId = uuid();
  return { orderId, status: 'COMPLETED', amount: order.amount, currency: order.currency, captureId: order.captureId };
}

async function createPlan({ nombre, monto, periodo }) {
  const planId = uuid();
  plans.set(planId, { nombre, monto, periodo });
  return { planId };
}

async function createSubscription({ planId, referenceId }) {
  if (!plans.has(planId)) throw new Error(`mock: plan "${planId}" no existe`);
  const subscriptionId = uuid();
  // Sin checkout real que aprobar, el mock activa la suscripción de una —
  // mismo criterio que createOrder (approveUrl null = sin redirect real).
  subscriptions.set(subscriptionId, { planId, referenceId, status: 'ACTIVE' });
  return { subscriptionId, status: 'ACTIVE', approveUrl: null };
}

async function getSubscription(subscriptionId) {
  const sub = subscriptions.get(subscriptionId);
  if (!sub) throw new Error(`mock: suscripción "${subscriptionId}" no existe`);
  return { subscriptionId, status: sub.status, planId: sub.planId };
}

async function cancelSubscription(subscriptionId) {
  const sub = subscriptions.get(subscriptionId);
  if (!sub) throw new Error(`mock: suscripción "${subscriptionId}" no existe`);
  sub.status = 'CANCELLED';
  return { subscriptionId, status: 'CANCELLED' };
}

// Nunca se llama en local (no hay URL pública que PayPal pueda avisar) —
// existe para que la interfaz sea idéntica a paypal.js. Siempre válida acá:
// no hay nada real que falsificar en el mock.
async function verifyWebhookSignature(_headers, _body) {
  return true;
}

module.exports = {
  name: 'mock',
  createOrder, getOrder, captureOrder,
  createPlan, createSubscription, getSubscription, cancelSubscription,
  verifyWebhookSignature,
};

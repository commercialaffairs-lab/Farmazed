/**
 * paypal.js — TAREA 33 (PM_COMMENTS §H.14). Adaptador real de PayPal — REST
 * v2 (Orders) + v1 (Subscriptions, Notifications) con `fetch` nativo de
 * Node, sin SDK de terceros. Misma interfaz que mock.js (ver index.js).
 *
 * Solo se activa si existen `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`/
 * `PAYPAL_ENV` (sandbox|live) en el entorno — NUNCA en el repo, NUNCA en
 * `.env` versionado (ver `tracker/.env.example`, solo placeholders).
 * `PAYPAL_WEBHOOK_ID` es aparte, solo para `verifyWebhookSignature` (sin
 * uso en local — no hay URL pública a la que PayPal pueda avisar).
 *
 * Nadie ha corrido esto contra la sandbox real todavía (Rick no ha creado
 * la app en developer.paypal.com) — escrito contra la documentación oficial
 * de la API, pero sin smoke-test real. `mock.js` es lo que de verdad se
 * probó en esta tarea.
 */

const BASE_URL = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

let cachedToken = null; // { accessToken, expiresAt }

// TAREA 38: ningún fetch a PayPal puede colgar el request indefinidamente.
// Se lee en cada llamada (no al cargar el módulo) para que un test pueda
// bajarlo sin reiniciar el proceso.
const timeoutMs = () => Number(process.env.PAYPAL_TIMEOUT_MS) || 15_000;

// fetch con timeout + cuerpo JSON validado. Un 2xx sin JSON válido es un
// error claro (antes `.catch(() => ({}))` lo convertía en {} y los llamadores
// seguían con orderId/subscriptionId undefined). 204/cuerpo vacío -> {}.
// Error con `.status` y `.issue` (details[0].issue o name de PayPal) para que
// los llamadores distingan p.ej. 422 ORDER_ALREADY_CAPTURED.
async function fetchJson(descripcion, url, options) {
  let res, texto;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs()) });
    texto = await res.text(); // el timeout también cubre la lectura del cuerpo
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      throw new Error(`PayPal ${descripcion} no respondió en ${timeoutMs()} ms (timeout)`);
    }
    throw e;
  }
  let body = {};
  let jsonValido = true;
  if (texto) {
    try { body = JSON.parse(texto); } catch { jsonValido = false; }
  }
  if (!res.ok) {
    const err = new Error(`PayPal ${descripcion} falló: ${res.status} ${jsonValido ? JSON.stringify(body) : texto.slice(0, 200)}`);
    err.status = res.status;
    err.issue = body?.details?.[0]?.issue || body?.name;
    throw err;
  }
  if (!jsonValido) throw new Error(`PayPal ${descripcion}: la respuesta no es JSON válido`);
  return body;
}

// approveUrl llega al navegador del cliente y se abre con location.href:
// solo se acepta https hacia *.paypal.com (nunca javascript:/data:/http: ni
// otro dominio, aunque venga en una respuesta rara).
function approveUrlSegura(links) {
  const href = (links || []).find(l => l.rel === 'approve' || l.rel === 'payer-action')?.href || null;
  if (!href) return null;
  let url;
  try { url = new URL(href); } catch { url = null; }
  if (url?.protocol !== 'https:' || !/(^|\.)paypal\.com$/.test(url.hostname)) {
    throw new Error('PayPal devolvió un approveUrl que no es https://*.paypal.com — se descarta.');
  }
  return href;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.accessToken;

  const credenciales = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const data = await fetchJson('OAuth', `${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credenciales}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!data.access_token) throw new Error('PayPal OAuth: la respuesta no trae access_token');
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

async function paypalFetch(path, options = {}) {
  const token = await getAccessToken();
  return fetchJson(path, `${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

// ─── Orders API v2 ──────────────────────────────────────────────────────────────
// `requestId` -> cabecera PayPal-Request-Id (idempotencia): si la respuesta se pierde (timeout, corte) y se
// reintenta con la MISMA clave, PayPal devuelve el recurso original en vez de crear otro (y cobrar dos veces).
const idempotente = (requestId) => (requestId ? { 'PayPal-Request-Id': requestId } : {});

// `returnUrl`/`cancelUrl`: a dónde vuelve el cliente desde el checkout de PayPal. Sin ellas se queda
// en PayPal y el portal nunca se entera de que aprobó (la orden no se captura).
const retorno = (returnUrl, cancelUrl, accion) => (returnUrl
  ? { application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: accion, shipping_preference: 'NO_SHIPPING' } }
  : {});

async function createOrder({ amount, currency, referenceId, description, requestId, returnUrl, cancelUrl }) {
  const data = await paypalFetch('/v2/checkout/orders', {
    method: 'POST',
    headers: idempotente(requestId),
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: referenceId,
        description,
        amount: { currency_code: currency, value: amount.toFixed(2) },
      }],
      ...retorno(returnUrl, cancelUrl, 'PAY_NOW'),
    }),
  });
  return { orderId: data.id, status: data.status, approveUrl: approveUrlSegura(data.links) };
}

async function getOrder(orderId) {
  const data = await paypalFetch(`/v2/checkout/orders/${orderId}`);
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    orderId: data.id, status: data.status,
    amount: Number(capture?.amount?.value ?? unit?.amount?.value),
    currency: capture?.amount?.currency_code ?? unit?.amount?.currency_code,
    captureId: capture?.id,
    captureStatus: capture?.status, // la orden puede estar COMPLETED con la captura PENDING (revisión de riesgo)
  };
}

async function captureOrder(orderId) {
  let data;
  try {
    data = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST', headers: idempotente(`capture-${orderId}`) });
  } catch (e) {
    // Ya estaba capturada (reintento tras un timeout, o doble envío): no es
    // un error — se lee el estado real de la orden y se sigue (TAREA 38).
    if (e.status === 422 && e.issue === 'ORDER_ALREADY_CAPTURED') return getOrder(orderId);
    throw e;
  }
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    orderId: data.id,
    status: data.status, // 'COMPLETED' si fue bien
    amount: Number(capture?.amount?.value),
    currency: capture?.amount?.currency_code,
    captureId: capture?.id,
    captureStatus: capture?.status,
  };
}

// ─── Subscriptions API v1 ───────────────────────────────────────────────────────
// PayPal exige un "producto" del catálogo antes de poder crear un plan —
// se crea uno nuevo cada vez que se crea un plan (1:1, no hace falta
// reusar catálogo para un solo plan de suscripción de la plataforma).
async function createPlan({ nombre, monto, periodo }) {
  const producto = await paypalFetch('/v1/catalogs/products', {
    method: 'POST',
    body: JSON.stringify({ name: nombre, type: 'SERVICE', category: 'SOFTWARE' }),
  });

  const plan = await paypalFetch('/v1/billing/plans', {
    method: 'POST',
    body: JSON.stringify({
      product_id: producto.id,
      name: nombre,
      billing_cycles: [{
        frequency: { interval_unit: periodo === 'anual' ? 'YEAR' : 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // 0 = indefinido, se renueva hasta que se cancele
        pricing_scheme: { fixed_price: { value: monto.toFixed(2), currency_code: 'USD' } },
      }],
      payment_preferences: { auto_bill_outstanding: true },
    }),
  });
  return { planId: plan.id };
}

// `startTime` (ISO, futuro): el primer cobro es ese día — lo usa el cambio de plan para que la
// suscripción nueva empiece a regir justo cuando termina el ciclo ya pagado de la anterior.
async function createSubscription({ planId, referenceId, requestId, startTime, returnUrl, cancelUrl }) {
  const data = await paypalFetch('/v1/billing/subscriptions', {
    method: 'POST',
    headers: idempotente(requestId),
    body: JSON.stringify({
      plan_id: planId, custom_id: referenceId,
      ...(startTime ? { start_time: startTime } : {}),
      ...retorno(returnUrl, cancelUrl, 'SUBSCRIBE_NOW'),
    }),
  });
  let approveUrl;
  try {
    approveUrl = approveUrlSegura(data.links);
  } catch (e) {
    // PayPal ya creó la suscripción: no se deja huérfana (podría cobrar si alguien la aprueba).
    await cancelSubscription(data.id).catch(err => console.error('[paypal] suscripción huérfana, cancelar a mano', { subscriptionId: data.id, error: err.message }));
    throw e;
  }
  return { subscriptionId: data.id, status: data.status, approveUrl };
}

async function getSubscription(subscriptionId) {
  const data = await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}`);
  // nextBillingTime: fin del ciclo ya facturado (ISO) — null si PayPal no lo informa (p. ej. cancelada).
  return { subscriptionId: data.id, status: data.status, planId: data.plan_id, nextBillingTime: data.billing_info?.next_billing_time || null };
}

async function cancelSubscription(subscriptionId) {
  try {
    await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Cancelado desde el portal Farmazed' }),
    });
  } catch (e) {
    // 422 SUBSCRIPTION_STATUS_INVALID = no se puede cancelar en su estado actual.
    // Si en PayPal ya está cancelada/expirada, cancelar es idempotente -> éxito
    // (TAREA 38). Cualquier otro estado (p.ej. APPROVAL_PENDING, que se puede
    // aprobar después y empezar a cobrar) sigue siendo error.
    if (!(e.status === 422 && e.issue === 'SUBSCRIPTION_STATUS_INVALID')) throw e;
    const actual = await getSubscription(subscriptionId);
    if (!['CANCELLED', 'EXPIRED'].includes(actual.status)) throw e;
  }
  return { subscriptionId, status: 'CANCELLED' };
}

// ─── Webhooks ───────────────────────────────────────────────────────────────────
// Sin uso en local (no hay URL pública a la que PayPal pueda avisar) —
// escrito y listo para cuando haya despliegue real. `headers` son los que
// manda PayPal (PayPal-Transmission-Id, PayPal-Cert-Url, PayPal-Auth-Algo,
// PayPal-Transmission-Sig, PayPal-Transmission-Time); `body` es el
// webhook_event ya parseado (JSON), tal cual lo manda PayPal.
async function verifyWebhookSignature(headers, body) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false; // sin el ID configurado no hay nada que verificar — falla cerrado, nunca abierto.

  const data = await paypalFetch('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo:         headers['paypal-auth-algo'],
      cert_url:          headers['paypal-cert-url'],
      transmission_id:   headers['paypal-transmission-id'],
      transmission_sig:  headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id:        webhookId,
      webhook_event:     body,
    }),
  });
  return data.verification_status === 'SUCCESS';
}

module.exports = {
  name: 'paypal',
  createOrder, getOrder, captureOrder,
  createPlan, createSubscription, getSubscription, cancelSubscription,
  verifyWebhookSignature,
};

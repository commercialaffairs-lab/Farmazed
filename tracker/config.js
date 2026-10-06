/**
 * config.js — TAREA 40 (C2 + config de producción). UN solo lugar que lee y
 * valida las variables de entorno del tracker al ARRANCAR; si algo falta o es
 * peligroso, el proceso no arranca (mensaje claro) en vez de "funcionar" con un
 * default que apunte a producción o a un proveedor de pagos de mentira.
 *
 * Modos (se deducen del entorno, sin adivinar):
 *  · EMULADOR: FIRESTORE_EMULATOR_HOST definido (desarrollo local/pruebas).
 *  · PRODUCCIÓN: NODE_ENV=production o K_SERVICE (lo define Cloud Run).
 *  · Ni uno ni otro: se aborta. Sin emulador, un tracker local con credenciales
 *    de la sesión podría escribir en el Firestore/Storage REALES por accidente.
 *
 * Qué exige:
 *  · FIREBASE_PROJECT_ID y GCS_BUCKET SIEMPRE explícitos (no hay default 'farmazed').
 *  · Producción: sin emulador, MCP_KEY de >= 32 caracteres, y pagos reales.
 *  · Pagos: el mock SOLO con emulador o PAYMENTS_PROVIDER=mock, y nunca en
 *    producción. Si no es mock, hacen falta PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID y
 *    PAYPAL_ENV=sandbox|live: si faltan, no arranca (no cae al mock).
 *  · TRUST_PROXY, si se define, entero >= 1 (saltos de proxy delante; default 1).
 *  · CORS_ORIGINS (opcional, separados por coma): los orígenes https permitidos en
 *    producción — LISTA EXPLÍCITA, no "cualquier subdominio" (default: farmazed.com y
 *    www.farmazed.com). Un subdominio abandonado no puede llamar con credenciales.
 *  · PORTAL_URL (opcional): origen del portal al que PayPal devuelve al cliente tras aprobar
 *    un pago. Default: el primer origen de CORS_ORIGINS en producción; la demo local fuera de ella.
 */
const MCP_KEY_MIN = 32;
const ORIGENES_PROD_DEFECTO = ['https://farmazed.com', 'https://www.farmazed.com'];
const ORIGEN_VALIDO_RE = /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/; // https://host[:puerto], sin ruta
const ORIGEN_LOCAL_RE = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const PORTAL_LOCAL = 'http://localhost:8092'; // el frontend de la demo (demo_local.sh, puerto fijo)

class ConfigError extends Error {
  constructor(problemas) {
    super(`Configuración inválida:\n - ${problemas.join('\n - ')}`);
    this.name = 'ConfigError';
    this.problemas = problemas;
  }
}

const esProduccion = (env) => String(env.NODE_ENV || '').trim().toLowerCase() === 'production' || !!env.K_SERVICE;
const HOST_LOCAL_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Proveedor de pagos según el entorno: 'mock' | 'paypal'. Lanza ConfigError si el
 * entorno no permite ninguno de los dos. Pura: la usa cargarConfig (al arrancar) y
 * services/payments/index.js (en cada llamada, para que las pruebas puedan cambiar env).
 */
function resolverProveedorPagos(env) {
  const problemas = [];
  const prod = esProduccion(env);
  const enEmulador = !!env.FIRESTORE_EMULATOR_HOST;
  const pedido = env.PAYMENTS_PROVIDER;

  if (pedido && !['mock', 'paypal'].includes(pedido)) problemas.push(`PAYMENTS_PROVIDER inválido: "${pedido}" (válidos, en minúsculas: mock, paypal).`);
  if (pedido === 'mock' && prod) problemas.push('PAYMENTS_PROVIDER=mock no se permite en producción (el mock "cobra" sin dinero y abre el gate de fase_05).');
  const usaMock = pedido === 'mock' || (!pedido && enEmulador);
  if (problemas.length) throw new ConfigError(problemas);
  if (usaMock) return 'mock';

  for (const v of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID']) {
    if (!env[v]) problemas.push(`${v} es obligatorio con pagos reales (sin PAYMENTS_PROVIDER=mock ni emulador): el tracker NO cae al mock.`);
  }
  if (!['sandbox', 'live'].includes(env.PAYPAL_ENV)) problemas.push('PAYPAL_ENV debe ser "sandbox" o "live".');
  if (problemas.length) throw new ConfigError(problemas);
  return 'paypal';
}

function cargarConfig(env = process.env) {
  const problemas = [];
  const prod = esProduccion(env);
  const enEmulador = !!env.FIRESTORE_EMULATOR_HOST;

  if (!enEmulador && !prod) {
    problemas.push('No hay FIRESTORE_EMULATOR_HOST ni NODE_ENV=production (ni K_SERVICE): se aborta para no apuntar al Firestore/Storage de producción por accidente desde un entorno local.');
  }
  if (enEmulador && prod) problemas.push('FIRESTORE_EMULATOR_HOST está definido en un entorno de producción: no se combinan.');
  if (enEmulador && !HOST_LOCAL_RE.test(env.FIRESTORE_EMULATOR_HOST)) {
    problemas.push(`FIRESTORE_EMULATOR_HOST debe apuntar a localhost/127.0.0.1 (es "${env.FIRESTORE_EMULATOR_HOST}"): un emulador "remoto" no es un entorno de pruebas confiable.`);
  }
  if (!env.FIREBASE_PROJECT_ID) problemas.push('FIREBASE_PROJECT_ID es obligatorio (no hay proyecto por defecto).');
  if (!env.GCS_BUCKET) problemas.push('GCS_BUCKET es obligatorio (no hay bucket por defecto).');
  if (prod && (env.MCP_KEY || '').length < MCP_KEY_MIN) problemas.push(`MCP_KEY es obligatoria en producción y de al menos ${MCP_KEY_MIN} caracteres.`);
  if (env.TRUST_PROXY !== undefined && !(Number.isInteger(Number(env.TRUST_PROXY)) && Number(env.TRUST_PROXY) >= 1)) {
    problemas.push(`TRUST_PROXY debe ser un entero >= 1 (saltos de proxy delante): "${env.TRUST_PROXY}".`);
  }

  const origenesProd = env.CORS_ORIGINS === undefined
    ? ORIGENES_PROD_DEFECTO
    : env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
  if (!origenesProd.length) problemas.push('CORS_ORIGINS no puede quedar vacío (lista de orígenes https separados por coma).');
  for (const o of origenesProd) if (!ORIGEN_VALIDO_RE.test(o)) problemas.push(`CORS_ORIGINS: "${o}" no es un origen https válido (https://host[:puerto], sin ruta ni comodines).`);

  const portalUrl = env.PORTAL_URL || (prod ? origenesProd[0] : PORTAL_LOCAL);
  if (env.PORTAL_URL && !ORIGEN_VALIDO_RE.test(portalUrl) && !(!prod && ORIGEN_LOCAL_RE.test(portalUrl))) {
    problemas.push(`PORTAL_URL: "${portalUrl}" no es un origen válido (https://host[:puerto], sin ruta; http://localhost solo fuera de producción).`);
  }

  let proveedorPagos = null;
  try { proveedorPagos = resolverProveedorPagos(env); } catch (e) { problemas.push(...e.problemas); }

  if (problemas.length) throw new ConfigError(problemas);
  return {
    produccion: prod, enEmulador, proveedorPagos,
    projectId: env.FIREBASE_PROJECT_ID, bucket: env.GCS_BUCKET,
    origenesProd, portalUrl,
    trustProxy: Number(env.TRUST_PROXY) || 1,
  };
}

/**
 * ¿Se acepta este Origin? Solo los de la LISTA explícita (`origenesProd`, default
 * https://farmazed.com y https://www.farmazed.com — coincidencia EXACTA, sin comodines
 * de subdominio); localhost/127.0.0.1 con cualquier puerto solo fuera de producción.
 */
function origenPermitido(origin, { produccion, origenesProd = ORIGENES_PROD_DEFECTO }) {
  if (origenesProd.includes(origin)) return true;
  return !produccion && ORIGEN_LOCAL_RE.test(origin);
}

// Singleton para quien necesita la config ya validada (index.js al arrancar, services/storage.js).
let _config = null;
function obtenerConfig() {
  if (!_config) _config = cargarConfig(process.env);
  return _config;
}

module.exports = { cargarConfig, obtenerConfig, resolverProveedorPagos, origenPermitido, ConfigError, MCP_KEY_MIN };

/**
 * services/payments/index.js — TAREA 33 (PM_COMMENTS §H.14). Proveedor de
 * pagos intercambiable: PayPal real o `mock`, misma interfaz para quien
 * llama (ver mock.js/paypal.js para los métodos). TAREA 40: el mock SOLO con
 * emulador o PAYMENTS_PROVIDER=mock (y nunca en producción); sin él, hacen
 * falta las credenciales completas de PayPal o el tracker no arranca — ya NO
 * cae al mock en silencio. La regla vive en tracker/config.js.
 *
 * Se evalúa en cada llamada (no cacheado a nivel de módulo) para que los
 * tests puedan cambiar `process.env` entre un caso y otro sin reiniciar el
 * proceso — mismo criterio que `TARIFARIO_24SEP`... salvo que ESE sí se
 * cachea al cargar el módulo (ver quotes.js) porque ahí un solo proceso
 * nunca necesita cambiar de tarifario a mitad de corrida; acá sí hace
 * falta (mock en casi todos los tests, salvo los que prueban la selección
 * del proveedor en sí).
 */
const { resolverProveedorPagos } = require('../../config');

function getProvider() {
  // TAREA 40: la decisión vive en tracker/config.js. El mock SOLO con emulador o
  // PAYMENTS_PROVIDER=mock (nunca en producción); sin él y sin credenciales de PayPal
  // completas esto LANZA (y el tracker ni siquiera arranca): ya no cae al mock "a medias".
  return resolverProveedorPagos(process.env) === 'mock' ? require('./mock') : require('./paypal');
}

module.exports = { getProvider };

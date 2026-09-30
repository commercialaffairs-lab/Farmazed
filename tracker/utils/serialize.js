/**
 * serialize.js — Convierte Timestamps de Firestore a ISO string antes de
 * mandarlos por JSON.
 *
 * Bug reportado por Rick (TAREA 9, 29-sep): la columna "Actualizado" de
 * admin/casos.html mostraba "Invalid Date" — `res.json({ ...data })` manda
 * el Timestamp crudo (`{_seconds, _nanoseconds}`), y `new Date(...)` del
 * lado del cliente no sabe parsear ese objeto, solo un ISO string o un
 * epoch numérico.
 *
 * Antes esto se resolvía a mano por campo (`uploadedAt?.toDate?.()?.toISOString()`)
 * en cada ruta, inconsistente — algunas rutas lo hacían, otras no (de ahí el
 * bug). Esta función se usa en TODAS las respuestas que puedan traer un
 * Timestamp, recorriendo el objeto completo (incluye objetos anidados como
 * `faddi.submittedAt`), para que ninguna pantalla nueva vuelva a sufrirlo.
 */
function serializeTimestamps(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeTimestamps);
  }
  if (typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeTimestamps(v);
    return out;
  }
  return value;
}

module.exports = { serializeTimestamps };

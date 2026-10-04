/**
 * http_error.js — TAREA 38. Para abortar una runTransaction (o cortar un
 * handler) con un código HTTP concreto: `throw new HttpError(409, {error})`.
 * El handler lo traduce con `responderError(res, e)`; cualquier otro error
 * sigue siendo 500, como antes.
 */
class HttpError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Un error de PayPal (trae `.status` del proveedor) se loguea completo en el
// servidor y al cliente solo le llega un mensaje genérico: su cuerpo incluye
// debug_id/detalles internos que no le sirven ni deben salir.
function responderError(res, e) {
  if (e instanceof HttpError) return res.status(e.status).json(e.body);
  if (e.status) {
    console.error('[proveedor de pagos]', e.message);
    return res.status(502).json({ error: 'El proveedor de pagos respondió con un error — intenta de nuevo o contacta a Farmazed.' });
  }
  return res.status(500).json({ error: e.message });
}

module.exports = { HttpError, responderError };

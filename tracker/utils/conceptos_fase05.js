/**
 * conceptos_fase05.js — extraído de tracker/services/transitions.js
 * (TAREA 23, §H.8 Pagos) a un util sin dependencias propias, en TAREA 33
 * (§H.14): tanto `transitions.js` (el gate) como `quotes.js` (la captura
 * de pago por PayPal, que necesita la MISMA regla para saber qué conceptos
 * crear) lo necesitan, y `quotes.js` ya es una dependencia de
 * `transitions.js` — importarlo al revés crearía un require circular.
 *
 * Qué CONCEPTOS exige el gate de fase_05 — honorarios y tasa_dnfd siempre;
 * mef solo si el producto es extranjero; iea solo si el caso lo tiene
 * marcado (con su modalidad) en la línea de cotización aceptada.
 * `honorarios_saldo` NUNCA es parte de este gate (instrucción explícita
 * del PM: se muestra como "saldo pendiente" pero no bloquea).
 */
function conceptosRequeridosFase05(linea) {
  const requeridos = ['honorarios', 'tasa_dnfd'];
  if (linea?.esExtranjero) requeridos.push('mef');
  if (linea?.aplicaIEA) requeridos.push('iea');
  return requeridos;
}

/**
 * Conceptos a registrar cuando se cobra una línea (PayPal o Rapid PayPro): los requeridos por el
 * gate de fase_05 MÁS cualquier otro con monto > 0 en la cotización. Lo cobrado queda siempre en
 * el libro de pagos aunque la casilla (esExtranjero/aplicaIEA) no esté marcada — hallazgo de la
 * prueba de Rick del 01-nov-2026: el borrador automático trae MEF e IEA del tarifario y se cobran.
 */
function conceptosCobrados(principal, extras = []) {
  const monto = (c) => (principal?.conceptos?.[c] || 0) + extras.reduce((s, l) => s + (l?.conceptos?.[c] || 0), 0);
  const lista = [...conceptosRequeridosFase05(principal)];
  for (const c of ['honorarios', 'tasa_dnfd', 'mef', 'iea']) if (!lista.includes(c) && monto(c) > 0) lista.push(c);
  return lista;
}

module.exports = { conceptosRequeridosFase05, conceptosCobrados };

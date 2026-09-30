/**
 * transitions.js — TAREA 22 (ajuste sobre TAREA 21): ÚNICA fuente de verdad
 * de los gates de NEGOCIO de una transición de status de un caso.
 *
 * Hueco que esto cierra: `cases.js` (REST) ya tenía los 4 gates (transición
 * válida, cotización de fase_04, pago de fase_05, motivo de cerrado, dos
 * confirmaciones de fase_08) — pero `mcp.js` (Cowork) solo repetía la
 * transición y el pago, sin cotización ni confirmaciones de fase_08.
 * Cualquiera con MCP_KEY podía saltarse esos dos controles. Ahora las tres
 * rutas que escriben `status` (cases.js, mcp.js, y el `pending_docs` de
 * documents.js) llaman a `checkTransition()` — nadie repite esta lógica.
 *
 * NO decide permisos de ROL (quién puede pedir el salto) — eso sigue en
 * `middleware/permissions.js` (`canTransitionCase`), porque MCP no tiene el
 * concepto de rol (MCP_KEY ya es acceso de nivel admin, sin usuario
 * individual). `checkTransition()` solo mira si el salto está permitido
 * dado el ESTADO de los datos del caso — igual para REST que para MCP.
 *
 * Los gates solo se evalúan si `to` es una transición SECUENCIALMENTE
 * relevante para ese gate (mismo criterio que ya tenía cases.js, extraído
 * tal cual — no se inventó ningún gate nuevo, solo se centralizó):
 *   - pago:        se exige al SALIR de cualquier fase con gate de pago
 *                  (hoy solo fase_05) — hacia CUALQUIER destino, no solo el
 *                  siguiente paso secuencial (mismo comportamiento que ya
 *                  tenía cases.js).
 *   - cotización:  solo fase_04 -> fase_05 específicamente.
 *   - fase_08:     solo fase_08 -> fase_09 específicamente.
 *   - cerrado:     solo al ENTRAR a 'cerrado' (cualquier origen).
 */

const admin = require('firebase-admin');
const { isValidTransition } = require('../data/case_status');
const { hasConceptPayment } = require('../routes/payments');
const { hasAcceptedQuote, describeQuoteGate, attachCaseToDraftQuote, getAcceptedQuoteLineForCase } = require('../routes/quotes');
const { calcularFechaLimiteSubsanacion } = require('../utils/plazo_subsanacion');

// TAREA 23 (§H.8, Pagos): qué CONCEPTOS exige el gate de fase_05 — honorarios
// y tasa_dnfd siempre; mef solo si el producto es extranjero; iea solo si
// el caso lo tiene marcado (con su modalidad) en la línea de cotización
// aceptada. `honorarios_saldo` NUNCA es parte de este gate (instrucción
// explícita del PM: se muestra como "saldo pendiente" pero no bloquea).
function conceptosRequeridosFase05(linea) {
  const requeridos = ['honorarios', 'tasa_dnfd'];
  if (linea?.esExtranjero) requeridos.push('mef');
  if (linea?.aplicaIEA) requeridos.push('iea');
  return requeridos;
}

const db = () => admin.firestore();

function needsOverrideMsg(msg) {
  return `${msg} Un admin puede forzarlo con {"override":true} (queda registrado).`;
}

/**
 * checkTransition(caseData, caseId, to, { override, reason })
 *
 * Devuelve:
 *   { ok: true,  transitionValid, isFase8Recycle, gatesSaltados }
 *   { ok: false, status, error, gatesSaltados, transitionValid, isFase8Recycle, ...detalle }
 *
 * `gatesSaltados`: qué gates el override pasó por encima — el llamador lo
 * usa para decidir si el `override:true` que registra en `statusHistory` es
 * un override REAL (algún gate se saltó) o solo un flag que no hizo falta
 * (mismo criterio que ya tenía cases.js: `isOverride = gatesSaltados.length
 * > 0 && override`).
 */
async function checkTransition(caseData, caseId, to, { override = false, reason = null } = {}) {
  const from = caseData.status;
  const isFase8Recycle = to === 'fase_08' && from === 'fase_08';
  const gatesSaltados = [];

  if (to === from && !isFase8Recycle) {
    return { ok: true, transitionValid: true, isFase8Recycle: false, gatesSaltados, isNoop: true };
  }

  const transitionValid = isValidTransition(from, to);
  if (!transitionValid && !override) {
    return {
      ok: false, status: 400,
      error: needsOverrideMsg(`Transicion invalida: "${from}" -> "${to}".`),
      gatesSaltados, transitionValid, isFase8Recycle,
    };
  }
  if (!transitionValid) gatesSaltados.push('transicion');

  // Los gates de negocio de abajo, igual que en el cases.js original, solo
  // se evalúan si la transición en sí es válida (un salto inválido forzado
  // por override no pasa además por estos — mismo comportamiento de
  // siempre, no se inventó nada nuevo).
  if (transitionValid) {
    // TAREA 23 (§H.8, Pagos): pago por CONCEPTO, solo al SALIR de fase_05,
    // sin importar el destino (mismo alcance que el gate genérico de
    // TAREA 21/22, ahora desglosado). Los conceptos requeridos dependen de
    // la línea de cotización aceptada del caso (esExtranjero/aplicaIEA).
    if (from === 'fase_05') {
      const linea = await getAcceptedQuoteLineForCase(caseId);
      const requeridos = conceptosRequeridosFase05(linea);
      const pagados = await Promise.all(requeridos.map(c => hasConceptPayment(caseId, c)));
      const faltan = requeridos.filter((c, i) => !pagados[i]);
      if (faltan.length) {
        if (!override) {
          return {
            ok: false, status: 400,
            error: needsOverrideMsg(`No se puede avanzar desde "fase_05" sin registrar el pago de: ${faltan.join(', ')}.`),
            gatesSaltados, transitionValid, isFase8Recycle, pagoRequerido: faltan,
          };
        }
        gatesSaltados.push('pago');
      }
    }

    // R5/R12 (TAREA 18/§H.7): cotización aceptada, solo fase_04 -> fase_05.
    if (from === 'fase_04' && to === 'fase_05') {
      if (!caseData.orgId) {
        if (!override) {
          return {
            ok: false, status: 400,
            error: needsOverrideMsg('Caso sin empresa asignada: migrar la cuenta.'),
            gatesSaltados, transitionValid, isFase8Recycle,
          };
        }
        gatesSaltados.push('cotizacion_sin_org');
      } else {
        const quoteMissing = !(await hasAcceptedQuote(caseId));
        if (quoteMissing) {
          if (!override) {
            return {
              ok: false, status: 400,
              error: needsOverrideMsg(`No se puede avanzar desde "fase_04" sin una ${describeQuoteGate()}.`),
              gatesSaltados, transitionValid, isFase8Recycle,
            };
          }
          gatesSaltados.push('cotizacion');
        }
      }
    }

    // §H.8 (TAREA 21): fase_08 exige las dos confirmaciones antes de fase_09.
    if (from === 'fase_08' && to === 'fase_09') {
      const conf = caseData.confirmacionesFase8 || {};
      const fase8Missing = !conf.legal || !conf.tecnica;
      if (fase8Missing) {
        const faltan = [!conf.legal && 'legal', !conf.tecnica && 'técnica/matrices'].filter(Boolean).join(' y ');
        if (!override) {
          return {
            ok: false, status: 400,
            error: needsOverrideMsg(`Fase 8 exige las dos confirmaciones antes de avanzar — falta: ${faltan}.`),
            gatesSaltados, transitionValid, isFase8Recycle,
          };
        }
        gatesSaltados.push('fase8_confirmaciones');
      }
    }
  }

  // §H.8 (TAREA 21): cerrado exige motivo — no es un override (es un
  // destino normal del mapa de transiciones), pero igual necesita quedar
  // trazado. No depende de `transitionValid` (fase_04->cerrado siempre lo
  // es) ni tiene "override" propio: sin reason, 400 siempre.
  if (to === 'cerrado' && !reason) {
    return {
      ok: false, status: 400,
      error: 'reason es obligatorio para cerrar el expediente (cotización rechazada).',
      gatesSaltados, transitionValid, isFase8Recycle,
    };
  }

  return { ok: true, status: 200, error: null, transitionValid, isFase8Recycle, gatesSaltados };
}

/**
 * computeSideEffects(caseData, to, isFase8Recycle) — campos EXTRA a fusionar
 * en el `update` de Firestore cuando la transición ya pasó los gates.
 * Ninguno de estos es un gate (no bloquean nada) — son datos derivados de
 * ENTRAR a cierto estado. Centralizado para que cases.js y mcp.js no lo
 * repitan cada uno a su manera.
 */
function computeSideEffects(caseData, to, isFase8Recycle) {
  const extra = {};

  if (isFase8Recycle) {
    // Nuevo ciclo de subsanación — las confirmaciones viejas ya no aplican.
    extra.confirmacionesFase8 = { legal: null, tecnica: null };
  }

  if (to === 'observado_dnfd') {
    const { fecha, nota } = calcularFechaLimiteSubsanacion(caseData.tipoRegistro);
    extra.fechaLimiteSubsanacion = fecha ? admin.firestore.Timestamp.fromDate(fecha) : null;
    extra.fechaLimiteSubsanacionNota = nota;
  }

  return extra;
}

/**
 * afterTransition(caseId, caseData, to, actor) — efectos que escriben en
 * OTRA colección (no en el propio caso), después de que el `update` ya se
 * guardó. Hoy solo el borrador de cotización (R5/R12, TAREA 18) al ENTRAR a
 * fase_04. Nunca bloquea la respuesta si falla — el admin siempre puede
 * crear/ajustar la línea a mano desde admin/cotizaciones.html; solo se
 * registra el error.
 */
async function afterTransition(caseId, caseData, to, actor) {
  if (to !== 'fase_04' || caseData.status === 'fase_04') return;
  try {
    await attachCaseToDraftQuote({ id: caseId, ...caseData, status: to }, actor);
  } catch (e) {
    console.error(`afterTransition: attachCaseToDraftQuote(${caseId}) error:`, e);
  }
}

module.exports = { checkTransition, computeSideEffects, afterTransition };

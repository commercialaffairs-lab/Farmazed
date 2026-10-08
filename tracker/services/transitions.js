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

const admin = require('../utils/firebase_admin.js');
const { isValidTransition } = require('../data/case_status');
const { hasConceptPayment } = require('./payments_ledger');
const { hasAcceptedQuote, describeQuoteGate, attachCaseToDraftQuote, getAcceptedQuoteLineForCase } = require('./quotes');
const { calcularFechaLimiteSubsanacion } = require('../utils/plazo_subsanacion');
const { conceptosRequeridosFase05 } = require('../utils/conceptos_fase05');

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
async function checkTransition(caseData, caseId, to, { override = false, reason = null, t = null } = {}) {
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
      const linea = await getAcceptedQuoteLineForCase(caseId, t);
      const requeridos = conceptosRequeridosFase05(linea);
      const pagados = await Promise.all(requeridos.map(c => hasConceptPayment(caseId, c, t)));
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
        const quoteMissing = !(await hasAcceptedQuote(caseId, t));
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
async function afterTransition(caseId, caseData, to, actor, { db: database = db() } = {}) {
  if (to !== 'fase_04' || caseData.status === 'fase_04') return { avisos: [] };
  const caseRef = database.collection('cases').doc(caseId);
  // Sin empresa no hay a qué cotización agrupar el caso (cuenta sin migrar): no es un error de
  // la transición, pero tampoco es silencioso — el staff debe saber por qué no hay borrador.
  if (!caseData.orgId) return { avisos: ['Este caso no tiene empresa asociada (cuenta sin migrar): no se creó la línea del borrador de cotización.'] };
  try {
    await attachCaseToDraftQuote({ id: caseId, ...caseData, status: to }, actor);
  } catch (e) {
    // TAREA 41: ya NO se traga en silencio. La transición ya quedó guardada (el caso SÍ pasó
    // a fase_04), así que no se responde 500 — el cliente reintentaría un cambio que ya se
    // hizo. En cambio: (1) log con el caso, (2) queda MARCADO en el propio caso
    // (`cotizacionBorradorError`, visible para el staff y reintentable), y (3) la respuesta
    // trae `avisos` para que el llamador (REST/MCP) lo muestre.
    const mensaje = `No se pudo preparar la línea del borrador de cotización: ${e.message}`;
    console.error(`[afterTransition] attachCaseToDraftQuote(${caseId}) falló`, e);
    await caseRef.update({ cotizacionBorradorError: { mensaje, at: admin.firestore.Timestamp.now() } })
      .catch(err => console.error(`[afterTransition] tampoco se pudo marcar el error en el caso ${caseId}`, err));
    return { avisos: [mensaje] };
  }
  // La línea se preparó: el marcador de un intento anterior ya no aplica. Su propio catch: si
  // falla SOLO la limpieza, no se reporta como un fallo de la cotización.
  if (caseData.cotizacionBorradorError) {
    await caseRef.update({ cotizacionBorradorError: admin.firestore.FieldValue.delete() })
      .catch(err => console.error(`[afterTransition] no se pudo limpiar el marcador del caso ${caseId}`, err));
  }
  return { avisos: [] };
}

/**
 * applyTransition — TAREA 41. La ÚNICA vía que cambia el `status` de un caso (REST
 * `PATCH /api/cases/:id` y MCP `farmazed_update_case` la comparten). Una transacción:
 *   1. RELEE el caso (el status que se verificó es el que se escribe: dos peticiones
 *      concurrentes ya no pasan el gate las dos contra el mismo status viejo — la segunda
 *      reintenta, ve el status nuevo y se evalúa contra ese);
 *   2. verifica el gate (`checkTransition`) y, si hace falta, la autorización por rol;
 *   3. escribe el `update` Y la entrada de `statusHistory` JUNTOS: no existe un status
 *      cambiado sin su historial (ni al revés).
 * Después de confirmar, `afterTransition` (efectos en otras colecciones) con sus avisos.
 *
 * `update`: campos a escribir (ya incluye `status: to`, `updatedAt`, notas, etc.).
 * `autorizar(caseData)`: opcional (REST, permiso por rol); devuelve `null` o `{status, body}`.
 * `db`: inyectable (pruebas que simulan un fallo a mitad de la escritura).
 *
 * Devuelve `{ ok:true, caseData, update, isRealTransition, avisos }` (caseData = el caso ANTES
 * de escribir) o `{ ok:false, status, body, error }`.
 */
// TAREA 43: los gates de checkTransition leen quotes/payments con `t` (la misma transacción que
// escribe el cambio de estado), no con el db() global.
async function applyTransition({ caseId, to, update, actor, override = false, reason = null, autorizar = null, db: database = db() }) {
  const caseRef = database.collection('cases').doc(caseId);
  const histRef = caseRef.collection('statusHistory').doc();

  const r = await database.runTransaction(async (t) => {
    const snap = await t.get(caseRef);
    if (!snap.exists) return { ok: false, status: 404, error: 'Case not found', body: { error: 'Case not found' } };
    const caseData = snap.data();

    const isRealTransition = to !== undefined
      && (to !== caseData.status || (to === 'fase_08' && caseData.status === 'fase_08'));
    let gate = { ok: true, gatesSaltados: [], isFase8Recycle: false };
    let efectos = {};

    if (isRealTransition) {
      gate = await checkTransition(caseData, caseId, to, { override, reason, t });
      if (!gate.ok) {
        return {
          ok: false, status: gate.status, error: gate.error,
          body: { error: gate.error, from: caseData.status, to, ...(gate.pagoRequerido ? { pagoRequerido: gate.pagoRequerido } : {}) },
        };
      }
      const noAutorizado = autorizar ? autorizar(caseData) : null;
      if (noAutorizado) return { ok: false, status: noAutorizado.status, error: noAutorizado.body.error, body: noAutorizado.body };
      efectos = computeSideEffects(caseData, to, gate.isFase8Recycle);
    }

    const finalUpdate = { ...update, ...efectos };
    t.update(caseRef, finalUpdate);

    if (isRealTransition) {
      const isOverride = gate.gatesSaltados.length > 0 && override;
      // El motivo de cierre (fase_04 -> cerrado) se registra igual que un override,
      // aunque no lo sea — es la única transición normal que exige `reason`.
      const registrarMotivo = isOverride || to === 'cerrado';
      t.set(histRef, {
        from: caseData.status, to,
        override: isOverride,
        reason: registrarMotivo ? (reason || '') : null,
        by: actor.uid, byEmail: actor.email,
        at: admin.firestore.Timestamp.now(),
      });
    }
    return { ok: true, caseData, update: finalUpdate, isRealTransition };
  });

  if (!r.ok) return r;
  const { avisos } = r.isRealTransition
    ? await afterTransition(caseId, r.caseData, to, actor, { db: database })
    : { avisos: [] };
  return { ...r, avisos };
}

module.exports = { checkTransition, computeSideEffects, afterTransition, applyTransition };

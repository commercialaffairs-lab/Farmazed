/**
 * case_status.js — Enum canónico de estados de CASO y de DOCUMENTO.
 *
 * D05/D05b (organizacion/07_ALCANCE_E1_VERIFICADO.md §1.4, §4#6-7), primera
 * versión con las 14 fases del SVG canónico (§H.1, 29-sep). REEMPLAZADO en
 * TAREA 21 (30-sep) por el flujo de **13 fases en 5 bloques** — PM_COMMENTS
 * §H.8, que reemplaza §H.1 y §H.3 explícitamente. Fuente: Zelky, Drive
 * "Operaciones > Flujos del proceso de registro sanitario" (26-sep):
 * `Matriz_flujo_cliente_.docx` y `Manual_flujo_al_cliente_.docx`. La matriz
 * dice textualmente que el SVG de 14 fases (12-sep) "conserva la numeración
 * anterior... hasta que se renombren" — es decir, quedó superado por este
 * documento.
 *
 * Toda ruta que lee o escribe `status` de un caso o documento debe importar
 * de aquí, no repetir el literal (ver organizacion/inventario_estados.txt).
 *
 * ── Los 5 bloques (A-E) y las 13 fases (§H.8) ───────────────────────────────
 * A: 1 Primer contacto · 2 Captación de información preliminar · 3 Tipo de
 *    registro sanitario y ruta de registro.
 * B: 4 Elaboración y envío de cotización (cliente acepta con nombre/firma/
 *    fecha; NO acepta -> cierre del expediente, `cerrado`) · 5 Pago de
 *    costos del trámite (cliente paga, Farmazed verifica).
 * C: 6 Apertura de expediente interno (CRM) · 7 Instrucción al cliente:
 *    documentación requerida (no enviar originales) · **8 Recepción y
 *    revisión de documentación digital — PUNTO DE CONTROL** (cotejo con
 *    matrices guía, verificación legal de poderes/declaraciones,
 *    consistencia cruzada IEA/DNFD, fórmula por unidad de dosis, límite 150
 *    págs IEA; NO -> subsanación y nuevo cotejo EN LA MISMA FASE 8).
 * D: 9 Solicitud y envío de documentos originales (DHL, Farmazed instruye)
 *    · **10 Recepción y verificación de originales — PUNTO DE CONTROL**
 *    (firmas, apostillas, vigencia, muestras; NO -> vuelve a 9).
 * E: 11 Confección de dossiers DNFD e IEA · 12 Ingreso ante DNFD e IEA
 *    (número de expediente DNFD al CRM) · 13 Seguimiento y gestión
 *    post-ingreso (observaciones del evaluador, resultados IEA; salida:
 *    Certificado de Registro Sanitario entregado).
 *
 * `manual: true` marca las fases de control de calidad que NUNCA avanzan
 * solas — fase_08 (dos confirmaciones: legal=abogado, técnica/matrices=
 * regente, ver middleware/permissions.js) y fase_10 (analista). Un caso en
 * una de estas fases requiere una acción explícita de un empleado para
 * avanzar; no hay automatización que lo haga por sí sola.
 *
 * ── TRANSITIONS (§H.8) ───────────────────────────────────────────────────────
 * Avance secuencial fase_01→...→fase_13, más:
 *   - fase_04 -> `cerrado` (cotización rechazada, con motivo obligatorio).
 *   - fase_08 -> fase_08 (subsanación: nuevo ciclo de revisión, SE REGISTRA
 *     como una transición real aunque el status no cambie de valor — ver
 *     cases.js, que trata este caso como especial porque `from === to` es
 *     normalmente un no-op).
 *   - fase_10 -> fase_09 (subsanación: vuelve a pedir originales).
 *   - fase_13 <-> observado_dnfd (DNFD observa, Farmazed subsana y reingresa
 *     — puede ir y volver más de una vez).
 *   - fase_13 -> aprobado | denegado (terminales).
 *   - `pending_docs`/`deleted` siguen siendo comodines: se puede entrar
 *     desde CUALQUIER estado, y desde `pending_docs` se puede volver a
 *     cualquier estado (igual que en el modelo anterior).
 *   - `cerrado`/`aprobado`/`denegado`/`deleted` son terminales — sin salida.
 * Un salto que no está en este mapa da 400 (o -32000 en el MCP), salvo que
 * el admin mande `override: true` — ver cases.js/mcp.js.
 *
 * ── Máquina de estados resultante (21) ──────────────────────────────────────
 * `fase_01`..`fase_13` (13) + `draft`, `submitted`, `pending_docs`, `deleted`
 * (4) + `cerrado` (1) + `observado_dnfd`, `aprobado`, `denegado` (3) = 21.
 *
 * ── DOC_STATUSES (sin cambios, D05b) ─────────────────────────────────────────
 * `uploaded`, `reviewing`, `approved`, `rejected`, `requested`, `missing`,
 * `pending`.
 */

const PHASE_KEYS = Array.from({ length: 13 }, (_, i) => `fase_${String(i + 1).padStart(2, '0')}`);

const MANUAL_PHASES = new Set(['fase_08', 'fase_10']);

// Estados post-presentación (§H.8) — observado_dnfd es el único no terminal
// (DNFD pide subsanar y el caso vuelve a fase_13 tras corregir).
const POST_PRESENTACION = ['observado_dnfd', 'aprobado', 'denegado'];
const TERMINAL_STATUSES = new Set(['aprobado', 'denegado', 'deleted', 'cerrado']);

const CASE_STATUSES = [
  ...PHASE_KEYS,
  'draft', 'submitted', 'pending_docs', 'deleted', 'cerrado',
  ...POST_PRESENTACION,
];

const PHASE_LABELS = {
  fase_01: 'Primer contacto',
  fase_02: 'Captación de información preliminar',
  fase_03: 'Tipo de registro sanitario y ruta de registro',
  fase_04: 'Elaboración y envío de cotización',
  fase_05: 'Pago de costos del trámite',
  fase_06: 'Apertura de expediente interno (CRM)',
  fase_07: 'Instrucción al cliente: documentación requerida',
  fase_08: 'Recepción y revisión de documentación digital',
  fase_09: 'Solicitud y envío de documentos originales',
  fase_10: 'Recepción y verificación de originales',
  fase_11: 'Confección de dossiers DNFD e IEA',
  fase_12: 'Ingreso ante DNFD e IEA',
  fase_13: 'Seguimiento y gestión post-ingreso',
};

// Bloque A-E (§H.8) — usado para agrupar los hitos que ve el cliente (R9).
const PHASE_BLOCK = {
  fase_01: 'A', fase_02: 'A', fase_03: 'A',
  fase_04: 'B', fase_05: 'B',
  fase_06: 'C', fase_07: 'C', fase_08: 'C',
  fase_09: 'D', fase_10: 'D',
  fase_11: 'E', fase_12: 'E', fase_13: 'E',
};
const BLOCK_LABELS = {
  A: 'Diagnóstico y ruta',
  B: 'Cotización y pago',
  C: 'Documentación digital',
  D: 'Originales físicos',
  E: 'Presentación y seguimiento',
};

// Metadata por estado. `color` lo agrega D18 (tarea siguiente) — aquí solo
// `label` y `manual`.
const CASE_STATUS_META = {};
for (const key of PHASE_KEYS) {
  CASE_STATUS_META[key] = { label: PHASE_LABELS[key], manual: MANUAL_PHASES.has(key), block: PHASE_BLOCK[key] };
}
CASE_STATUS_META.draft           = { label: 'Borrador',                          manual: false };
CASE_STATUS_META.submitted       = { label: 'Enviado',                           manual: false };
CASE_STATUS_META.pending_docs    = { label: 'Documentos pendientes',             manual: false };
CASE_STATUS_META.deleted         = { label: 'Eliminado',                         manual: false };
CASE_STATUS_META.cerrado         = { label: 'Cerrado (cotización rechazada)',    manual: true  };
CASE_STATUS_META.observado_dnfd  = { label: 'Observado por DNFD',                manual: true  };
CASE_STATUS_META.aprobado        = { label: 'Aprobado',                          manual: false };
CASE_STATUS_META.denegado        = { label: 'Denegado',                          manual: false };

const DOC_STATUSES = ['uploaded', 'reviewing', 'approved', 'rejected', 'requested', 'missing', 'pending'];

function isValidStatus(status) {
  return CASE_STATUSES.includes(status);
}

function isValidDocStatus(status) {
  return DOC_STATUSES.includes(status);
}

// ─── Mapa de transiciones (§H.8) ────────────────────────────────────────────
// status -> array de estados siguientes válidos (ida y vuelta explícitas).
// pending_docs/deleted se manejan aparte (wildcard, ver isValidTransition).
const TRANSITIONS = {
  draft:     ['submitted'],
  submitted: ['fase_01'],

  fase_01: ['fase_02'],
  fase_02: ['fase_03'],
  fase_03: ['fase_04'],
  fase_04: ['fase_05', 'cerrado'],      // cliente no acepta -> cerrado (motivo obligatorio)
  fase_05: ['fase_06'],
  fase_06: ['fase_07'],
  fase_07: ['fase_08'],
  fase_08: ['fase_08', 'fase_09'],      // manual — self-loop = nuevo ciclo de subsanación (se registra)
  fase_09: ['fase_10'],
  fase_10: ['fase_09', 'fase_11'],      // manual — subsanación -> vuelve a pedir originales
  fase_11: ['fase_12'],
  fase_12: ['fase_13'],
  fase_13: ['observado_dnfd', 'aprobado', 'denegado'],

  observado_dnfd: ['fase_13'],
  cerrado: [],
  aprobado: [],
  denegado: [],
};

/**
 * ¿Es válido pasar de `from` a `to` sin override?
 * - Entrar a pending_docs o deleted se permite desde cualquier estado.
 * - Salir de pending_docs se permite hacia cualquier estado (no hay registro
 *   de en qué fase estaba antes — ver nota de TRANSITIONS arriba).
 * - `from === to` (no-op) se permite siempre — EXCEPTO que cases.js trata
 *   fase_08->fase_08 como una transición REAL (nuevo ciclo de subsanación,
 *   TRANSITIONS.fase_08 ya lo incluye explícitamente por eso, aunque el
 *   caso general de no-op no necesitaría esa entrada).
 * - Fuera de eso, se sigue el mapa TRANSITIONS.
 */
function isValidTransition(from, to) {
  if (!isValidStatus(from) || !isValidStatus(to)) return false;
  if (from === to) return true;
  if (to === 'pending_docs' || to === 'deleted') return true;
  if (from === 'pending_docs') return true;
  return (TRANSITIONS[from] || []).includes(to);
}

// Constante nombrada para el único literal de caso que hoy se escribe desde
// más de una ruta (documents.js, mcp.js) — ver el parche de D06b en 07 §5.
const PENDING_DOCS = 'pending_docs';

module.exports = {
  CASE_STATUSES,
  CASE_STATUS_META,
  PHASE_KEYS,
  PHASE_LABELS,
  PHASE_BLOCK,
  BLOCK_LABELS,
  MANUAL_PHASES,
  TERMINAL_STATUSES,
  POST_PRESENTACION,
  TRANSITIONS,
  isValidStatus,
  isValidTransition,
  DOC_STATUSES,
  isValidDocStatus,
  PENDING_DOCS,
};

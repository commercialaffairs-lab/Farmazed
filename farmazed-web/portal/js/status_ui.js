/**
 * status_ui.js — Fuente única de presentación del enum de estados (D18/D19).
 *
 * Todo lo que sabe sobre CASE_STATUSES/DOC_STATUSES (labels, transiciones,
 * fases manuales) viene de GET /api/meta/statuses — nunca se repite el
 * literal aquí. Lo único que SÍ vive en este archivo, a propósito, son las
 * decisiones de presentación que el backend no tiene por qué conocer (qué
 * color de Bootstrap usa cada categoría de estado, qué ícono usa cada estado
 * de documento) — es EL mapa único de esas decisiones, no una copia más.
 */
import api from './api.js';

let _metaPromise = null;
function getMeta() {
  if (!_metaPromise) _metaPromise = api.getStatusMeta();
  return _metaPromise;
}

// Color Bootstrap por estado de CASO. No lo devuelve el backend (07 §1.4:
// "color lo agrega D18") porque es presentación, no dato de negocio.
//
// Ajuste TAREA 8 (Rick, 29-sep): un status que no está en el enum de 21
// (caso legacy sin migrar, D07) SIEMPRE es gris — antes caía en el 'info'
// azul genérico del fallback de más abajo, indistinguible de una fase real.
function colorForCaseStatus(status, meta) {
  if (!meta.statuses.includes(status)) return 'secondary';
  if (status === 'aprobado')       return 'success';
  if (status === 'denegado')       return 'danger';
  if (status === 'observado_dnfd') return 'warning';
  if (status === 'pending_docs')   return 'danger';
  if (status === 'deleted')        return 'secondary';
  if (status === 'draft')          return 'secondary';
  if (status === 'submitted')      return 'primary';
  return meta.manual.includes(status) ? 'warning' : 'info';
}

// Ícono/color por estado de DOCUMENTO (V4, DOC_STATUSES). Único lugar del
// frontend donde estos 7 literales aparecen como claves de mapa.
const DOC_STATUS_ICON  = { uploaded:'✅', approved:'✅', rejected:'❌', requested:'🔔', missing:'⬜', reviewing:'🔍', pending:'⬜' };
const DOC_STATUS_COLOR = { uploaded:'text-success', approved:'text-success', rejected:'text-danger', missing:'text-muted', requested:'text-warning', reviewing:'text-info', pending:'text-muted' };

async function getFullMeta() {
  return getMeta();
}

async function getCaseStatusLabel(status) {
  const meta = await getMeta();
  return meta.meta[status]?.label || status;
}

async function getCaseStatusBadgeClass(status) {
  const meta = await getMeta();
  return `bg-${colorForCaseStatus(status, meta)}`;
}

async function isManualCaseStatus(status) {
  const meta = await getMeta();
  return meta.manual.includes(status);
}

async function isTerminalCaseStatus(status) {
  const meta = await getMeta();
  return meta.terminal.includes(status);
}

/** Estados válidos a los que se puede pasar desde `status` (sin override). */
async function getValidNextStatuses(status) {
  const meta = await getMeta();
  return meta.transitions[status] || [];
}

async function getAllCaseStatuses() {
  return (await getMeta()).statuses;
}

function getDocStatusIcon(status)  { return DOC_STATUS_ICON[status]  || '⬜'; }
function getDocStatusColor(status) { return DOC_STATUS_COLOR[status] || ''; }

export {
  getFullMeta,
  getCaseStatusLabel,
  getCaseStatusBadgeClass,
  colorForCaseStatus,
  isManualCaseStatus,
  isTerminalCaseStatus,
  getValidNextStatuses,
  getAllCaseStatuses,
  getDocStatusIcon,
  getDocStatusColor,
};

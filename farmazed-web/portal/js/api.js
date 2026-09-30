/**
 * Farmazed Portal — API client
 * Thin wrapper around fetch() that attaches the Firebase ID token.
 */
import { getToken, API_BASE } from './auth.js';

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res   = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Cases ─────────────────────────────────────────────────────────────────────

const api = {
  // List user's own cases
  listCases: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/cases${q ? '?' + q : ''}`);
  },

  // Create new case
  createCase: (data) => apiFetch('/api/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Get full case + checklist
  getCase: (id) => apiFetch(`/api/cases/${id}`),

  // Get checklist with upload status
  getChecklist: (id) => apiFetch(`/api/cases/${id}/checklist`),

  // Update case fields
  updateCase: (id, data) => apiFetch(`/api/cases/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  // Status history (D18)
  getCaseHistory: (id) => apiFetch(`/api/cases/${id}/history`),

  // Status enum metadata (D18/D19) — labels, manual, TRANSITIONS
  getStatusMeta: () => apiFetch('/api/meta/statuses'),

  // §H.8 (TAREA 21) — las dos confirmaciones de fase_08 (legal/tecnica)
  confirmarFase8: (caseId, tipo) => apiFetch(`/api/cases/${caseId}/confirmaciones/fase8`, {
    method: 'POST',
    body: JSON.stringify({ tipo }),
  }),

  // ── Documents ───────────────────────────────────────────────────────────────

  listDocuments: (caseId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/cases/${caseId}/documents${q ? '?' + q : ''}`);
  },

  getDocument: (caseId, docId) => apiFetch(`/api/cases/${caseId}/documents/${docId}`),

  // Versiones anteriores archivadas (TAREA 13, ajuste de cumplimiento) — la
  // vigente ya viene en getDocument().
  getDocumentVersions: (caseId, docId) => apiFetch(`/api/cases/${caseId}/documents/${docId}/versions`),

  // Revisión de un documento (admin only) — status/reviewNotes. Sin UI propia
  // todavía; existe en el backend desde antes de esta tarea.
  updateDocument: (caseId, docId, data) => apiFetch(`/api/cases/${caseId}/documents/${docId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  deleteDocument: (caseId, docId) => apiFetch(`/api/cases/${caseId}/documents/${docId}`, {
    method: 'DELETE',
  }),

  // Flag a checklist document as required from the client (admin only)
  requestDocument: (caseId, faddiDocId, message) => apiFetch(`/api/cases/${caseId}/documents/request`, {
    method: 'POST',
    body: JSON.stringify({ faddiDocId, message }),
  }),

  /**
   * Upload a document using FormData (multipart).
   * Does NOT use apiFetch because we need multipart, not JSON.
   */
  uploadDocument: async (caseId, file, meta) => {
    const token = await getToken();
    const form  = new FormData();
    form.append('file',         file);
    form.append('faddiDocId',   meta.faddiDocId);
    form.append('faddiCode',    meta.faddiCode   || '');
    form.append('faddiDocName', meta.faddiDocName || '');
    form.append('faddiStep',    meta.faddiStep    || 0);

    const res = await fetch(`${API_BASE}/api/cases/${caseId}/documents`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // ── Messages ────────────────────────────────────────────────────────────────

  listMessages: (caseId) => apiFetch(`/api/cases/${caseId}/messages`),

  sendMessage: (caseId, text) => apiFetch(`/api/cases/${caseId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),

  // ── Pricing (D13) — lectura pública, con desglose honorarios/tasas ────────────
  getPricing: () => apiFetch('/api/admin/pricing'),

  // ── Pagos (D12) — dos eventos distintos: cliente_a_farmazed / farmazed_a_autoridad ──
  getPayments: (caseId) => apiFetch(`/api/cases/${caseId}/payments`),

  /**
   * Registrar un pago (admin only). Multipart: requiere comprobante (archivo).
   */
  registerPayment: async (caseId, { tipo, autoridad, concepto, monto, fecha, comprobante }) => {
    const token = await getToken();
    const form  = new FormData();
    form.append('tipo',  tipo);
    if (autoridad) form.append('autoridad', autoridad);
    if (concepto)  form.append('concepto', concepto);
    form.append('monto', monto);
    if (fecha) form.append('fecha', fecha);
    form.append('comprobante', comprobante);

    const res = await fetch(`${API_BASE}/api/cases/${caseId}/payments`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // ── E3 parte 2 (TAREA 15) — permisos, empresas, empleados, invitaciones ──────

  // El front nunca repite la tabla de permisos — pregunta qué puede.
  getMyPermissions: () => apiFetch('/api/me/permissions'),

  // Empresa propia (cliente_titular/cliente_miembro): miembros + invitaciones.
  getMyOrg: () => apiFetch('/api/me/org'),

  getOrgs: () => apiFetch('/api/orgs'),
  getOrgMembers: (orgId) => apiFetch(`/api/orgs/${orgId}/members`),
  createOrg: (nombre) => apiFetch('/api/orgs', { method: 'POST', body: JSON.stringify({ nombre }) }),

  getEmployees: () => apiFetch('/api/employees'),

  getInvitations: () => apiFetch('/api/invitations'),
  getInvitation:  (token) => apiFetch(`/api/invitations/${token}`),
  inviteTitular:  (email, orgName) => apiFetch('/api/invitations/titular', { method: 'POST', body: JSON.stringify({ email, orgName }) }),
  inviteEmpleado: (email, role) => apiFetch('/api/invitations/empleado', { method: 'POST', body: JSON.stringify({ email, role }) }),
  inviteMiembro:  (email) => apiFetch('/api/invitations/miembro', { method: 'POST', body: JSON.stringify({ email }) }),
  acceptInvitation: (token, uid) => apiFetch(`/api/invitations/${token}/accept`, { method: 'POST', body: JSON.stringify({ uid }) }),

  // ── R14 (TAREA 17) — biblioteca de formularios ────────────────────────────────
  getFormularios:     () => apiFetch('/api/formularios'),
  getCaseFormularios: (caseId) => apiFetch(`/api/cases/${caseId}/formularios`),

  // ── R5/R12 (TAREA 18) — cotizaciones ───────────────────────────────────────────
  getQuotes: () => apiFetch('/api/quotes'),
  getQuote:  (id) => apiFetch(`/api/quotes/${id}`),
  updateQuoteLine: (quoteId, caseId, data) => apiFetch(`/api/quotes/${quoteId}/lineas/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  sendQuote:    (id) => apiFetch(`/api/quotes/${id}/send`, { method: 'POST' }),
  respondQuote: (id, decision, motivo) => apiFetch(`/api/quotes/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ decision, motivo }),
  }),

  // ── R13 (TAREA 19) — conteo de páginas del paquete IEA (solo advierte) ────────
  getPaqueteIEA: (caseId) => apiFetch(`/api/cases/${caseId}/documents/paquete-iea`),
};

export default api;

/**
 * Farmazed Portal — API client
 * Thin wrapper around fetch() that attaches the Firebase ID token.
 */
import { getToken, API_BASE } from './auth.js';

async function apiFetch(path, options = {}) {
  // `anonimo`: no mandar el token de la sesión aunque haya una (TAREA 39b:
  // aceptar una invitación SIN cuenta es un endpoint público distinto del autenticado).
  const { anonimo, ...fetchOptions } = options;
  const token = anonimo ? null : await getToken();
  const res   = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      // multipart (FormData): el navegador pone el Content-Type con su boundary
      ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || `HTTP ${res.status}`), { codigo: err.codigo });
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

  // Flag a checklist document as required from the client (admin only)
  requestDocument: (caseId, faddiDocId, message) => apiFetch(`/api/cases/${caseId}/documents/request`, {
    method: 'POST',
    body: JSON.stringify({ faddiDocId, message }),
  }),

  /** Upload a document using FormData (multipart). */
  uploadDocument: (caseId, file, meta) => {
    const form = new FormData();
    form.append('file',         file);
    form.append('faddiDocId',   meta.faddiDocId);
    form.append('faddiCode',    meta.faddiCode   || '');
    form.append('faddiDocName', meta.faddiDocName || '');
    form.append('faddiStep',    meta.faddiStep    || 0);
    return apiFetch(`/api/cases/${caseId}/documents`, { method: 'POST', body: form });
  },

  // ── Messages ────────────────────────────────────────────────────────────────

  listMessages: (caseId) => apiFetch(`/api/cases/${caseId}/messages`),

  sendMessage: (caseId, text) => apiFetch(`/api/cases/${caseId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),

  // ── Pricing (D13) — lectura pública, con desglose honorarios/tasas ────────────
  getPricing: () => apiFetch('/api/admin/pricing'),
  updatePricing: (categoryId, data) => apiFetch(`/api/admin/pricing/${categoryId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Plan recurrente de la plataforma (TAREA 33): lectura pública, edición solo admin
  getPlan: () => apiFetch('/api/subscription/plan'),
  savePlan: (data) => apiFetch('/api/subscription/plan', { method: 'PUT', body: JSON.stringify(data) }),

  // ── Pagos (D12) — dos eventos distintos: cliente_a_farmazed / farmazed_a_autoridad ──
  getPayments: (caseId) => apiFetch(`/api/cases/${caseId}/payments`),

  /**
   * Registrar un pago (admin only). Multipart: requiere comprobante (archivo).
   */
  registerPayment: (caseId, { tipo, autoridad, concepto, monto, fecha, comprobante }) => {
    const form = new FormData();
    form.append('tipo',  tipo);
    if (autoridad) form.append('autoridad', autoridad);
    if (concepto)  form.append('concepto', concepto);
    form.append('monto', monto);
    if (fecha) form.append('fecha', fecha);
    form.append('comprobante', comprobante);
    return apiFetch(`/api/cases/${caseId}/payments`, { method: 'POST', body: form });
  },

  // ── E3 parte 2 (TAREA 15) — permisos, empresas, empleados, invitaciones ──────

  // El front nunca repite la tabla de permisos — pregunta qué puede.
  getMyPermissions: () => apiFetch('/api/me/permissions'),

  // Empresa propia (cliente_titular/cliente_miembro): miembros + invitaciones.
  getMyOrg: () => apiFetch('/api/me/org'),

  getOrgs: () => apiFetch('/api/orgs'),
  getOrgMembers: (orgId) => apiFetch(`/api/orgs/${orgId}/members`),

  getEmployees: () => apiFetch('/api/employees'),

  getInvitations: () => apiFetch('/api/invitations'),

  // TAREA 41b: el HTML del mapa del código (admin) — no es JSON, así que no pasa por apiFetch.
  // `generadoEn` sale de Last-Modified (cabecera CORS-safelisted).
  getCodeGraph: async () => {
    const res = await fetch(`${API_BASE}/api/admin/code-graph`, { headers: { Authorization: `Bearer ${await getToken()}` } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const lm = res.headers.get('last-modified');
    return { html: await res.text(), generadoEn: lm ? new Date(lm) : null };
  },
  getInvitation:  (token) => apiFetch(`/api/invitations/${token}`),
  inviteTitular:  (email, orgName) => apiFetch('/api/invitations/titular', { method: 'POST', body: JSON.stringify({ email, orgName }) }),
  inviteEmpleado: (email, role) => apiFetch('/api/invitations/empleado', { method: 'POST', body: JSON.stringify({ email, role }) }),
  inviteMiembro:  (email) => apiFetch('/api/invitations/miembro', { method: 'POST', body: JSON.stringify({ email }) }),
  // TAREA 39b: SIN cuenta -> `datos` = { displayName, password } y NO se manda sesión: el servidor crea
  // el usuario con el correo de la invitación. CON cuenta -> sin `datos`: el uid sale del token de la sesión.
  acceptInvitation: (token, datos) => apiFetch(`/api/invitations/${encodeURIComponent(token)}/accept`,
    datos ? { method: 'POST', body: JSON.stringify(datos), anonimo: true } : { method: 'POST' }),

  // ── TAREA 32 (§H.13) — captación de información preliminar (Fase 2 Zelky) ──
  // PATCH, no POST: el mismo endpoint sirve para la primera vez y para
  // editar después desde Mi Empresa.
  saveCaptacion: (data) => apiFetch('/api/orgs/mine/captacion', { method: 'PATCH', body: JSON.stringify(data) }),
  getLeads:      () => apiFetch('/api/orgs/leads'),
  marcarLeadRevisado: (orgId) => apiFetch(`/api/orgs/${orgId}/leads/revisar`, { method: 'POST' }),

  // ── R14 (TAREA 17) — biblioteca de formularios ────────────────────────────────
  getFormularios:     () => apiFetch('/api/formularios'),
  getCaseFormularios: (caseId) => apiFetch(`/api/cases/${caseId}/formularios`),

  // ── R5/R12 (TAREA 18) — cotizaciones ───────────────────────────────────────────
  getQuotes: () => apiFetch('/api/quotes'),
  updateQuoteLine: (quoteId, caseId, data) => apiFetch(`/api/quotes/${quoteId}/lineas/${caseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  sendQuote:    (id) => apiFetch(`/api/quotes/${id}/send`, { method: 'POST' }),
  respondQuote: (id, decision, motivo) => apiFetch(`/api/quotes/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ decision, motivo }),
  }),

  // ── TAREA 33 (§H.14) — pago de la cotización aceptada con PayPal ──────────────
  crearOrdenPago: (quoteId) => apiFetch(`/api/quotes/${quoteId}/pago/crear-orden`, { method: 'POST' }),
  capturarPago:   (quoteId, orderId) => apiFetch(`/api/quotes/${quoteId}/pago/capturar`, { method: 'POST', body: JSON.stringify({ orderId }) }),

  // ── TAREA 33 (§H.14) — plan recurrente de suscripción ──────────────────────────
  suscribirEmpresa: () => apiFetch('/api/subscription/subscribe', { method: 'POST' }),
  cancelarSuscripcion: () => apiFetch('/api/subscription/cancel', { method: 'POST' }),

  // ── TAREA 34 (§H.15) — planes del landing ──────────────────────────────────────
  setMiPlan: (plan) => apiFetch('/api/orgs/mine/plan', { method: 'PATCH', body: JSON.stringify({ plan }) }),
  saveDiagnostico: (orgId, data) => apiFetch(`/api/orgs/${orgId}/diagnostico`, { method: 'PUT', body: JSON.stringify(data) }),
  getContactLeads: () => apiFetch('/api/contact-leads'),
  invitarContactLead: (id, orgName) => apiFetch(`/api/contact-leads/${id}/invitar`, { method: 'POST', body: JSON.stringify({ orgName }) }),
  solicitarEmpresarial: (data) => apiFetch('/api/empresarial/solicitar', { method: 'POST', body: JSON.stringify(data) }),
  definirCondicionesEmpresarial: (orgId, data) => apiFetch(`/api/empresarial/${orgId}/condiciones`, { method: 'PUT', body: JSON.stringify(data) }),
  aceptarEmpresarial: () => apiFetch('/api/empresarial/aceptar', { method: 'POST' }),

  // ── R13 (TAREA 19) — conteo de páginas del paquete IEA (solo advierte) ────────
  getPaqueteIEA: (caseId) => apiFetch(`/api/cases/${caseId}/documents/paquete-iea`),
};

export default api;

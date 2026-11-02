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
    throw Object.assign(new Error(err.error || `HTTP ${res.status}`), { codigo: err.codigo, detalles: err.detalles });
  }
  return res.json();
}

/**
 * Como apiFetch pero para respuestas binarias (el PDF fiscal de una factura): devuelve el Blob.
 * Los errores llegan igual en JSON `{ error }`. Quien llama abre el Blob con URL.createObjectURL.
 */
async function fetchBlob(path) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || `HTTP ${res.status}`), { codigo: err.codigo });
  }
  return res.blob();
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
  reiniciarDemo: () => apiFetch('/api/demo/reiniciar', { method: 'POST' }),
  // Panel "Recorrido demo" (solo cuentas demo), en el idioma pedido (es|en|fr|pt; el tracker cae al español).
  getRecorridoDemo: (idioma) => apiFetch(`/api/demo/recorrido${idioma ? `?idioma=${encodeURIComponent(idioma)}` : ''}`),
  // Recorrido guiado de un cliente real (se activa en "Mi cuenta"; progreso según los datos de su empresa).
  getRecorridoCliente: (idioma) => apiFetch(`/api/me/recorrido${idioma ? `?idioma=${encodeURIComponent(idioma)}` : ''}`),
  // Preferencias de la cuenta ({ recorridoGuiado: bool }), guardadas en el tracker (siguen a la persona entre dispositivos).
  getPreferencias: () => apiFetch('/api/me/preferencias'),
  setPreferencias: (cambios) => apiFetch('/api/me/preferencias', { method: 'PUT', body: JSON.stringify(cambios) }),
  restablecerContrasena: (correo) => apiFetch('/api/employees/restablecer-contrasena', { method: 'POST', body: JSON.stringify({ correo }) }),

  getInvitations: () => apiFetch('/api/invitations'),

  // ── Configuración del back-office (admin/configuracion.html; tracker/routes/me.js y routes/system.js) ──
  // Perfil propio → { uid, correo, nombre, rol, correoVerificado, creadoEn, ultimoAcceso }.
  getPerfil: () => apiFetch('/api/me/perfil'),
  setPerfil: ({ nombre }) => apiFetch('/api/me/perfil', { method: 'PUT', body: JSON.stringify({ nombre }) }),
  // Revoca los tokens de la cuenta en todos los dispositivos (la sesión actual incluida: quien llama cierra sesión después).
  cerrarSesiones: () => apiFetch('/api/me/cerrar-sesiones', { method: 'POST' }),
  // Solo admin → { version, revision, entorno, pagos, facturacion, correo, demo }.
  getEstadoSistema: () => apiFetch('/api/admin/estado'),

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
  // Rapid PayPro por enlace (07-oct): un enlace por producto; el admin confirma el pago cuando lo ve en su panel.
  setEnlacePagoExterno: (quoteId, caseId, url) => apiFetch(`/api/quotes/${quoteId}/lineas/${caseId}/pago-externo`, { method: 'PUT', body: JSON.stringify({ url }) }),
  confirmarPagoExterno: (quoteId, caseId, referencia) => apiFetch(`/api/quotes/${quoteId}/lineas/${caseId}/pago-externo/confirmar`, { method: 'POST', body: JSON.stringify({ referencia }) }),
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

  // Correo de verificación de marca (tracker, si hay SMTP) — cuenta aún sin verificar
  reenviarVerificacion: () => apiFetch('/api/register/reenviar-verificacion', { method: 'POST' }),

  // ── Pagos por revisar (admin): avisos del webhook de PayPal y cambios de plan ──
  getRevisionesPago: () => apiFetch('/api/admin/revisiones-pago'),
  resolverRevisionPago: (id, nota) => apiFetch(`/api/admin/revisiones-pago/${encodeURIComponent(id)}/resolver`, { method: 'POST', body: JSON.stringify({ nota }) }),

  // ── Facturación electrónica (Rick, 01-nov-2026) — admin/finanzas.html; tracker/routes/facturas.js ──
  // Filtros vacíos no se mandan (el tracker rechaza estado/origen desconocidos, y '' lo sería).
  listFacturas: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined))).toString();
    return apiFetch(`/api/facturas${q ? '?' + q : ''}`);
  },
  getFacturasConfig: () => apiFetch('/api/facturas/config'),
  // `cambios` es parcial: { emisor, conceptos, formasPago, workflows, prefijo } (las claves que se manden).
  setFacturasConfig: (cambios) => apiFetch('/api/facturas/config', { method: 'PUT', body: JSON.stringify(cambios) }),
  listPagosSinFactura: () => apiFetch('/api/facturas/sin-factura'),
  facturarPagos: (caseId, paymentIds) => apiFetch('/api/facturas/desde-pagos', { method: 'POST', body: JSON.stringify({ caseId, paymentIds }) }),
  // accion: emitir | enviar | reintentar | anular ({ motivo })
  facturaAccion: (id, accion, body) => apiFetch(`/api/facturas/${encodeURIComponent(id)}/${accion}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }),
  getFacturaEstadoPac: (id) => apiFetch(`/api/facturas/${encodeURIComponent(id)}/estado-pac`),
  // Barrido de facturas automáticas a medias → { revisadas, resultados: [{ id, antes, despues | error }] }
  procesarFacturasPendientes: (minutos = 2) => apiFetch(`/api/facturas/procesar-pendientes?minutos=${encodeURIComponent(minutos)}`, { method: 'POST' }),
  getFacturaPdf: (id) => fetchBlob(`/api/facturas/${encodeURIComponent(id)}/pdf`),

  // ── TAREA 34 (§H.15) — planes del landing ──────────────────────────────────────
  setMiPlan: (plan) => apiFetch('/api/orgs/mine/plan', { method: 'PATCH', body: JSON.stringify({ plan }) }),
  saveDiagnostico: (orgId, data) => apiFetch(`/api/orgs/${orgId}/diagnostico`, { method: 'PUT', body: JSON.stringify(data) }),
  getContactLeads: (todos = false) => apiFetch(todos ? '/api/contact-leads?todos=1' : '/api/contact-leads'),
  // Escaneos del QR impreso (/qr → tracker/index.js), solo admin → { total, scans: [{ id, timestamp, ip, device }] }
  // (timestamp en ISO; los más recientes primero). Se muestran en admin/leads.html, "Consultas por QR".
  getScans: () => apiFetch('/api/scans'),
  updateContactLead: (id, data) => apiFetch(`/api/contact-leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  invitarContactLead: (id, orgName) => apiFetch(`/api/contact-leads/${id}/invitar`, { method: 'POST', body: JSON.stringify({ orgName }) }),
  solicitarEmpresarial: (data) => apiFetch('/api/empresarial/solicitar', { method: 'POST', body: JSON.stringify(data) }),
  definirCondicionesEmpresarial: (orgId, data) => apiFetch(`/api/empresarial/${orgId}/condiciones`, { method: 'PUT', body: JSON.stringify(data) }),
  aceptarEmpresarial: () => apiFetch('/api/empresarial/aceptar', { method: 'POST' }),

  // ── R13 (TAREA 19) — conteo de páginas del paquete IEA (solo advierte) ────────
  getPaqueteIEA: (caseId) => apiFetch(`/api/cases/${caseId}/documents/paquete-iea`),
};

export default api;

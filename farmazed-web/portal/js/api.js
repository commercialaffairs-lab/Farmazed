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

  // ── Documents ───────────────────────────────────────────────────────────────

  listDocuments: (caseId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/api/cases/${caseId}/documents${q ? '?' + q : ''}`);
  },

  getDocument: (caseId, docId) => apiFetch(`/api/cases/${caseId}/documents/${docId}`),

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
};

export default api;

/**
 * document_requests.js — TAREA 39 (H5). "Solicitar un documento al cliente"
 * (marca el documento como 'requested' y mete el caso en pending_docs). Antes
 * había DOS copias: POST /api/cases/:caseId/documents/request (documents.js,
 * con el gate de transición) y farmazed_request_document del MCP (mcp.js, SIN
 * ningún gate: Cowork podía mover un caso a pending_docs saltándose, p.ej., el
 * gate de pago). Ahora ambas llaman a esta función — una sola lógica.
 *
 * El gate (dentro de applyTransition) corre ANTES de escribir el documento: si
 * rechaza, no queda ningún documento 'requested' huérfano ni cambia el status.
 *
 * Devuelve `{ ok: true }` o `{ ok: false, status, error }` (el gate dijo que
 * no); cualquier otro fallo lanza.
 *
 * `actor`: { uid, email, revisor } — `revisor` es el email que queda en
 * `reviewedBy` del documento (solo REST; el MCP no tiene usuario individual).
 */
const admin = require('../utils/firebase_admin.js');
const { PENDING_DOCS } = require('../data/case_status');
const { applyTransition } = require('./transitions');

const db = () => admin.firestore();

async function solicitarDocumento({ caseId, caseData, faddiDocId, message, actor, override = false, reason = null }) {
  const now = admin.firestore.Timestamp.now();

  // Primero el cambio de status (applyTransition: relee, verifica el gate y escribe update +
  // historial atómicamente). Si el gate rechaza —incluso por una carrera con otra petición— NO
  // se escribe nada: ya no puede quedar un documento 'requested' sin el caso en pending_docs.
  // El orden inverso (documento y luego transición) dejaba un documento huérfano si fallaba.
  const r = await applyTransition({
    caseId, to: PENDING_DOCS, update: { status: PENDING_DOCS, updatedAt: now },
    actor: { uid: actor.uid, email: actor.email }, override, reason,
  });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };

  const docsCol = db().collection('cases').doc(caseId).collection('documents');
  const existing = await docsCol.where('faddiDocId', '==', faddiDocId).limit(1).get();

  if (!existing.empty) {
    await existing.docs[0].ref.update({
      status: 'requested', reviewNotes: message || '',
      ...(actor.revisor && { reviewedBy: actor.revisor }), reviewedAt: now,
    });
  } else {
    await docsCol.add({
      faddiDocId, faddiCode: '', faddiDocName: '', faddiStep: 0,
      fileName: '(pendiente)', fileSize: 0, mimeType: '', storagePath: '',
      status: 'requested', reviewNotes: message || '',
      uploadedAt: now, uploadedBy: 'admin',
    });
  }
  return { ok: true };
}

module.exports = { solicitarDocumento };

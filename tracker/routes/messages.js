const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');

const router = Router({ mergeParams: true }); // mergeParams to access :caseId
const db     = () => admin.firestore();

// Helper: verify case exists and user has access (same pattern as documents.js)
async function getCaseOrFail(caseId, user, res) {
  const snap = await db().collection('cases').doc(caseId).get();
  if (!snap.exists) { res.status(404).json({ error: 'Case not found' }); return null; }
  const data = snap.data();
  if (!user.admin && data.clientId !== user.uid) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return { id: snap.id, ...data };
}

// ─── GET /api/cases/:caseId/messages ───────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const snap = await db()
      .collection('cases').doc(req.params.caseId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    const messages = snap.docs.map(d => {
      const data = d.data();
      return {
        id:         d.id,
        senderRole: data.senderRole,
        senderName: data.senderName,
        text:       data.text,
        createdAt:  data.createdAt?.toDate?.()?.toISOString(),
      };
    });

    res.json({ total: messages.length, messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cases/:caseId/messages ──────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const caseData = await getCaseOrFail(req.params.caseId, req.user, res);
    if (!caseData) return;

    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (text.length > 4000) return res.status(400).json({ error: 'text is too long (max 4000 characters)' });

    const now = admin.firestore.Timestamp.now();
    const msgData = {
      senderRole: req.user.admin ? 'admin' : 'client',
      senderId:   req.user.uid,
      senderName: req.user.name || req.user.email,
      text,
      createdAt:  now,
    };

    const ref = await db()
      .collection('cases').doc(req.params.caseId)
      .collection('messages').add(msgData);

    // Surface the case as recently active, same as a document upload does.
    await db().collection('cases').doc(req.params.caseId).update({ updatedAt: now });

    res.status(201).json({
      id: ref.id,
      ...msgData,
      createdAt: now.toDate().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

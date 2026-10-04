const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { getCaseOrFail, requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');

const router = Router({ mergeParams: true }); // mergeParams to access :caseId
const db     = () => admin.firestore();

// ─── GET /api/cases/:caseId/messages ───────────────────────────────────────────
router.get('/', requireAuth, requirePermission('messages.read'), async (req, res) => {
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
        createdAt:  serializeTimestamps(data.createdAt),
      };
    });

    res.json({ total: messages.length, messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/cases/:caseId/messages ──────────────────────────────────────────
router.post('/', requireAuth, requirePermission('messages.send'), async (req, res) => {
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
      createdAt: serializeTimestamps(now),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

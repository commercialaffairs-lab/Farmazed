/**
 * revisiones_pago.js — "Pagos por revisar" del admin: lo que el webhook de PayPal o un
 * cambio de plan dejaron para que una persona lo mire (services/revisiones_pago.js).
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/admin/revisiones-pago', revisionesPagoRouter);
 */

const { Router } = require('express');
const admin       = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { textoError, trimOrNull } = require('../utils/validar_texto');
const { COLECCION } = require('../services/revisiones_pago');

const router = Router();
const db     = () => admin.firestore();
const MAX_ABIERTAS = 200;

// ─── GET /api/admin/revisiones-pago (admin) — las abiertas, la más reciente primero ───
router.get('/', requireAuth, requirePermission('payments.review'), async (req, res) => {
  try {
    const snap = await db().collection(COLECCION).where('resuelta', '==', false).limit(MAX_ABIERTAS).get();
    const revisiones = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.creadaEn.toMillis() - a.creadaEn.toMillis());
    res.json(serializeTimestamps({ revisiones }));
  } catch (e) {
    console.error('[revisiones-pago] no se pudieron listar', e);
    res.status(500).json({ error: 'No se pudieron cargar los pagos por revisar.' });
  }
});

// ─── POST /api/admin/revisiones-pago/:id/resolver (admin) ─────────────────────
router.post('/:id/resolver', requireAuth, requirePermission('payments.review'), async (req, res) => {
  try {
    const errorNota = textoError('nota', req.body?.nota, 500, false);
    if (errorNota) return res.status(400).json({ error: errorNota });

    const ref = db().collection(COLECCION).doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Revisión no encontrada' });
    await ref.update({
      resuelta: true, nota: trimOrNull(req.body?.nota),
      resueltaPor: req.user.uid, resueltaEn: admin.firestore.Timestamp.now(),
    });
    res.json({ resuelta: true });
  } catch (e) {
    console.error('[revisiones-pago] no se pudo resolver', e);
    res.status(500).json({ error: 'No se pudo marcar como resuelta.' });
  }
});

module.exports = router;

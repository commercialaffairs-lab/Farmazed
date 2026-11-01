/**
 * demo.js — Modo demo (Rick, 01-nov-2026). Solo para cuentas con el claim `demo:true`
 * (services/demo.js). El botón [Reiniciar cuenta demo] del topbar llama aquí.
 *
 * Mounts on the main Express app (index.js):
 *   app.use('/api/demo', demoRouter);
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { crearLimitador } = require('../utils/rate_limit');
const { esCuentaDemo, sembrarDemo, CUENTAS, DEMO_ORG_ID } = require('../services/demo');

const router = Router();

function soloDemo(req, res, next) {
  if (!esCuentaDemo(req.user)) return res.status(403).json({ error: 'Esta acción es solo para las cuentas de demostración.' });
  next();
}

// ─── GET /api/demo/estado — ¿esta sesión es demo? (el front decide si muestra el botón) ───
router.get('/estado', requireAuth, (req, res) => {
  res.json({ demo: esCuentaDemo(req.user), orgId: DEMO_ORG_ID, cuentas: CUENTAS.map(c => ({ correo: c.correo, rol: c.role })) });
});

// Reiniciar reescribe toda la demo: una vez por minuto por cuenta es más que suficiente.
const limitador = crearLimitador({ ventanaMs: 60 * 1000, max: 1 });

// ─── POST /api/demo/reiniciar — vuelve todo al estado inicial del recorrido ───────────────
router.post('/reiniciar', requireAuth, soloDemo, async (req, res) => {
  if (limitador.estaLimitado(req.user.uid)) {
    return res.status(429).json({ error: 'La demo se reinició hace menos de un minuto. Espera un momento y vuelve a intentar.' });
  }
  try {
    const r = await sembrarDemo();
    res.json({ reiniciada: true, cuentas: r.cuentas });
  } catch (e) {
    console.error('[demo] reiniciar', { uid: req.user.uid, error: e.message });
    res.status(500).json({ error: 'No se pudo reiniciar la demo. Intenta de nuevo en un momento.' });
  }
});

router.limitador = limitador; // para las pruebas (reset)
module.exports = router;

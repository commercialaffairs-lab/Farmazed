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
const { esCuentaDemo, sembrarDemo, CUENTAS, CUENTA_SIMULACION, DEMO_ORG_ID } = require('../services/demo');
const { esSimulacion, ambitoDe, ORGS_AISLADAS, PERFILES_SIMULACION } = require('../utils/demo_scope');
const { effectiveRole } = require('../middleware/permissions');
const { recorridoDemo } = require('../services/demo_recorrido');
const { normalizarIdioma } = require('../services/demo_recorrido_textos');

const router = Router();

function soloDemo(req, res, next) {
  if (!esCuentaDemo(req.user)) return res.status(403).json({ error: 'Esta acción es solo para las cuentas de demostración.' });
  next();
}

// ─── GET /api/demo/estado — ¿esta sesión es demo? (el front decide si muestra el botón) ───
router.get('/estado', requireAuth, (req, res) => {
  const simulacion = esSimulacion(req.user);
  res.json({
    demo: esCuentaDemo(req.user), orgId: esCuentaDemo(req.user) ? ambitoDe(req.user) : DEMO_ORG_ID,
    // Simulación (Rick, 14-nov-2026): el perfil efectivo de este request (cabecera X-Fz-Perfil) y los que puede adoptar.
    simulacion, perfil: simulacion ? req.user.role : null, perfiles: simulacion ? PERFILES_SIMULACION : [],
    cuentas: (simulacion ? [CUENTA_SIMULACION] : CUENTAS).map(c => ({ correo: c.correo, rol: c.role })),
  });
});

// ─── GET /api/demo/recorrido?idioma=es|en|fr|pt — pasos del recorrido guiado, cuál toca ahora y los
// rótulos del panel "Recorrido demo", en el idioma pedido (otro valor o ninguno → español) ─────────
router.get('/recorrido', requireAuth, soloDemo, async (req, res) => {
  try {
    res.json(await recorridoDemo(req.user, normalizarIdioma(req.query.idioma)));
  } catch (e) {
    console.error('[demo] recorrido', { uid: req.user.uid, error: e.message });
    res.status(500).json({ error: 'No se pudo leer el estado del recorrido.' });
  }
});

// Reiniciar reescribe toda la demo: una vez por minuto por cuenta es más que suficiente.
const limitador = crearLimitador({ ventanaMs: 60 * 1000, max: 1 });

// ─── POST /api/demo/reiniciar — vuelve todo al estado inicial del recorrido ───────────────
// Reinicia SOLO el ámbito de quien llama (demo-org para las cuentas demo, sim-org para la simulación). El admin REAL
// también puede reiniciar un ámbito concreto con { ambito: 'sim-org' | 'demo-org' } — así se crea la cuenta de
// simulación la primera vez en producción (DEPLOY.md), sin tener que entrar con ella.
function puedeReiniciar(req, res, next) {
  if (esCuentaDemo(req.user)) return next();
  const admin = effectiveRole(req.user) === 'admin';
  if (admin && ORGS_AISLADAS.includes(req.body?.ambito)) return next();
  return res.status(403).json({ error: 'Esta acción es solo para las cuentas de demostración (o el admin indicando el ámbito a reiniciar).' });
}
router.post('/reiniciar', requireAuth, puedeReiniciar, async (req, res) => {
  if (limitador.estaLimitado(req.user.uid)) {
    return res.status(429).json({ error: 'La demo se reinició hace menos de un minuto. Espera un momento y vuelve a intentar.' });
  }
  try {
    const ambito = esCuentaDemo(req.user) ? ambitoDe(req.user) : req.body.ambito;
    const r = await sembrarDemo(ambito);
    res.json({ reiniciada: true, ambito: r.orgId, cuentas: r.cuentas });
  } catch (e) {
    console.error('[demo] reiniciar', { uid: req.user.uid, error: e.message });
    res.status(500).json({ error: 'No se pudo reiniciar la demo. Intenta de nuevo en un momento.' });
  }
});

router.limitador = limitador; // para las pruebas (reset)
module.exports = router;

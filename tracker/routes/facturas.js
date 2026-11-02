/**
 * facturas.js — Facturación electrónica (Rick, 01-nov-2026). Ver services/facturacion/facturas.js.
 *
 *   GET  /api/facturas                     admin: lista (filtros estado, origen, limite)
 *   GET  /api/facturas/config              admin: configuración (emisor, conceptos/ITBMS, formas de pago, workflows)
 *   PUT  /api/facturas/config              admin: guarda la configuración
 *   GET  /api/facturas/sin-factura         admin: pagos del cliente que no tienen factura
 *   POST /api/facturas/desde-pagos         admin: factura a mano { caseId, paymentIds[] } (emite y envía)
 *   GET  /api/facturas/mias                cliente: las de su empresa
 *   GET  /api/facturas/:id                 admin o la propia empresa
 *   GET  /api/facturas/:id/pdf             admin o la propia empresa: PDF fiscal
 *   POST /api/facturas/:id/emitir          admin
 *   POST /api/facturas/:id/enviar          admin
 *   POST /api/facturas/:id/reintentar      admin: emitir + enviar (lo que falte)
 *   POST /api/facturas/:id/anular          admin: { motivo }
 *   GET  /api/facturas/:id/estado-pac      admin: consulta al PAC
 *
 * Mounts on the main Express app (index.js): app.use('/api/facturas', facturasRouter);
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, effectiveRole } = require('../middleware/permissions');
const { serializeTimestamps } = require('../utils/serialize');
const { HttpError, responderError } = require('../utils/http_error');
const { textoError, trimOrNull } = require('../utils/validar_texto');
const F = require('../services/facturacion/facturas');

const router = Router();
const soloAdmin = [requireAuth, requirePermission('facturas.manage')];
const usuario = (req) => ({ uid: req.user.uid, email: req.user.email, demo: req.user.demo === true });

/**
 * La factura es visible para el admin (completa) o para la empresa receptora (solo si ya tiene CUFE y
 * sin campos internos: errores, uids, rutas de Storage).
 */
async function cargarVisible(req) {
  const { data } = await F.cargar(req.params.id);
  if (effectiveRole(req.user) === 'admin') return { id: req.params.id, ...data };
  if (!req.user.orgId || data.orgId !== req.user.orgId) throw new HttpError(403, { error: 'Esta factura no es de tu empresa.' });
  const vista = F.vistaCliente({ id: req.params.id, ...data });
  if (!vista) throw new HttpError(404, { error: 'Factura no encontrada' }); // todavía no emitida: para el cliente no existe
  return vista;
}

router.get('/', ...soloAdmin, async (req, res) => {
  try {
    const { estado, origen, limite } = req.query;
    if (estado && !F.ESTADOS.includes(estado)) return res.status(400).json({ error: `estado inválido (${F.ESTADOS.join(', ')})` });
    if (origen && !F.ORIGENES.includes(origen)) return res.status(400).json({ error: `origen inválido (${F.ORIGENES.join(', ')})` });
    res.json(serializeTimestamps({ facturas: await F.listar({ estado: estado || null, origen: origen || null, limite }) }));
  } catch (e) { responderError(res, e); }
});

router.get('/config', ...soloAdmin, async (req, res) => {
  try { res.json(serializeTimestamps(await F.leerConfig())); } catch (e) { responderError(res, e); }
});

router.put('/config', ...soloAdmin, async (req, res) => {
  try { res.json(serializeTimestamps(await F.guardarConfig(req.body || {}, usuario(req)))); } catch (e) { responderError(res, e); }
});

router.get('/sin-factura', ...soloAdmin, async (req, res) => {
  try { res.json(serializeTimestamps({ pagos: await F.pagosSinFactura(req.query.limite) })); } catch (e) { responderError(res, e); }
});

router.post('/desde-pagos', ...soloAdmin, async (req, res) => {
  try {
    const r = await F.facturarPagos({ caseId: req.body?.caseId, paymentIds: req.body?.paymentIds, usuario: usuario(req) });
    if (!r.id) return res.status(400).json({ error: `No se creó la factura: ${r.motivo || 'sin datos'}.` });
    const { data } = await F.cargar(r.id);
    res.status(r.creada ? 201 : 200).json(serializeTimestamps({ ...r, factura: { id: r.id, ...data } }));
  } catch (e) { responderError(res, e); }
});

// Barrido de lo que quedó a medias (workflows automáticos): lo llama Cloud Scheduler con un token de
// admin, o el botón de Finanzas. ?minutos= edad mínima sin actividad (default 2), ?limite= (default 20).
router.post('/procesar-pendientes', ...soloAdmin, async (req, res) => {
  try { res.json(await F.procesarPendientes({ minutos: req.query.minutos ?? req.body?.minutos, limite: req.query.limite ?? req.body?.limite })); } catch (e) { responderError(res, e); }
});

router.get('/mias', requireAuth, requirePermission('facturas.read_own'), async (req, res) => {
  try {
    if (!req.user.orgId) return res.status(400).json({ error: 'Tu cuenta no tiene empresa asociada.' });
    const facturas = (await F.listar({ orgId: req.user.orgId })).map(F.vistaCliente).filter(Boolean);
    res.json(serializeTimestamps({ facturas }));
  } catch (e) { responderError(res, e); }
});

router.get('/:id', requireAuth, requirePermission('facturas.read_own'), async (req, res) => {
  try { res.json(serializeTimestamps(await cargarVisible(req))); } catch (e) { responderError(res, e); }
});

router.get('/:id/pdf', requireAuth, requirePermission('facturas.read_own'), async (req, res) => {
  try {
    await cargarVisible(req);
    const { buffer, nombre } = await F.obtenerPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.descargar ? 'attachment' : 'inline'}; filename="${nombre}"`);
    res.send(buffer);
  } catch (e) { responderError(res, e); }
});

const accion = (fn) => async (req, res) => {
  try {
    const factura = await fn(req);
    res.json(serializeTimestamps({ id: req.params.id, ...factura }));
  } catch (e) {
    // Los rechazos esperados (400/409/422) ya quedan en la factura (`errores`); al log solo lo inesperado.
    if (!(e instanceof HttpError) || e.status >= 500) console.error('[facturas]', req.path, { id: req.params.id, uid: req.user?.uid, error: e.message });
    responderError(res, e);
  }
};

router.post('/:id/emitir',     ...soloAdmin, accion(req => F.emitir(req.params.id, { usuario: usuario(req) })));
router.post('/:id/enviar',     ...soloAdmin, accion(req => F.enviar(req.params.id, { usuario: usuario(req) })));
router.post('/:id/reintentar', ...soloAdmin, accion(req => F.ejecutar(req.params.id, { usuario: usuario(req) })));
router.post('/:id/anular',     ...soloAdmin, accion(async (req) => {
  const error = textoError('El motivo', req.body?.motivo, 200, true);
  if (error) throw new HttpError(400, { error });
  return F.anular(req.params.id, trimOrNull(req.body.motivo), { usuario: usuario(req) });
}));

router.get('/:id/estado-pac', ...soloAdmin, async (req, res) => {
  try { res.json(serializeTimestamps(await F.estadoEnPac(req.params.id))); } catch (e) { responderError(res, e); }
});

module.exports = router;

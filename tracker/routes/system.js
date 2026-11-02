/**
 * system.js — Endpoints de "Configuración" del back-office.
 *
 *   GET /api/admin/estado  → estado de los servicios (pagos, facturación, correo, demo, versión),
 *                            solo para el admin (`system.estado`). Nunca devuelve credenciales.
 *
 * Historia: hasta el 02-nov-2026 aquí vivía el mapa interactivo del código (graphify, TAREA 41b);
 * Rick pidió retirarlo del todo y convertir Configuración en una sección normal de perfil,
 * seguridad, idioma y ayuda (ver farmazed-web/admin/configuracion.html).
 */
const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { resolverProveedorPagos, esProduccion } = require('../config');
const { proveedorActual } = require('../services/facturacion/pac');
const { correoConfigurado } = require('../services/correo');
const { CUENTAS } = require('../services/demo');
const PAQUETE = require('../package.json');

const router = Router();

router.get('/estado', requireAuth, requirePermission('system.estado'), (req, res) => {
  const env = process.env;
  let pagos = { proveedor: 'desconocido', entorno: null };
  try { pagos = { proveedor: resolverProveedorPagos(env), entorno: env.PAYPAL_ENV || null }; } catch (e) { /* config inválida: se informa como desconocido */ }
  res.json({
    version: PAQUETE.version,
    revision: env.K_REVISION || null,
    entorno: esProduccion(env) ? 'produccion' : 'local',
    pagos,
    facturacion: { proveedor: proveedorActual() },
    correo: { configurado: correoConfigurado(), remitente: correoConfigurado() ? (env.SMTP_FROM || env.SMTP_USER || null) : null },
    demo: { cuentas: CUENTAS.map(c => ({ correo: c.correo, rol: c.role })) },
  });
});

module.exports = router;

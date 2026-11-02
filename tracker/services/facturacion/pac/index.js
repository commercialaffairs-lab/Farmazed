/**
 * pac/index.js — Elige el PAC (proveedor autorizado de facturación electrónica): EBI-PAC real o el
 * simulado. Misma regla que services/payments/index.js: las cuentas demo SIEMPRE usan el mock; el
 * resto lo decide config.js (resolverProveedorFacturacion) en cada llamada, para que las pruebas
 * puedan cambiar el entorno.
 */
const { resolverProveedorFacturacion } = require('../../../config');

/** @returns {{ nombre: string, emitir, estado, descargarPdf, anular }} */
function getPac({ demo = false } = {}) {
  if (demo) return require('./mock');
  const proveedor = resolverProveedorFacturacion(process.env);
  if (proveedor === 'ebi_pac') return require('./ebi_pac');
  if (proveedor === 'mock') return require('./mock');
  throw new Error('La facturación electrónica no está configurada (faltan EBI_TOKEN_USUARIO y EBI_TOKEN_PASSWORD).');
}

/** 'mock' | 'ebi_pac' | 'desactivado' — para mostrarlo en la configuración del admin. */
function proveedorActual() {
  try { return resolverProveedorFacturacion(process.env); } catch (e) { return 'desactivado'; }
}

module.exports = { getPac, proveedorActual };

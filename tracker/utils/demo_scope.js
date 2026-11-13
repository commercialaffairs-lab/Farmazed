/**
 * demo_scope.js — Qué es "de la demo" y quién es el admin demo (TAREA 64). Módulo sin dependencias: lo usan
 * middleware/auth.js, middleware/permissions.js, las rutas y services/demo.js sin crear ciclos de require.
 */
const DEMO_ORG_ID = 'demo-org';

/** Claim demo:true + rol admin (o el claim legacy admin:true). */
const esAdminDemo = (user) => user?.demo === true && (user.role === 'admin' || user.admin === true);

/** ¿Este documento (caso, cotización, factura, empresa, lead…) es de la demo? demo:true o de la empresa demo. */
const esDocDemo = (doc) => doc?.demo === true || doc?.orgId === DEMO_ORG_ID;

module.exports = { DEMO_ORG_ID, esAdminDemo, esDocDemo };

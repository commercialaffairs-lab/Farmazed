/**
 * demo_scope.js — Qué es "de la demo" y quién es el admin demo (TAREA 64), ampliado con la cuenta de
 * SIMULACIÓN (Rick, 14-nov-2026): un segundo ámbito aislado (`sim-org`) para entrenar al personal.
 * Módulo sin dependencias: lo usan middleware/auth.js, middleware/permissions.js, las rutas y
 * services/demo.js sin crear ciclos de require.
 *
 * Dos ámbitos aislados, misma base de datos, nunca se ven entre sí ni ven lo real:
 *   - `demo-org`: las 5 cuentas *.demo@ (prospectos y empleados nuevos). El personal demo no tiene orgId.
 *   - `sim-org`:  la cuenta `simulacion@` (claims demo:true + simulacion:true + orgId sim-org): una sola
 *     cuenta que cambia de PERFIL (cliente_titular | admin | regente | abogado) con la cabecera
 *     `X-Fz-Perfil` (middleware/auth.js) y recorre el flujo de la A a la Z sobre los mismos datos.
 */
const DEMO_ORG_ID = 'demo-org';
const SIM_ORG_ID = 'sim-org';
const ORGS_AISLADAS = [DEMO_ORG_ID, SIM_ORG_ID];

/** Perfiles que la cuenta de simulación puede adoptar (cabecera X-Fz-Perfil). */
const PERFILES_SIMULACION = ['cliente_titular', 'admin', 'regente', 'abogado'];

/** Cuenta de alguna demo (claim demo:true): las 5 cuentas demo y la de simulación. */
const esCuentaDemo = (user) => user?.demo === true;

/** La cuenta de simulación (claim simulacion:true además de demo:true). */
const esSimulacion = (user) => user?.demo === true && user?.simulacion === true;

/** Claim demo:true + rol admin (o el claim legacy admin:true). Incluye la simulación con el perfil admin. */
const esAdminDemo = (user) => user?.demo === true && (user.role === 'admin' || user.admin === true);

/**
 * Ámbito aislado de una cuenta demo: su empresa si es una de las aisladas (la simulación trae orgId
 * sim-org), si no `demo-org` (el personal demo no tiene orgId). null para una cuenta real.
 */
const ambitoDe = (user) => (esCuentaDemo(user) ? (ORGS_AISLADAS.includes(user.orgId) ? user.orgId : DEMO_ORG_ID) : null);

/** ¿Este documento (caso, cotización, factura, empresa, lead…) es de ALGUNA demo (no es real)? */
const esDocDemo = (doc) => doc?.demo === true || ORGS_AISLADAS.includes(doc?.orgId);

/**
 * ¿Este documento pertenece al ámbito de ESTA cuenta demo? Con orgId se compara la empresa; sin orgId
 * (leads) decide la marca `sim:true` (los de la simulación la llevan, los de la demo no). false para
 * una cuenta real (que no tiene ámbito): quien llama decide si ve todo (ver visibleParaDemo en demo.js).
 */
function esDocDelAmbito(user, doc) {
  const ambito = ambitoDe(user);
  if (!ambito || !doc) return false;
  if (doc.orgId) return doc.orgId === ambito;
  return doc.demo === true && (doc.sim === true) === (ambito === SIM_ORG_ID);
}

module.exports = { DEMO_ORG_ID, SIM_ORG_ID, ORGS_AISLADAS, PERFILES_SIMULACION, esCuentaDemo, esSimulacion, esAdminDemo, ambitoDe, esDocDemo, esDocDelAmbito };

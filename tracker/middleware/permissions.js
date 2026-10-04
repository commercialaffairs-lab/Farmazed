/**
 * permissions.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * ÚNICA fuente de verdad de "qué rol puede qué" — nada de ifs de rol
 * sueltos por las rutas. Toda ruta que necesite un gate de rol llama a
 * `requirePermission(nombre)` (Express middleware) o a `can(role, nombre)`
 * (chequeo puntual dentro de un handler, cuando el permiso depende también
 * del CONTENIDO de la petición, no solo de la ruta — ver `canTransitionCase`
 * para el modelo de 13 fases, §H.8).
 *
 * ── Roles (6, + orgId en el claim para los de cliente) ───────────────────────
 *   cliente_titular  — dueño de la cuenta de la empresa.
 *   cliente_miembro  — empleado de la empresa cliente.
 *   analista         — empleado Farmazed, mueve el status de todas las
 *                      fases (incluidas fase_08 y fase_10, una vez que sus
 *                      confirmaciones/controles están completos).
 *   abogado          — empleado Farmazed, registra la confirmación LEGAL de
 *                      la fase 8 (una de las dos que exige, §H.8).
 *   regente          — farmacéutica regente, registra la confirmación
 *                      TÉCNICA/matrices de la fase 8 (la otra de las dos).
 *   admin            — dirección; todo lo anterior + override, pagos,
 *                      precios, asignar casos, gestionar empresas/empleados.
 *
 * ── Compatibilidad con cuentas sin migrar ────────────────────────────────────
 * Las cuentas creadas antes de esta tarea solo tienen el claim legacy
 * `admin: boolean` (sin `role`). `effectiveRole()` las traduce sin tocar su
 * comportamiento: `admin:true` → 'admin', cualquier otra cosa → 'cliente_titular'
 * (que es exactamente lo que un cliente sin `role` ya podía hacer: crear y
 * leer sus propios casos por `clientId`). Correr `scripts/migrate_roles.js`
 * les asigna el claim `role` real — después de eso, `effectiveRole()` lee
 * ese claim directo y dejan de pasar por el fallback.
 *
 * TAREA 39: el fallback `admin:true → 'admin'` se mantiene, pero una cuenta sin
 * role ni admin YA NO cae a 'cliente_titular': es `null` (403 en todo permiso).
 * Hay que correr migrate_roles.js sobre las cuentas viejas ANTES de desplegar.
 */

const admin = require('firebase-admin');

const ROLES = ['cliente_titular', 'cliente_miembro', 'analista', 'abogado', 'regente', 'admin'];
const CLIENT_ROLES = ['cliente_titular', 'cliente_miembro'];
const STAFF_ROLES  = ['analista', 'abogado', 'regente'];

// TAREA 39 (C4): una cuenta SIN `role` (y sin el claim legacy `admin`) ya no es
// cliente_titular por defecto — es `null` y requirePermission la rechaza (403).
// Registro e invitación siempre dejan `role` puesto, y scripts/migrate_roles.js
// (corrido sobre las cuentas anteriores a E3) les asigna el suyo.
function effectiveRole(user) {
  if (user.role && ROLES.includes(user.role)) return user.role;
  return user.admin ? 'admin' : null;
}

/**
 * Tabla única endpoint/acción × rol (PM_COMMENTS §H.4). `label` es la
 * descripción que sale en la tabla generada (organizacion/09_TABLA_PERMISOS.md).
 * Todas las filas son de solo-ADITIVO: si un rol no está listado, no puede.
 *
 * `pricing.write` (TAREA 15/E3 parte 2): antes `pricing.js` usaba
 * `x-admin-key` por header, su propio login separado en
 * `admin/precios.html` — se migró a token de Firebase con rol admin
 * (ver tracker/routes/pricing.js).
 *
 * `admin.set_role` (TAREA 16(a)): `POST /api/admin/set-role` usaba
 * `ADMIN_KEY` por header — cualquiera con la clave se volvía admin sin
 * invitación ni auditoría, una puerta trasera al modelo de roles. Ahora
 * exige token de Firebase + este permiso (solo admin) y cada uso queda en
 * `adminAuditLog` (ver tracker/index.js). Dar el PRIMER admin (cuando
 * todavía no existe ninguno) ya no pasa por HTTP — ver
 * `scripts/bootstrap_admin.js`, credenciales de GCP por línea de comandos.
 * `ADMIN_KEY` queda sin ningún lector en el código tras este cambio — la
 * variable de entorno en Cloud Run no se tocó (fuera del alcance de esta
 * tarea; se puede retirar cuando Rick confirme que nada más la necesita).
 */
const PERMISSIONS = {
  'cases.create':          { label: 'Crear un caso',                              roles: ['cliente_titular', 'cliente_miembro', 'admin'] },
  'cases.list':            { label: 'Listar casos (filtrado por org/asignación)', roles: ROLES },
  'cases.read':            { label: 'Leer un caso (si tiene acceso a ese caso)',  roles: ROLES },
  'cases.read_history':    { label: 'Ver el historial de estado de un caso',      roles: ROLES },
  'cases.read_checklist':  { label: 'Ver el checklist de documentos de un caso',  roles: ROLES },
  'cases.update_fields':   { label: 'Editar datos del caso (producto/entidades, en borrador)', roles: ['cliente_titular', 'cliente_miembro', 'admin'] },
  'cases.edit_faddi':      { label: 'Editar el seguimiento FADDI (N° expediente/solicitud, observaciones)', roles: [...STAFF_ROLES, 'admin'] },
  'cases.edit_notes':      { label: 'Editar las notas internas del caso',         roles: [...STAFF_ROLES, 'admin'] },
  // TAREA 26: fase_03 ("Tipo de registro sanitario y ruta de registro",
  // §H.8) la confirma Farmazed, no el cliente — vía (tipoRegistro),
  // categoría (tipoMedicamento) y ahora esInnovador se editan juntos.
  'cases.edit_via_categoria': { label: 'Confirmar vía, categoría, representación y si el producto es innovador (fase 3)', roles: [...STAFF_ROLES, 'admin'] },
  'cases.advance':         { label: 'Avanzar fases secuenciales (no 8, no 10)',   roles: ['analista', 'admin'] },
  'cases.confirm_8_legal':   { label: 'Fase 8 — confirmar revisión legal (poderes/declaraciones)', roles: ['abogado', 'admin'] },
  'cases.confirm_8_tecnica': { label: 'Fase 8 — confirmar cotejo técnico/matrices', roles: ['regente', 'admin'] },
  'cases.confirm_10':      { label: 'Confirmar Fase 10 — Recepción y verificación de originales', roles: ['analista', 'admin'] },
  'cases.override':        { label: 'Forzar una transición fuera del mapa (override)', roles: ['admin'] },
  'cases.assign':          { label: 'Asignar analista/abogado/regente a un caso', roles: ['admin'] },
  'cases.delete':          { label: 'Eliminar (soft delete) un caso',            roles: ['admin'] },
  'documents.upload':      { label: 'Subir un documento (cliente)',              roles: ['cliente_titular', 'cliente_miembro', 'admin'] },
  'documents.request':     { label: 'Solicitar un documento al cliente',         roles: ['analista', 'abogado', 'regente', 'admin'] },
  'documents.review':      { label: 'Aprobar/rechazar un documento',            roles: ['analista', 'abogado', 'regente', 'admin'] },
  'documents.read':        { label: 'Ver/descargar un documento del caso',       roles: ROLES },
  'documents.delete':      { label: 'Borrar un documento propio',                roles: ['cliente_titular', 'cliente_miembro', 'admin'] },
  'payments.create':       { label: 'Registrar un pago',                        roles: ['admin'] },
  'payments.read':         { label: 'Ver los pagos de un caso',                 roles: ROLES },
  'messages.send':         { label: 'Enviar un mensaje en el caso',             roles: ROLES },
  'messages.read':         { label: 'Leer los mensajes de un caso',             roles: ROLES },
  'formularios.read':      { label: 'Ver/descargar la biblioteca de formularios (R14)', roles: ROLES },
  'quotes.read':           { label: 'Ver una cotización (la de su propia empresa, o cualquiera si es admin) (R5/R12)', roles: ['cliente_titular', 'cliente_miembro', 'admin'] },
  'quotes.edit':           { label: 'Ajustar las líneas de una cotización en borrador (R5/R12)', roles: ['admin'] },
  'quotes.send':           { label: 'Enviar una cotización al cliente (R5/R12)', roles: ['admin'] },
  'quotes.accept':         { label: 'Aceptar o rechazar una cotización enviada (R5/R12)', roles: ['cliente_titular'] },
  // TAREA 33 (§H.14): mismo criterio que quotes.accept — quien paga es el
  // dueño de la cuenta, no un miembro.
  'quotes.pay':            { label: 'Pagar con PayPal una cotización aceptada (§H.14)', roles: ['cliente_titular'] },
  // Plan recurrente de uso de la plataforma — el admin lo define/edita; el
  // titular se suscribe/cancela para SU empresa. Ver estado en
  // GET /api/me/org (ya devuelve el doc completo de la empresa).
  'subscription.manage_plan': { label: 'Crear/editar el plan recurrente de suscripción', roles: ['admin'] },
  'subscription.subscribe':   { label: 'Suscribir/cancelar la suscripción de mi empresa', roles: ['cliente_titular'] },
  'pricing.write':         { label: 'Editar el tarifario',                      roles: ['admin'] },
  // TAREA 35: listar empresas (solo lectura) ahora lo necesita el staff
  // para llegar a "Cargar diagnóstico" en admin/empresas.html — separado de
  // orgs.manage (crear una empresa directa y ver sus miembros, eso sigue
  // siendo solo admin) para no abrirle de más al staff.
  'orgs.list':             { label: 'Listar las empresas (sin crear ni ver miembros)', roles: [...STAFF_ROLES, 'admin'] },
  'orgs.manage':           { label: 'Crear una empresa directamente y ver sus miembros', roles: ['admin'] },
  'orgs.read_members':     { label: 'Ver los miembros de una empresa',          roles: ['cliente_titular', 'cliente_miembro', 'admin'] },
  // TAREA 32 (§H.13): "Captación de información preliminar" (Fase 2 de
  // Zelky) — la llena el titular (es quien registró la empresa), no el
  // miembro; admin puede corregirla a mano si hace falta.
  'orgs.edit_captacion':   { label: 'Completar/editar la captación de información preliminar de la empresa', roles: ['cliente_titular', 'admin'] },
  // Ver el lead nuevo en la bandeja y marcarlo revisado — mismo permiso
  // para ambas acciones, es triage liviano, no una confirmación con
  // separación de roles como la de fase_08.
  'orgs.read_leads':       { label: 'Ver y marcar revisados los clientes nuevos (captación) en la bandeja', roles: [...STAFF_ROLES, 'admin'] },
  'employees.list':        { label: 'Listar empleados de Farmazed',             roles: ['admin'] },
  'invitations.create_org':      { label: 'Invitar a un titular (crea empresa)', roles: ['admin'] },
  'invitations.create_empleado': { label: 'Invitar a un empleado Farmazed',      roles: ['admin'] },
  'invitations.create_miembro':  { label: 'Invitar a un miembro de mi empresa',  roles: ['cliente_titular'] },
  'invitations.read':            { label: 'Ver el estado de las invitaciones',  roles: ['admin'] },
  'admin.set_role':              { label: 'Dar/quitar el rol admin a una cuenta existente', roles: ['admin'] },

  // TAREA 34 (§H.15): tres flujos de alta desde los planes del landing.
  'orgs.set_plan':         { label: 'Elegir/subir el plan de mi empresa (consulta/registro/empresarial)', roles: ['cliente_titular'] },
  // El staff carga el diagnóstico (Plan Consulta) desde el expediente/empresa.
  'orgs.edit_diagnostico': { label: 'Cargar/editar el diagnóstico regulatorio de una empresa (Plan Consulta)', roles: [...STAFF_ROLES, 'admin'] },
  // Leads del formulario "Enviar consulta" del hero — SIN cuenta todavía,
  // por eso es un permiso aparte de orgs.read_leads (esos ya tienen cuenta
  // y captación completada).
  'contact_leads.read':    { label: 'Ver los mensajes del formulario de contacto público',  roles: [...STAFF_ROLES, 'admin'] },
  'empresarial.solicitar': { label: 'Enviar/aceptar la solicitud de propuesta del Plan Empresarial', roles: ['cliente_titular'] },
  'empresarial.manage':    { label: 'Definir condiciones (monto/período/gestor) del Plan Empresarial', roles: ['admin'] },
  // TAREA 41b: el grafo del código expone la ESTRUCTURA interna del backend — solo admin, nunca público.
  'system.code_graph':     { label: 'Ver el mapa interactivo del código (página Configuración)', roles: ['admin'] },
};

// No están en la tabla, a propósito: `GET /api/invitations/:token` es PÚBLICA
// (la página de aceptar necesita saber a qué correo corresponde el link) y
// `POST /api/invitations/:token/accept` exige sesión pero NO un rol (quien
// acepta todavía no tiene ninguno; TAREA 39: el uid sale del token y el correo
// debe ser el de la invitación) — no hay rol que pedir. `GET /api/me/permissions` tampoco: es reflexiva ("quién soy"), no
// una acción que se pueda permitir o no. `pricing.js` (lectura pública de
// `GET /api/admin/pricing`) tampoco necesita permiso — los precios no son
// secretos.

/**
 * Lista de permisos que tiene un rol — usado por GET /api/me/permissions
 * (TAREA 15/E3 parte 2) para que el FRONT nunca repita esta tabla: pregunta
 * qué puede, no decide con sus propios ifs de rol.
 */
function permissionsForRole(role) {
  return Object.entries(PERMISSIONS).filter(([, perm]) => perm.roles.includes(role)).map(([key]) => key);
}

function can(role, permissionName) {
  const perm = PERMISSIONS[permissionName];
  if (!perm) throw new Error(`permissions.js: permiso desconocido "${permissionName}"`);
  return perm.roles.includes(role);
}

/**
 * Express middleware — 403 si el rol EFECTIVO del usuario no está en la
 * tabla para `permissionName`. Debe correr después de `requireAuth`.
 */
function requirePermission(permissionName) {
  return (req, res, next) => {
    const role = effectiveRole(req.user);
    if (!role) {
      return res.status(403).json({ error: 'Tu cuenta no tiene un rol asignado — contacta a Farmazed.' });
    }
    if (!can(role, permissionName)) {
      return res.status(403).json({ error: `Rol "${role}" no puede: ${PERMISSIONS[permissionName]?.label || permissionName}` });
    }
    next();
  };
}

/**
 * ¿Puede este usuario ver/tocar ESTE caso? (ownership/asignación — más fino
 * que la tabla de arriba, que solo dice si el rol puede llamar al endpoint
 * EN GENERAL). Reemplaza el chequeo `data.clientId !== user.uid` repetido en
 * cases.js/documents.js/messages.js/payments.js.
 */
function canAccessCase(user, caseData) {
  const role = effectiveRole(user);
  if (role === 'admin') return true;
  if (CLIENT_ROLES.includes(role)) {
    // Cuenta migrada (tiene orgId): el caso debe ser de su empresa.
    if (user.orgId) return caseData.orgId === user.orgId;
    // Cuenta sin migrar (compat): mismo criterio de siempre, por clientId.
    return caseData.clientId === user.uid;
  }
  if (STAFF_ROLES.includes(role)) {
    return caseData.asignados?.[role] === user.uid;
  }
  return false;
}

/**
 * Trae el caso y verifica que existe y que el usuario tiene acceso (404 / 403
 * ya respondidos si no). TAREA 39: UNA sola versión — antes eran copias en
 * documents.js/messages.js/payments.js, y el PATCH de revisión de documentos
 * no la llamaba (un staff no asignado podía aprobar/rechazar documentos de
 * cualquier caso). Devuelve `{ id, ...data }` o `null` si ya respondió.
 */
async function getCaseOrFail(caseId, user, res) {
  const snap = await admin.firestore().collection('cases').doc(caseId).get();
  if (!snap.exists) { res.status(404).json({ error: 'Case not found' }); return null; }
  const data = snap.data();
  if (!canAccessCase(user, data)) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return { id: snap.id, ...data };
}

/**
 * ¿Puede este rol de STAFF (analista/abogado/regente) mover el caso de
 * `from` a `to`? El admin no pasa por aquí (bypass en cases.js/mcp.js — ya
 * puede cualquier salto válido, y override cualquiera). No decide si el
 * SALTO en sí es válido (eso lo sigue haciendo isValidTransition()), ni si
 * las CONFIRMACIONES de fase_08 ya están completas (eso lo hace el gate de
 * cases.js, `hasFase8Confirmaciones()`) — solo si ESTE rol tiene permiso
 * para pedir el cambio de status.
 *
 * Regla (§H.8, reemplaza §H.4 en este punto): fase_08 exige DOS
 * confirmaciones (legal=abogado, técnica/matrices=regente) ANTES de poder
 * avanzar, pero quien mueve el status (incluida la propia subsanación
 * fase_08->fase_08) es el analista — igual que fase_10, que la confirma el
 * analista solo. Ningún rol de staff que no sea analista mueve un status
 * directamente; abogado/regente solo registran su confirmación (endpoint
 * separado, `POST /api/cases/:id/confirmaciones/fase8`).
 */
function canTransitionCase(role) {
  return role === 'analista';
}

/**
 * Genera la tabla en Markdown (organizacion/09_TABLA_PERMISOS.md la escribe
 * scripts/generate_permissions_doc.js llamando a esta función — nunca a
 * mano, para que documento y código nunca diverjan).
 */
function generateMarkdownTable() {
  const header = `| Acción | ${ROLES.join(' | ')} |`;
  const sep    = `|---|${ROLES.map(() => ':---:').join('|')}|`;
  const rows = Object.entries(PERMISSIONS).map(([key, perm]) => {
    const cells = ROLES.map(r => perm.roles.includes(r) ? '✅' : '—');
    return `| ${perm.label} (\`${key}\`) | ${cells.join(' | ')} |`;
  });
  return [header, sep, ...rows].join('\n');
}

module.exports = {
  ROLES,
  CLIENT_ROLES,
  STAFF_ROLES,
  PERMISSIONS,
  effectiveRole,
  can,
  permissionsForRole,
  requirePermission,
  canAccessCase,
  getCaseOrFail,
  canTransitionCase,
  generateMarkdownTable,
};

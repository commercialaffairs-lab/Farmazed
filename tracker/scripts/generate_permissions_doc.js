/**
 * generate_permissions_doc.js — E3 parte 1 (backend), PM_COMMENTS §H.4.
 *
 * Escribe organizacion/09_TABLA_PERMISOS.md a partir de
 * middleware/permissions.js — NUNCA a mano, para que documento y código no
 * puedan divergir. Correr de nuevo cada vez que la tabla PERMISSIONS cambie.
 *
 * Uso: node scripts/generate_permissions_doc.js
 */

const fs   = require('fs');
const path = require('path');
const { ROLES, generateMarkdownTable } = require('../middleware/permissions');

const OUT_PATH = path.join(__dirname, '..', '..', 'organizacion', '09_TABLA_PERMISOS.md');

const doc = `# 09 — Tabla de permisos (E3, generada desde el código)

**Generado automáticamente por \`tracker/scripts/generate_permissions_doc.js\` a partir de
\`tracker/middleware/permissions.js\` — no editar a mano, correr el script de nuevo.**

Fuente de la especificación: PM_COMMENTS.md §H.4 (29-sep). Roles: ${ROLES.join(', ')}.

No incluye \`GET /api/admin/pricing\` (lectura, público a propósito — los precios no son
secretos), \`GET/POST /api/invitations/:token(/accept)\` (públicas sin auth, por diseño:
quien acepta una invitación todavía no tiene cuenta) ni \`GET /api/me/permissions\`
(reflexiva — "quién soy", no una acción que se permita o no). \`PATCH
/api/admin/pricing/:categoryId\` SÍ está en la tabla (\`pricing.write\`) desde TAREA 15.

${generateMarkdownTable()}

## Reglas adicionales (no caben en una tabla rol × endpoint, dependen del CASO)

- **Ownership/asignación** (\`canAccessCase\`, en \`middleware/permissions.js\`): un
  \`cliente_titular\`/\`cliente_miembro\` solo ve casos de su \`orgId\`; un
  \`analista\`/\`abogado\`/\`regente\` solo ve casos donde \`asignados.<rol> === su uid\`. El
  admin ve todo. Ninguno de los dos filtros anteriores está en la tabla de arriba porque
  no es "puede llamar al endpoint", es "puede ver ESTE caso" — ambos aplican juntos.
- **Confirmación de fase por rol** (\`canTransitionCase\`, en \`middleware/permissions.js\`,
  §H.8/TAREA 21): el ANALISTA es el único que mueve el status del caso en cualquier fase
  (incluidas fase_08 y fase_10, las dos únicas manuales) — el admin no tiene esta
  restricción. Abogado/regente no mueven status directamente; solo registran su propia
  confirmación de fase_08 (\`cases.confirm_8_legal\`/\`cases.confirm_8_tecnica\`, endpoint
  \`POST /api/cases/:id/confirmaciones/fase8\`) — fase_08 exige AMBAS antes de que el
  analista pueda avanzarla a fase_09.
- **Override** (\`cases.override\`): además de ser solo-admin, cada uso queda registrado en
  \`cases/{id}/statusHistory\` con el motivo — ver TAREA 7b/§H.1.
- **\`admin.set_role\`** (TAREA 16(a)): cada uso (dar o quitar el rol admin a una cuenta)
  queda en \`adminAuditLog\` con quién lo hizo y a quién — antes era \`x-admin-key\`, sin
  ningún registro de quién lo usaba. El PRIMER admin (cuando todavía no existe ninguno
  para invitar) se da con \`tracker/scripts/bootstrap_admin.js\` (credenciales de GCP por
  línea de comandos), nunca por HTTP.
`;

fs.writeFileSync(OUT_PATH, doc, 'utf8');
console.log(`✅ Escrito ${OUT_PATH}`);

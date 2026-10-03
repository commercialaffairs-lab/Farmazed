# 09 — Tabla de permisos (E3, generada desde el código)

**Generado automáticamente por `tracker/scripts/generate_permissions_doc.js` a partir de
`tracker/middleware/permissions.js` — no editar a mano, correr el script de nuevo.**

Fuente de la especificación: PM_COMMENTS.md §H.4 (29-sep). Roles: cliente_titular, cliente_miembro, analista, abogado, regente, admin.

No incluye `GET /api/admin/pricing` (lectura, público a propósito — los precios no son
secretos), `GET/POST /api/invitations/:token(/accept)` (públicas sin auth, por diseño:
quien acepta una invitación todavía no tiene cuenta) ni `GET /api/me/permissions`
(reflexiva — "quién soy", no una acción que se permita o no). `PATCH
/api/admin/pricing/:categoryId` SÍ está en la tabla (`pricing.write`) desde TAREA 15.

| Acción | cliente_titular | cliente_miembro | analista | abogado | regente | admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Crear un caso (`cases.create`) | ✅ | ✅ | — | — | — | ✅ |
| Listar casos (filtrado por org/asignación) (`cases.list`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leer un caso (si tiene acceso a ese caso) (`cases.read`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver el historial de estado de un caso (`cases.read_history`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver el checklist de documentos de un caso (`cases.read_checklist`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar datos del caso (producto/entidades, en borrador) (`cases.update_fields`) | ✅ | ✅ | — | — | — | ✅ |
| Editar el seguimiento FADDI (N° expediente/solicitud, observaciones) (`cases.edit_faddi`) | — | — | ✅ | ✅ | ✅ | ✅ |
| Editar las notas internas del caso (`cases.edit_notes`) | — | — | ✅ | ✅ | ✅ | ✅ |
| Confirmar vía, categoría, representación y si el producto es innovador (fase 3) (`cases.edit_via_categoria`) | — | — | ✅ | ✅ | ✅ | ✅ |
| Avanzar fases secuenciales (no 8, no 10) (`cases.advance`) | — | — | ✅ | — | — | ✅ |
| Fase 8 — confirmar revisión legal (poderes/declaraciones) (`cases.confirm_8_legal`) | — | — | — | ✅ | — | ✅ |
| Fase 8 — confirmar cotejo técnico/matrices (`cases.confirm_8_tecnica`) | — | — | — | — | ✅ | ✅ |
| Confirmar Fase 10 — Recepción y verificación de originales (`cases.confirm_10`) | — | — | ✅ | — | — | ✅ |
| Forzar una transición fuera del mapa (override) (`cases.override`) | — | — | — | — | — | ✅ |
| Asignar analista/abogado/regente a un caso (`cases.assign`) | — | — | — | — | — | ✅ |
| Eliminar (soft delete) un caso (`cases.delete`) | — | — | — | — | — | ✅ |
| Subir un documento (cliente) (`documents.upload`) | ✅ | ✅ | — | — | — | ✅ |
| Solicitar un documento al cliente (`documents.request`) | — | — | ✅ | ✅ | ✅ | ✅ |
| Aprobar/rechazar un documento (`documents.review`) | — | — | ✅ | ✅ | ✅ | ✅ |
| Ver/descargar un documento del caso (`documents.read`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Borrar un documento propio (`documents.delete`) | ✅ | ✅ | — | — | — | ✅ |
| Registrar un pago (`payments.create`) | — | — | — | — | — | ✅ |
| Ver los pagos de un caso (`payments.read`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enviar un mensaje en el caso (`messages.send`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leer los mensajes de un caso (`messages.read`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver/descargar la biblioteca de formularios (R14) (`formularios.read`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver una cotización (la de su propia empresa, o cualquiera si es admin) (R5/R12) (`quotes.read`) | ✅ | ✅ | — | — | — | ✅ |
| Ajustar las líneas de una cotización en borrador (R5/R12) (`quotes.edit`) | — | — | — | — | — | ✅ |
| Enviar una cotización al cliente (R5/R12) (`quotes.send`) | — | — | — | — | — | ✅ |
| Aceptar o rechazar una cotización enviada (R5/R12) (`quotes.accept`) | ✅ | — | — | — | — | — |
| Editar el tarifario (`pricing.write`) | — | — | — | — | — | ✅ |
| Crear/editar empresas (`orgs.manage`) | — | — | — | — | — | ✅ |
| Ver los miembros de una empresa (`orgs.read_members`) | ✅ | ✅ | — | — | — | ✅ |
| Listar empleados de Farmazed (`employees.list`) | — | — | — | — | — | ✅ |
| Invitar a un titular (crea empresa) (`invitations.create_org`) | — | — | — | — | — | ✅ |
| Invitar a un empleado Farmazed (`invitations.create_empleado`) | — | — | — | — | — | ✅ |
| Invitar a un miembro de mi empresa (`invitations.create_miembro`) | ✅ | — | — | — | — | — |
| Ver el estado de las invitaciones (`invitations.read`) | — | — | — | — | — | ✅ |
| Dar/quitar el rol admin a una cuenta existente (`admin.set_role`) | — | — | — | — | — | ✅ |

## Reglas adicionales (no caben en una tabla rol × endpoint, dependen del CASO)

- **Ownership/asignación** (`canAccessCase`, en `middleware/permissions.js`): un
  `cliente_titular`/`cliente_miembro` solo ve casos de su `orgId`; un
  `analista`/`abogado`/`regente` solo ve casos donde `asignados.<rol> === su uid`. El
  admin ve todo. Ninguno de los dos filtros anteriores está en la tabla de arriba porque
  no es "puede llamar al endpoint", es "puede ver ESTE caso" — ambos aplican juntos.
- **Confirmación de fase por rol** (`canTransitionCase`, en `middleware/permissions.js`,
  §H.8/TAREA 21): el ANALISTA es el único que mueve el status del caso en cualquier fase
  (incluidas fase_08 y fase_10, las dos únicas manuales) — el admin no tiene esta
  restricción. Abogado/regente no mueven status directamente; solo registran su propia
  confirmación de fase_08 (`cases.confirm_8_legal`/`cases.confirm_8_tecnica`, endpoint
  `POST /api/cases/:id/confirmaciones/fase8`) — fase_08 exige AMBAS antes de que el
  analista pueda avanzarla a fase_09.
- **Override** (`cases.override`): además de ser solo-admin, cada uso queda registrado en
  `cases/{id}/statusHistory` con el motivo — ver TAREA 7b/§H.1.
- **`admin.set_role`** (TAREA 16(a)): cada uso (dar o quitar el rol admin a una cuenta)
  queda en `adminAuditLog` con quién lo hizo y a quién — antes era `x-admin-key`, sin
  ningún registro de quién lo usaba. El PRIMER admin (cuando todavía no existe ninguno
  para invitar) se da con `tracker/scripts/bootstrap_admin.js` (credenciales de GCP por
  línea de comandos), nunca por HTTP.

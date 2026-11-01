# Pendientes de Farmazed

Estado al 04-oct-2026, después de cerrar el plan de auditoría (TAREAS 36–43).
Detalle técnico de cada tarea en `handover.md`. PayPal paso a paso en `PAYPAL_SETUP.md`.

## Hecho en esta ronda (TAREAS 30–43, todo en este push)

- **4 fallas críticas cerradas:**
  - XSS en el admin.
  - El proveedor de pago simulado ya no se activa en producción.
  - El cobro de cotizaciones es atómico, sin doble cobro.
  - La invitación ya no se puede aceptar a nombre de otro.
- **Acceso:**
  - Las cuentas sin rol reciben 403.
  - El cliente ya no ve las notas internas ni el historial interno.
  - Las sesiones revocadas dejan de valer al instante.
- **PayPal:**
  - Clave de idempotencia (`PayPal-Request-Id`).
  - Validación de variables al arrancar: sin ellas, el tracker no arranca en producción.
- **Pruebas:**
  - 23 suites de backend (`npm test`) y 31 pruebas de pantalla (e2e), en verde.
  - Corren sin apagar la demo.
- **Página Configuración en el admin** con el mapa interactivo del código (solo admin).
- **Limpieza:**
  - Se quitaron 4 dependencias sin uso y el código muerto.
  - Se unificaron las funciones repetidas.

## Decisiones de Rick ya tomadas (05-oct-2026)

| # | Decisión | Qué se hizo |
|---|---|---|
| 1 | Webhook de PayPal: se aprueba la propuesta del PM | Hecho. Tabla de eventos en `PAYPAL_SETUP.md`. Los avisos que necesitan a una persona salen en *Mi Bandeja* del admin ("Pagos por revisar"). |
| 2 | Suscripciones: es una o la otra, y se puede cambiar de plan. La actual se cobra hasta el fin del ciclo y ese día empieza la nueva | Hecho. Detalle en `PAYPAL_SETUP.md`, "Una sola suscripción por empresa". |
| 3 | Tarifario viejo: se retira después del deploy | Pendiente a propósito. Retirarlo cuando producción ya use `PRICING_TABLE=24sep`. |
| 4 | `admin/precios.html`: unificar el estilo y mejorarlo | Hecho. Usa el mismo menú que el resto del admin, con buscador, filtro por grupo y aviso de cambios sin guardar. |

## Decisiones de Rick del 06-oct-2026

| # | Decisión | Estado |
|---|---|---|
| 5 | Webhook: túnel público (Cloudflare) desde la PC de Rick | Hecho: `./tunel_paypal.sh`. Falta registrar el webhook en PayPal y probar una suscripción. |
| 6 | Proyecto Firebase de pruebas para correos reales (con las cuentas Gmail personales de Rick) | Hecho: proyecto `farmazed-pruebas` (Rick) + modo `FZ_AUTH=real` en la demo (`DEV_LOCAL.md`). Login real verificado; falta que Rick pruebe el registro con su Gmail. |
| 7 | Al dejar el Plan Empresarial la empresa conserva su información y los informes de la vigencia; el gestor de cuenta era parte del plan, así que deja de tenerlo. Para volver, Farmazed define condiciones nuevas. | Hecho en `services/suscripciones.js` (`camposFinPlanEmpresarial`), `routes/empresarial.js`, bandeja de empresas y portal; pruebas en `webhook_paypal`. |
| 8 | Redes sociales del pie | Hecho (07-oct): solo X (https://x.com/Farmazedpty) y YouTube (https://www.youtube.com/@Farmazed); Rick no usará otras. |
| 10 | Captación de información preliminar: se mantiene obligatoria al primer ingreso (07-oct, confirmado por Rick; propuesta de pedirla solo al solicitar un registro, descartada). | Sin cambios. |
| 11 | Correo oficial de la marca: `info@farmazed.com` (Google Workspace). Remitente del correo de verificación de marca y contacto del sitio. | Hecho. Correo de verificación de marca enviado por SMTP de Google (info@farmazed.com) y **aprobado por Rick el 07-oct**. Para producción: las 5 variables `SMTP_*` en Secret Manager (CORREOS.md). |
| 9 | Secret de PayPal sandbox expuesto en el chat del 05-oct: no se rota; el entorno sandbox se suspende en una semana | Decisión de Rick. |

## Rapid PayPro (07-oct-2026)

Sin API pública (investigación de Rick con Claude web): se integró **por enlace de pago, uno por producto**. El admin crea el cobro en el panel de Rapid PayPro, pega el enlace en la línea de la cotización (Cotizaciones → "Rapid PayPro: Guardar enlace"), el cliente paga en la página de Rapid PayPro desde su portal y, cuando el panel muestra el pago, el admin pulsa "Confirmar pago recibido": se registran los pagos por concepto (`origen: rapidpaypro`) y el trámite avanza igual que con PayPal. Una cotización se cobra por una sola vía (PayPal o Rapid PayPro). Pendiente de Rick: pedir a Rapid PayPro (info@rapidpaypro.com) la API/webhook con las 8 preguntas de la investigación; con eso se automatiza.

## Estado al 07-oct-2026 (cierre de la ronda de Rick)

Rick terminó lo que dependía de él; solo esperan respuesta externa: **PayPal** (desbloqueo de la cuenta → Webhook ID) y **Rapid PayPro** (API/webhook, correo enviado a info@rapidpaypro.com). El siguiente paso es un **deploy de revisión** (sandbox de PayPal) para que Zelky y su staff revisen registro, flujos, landing y blog; instrucciones para los developers en `handover.md` ("Deploy de revisión para Zelky").

## Más medios de pago (ideas de Rick, 07-oct-2026; sin trabajo de código hasta tener respuestas)

| Medio | Qué es | Siguiente paso |
|---|---|---|
| **Yappy (Banco General)** | Billetera local con **Botón de Pago Yappy** para webs (documentación y plugins propios; se activa con la cuenta Yappy Comercial). Además, el enlace de Rapid PayPro ya acepta Yappy. | Rick abre/verifica la cuenta Yappy Comercial y pide el acceso al Botón de Pago; con credenciales se integra como proveedor propio (crear cobro + confirmación). Mientras tanto, Yappy funciona vía los enlaces de Rapid PayPro. |
| **Google Pay / Apple Pay** | Billeteras: no cobran solas, necesitan una pasarela que las acepte. Integración directa no recomendada (pasarela compatible + PCI + aprobación de Google). | Preguntar a Rapid PayPro si su página de pago las admite, y a PayPal si están disponibles para Panamá. |

## Antes del deploy a producción

- [ ] Cuenta PayPal Business y app (sandbox primero): `PAYPAL_SETUP.md` §1–3.
- [ ] Variables de Cloud Run. Sin ellas, el tracker no arranca:
  - `FIREBASE_PROJECT_ID`
  - `GCS_BUCKET`
  - `CORS_ORIGINS`
  - `TRUST_PROXY`
  - `MCP_KEY` (32 caracteres o más)
  - `PAYMENTS_PROVIDER`, `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`

  Los secretos van en Secret Manager. Ver `DEPLOY.md`.
- [ ] Reglas `firestore.rules` y `storage.rules`: cierran el acceso directo (deny-all). Antes de desplegarlas, revisar las que hay hoy en la consola de Firebase.
- [ ] Migraciones en producción. Corren en modo de prueba por defecto, y solo escriben con `--prod --project=<id> --confirm`:
  - `tracker/scripts/migrate_roles.js`
  - `tracker/scripts/backfill_invitaciones.js`
- [ ] Confirmar que `api.farmazed.com` apunta al tracker.
- [ ] En PayPal Sandbox, probar una suscripción y un cambio de plan con el webhook conectado. El código sigue la documentación de PayPal, pero nadie lo ha corrido contra PayPal real.

## Mejoras pedidas por Rick (05-oct-2026)

- [x] Los cuadros de confirmación y aviso del navegador (`confirm`/`alert`/`prompt`) son ahora modales con el formato de la interfaz, en el admin y en el portal del cliente (`farmazed-web/portal/js/dialogos.js`, 62 usos reemplazados).

## Deuda técnica conocida (no bloquea)

- 9 pruebas de pantalla pasan, pero no se pueden repetir seguidas porque usan datos fijos. Para hacerlas repetibles, cada prueba tendría que crear sus propios casos. La lista está en `handover.md`, TAREA 42.
- El rate limit vive en memoria y no se comparte entre instancias de Cloud Run. Basta mientras haya una sola instancia.
- Las rutas `POST /api/orgs`, `GET /api/quotes/:id` y `DELETE /api/documents/:docId` no las usa la web. Se dejaron porque las usan las pruebas.

## Después del deploy de revisión

- ✅ HECHO 07-oct (TAREA 45, sin commit): **Subir `firebase-admin` de 12 a 14.5.0 (cambio mayor).** Es lo único que deja `npm audit` en `high` (`firebase-admin` y su dependencia `node-forge`) y arrastra las 7 moderadas (`uuid`, `google-gax`, `@google-cloud/firestore`, `@google-cloud/storage`). Hay que revisar el changelog contra nuestro uso (`verifyIdToken` con `checkRevoked`, `generateEmailVerificationLink`, Firestore, Storage) y correr `npm test` y las e2e. No se hizo antes del deploy para no cambiar la base de autenticación sin tiempo de prueba.
- **Subir `@google-cloud/storage` de 7 a 8 (cambio mayor).** Es lo único que deja `npm audit` (5 moderadas: `uuid`, `teeny-request`, `retry-request`, `gaxios` y el propio paquete). Sin high/critical. Lo usa `services/storage.js` (subir, firmar URL, borrar).
- **`e2e/` sigue con `firebase-admin` 12** (su propio `package.json`, solo siembra datos de prueba). Funciona; subirlo cuando se quiera unificar versiones.

## Decisiones de Rick del 31-oct-2026 (prueba local de los 3 flujos: equipo, enlaces de pago, registro)

| # | Decisión | Estado |
|---|---|---|
| 12 | **Un solo flujo de alta para clientes y personal de Farmazed, siempre iniciado por el admin.** El admin invita desde el panel → la persona recibe un **correo** con el enlace → crea su contraseña → se le manda al **login** para probarla → desde ese momento aparece en el panel del admin. | Por hacer (abajo, "Alta por invitación"). Lo que ya existe: invitaciones de titular/empleado/miembro (`routes/invitations.js`, `aceptar-invitacion.html`) y la lista de empleados/miembros en `admin/empresas.html`. |
| 13 | **Se retira el registro público** (`registro.html`, opción A). Los botones "Solicitar" del landing (`index.html`, hoy `registro.html?plan=…`) pasan a un formulario **"Solicitar cuenta"** que crea un lead; el admin lo convierte en invitación con "Invitar a crear cuenta" (ya existe sobre `contact_leads`). | Por hacer. |
| 14 | **Contraseñas: nunca visibles en el panel.** Rick pidió verlas; se descarta porque Firebase Auth solo guarda un hash y mostrarlas obligaría a guardarlas en texto plano (riesgo legal y de fuga). En su lugar: botón "Restablecer contraseña" por usuario en el panel + "¿Olvidó su contraseña?" funcional en el login (hoy es `href="#"`, sin acción) + columna de estado (Invitado / Pendiente / Activo / último acceso). | Por hacer. Probado a mano el 31-oct: `generatePasswordResetLink` + SMTP → Rick definió clave nueva y la vieja quedó rechazada. |

### Alta por invitación — tarea para los devs (deriva de 12–14)

1. **Correo de invitación** (`services/correo.js`, plantilla de marca como la de verificación): se envía al crear la invitación en `POST /api/invitations/{titular,empleado,miembro}` con el enlace `${PORTAL_URL}/aceptar-invitacion.html?token=…`. Si no hay SMTP, el enlace sigue visible en la tabla de `admin/empresas.html` (quitar el rótulo "sin envío de correo todavía" cuando esté).
2. **Tras crear la contraseña** en `aceptar-invitacion.html`: no entrar directo; cerrar sesión y redirigir a `login.html?cuenta=creada` con el aviso "Cuenta creada, inicia sesión con tu contraseña nueva".
3. **Panel del admin** (`admin/empresas.html`): en Empleados y en "Ver miembros" mostrar estado (Invitado / Pendiente / Activo), fecha de aceptación y último acceso (`getUser().metadata.lastSignInTime`), y botón **"Restablecer contraseña"** → correo de marca con `generatePasswordResetLink` y una página propia `nueva-contrasena.html` (el emulador no tiene pantalla para eso; producción sí la necesita).
4. **"¿Olvidó su contraseña?"** en `login.html`: pedir correo → `POST /api/register/restablecer` (público, con limitador por IP, misma respuesta exista o no la cuenta) → mismo correo del punto 3.
5. **Formulario "Solicitar cuenta"** (reemplaza `registro.html`; puede ser la misma página `contacto.html` ampliada o una nueva). Campos: nombre, empresa, correo, teléfono, país; **tipo(s) de producto de interés** (medicamentos, cosméticos, higiénicos, plaguicidas, excepción, publicidad); **¿qué busca?** (solo información / quiero solicitar una cuenta); **¿cómo se enteró de Farmazed?** (menú: YouTube, Instagram, Facebook, referido por un conocido, búsqueda en Google, LinkedIn, X, otro); mensaje opcional. Guarda un lead en `contact_leads` con esos campos nuevos (`interes`, `intencion`, `fuente`) y los muestra en la bandeja de leads; "Invitar a crear cuenta" ya existe. `POST /api/register` y `registro.html` se retiran (y su e2e `registro.spec.js` se reescribe para el nuevo flujo); el gate de correo verificado en `middleware/auth.js` queda sin efecto práctico pero no estorba.
6. Pruebas: e2e del flujo completo invitación → correo (capturado del emulador) → contraseña → login → visible en el panel; y restablecer contraseña.

### Corregido el 31-oct (en este commit)

- `admin/cotizaciones.html`: "Guardar enlace" y "Confirmar pago recibido" (Rapid PayPro) llamaban a `loadQuotes()`, que no existe (la función es `load()`). El servidor guardaba bien, pero el admin veía "Error" y la pantalla no se refrescaba. Encontrado en la prueba local; verificado el flujo completo después del arreglo.

## Hecho el 31-oct / 01-nov-2026 (decisiones 12–14 ya construidas; pendiente del deploy)

- **Invitaciones por correo** (`services/correo.js` → `emails/invitacion.html`): titular, empleado, miembro y "Invitar a crear cuenta" desde un lead. Sin SMTP el enlace sigue visible en Empresas → Invitaciones (columna "Enlace (por si el correo no llegó)").
- **Tras crear la contraseña** en `aceptar-invitacion.html` se cierra la sesión y se manda a `login.html?cuenta=creada` ("Cuenta creada. Inicia sesión…").
- **`solicitar-cuenta.html`** reemplaza `registro.html` en los botones "Solicitar" del landing y en el link del login. Primer contacto: nombre, correo, teléfono con **código de país** (desplegable, `portal/js/paises.js`), tipo de solicitante (**empresa / regente independiente / abogado tramitante**); si es empresa: nombre, sitio web (opcional), **país de registro** (desplegable), cantidad de productos, productos de interés; para todos: ¿información o cuenta? y ¿cómo se enteró? (YouTube, Instagram, Facebook, referido, Google, LinkedIn, X, otro). Sin contraseña.
- **CRM de leads** (`admin/leads.html`, pestaña "Leads" del menú): contadores por estado (Nuevo / Contactado / Calificado / Invitado / Descartado), buscador, filtros (tipo, intención, fuente, plan), ficha editable (estado, notas, datos) y "Invitar a crear cuenta" (solo admin; crea la empresa con el plan, país, teléfono y web del lead). `PATCH /api/contact-leads/:id` con permiso nuevo `contact_leads.edit` (staff + admin). Un lead invitado no se reabre.
- **Captación precargada y sincronizada** (decisión de Rick 01-nov): la empresa creada desde un lead guarda `leadId` y `prefillCaptacion`; el modal de primer ingreso llega con fabricante (país — empresa), categorías y cantidad ya puestos (las 3 preguntas sí/no quedan en blanco). Al guardar la captación, el lead del CRM recibe la **última versión** del cliente (interés, cantidad, bloque "Última información del cliente en el portal", `actualizadoDesde: 'portal'`).
- **Rótulo del menú lateral** del back-office según rol: "Admin Panel" / "Regente" / "Analista" / "Abogado".
- Queda por retirar: `registro.html` y `POST /api/register` (ya no los enlaza nada; `e2e/registro.spec.js` sigue apuntando ahí y hay que reescribirlo al flujo nuevo). También: e2e del flujo invitación → correo → contraseña → login → CRM, y "¿Olvidó su contraseña?" + "Restablecer contraseña" en el panel (decisión 14, todavía sin hacer).

## Prueba de pago PayPal sandbox con Rick (01-nov-2026) — resultado y hallazgo

- ✅ **Cobro de cotización por PayPal, de punta a punta en la demo**: cotización `FZ-MED-REG-2026-0201` (PBS, Regular / Síntesis Química, B/. 4,130) enviada → aceptada por el cliente → "Pagar con PayPal" → aprobación con la cuenta compradora sandbox → captura registrada (`pagoPaypal.estado:'capturada'`). Los webhooks no llegaron (sin túnel) y **no hacen falta para este flujo**: el portal captura al volver de PayPal. El webhook queda para producción (URL de Cloud Run) y para suscripciones.
- 🔴 **HALLAZGO (decisión de Rick pendiente): el borrador automático cobra MEF e IEA aunque sus casillas estén desmarcadas.** `services/quotes.js armarBorrador()` toma del tarifario los 4 conceptos (la fila Síntesis Química Regular trae `mef:25` e `iea:1500` dentro de las tasas) pero deja `esExtranjero:false, aplicaIEA:false`. El total cobrado (4,130) incluía 1,525 de MEF+IEA que, según la cotización, "no aplican"; y al capturar solo se registraban los conceptos marcados (2 de 4). **Corregido hoy lo seguro**: al capturar (PayPal) o confirmar (Rapid PayPro) se registra **todo concepto con monto > 0** (`utils/conceptos_fase05.js conceptosCobrados()`), así el libro de pagos siempre cuadra con lo cobrado; en el expediente de PBS se completaron a mano los 2 pagos faltantes. **Falta decidir y hacer (devs)**: (a) recomendado: el borrador excluye MEF/IEA del total hasta que el admin marque las casillas y, al marcarlas, los suma desde `tarifarioConceptos`; o (b) las casillas nacen marcadas cuando el tarifario trae esos conceptos. Afecta `armarBorrador`, el PATCH de línea y `e2e/quotes.spec.js`.
- **Decisión de Rick (01-nov)**: por ahora **no hay precios fijos ni planes**: el cobro va por cotización (PayPal o enlace de Rapid PayPro). Las suscripciones y el cambio de plan quedan para cuando existan planes; recién entonces hace falta el webhook con túnel para probarlas en local.
- Para producción (PayPal): cuenta Business Live verificada → app Live (Client ID/Secret) → tras el deploy, webhook con la URL de Cloud Run (`PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED` como mínimo) → Secret Manager (`PAYPAL_ENV=live`) → primer cobro real pequeño con reembolso. Detalle en `PAYPAL_SETUP.md`.

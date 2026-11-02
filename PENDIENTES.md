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

> **01-nov-2026 — desplegado a producción** (tracker `00006`, web nueva; ver DEPLOY.md "Cómo redesplegar"). Lo que sigue abierto de esta lista: registrar el webhook de PayPal sandbox y subir su ID a `paypal-webhook-id`; probar una suscripción y un pago sandbox reales; `api.farmazed.com` ya apunta al tracker (verificado). Las migraciones NO se aplicaron por decisión de Rick: solo `admin@pbtradingsolutions.com` tiene rol; `richypb@gmail.com` y la cuenta de prueba de agosto quedaron sin rol (borrarlas desde la consola si no se van a usar).

- [ ] Cuenta PayPal Business y app (sandbox primero): `PAYPAL_SETUP.md` §1–3. (App sandbox: credenciales ya en Secret Manager; falta el webhook.)
- [x] Variables de Cloud Run (01-nov-2026, ver DEPLOY.md). Sin ellas, el tracker no arranca:
  - `FIREBASE_PROJECT_ID`
  - `GCS_BUCKET`
  - `CORS_ORIGINS`
  - `TRUST_PROXY`
  - `MCP_KEY` (32 caracteres o más)
  - `PAYMENTS_PROVIDER`, `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`

  Los secretos van en Secret Manager. Ver `DEPLOY.md`.
- [x] Reglas `firestore.rules` (deny-all) desplegadas el 01-nov-2026 junto con `firestore.indexes.json`. `storage.rules` no aplica: Firebase Storage no está activado como producto (el bucket `farmazed-docs` es GCS puro que solo usa el tracker).
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
- 🔴 **HALLAZGO (decisión de Rick pendiente): el borrador automático cobra MEF e IEA aunque sus casillas estén desmarcadas.** `services/quotes.js armarBorrador()` toma del tarifario los 4 conceptos (la fila Síntesis Química Regular trae `mef:25` e `iea:1500` dentro de las tasas) pero deja `esExtranjero:false, aplicaIEA:false`. El total cobrado (4,130) incluía 1,525 de MEF+IEA que, según la cotización, "no aplican"; y al capturar solo se registraban los conceptos marcados (2 de 4). **Corregido hoy lo seguro**: al capturar (PayPal) o confirmar (Rapid PayPro) se registra **todo concepto con monto > 0** (`utils/conceptos_fase05.js conceptosCobrados()`), así el libro de pagos siempre cuadra con lo cobrado; en el expediente de PBS se completaron a mano los 2 pagos faltantes. **Decidido por Rick (01-nov-2026)**: Farmazed cobra **siempre el 100% del tarifario**; MEF e IEA son **desglose informativo** del total y Farmazed los paga directo a las entidades (coherente con R19). Con el fix de hoy el cobro y el libro de pagos ya cuadran. **Queda para los devs**: (1) las casillas "Extranjero (MEF)" / "Aplica IEA" de `admin/cotizaciones.html` ya no deciden qué se cobra → quitarlas o dejarlas solo informativas (y `modalidadIEA` como dato del desglose); (2) el gate de salida de fase_05 (`services/transitions.js`, `conceptosRequeridosFase05`) debe exigir **todos los conceptos con monto > 0** de la línea, no los de las casillas; (3) ajustar `e2e/payments.spec.js` y `e2e/quotes.spec.js` a esa regla.
- **Decisión de Rick (01-nov)**: por ahora **no hay precios fijos ni planes**: el cobro va por cotización (PayPal o enlace de Rapid PayPro). Las suscripciones y el cambio de plan quedan para cuando existan planes; recién entonces hace falta el webhook con túnel para probarlas en local.
- Para producción (PayPal): cuenta Business Live verificada → app Live (Client ID/Secret) → tras el deploy, webhook con la URL de Cloud Run (`PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED` como mínimo) → Secret Manager (`PAYPAL_ENV=live`) → primer cobro real pequeño con reembolso. Detalle en `PAYPAL_SETUP.md`.

## Modo demo (acordado con Rick el 01-nov-2026; se construye en sesiones nuevas, DESPUÉS del push de hoy)

Objetivo: que un prospecto (cliente) o un empleado nuevo entienda la plataforma solo, con un recorrido guiado y datos de ejemplo, y pueda repetirlo cuantas veces quiera.

1. **Cuentas y datos de ejemplo** — `tracker/scripts/seed_demo.js`, idempotente y reiniciable. Empresa "Laboratorios Ejemplo S.A." con `demo-cliente@…` (titular) y `demo-miembro@…`; personal `demo-analista@…`, `demo-abogado@…`, `demo-regente@…`, `demo-admin@…`. "Producto Ejemplo 1/2/3" en fases distintas (recién creado / cotización enviada / pagado en fase 6), documentos y mensajes de muestra, lead "Farmacia Ejemplo" en el CRM. Todo con `demo:true` (claims y documentos) para aislarlo de datos reales y saber qué borra el reinicio.
2. **Recorrido guiado con pasos predeterminados** (panel "Recorrido demo" en portal y back-office). Cliente: captación precargada → crear producto (asistente con datos ya puestos) → subir documento de ejemplo → ver cotización → aceptar → pagar con el **proveedor de prueba** (nunca PayPal real) → ver avance de fases. Personal: bandeja → revisar documento → enviar cotización → confirmar pago → avanzar fase → asignar regente. En modo demo se ocultan/desactivan las acciones fuera del recorrido y cada pantalla indica el siguiente paso.
3. **Botón `[Reiniciar cuenta demo]`** en el topbar, solo para cuentas `demo:true` → `POST /api/demo/reiniciar` (borra los datos demo de esa cuenta/empresa y vuelve a sembrar; con límite de frecuencia). Siempre vuelve al paso 1.
4. **Manual de usuario ES/EN/FR/PT** — `farmazed-web/manual/<idioma>.html` (y exportable a PDF): reproduce las tarjetas y modales reales de cada paso, en el orden del recorrido; enlace "Ayuda" en el topbar. La interfaz de la aplicación sigue solo en español (traducirla es otro proyecto).
5. **Pruebas y docs**: suite backend (reinicio idempotente; aislamiento: una cuenta demo no toca datos reales; pagos siempre mock), e2e del recorrido completo, `DEMO.md` para los devs.

**Decisiones de Rick pendientes antes de arrancar**: (1) ¿modo demo en producción o en un despliegue aparte (recomendado: `demo.farmazed.com`)? (2) ¿cuentas demo con clave pública (p. ej. `Demo2026!`) o entregadas una a una? (3) ¿manual solo web o también PDF?

Estimación: 4–5 sesiones (datos+reinicio · recorrido cliente · recorrido personal · manual · pruebas).

### Modo demo — punto 1 HECHO (01-nov-2026): cuentas, datos de ejemplo y reinicio

- Cuentas de producción decididas por Rick (claves por `DEMO_PASSWORD_*`, fuera del repo): `cliente.demo@farmazed.com` (titular de "Laboratorios Ejemplo S.A.") y `regente.demo@farmazed.com` (regente; solo ve sus casos asignados, por eso convive con datos reales). **Sin admin demo.** Detalle, garantías y cómo sembrar: `DEMO.md`.
- Hecho: `services/demo.js` (seed + borrado aislado por `demo-org`/`demo:true`), `scripts/seed_demo.js`, `POST /api/demo/reiniciar` (solo claim `demo:true`, 1/min, revoca sesiones), botón **[Reiniciar cuenta demo]** en el topbar del portal del cliente y del back-office, pago de cuentas demo siempre con el proveedor de prueba (`getProvider(user)`), sin correos a `*.demo@`, paso 9b en `DEPLOY.md`, suite `tests/demo.test.js`.
- Siguientes puntos del plan: 2) recorrido guiado con pasos predeterminados, 3) manual ES/EN/FR/PT, 4) e2e del recorrido.

### Modo demo — punto 2 HECHO (01-nov-2026): recorrido guiado

- Panel flotante **"Recorrido demo"** (`farmazed-web/portal/js/recorrido.js`) en el portal del cliente y en todo el back-office del regente, solo para cuentas `demo:true`: lista de pasos, cuál toca, "Ir al paso" y "Descargar PDF de ejemplo". El progreso lo calcula el tracker a partir de los datos (`GET /api/demo/recorrido`, `services/demo_recorrido.js`): nada que guardar, el reinicio vuelve solo al paso 1. Pasos y textos en `DEMO.md`.
- Cliente: captación → crear producto (botón **Rellenar con datos de ejemplo**, solo demo) → subir el PDF de ejemplo → aceptar la cotización 2 → pagar con el proveedor de prueba (**el caso avanza solo a fase 6**, `avanzarTrasPagoDemo`, actor `demo-automatico`) → escribir un mensaje. Regente: aprobar/rechazar el documento sembrado en el Producto 3 (`demo-doc-3-formula`, PDF en Storage) → confirmar cotejo técnico → atender el lead.
- Fuera del recorrido se oculta invitar miembros y la suscripción (`body.fz-demo`); el tracker además rechaza invitaciones de la cuenta demo (403). El reinicio borra también los archivos de Storage de los documentos demo.
- Suite `tests/demo.test.js` ampliada (12 pruebas). **Ajuste colateral**: `tests/pagos_paypal.test.js` esperaba 2 pagos al capturar; desde c53a04a (01-nov) se registran los 4 conceptos con monto, así que las dos aserciones se pusieron al día.
- Siguientes: 3) manual ES/EN/FR/PT (hecho abajo), 4) e2e del recorrido completo (cliente y regente).

### Modo demo — punto 3 HECHO (01-nov-2026): manual de usuario ES/EN/FR/PT

- `farmazed-web/manual/{es,en,fr,pt}.html`, generados por `tracker/scripts/generar_manual.js` (`npm run manual`) a partir de los textos de los pasos de `services/demo_recorrido.js` (una sola fuente) y de `scripts/manual_textos.js` (traducciones por id de paso, prosa, 13 fases por idioma). Cada paso reproduce en HTML/CSS la tarjeta o modal real con sus rótulos en español (la app sigue sin traducir, como dice el plan) y enlaza al siguiente paso; selector de idioma; imprimible/guardable como PDF desde el navegador (`@media print`). Sin claves: Rick las entrega aparte.
- Enlace **"Ayuda"** en el topbar del portal (`#tb-ayuda` → `/manual/es.html#cliente`) y del back-office (`auth.js montarEnlaceAyuda` → `/manual/es.html#regente`), visible para todos.
- `tests/manual.test.js` (4 pruebas, sin emuladores): HTML del repo = salida del generador, español = `demo_recorrido.js`, todos los pasos traducidos en cada idioma, enlaces "Ayuda". Si cambia un texto del recorrido, regenerar y commitear.
- Siguientes: 3b) panel en 4 idiomas (hecho abajo, lo pidió Rick al revisar el manual), 4) e2e.

### Modo demo — punto 3b HECHO (01-nov-2026): el panel "Recorrido demo" en ES/EN/FR/PT

- Rick, al revisar el manual: "we shall also make the clients panels to be in the 4 language versions as well". El panel flotante (cliente y regente) ahora tiene selector ES · EN · FR · PT; la elección se recuerda (`localStorage`) y por defecto se toma el idioma del navegador. El enlace "Ayuda" abre el manual en ese idioma.
- Una sola fuente: `tracker/services/demo_recorrido_textos.js` (pasos en español, traducciones por id, avisos, rótulos del panel). `GET /api/demo/recorrido?idioma=xx` devuelve pasos y rótulos traducidos (desconocido → español); `recorrido.js` ya no trae ningún texto en duro. El manual se regenera desde el mismo módulo y reproduce el panel en su idioma. El resto de la app sigue en español (traducirla es otro proyecto); los rótulos de pantalla citados en los pasos quedan en español en todos los idiomas.
- Pruebas: `tests/demo.test.js` +1 (13, idiomas por API, incl. `pt-BR` y un valor raro), `tests/manual.test.js` 6 (traducciones completas, marcadores, réplica del panel por idioma, `recorrido.js` sin rótulos en duro).
- Siguientes: 3c) la aplicación demo entera en 4 idiomas (hecho abajo, lo pidió Rick al ver el manual en inglés con la interfaz en español), 4) e2e.

### Modo demo — punto 3c HECHO (01-nov-2026): la demo y los manuales en ES/EN/FR/PT sin mezclas

- Rick: "I see that in the english version of the demo shows the layout with spanish words, make sure also the official demo has the 4 languages as well and so the manuals, so we dont have language mixtures." Se tradujeron enteras las páginas que usan las cuentas demo: `login.html`, `client-dashboard.html` (portal, asistente, cotización, mensajes, captación…), `admin/bandeja.html`, `admin/expediente.html`, `admin/leads.html`, más los módulos `wizard.js`, `dialogos.js`, `status_ui.js`, `auth.js`, `paises.js` (65 países) y las etiquetas que manda el tracker (13 fases y estados, ~200 nombres/descripciones de documentos FADDI, estados de lead, conceptos, grupos de precios). 1040 claves por idioma.
- Capa `farmazed-web/portal/js/i18n.js` (`FZI18N.t`, `data-i18n`, selector ES · EN · FR · PT en el topbar y el login, `localStorage fzIdioma`, por defecto español, repintado en vivo por `onCambio`); diccionarios por área en `farmazed-web/i18n/_partes/` fusionados con `npm run i18n` → `i18n/{en,fr,pt}.json`; convenciones y glosario en `farmazed-web/i18n/README.md`. El manual reproduce las pantallas con el mismo diccionario y el panel "Recorrido demo" sigue el idioma de la interfaz (ya no tiene selector propio). Los textos de los pasos citan los rótulos reales de cada idioma ("Request Registration", [Reset demo account]…).
- Pruebas: `tests/i18n.test.js` (6: diccionarios = fusión de partes, toda clave usada y toda etiqueta del tracker traducida en los 3 idiomas, marcadores, i18n.js primero en el `<head>`, rótulos citados en el recorrido = rótulos de la interfaz, la capa en Node), `tests/manual.test.js` 6, `tests/demo.test.js` 13 (Docker). Revisión de código: sin CRITICAL/HIGH; corregidos los MEDIUM (carrera al cambiar de idioma, pérdida de lo tecleado al repintar, checkboxes de publicidad) y LOW. Verificado en Chrome: portal en EN/FR y back-office en PT sin claves faltantes ni errores de consola.
- Sigue en español a propósito: nombres propios de los datos de ejemplo, códigos, correos, valores técnicos, `error.message` del tracker, y las páginas de admin que no usa la demo (casos, cotizaciones, empresas, configuración, precios, formularios). Traducir esas y los correos del tracker sería otro punto.
- Siguientes: 3d) recorridos separados y recorrido del cliente para cuentas reales (hecho abajo), 4) e2e.

### Modo demo — punto 3d HECHO (01-nov-2026): recorrido del cliente ≠ recorrido del regente; el del cliente también para cuentas reales

- Rick: "lets separate the client tour from the regent tour, the regent tour will be only available from the demo version for regents, and clients will be from the demo version and also from the settings section in some part to be added and easy to activate."
- **Regente**: solo en la cuenta demo (igual que antes), con manual propio `manual/regente/`. **Cliente**: en la demo como siempre, y para cualquier cliente real desde **"Mi cuenta"** (menú del avatar → interruptor "Mostrar el recorrido guiado"); preferencia guardada en el tracker (`userPrefs/{uid}`, `GET/PUT /api/me/preferencias`), panel con ✕ para ocultarlo. Variante de pasos `clienteReal` (genérica, sin datos de ejemplo) y progreso deducido de la empresa real (`services/recorrido_cliente.js`, `GET /api/me/recorrido`). "Mi cuenta" agrupa además el selector de idioma y el enlace al manual.
- **Manuales**: `manual/cliente/{es,en,fr,pt}.html` (pasos de cliente real + apartado "Si usas la cuenta de demostración" con el PDF de ejemplo) y `manual/regente/{es,en,fr,pt}.html`; el manual único anterior desaparece. "Ayuda" del portal → cliente; del back-office → regente.
- Pruebas: `tests/demo.test.js` +1 (14; preferencias con validación, recorrido real en EN, 403 al personal), `tests/manual.test.js` 6 (dos manuales), `tests/i18n.test.js` 6 (rótulos citados también en la variante real).
- Queda: 4) e2e del recorrido completo (cliente y regente).

### Modo demo — punto 3e HECHO (01-nov-2026): carga de documentos simulada en el paso 4 de la demo

- Rick: en la demo, al pulsar **Subir** no debe abrirse el explorador de archivos sino un modal que explique que ahí el cliente real elige su archivo y que la demo lo simula; **Rellenar con datos de ejemplo** equivale a "subió todo y subsanó todo"; nada debe bloquear el flujo hasta el final del recorrido.
- Hecho (solo front, `portal/js/wizard.js` + `client-dashboard.html`, solo con `body.fz-demo`): cada "Subir" abre un modal (`dialogos.confirmar`) y al confirmar adjunta el PDF de ejemplo por la ruta real `POST /api/cases/:id/documents` (el regente y el recorrido ven un documento normal). Banner "Modo demo" en el paso 4 con **Rellenar con datos de ejemplo**; el botón del portal hace lo mismo del paso 4 en adelante (pasos 1–3 sigue rellenando el formulario). "Todos" = documentos del cliente que faltan + los `requested`/`rejected` (subsanar), 3 subidas en paralelo con progreso en el modal de carga. Cuentas reales y `portal/nuevo.html` sin cambios.
- Textos del paso "documento" del recorrido demo y del manual actualizados en ES/EN/FR/PT; 11 claves nuevas en `i18n/_partes/portal-js.json`. Pruebas `i18n` 6/6 y `manual` 6/6; verificado en Chrome contra la demo Docker (modal, 1 doc, 22 de golpe → 24/27, paso 5 "Todos los documentos obligatorios están subidos").
- Rick (después): el manual ya no enlaza el PDF de ejemplo en ningún idioma ("⬇ Descargar el PDF de ejemplo" quitado de `generar_manual.js`; la prueba exige que ningún manual lo enlace). El botón "Descargar PDF de ejemplo" del panel flotante sigue ahí: decidir si también se quita.
- Queda: 4) e2e del recorrido completo (cliente y regente).

### Seguridad — pendientes de la revisión del 02-nov-2026 (sin corregir todavía)

- **Receptor fiscal sin revisión**: la factura automática (PayPal, Rapid PayPro) toma RUC, razón social y correo de lo que el cliente escribió como "solicitante" en el expediente. Propuesta: pedir confirmación del admin la primera vez que se factura a una empresa (o bloquear esos datos una vez hay pago). Decisión de Rick.
- **Cloud Scheduler para el barrido de facturas**: no usar un token de admin guardado; crear un endpoint que verifique un token OIDC de una cuenta de servicio (`google-auth-library` `verifyIdToken`, audiencia = la URL) o usar invocador IAM de Cloud Run.
- **CSP en nginx**: inventariar orígenes (gstatic, googleapis, jsdelivr, cdnjs, fonts, api.farmazed.com, identitytoolkit) y añadir `Content-Security-Policy`. Hoy ya van HSTS, nosniff, X-Frame-Options, Referrer-Policy y Permissions-Policy.
- `/api/me/org` hace `listUsers(1000)` en cada petición (preexistente): guardar los miembros en Firestore o consultar por claim.
- Claves web de Firebase (`portal/js/config.js`): confirmar en la consola de Google Cloud que están restringidas por referente HTTP.
- `.tools/adc-farmazed-pruebas.json` (local, ignorado por git) contiene un refresh token de OAuth: rotarlo si la carpeta se comparte.

## Admin — módulo "Finanzas" (contenedor, 01-nov-2026)

- Rick va a traer código propio de un módulo financiero. Mientras tanto: entrada **Finanzas** en la barra lateral de todas las páginas del admin (después de Precios; solo-admin, la muestra `initBackoffice` como Empresas/Precios/Configuración) y página `admin/finanzas.html` con guardia de administrador (el staff vuelve a su bandeja), i18n en ES/EN/FR/PT (8 claves en `backoffice.json`, página incluida en `PAGINAS` del test) y una tarjeta "En preparación" con el contenedor `#finanzas-modulo` donde va el módulo.
- Hecho después (misma fecha): el módulo ya tiene contenido, ver "Facturación electrónica" abajo.

## Facturación electrónica tras el pago (Rick, 01-nov-2026) — HECHO, falta lo fiscal de Rick

- Rick: "analiza el modulo de facturaccion que se integra con EBI-PAC [del repo PBS-Agentic-Website] … implementar un workflow de emision de factura digital una vez el cliente en efecto ejecute el pago, ya sea que el procedimiento de facturacion se dispare por un webhook, o por via manual por parte del admin, que cada metodo de pago tenga definido su workflow que termine con el envio de la factura digital al cliente via email."
- Construido (ver `tracker/FACTURACION.md`): `services/facturacion/` (PAC EBI-PAC portado + PAC simulado + flujo pendiente → emitida → enviada con reintentos y anulación), `routes/facturas.js` (`/api/facturas`), hooks en captura PayPal, webhook PayPal, confirmación Rapid PayPro y registro manual; correo `emails/factura.html` con el PDF fiscal; panel **Finanzas** (facturas, pagos sin factura, configuración) en ES/EN/FR/PT; `tests/facturacion.test.js` 17/17.
- Workflows por defecto: PayPal y Rapid PayPro automáticos (emite y envía solos); manual queda pendiente hasta que el admin pulse "Emitir y enviar". Editables en Finanzas → Configuración.
- **Decisiones que debe tomar Rick antes de facturar de verdad** (hoy el sistema corre con el PAC simulado):
  1. Credenciales de EBI-PAC para Farmazed (`EBI_TOKEN_USUARIO`/`EBI_TOKEN_PASSWORD` en Secret Manager) y RUC/DV/razón social/sucursal/punto de facturación del emisor (se cargan en Finanzas).
  2. ITBMS por concepto: hoy honorarios 7 % y tasas DNFD/MEF/IEA exentas (gasto reembolsable). Confirmar con el contador.
  3. Códigos DGI de forma de pago: PayPal y Rapid PayPro como tarjeta (03), manual como transferencia (05).
  4. Si el cliente debe ver sus facturas en el portal (la API `GET /api/facturas/mias` y el PDF ya existen; falta la pantalla).
- Pendiente técnico: smoke test contra `integraciondemo.ebi-pac.com` con credenciales reales (horario Panamá); desplegar `firestore.indexes.json` (índice de grupo `payments.tipo`).

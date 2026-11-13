# Modo demo — cuentas de demostración y reinicio

Decisión de Rick (01-nov-2026; ampliada el 08 y el 13-nov): cinco cuentas públicas para que un prospecto (cliente) o un empleado
nuevo (Responsable Farmacéutico, Responsable Legal o Administrador) recorran la plataforma con datos de ejemplo, y un botón **[Reiniciar cuenta demo]**
que lo deja todo como al principio. Conviven con los datos reales de producción: todo lo demo lleva
`demo:true` y cuelga de la empresa `demo-org`; el reinicio borra solo eso.

## Cuentas (producción)

| Cuenta | Rol | Clave | Qué ve |
|---|---|---|---|
| `cliente.demo@farmazed.com` | cliente_titular de "Laboratorios Ejemplo S.A." | `DEMO_PASSWORD_CLIENTE` | Solo su empresa de ejemplo |
| `regente.demo@farmazed.com` | regente (Responsable Farmacéutico) | `DEMO_PASSWORD_REGENTE` | Solo los casos de ejemplo (`demo:true`) |
| `farmaceutico.demo@farmazed.com` | regente (Responsable Farmacéutico) | `DEMO_PASSWORD_FARMACEUTICO` | Los mismos casos y el mismo recorrido que `regente.demo` |
| `legal.demo@farmazed.com` | abogado (Responsable Legal) | `DEMO_PASSWORD_LEGAL` | Los casos de ejemplo; recorrido propio (poder, pedido de documento, confirmación legal de la fase 8) |
| `admin.demo@farmazed.com` | admin (+ `demo:true`) | `DEMO_PASSWORD_ADMIN` | Todas las pantallas del admin, **solo sobre lo de `demo-org`**; lo global se ve pero no se guarda (ver "Admin demo") |

Rol visible (Rick, 08-nov-2026): `regente` se muestra como **Responsable Farmacéutico** y `abogado` como **Responsable Legal**; los identificadores internos (claims, `ROLES`, `manual/regente/`) no cambian. El personal demo ve los casos `demo:true` de `demo-org` (no por `asignados.<rol>`, que guarda un solo uid), así las dos cuentas de Responsable Farmacéutico comparten casos.

Las claves las fija Rick y **no van en el repo** (es público): `DEMO_PASSWORD_CLIENTE` / `DEMO_PASSWORD_REGENTE` / `DEMO_PASSWORD_FARMACEUTICO` / `DEMO_PASSWORD_LEGAL` / `DEMO_PASSWORD_ADMIN` en Secret Manager (Cloud Run) o `tracker/.env` (local). Son obligatorias la primera vez que se siembra; en un reinicio, si faltan, cada cuenta conserva su clave. Rick las comunica a los prospectos por fuera (p. ej. en la página de demo o el manual).

## Estado inicial (lo que deja el seed y cada reinicio)

- Empresa "Laboratorios Ejemplo S.A." (plan registro) **sin captación** y con la captación precargada
  (el cliente la confirma en su primer ingreso: paso 1 del recorrido).
- **Producto Ejemplo 2 — Analgésico 500 mg**: fase 4, cotización **enviada** por B/. 4,130
  (el cliente la acepta y paga en PayPal sandbox, o con el mock si el servidor no tiene credenciales sandbox).
- **Producto Ejemplo 4 — Antiácido 400 mg**: fase 4 con la cotización en **borrador** (`demo-cotizacion-4`, B/. 4,130):
  el admin demo la revisa y la "envía" (simulado, sin correo); `cliente.demo` la ve y puede pagarla.
- **Producto Ejemplo 3 — Jarabe pediátrico**: fase 8, cotización aceptada y **pagada** (4 conceptos),
  con dos mensajes y **un documento subido** (15.5 Fórmula cuali-cuantitativa, PDF de ejemplo en Storage)
  para que el Responsable Farmacéutico lo apruebe o rechace y confirme el cotejo técnico, y **un poder (15.2)**
  para que el Responsable Legal lo revise y confirme la parte legal.
- "Producto Ejemplo 1" **no existe**: lo crea el cliente en "Solicitar Registro".
- Lead "Farmacia Ejemplo" en el CRM del personal (Leads), estado Nuevo.

## Recorrido guiado (panel "Recorrido demo")

Tarjeta flotante (`farmazed-web/portal/js/recorrido.js`) que aparece siempre en las cuentas demo, en el
portal del cliente y en todas las páginas del back-office del personal demo (y, para clientes reales, cuando
la activan en "Mi cuenta": ver "Dos recorridos" más abajo). Muestra los pasos, cuál toca
ahora y un botón "Ir al paso" que abre la pantalla donde se hace. El progreso **no se guarda**: el
tracker lo deduce de los datos (`GET /api/demo/recorrido`, `services/demo_recorrido.js`), así el
reinicio vuelve al paso 1 solo y el panel nunca miente. Se refresca al volver a la pestaña y cada
12 s.

**Idiomas (Rick, 01-nov-2026):** el panel se lee en español, inglés, francés o portugués. Tiene un
selector ES · EN · FR · PT; la elección se guarda en `localStorage` (`fzRecorridoIdioma`) y, si no hay,
se toma el idioma del navegador. El front no trae tablas de textos: `GET /api/demo/recorrido?idioma=xx`
devuelve los pasos **y** los rótulos del panel (`etiquetas`) ya traducidos; un idioma desconocido cae al
español. Todos los textos (pasos ES + traducciones por id, avisos, rótulos) viven en
`services/demo_recorrido_textos.js`, la misma fuente del manual. El enlace "Ayuda" del topbar sigue al
idioma del panel (`/manual/<idioma>.html#<rol>`). El resto de la aplicación sigue en español: los rótulos
de pantalla citados en los pasos ("Solicitar Registro", "Pagar con PayPal"…) se dejan en español en
todos los idiomas para que la persona los encuentre.

| Cliente (6 pasos) | Se marca hecho cuando… |
|---|---|
| 1. Confirma los datos de tu empresa | la empresa tiene `captacion` |
| 2. Crea tu primer producto | existe un caso de `demo-org` que no sembró el seed (botón **Rellenar con datos de ejemplo** en "Solicitar Registro", solo demo) |
| 3. Sube un documento de ejemplo | ese caso tiene un documento subido. En la demo los botones **Subir** del paso 4 no abren el explorador de archivos: un modal explica la simulación y, al confirmar, el portal adjunta `farmazed-web/demo/documento-ejemplo.pdf` por la ruta real de subida; **Rellenar con datos de ejemplo** (banner del paso 4 o botón del portal) simula todos los documentos del cliente de una vez, incluidos los pedidos o rechazados |
| 4. Acepta la cotización de Producto Ejemplo 2 | `demo-cotizacion-2.estado == 'aceptada'` |
| 5. Paga con PayPal sandbox | `pagoPaypal.estado == 'capturada'`; **el caso avanza solo** fase_04 → fase_05 → fase_06 (`avanzarTrasPagoDemo`, por `applyTransition` con sus gates, actor `demo-automatico` en el historial) |
| 6. Escribe a tu equipo Farmazed | hay un mensaje del cliente que no sembró el seed |

| Responsable Farmacéutico (3 pasos; `regente.demo` y `farmaceutico.demo`) | Se marca hecho cuando… |
|---|---|
| 1. Revisa el documento de Producto Ejemplo 3 | `demo-doc-3-formula.status` es approved o rejected |
| 2. Confirma el cotejo técnico (fase 8) | `demo-caso-3.confirmacionesFase8.tecnica` |
| 3. Atiende el lead "Farmacia Ejemplo" | el lead cambió de estado o tiene notas |

| Responsable Legal (3 pasos; `legal.demo`) | Se marca hecho cuando… |
|---|---|
| 1. Revisa el poder de Producto Ejemplo 3 | `demo-doc-3-poder.status` es approved o rejected |
| 2. Pide un documento al cliente | el Producto Ejemplo 2 tiene algún documento (el seed no deja ninguno; "Solicitar" crea el pedido) |
| 3. Confirma la revisión legal (fase 8) | `demo-caso-3.confirmacionesFase8.legal` |

El pedido se hace sobre el Producto Ejemplo 2 (no el 3) porque pedir un documento mueve el caso a documentos
pendientes y el 3 debe seguir en fase 8 para que ambos Responsables confirmen. Orden de los pasos: el brief
pedía revisar, pedir y confirmar; así quedó.

### Admin demo (`admin.demo`, TAREA 64)

| Administrador (3 pasos; `admin.demo`) | Se marca hecho cuando… |
|---|---|
| 1. Ajusta y envía la cotización de Producto Ejemplo 4 | `demo-cotizacion-4.estado` ya no es `borrador` |
| 2. Atiende el lead "Farmacia Ejemplo" | el lead cambió de estado o tiene notas |
| 3. Mira el pago de la cotización | `demo-cotizacion-4.pagoPaypal.estado == 'capturada'` (lo paga `cliente.demo`) |

En este sistema la cotización nace sola como borrador cuando un caso llega a la fase 4; por eso el seed deja el borrador del
Producto 4 ya creado y el admin demo lo ajusta y lo envía. **Aislamiento (criterio duro)**: el rol admin se salta casi todos los
filtros, el admin demo no. `utils/demo_scope.js` (`esAdminDemo`, `esDocDemo`), `middleware/demo_admin.js` y los filtros por ruta:

- **Solo lo de `demo-org` (`demo:true` o `orgId == demo-org`)**: casos (lista y acceso por id, con documentos, mensajes, pagos,
  formularios), cotizaciones (lista, detalle, ajustar líneas, enviar, enlace de Rapid PayPro), facturas (lista, detalle, PDF, estado PAC,
  pagos sin factura), empresas (lista, miembros, leads por revisar, diagnóstico), leads, invitaciones, revisiones de pago y empleados
  (solo las cuentas demo, nunca el personal real).
- **Global: se ve, no se guarda** (responde 403 `"En la demo no se guarda…"`, sin tocar nada): precios, configuración de facturación,
  emitir/enviar/reintentar/anular facturas y procesar pendientes, plan de suscripción, invitaciones (titular/empleado/miembro y la de un
  lead), restablecer contraseñas, resolver revisiones de pago, alta de empresas, captación y condiciones del plan empresarial.
- **Cotización**: `POST /api/quotes/:id/send` con una cuenta demo responde `simulado: true` y la pantalla avisa "Envío simulado"; esa
  ruta nunca manda correo y a `*.demo@` tampoco lo mandaría `services/correo.js`.
- **MCP** no es accesible: pide la llave `MCP_KEY`, no el token de usuario.
- Pendiente conocido: el admin demo puede escribir un uid real en `asignados` de un caso demo (la lista de empleados solo le muestra cuentas demo).

En modo demo el portal oculta lo que no entra en el recorrido (`body.fz-demo`): invitar miembros
(además el tracker responde 403: mandaría un correo real) y la suscripción (sin planes por ahora).
El asistente sigue exigiendo los 16 documentos obligatorios para enviar el expediente: en la demo el
"Producto Ejemplo 1" queda en borrador con un documento, y el texto del paso lo dice.

## Garantías

- **Pagos** (TAREA 64): una cuenta demo paga con el checkout **real de PayPal SANDBOX** (`services/payments getProvider(user)` →
  `paypal.sandbox()`: URL `api-m.sandbox.paypal.com` fija; redirige a sandbox.paypal.com, el comprador de prueba aprueba, vuelve y se
  captura). Credenciales **solo sandbox**: `PAYPAL_SANDBOX_CLIENT_ID` / `PAYPAL_SANDBOX_CLIENT_SECRET`; si no están valen
  `PAYPAL_CLIENT_ID/SECRET` pero únicamente con `PAYPAL_ENV=sandbox` (los marcadores `<...>` de `.env.example` no cuentan). Sin
  credenciales sandbox, el mock. **Nunca la API live**: con `PAYPAL_ENV=live` las `PAYPAL_*` se ignoran para la demo. Un pago demo
  se marca `demo:true`, no emite factura electrónica real (PAC simulado) y el webhook de PayPal lo ignora. Nunca mueve dinero real.
- **Correos**: a `*.demo@` no se envía ningún correo (`services/correo.js`).
- **Reinicio** (`POST /api/demo/reiniciar`, solo cuentas `demo:true`, 1 vez por minuto): borra casos (con
  documentos —también sus archivos en Storage—, mensajes y pagos), cotizaciones, lead e invitaciones de
  `demo-org`, vuelve a sembrar y **revoca las sesiones** de las dos cuentas (hay que volver a entrar: el
  recorrido arranca de cero).
- **Invitaciones**: la cuenta demo no puede invitar miembros (`POST /api/invitations/miembro` → 403):
  mandaría un correo real a un tercero.
- Los datos de clientes reales no se tocan: el borrado filtra por `orgId == demo-org` y `demo == true`.

## Cómo sembrar

```bash
# demo local (emuladores)
cd tracker && FIRESTORE_EMULATOR_HOST=localhost:8090 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
  FIREBASE_PROJECT_ID=demo-farmazed node scripts/seed_demo.js

# producción (Cloud Shell, después del deploy y de bootstrap_admin)
cd tracker && node scripts/seed_demo.js --prod --project=farmazed --confirm
```

Idempotente: volver a correrlo equivale a pulsar [Reiniciar cuenta demo].

## Idiomas de la interfaz (ES/EN/FR/PT)

Rick (01-nov-2026): "make sure the official demo has the 4 languages as well and so the manuals, so we
don't have language mixtures". Las páginas que usan las cuentas demo —`login.html`, el portal del
cliente (`client-dashboard.html`) y el back-office del regente (`admin/bandeja.html`, `expediente.html`,
`leads.html`)— se traducen enteras con la capa `farmazed-web/portal/js/i18n.js` (script clásico en el
`<head>`): texto estático con `data-i18n` / `data-i18n-attr`, texto generado por JS con `t('…')`, fechas
con `FZI18N.fecha()`. El selector ES · EN · FR · PT está en el topbar (y en el login) y lo ve cualquier
cuenta; la preferencia se guarda en `localStorage` (`fzIdioma`); por defecto español. El panel
"Recorrido demo" y el enlace "Ayuda" siguen ese mismo idioma.

- **Diccionarios**: el español es la clave. Fuente: `farmazed-web/i18n/_partes/*.json` (una por área:
  portal, portal-js, backoffice, login, datos = etiquetas que manda el tracker, demo = contenido
  sembrado, manual). Generados: `farmazed-web/i18n/{en,fr,pt}.json` (`npm run i18n` en `tracker/`;
  no se editan a mano). Convenciones y glosario: `farmazed-web/i18n/README.md`.
- **Sin mezclas, garantizado por prueba**: `tests/i18n.test.js` falla si una clave usada en la interfaz,
  una etiqueta del tracker (fases, estados, nombres de documentos FADDI, estados de lead) o un texto
  sembrado de la demo (mensajes del hilo, mensaje del lead) no está en los tres idiomas, si los
  diccionarios del repo no coinciden con las partes, o si un rótulo citado en los textos del recorrido
  no es el rótulo real de la interfaz en ese idioma. En el navegador, `FZI18N.faltantes` lista lo que
  se pidió a `t()` sin traducción.
- **Lo que sigue en español a propósito**: nombres propios de los datos de ejemplo ("Laboratorios
  Ejemplo S.A.", "Producto Ejemplo 2", "Farmacia Ejemplo"), códigos de expediente, correos, valores
  técnicos y los mensajes de error que devuelve el tracker (`error.message`). Las demás páginas del
  back-office (casos, cotizaciones, empresas, configuración, precios, formularios) son del admin y no
  están traducidas.
- **Manual**: `generar_manual.js` reproduce las pantallas con el mismo diccionario, así el manual en
  inglés muestra la interfaz en inglés.

## Dos recorridos: cliente (demo y clientes reales) y regente (solo demo)

Rick (01-nov-2026): "separate the client tour from the regent tour, the regent tour will be only
available from the demo version for regents, and clients will be from the demo version and also from
the settings section". Un solo panel (`portal/js/recorrido.js`), dos fuentes:

| | Cuenta demo | Cliente real |
|---|---|---|
| Cliente | `GET /api/demo/recorrido` (pasos `cliente`, datos de ejemplo, siempre visible) | `GET /api/me/recorrido` (pasos `clienteReal`, genéricos; progreso según los datos de SU empresa: captación, casos, documentos subidos, cotización aceptada/pagada, mensajes). Se enciende en **"Mi cuenta"** (menú del avatar) con el interruptor "Mostrar el recorrido guiado"; se apaga ahí o con la ✕ del panel. Preferencia `recorridoGuiado` en Firestore `userPrefs/{uid}` (`GET/PUT /api/me/preferencias`). |
| Responsable Farmacéutico | `GET /api/demo/recorrido` (pasos `regente`) | no existe |
| Responsable Legal | `GET /api/demo/recorrido` (pasos `legal`) | no existe |

Los textos de las tres variantes viven en `services/demo_recorrido_textos.js`; el cliente real no ve
referencias a "Producto Ejemplo 2", al proveedor de prueba ni al botón de reinicio. "Mi cuenta"
también agrupa el selector de idioma y el enlace al manual.

## Manuales de usuario (ES/EN/FR/PT)

Tres manuales generados: `farmazed-web/manual/cliente/{es,en,fr,pt}.html` (portal del cliente, con
los pasos de cliente real y un apartado "Si usas la cuenta de demostración"; lo enlazan "Ayuda" del
portal y "Mi cuenta") `farmazed-web/manual/regente/{es,en,fr,pt}.html` (recorrido del Responsable Farmacéutico,
solo demo; lo enlaza "Ayuda" del back-office) y `farmazed-web/manual/legal/{es,en,fr,pt}.html` (el del Responsable Legal; "Ayuda" lo abre para el rol `abogado`). Imprimibles desde el navegador ("Guardar como PDF").
**No se edita a mano**: lo produce `tracker/scripts/generar_manual.js` (`npm run manual` en
`tracker/`) con los textos de los pasos y del panel de `services/demo_recorrido_textos.js` (la misma
fuente del panel, en los 4 idiomas) y `scripts/manual_textos.js` (prosa del manual, nombres de las 13
fases). Cada paso reproduce la pantalla real en HTML/CSS con los rótulos en español (la app no está
traducida, salvo el panel, que el manual reproduce en su idioma); la explicación va en el idioma del
lector. No trae claves. `tests/manual.test.js` regenera y compara: si cambias un texto del recorrido
o del manual, corre el generador y commitea.

## Pendiente (fases siguientes del plan, `PENDIENTES.md`)

E2e del recorrido completo (cliente, Responsable Farmacéutico y Responsable Legal). El backend del recorrido ya tiene suite:
`tests/demo.test.js`; el manual, `tests/manual.test.js`.

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

## Decisiones que le tocan a Rick

| # | Decisión | Dónde está la propuesta |
|---|---|---|
| 5 | Túnel público o deploy de prueba para que PayPal llegue al webhook | `PAYPAL_SETUP.md` §3 |
| 6 | Proyecto Firebase de pruebas si se quieren correos de verificación reales | `PAYPAL_SETUP.md`, tabla de pruebas |
| 7 | Si una empresa deja el Plan Empresarial, ¿conserva su gestor de cuenta y los informes? Hoy los conserva | `tracker/routes/empresarial.js` |

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

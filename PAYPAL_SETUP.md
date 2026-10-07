# Conexión de Farmazed con PayPal

Guía para Rick (04-oct-2026). Qué hace falta de Farmazed para conectar PayPal,
dónde van las credenciales y cómo probar los flujos antes del push.
Contexto técnico: `DEPLOY.md`, `tracker/.env.example`, `PM_COMMENTS.md` §H.14 y §H.16.

> **Regla:** las credenciales (Client ID, Secret, Webhook ID) **nunca** van en el
> chat, en este archivo ni en ningún otro archivo del repo. Ver el paso 4.

---

## 1. Cuenta PayPal Business de Farmazed

- [ ] Que la cree el dueño legal de la empresa, con los datos de la sociedad.
- [ ] Moneda: **USD**.
- [ ] Confirmar con PayPal cómo se retira el dinero a un banco en Panamá antes de
      pasar a cobros reales (no verificado por el equipo técnico).

## 2. App en developer.paypal.com (Sandbox primero)

Entrar a <https://developer.paypal.com> con la cuenta Business de Farmazed.

- [ ] Pestaña **Sandbox** → *Apps & Credentials* → *Create App* (tipo **Merchant**).
- [ ] Anotar en un lugar seguro el **Client ID** y el **Secret** de la app.
- [ ] En la configuración de la app, activar **Subscriptions** (las usan el plan
      global de *Mi Empresa* y el *Plan Empresarial*).
- [x] En *Sandbox accounts*, ubicar la cuenta **Personal** de prueba (comprador):
      con ella se "paga" en las pruebas, con dinero ficticio. Las de Farmazed (05-oct-2026;
      las claves se ven en developer.paypal.com → *Sandbox Accounts* → *View/Edit account*):
      - Comprador (Personal): `sb-ncruf48829159@personal.example.com`
      - Vendedor (Business): `sb-qihw4348836261@business.example.com`

      En el checkout de sandbox NO entra una cuenta PayPal real: solo estas.

**Probado el 05-oct-2026 con la demo en Docker:** pago de una cotización de punta a punta
(orden → aprobación en PayPal sandbox → vuelta al portal → captura y pagos registrados).

## 3. Webhook

En la misma app → *Add Webhook*:

- [ ] URL: `https://<dominio-del-tracker>/api/webhooks/paypal`
- [ ] Eventos:
  - `PAYMENT.CAPTURE.COMPLETED`
  - `PAYMENT.CAPTURE.DENIED`
  - `PAYMENT.CAPTURE.REFUNDED`
  - `BILLING.SUBSCRIPTION.ACTIVATED`
  - `BILLING.SUBSCRIPTION.CANCELLED`
  - `BILLING.SUBSCRIPTION.SUSPENDED`
  - `BILLING.SUBSCRIPTION.EXPIRED`
  - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- [ ] Anotar el **Webhook ID**.

PayPal tiene que poder llegar a esa URL desde internet. La demo local **no** lo es
por sí sola. Para pruebas: `./tunel_paypal.sh` (abre un túnel público de Cloudflare
al tracker de la demo e imprime la URL del webhook; no instala nada, descarga el
binario en `.tools/`). La URL cambia cada vez que se relanza el túnel: hay que
actualizarla en PayPal. Para producción, la URL es la de Cloud Run.

## 4. Dónde van las credenciales

| Entorno | Lugar |
|---|---|
| Local (Patch, demo) | `tracker/.env` — ignorado por git (verificado) |
| Producción (Cloud Run) | Secret Manager, montado como variables de entorno |

Variables (los valores reales solo en esos dos lugares):

```
PAYMENTS_PROVIDER=paypal
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<client-id>
PAYPAL_CLIENT_SECRET=<secret>
PAYPAL_WEBHOOK_ID=<webhook-id>
```

Desde la TAREA 40, sin estas variables el tracker **no arranca** en producción
(ya no cae en silencio al proveedor de prueba). En local, con emuladores y sin
`PAYMENTS_PROVIDER=paypal`, se sigue usando el proveedor de prueba (mock).

## 5. Pasar a cobros reales (Live)

- [ ] Cuenta Business verificada por PayPal.
- [ ] Repetir los pasos 2 y 3 en la pestaña **Live** (credenciales y webhook nuevos).
- [ ] Cambiar a `PAYPAL_ENV=live` en Secret Manager.
- [ ] Seguir el orden seguro de `DEPLOY.md` (variables primero, deploy sin tráfico,
      comprobar, pasar tráfico).

---

## Pruebas de Rick antes del push

| Flujo | Cómo se prueba | Nota |
|---|---|---|
| Registro con cuenta personal | Demo local | El correo de verificación **no llega a Gmail** con emuladores: el developer entrega el enlace que genera el emulador de Auth. Recibir correos reales exige un proyecto Firebase de pruebas (recurso nuevo en GCP). |
| Pago de cotización | Demo local + PayPal sandbox | Se paga con la cuenta compradora sandbox del paso 2. La cuenta personal de Rick es el usuario de Farmazed, no el pagador. |
| Suscripción (plan global / Empresarial) | Necesita webhook alcanzable | Sin webhook queda en `pendiente`. |
| Cambio de plan (global ↔ Empresarial) | Necesita webhook alcanzable | Con el proveedor de prueba (demo local) se aplica al instante. |

### Qué hace el webhook (aprobado por Rick el 05-oct-2026)

Código: `tracker/services/paypal_webhook.js`. Pruebas: `tracker/tests/webhook_paypal.test.js`.

| Evento | Acción |
|---|---|
| `BILLING.SUBSCRIPTION.ACTIVATED` | Suscripción → `activa`. Si es un cambio de plan, entra en vigor. |
| `BILLING.SUBSCRIPTION.CANCELLED` / `EXPIRED` | Suscripción → `cancelada` |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Suscripción → `suspendida` |
| `BILLING.SUBSCRIPTION.PAYMENT.FAILED` | Pago por revisar (el estado no cambia: PayPal reintenta el cobro) |
| `PAYMENT.CAPTURE.REFUNDED` / `DENIED` | Pago por revisar; la cotización queda marcada con la incidencia |
| `PAYMENT.CAPTURE.COMPLETED` | Se concilia con el pago ya registrado. Si no hay pago registrado, pago por revisar. |

- Cada evento se procesa una sola vez (por `event.id`, colección `paypal_eventos`).
- Los **pagos por revisar** le aparecen al admin en *Mi Bandeja*, con un botón
  "Marcar resuelta". Ningún caso se mueve solo por un reembolso o un cobro denegado:
  lo decide el admin.
- Un evento de una suscripción que no es la vigente de la empresa también va a
  pagos por revisar (podría estar cobrando sin que el portal lo sepa).

### Una sola suscripción por empresa (decisión de Rick, 05-oct-2026)

Una empresa tiene el plan de la plataforma **o** el Plan Empresarial, nunca los dos.
Puede cambiar de uno al otro:

1. La suscripción actual se cobra hasta terminar el ciclo ya facturado.
2. La nueva se crea en PayPal con inicio ese mismo día (el próximo cobro de la actual).
3. Cuando el titular la aprueba en PayPal, el webhook la pone en vigor y cancela la
   anterior. Si no la aprueba, sigue con su plan de siempre.

Código: `tracker/services/suscripciones.js`. Sin webhook alcanzable, un cambio de plan
con PayPal real se queda en "por aprobar".

**No probado contra PayPal real** (falta la app sandbox): que la fecha de inicio
(`start_time`) y el aviso `ACTIVATED` se comporten como dice su documentación. Es lo
primero a comprobar en Sandbox, con una suscripción de prueba y un cambio de plan.

### Checklist para arrancar las pruebas

- [ ] Pasos 1–2 hechos en Sandbox (el paso 3, webhook, solo hace falta para suscripciones).
- [ ] En Patch, crear `tracker/.env` con estas cinco líneas (valores de la pestaña **Sandbox**):

  ```
  PAYMENTS_PROVIDER=paypal
  PAYPAL_ENV=sandbox
  PAYPAL_CLIENT_ID=<client-id>
  PAYPAL_CLIENT_SECRET=<secret>
  PAYPAL_WEBHOOK_ID=sin-webhook
  ```

  `PAYPAL_WEBHOOK_ID` es obligatorio para arrancar. Sin webhook todavía, se deja
  `sin-webhook` (cualquier aviso se rechazaría, y de todos modos PayPal no llega a la demo).
- [ ] Reiniciar la demo (`./demo_local.sh`). Debe decir `Pagos: PayPal REAL (PAYPAL_ENV=sandbox)`.
      Si dice `proveedor de prueba (mock)`, no leyó el archivo.
- [ ] Entrar por `http://localhost:8092/demo.html` (ese origen exacto: PayPal devuelve ahí).
- [ ] Pagar una cotización aceptada con la cuenta **Personal** de sandbox. PayPal devuelve
      al portal, que captura el pago y lo registra.
- [ ] (Para suscripciones y cambios de plan) `./tunel_paypal.sh` + webhook registrado en
      PayPal con esa URL + `PAYPAL_WEBHOOK_ID` real en `tracker/.env` + reiniciar la demo.

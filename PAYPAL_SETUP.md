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
- [ ] En *Sandbox accounts*, ubicar la cuenta **Personal** de prueba (comprador):
      con ella se "paga" en las pruebas, con dinero ficticio.

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

PayPal tiene que poder llegar a esa URL desde internet. La demo local (túnel SSH
desde Argus) **no** es alcanzable por PayPal. Opciones: un túnel público tipo
`cloudflared` (hay que instalarlo) o probar ya desplegado en Cloud Run.

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

### Decisión pendiente: qué hace el webhook

Hoy el webhook solo verifica la firma y lo anota en el log. Propuesta del PM,
**pendiente de aprobación de Rick**:

| Evento | Acción |
|---|---|
| `BILLING.SUBSCRIPTION.ACTIVATED` | Suscripción → `activa` |
| `BILLING.SUBSCRIPTION.CANCELLED` / `EXPIRED` | Suscripción → `cancelada` |
| `BILLING.SUBSCRIPTION.SUSPENDED` | Suscripción → `suspendida` |
| `BILLING.SUBSCRIPTION.PAYMENT.FAILED` | Marcar para revisión del admin |
| `PAYMENT.CAPTURE.REFUNDED` / `DENIED` | Marcar para revisión del admin |
| `PAYMENT.CAPTURE.COMPLETED` | Conciliar con el pago ya registrado |

Cada evento se procesa una sola vez (idempotencia por `event.id`).

### Checklist para arrancar las pruebas

- [ ] Pasos 1–3 hechos en Sandbox.
- [ ] Credenciales sandbox cargadas por Rick en `tracker/.env` en Patch.
- [ ] Avisar al PM → el developer reinicia la demo con `PAYMENTS_PROVIDER=paypal`.
- [ ] (Opcional, para suscripciones) túnel público o deploy de prueba + webhook aprobado.

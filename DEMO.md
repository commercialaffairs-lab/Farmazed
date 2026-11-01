# Modo demo — cuentas de demostración y reinicio

Decisión de Rick (01-nov-2026): dos cuentas públicas para que un prospecto (cliente) o un empleado
nuevo (regente) recorran la plataforma con datos de ejemplo, y un botón **[Reiniciar cuenta demo]**
que lo deja todo como al principio. Conviven con los datos reales de producción: todo lo demo lleva
`demo:true` y cuelga de la empresa `demo-org`; el reinicio borra solo eso.

## Cuentas (producción)

| Cuenta | Rol | Clave | Qué ve |
|---|---|---|---|
| `cliente.demo@farmazed.com` | cliente_titular de "Laboratorios Ejemplo S.A." | `DEMO_PASSWORD_CLIENTE` | Solo su empresa de ejemplo |
| `regente.demo@farmazed.com` | regente | `DEMO_PASSWORD_REGENTE` | Solo los casos de ejemplo que tiene asignados |

No hay admin demo: un admin vería todas las empresas reales. Las acciones de admin del recorrido
(enviar cotización, confirmar pagos, avanzar fases) las hace el admin real de Farmazed si hace falta.
Las claves las fija Rick y **no van en el repo** (es público): `DEMO_PASSWORD_CLIENTE` / `DEMO_PASSWORD_REGENTE` en Secret Manager (Cloud Run) o `tracker/.env` (local). Son obligatorias la primera vez que se siembra; en un reinicio, si faltan, cada cuenta conserva su clave. Rick las comunica a los prospectos por fuera (p. ej. en la página de demo o el manual).

## Estado inicial (lo que deja el seed y cada reinicio)

- Empresa "Laboratorios Ejemplo S.A." (plan registro) **sin captación** y con la captación precargada
  (el cliente la confirma en su primer ingreso: paso 1 del recorrido).
- **Producto Ejemplo 2 — Analgésico 500 mg**: fase 4, cotización **enviada** por B/. 4,130
  (el cliente la acepta y paga con el proveedor de prueba).
- **Producto Ejemplo 3 — Jarabe pediátrico**: fase 8, cotización aceptada y **pagada** (4 conceptos),
  con dos mensajes; el regente confirma el cotejo técnico.
- "Producto Ejemplo 1" **no existe**: lo crea el cliente en "Solicitar Registro".
- Lead "Farmacia Ejemplo" en el CRM del personal (Leads), estado Nuevo.

## Garantías

- **Pagos**: una cuenta demo siempre paga con el proveedor de prueba (`services/payments getProvider(user)`),
  aunque el entorno esté en PayPal sandbox o live. Nunca mueve dinero.
- **Correos**: a `*.demo@` no se envía ningún correo (`services/correo.js`).
- **Reinicio** (`POST /api/demo/reiniciar`, solo cuentas `demo:true`, 1 vez por minuto): borra casos (con
  documentos, mensajes y pagos), cotizaciones, lead e invitaciones de `demo-org`, vuelve a sembrar y
  **revoca las sesiones** de las dos cuentas (hay que volver a entrar: el recorrido arranca de cero).
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

## Pendiente (fases siguientes del plan, `PENDIENTES.md`)

Recorrido guiado con pasos predeterminados (panel "Recorrido demo", acciones fuera del recorrido
ocultas), manual de usuario ES/EN/FR/PT y e2e del recorrido completo.

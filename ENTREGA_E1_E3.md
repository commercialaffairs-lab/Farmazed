# Entrega E1–E3 — para Rick

**29-sep-2026, actualizado 30-sep-2026 (TAREAS 17-19).** Todo lo de este documento vive
en el checkout local, **sin commit ni deploy**. Nada de esto tocó producción
(`farmazed.com`/`api.farmazed.com`) — producción sigue corriendo el código de antes de
esta sesión (auth real de Firebase, pero sin el enum de 21 fases ni el sistema de
roles).

---

## 1. Qué se construyó

### Cliente (portal, `farmazed-web/client-dashboard.html` + wizard)
- Wizard de solicitud (1→4) con checklist dinámico por trámite/subtipo, separado en
  "documentos que subes tú" vs. "documentos que aporta Farmazed".
- Ve sus 21 fases reales con nombres claros (no el enum crudo), su historial, y puede
  subir el documento que Farmazed le pida (antes ese botón no hacía nada).
- Pagos: ve el anticipo (Fase 5) y el saldo (Fase 13) por separado — pagado/pendiente.
- Precios: tarifario con desglose honorarios/tasas, **detrás de un flag apagado**
  (decisión comercial pendiente — ver §4).
- **Mi Empresa** (nuevo): un titular ve a sus miembros e invita nuevos; un miembro ve lo
  mismo sin poder invitar.

### Empleados (`farmazed-web/admin/bandeja.html`, nuevo)
- "Mi Bandeja": solo los casos asignados a ese analista/abogado/regente, con la acción
  pendiente de cada uno (ej. "Revisión legal pendiente").
- Al abrir un expediente, solo ve los botones que su rol permite (nunca duplicado a
  mano — la página pregunta al backend qué puede, `GET /api/me/permissions`).
- Abogado ve resaltados los documentos legales (poder, certificado de libre venta);
  regente, los técnicos. Ambos pueden aprobar/rechazar documentos con motivo.

### Admin (`farmazed-web/admin/`)
- `casos.html`/`expediente.html`: las 14 fases + 3 estados post-presentación, override,
  pagos, versionado de documentos (un rechazo nunca borra el archivo anterior), y ahora
  asignar analista/abogado/regente a un caso.
- `empresas.html` (nuevo): empresas, empleados, y las 3 rutas de invitación con su
  estado.
- `precios.html`: ya no pide una clave compartida — usa la sesión de Firebase con rol
  admin, como el resto.

### Alta de cuentas (sin registro abierto — supuesto del PM, §H.4, pendiente de Rick)
- `farmazed-web/aceptar-invitacion.html` (nuevo, página pública): un link de un solo uso
  crea la cuenta con el rol y la empresa correctos, y entra logueado directo.
- El primer admin de todos (cuando no existe ninguno para invitar) se da con
  `tracker/scripts/bootstrap_admin.js`, credenciales de GCP por línea de comandos —
  nunca por HTTP. La clave compartida que existía para eso (`ADMIN_KEY`) ya no tiene
  ningún lector en el código (ver §3.a).

### Formularios (R14, TAREA 17) — `farmazed-web/formularios/`, `admin/formularios.html`
- Los 13 formularios/declaraciones juradas canónicos, copiados con nombres limpios.
  Firma y aplicabilidad de cada uno salen de leer el texto real de cada `.docx`, no
  solo el nombre del archivo.
- Cliente: en su expediente ve solo los que aplican con certeza a su trámite +
  los que quedaron "por confirmar" (4 de 13 — ver §4), nunca ocultados ni afirmados
  a ciegas.
- Admin: `admin/formularios.html`, la biblioteca completa con los 4 marcados.

### Cotizaciones (R5/R12, TAREA 18) — `admin/cotizaciones.html`, módulo "Cotización" del cliente
- Al definirse vía/categoría (fase_03 → fase_04) se crea/agrega automáticamente una
  línea en el borrador de cotización de la empresa — una cotización agrupa N casos
  de la misma empresa, cada uno conserva su propio `caseCode` (R5).
- Admin ajusta líneas (motivo obligatorio si el monto se aparta del tarifario) y
  envía; el cliente titular (no el miembro) la ve con el desglose honorarios/tasas
  y la acepta o rechaza.
- Nuevo gate: fase_04 → fase_05 exige una cotización aceptada que incluya el caso —
  aplica **siempre**, incluidos casos sin empresa asignada (ver §3, §H.7).

### Paquete IEA (R13, TAREA 19) — advierte, nunca bloquea
- Cuenta páginas de los PDFs que el cliente sube para el paquete IEA (fórmula,
  método de análisis, certificado de análisis, especificaciones, etiquetas) y
  avisa si supera 150 páginas — al cliente al subir, y al staff en el expediente.
  Nunca bloquea la subida ni el avance del caso.

### El flujo canónico pasa a 13 fases, pagos por concepto, precios 24-sep y
### auditoría del checklist (TAREAS 21-26, §H.8/§H.9) — la reescritura más
### grande desde la entrega E1-E3 original

Zelky mandó documentación nueva del flujo (26-sep) que reemplaza el modelo de
14 fases con uno de **13 fases en 5 bloques** (A: contacto/ruta · B: cotización
y pago · C: documentación digital · D: originales físicos · E: presentación y
seguimiento). El PM decidió adoptarlo de inmediato (§H.8) — esto tocó la
máquina de estados, los pagos y (por una auditoría de matrices nuevas de
Zelky) el checklist de documentos.

- **Máquina de estados (TAREA 21)**: `fase_01`…`fase_13` + los estados de
  siempre (draft/submitted/pending_docs/deleted/cerrado/observado_dnfd/
  aprobado/denegado) = 21 estados. Fase 8 ("recepción y revisión de
  documentación digital") exige **dos confirmaciones** — legal (abogado) y
  técnica/matrices (regente) — antes de avanzar; fase 10 la confirma el
  analista. Al entrar a `observado_dnfd` se calcula y muestra la fecha límite
  de subsanación (Regular: 3 meses; Abreviado: 8 días hábiles, Art. 22 D.E.
  27/2024). Migración de las 21 fases viejas escrita y probada
  (`tracker/scripts/migrate_status.js`, dry-run, solo emulador) — no
  hace falta correrla en prod porque nunca hubo casos reales con el modelo
  de 14 fases.
- **Gates de negocio centralizados (TAREA 22)**: un hueco real de
  cumplimiento — Cowork (MCP) podía saltarse la cotización de fase_04 y las
  confirmaciones de fase_08, aunque el sitio web (REST) sí los exigía. Ahora
  los 5 gates (transición válida, pago, cotización, motivo de cierre,
  confirmaciones de fase 8) viven en un solo lugar
  (`tracker/services/transitions.js`) que usan por igual REST, MCP y la
  solicitud de documentos adicionales — ninguna de las tres rutas repite la
  lógica ni puede quedar desactualizada por separado.
- **Pagos por concepto y precios del 24-sep (TAREA 23)**: cada pago del
  cliente ahora se registra por **concepto** (honorarios, tasa DNFD, MEF si
  es extranjero, IEA si aplica) en vez de por "fase" — cheques separados son
  registros separados, como pasa en la vida real. El gate de fase_05 exige
  los conceptos que correspondan según la cotización aceptada del caso. Se
  cargó el tarifario del xlsx del 24-sep (más nuevo que el del 12-sep) —
  **solo en el emulador**, con un informe de diferencias
  (`organizacion/10_DIFF_PRECIOS_24SEP.md`: 3 precios que sí cambiaron, ~39
  categorías nuevas de Renovaciones/Modificaciones, una fila con fórmula rota
  en el xlsx original marcada sin inventar el número). Activarlo en
  producción es una sola variable de entorno (`PRICING_TABLE=24sep`, ver
  Bloque 3 más abajo) — **hoy está apagada**, ningún precio cambió en
  producción con este trabajo.
- **Auditoría del checklist contra las matrices nuevas de Zelky (TAREAS
  24-26)**: Zelky corrigió y amplió sus matrices de requisitos para Síntesis
  Química y Biológicos/Biotecnológicos (28-sep). Se comparó, requisito por
  requisito, contra lo que pedía el checklist de FADDI
  (`organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md`) y se aplicaron las
  correcciones que aprobaste: el pago del IEA ahora depende de si la
  cotización del caso lo marca (no del tipo de medicamento, que era un bug
  real — antes se pedía incluso en Abreviado, donde no aplica), Biológicos y
  Biotecnológicos quedaron con exactamente los mismos requisitos, se
  agregaron 9 documentos que faltaban (con su fundamento legal en la
  descripción), y se agregó un campo `esInnovador` que el staff confirma en
  fase 3 (junto con la vía y la categoría) — de él dependen 2 documentos más
  de Síntesis Química y, a futuro, la categoría "Prioridad para trámites de
  medicamentos innovadores" del tarifario (por ahora sin conectar: la regla
  de cuándo debe aplicar no es obvia y no se quiso inventar).

**Estado de todo esto**: en local, sin commit ni deploy — igual que el resto
de esta entrega. Ver `handover.md` (TAREAS 21-26) para el detalle técnico
completo, y §H.8/§H.9 en `PM_COMMENTS.md` para las decisiones que tomaste tú.

---

## 2. Cómo revisarlo en local — 1 comando

```bash
cd "Proyecto Farmazetd Regulatory"
./verificar_local.sh
```

Levanta emuladores de Firebase, corre la suite de Playwright completa (19 specs — wizard,
13 fases, pagos por concepto, versionado, precios, un test por cada uno de los 6 roles,
formularios, cotizaciones y paquete IEA, con capturas en `sessions/2026-09-29/` y
`sessions/2026-09-30/`) y después la matriz de permisos (76 pruebas endpoint × rol) +
los gates de transición REST/MCP (12) + el gate de pago por concepto REST/MCP (6) +
el checklist ajustado a las matrices de Zelky (22, unitario puro) + el conteo de
páginas del paquete IEA (4, con PDFs reales) + la migración de roles (5), todo contra
el emulador. Apaga todo solo al terminar. Nunca toca producción ni pide credenciales
de GCP.

(`./e2e/run.sh` y `./tracker/scripts/run_permission_tests.sh` son las dos mitades, por si
quieres correrlas por separado. `DEV_LOCAL.md` tiene el detalle de requisitos —
resumen: JDK 21 y el Chromium de Playwright, ambos ya instalados en esta máquina.)

---

## 3. Decisiones que tomé en tu nombre (PM_COMMENTS §H.1–H.4) — revertibles

Todas quedaron registradas ahí con su razón; las repito acá cortas para que las tengas
juntas:

- **§H.1 — Nombres de las 14 fases y 3 estados post-presentación.** ⚠️ **Superado por
  §H.8** (documentación nueva de Zelky, 26-sep): el flujo canónico pasa a 13 fases en
  5 bloques — ver la sección nueva de arriba y §H.8/§H.9 más abajo. Nunca hubo casos
  reales con el modelo de 14 fases, así que no hace falta migrar nada de producción por
  este cambio.
- **§H.2 — Módulo "Precios" del cliente.** Construido pero **apagado por defecto** — 5
  de 13 montos pueden estar subfacturados frente al xlsx canónico
  (`organizacion/05_DIFF_PRECIOS_D09.md`). Pregunta abierta: ¿el cliente debe ver el
  tarifario completo, o solo su cotización puntual?
- **§H.3 — Qué pago bloquea cada fase.** ⚠️ **Superado por §H.8** — el modelo de 13
  fases ya no tiene una "Fase 13 de pago" ni una "Fase 14" (no existen). Ahora todo se
  paga en fase 5, por concepto (honorarios, tasa DNFD, MEF si aplica, IEA si aplica) —
  ver la sección nueva de arriba.
- **§H.4 — Los 6 roles y sus reglas.** Analista confirma fases 7 y 12; abogado la 8;
  regente la 10; override y pagos solo admin. Alta por invitación, sin registro abierto.
  Preguntas abiertas: ¿abogado/regente son empleados Farmazed o externos por caso?
- **§H.6 — Formularios (R14) y renovaciones.** Formularios 1, 2, 3 y 10 quedaron
  "por confirmar" — autorizaciones/declaración genérica sin vía ni tipo de solicitud
  en el texto. Pregunta para Zelky, vía ti: ¿a qué trámites aplican? Renovaciones y
  modificaciones están en el MVP (R16) pero bloqueadas: no hay matriz consolidada de
  Zelky — no se construye el flujo sin checklist (ver §4).
- **§H.7 — Cotizaciones (R5/R12).** El gate de fase_04→fase_05 exige cotización
  aceptada **siempre**, incluso sin empresa asignada (dato sin migrar) — corregiste mi
  primera versión, que lo saltaba y abría un hueco de cumplimiento. `quotes.accept` es
  solo del titular, no del miembro (quien acepta un compromiso de pago es el dueño de
  la cuenta).
- **§H.8 — El flujo canónico pasa a 13 fases (reemplaza §H.1 y §H.3).** Ver la sección
  nueva más arriba para el detalle completo (máquina de estados, gates centralizados,
  pagos por concepto, precios del 24-sep). Decisión tuya, con respaldo documental de
  Zelky (26-sep).
- **§H.9 — Qué se aplica de la auditoría checklist vs. matrices de Zelky.** 5
  decisiones sobre `organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md`: el pago del IEA
  pasa a depender de la cotización del caso (no del tipo de medicamento); 3 documentos
  con el mismo código FADDI quedan marcados para confirmar en la plataforma;
  Biológicos y Biotecnológicos quedan con los mismos requisitos; se agregan 9
  documentos que faltaban, cada uno con su base legal citada; y las 2 preguntas que la
  propia Zelky dejó sin resolver en sus matrices entran como opcionales, sin bloquear a
  nadie mientras se confirman.

Nada de esto es difícil de cambiar — son un `roles` en un claim y una tabla en
`tracker/middleware/permissions.js`, no lógica repartida por el código.

---

## 4. Qué falta / qué está bloqueado

- **UI de aprobar/rechazar precios subfacturados** — bloqueado en decisión comercial
  (§H.2), no técnico.
- **Firma electrónica** — declarado fuera de alcance de E3 (Z21, para E4).
- **Integración pago→documento (B06):** el comprobante de un pago a la autoridad no
  genera automáticamente los 3 documentos del dossier (tasa_servicio/recibo_iea/
  recibo_cnf) — el modelo de datos ya existe (D12), falta la integración.
- **Botones "Subir archivo" del resumen del cliente** — ya conectados (TAREA 13), pero
  la sección "Pendientes" no vuelve a ocultarse sola si se queda vacía tras una
  recarga parcial (bug menor, cosmético).
- **El conteo real de casos por estado en producción** — pendiente de que tú (o alguien
  con acceso) me lo pases; sin eso, dos mapeos de migración de estado siguen
  provisionales (§3).
- **`mcp.js` y `GET /api/admin/pricing`** no pasaron al sistema de roles — usan sus
  propios esquemas de auth (MCP_KEY / público), documentado como decisión, no como
  pendiente.
- **Nota del PM sobre precios:** `GET /api/admin/pricing` es público **desde antes de esta
  entrega** (ya está así en producción): cualquiera puede leer el tarifario completo por la
  API, aunque el módulo "Precios" del cliente esté oculto (§H.2). Si decides que el cliente
  solo ve su cotización, este endpoint debe pasar a requerir rol admin.
- **Ningún deploy, ninguna migración, corrió contra producción** — todo lo de abajo es
  un plan, no una ejecución.
- **Renovaciones sin `tipoSolicitud` (TAREA 17/§H.6):** el wizard fija `tipoSolicitud:
  'Nuevo Registro'` siempre — no hay forma de marcar un caso como Renovación. Los 6
  formularios de renovación/intercambiabilidad/no-comercializados nunca le aparecen a
  un cliente filtrado (sí se ven en la biblioteca completa del admin). Bloqueado por
  falta de la matriz de Zelky, no por falta de tiempo.
- **Categorías de precio sin fila en el tarifario (TAREA 18):** `seed_pricing.js` solo
  tiene filas de medicamentos/Nuevo Registro. Medicamentos Regular + Biológicos/
  Homeopático/Suplementos/Vacuna, y Abreviado + Vacuna/Medio de Contraste/Gas
  Medicinal/Productos Naturales, no tienen categoría propia — su línea de cotización
  queda con `categoriaPrecio: null` y el admin la completa a mano (no se le asigna un
  precio a ciegas).
- **Paquete IEA — 2 de 7 documentos sin id propio (TAREA 19):** "Espectros/
  Cromatogramas" y "Validación Analítica" (Matriz de requisitos IEA) no tienen un
  documento propio en el checklist hoy — no se les inventó uno; el conteo de páginas
  del paquete IEA es un piso (nunca cuenta de más, puede contar de menos si esos dos
  se suben sueltos en la práctica).

---

## 5. Plan de salida a producción (NO ejecutado)

Producción hoy corre el código de **antes** de esta sesión — ni el enum de 21 fases ni
los roles existen ahí todavía. Este es el orden que seguiría, en bloques separados para
poder parar entre uno y otro si algo no cuadra.

### Bloque 0 — antes de tocar nada
1. `git status` en el checkout: confirmar que lo que se va a commitear es exactamente
   este trabajo (nada ajeno mezclado).
2. Correr `./verificar_local.sh` una vez más, en limpio, inmediatamente antes de
   commitear — no confiar en una corrida de hace días.

### Bloque 1 — commits (por partes, no un solo commit gigante)
Sugerido, uno por tarea o grupo de tareas afines (así un `git revert` puntual es posible
si algo específico falla después):
1. Máquina de estados de 21 fases (TAREA 7, 7b) + UI D18/D19 (TAREA 8).
2. D10/D11 (responsable de documento) + fix de `renderStep2()` + D13 precios (TAREA
   9-10).
3. Feature flag de Precios (ajuste TAREA 10).
4. D12 pagos + su corrección de §H.3 (TAREA 11).
5. Prueba E2E completa + los 3 bugs que encontró y arregló (TAREA 12).
6. Conectar "Subir archivo" de Pendientes (TAREA 13) + versionado de documentos
   (ajuste).
7. E3 backend: roles, permisos, invitaciones (TAREA 14).
8. E3 UI: bandeja, empresas, aceptar-invitación, Mi Empresa, migración de precios.html
   (TAREA 15).
9. Cierre: `admin.set_role` con auditoría, `bootstrap_admin.js`, tabla de permisos
   completa (TAREA 16).
10. R14: biblioteca de los 13 formularios, filtrada para el cliente, completa para
    el admin (TAREA 17).
11. R5/R12: cotizaciones — borrador automático, ajuste, envío, aceptación, gate de
    fase_04→fase_05 (TAREA 18 + ajuste §H.7).
12. R13: conteo de páginas del paquete IEA, advertencia sin bloqueo — trae la
    dependencia nueva `pdf-lib` (TAREA 19, ver nota en Bloque 3).

Cada commit, antes de subirse: `./verificar_local.sh` en verde sobre ESE punto del
historial (no solo al final).

### Bloque 2 — migraciones, con dry-run primero
Ambas migraciones ya soportan `--dry-run` (no escriben nada, solo muestran qué harían) —
correrlas así PRIMERO, contra producción, es lectura pura:

```bash
# Contra producción de verdad — leer, no escribir:
FIRESTORE_EMULATOR_HOST=  # (vacío/sin definir: apunta a Firestore real)
GOOGLE_APPLICATION_CREDENTIALS=<tu key de servicio> \
FIREBASE_PROJECT_ID=farmazed \
node tracker/scripts/migrate_status.js --dry-run

GOOGLE_APPLICATION_CREDENTIALS=<tu key de servicio> \
FIREBASE_PROJECT_ID=farmazed \
node tracker/scripts/migrate_roles.js --dry-run
```

Ambos scripts hoy se **niegan** a correr sin `FIRESTORE_EMULATOR_HOST` — ese guard hay
que quitarlo (o pasar por encima con una bandera) a propósito, en el momento de usarlos
de verdad contra producción, no antes. Revisar la salida del dry-run de
`migrate_status.js` con cuidado: `in_review`/`faddi_ready` son provisionales (§H.1) —
si el conteo real de producción no coincide con lo esperado, PARAR y no migrar hasta
resolver eso.

Solo si el dry-run se ve bien: correr ambos sin `--dry-run`, en ese orden (estados
primero, roles después — la migración de roles hace un backfill de `orgId` sobre casos
que ya deberían tener su `status` correcto).

### Bloque 3 — deploy (tracker primero, web después)
**Nota (TAREA 19):** `tracker/package.json`/`package-lock.json` ahora incluyen
`pdf-lib` (pura JS, sin bindings nativos — cuenta páginas de PDF para el paquete IEA,
R13). El build del tracker corre `npm install` desde ese `package.json`, así que se
resuelve solo — no hace falta ningún paso manual, pero conviene confirmar en el log
del build que `pdf-lib` se instaló antes de dar el deploy por bueno.

Mismo patrón que el deploy anterior (ver handover.md, "Deploy a producción"):
```bash
# 3a — Tracker
gcloud builds submit --tag gcr.io/farmazed/farmazed-tracker --project farmazed
gcloud run deploy farmazed-tracker --image gcr.io/farmazed/farmazed-tracker \
  --service-account farmazed-api-sa@farmazed.iam.gserviceaccount.com \
  --allow-unauthenticated --port 8080 --region us-central1 --project farmazed
curl -s https://api.farmazed.com/health   # debe dar 200

# 3b — farmazed-web (solo después de confirmar 3a)
gcloud builds submit --tag gcr.io/farmazed/farmazed-web --project farmazed
gcloud run deploy farmazed-web --image gcr.io/farmazed/farmazed-web \
  --allow-unauthenticated --port 80 --memory 256Mi --region us-central1 --project farmazed
```
Verificar después: `farmazed.com/login.html`, `farmazed.com/admin/casos.html`,
`farmazed.com/aceptar-invitacion.html` (200 en los tres) y que `bootstrap_admin.js`
corrido contra prod deje al menos una cuenta admin real antes de que alguien la
necesite.

**Nota (TAREA 23) — tarifario del 24-sep, apagado por defecto.** El deploy de
arriba deja el tracker con el tarifario de SIEMPRE (`seed_pricing.js`, 12-sep) —
`resolverCategoriaPrecio()` solo usa las categorías más finas del xlsx del
24-sep (organizacion/10_DIFF_PRECIOS_24SEP.md: 3 precios que sí cambiaron,
~39 categorías nuevas de Renovaciones/Modificaciones) cuando la variable de
entorno `PRICING_TABLE` vale exactamente `24sep`. Hoy en Cloud Run esa variable
no existe, así que no hay ningún cambio de precio en producción con este
deploy. Cuando Rick apruebe el tarifario nuevo (y alguien cargue esas
categorías en la colección `pricing` de producción — hoy solo viven en el
seed del emulador, `tracker/scripts/seed_pricing_24sep.js`, nadie las sembró
en prod todavía), activarlo es:
```bash
gcloud run services update farmazed-tracker --region us-central1 --project farmazed \
  --update-env-vars PRICING_TABLE=24sep
```
Revertir es la misma orden con `PRICING_TABLE=legacy` (o quitando la variable).

### Cómo volver atrás
- **Deploy:** Cloud Run guarda las revisiones anteriores — `gcloud run services
  update-traffic farmazed-tracker --to-revisions <revisión-vieja>=100` (y lo mismo para
  `farmazed-web`) regresa el tráfico sin rehacer el build.
- **Migración de roles:** es aditiva (agrega `role`/`orgId`, no borra `admin:true`) —
  revertirla del todo significaría quitar esos claims a mano por cuenta; no hay un
  script de "deshacer" hoy. Si hiciera falta, es una lista corta (una query por
  `role` no vacío) y unos `setCustomUserClaims` para limpiarlo.
- **Migración de estados:** tampoco tiene "deshacer" automático — el mapeo queda en el
  log de la corrida (qué caso pasó de qué status a cuál), así que revertir manualmente
  es posible si hace falta, pero no es un botón.
- **Commits:** `git revert` del commit puntual del bloque que falló, no un `reset`
  general — los bloques 1-12 de arriba están pensados para que esto sea quirúrgico.

---

## 6. Última verificación en local (30-sep-2026, tras TAREAS 17-26)

```
./verificar_local.sh
══════════════════════════════════════════════════════════
✅ Backend en verde. Playwright: 1 flake conocido, ver nota abajo.
══════════════════════════════════════════════════════════
```

- **Backend: 125/125** (`node --test`, sin emulador de navegador) — matriz de permisos
  (76, subió con `cases.edit_via_categoria` de TAREA 26), gates de transición REST/MCP
  (12), gate de pago por concepto REST/MCP (6), checklist ajustado a las matrices de
  Zelky (17 + 5, TAREAS 25/26), conteo de páginas del paquete IEA (4), migración de
  roles sobre cuentas legacy (5).
- **Playwright: 18-19/19** según la corrida — 19 specs (wizard/13 fases, pagos por
  concepto, versionado, precios, 6 roles, formularios, cotizaciones, paquete IEA,
  recibo IEA dinámico). Capturas en `sessions/2026-09-29/` y `sessions/2026-09-30/`.

**Nota sobre el flake de login/logout (TAREA 26, parte 1).** Un puñado de specs
fallaban de forma intermitente al cerrar sesión y volver a entrar como otro usuario,
con síntomas distintos cada vez ("Execution context was destroyed", "net::ERR_ABORTED",
"Invalid or expired token"). Encontré y arreglé 2 causas reales:
1. Los specs disparaban `logout()` (que navega a `login.html`) desde dentro de
   `page.evaluate()` sin dejar que Playwright armara la espera de navegación ANTES —
   una condición de carrera conocida de Playwright, corregida en los 9 archivos que la
   tenían.
2. `getToken()` en `portal/js/auth.js` confiaba en una variable que Firebase llena de
   forma asíncrona tras un redirect — si algo pedía un token justo después de entrar
   a una página nueva, podía devolver `null` antes de tiempo. Esto es un bug de
   producción real, no solo de las pruebas (un usuario real haciendo clic muy rápido
   tras iniciar sesión podría toparse con lo mismo) — arreglado con
   `auth.authStateReady()` (API de Firebase pensada exactamente para esto).

Con esos 2 arreglos, más un tercero de infraestructura (el servidor estático de las
pruebas arrancaba con un `sleep 1` sin verificar que ya estuviera escuchando),
la corrida completa pasó limpia varias veces. Pero en corridas hechas con la máquina
bajo carga alta (18 usuarios conectados a la vez, load average de hasta 16, swap al
100%) todavía aparece, siempre distinto, siempre en el primer test de la corrida —
nunca en una corrida aislada del mismo spec. No hay una 4ª causa de código que
corregir ahí: es la máquina compartida, no la aplicación. No agregué reintentos ni
subí timeouts (instrucción explícita) porque eso habría escondido el síntoma sin
arreglar nada. Si hace falta una corrida 100% limpia para algo puntual, mejor en un
momento de menos carga en Patch.

Respaldo del trabajo sin commitear (fuera del repo, mismo método que siempre):
`~/respaldo-farmazed/2026-09-30c/cambios.patch` + `untracked.tar.gz`.

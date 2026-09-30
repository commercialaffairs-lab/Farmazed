# 08 — Prueba E2E completa, cierre de E2 (D16)

**Generado:** 2026-09-29 · dev en Patch, contra el emulador Firebase (Auth/Firestore/Storage).
**Encargo (TAREA 12):** un solo spec de Playwright (`e2e/flujo_completo.spec.js`) que recorra un
caso de medicamentos (Síntesis Química, vía Regular) de punta a punta, tal como lo viviría
Zelky: cliente se registra → wizard → sube documentos → admin recorre las 14 fases + los 2 pagos
del cliente + el pago a la autoridad + una subsanación real → aprobado, con el cliente entrando
3 veces a verificar lo que ve.
**No se hizo commit ni deploy.** Todo corre contra `demo-farmazed` (emulador), nunca contra prod.

---

## 1. Qué se probó

Un solo test, `e2e/flujo_completo.spec.js`, ~35-40s de ejecución real:

1. **Registro real de cliente** — no hay página de registro en el producto (ver §3), así que se
   invocó `register()` de `portal/js/auth.js` directamente desde el navegador (mismo patrón que
   ya usan otros specs para `logout()`), con un email único por corrida.
2. **Wizard completo, 1→4**, trámite `medicamentos`, subtipo `Síntesis Química`, vía `Regular`
   (default). **Los 15 documentos obligatorios del cliente se subieron uno por uno via UI real**
   (no por batch a Firestore, a diferencia de `checklist.spec.js` — esta prueba quería la carga
   real completa, no solo probar el mecanismo de upload).
3. **Envío del expediente** (`status: 'submitted'`).
4. **Cliente check #1** (recién enviado): fase "Enviado", 0 pagos, ve sus propios documentos.
5. **Admin recorre `fase_01` → `fase_05`**, registra el pago de anticipo
   (`cliente_a_farmazed`, `fase: 'fase_05'`), avanza a `fase_06` → `fase_07`.
6. **Fase_07 (control de calidad):** el admin solicita un documento aclaratorio adicional
   (`otros_docs`, opcional) → el caso pasa a `pending_docs`.
7. **Cliente check #2**: ve la solicitud pendiente en "Resumen" (`#sec-pendientes`, con el
   mensaje exacto del admin) y, en "Mis Productos", ve el anticipo (fase 5) ya pagado y el saldo
   (fase 13) todavía pendiente, en la misma tarjeta.
8. **Admin retoma**: `pending_docs → fase_07 → fase_08 → fase_09 → fase_10`.
9. **Subsanación real**: `fase_10 → fase_07` (vuelta atrás) → `08 → 09 → 10` de nuevo — el ciclo
   completo de control-de-calidad-encuentra-algo-y-se-corrige, no solo el salto aislado.
10. **`fase_11 → fase_12`** (control físico) **→ `fase_13`**, pago de saldo
    (`cliente_a_farmazed`, `fase: 'fase_13'`) → **`fase_14`**, pago a la autoridad
    (`farmazed_a_autoridad`, `DNFD`) → **`aprobado`**.
11. **Cliente check #3** (final): ve "¡Registro aprobado!" y **ambos** pagos (fase 5 y fase 13)
    como Pagado.

21 capturas, una por paso nombrado arriba, en `sessions/2026-09-29/NN-flujo-*.png`.

**Resultado:** verde. La suite completa (`./e2e/run.sh`, 8 specs — checklist, estados,
flujo_completo, 3×payments, 2×pricing) también corre completa en verde.

---

## 2. Bugs de producto encontrados y arreglados

Los tres se encontraron *viviendo* el flujo como cliente/admin reales, no leyendo código — cada
uno hacía que un paso legítimo de la prueba fallara.

### 2.1 El caso recién creado quedaba invisible para el cliente tras enviarlo

`portal/js/wizard.js`, paso 5: en el modo **embebido** (el wizard dentro de
`client-dashboard.html`, que es el que usa el producto real — `nuevo.html` standalone es el modo
viejo), al enviar el expediente el código solo cambiaba de módulo a "Mis Productos"
(`showModule('productos')`) **sin recargar la página**. `DATA.productos` se carga una única vez
al abrir `client-dashboard.html`, **antes** de que el caso nuevo existiera — así que el cliente
nunca veía su propio expediente recién enviado hasta refrescar la página a mano. El modo
standalone sí recargaba (`window.location.href`), por eso nunca tuvo este bug.
**Arreglo:** unificar ambos modos para que siempre recarguen — una recarga completa es la única
forma simple de garantizar datos frescos. *(`portal/js/wizard.js`, `nextStep()` paso 5.)*

### 2.2 La confirmación final (Paso 5) asustaba al cliente con documentos que no son suyos

`renderConfirmation()` contaba como "faltantes" **todo** el checklist obligatorio sin filtrar por
`responsable` — así que un cliente que subió sus 15 documentos igual veía
"⚠️ Documentos obligatorios faltantes (3)" listando `tasa_servicio`/`recibo_cnf`/`recibo_iea`,
que son tarea interna de Farmazed (D10/D11), como si él se hubiera dejado algo.
**Arreglo:** filtrar `missing` por `d.responsable !== 'farmazed'`, igual que ya hacen
`updateNextButtonState()` y `renderChecklist()` en el mismo archivo. *(`portal/js/wizard.js`,
`renderConfirmation()`.)*

### 2.3 El admin no podía salir de "Documentos pendientes" sin marcar un override falso

`admin/expediente.html`, `buildStatusOptions()`: el desplegable de estado se construye leyendo
`statusMeta.transitions[current]`, el mapa **estático** de `case_status.js`. Pero `pending_docs`
es a propósito un comodín en `isValidTransition()` (D07) — se puede salir hacia **cualquier**
estado sin override, porque no hay forma de saber a qué fase volver — y por eso **no tiene
entrada** en ese mapa estático. Resultado: el desplegable solo ofrecía `pending_docs` como opción,
obligando al admin a marcar "Forzar (override)" y escribir un motivo **que el backend después
descartaba en silencio** (`isValidTransition` ya daba `true`, así que nunca se registraba como
override real). Confirmado con el propio spec: `optionsPendingDocs` ya incluye `fase_07` sin
override, y el historial de esa transición queda sin el badge `override`.
**Arreglo:** el desplegable trata `current === 'pending_docs'` igual que `override` marcado —
ofrece los 21 estados. *(`admin/expediente.html`, `buildStatusOptions()`.)*

---

## 3. Lo que NO se pudo probar (depende de prod, de Zelky, o es alcance futuro)

- **No existe una página de registro de clientes en el producto.** `register()` existe en
  `portal/js/auth.js` pero ningún HTML la invoca — `login.html` solo tiene el formulario de
  login. Se probó el registro llamando la función directamente desde el navegador (funciona
  correctamente, incluye `displayName` en el token), pero un cliente real hoy no tiene cómo
  registrarse por su cuenta. Gap de alcance, no un bug — no se construyó la página porque no fue
  pedida en esta tarea.
- **Los botones "Subir archivo" de la sección "Pendientes" (Resumen) no hacen nada** —
  `pendActionBtn()` los genera sin `onclick`. La única forma real de que el cliente suba el
  documento que el admin pidió es volver a entrar al wizard con `?caseId=` en la URL (funciona,
  ya lo prueba `checklist.spec.js`), pero no hay un link visible que lo lleve ahí. Esta prueba
  cubrió el lado del admin y lo que el cliente *ve* (documento pendiente + mensaje), no que el
  cliente lo resuelva — eso requeriría además arreglar este botón, que es alcance nuevo, no un
  bug de esta tarea puntual.
- **El pago `farmazed_a_autoridad` no alimenta los 3 documentos del dossier** (`tasa_servicio`,
  `recibo_iea`, `recibo_cnf`) que PM_COMMENTS §9 menciona — eso es **B06** (integración), no D12
  ni D16; el propio `organizacion/03` dice de D12 "es el modelo, no la integración". Se registró
  el pago y se verificó el gate de `fase_14`, pero el dossier sigue sin el documento generado
  automáticamente a partir de ese comprobante.
- **FADDI real (sisregsan.minsa.gob.pa)** — fuera de alcance de cualquier prueba automatizada;
  el "Abrir en Cowork" del admin sigue siendo manual, como siempre.
- **Los montos de los pagos son simbólicos** (2290/2290/500) — no se probó contra los montos
  reales de `seed_pricing.js` porque D12 no ata `monto` a ninguna categoría de precio; es un
  campo libre que el admin llena a mano, tal como especifica el modelo.
- **Conteo real de casos en producción** por fase — sigue pendiente de Rick (ver PM_COMMENTS
  §H.1), no cambia con esta prueba.

---

## 4. Estado de archivos

Nuevo: `e2e/flujo_completo.spec.js`, este documento.
Modificados (bugs 2.1/2.2/2.3): `farmazed-web/portal/js/wizard.js`, `farmazed-web/admin/expediente.html`.
Sin commit, sin deploy. Servicios de prueba detenidos, puertos liberados, `config.js` intacto.

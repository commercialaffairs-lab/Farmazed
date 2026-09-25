# 04 — ROADMAP Y DECISIONES (Fase 4 de 4)

**Generado:** 2026-09-20 (corrida nocturna del PM en Patch)
**Insumos:** `organizacion/01_INVENTARIO_DRIVE.md`, `organizacion/02_MAPA_DATA.md`,
`organizacion/03_INSTRUCCIONES_DEV.md`, `PM_COMMENTS.md` (Parte 0, nota de alcance, Partes A/B/C).
**Naturaleza del documento:** plan del PM. Las semanas son **estimacion**, no compromiso — ver aviso abajo.

> ### Aviso sobre las estimaciones
> Todas las cifras en "semanas de developer" de este documento son **estimacion del PM hecha por lectura
> estatica del codigo y de la documentacion**. No estan calibradas contra la velocidad real de ningun
> developer, nadie las ha aceptado, y **no constituyen un compromiso de entrega**. Asumen **un** developer
> a tiempo completo. El primer punto de recalibracion honesto es el final de E1: ahi habra datos reales.

---

## Premisa de todo el plan: el alcance que se decidio no es el que esta construido

La nota de alcance de `PM_COMMENTS.md` lo dice y esta Fase 4 lo confirma con numeros. Lo que existe hoy:
registro nuevo de medicamentos y cosmeticos, vias Regular y Abreviado, un rol de cliente mas un flag de
admin, checklist dinamico por subtipo, carga de documentos (y esa carga **esta rota** — 500 en el Paso 4).

Lo que las decisiones del **14 de septiembre** agregan encima: dos flujos nuevos (renovaciones y
modificaciones), un septimo tramite (intercambiabilidad), tres vias nuevas, un modelo de permisos de cuatro
roles con organizaciones multiusuario, la migracion a 14 fases, una pasarela de pago, un motor de
cotizaciones agrupadoras, una vista simplificada, una biblioteca de formularios y conteo de paginas.

**De esos diez frentes, cinco no se pueden construir hoy porque el insumo regulatorio no existe en el Drive.**
La Fase 2 lo cuantifico: **8 filas FALTA**, de las cuales 6 son materia que solo Zelky puede producir.

> Por eso el roadmap **no** es "construir el alcance decidido en N semanas". Es: **E1 y E2 cierran y
> estabilizan lo que ya existe** (y no dependen de nadie externo), **E3 construye el alcance nuevo que si
> tiene insumo**, y **E4 es una bolsa que no arranca hasta que llegue material que hoy no existe.**

---

# ETAPAS

## E1 — Piso tecnico: versionar, desbloquear el wizard y fijar la maquina de estados

**Alcance.** Todo lo que no depende de Zelky, de Rick ni de un proveedor. Es el bloque 0 al 2 y el 4 al 5 de
`03_INSTRUCCIONES_DEV.md`: D01, D17, D02→D03→D04, D05→D06→D07, D08→D09, D14, D15.

**Entregable concreto.**
1. Repositorio con el working tree limpio y pusheado (hoy hay **2,807 lineas sin commitear** y cinco rutas
   sin versionar, en **una sola maquina**).
2. `GET /api/cases/:id/documents` devolviendo 200, con el Paso 4 del wizard cargando documentos de verdad.
3. `tracker/data/case_status.js` con los 18 estados (14 fases + 4 operativos), validado en el backend y con
   los casos existentes migrados.
4. Un documento de dos paginas que responde, en binario: si `seed_pricing.js` corrio en produccion, y cuantos
   de los 13 precios difieren del xlsx canonico del 12 de septiembre.
5. Dos palancas: el guard de sincronia `TIPOS_MED`↔`MED_VARIABLE_BY_SUBTYPE` y las vias declarativas con flag
   `disponible`.

**Criterio de salida.**
- `git status` limpio y `git log origin/main -1` mostrando el commit; `repo/` ya movido a `_to_delete/`.
- `curl` autenticado a `/documents` → **200**; caseId inexistente → **404**; token de otro cliente → **403**.
- `PATCH /api/cases/<id>` con `{"status":"fase_99"}` y token admin → **400**. Query de casos con status fuera
  de `CASE_STATUSES` → **0 resultados**. La migracion corrida dos veces da `0 cambian` la segunda vez.
- `node tracker/scripts/check_subtypes.js` sale con codigo 0; borrando una clave sale con codigo 1.
- El diff de precios existe como tabla de 13 filas con columna "coincide S/N".

**Dependencias.**
- *Tecnicas:* ninguna hacia afuera. D06 importa de D05, D07 migra a lo que D05 define, D03 depende del stack
  trace que captura D02, D09 depende del resultado binario de D08.
- *Personas:* **una sola, y es de Rick**: el developer necesita acceso de **lectura** al proyecto Firestore
  `farmazed` para D08. Sin eso, D08 y D09 se caen de E1 y pasan a E2.
- *Riesgo no cerrado:* `03` declara que **no reviso `tracker/routes/mcp.js` (553 lineas) ni
  `farmazed-web/admin/`**. Si el panel admin tiene su propia lista de estados hardcodeada, D06 la rompe y E1
  crece. Presupuestar esa verificacion **dentro** de E1, no despues.

**Estimacion del PM: 3 a 4 semanas de developer.** El rango es amplio a proposito: D03 es la unica tarea del
roadmap cuya causa raiz **nadie conoce todavia**. Si el 500 resulta ser configuracion de Storage, son horas;
si es el modelo de datos de Firestore, es una semana sola.

---

## E2 — Cerrar el flujo que ya existe, con R19 aplicada, y probarlo de punta a punta por primera vez

**Alcance.** El bloque 3 y el 6 de `03`: D10→D11, D12 en paralelo, D13, y D16. Mas el bloque de los 12 puntos
de `observations/paso2_ux_dropdowns.md` (7 campos faltantes del Paso 2, dropdowns en cascada), que
`03` recomienda explicitamente meter **despues** de D16 y no intercalado.

**Entregable concreto.** Un cliente real, con cuenta real, puede llevar un registro nuevo de medicamento por
via Regular o Abreviado desde el alta hasta el submit, viendo un costo desglosado en honorarios Farmazed
frente a tasas oficiales, **sin que el portal le pida tres comprobantes que no puede aportar**.

**Criterio de salida.**
- `GET /checklist` devuelve `responsable` en **todos** los documentos (contar los que no lo traen: **0**), con
  `tasa_servicio`, `recibo_iea` y `recibo_cnf` en `"farmazed"`.
- En un caso donde lo unico que falta son esos tres, el boton de continuar esta **habilitado**.
- `POST .../payments` distingue `cliente_a_farmazed` de `farmazed_a_autoridad` y exige `autoridad` en el
  segundo; el listado devuelve los dos eventos como registros separados.
- La pantalla de costo muestra tres cifras cuya suma cuadra, probado en tres categorias distintas.
- **El checklist D16 firmado, con captura por cada uno de los siete puntos.** Esta prueba **nunca se ha
  hecho**; contar con que abre bugs nuevos y reservar capacidad para ellos dentro de E2.

**Dependencias.**
- *Tecnicas:* **E1 completa**. D11 necesita D10. D16 necesita que D03 este arreglado — correr la prueba antes
  solo reconfirma el 500 que ya conocemos.
- *Personas:* ninguna bloqueante para construir. Pero **Z5 (Suplementos pide cuatro documentos que la matriz
  no lista) y Z6 (estructura de poderes)** deberian estar contestados **antes de D16**, o la prueba
  end-to-end valida un checklist que sabemos incorrecto. **Z10** (faddiCode de "Contrato de Fabricacion",
  hoy `PENDIENTE_VERIFICAR`) bloquea **salida a produccion**, no la construccion.

**Estimacion del PM: 3 a 4 semanas de developer**, de las cuales **al menos una** hay que reservarla para lo
que saque D16. El bloque de `paso2_ux_dropdowns` puede sumar 1 a 2 semanas mas si Rick lo quiere dentro.

> **E1 + E2 es la primera entrega que recomiendo.** Razonamiento en la seccion "Primera entrega" mas abajo.

---

## E3 — El alcance nuevo del 14 de septiembre que **si** tiene insumo para construirse

**Alcance.** Los frentes de la nota de alcance que no dependen de material regulatorio faltante:
- **R6 + R7** — modelo de permisos de cuatro roles (cliente/titular, analista, admin/direccion, abogado +
  farmaceutica regente) y organizaciones con varios usuarios. Hoy el modelo solo distingue admin de no-admin.
  **Sin la parte de firma** — esa es Z21 y vive en E4.
- **R5 + R12** — entidad de cotizacion por encima del caso, que agrupa N casos, con borrador automatico que
  Farmazed ajusta y envia. Es cambio de modelo de datos, no de interfaz.
- **R9** — vista simplificada del cliente (hitos agrupados) sobre el enum de 14 fases de E1.
- **R8** — avance automatico de fases donde la condicion es verificable, **manual en las Fases 7, 10 y 12**
  (son los puntos de control de calidad regulatoria del flujo de Zelky; automatizarlos elimina el control).
- **R14** — biblioteca de los 13 formularios, descargables filtrados por tramite.
- **R13** — conteo de paginas del IEA: cuenta y advierte, **no bloquea**.

**Entregable concreto.** Portal multiusuario por empresa, con cuatro roles con permisos distintos, cotizacion
que agrupa productos, y el cliente viendo su expediente en hitos en vez de en 14 estados internos.

**Criterio de salida.** Matriz de permisos probada rol por rol: para cada uno de los cuatro roles, una lista
explicita de que endpoint puede y no puede llamar, con un test por celda. Una cotizacion que agrupa tres
casos y los tres siguen teniendo su `caseCode` propio. Las Fases 7, 10 y 12 **no** avanzan solas.

**Dependencias.**
- *Tecnicas:* **E1 completa** (R8 y R9 se construyen sobre el enum de estados; sin el no hay sobre que
  agrupar hitos). E2 **no** es prerequisito tecnico duro de E3 — se podrian solapar si hubiera dos
  developers, pero con uno solo no hay motivo para intercalarlos.
- *Personas:* **R14 depende de que los 13 formularios esten identificados** — la Fase 1 los inventario en
  `Operaciones/Formularios/`, pero nadie confirmo que esos 13 sean exactamente los 13 de R14. Verificarlo
  antes de empezar. El **motor de notificaciones queda fuera de E3**: la Fase 2 lo registro como FALTA #8
  (no existen las plantillas de notificacion de las 14 fases) y sin plantillas no hay que enviar.

**Estimacion del PM: 6 a 8 semanas de developer.** Es la etapa mas grande y la menos precisa de las cuatro,
porque el modelo de permisos toca practicamente todos los endpoints existentes. Si Rick necesita un numero
para presupuestar, este es el que mas conviene revisar despues de E1.

---

## E4 — Lo que no arranca hasta que llegue algo de afuera

Esta etapa **no tiene fecha de inicio** porque no depende del developer. Tiene dos frentes independientes
entre si, y cada uno arranca cuando llega su insumo.

### E4-a — Frente regulatorio (depende de **Zelky**)

| que | por que esta bloqueado | quien lo destraba |
|---|---|---|
| **Renovaciones** y **modificaciones** (R2/R16, en el MVP) | no hay matriz consolidada de ninguno de los dos (FALTA #3 y #4) | Zelky |
| **Intercambiabilidad** como 7.º tramite (R3) | ya tiene precio (`intercambiabilidad`, $3,830) y **no tiene checklist** | Zelky |
| **Via WLA** (R4) | la matriz existe pero la Fase 2 la marco **no validada**; construir sobre ella es riesgo regulatorio | Zelky |
| **Via WHO-PQP** (R4) | **no existe absolutamente nada en el Drive. Cero.** (FALTA #2 y #7) | Zelky, o Rick la saca del alcance |
| **Motor de notificaciones** | no existen las plantillas de las 14 fases (FALTA #8) | Zelky / Rick |
| **Impacto de la Res. 985/2025** | derogo la 385 y la 386; **6 documentos del Drive confirmados** siguen citando la norma derogada | Zelky |

**Lo unico que se puede adelantar hoy:** el lado de **precios** de renovaciones y modificaciones ya existe en
`seed_pricing.js` (`renovacion`, `modificacion_expedicion`, `post_rs_modificacion`, `cambio_rep_legal`), asi
que el calculo de costo se puede dejar montado. **El checklist no.** Y D15 (E1) deja las vias declaradas con
`disponible: false`, de modo que encenderlas despues sea cambiar un booleano.

**Estimacion del PM, condicional: 6 a 10 semanas de developer contadas *desde* que Zelky entregue el
material**, y solo si entrega todo junto. Si entrega por goteo, el numero sube por el costo de retomar
contexto. **No es estimable hoy en terminos de calendario.**

### E4-b — Pasarela de pago (depende de **Rick** y del **proveedor**)

Bloqueada por B06: no hay proveedor elegido, ni pais de cuenta, ni moneda, ni contrato, ni credenciales de
sandbox. **Lo que absorbe el golpe mientras tanto es D12 (E2)**: el modelo de los dos eventos de pago con
registro manual por admin. Cuando llegue la pasarela, se le enchufa el webhook al evento
`cliente_a_farmazed` y el resto del modelo no se toca.

**Estimacion del PM: 2 a 4 semanas de developer** desde que existan credenciales de sandbox, mas el tiempo de
conciliacion y requisitos de seguridad, que **no** es tiempo de developer y no lo estoy contando.

---

# QUE ENTRA EN LA PRIMERA ENTREGA Y QUE SE POSTERGA

## Recomendacion: la primera entrega es **E1 + E2**

**Entra:** repositorio sano, wizard funcionando de punta a punta, las 14 fases como enum validado con los
casos migrados, R19 aplicada (Farmazed cobra y desembolsa, el cliente deja de ver documentos que no puede
aportar), desglose de honorarios frente a tasas oficiales, registro manual de los dos eventos de pago, y la
primera prueba end-to-end de la historia del proyecto.

**Razonamiento — tres motivos, en orden de peso:**

1. **Hoy el portal esta roto en produccion para el cliente, en dos puntos distintos, y ninguno de los dos
   depende de Zelky.** El Paso 4 devuelve 500 y no carga documentos; y el checklist le pide al cliente tres
   comprobantes (`tasa_servicio`, `recibo_iea`, `recibo_cnf`) que **por decision R19 ya no son suyos**, y le
   bloquea el avance con ellos. Entregar alcance nuevo sobre un flujo roto es construir sobre arena.
2. **El costo de la migracion de estados crece todos los dias.** Cada caso nuevo creado con el modelo viejo
   es un caso mas que migrar. D05–D07 es mas barato esta semana que el mes que viene, y es un costo que solo
   sube.
3. **E1 y E2 son la unica parte del alcance total que no tiene ni un solo bloqueo externo.** Se pueden
   contratar y arrancar manana sin esperar una sola respuesta. Todo lo demas tiene, en algun punto, una
   dependencia de Zelky, de un proveedor o de una decision de Rick.

## Se postergan explicitamente, y por que

| que se posterga | a donde | razon |
|---|---|---|
| **WHO-PQP** | E4-a, o **fuera del alcance** | no existe **nada**: ni matriz, ni hoja de chequeo, ni notas. No es "falta pulirla", es que no hay de donde partir |
| **WLA** | E4-a | la matriz existe pero **no esta validada**. Construir el checklist sobre material no validado es riesgo regulatorio con el cliente final, no deuda tecnica |
| **Renovaciones, modificaciones, intercambiabilidad** | E4-a | estan **dentro** del MVP por R2/R3/R16, pero no hay matriz consolidada de ninguno. El precio ya existe; el checklist no |
| **Pasarela de pago** | E4-b | no hay proveedor. D12 cubre la necesidad operativa con registro manual mientras tanto |
| **Modelo de permisos de 4 roles** | E3 | es grande y toca casi todos los endpoints, pero **no bloquea a un cliente hoy**. Un flujo roto si |
| **Notificaciones** | E4-a | no existen las plantillas de las 14 fases |
| **Los 12 puntos de `paso2_ux_dropdowns.md`** | final de E2 | son reales y estan bien documentados, pero **compiten con el camino critico**, y algunos catalogos dependen de material que Zelky no ha entregado |
| **Firma electronica de abogado y regente** | E4-a | Z21: no se sabe si la DNFD acepta firma electronica. El resto del modelo de permisos (E3) se construye sin ella |

---

# MAPA DE DEPENDENCIAS

Que no puede empezar hasta que termine que. Solo dependencias **reales**; donde no hay, lo digo.

```
D01 (commit+push)
  └─> TODO LO DEMAS. Tres de los archivos que toca el backlog (wizard.js, cases.js,
      faddi_checklists.js) ya estan modificados sin commitear. No es preferencia.
      └─> D17 (mover repo/ a _to_delete/)   [primero se versiona, despues se mueve]

D02 (capturar el stack) ──> D03 (arreglar el 500) ──> D16 (prueba end-to-end)
                                   │                        ^
                                   └──> D11 (UI del Paso 4) ─┘
        D04 (doble llamada) va pegado a D02/D03: mismo codigo de montaje.

D05 (enum de 14 fases) ──> D06 (validacion backend) ──> D07 (migracion de casos)
                        └──> R9 (vista simplificada, E3)
                        └──> R8 (avance automatico, E3)
   [D05 NO espera a Z19: R18 fijo los 14 numeros; lo que Zelky reescribe es el texto]

D10 (campo `responsable`) ──> D11 (UI que separa las dos secciones)   [dependencia dura]
D12 (modelo de pagos) ─ sin dependencia con D10/D11; va en paralelo
D12 ──> B06 (pasarela, E4-b): el webhook se enchufa al evento `cliente_a_farmazed`

D08 (¿corrio el seed?) ──> D09 (diff de precios) ──> D13 (desglose que ve el cliente)
   [D08 primero porque es binaria y cambia el significado de las otras dos]

D14 (guard de sincronia) ─ sin dependencias. Meterlo ANTES de cualquier tarea que toque
                            faddi_checklists.js: ahi es donde reaparece el bug que previene.
D15 (vias declarativas)  ─ sin dependencias tecnicas, pero conviene tenerlo LISTO ANTES de
                            la reunion R1+Z3, para que la decision sea cambiar un booleano.

E1 completa ──> E2   (D16 no tiene sentido antes de D03)
E1 completa ──> E3   (R8 y R9 necesitan el enum de estados)
E2 ── no es prerequisito tecnico de E3, pero con un solo developer no hay motivo para intercalar

Zelky entrega matrices ──> E4-a   (sin matriz no hay checklist que construir)
Rick elige proveedor + sandbox ──> E4-b
E4-a y E4-b son independientes entre si: ninguno espera al otro.
```

**Las tres dependencias de persona que importan, dichas en una linea cada una:**
- Acceso de **lectura a Firestore** para el developer → lo da **Rick** → bloquea D08/D09 dentro de E1.
- **Matrices y checklists faltantes** → los da **Zelky** → bloquean toda E4-a, y no hay taller que lo sustituya.
- **Proveedor de pasarela con sandbox** → lo consigue **Rick** → bloquea E4-b y nada mas.

---

# DECISIONES PARA RICK

Cinco. Cada una: la pregunta, las opciones, mi recomendacion con su razon, y el costo de no decidirla esta semana.

### 1. ¿Entrega unica o por etapas? (R17)

**Opciones:** (a) un solo bloque con todo el alcance del 14 de septiembre; (b) por etapas, con corte al final
de E2; (c) por etapas con otro corte.

**Recomendacion del PM: (b), corte al final de E1+E2.** Porque hoy el portal esta roto para el cliente en dos
puntos que no dependen de nadie externo, y porque el 40% del alcance decidido esta bloqueado por material que
no existe. Una entrega unica significa que lo que ya funciona sigue roto hasta que Zelky entregue WHO-PQP — y
WHO-PQP hoy es cero.

**Costo de no decidirla esta semana:** no se puede contratar ni presupuestar al developer, porque el
presupuesto de "E1+E2" y el de "todo el alcance" no se parecen en nada. **Esta decision bloquea el arranque.**

---

### 2. Los cuatro tramites sin matriz validada: ¿ocultar, avisar o validar? (R1 + Z3)

Higienicos, plaguicidas, excepcion y publicidad tienen checklist en el codigo, **construido leyendo decretos
directamente, sin validacion del area regulatoria**.

**Opciones:** (a) ocultarlos del portal hasta tener matriz; (b) mostrarlos con aviso de "contactar a
Farmazed"; (c) dejarlos activos como estan.

**Recomendacion del PM: (a) ocultar, con D15 como mecanismo.** Porque hoy el portal hace de facto la (c) —
los muestra y bloquea con un toast — **sin que nadie lo haya decidido**, y porque un checklist no validado
que el cliente sigue al pie de la letra es un expediente rechazado con el nombre de Farmazed encima. Ocultar
es reversible en un booleano; un rechazo regulatorio no.

**Costo de no decidirla esta semana:** bajo en lo tecnico (D15 construye la palanca igual), **alto en lo
comercial**: cada dia que pasa, un cliente puede estar armando un expediente con requisitos que nadie del
area regulatoria valido. Requiere reunion con Zelky, no se puede decidir en solitario.

---

### 3. ¿WHO-PQP sigue en el alcance? (R4 + Z17)

La Fase 2 lo verifico contra el Drive completo: **no existe ninguna matriz, ni hoja de chequeo, ni borrador,
ni notas sueltas de WHO-PQP. Cero.**

**Opciones:** (a) sostener las cinco vias y esperar a que Zelky elabore la matriz desde cero; (b) sacar
WHO-PQP del MVP y dejarla declarada con `disponible: false` para encenderla despues; (c) pedirle a Zelky un
plazo antes de decidir.

**Recomendacion del PM: (b).** Porque elaborar una matriz de via desde cero no es una tarea de dias, y porque
la diferencia entre (a) y (b) en el codigo es un booleano — D15 la deja lista. Sostenerla en el alcance no
acelera la matriz; solo ata el cronograma a algo que no ha empezado.

**Costo de no decidirla esta semana:** medio. No bloquea E1 ni E2. Pero si se decide tarde, la estimacion de
E4-a que Rick use para presupuestar estara inflada con una via que nadie va a construir.

---

### 4. Precios: ¿cual xlsx manda, y de donde sale el tarifario oficial? (B05 + D09)

Dos problemas encadenados. Primero: `tracker/seed_pricing.js:28` declara como fuente un archivo del Drive
(`1D--X1LzONtN…`), pero la Fase 2 declaro canonico **otro** (`1ZRmJ6Z0T5CbVoMppVB0ACtQlQB7WqhuK`, la
*"- copia"* del 12 de septiembre). **Los precios cargados pueden ser de una version anterior a la vigente.**
Segundo: R19 dice que Farmazed cobra **todas** las tasas oficiales en la Fase 5, y en el Drive **no hay
ningun tarifario oficial de DNFD, IEA ni Colegio de Farmaceuticos** — los montos salen de un xlsx interno.

**Opciones:** (a) congelar el xlsx del 12 de septiembre como fuente unica y marcar en pantalla que las tasas
oficiales son provisionales; (b) parar el desglose de costos hasta conseguir el tarifario oficial; (c) pedirle
a Zelky ambas cosas y esperar.

**Recomendacion del PM: (a).** Porque D09 (el diff) te va a decir en horas cuanto difieren realmente los 13
montos — puede que la respuesta sea "ninguno" y el problema se evapore — y porque mostrarle al cliente un
monto provisional **etiquetado como provisional** es defendible; mostrarle uno desactualizado sin etiqueta no.

**Costo de no decidirla esta semana:** **es el unico riesgo de este roadmap que puede costar dinero real.**
Si los montos del seed son viejos y el portal ya cotizo con ellos, Farmazed esta cobrando mal — de menos o de
mas — y no lo sabe. D08 y D09 estan en E1 justamente para cerrar esto rapido.

---

### 5. Pasarela de pago: ¿la buscamos ahora o va manual en la primera entrega? (R11 + B06)

**Opciones:** (a) elegir proveedor ya y meter la integracion en la primera entrega; (b) primera entrega con
registro manual por admin (D12) y pasarela como frente aparte en E4-b; (c) posponer todo lo de pagos.

**Recomendacion del PM: (b).** Porque D12 —el modelo de los dos eventos de pago, `cliente_a_farmazed` y
`farmazed_a_autoridad`— hay que construirlo igual, con pasarela o sin ella, ya que R19 obliga a registrar los
desembolsos de Farmazed a DNFD, IEA y CNF, y **eso no lo hace ninguna pasarela**. Cuando llegue el proveedor,
solo se le enchufa el webhook a un evento que ya existe. La (c) no es opcion: sin registro de pagos, la Fase
5 no puede avanzar.

**Costo de no decidirla esta semana:** bajo para el developer (D12 se construye igual). Pero conseguir
proveedor, contrato y sandbox es un tramite **comercial** con su propio calendario: si arranca tarde, se
vuelve el cuello de botella de E4-b sin que nadie lo haya visto venir.

---

# PREGUNTAS PARA ZELKY

Consolidadas y priorizadas. **Marco con 🔴 solo lo que de verdad bloquea E1 o E2.** El resto no es menos
importante — es menos urgente, y mezclarlo todo en una sola lista es como se pierden las que si urgen.

## Ya contestadas por lo que aparecio en el Drive — **sacar de la lista**

| id | estaba preguntando | lo que encontro la corrida |
|---|---|---|
| **Z15** | cual de las dos carpetas "Matrices Definitivas para cliente" es la oficial | **Contestada, con una correccion.** La de **Fase 10** (`1y5-aPYLe2RZJBDaist_njX_bWGTjl1ge`) tiene **10 de 10** categorias llenas; la de `Operaciones/` tiene **4 de 10**. Pero la de Operaciones tiene **contenido unico**: `Matriz_Guia_Biologicos_Biotecnologicos_1.docx` del **18 de septiembre**, el archivo mas nuevo de todo el Drive, que supera a la de biologicos de Fase 10. → **Ya no es pregunta, es una accion:** copiar ese archivo a Fase 10 **antes** de archivar la de Operaciones. Archivarla sin copiar **pierde la unica version del 18 de septiembre.** |
| **Z16** | "guia" frente a "LEGAL": cual alimenta el portal | **Contestada en el fondo.** La **guia** es operativa (que documentos pedirle al cliente) y la **LEGAL** es el sustento normativo. El portal se construye desde la **guia**. Queda una verificacion menor de criterio, no un bloqueo. |
| **Z17** | ¿existe matriz de WHO-PQP? | **Contestada: no existe nada. Cero.** Ya no es pregunta para Zelky — es la **Decision 3 de Rick**. |
| **Z11** | ¿la matriz WLA esta validada? | **Contestada a medias, y la mitad que falta es la que importa.** La matriz **existe** en el Drive; la Fase 2 la marco **no validada**. La pregunta se reduce a una sola linea (ver 🔴 abajo). |
| **Z4** | a Sintesis Quimica "le falta la version guia" | **Se agravo.** No es que falte una version: **la matriz guia de Sintesis Quimica no existe en ninguna de las dos carpetas** — su subcarpeta esta **vacia**. Y Sintesis Quimica es **la via mas usada del portal**. Reformulada como 🔴 abajo. |

## 🔴 Bloquean E1 o E2

1. **Los nombres de las 14 fases.** ¿Puedes darnos la lista literal de los 14 nombres, en orden? El developer
   los necesita para D05. Si tiene acceso al Drive los saca del doc canonico
   (`1zIRjEU3v0iweVtYyV8YzXey1MeAiIt6K`); **si no lo tiene, D05 se bloquea y E1 entera se atrasa.**
   *(Nota aparte: el SVG y el docx se llaman "14_Fases" pero en el Drive solo hay **13 carpetas** `Fase N`.
   Confirmanos que son 14 y que la carpeta 14 simplemente no se creo.)*
2. **Z10 — el faddiCode de "Contrato de Fabricacion".** Hoy esta como `PENDIENTE_VERIFICAR` porque detectamos
   colision con el 15.11 de "monografia". ¿Cual es el codigo FADDI real? **Bloquea salida a produccion**, no
   la construccion — pero si no llega antes del final de E2, E2 no se puede publicar.
3. **Z5 — Suplementos.** El portal le pide al cliente **cuatro documentos que la matriz no lista**. ¿Sobran
   en el portal o faltan en la matriz? Tiene que estar resuelto **antes de D16**, o la prueba end-to-end
   valida un checklist que ya sabemos que esta mal.
4. **Z6 — los poderes: ¿son uno o son tres?** Misma razon que Z5: afecta el checklist que D16 valida.
5. **Matriz guia de SINTESIS QUIMICA.** Es **la via mas usada del portal** y su carpeta esta vacia. ¿Existe
   con otro nombre en algun lado, o hay que elaborarla? Mientras tanto el checklist codificado se sigue
   usando, pero **marcado internamente como no validado**.

## 🟡 Bloquean E3 o E4 — importantes, no urgentes esta semana

6. **Z11 / Z14 — WLA.** ¿La matriz que esta en el Drive esta validada por ti y refleja el D.E. 2/2025
   completo? ¿Se puede construir el checklist con ella tal cual, o le falta revision?
7. **Z18 / Z9 — renovaciones y modificaciones.** Son dos tramites **nuevos del MVP** (R2/R16) y no hay matriz
   consolidada de ninguno. ¿Cual es el flujo paso a paso y el checklist documental de cada uno?
8. **Z20 + intercambiabilidad (R3).** Quedo como tramite propio y **ya tiene precio** ($3,830) **pero no
   tiene requisitos**. ¿Cual de los tres documentos es la fuente, y cual es su checklist?
9. **Z13 / Z22 — Resolucion 985/2025.** Derogo la 385 y la 386. Confirmamos por busqueda de texto completo
   que **6 documentos del Drive** siguen citando la normativa derogada (y hay 6 mas de alta probabilidad, sin
   confirmar). **¿Que cambia en los *requisitos*?** ¿Alguna matriz que hoy alimenta el portal queda
   desactualizada? Esto es riesgo de contenido regulatorio, no de codigo.
10. **Z19 — texto de las Fases 5 y 13.** Ricardo decidio cobrar 100% en Fase 5 y mantener la Fase 13 como
    punto de control de gastos imprevistos. Tu documento maestro todavia describe la Fase 5 como pago
    parcial. ¿Puedes reescribir el texto de ambas y el diagrama SVG? **Explicitamente: esto NO bloquea a
    D05/D06/D07** — R18 fijo la numeracion e identidad de las 14 fases, y lo que cambia es solo el texto
    descriptivo. El developer puede construir el enum hoy.
11. **Plantillas de notificacion de las 14 fases.** No existen (FALTA #8). Sin ellas no hay motor de
    notificaciones que construir.
12. **El tarifario oficial de DNFD, IEA y Colegio de Farmaceuticos.** No hay ninguno en el Drive; los montos
    actuales salen de un xlsx interno. Va tambien a Rick (Decision 4).
13. **Z21 — firma electronica.** Si el abogado y la farmaceutica regente firman dentro del portal, ¿la DNFD
    acepta firma electronica o el refrendo sigue siendo fisico? Requiere consulta a la DNFD.
14. **Z7, Z8** (BPM: ¿uno por producto o por establecimiento? · Declaracion Jurada de Procedimiento
    Abreviado) — prioridad media, sin cambios desde `PM_COMMENTS.md`.

---

# RIESGOS QUE NO SON DECISIONES NI PREGUNTAS

Tres cosas que no requieren que nadie decida nada — solo que alguien las haga.

1. **Todo el proyecto vive en una sola maquina.** 2,807 lineas modificadas sin commitear, cinco rutas sin
   versionar, y entre ellas el rediseno completo de `dashboard.html` (+1,374 lineas) y `client-dashboard.html`
   (+993). **Un disco que falla hoy se lleva semanas de trabajo.** Es D01, es la primera tarea de E1, y es
   la unica del roadmap que califica como urgente en el sentido literal.
2. **Credenciales en texto plano en la raiz de una carpeta de Drive compartida entre dos cuentas.**
   `FADDI CREDENTIALS.txt` y el Doc `Contrasenas`. **No fueron abiertos ni citados en ninguna fase de esta
   cadena.** Recomendacion: sacarlos del Drive a un gestor de contrasenas y rotar lo que contengan. Es de
   Zelky, que es la propietaria de la carpeta.
3. **La reorganizacion del Drive esta escrita pero no ejecutada.** `02_MAPA_DATA.md` tiene la propuesta
   completa en cinco bloques. **Nada de eso se toco** — el Drive se trato como solo lectura durante toda la
   cadena. Ejecutarla es decision y accion de Zelky, no del PM ni del developer.

---

# PENDIENTE

Lo que esta Fase 4 **no** alcanzo a cubrir:

1. **Las estimaciones en semanas no estan calibradas.** Son juicio del PM leyendo codigo y documentos, no
   medidas contra la velocidad real de ningun developer. Nadie las ha aceptado. El punto de recalibracion
   honesto es el final de E1.
2. **E3 es la etapa con la estimacion mas floja** (6–8 semanas). El modelo de permisos de cuatro roles toca
   casi todos los endpoints existentes y no se conto endpoint por endpoint. Si Rick va a presupuestar sobre
   E3, esa cifra hay que trabajarla con mas detalle.
3. **E4-a no tiene estimacion de calendario, solo de esfuerzo condicional.** Depende por completo de cuando
   Zelky entregue, y eso no lo puede estimar el PM.
4. **No se estimo el esfuerzo de Zelky**, solo el del developer. Elaborar una matriz de via desde cero
   (WHO-PQP), dos matrices consolidadas (renovaciones y modificaciones) y las plantillas de 14 notificaciones
   es un volumen de trabajo regulatorio que **nadie ha dimensionado** y que esta en el camino critico de E4-a.
5. **Los huecos heredados de las fases anteriores siguen abiertos** y pueden mover estas conclusiones:
   12 de las 13 carpetas `Fase N` sin recorrer (la Fase 2 la señalo como su hueco mas grande, porque la
   Fase 10 resulto ser una copia paralela completa del arbol y las otras 12 probablemente tambien);
   `tracker/routes/mcp.js` (553 lineas) sin abrir; `farmazed-web/admin/` sin verificar.
6. **No se cruzo este roadmap contra `IMPLEMENTATION_PLAN.md` ni contra `dev_build_order.md`.** Si alguno de
   los dos contradice el orden de aqui, la contradiccion no esta resuelta.
7. **No hay plan de QA ni de despliegue.** `DEPLOY.md` existe y no se leyo en esta corrida. E2 termina con
   una prueba manual (D16); no hay suite automatizada ni criterio de release.
8. **No se dimensiono el equipo.** Todo el plan asume **un** developer a tiempo completo. Si son dos, E2 y E3
   se pueden solapar parcialmente y el calendario cambia; ese escenario no esta modelado.

---

*Fase 4 de 4 — documento del PM. En esta cadena no se ejecuto ninguna accion sobre Google Drive, no se toco
codigo, y no se hizo ningun commit.*

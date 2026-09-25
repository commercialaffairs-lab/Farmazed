# 03 — INSTRUCCIONES PARA EL DEVELOPER (Fase 3 de 4)

**Generado:** 2026-09-19 (corrida nocturna del PM en Patch)
**Insumos:** `organizacion/01_INVENTARIO_DRIVE.md`, `organizacion/02_MAPA_DATA.md`, `PM_COMMENTS.md` (Parte 0 y Parte C),
`handover.md`, `dev_build_order.md`, `observations/bug_documents_500.md`, `observations/paso2_ux_dropdowns.md`
**Estado del codigo verificado en esta corrida** (rama `main`, ultimo commit `0d156fb`).

---

## Estado real del codigo — lo que cambia respecto a lo que dicen los documentos

Esto lo verifique yo abriendo los archivos hoy. **Tres cosas que los documentos dan por ciertas ya no lo son:**

1. **El endpoint de documentos SI existe y SI esta montado.** `observations/bug_documents_500.md` plantea cuatro
   hipotesis y pone como primera "la ruta no esta implementada". **Esa hipotesis queda descartada:**
   `tracker/routes/documents.js:25` define `GET /`, `tracker/index.js:85` lo monta en
   `/api/cases/:caseId/documents`, y `documents.js:8` ya usa `Router({ mergeParams: true })`, asi que
   `req.params.caseId` llega bien. El 500 viene de una excepcion en tiempo de ejecucion (Firestore, storage o auth),
   no de una ruta faltante. El dev debe empezar por las hipotesis 2–4, no por la 1.
2. **`TIPOS_MED` y `MED_VARIABLE_BY_SUBTYPE` estan sincronizados hoy.** Los 11 valores de
   `farmazed-web/portal/js/wizard.js:44` coinciden exacto con las 11 claves de
   `tracker/data/faddi_checklists.js:87`. No hay nada que arreglar ahi — lo que falta es el **guard** que impida
   que se desincronicen otra vez (ya paso una vez, ver el comentario en `wizard.js:38`).
3. **No existe ningun enum de estados en el codigo.** Los unicos valores de `status` que se usan son
   `draft`, `submitted`, `pending_docs` y `deleted`. Las 14 fases no estan en ninguna parte del backend ni del
   frontend. `tracker/routes/cases.js:154` mete `status` en `ADMIN_FIELDS` sin validar contra ninguna lista:
   un admin puede escribir cualquier string.

**Ademas, lo mas urgente y lo que nadie ha registrado:**

> **Hay 2,807 lineas modificadas sin commitear y cinco rutas sin versionar** (`PM_COMMENTS.md`,
> `farmazed-web/portal/css/`, `farmazed-web/portal/js/shell.js`, `tracker/routes/messages.js`, `organizacion/`).
> Entre lo no commiteado esta el rediseno completo de `portal/dashboard.html` (+1,374 lineas) y de
> `client-dashboard.html` (+993). Todo eso existe en una sola maquina y en un solo working tree.

**Y una discrepancia de precios que nadie habia cruzado:**

> `tracker/seed_pricing.js:28` declara como fuente el archivo de Drive `1D--X1LzONtN_iNRQ1095D0Bid87FApti`
> — *"Actualizacion de nuestros precios para la plataforma.xlsx"*, en `Costos`.
> Pero la Fase 2 (§F) declaro canonico **otro archivo**: `1ZRmJ6Z0T5CbVoMppVB0ACtQlQB7WqhuK`,
> *"Actualizacion de nuestros precios para la plataforma - **copia**.xlsx"*, del **12 de septiembre**.
> **Los precios que estan en el seed pueden ser de una version anterior a la vigente.** Ver D09.

---

# 1. LISTO PARA EJECUTAR

Sin dependencia de Zelky ni de Rick. Cada tarea cabe en **≤ 2 horas** de sesion de developer.
Esfuerzo: **S** ≤ 45 min · **M** 45 min–2 h · **L** no deberia aparecer (si aparece, esta mal partida).

| id | tarea | archivos que toca | criterio de aceptacion verificable | esf. | riesgo |
|---|---|---|---|---|---|
| **D01** | Commitear y pushear todo el trabajo pendiente. Incluir los 5 untracked (`PM_COMMENTS.md`, `portal/css/`, `portal/js/shell.js`, `routes/messages.js`, `organizacion/`). Revisar antes que `.gitignore` no este tapando nada con credenciales. | `.gitignore`, todo el working tree | `git status` devuelve *"nothing to commit, working tree clean"*; `git log origin/main -1` muestra el commit nuevo; `git ls-files \| grep -c "portal/js/shell.js"` devuelve `1`; `git ls-files \| grep -c "routes/messages.js"` devuelve `1`. | S | **Alto si no se hace.** Bajo al hacerlo. Verificar que no entre ningun `.env` ni key de servicio. |
| **D02** | Reproducir el 500 de `GET /api/cases/:id/documents` con un log de la excepcion real. **No arreglar todavia — capturar.** Cambiar `res.status(500).json({error: e.message})` de `documents.js:56` por un `console.error(e.stack)` + el mismo 500. Correr el wizard hasta Paso 4. | `tracker/routes/documents.js` | Queda pegado en el ticket el **stack trace completo** de la excepcion, con nombre de archivo y linea. No vale "da 500". | S | Bajo |
| **D03** | Arreglar la causa que salga de D02. Sospechas ordenadas: (a) `admin.firestore()` no inicializado en el contexto del router, (b) falta de indice o de la subcoleccion `documents`, (c) `services/storage.js` fallando al firmar URL (ver commit `0d156fb`: el setup local de signed URL necesita impersonacion de SA, no key file). | `tracker/routes/documents.js`, `tracker/services/storage.js` | `curl -H "Authorization: Bearer <idToken>" $API/api/cases/<id>/documents` devuelve **200** y un JSON con las claves `total` y `documents`. Con un caseId inexistente devuelve **404**, no 500. Con el token de otro cliente devuelve **403**. | M | Medio — no se sabe la causa hasta D02 |
| **D04** | Quitar la doble llamada del wizard al montar el Paso 4 (el bug report registra el 500 repetido dos veces). | `farmazed-web/portal/js/wizard.js` | En DevTools → Network, al entrar al Paso 4 hay **exactamente 1** request a `/documents` y **1** a `/checklist`. Hoy hay 2. | S | Bajo |
| **D05** | Crear `tracker/data/case_status.js` con las **14 fases** como constantes (`FASE_01_…` … `FASE_14_…`, slugs en snake_case) mas los 4 estados operativos que ya existen (`draft`, `submitted`, `pending_docs`, `deleted`). Exportar `CASE_STATUSES` y `isValidStatus()`. Los nombres de las 14 fases salen del doc canonico de Drive `1zIRjEU3v0iweVtYyV8YzXey1MeAiIt6K` (§C de `02_MAPA_DATA.md`) — **solo la numeracion e identidad de las fases, no el texto**. | `tracker/data/case_status.js` (nuevo) | `node -e "console.log(require('./tracker/data/case_status').CASE_STATUSES.length)"` imprime **18** (14 + 4). Ningun valor repetido. | S | Bajo. El texto de las Fases 5 y 13 esta en revision (Z19) pero **su numero e identidad no cambian** — R18 fijo que el flujo queda en 14 fases. |
| **D06** | Validar el enum en el backend. `cases.js` acepta hoy cualquier string en `status`. | `tracker/routes/cases.js` (~linea 154 y 164) | `PATCH /api/cases/<id>` con `{"status":"fase_99"}` y token de **admin** devuelve **400** y el mensaje lista los valores validos. Con `{"status":"<una fase valida>"}` devuelve **200** y Firestore refleja el cambio. El comportamiento de cliente (solo puede poner `submitted`) sigue igual: probar que `{"status":"fase_07"}` con token de cliente sigue dando 400. | S | Bajo |
| **D07** | Script de migracion de los casos existentes al enum (R10). Tabla de mapeo explicita en el script (`draft`→`draft`, `submitted`→ la fase que corresponda, `pending_docs`→ idem). Debe tener modo `--dry-run` y ser idempotente. | `tracker/scripts/migrate_status.js` (nuevo) | `node tracker/scripts/migrate_status.js --dry-run` imprime `N casos, M cambian` sin escribir nada. Tras correr en real, una query de casos con `status` fuera de `CASE_STATUSES` devuelve **0**. Correrlo dos veces seguidas da `0 cambian` la segunda vez. | M | Medio — escribe en Firestore. Exigir dry-run revisado antes de ejecutar. |
| **D08** | Verificar si `seed_pricing.js` **llego a correr** contra el Firestore de produccion. Script de **solo lectura** que liste los documentos de la coleccion `pricing` con su `id` y su timestamp. | `tracker/scripts/check_pricing.js` (nuevo, solo lectura) | Sale pegada en el ticket la lista de ids encontrados en `pricing` (se esperan los **13** de `seed_pricing.js`: `med_abreviado_sintesis` … `cambio_rep_legal`), **o** la frase "coleccion `pricing` vacia". Respuesta binaria, no "parece que si". | S | Medio — requiere acceso de **lectura** al proyecto Firestore `farmazed`. Si el dev no lo tiene, esto escala a Rick y se convierte en bloqueado. |
| **D09** | Diff de precios: comparar los montos de `seed_pricing.js` contra el xlsx **canonico** de la Fase 2 (`1ZRmJ6Z0T5CbVoMppVB0ACtQlQB7WqhuK`, del 12 sept), que **no es** el archivo que el seed dice usar. Solo producir el diff — no decidir cual gana. | ninguno (documento de salida) | Tabla con una fila por cada uno de los 13 ids de precio: `id \| monto en seed \| monto en el xlsx canonico \| coincide S/N`. Y al final, la lista de ids que difieren. | S | Bajo (Drive es solo lectura). Si difieren muchos, adjudicarlo se vuelve B05. |
| **D10** | Agregar el campo `responsable` (`'cliente'` \| `'farmazed'`) a **cada** documento de `faddi_checklists.js`. Los tres que cambian de dueno por R19: `tasa_servicio` (15.17), `recibo_iea` (15.1), `recibo_cnf` (16.1.1) → `'farmazed'`. El resto → `'cliente'`. | `tracker/data/faddi_checklists.js` | `GET /api/cases/<id>/checklist` devuelve `responsable` en **todos** los documentos — contar los que no lo traen debe dar **0**. Para un caso de medicamentos, `tasa_servicio`, `recibo_iea` y `recibo_cnf` traen `"farmazed"`. | M | Bajo |
| **D11** | UI del Paso 4: separar visualmente "Documentos que subes tu" de "Documentos que carga Farmazed", y **dejar de bloquear el avance del cliente** por documentos de `responsable: 'farmazed'`. | `farmazed-web/portal/js/wizard.js` | En un caso donde lo unico que falta son los 3 documentos de Farmazed, el boton de continuar esta **habilitado**. Esos 3 aparecen en una seccion aparte, **sin** boton de subir, con la leyenda de que los aporta Farmazed. Si falta un documento de `responsable: 'cliente'`, el boton sigue **deshabilitado**. | M | Bajo. Depende de D10. |
| **D12** | Modelo de datos de los **dos eventos de pago distintos** (Parte C.9). Subcoleccion `payments` con `tipo` ∈ `{'cliente_a_farmazed', 'farmazed_a_autoridad'}`, `autoridad` ∈ `{'DNFD','IEA','CNF','MEF'}` (obligatorio solo en el segundo), `monto`, `fecha`, `comprobanteDocId`. Alta y listado por admin. **Sin pasarela** — registro manual. | `tracker/routes/payments.js` (nuevo), `tracker/index.js` | `POST .../payments` con `{"tipo":"cliente_a_farmazed", …}` devuelve **201**; con `{"tipo":"otra_cosa"}` devuelve **400** listando los dos valores validos; con `tipo: 'farmazed_a_autoridad'` y sin `autoridad` devuelve **400**. `GET .../payments` devuelve los dos eventos como registros separados con fechas distintas. | M | Bajo. Es el modelo, no la integracion (esa es B06). |
| **D13** | Desglose **honorarios Farmazed vs. tasas oficiales** en la pantalla de costo/cotizacion (Parte C.10). El dato ya existe: `seed_pricing.js` separa `honorarios_farmazed`/`honorarios_abogado`/`gastos_adicionales` de `tasa_dnfd_servicio`/`tasa_dnfd_tramite`/`iea`/`refrendo_cnf`/`tasa_mef`. Solo hay que agruparlo y mostrarlo. | `tracker/routes/pricing.js`, la vista de costo del portal | Para `med_abreviado_sintesis` la pantalla muestra **tres** cifras: *Honorarios Farmazed 2,055* · *Tasas oficiales 2,525* · *Total 4,580*. La suma de los componentes individuales es **igual** al total mostrado (probarlo con 3 categorias distintas). | M | Bajo |
| **D14** | Guard de sincronia `TIPOS_MED` ↔ `MED_VARIABLE_BY_SUBTYPE`. Hoy coinciden (11 = 11, verificado 2026-09-19); el objetivo es que **no puedan** desincronizarse en silencio. | `tracker/scripts/check_subtypes.js` (nuevo) | `node tracker/scripts/check_subtypes.js` sale con **codigo 0** con el codigo actual. Si se borra una clave de `MED_VARIABLE_BY_SUBTYPE`, sale con **codigo 1** e imprime el nombre exacto que sobra o falta. Probar ambos casos. | S | Bajo |
| **D15** | Convertir `TIPOS_REGISTRO` / `TIPOS_REGISTRO_SIN_FLUJO` en **una sola** estructura declarativa con un flag `disponible`, para que habilitar una via mas adelante sea un cambio de un solo valor y no de logica de render. Incluir ya la 5.ª via (WHO-PQP) con `disponible: false`. | `farmazed-web/portal/js/wizard.js` | Poner `disponible: false` en una via hace que **desaparezca** del Paso 1 sin tocar ninguna funcion de render; ponerla en `true` la hace aparecer. Probar encendiendo y apagando "Reconocimiento Mutuo". | S | Bajo. Es la palanca que despues consume la decision R1+Z3. |
| **D16** | Prueba visual end-to-end con cuenta real, cliente **y** admin (Parte C.5 — **nunca se ha hecho**). | ninguno (documento de salida) | Checklist firmado con captura por punto: (1) alta de cliente, (2) creacion de caso, (3) Paso 2 guarda datos, (4) Paso 4 carga un documento real y aparece en la lista, (5) submit cambia el estado, (6) el caso aparece en el panel admin con el estado correcto, (7) el admin cambia el estado y el cliente lo ve. Cualquier punto que falle se abre como bug aparte. | M | Medio — es probable que saque mas bugs. Hacerla **despues** de D03. |
| **D17** | Mover `repo/` a `_to_delete/` (R15 decidido). `_to_delete/` ya existe en la raiz del proyecto. | estructura de carpetas | `ls /home/claude-msi/Projects/Farmazed/repo` devuelve "No such file or directory" y `ls /home/claude-msi/Projects/Farmazed/_to_delete/repo` lista el contenido. | S | Bajo. **Hacerlo despues de D01**, no antes: primero se versiona, despues se mueve. |

**Total: 17 tareas listas.**

---

# 2. BLOQUEADO

| tarea | quien lo desbloquea | la pregunta exacta que hay que hacerle | que se puede adelantar mientras tanto |
|---|---|---|---|
| **B01 — Via WHO-PQP** (Z17, R4) | **Zelky** | *"¿Existe alguna matriz de requisitos de la via WHO-PQP, aunque sea borrador o notas sueltas? En el Drive no hay absolutamente nada. Si no existe, ¿la elaboras tu, o Ricardo saca esa via del alcance del MVP?"* | D15 deja la via declarada con `disponible: false`. Nada mas — sin matriz no hay checklist que construir. |
| **B02 — Via WLA** (Z11, Z14) | **Zelky** | *"La matriz de WLA que esta en el Drive, ¿esta validada por ti y refleja el D.E. 2/2025 completo? ¿Puedo construir el checklist del portal con ella tal cual, o le falta revision?"* | Igual que B01: la palanca de D15. La matriz existe pero la Fase 2 la marco como **no validada** — construir sobre ella es riesgo regulatorio, no tecnico. |
| **B03 — Matriz guia de Sintesis Quimica** (FALTA #1 de la Fase 2) | **Zelky** | *"Sintesis Quimica es la via mas usada del portal y no aparece su matriz guia en el Drive. ¿Existe con otro nombre, o hay que elaborarla?"* | El checklist de `'Sintesis Quimica'` ya esta codificado y funciona. Se sigue usando, pero **marcado internamente como no validado** hasta que Zelky confirme. No construir nada nuevo encima. |
| **B04 — Renovaciones y modificaciones** (Z9, Z18; R2/R16 las metieron al MVP) | **Zelky** | *"¿Cual es el flujo paso a paso y el checklist documental de (a) una renovacion y (b) una modificacion? Son dos tramites nuevos del MVP y no hay matriz consolidada de ninguno de los dos."* | El lado de **precios** ya existe (`renovacion`, `modificacion_expedicion`, `post_rs_modificacion`, `cambio_rep_legal` en `seed_pricing.js`): se puede dejar montado el calculo de costo. El checklist no. |
| **B05 — Tarifario oficial DNFD / IEA / CNF** (FALTA #5, R19) | **Rick** (decide) + **Zelky** (aporta) | *"R19 dice que Farmazed cobra todas las tasas en Fase 5 y luego paga a cada autoridad. ¿Cual es el documento oficial y vigente de tasas de DNFD, IEA y Colegio de Farmaceuticos? En el Drive no hay ninguno; los montos actuales salen de un xlsx interno."* | D09 (el diff) y D13 (el desglose). Los montos actuales se usan como **provisionales** y se marcan como tales en pantalla. |
| **B06 — Pasarela de pago** (R11) | **Rick** + el **proveedor** | *"¿Que pasarela vamos a integrar — proveedor, pais de la cuenta y moneda? ¿Hay contrato firmado y credenciales de sandbox?"* | D12: el modelo de los dos eventos de pago, con **registro manual por admin**. Cuando llegue la pasarela, solo se le enchufa el webhook al evento `cliente_a_farmazed`. |
| **B07 — faddiCode de "Contrato de Fabricacion"** (Z10) | **Zelky** | *"El documento 'Contrato de Fabricacion' tiene `faddiCode: 'PENDIENTE_VERIFICAR'` porque detectamos colision con el 15.11 de 'monografia'. ¿Cual es el codigo FADDI real?"* | Un script de reporte que liste **todos** los `faddiCode` con valor `PENDIENTE_VERIFICAR` (hoy es 1 — confirmarlo). No convertirlo en test que rompa CI: solo reporte. |
| **B08 — Texto de las Fases 5 y 13** (Z19) | **Zelky** | *"Ricardo decidio cobrar 100% en Fase 5 y mantener la Fase 13 como verificacion de saldo cero. Tu documento maestro todavia describe la Fase 5 como pago parcial. ¿Puedes reescribir el texto de ambas fases?"* | **Todo D05/D06/D07.** La numeracion e identidad de las 14 fases no cambia (R18 la fijo); lo que cambia es el texto descriptivo. El enum se puede construir hoy. |
| **B09 — Res. 985/2025 vs. 385/386 derogadas** (Z13, Z22) | **Zelky** | *"La Res. 985/2025 derogo la 385 y la 386. Confirmamos 6 documentos del Drive que siguen citando la normativa derogada. ¿Que cambia en los **requisitos** con la 985? ¿Alguna matriz del portal queda desactualizada?"* | Nada de codigo. Es un riesgo de contenido regulatorio, no de implementacion. |
| **B10 — Los 4 tramites sin matriz validada** (R1 + Z3) | **Rick y Zelky juntos**, en la misma reunion | *"Para los tramites sin matriz validada: ¿se ocultan del portal, se muestran con un aviso de 'contactar a Farmazed', o se validan los checklists actuales?"* | D15 construye exactamente la palanca que esta decision va a accionar. Hoy el portal hace lo tercero de facto (muestra y bloquea con un toast) sin que nadie lo haya decidido. |
| **B11 — Intercambiabilidad como 7.º tramite** (R3) | **Zelky** | *"Intercambiabilidad queda como tramite propio. ¿Cual es su checklist documental? Ya tiene precio (`intercambiabilidad`, total $3,830) pero no tiene requisitos."* | Nada util. Agregar el `tramiteType` sin checklist genera un flujo vacio — **no hacerlo todavia**. |
| **B12 — Firma electronica de abogado y regente** (Z21, R6) | **Zelky** → consulta a **DNFD** | *"Si el abogado y la farmaceutica regente firman dentro del portal: ¿la DNFD acepta firma electronica, o el refrendo tiene que seguir siendo fisico?"* | Todo el modelo de **permisos** de los 4 roles (R6) se puede construir sin la parte de firma. La firma es un modulo aparte. |
| **B13 — Entrega unica o por etapas** (R17) | **Rick** | *"¿Entrego el alcance completo en un solo bloque, o por etapas? Mi recomendacion como PM: etapa 1 = registro nuevo con Regular/Abreviado/Mutuo + permisos + 14 fases; etapa 2 = renovaciones, WLA, WHO-PQP e intercambiabilidad."* | El orden de la seccion 3 asume **etapas**. Si Rick elige bloque unico, el orden no cambia — cambia la fecha de corte. |

**Total: 13 bloqueos.** Nueve dependen de Zelky, dos de Rick, uno de los dos juntos, uno de un proveedor.

---

# 3. ORDEN SUGERIDO

Dependencias tecnicas reales. Donde no hay dependencia, lo digo y ordeno por riesgo.

### Bloque 0 — antes de escribir una sola linea (no negociable)

**D01** (commit + push).
No es preferencia: hoy hay 2,807 lineas modificadas y cinco rutas sin versionar en una sola maquina. Cualquier tarea
de abajo toca `wizard.js`, `cases.js` o `faddi_checklists.js`, que son tres de los archivos ya modificados.
Empezar a editar encima de trabajo sin commitear significa que un error no tiene vuelta atras.
**D17** (mover `repo/`) va inmediatamente despues, por la misma razon: primero se versiona, despues se mueve.

### Bloque 1 — desbloquear el camino critico

**D02 → D03 → D04.**
El 500 del Paso 4 rompe el wizard **a partir del Paso 4**, o sea todo el flujo de carga documental. Mientras no
este arreglado, D11 (UI del checklist) y D16 (prueba end-to-end) no se pueden ni siquiera probar: no hay pantalla
que mirar. D02 antes de D03 porque hoy nadie sabe la causa — las cuatro hipotesis del bug report incluyen una que
ya descarte, y adivinar sale mas caro que capturar el stack.
D04 va pegado porque toca el mismo codigo de montaje del Paso 4 y ahorra abrir `wizard.js` dos veces.

### Bloque 2 — la maquina de estados, antes de que haya mas casos que migrar

**D05 → D06 → D07.**
Estricto: D06 importa el enum de D05, y D07 migra hacia los valores que define D05.
Va antes que el resto del backlog por una razon de costo que crece con el tiempo: **cada caso nuevo que se cree
con el modelo viejo es un caso mas que migrar**. La migracion es mas barata hoy que en un mes.
No espera a Z19: los numeros de las 14 fases estan fijados por R18, lo que esta en revision es el texto.

### Bloque 3 — R19, que es una sola decision con tres consecuencias de codigo

**D10 → D11**, y **D12** en paralelo (no dependen entre si; D12 no toca `faddi_checklists.js`).
D11 depende de D10 de forma dura: la UI necesita el campo `responsable` para poder separar las dos secciones.
Estos tres son la misma decision de negocio (R19: Farmazed cobra y desembolsa) vista desde el checklist, desde la
pantalla y desde el modelo de pagos. Hacerlos juntos evita tres relecturas del mismo razonamiento.
**Este bloque arregla un problema que hoy le pega al cliente en produccion:** el portal le esta pidiendo tres
comprobantes que el cliente no puede aportar, y le bloquea el avance con ellos.

### Bloque 4 — precios, en este orden y no en otro

**D08 → D09 → D13.**
D08 primero porque es una pregunta binaria y barata que cambia el significado de todo lo demas: si el seed
**nunca corrio**, entonces no hay precios en produccion y D13 no tiene de donde leer. Si corrio, hay que saber
**con que version del xlsx** corrio, y eso es D09.
D13 (el desglose que ve el cliente) va al final: es la unica de las tres que el cliente llega a ver, y no tiene
sentido mostrarle un desglose de montos que todavia no sabemos si son los vigentes.

### Bloque 5 — blindaje y palancas (sin dependencias, meter donde caigan)

**D14** (guard de sincronia) y **D15** (vias declarativas).
D14 no depende de nada y cuesta menos de una hora; conviene meterlo **antes** de cualquier tarea futura que toque
`faddi_checklists.js`, porque es precisamente el momento en que el bug que previene reaparece.
D15 conviene tenerlo listo **antes** de la reunion de R1+Z3 (B10): cuando Rick y Zelky decidan, la implementacion
pasa a ser un cambio de un booleano en vez de una tarea nueva.

### Bloque 6 — cierre

**D16** (prueba end-to-end), al final y no antes.
Es lo unico que valida que los bloques 1 a 5 se sostienen juntos, y corriendola antes de D03 solo confirmaria el
500 que ya conocemos. Contar con que va a abrir bugs nuevos: nunca se ha hecho una pasada completa con cuenta real.

### Lo que **no** va en esta secuencia

Los 12 puntos de `observations/paso2_ux_dropdowns.md` (7 campos faltantes del Paso 2, dropdowns en cascada,
catalogos de grupo terapeutico y via de administracion). Son reales y estan bien documentados, pero **compiten con
el camino critico** y algunos de sus catalogos dependen de material regulatorio que Zelky aun no entrego.
Recomiendo meterlos como un bloque propio despues de D16, no intercalados.

---

# PENDIENTE

Lo que **no** alcance a cubrir dentro del techo de 20 minutos de esta corrida:

1. **No corri el codigo.** Todo el analisis es lectura estatica. No levante el tracker, no llame a ningun endpoint
   ni verifique contra Firestore. En particular, **la causa real del 500 de D03 no esta diagnosticada** — por eso
   D02 existe como tarea separada.
2. **No abri `tracker/routes/mcp.js` (553 lineas).** Es el archivo mas grande del backend y no aparece en ninguna
   tarea de este documento. Puede contener logica de estados o de checklist que contradiga lo de arriba.
3. **No verifique `farmazed-web/admin/`** (`expediente.html`, `casos.html`, `precios.html`). Si el panel admin
   tiene su propia lista de estados hardcodeada, **D06 la rompe** y hace falta una tarea mas.
4. **No cruce documento por documento el checklist contra las matrices de Drive.** El punto 7 del PENDIENTE de la
   Fase 2 (mapeo fino de cada documento a su campo FADDI) queda abierto: lo que hice fue cruzar las *claves* de
   subtipo, no el contenido de cada checklist.
5. **No revise `process_map.md` ni `FADDI_platform_knowledge.md` completos** (20 KB y 34 KB). Los 12 campos del
   Paso 2 salen de `process_map.md` segun el observations, pero no verifique la lista contra la fuente.
6. **Los nombres exactos de las 14 fases no estan en este documento.** D05 los manda a leer del doc canonico de
   Drive porque no los tengo transcritos aqui. Si el dev no tiene acceso a ese Drive, D05 se bloquea y hay que
   pedirle a Zelky la lista de los 14 nombres — no la tengo verificada.
7. **No estime esfuerzo calibrado.** Las S/M son mi juicio leyendo el codigo, no medidas contra la velocidad real
   de este developer. Vale la pena que el dev las recalibre en la primera sesion.
8. **El diff de D09 no esta hecho.** Detecte la discrepancia de fuentes de precios pero no abri ninguno de los dos
   xlsx — no se cuantos montos difieren, ni si difiere alguno.

---

*Fase 3 de 4 — documento del PM. No se toco ni una linea de codigo en esta corrida.*

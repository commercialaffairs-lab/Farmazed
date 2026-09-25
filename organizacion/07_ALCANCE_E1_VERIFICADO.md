# 07 — ALCANCE DE E1 VERIFICADO (cierre de los dos huecos del roadmap)

**Generado:** 2026-09-20 · corrida del PM en Patch, despachada por Argus.
**Encargo:** cerrar el riesgo de alcance de E1 para que la **Decision 1** de `04_ROADMAP.md`
(entrega unica o por etapas) sea presupuestable.
**Insumos leidos en esta corrida:** `tracker/routes/mcp.js` (553 lineas, completo),
`farmazed-web/admin/` (`casos.html`, `expediente.html`, `precios.html`),
`tracker/routes/cases.js`, `tracker/routes/documents.js`, `farmazed-web/portal/js/wizard.js`,
`farmazed-web/client-dashboard.html`, `farmazed-web/dashboard.html`,
`IMPLEMENTATION_PLAN.md`, `dev_build_order.md`, y las secciones E1/E2/PENDIENTE de `04_ROADMAP.md`.
**No se toco codigo, no se hizo commit, no se toco Google Drive.**

---

## LA RESPUESTA, EN DOS LINEAS

**Si: E1 crece.** `tracker/routes/mcp.js` y `farmazed-web/admin/` **si** tienen su propia lista de estados
hardcodeada — hay **32 sitios** con literales de estado repartidos en **8 archivos**, no los 2 que D06 declara tocar,
y **`mcp.js:421` es una segunda ruta de escritura de `status` que no pasa por `cases.js` en absoluto**, asi que D06
tal como esta escrito **se puede saltar por completo** desde Claude Cowork.

**Cuanto crece: de 3–4 semanas a 4–5 semanas.** Suma **+1 semana** (5 tareas nuevas y una correccion de alcance de
D07), y arrastra a E3: la "vista simplificada" R9 ya esta a medias construida en `client-dashboard.html:975`.
Estimacion del PM, **no compromiso**.

---

# 1. LO QUE ENCONTRE AL ABRIR `mcp.js` Y `admin/`

`03_INSTRUCCIONES_DEV.md:24` afirma: *"No existe ningun enum de estados en el codigo. Los unicos valores de `status`
que se usan son `draft`, `submitted`, `pending_docs` y `deleted`."*

**Las dos mitades de esa frase son falsas.** No hay *un* enum: hay **cinco vocabularios de estado distintos,
todos hardcodeados, ninguno importado de ningun lado**, y entre ellos usan **14 valores** de `status` de caso, no 4.

## 1.1 Los cinco vocabularios que conviven hoy

| # | vocabulario | valores | donde vive | ¿lo cubre D05/D06? |
|---|---|---|---|---|
| **V1** | estado de **caso** — backend | `draft`, `submitted`, `pending_docs`, `deleted` | `cases.js`, `documents.js`, `mcp.js` | si, es el que D05 asume |
| **V2** | estado de **caso** — enum del MCP | `draft`,`submitted`,`in_review`,`faddi_ready`,`faddi_submitted`,`approved`,`observed`,`denied` | `mcp.js:37` (descripcion de la tool) | **no — nadie lo miro** |
| **V3** | estado de **caso** — panel admin | los 8 de V2 **menos** `denied` **menos** `draft`, **mas** `pending_docs` | `casos.html:20-27,70-75,108-114`, `expediente.html:37-43` | **no** |
| **V4** | estado de **documento** | `uploaded`,`reviewing`,`approved`,`rejected`,`requested`,`missing`,`pending`,`pending_upload` | `documents.js:185`, `mcp.js:64`, `expediente.html:250`, `wizard.js:325`, `client-dashboard.html:968` | **no — D05 solo contempla estados de caso** |
| **V5** | fases de cliente (mockup) | `diagnostico`,`revision`,`elaboracion`,`obtencion` + etiquetas en español | `dashboard.html:468-475` (datos de demo hardcodeados, **no conectado a la API**) | no aplica — es maqueta |

**V2 y V3 ni siquiera coinciden entre si**: `denied` existe en el enum que el MCP le publica a Claude Cowork
(`mcp.js:37`) y **no existe** en el desplegable del admin (`expediente.html:37-43`); `pending_docs` y `deleted`
existen en el backend y **no aparecen** en el enum del MCP. Ya hoy, sin tocar nada, el sistema es incoherente
consigo mismo.

## 1.2 Los 32 sitios, con archivo y linea

### Backend — `tracker/` (15 sitios)

| archivo:linea | que hay | impacto de D06 |
|---|---|---|
| `routes/cases.js:83` | `status: 'draft'` al crear | reemplazar por constante |
| `routes/cases.js:147` | `data.status !== 'draft'` (gate del cliente) | reemplazar por constante |
| `routes/cases.js:154` | `status` dentro de `ADMIN_FIELDS`, **sin validar** | **es D06** |
| `routes/cases.js:164-168` | cliente solo puede poner `'submitted'` | reemplazar por constante |
| `routes/cases.js:190` | soft delete → `status:'deleted'` | reemplazar por constante |
| `routes/documents.js:92` | doc → `'uploaded'` | V4, enum nuevo |
| `routes/documents.js:137,144` | doc → `'requested'` | V4 |
| **`routes/documents.js:149`** | **escribe `status:'pending_docs'` en el CASO, directo a Firestore** | **salta D06** |
| `routes/documents.js:185,196` | comentario `(uploaded\|reviewing\|approved\|rejected)` y `req.body.status` sin validar | V4 sin validacion |
| **`routes/mcp.js:37`** | **enum de 8 estados de caso en texto libre** | desincronizado con D05 |
| `routes/mcp.js:64` | enum de 4 estados de documento en texto libre | V4 |
| `routes/mcp.js:102` | `status: 'New status value'` — string libre | sin validar |
| **`routes/mcp.js:421-429`** | **`handleUpdateCase` escribe `update.status = status` sin ninguna validacion** | **SEGUNDA RUTA DE ESCRITURA — salta D06 entero** |
| `routes/mcp.js:443,455` | doc → `'requested'` | V4 |
| **`routes/mcp.js:464`** | **escribe `status:'pending_docs'` en el CASO** | salta D06 |

### Frontend — `farmazed-web/` (17 sitios)

| archivo:linea | que hay |
|---|---|
| `admin/casos.html:20-27` | 8 clases CSS `.badge-<estado>` |
| `admin/casos.html:70-75` | 6 chips de filtro con `data-status` |
| `admin/casos.html:108-110` | mapa `BADGE` (8 claves) |
| `admin/casos.html:113-114` | mapa `LABEL` español (8 claves) |
| `admin/casos.html:136-139` | **4 contadores hardcodeados** (`in_review`, `faddi_ready`, `faddi_submitted`, `approved`) |
| `admin/casos.html:165` | fallback `BADGE[c.status] \|\| 'badge-draft'` — enmascara estados desconocidos |
| **`admin/expediente.html:37-43`** | **`<select>` con 7 `<option>` — la ruta de escritura del admin** |
| `admin/expediente.html:206` | `select.value = caseData.status` — si el estado no esta en la lista, el select queda **en blanco** |
| `admin/expediente.html:250-251` | iconos y colores de estado de documento (V4) |
| `admin/expediente.html:339` | `api.updateCase(caseId, { status: <valor del select> })` |
| `portal/js/wizard.js:325-326` | iconos/badges de doc, incluye **`pending_upload`, que no existe en el backend** |
| `portal/js/wizard.js:352` | comparaciones `'uploaded'`/`'approved'` |
| `portal/js/wizard.js:463` | `updateCase(..., { status: 'submitted' })` |
| `client-dashboard.html:968` | `ESTADO_MAP` de estados de documento → español |
| **`client-dashboard.html:975-983`** | **`FASE_MAP`: 9 estados de caso → 4 fases visibles + flag `bloqueado`** |
| `client-dashboard.html:994-996, 1051` | comparaciones sueltas con `denied`, `pending_docs`, `observed`, `approved` |
| `client-dashboard.html:1067-1071` | filtra casos `pending_docs` y documentos `requested` |

`admin/precios.html` **no toca estados** — solo precios. Es el unico de `admin/` que D06 no rompe.
`farmazed-web/dashboard.html` tampoco: es una maqueta con arreglos de datos hardcodeados, sin llamadas a la API.

## 1.3 Las tres consecuencias que cambian el presupuesto

**(a) D06 tal como esta escrito no cierra nada.** Su criterio de aceptacion solo prueba `PATCH /api/cases/<id>`.
Pero `mcp.js:421` escribe `status` por su cuenta, y `documents.js:149` y `mcp.js:464` escriben `'pending_docs'`
directo a Firestore. Un admin usando Claude Cowork —**que es el flujo que el propio proyecto promociona**— puede
meter `"fase_99"` sin que D06 se entere. **Hay que ampliar D06 a las tres rutas, o D06 da una falsa sensacion de
cierre.** El parche esta en la seccion 5.

**(b) D07 tiene la tabla de mapeo incompleta.** `03` le da tres filas (`draft`, `submitted`, `pending_docs`) porque
cree que solo existen 4 valores. Pero **`expediente.html` lleva escribiendo `in_review`, `faddi_ready`,
`faddi_submitted`, `approved` y `observed` en Firestore desde agosto**. La tabla de D07 necesita **9 filas**, no 3.
Y antes de escribirla hace falta un conteo real de valores distintos en la coleccion `cases` — que **requiere el
mismo acceso de lectura a Firestore que D08**, o sea la unica dependencia de persona que E1 ya tenia.

**(c) R9 (vista simplificada, hoy en E3) ya esta a medias construida.** `client-dashboard.html:975-983` mapea 9
estados a 4 fases con un flag `bloqueado`. No es un mapa cualquiera: es exactamente lo que el roadmap presupuesto en
E3. Al migrar el enum hay que reescribirlo de 9→18 estados de todas formas, asi que **una parte de R9 se paga dentro
de E1 lo quiera o no**. Es trabajo que E3 deberia poder descontar, no sumar dos veces.

## 1.4 Las cinco tareas nuevas de E1

| id | tarea | archivos | criterio de aceptacion | esf. |
|---|---|---|---|---|
| **D06b** | Validar el enum tambien en `handleUpdateCase` del MCP, y sustituir los tres `'pending_docs'` hardcodeados por la constante. | `tracker/routes/mcp.js:421,464`, `tracker/routes/documents.js:149` | `tools/call` de `farmazed_update_case` con `{"status":"fase_99"}` devuelve error JSON-RPC `-32000` con el mensaje listando los validos. `grep -c "'pending_docs'" tracker/` devuelve **0**. | S |
| **D06c** | Regenerar las descripciones de las tools del MCP desde `CASE_STATUSES` en vez de texto literal. | `tracker/routes/mcp.js:37,64,102` | `GET /mcp` lista en la descripcion de `farmazed_list_cases` exactamente los **18** valores de `CASE_STATUSES`. Agregar un estado al enum lo hace aparecer sin editar `mcp.js`. | S |
| **D05b** | Segundo enum: `DOC_STATUSES` (V4). Hoy hay 8 valores repartidos en 5 archivos y `pending_upload` **solo existe en el frontend**. Decidir si se conserva o se elimina. | `tracker/data/case_status.js` | `DOC_STATUSES` exportado; `PATCH .../documents/:docId` con `{"status":"loquesea"}` devuelve **400**. Un grep de literales de estado de documento fuera del enum devuelve **0**. | S |
| **D18** | Panel admin manejado por el enum: `casos.html` (badges, chips, labels, contadores) y `expediente.html` (`<select>`) generados desde un mapa unico `estado → {label, color}` de las 18 entradas. | `farmazed-web/admin/casos.html`, `expediente.html`, archivo nuevo compartido | Los 18 estados tienen label y color; ninguno cae al fallback `badge-draft`. Los 4 contadores de `casos.html:136-139` se recalculan sobre fases del enum, no sobre `in_review`/`faddi_ready`. Cargar un caso en cualquiera de los 18 estados deja el `<select>` **con valor**, nunca en blanco. | M |
| **D19** | Remapear `FASE_MAP` de `client-dashboard.html` de 9 a 18 estados, conservando el flag `bloqueado`. **Es el primer pedazo de R9.** | `farmazed-web/client-dashboard.html:975-983` | Cada uno de los 18 estados cae en exactamente una fase visible; ningun estado sin mapear. Un caso en cada uno de los 18 renderiza sin `undefined` en pantalla. | M |
| — | **Correccion de alcance de D07**: tabla de mapeo de **9 filas**, precedida de un conteo real de valores distintos en `cases`. | `tracker/scripts/migrate_status.js` | El script falla en voz alta si encuentra un valor de origen que no este en su tabla, en vez de dejarlo pasar. | (dentro de D07) |

---

# 2. EL ROADMAP CONTRA `IMPLEMENTATION_PLAN.md` Y `dev_build_order.md`

El `PENDIENTE` de `04_ROADMAP.md` (punto 6) admite que este cruce no se hizo. Aqui esta.

## 2.1 `IMPLEMENTATION_PLAN.md` (mayo 2026)

### Lo que tiene y el roadmap **no menciona en ninguna parte**

| que | donde | por que importa |
|---|---|---|
| **7 TOUCHPOINTS de infraestructura** (~3 h): proyecto Firebase, bucket `farmazed-docs` + CORS, service account `farmazed-api-sa` con 3 roles, variables de entorno en Cloud Run, primer admin, deploy, alta del plugin MCP | §"Donde entra el developer" | **El roadmap no tiene ni una sola tarea de infraestructura.** Y la hipotesis (c) de D03 —*"`services/storage.js` fallando al firmar URL; el setup necesita impersonacion de SA"*— **es literalmente el TOUCHPOINT #3**. Es plausible que el 500 del Paso 4 sea un permiso de service account, no un bug de codigo. |
| **Firestore security rules** | Backlog, punto 1 | Hoy la autorizacion vive **solo** en `cases.js:117` y `documents.js:20`. Si las rules estan en modo abierto, cualquiera con la config de Firebase (que es publica, va en `portal/js/config.js`) lee la base saltandose la API. **Es el unico hallazgo de seguridad de esta corrida y no esta en el roadmap.** |
| **`nginx.conf`: agregar `/portal/` y `/admin/`** | Backlog 3 y TOUCHPOINT #6 | Si no se hace, el panel admin **no se sirve en produccion** y D16 (E2) no se puede correr de punta a punta. |
| Alertas de vencimiento de RS a 6 meses; alerta de 48 h post-generacion en FADDI; dashboard de metricas admin; exportar checklist a PDF | §Fase 4 | Cuatro frentes que no aparecen en ninguna de las cuatro etapas del roadmap. No son grandes, pero si alguien los da por prometidos, no estan presupuestados. |

### Lo que contradice al roadmap

> *"Todo el codigo esta escrito y es sintacticamente valido. El developer NO escribe codigo desde cero. Su trabajo es:
> configurar servicios GCP, inyectar credenciales, testear, y deployar."*

El roadmap presupuesta **17 tareas de codigo y 3–4 semanas solo para E1**. Son dos descripciones incompatibles del
mismo trabajo. **Gana el roadmap sin discusion**: `IMPLEMENTATION_PLAN.md` es de mayo, describe el codigo tal como
quedo recien generado, y no sabe nada del 500 del Paso 4, de R19, de las 14 fases ni de las decisiones del 14 de
septiembre. Su tabla de estado ("Fase 0 COMPLETADA, Fase 1 COMPLETADA") es la fuente mas probable de la impresion de
que el proyecto esta casi listo. **Eso es lo que hay que corregir al contratar.**

## 2.2 `dev_build_order.md` (25 de agosto)

### Lo que tiene y el roadmap **no**

| que | donde | por que importa |
|---|---|---|
| **CLV de cosmeticos: campo de upload deshabilitado + nota "se presenta fisicamente en DNFD"** | FASE 4, recuadro ⚠️ | **Rompe el modelo de datos de D10.** D10 define `responsable ∈ {'cliente','farmazed'}`. El CLV de cosmeticos no es ninguno de los dos: es del cliente **pero no se sube al portal**. Hace falta un tercer valor (p.ej. `'fisico_ventanilla'`) o un campo `cargable: false` aparte. **Decidirlo antes de escribir D10, no despues.** |
| **Disclaimer obligatorio de Excepcion de Registro** en el Paso 1 | FASE 3 | Requisito de producto con implicacion legal (aclarar que no otorga RS permanente). No esta en el roadmap ni en `03`. |
| **4 requisitos de infraestructura del wizard**: retomar el proceso con `?caseId=` en la URL; guardar progreso entre pasos sin perder datos; barra de progreso documental en tiempo real; confirmacion de que el panel admin recibe la solicitud | FASE 1 | Los 7 puntos de D16 **no cubren** retomar-por-URL ni persistencia de progreso. Si el cliente pierde los datos al cerrar la pestaña en el Paso 3, E2 no cumple su entregable ("un cliente real llega del alta al submit") aunque los 7 puntos de D16 pasen. |
| **Plan de QA por path, con responsable (el PM)** | §"QA por fase" | El `PENDIENTE` del roadmap (punto 7) dice *"no hay plan de QA"*. **Si lo hay, es este.** Esta desactualizado, pero existe y se puede heredar. |
| Conteos documentales por tramite (2/6/7/12/19 obligatorios) | tablas por fase | Son los unicos numeros verificables contra `faddi_checklists.js` que existen en todo el proyecto. |

### Lo que contradice al roadmap — **la contradiccion fuerte**

`dev_build_order.md` ordena construir **por tramite, de mas simple a mas complejo**:
publicidad → excepcion → cosmeticos → higienicos → plaguicidas → medicamentos Regular → subtipos → Abreviado.

La **Decision 2** del roadmap recomienda **ocultar del portal** higienicos, plaguicidas, excepcion y publicidad,
porque sus checklists se construyeron leyendo decretos sin validacion del area regulatoria.

**Son instrucciones opuestas sobre los mismos cuatro tramites**: uno dice constrúyelos primero, el otro dice
escóndelos. Un developer que reciba los dos documentos sin esta nota empieza por publicidad — el primer path del
build order — y construye durante dias sobre el unico bloque del alcance que el PM recomienda apagar.

Contradiccion menor pero real: el build order tiene numeros inconsistentes consigo mismo (publicidad: 3 docs en la
tabla, 2 en el criterio de aceptacion; cosmeticos: 9 en la tabla, 7 en `IMPLEMENTATION_PLAN.md`; higienicos: 13 vs 12).
No es grave, pero confirma que no es un documento sobre el que se pueda presupuestar.

## 2.3 Cual manda, a mi juicio

**Manda `04_ROADMAP.md` en orden y alcance. Sin empate.** Es el unico de los tres construido sobre una inspeccion
verificada del codigo vivo (rama `main`, commit `0d156fb`), el unico que incorpora las decisiones del 14 de
septiembre, y el unico que distingue lo que esta bloqueado por material que no existe de lo que no. Los otros dos son
anteriores a la mitad de los hechos que hoy definen el proyecto.

**Pero ninguno de los dos se descarta — se cosechan, en dos direcciones distintas:**

- **`IMPLEMENTATION_PLAN.md` aporta el runbook de infraestructura**, que es el hueco mas grande del roadmap. Sus 7
  TOUCHPOINTS + las security rules + el `nginx.conf` deben entrar a E1 **como un bloque nuevo, antes de D02**, porque
  D02 no se puede ni intentar sin un entorno donde reproducir el 500. Lo que hay que descartar de ese documento es
  unicamente su **narrativa de estado** ("todo listo, solo falta deployar").
- **`dev_build_order.md` aporta requisitos de producto por path** que nadie mas registro: el CLV fisico de
  cosmeticos (que corrige D10), el disclaimer de Excepcion, los 4 requisitos de infraestructura del wizard (que
  amplian D16) y el plan de QA. Lo que hay que descartar es su **orden de construccion**, que la Decision 2 dejo
  obsoleto.

Regla operativa para el developer, en una linea:
**orden y prioridad → `04_ROADMAP.md`; tareas y criterios → `03_INSTRUCCIONES_DEV.md` mas este documento;
infraestructura → §TOUCHPOINTS de `IMPLEMENTATION_PLAN.md`; requisitos por tramite → `dev_build_order.md`,
leido como catalogo de requisitos y no como cronograma.**

---

# 3. RECALIBRACION DE E1 + E2

> **Sigue siendo estimacion del PM, no compromiso.** Hecha por lectura estatica del codigo. No esta calibrada contra
> la velocidad de ningun developer y nadie la ha aceptado. El punto de recalibracion honesto sigue siendo el final
> de E1.

| etapa | estimacion en `04_ROADMAP.md` | estimacion revisada | que la movio |
|---|---|---|---|
| **E1** | 3 a 4 semanas | **4 a 5 semanas** | (a) 5 tareas nuevas por los 32 sitios de estado: D06b, D06c, D05b, D18, D19 · (b) D07 pasa de 3 a 9 filas de mapeo y necesita un conteo previo en Firestore · (c) entra el bloque de infraestructura de `IMPLEMENTATION_PLAN.md`, que el roadmap no habia contado |
| **E2** | 3 a 4 semanas | **3 a 4 semanas — confirmada** | Se reviso y **no cambia**. D10 se complica un poco (tercer valor de `responsable` por el CLV fisico) y D16 se amplia con los 4 requisitos del build order, pero ambos caben dentro de la semana que el roadmap ya reservaba para lo que saque D16. Lo que sacaria a E2 de rango no es el alcance: es que D16 abra mas bugs de los previstos. |
| **E1 + E2** | **6 a 8 semanas** | **7 a 9 semanas** | +1 semana, toda en E1 |

**Efecto sobre E3:** el roadmap estima 6–8 semanas y su propio `PENDIENTE` (punto 2) la marca como la cifra mas
floja. No la recalibro aqui — no era el encargo y no tengo el conteo endpoint por endpoint que haria falta. Pero
**una parte de R9 se paga dentro de E1** (D19), asi que E3 deberia descontarla en vez de volver a presupuestarla.

**Lo que esto significa para la Decision 1.** La recomendacion del roadmap —**(b), entrega por etapas con corte al
final de E1+E2**— no cambia con estos hallazgos; **se refuerza**. El hueco que acabo de cerrar era un riesgo de
alcance *dentro* de E1, no un argumento para agrandar la primera entrega. Y los tres motivos de esa recomendacion
siguen en pie tal cual: el portal esta roto en produccion en dos puntos, la migracion de estados se encarece cada
dia, y E1+E2 es la unica parte del alcance sin ningun bloqueo externo. **El numero a presupuestar es 7 a 9 semanas
de un developer a tiempo completo, no 6 a 8.**

---

# 4. QUE PUEDE ARRANCAR UN DEVELOPER **MAÑANA**, SIN ESPERAR RESPUESTA DE NADIE

En orden. Este es el bloque contratable: **nada de aqui depende de Zelky, de una matriz, ni de una decision de Rick.**

**Unico requisito de arranque (no es "esperar respuesta", es onboarding del dia 1):** acceso de escritura al
repositorio git. Lo da Rick al contratar.

| # | tarea | criterio de aceptacion | esf. |
|---|---|---|---|
| **1** | **D01 — Commitear y pushear todo.** 2,807 lineas modificadas y 5 rutas sin versionar, en una sola maquina. Revisar antes que `.gitignore` no tape nada con credenciales y que no entre ningun `.env` ni key de service account. | `git status` → *"nothing to commit, working tree clean"*. `git log origin/main -1` muestra el commit nuevo. `git ls-files \| grep -c "portal/js/shell.js"` → `1`; idem `routes/messages.js` → `1`. | S |
| **2** | **D17 — Mover `repo/` a `_to_delete/`.** Despues de D01, nunca antes. | `ls .../repo` → *"No such file or directory"*; `ls .../_to_delete/repo` lista el contenido. | S |
| **3** | **D-INV — Inventario estatico de literales de estado.** Un grep sistematico que produzca la lista definitiva de sitios con literales de estado. Esta lista (§1.2) es el punto de partida; **verificarla, no confiar en ella.** Es el insumo de D05, D06, D18 y de la tabla de mapeo de D07. | Un archivo `organizacion/inventario_estados.txt` con `archivo:linea → literal` por cada ocurrencia. Debe encontrar **al menos los 32 sitios de §1.2**; si encuentra menos, el grep esta mal. | S |
| **4** | **D14 — Guard de sincronia `TIPOS_MED` ↔ `MED_VARIABLE_BY_SUBTYPE`.** Analisis puramente estatico, cero dependencias, y previene un bug que ya ocurrio una vez. | `node tracker/scripts/check_subtypes.js` sale con **codigo 0** con el codigo actual. Borrando una clave de `MED_VARIABLE_BY_SUBTYPE` sale con **codigo 1** e imprime el nombre exacto que sobra o falta. **Probar los dos casos.** | S |
| **5** | **D15 — Vias declarativas con flag `disponible`.** Incluir WHO-PQP con `disponible: false`. Es la palanca que despues accionan las Decisiones 2 y 3 de Rick — **construirla no presupone ninguna de las dos.** | Poner `disponible: false` en una via la hace **desaparecer** del Paso 1 sin tocar ninguna funcion de render; `true` la hace aparecer. Probar encendiendo y apagando "Reconocimiento Mutuo". | S |
| **6** | **D05 — `tracker/data/case_status.js`.** ⚠️ **Con una modificacion de mi parte respecto a `03`:** `03` dice sacar los nombres de las 14 fases del doc canonico de Drive, lo que convierte a D05 en dependiente de Zelky o de un acceso. **Evitable:** R18 ya fijo la numeracion y la identidad de las 14 fases, asi que las **claves** son `fase_01`…`fase_14` y lo unico que falta de Zelky es el **texto** de la etiqueta. Construir con `label: null` (o el texto provisional) y llenar las etiquetas despues **no cambia ni una linea** de D06, D07, D18 ni D19. Asi D05 arranca mañana. | `require('./tracker/data/case_status').CASE_STATUSES.length` → **18** (14 fases + `draft`, `submitted`, `pending_docs`, `deleted`). Ningun valor repetido. Exporta `isValidStatus()`. Las 14 claves son `fase_01`…`fase_14`; las etiquetas pueden estar vacias y eso **no** rompe ningun test. | S |
| **7** | **D05b — `DOC_STATUSES` (el segundo enum).** Los 8 valores de V4 (§1.1), incluida la decision sobre `pending_upload`, que hoy **solo existe en el frontend** (`wizard.js:325`) y no lo escribe ningun endpoint. | `DOC_STATUSES` exportado. Queda escrito en el ticket si `pending_upload` se conserva o se elimina, con su razon. | S |
| **8** | **D06 + D06b — Validar el enum en las TRES rutas de escritura.** No solo `cases.js`: tambien `mcp.js:421` y los tres `'pending_docs'` hardcodeados. **Si se hace solo `cases.js`, la validacion es evadible desde Claude Cowork** (§1.3a y §5). | `PATCH /api/cases/<id>` con `{"status":"fase_99"}` y token **admin** → **400** con el mensaje listando los validos; con una fase valida → **200** y Firestore refleja el cambio; con token de **cliente** y `{"status":"fase_07"}` → **400** (el comportamiento del cliente no cambia). **Y**: `tools/call` de `farmazed_update_case` con `{"status":"fase_99"}` → error `-32000` listando los validos. **Y**: `grep -rn "'pending_docs'" tracker/` → **0 resultados**. | M |
| **9** | **D06c — Descripciones del MCP generadas desde el enum.** | `GET /mcp` muestra en `farmazed_list_cases` los **18** valores de `CASE_STATUSES`. Agregar un estado al enum lo hace aparecer sin editar `mcp.js`. | S |
| **10** | **D18 — Panel admin manejado por el enum.** Un unico mapa `estado → {label, color}` de 18 entradas, consumido por `casos.html` y `expediente.html`. | Los 18 estados tienen label y color; **ninguno** cae al fallback `badge-draft` de `casos.html:165`. Los 4 contadores de `casos.html:136-139` se calculan sobre fases del enum. Cargar un caso en cada uno de los 18 estados deja el `<select>` de `expediente.html:206` **con valor**, nunca en blanco. | M |
| **11** | **D19 — `FASE_MAP` del cliente de 9 a 18 estados.** Conservar el flag `bloqueado`. Primer pedazo de R9. | Cada uno de los 18 estados cae en exactamente una fase visible. Renderizar un caso en cada uno de los 18 no produce ningun `undefined` en pantalla. | M |
| **12** | **D04 — Quitar la doble llamada del Paso 4.** El arreglo es lectura de codigo y cabe aqui; **la verificacion en DevTools necesita entorno**, asi que se cierra cuando exista (ver abajo). | En DevTools → Network, al entrar al Paso 4: **exactamente 1** request a `/documents` y **1** a `/checklist`. Hoy hay 2 de cada una. | S |

**Suma del bloque: aproximadamente 2 a 2,5 semanas de trabajo real sin una sola dependencia externa.** Es lo que un
developer puede facturar antes de necesitar nada de nadie — es la respuesta a *"¿cuanto puedo contratar hoy sin
riesgo?"*.

### Lo que **no** entra en esa lista, y por que

| tarea | que le falta | quien lo da |
|---|---|---|
| **D02, D03** (el 500 del Paso 4) | un entorno donde reproducir: config de Firebase, bucket, service account. Es el bloque de TOUCHPOINTS de `IMPLEMENTATION_PLAN.md`. **Empezar por ahi, no por el codigo** — la hipotesis (c) de D03 apunta a un permiso de service account. | **Rick** (credenciales/acceso GCP) |
| **D07** (migracion) | el conteo real de valores distintos de `status` en Firestore, para escribir la tabla de 9 filas | **Rick** (lectura Firestore) — mismo acceso que D08 |
| **D08, D09** (¿corrio el seed? + diff de precios) | lectura de Firestore y lectura del Drive | **Rick** (Firestore) · carpeta de **Zelky** (Drive) |
| **Etiquetas de las 14 fases** | el texto literal, no la estructura | **Zelky** — y con la modificacion del punto 6 **ya no bloquea nada de E1** |

**En una linea para Rick:** las tareas 1 a 12 arrancan mañana; para desbloquear el resto de E1 hacen falta **dos
accesos, los dos tuyos**: entorno GCP/Firebase (desbloquea D02/D03 y todo el bloque de infraestructura) y lectura de
Firestore (desbloquea D07/D08/D09).

---

# 5. EL PARCHE DE D06b, COMO DIFF — **no aplicado**

El agujero de §1.3(a). Se escribe aqui, no se aplica; lo aplica el developer.

```diff
--- a/tracker/routes/mcp.js
+++ b/tracker/routes/mcp.js
@@
 const { requireMcpKey } = require('../middleware/auth');
 const { getChecklist }  = require('../data/faddi_checklists');
 const { getSignedUrl }  = require('../services/storage');
+const { CASE_STATUSES, isValidStatus, PENDING_DOCS } = require('../data/case_status');
@@ async function handleUpdateCase({ caseId, status, notes, assignedTo, faddi }) {
   const update = { updatedAt: admin.firestore.Timestamp.now() };
-  if (status     !== undefined) update.status     = status;
+  if (status !== undefined) {
+    if (!isValidStatus(status)) {
+      throw new Error(`status invalido: "${status}". Validos: ${CASE_STATUSES.join(', ')}`);
+    }
+    update.status = status;
+  }
   if (notes      !== undefined) update.notes      = notes;
@@ async function handleRequestDocument({ caseId, faddiDocId, message }) {
   await db().collection('cases').doc(caseId).update({
-    status: 'pending_docs',
+    status: PENDING_DOCS,
     updatedAt: now,
   });
```

El mismo cambio de la segunda parte aplica a `tracker/routes/documents.js:149`, que escribe el literal
`'pending_docs'` en el caso por su cuenta.

---

# PENDIENTE

Lo que esta corrida **no** alcanzo a cubrir, dicho explicito:

1. **No recalibre E3 ni E4.** E3 sigue con la estimacion floja de 6–8 semanas que el propio roadmap marca como su
   cifra mas debil. Lo unico que aporto es que **D19 adelanta una parte de R9 dentro de E1**, asi que E3 deberia
   descontarla.
2. **No estime el bloque de infraestructura por separado.** Lo meti dentro del +1 semana de E1 apoyandome en los
   tiempos que el propio `IMPLEMENTATION_PLAN.md` declara (~3 h en total para los 7 touchpoints). **Esos tiempos son
   de mayo y nadie los ha verificado**; si el proyecto Firebase no existe o el bucket esta sin crear, pueden ser
   bastante mas. Las Firestore security rules **no** las conte: no hay forma de dimensionarlas sin ver las actuales.
3. **No abri `farmazed-web/src/`** (arbol `approx/`), ni `process_map.md`, ni `PM_INSTRUCTIONS.md`, ni `handover.md`
   (87 KB), ni `DEPLOY.md`. Si alguno tiene mas literales de estado, el conteo de 32 sitios sube. **Por eso la tarea
   D-INV del punto 3 dice explicitamente que verifique el grep en vez de confiar en mi lista.**
4. **No verifique nada en ejecucion.** Todo lo de este documento es lectura estatica de archivos. No se corrio el
   servidor, no se consulto Firestore, no se probo un endpoint. En particular: **no se cuantos casos existen en
   Firestore ni en que estados estan**, y eso es exactamente lo que decide si D07 es media hora o dos dias.
5. **No cruce contra `PM_COMMENTS.md` ni contra `observations/paso2_ux_dropdowns.md`.** El roadmap si lo hizo; este
   documento solo cruzo contra los dos que el roadmap declaraba pendientes.
6. **El hueco #5 del PENDIENTE del roadmap queda cerrado a medias.** Eran tres cosas: `mcp.js` (cerrado),
   `farmazed-web/admin/` (cerrado), y **las 12 carpetas `Fase N` del Drive sin recorrer (sigue abierto)** — no era
   parte de este encargo y no se toco Drive en esta corrida.
7. **El hueco #7 (QA y despliegue) queda parcialmente contestado, no resuelto.** Encontre que **si** existe un plan
   de QA (`dev_build_order.md` §"QA por fase") y **si** existe un runbook de despliegue (`IMPLEMENTATION_PLAN.md`
   §TOUCHPOINTS + `DEPLOY.md`, que **no lei**). Lo que no existe sigue sin existir: suite automatizada y criterio de
   release.

---

*Documento del PM. En esta corrida no se ejecuto ninguna accion sobre Google Drive, no se modifico ni una linea de
codigo, y no se hizo ningun commit. `FADDI CREDENTIALS.txt` y el Doc `Contrasenas` no fueron abiertos ni citados.*

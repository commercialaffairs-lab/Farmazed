# PM COMMENTS — Decisiones, preguntas abiertas y bloqueos

**Documento:** PM Comments
**Autor:** PM (Claude)
**Creado:** 14 de septiembre de 2026
**Última actualización:** 14 de septiembre de 2026 — 18 decisiones de Ricardo + primera tanda de respuestas regulatorias (`Respuesta_PM_ParteB_Zelky.docx`)

> **Reunión Ricardo + Zelky — 15 de septiembre.** Quedan 3 puntos que se resuelven entre los dos (R1/Z3, R17, Z15) y 15 regulatorios que responde Zelky. Ver el resumen al final.

---

## Cómo usar este documento

- **Parte 0** son las decisiones ya tomadas por Ricardo. Cerradas, salvo que él las cambie.
- **Parte A** es lo que sigue abierto de su lado.
- **Parte B** es para Zelky. Cada punto tiene identificador `Z#` y una línea `**Respuesta:**` para contestar aquí mismo.
- **Parte C** va directo al developer, sin depender de nadie.

Prioridad: 🔴 bloquea ahora · 🟡 bloquea la siguiente fase · ⚪ conviene definir sin urgencia

**Reparto acordado:** Ricardo decide programación, alcance y CRM. Zelky decide todo lo regulatorio y teórico. El PM no decide ninguna de las dos; traduce a instrucciones para el developer.

---

## Cómo intercambiar respuestas — convención de formato

Para que el PM pueda leer lo que se responde, sin pasos manuales de por medio:

**Lo que funciona:**
- Responder **dentro del Google Doc** de este documento, en las líneas `Respuesta:`. Es lo preferible — queda todo en un solo lugar y con historial de versiones.
- Un comentario de Google Docs sobre el párrafo correspondiente.
- Un `.docx` **guardado desde Word o Google Docs**.

**Lo que no funciona:**
- Archivos `.md` subidos al Drive. Drive no los renderiza; se ven como texto plano.
- `.docx` generados por herramientas que no arman el paquete correctamente. Ya pasó una vez: `Respuesta_PM_ParteB_Zelky.docx` (14 sept.) traía XML crudo incrustado como texto y el paquete no seguía el orden estándar de un OOXML. **Google Drive no pudo leerlo** — devolvía contenido vacío — y hubo que extraer el texto a mano descomprimiendo el archivo.

**Regla práctica:** si el documento se abre bien en Google Docs, el PM lo puede leer. Si se abre raro o vacío, hay que volver a guardarlo desde Word o Google Docs antes de subirlo.

---

# PARTE 0 — DECISIONES TOMADAS
### Ricardo, 14 de septiembre de 2026

| # | Decisión | Resultado |
|---|---|---|
| R2 | Renovaciones y modificaciones | **Sí, dentro del MVP** |
| R3 | Intercambiabilidad | **Trámite propio** (séptimo tipo) |
| R4 | Vías de registro | **Las cinco**, incluyendo WHO-PQP |
| R5 | Cliente con varios productos | **Cotización agrupa, casos individuales** |
| R6 | Roles con login | **Los cuatro**: cliente/titular, analista, admin/dirección, y abogado + farmacéutico regente |
| R7 | Modelo de cliente | **Empresa con varios usuarios** |
| R8 | Avance de fases | **Automático donde se pueda** |
| R9 | Visibilidad al cliente | **Vista simplificada** (hitos agrupados) |
| R10 | Modelo de estados | **Adoptar las 14 fases**, con migración de casos existentes |
| R11 | Pagos | **Pasarela integrada.** Cambio de plan: se cobra **100% en Fase 5** |
| R12 | Cotización | **Borrador automático** que Farmazed ajusta y envía |
| R13 | Límite 150 páginas IEA | **Cuenta y advierte**, no bloquea |
| R14 | Los 13 formularios | **Sí, descargables filtrados por trámite** |
| R15 | Carpeta `repo/` | **Mover a `_to_delete/`** |
| R16 | MVP | Registro nuevo + cotización + cobro + **renovaciones y modificaciones** |
| R18 | Fase 13 | **Se mantiene** — punto de control de gastos imprevistos. Flujo queda en 14 fases. |
| R19 | Tasas oficiales | **Todas dentro del pago de Fase 5**, cobradas por Farmazed. Farmazed paga después a DNFD, IEA y CNF. |
| R1 | Alcance de tipos de trámite | **Pendiente** — Ricardo lo discute con Zelky (ver Z3) |

---

## Interpretaciones del PM sobre estas decisiones

Anoto cómo pienso instruir al developer. Si alguna no es lo que quisiste decir, corrígela aquí.

**Sobre R8 (avance automático).** Lo voy a implementar como: automático en las fases operativas donde la condición es objetivamente verificable (checklist al 100%, pago confirmado por la pasarela, comprobante cargado), y **manual en las Fases 7, 10 y 12**. Esas tres son los puntos de control del flujo de Zelky: existen precisamente para que una persona juzgue si un documento sirve, está vigente y es conforme. Automatizarlas eliminaría el control de calidad regulatorio.

**Sobre R11 (100% en Fase 5).** Esto entra en conflicto con el documento de flujo de Zelky, que describe la Fase 5 como pago parcial con "porcentaje de avance" y la Fase 13 como el saldo. Elegiste mantener la Fase 13 como verificación de saldo cero, así que el flujo conserva sus 14 fases, pero **Zelky tiene que reescribir el texto de ambas fases** en su documento maestro (ver Z19). Mientras no lo haga, el documento del Drive y el portal dirán cosas distintas.

**Sobre R6 (abogado y farmacéutico con login).** Esto abre una pregunta regulatoria que no puedo resolver: si van a firmar o refrendar dentro del portal, hay que saber si la DNFD acepta firma electrónica o si el refrendo tiene que seguir siendo físico. Queda como Z21.

**Sobre R5 (cotización agrupa, casos individuales).** El `caseCode` sigue siendo por producto. Se agrega una entidad de cotización por encima, que agrupa N casos. Es un cambio de modelo de datos, no solo de interfaz.

---

## ⚠ Nota de alcance — leer antes de contratar al developer

Las decisiones de arriba definen un proyecto **considerablemente más grande** que lo construido hasta hoy. Lo digo sin ánimo de frenar nada, pero sí para que el presupuesto y el plazo se fijen sobre el alcance real y no sobre el portal actual.

Lo que hoy existe y funciona: registro nuevo de medicamentos y cosméticos, vías Regular y Abreviado, un rol de cliente y un flag de admin, checklist dinámico por subtipo, carga de documentos.

Lo que las decisiones agregan:

1. **Renovaciones y modificaciones** — dos flujos nuevos con requisitos y declaraciones juradas propias.
2. **Intercambiabilidad** como séptimo tipo de trámite.
3. **Tres vías nuevas** (Mutuo, WLA, WHO-PQP), de las cuales dos no tienen fuente utilizable todavía.
4. **Modelo de permisos completo** — cuatro roles, organizaciones con varios usuarios, y el modelo actual solo distingue admin de no-admin.
5. **Migración** de los casos existentes al modelo de 14 fases.
6. **Pasarela de pago** — proveedor, integración, conciliación, requisitos de seguridad. Es un frente técnico propio.
7. **Motor de cotizaciones** con entidad nueva que agrupa varios casos.
8. **Vista simplificada** para cliente además de la interna.
9. **Biblioteca de formularios** filtrada por trámite.
10. **Conteo de páginas** de documentos cargados.

Dos de estas dependen de material regulatorio que **hoy no existe**: WHO-PQP no tiene ninguna matriz en el Drive, y la de WLA está marcada como pendiente de verificar. El developer no puede construir esas dos vías hasta que Zelky las entregue (Z11, Z17).

Mi recomendación como PM: fijar el alcance completo como se decidió, pero **entregar por etapas** y no en un solo bloque. La primera etapa razonable sería registro nuevo con las vías que ya tienen matriz validada (Regular, Abreviado, Mutuo), permisos y las 14 fases; renovaciones, WLA, WHO-PQP e intercambiabilidad en la segunda. Si prefieres una sola entrega, dímelo y armo el backlog así.

---

# PARTE A — ABIERTO DE RICARDO

### 🔴 R1 — Tipos de trámite sin matriz validada

**Estado: pendiente, a discutir con Zelky.**

Higiénicos, plaguicidas, excepción y publicidad tienen checklist en el código, construido leyendo decretos directamente, **sin validación del área regulatoria**. Las tres opciones sobre la mesa: ocultarlos hasta tener matriz, dejarlos visibles con aviso de contactar a Farmazed, o dejarlos activos como están.

La decisión de negocio es tuya; la validación regulatoria es de Zelky (Z3). Conviene resolverlas juntas.

**Respuesta:**

---

### 🟡 R17 — Etapas de entrega

Derivado de la nota de alcance. ¿Entrega única o por etapas? Si por etapas, ¿cuáles van primero?

**Respuesta:**

---

### ✅ R18 — Fase 13 se mantiene — **CERRADA**

Al revisar las respuestas regulatorias apareció que **Zelky había decidido el 12 de septiembre que la Fase 13 desaparecía**, dejando un flujo de 13 fases con todo el cobro fusionado en la Fase 5.

**Respuesta de Ricardo (14 sept. 2026):** **la Fase 13 se mantiene, por seguridad, en caso de que el trámite incurra en gastos extras.**

El flujo queda en **14 fases**. La Fase 13 no es un cobro programado sino un **punto de control de gastos imprevistos** antes de radicar: si durante el trámite surgieron costos adicionales (tasas extra, reenvíos, modificaciones), se liquidan ahí. Si no surgió nada, se verifica saldo cero y se sigue.

**Al developer:** el enum de estados conserva las 14 fases. La Fase 13 se modela como punto de control con dos salidas posibles (saldo cero → avanza; saldo pendiente → requiere liquidación), no como un cobro fijo.

**Pendiente de Zelky:** actualizar el texto de las Fases 5 y 13 en su documento maestro y en el diagrama SVG, para que reflejen esto (ver Z19).

---

# PARTE B — PARA ZELKY
### Regulatorio y teórico

> Zelky: cada punto abajo es una pregunta que **solo el área regulatoria puede responder**. No son preguntas de programación. El portal traduce reglas regulatorias a un formulario; donde la regla no está clara o no está documentada, el portal no se puede construir sin adivinar — y adivinar en materia sanitaria no es aceptable.
>
> Los puntos Z17 a Z21 son nuevos: surgieron de las decisiones que tomó Ricardo el 14 de septiembre.

---

## B.1 Categorías sin matriz

### ✅ Z1 — Vacuna — **CERRADA**

**Respuesta (14 sept. 2026):** Vacuna **cae dentro de Biológicos**. El D.E. 27/2024, Art. 2 núm. 91 clasifica los medicamentos biológicos en cuatro grupos, y "vacunas" es uno de ellos (junto con hemoderivados procesados, biotecnológicos innovadores/biosimilares, y otros biológicos). El Bloque 3 de vigencia de matrices tampoco lista "Vacuna" entre las 10 categorías oficiales, y FADDI no le da casilla propia.

**Instrucción al developer:** eliminar `'Vacuna'` como subtipo seleccionable independiente. Quitar de `TIPOS_MED` en `wizard.js` y de `MED_VARIABLE_BY_SUBTYPE` en `faddi_checklists.js`, en el mismo commit.

*Fuente: D.E. 27/2024 Art. 2 núm. 91; Bloque 3 (Zelky, sept. 2026).*

---

### ✅ Z2 — Hemoderivados, Alérgenos y Cannabis — **CERRADA**

**Respuesta (14 sept. 2026):**

- **Hemoderivados y Alérgenos** caen dentro de **Biológicos**. El mismo Art. 2 núm. 91 incluye "hemoderivados procesados" como grupo, y los extractos alergénicos para inmunoterapia están documentados como Biológicos (no Biotecnológicos) en la taxonomía de referencia.
- **Cannabis queda FUERA del alcance del portal.** No es registro sanitario ante la DNFD: se rige por el régimen de licenciamiento de la **Ley 242/2021**, un trámite distinto y separado del que gestiona Farmazed.

**Instrucción al developer:** no agregar Hemoderivado, Alérgeno ni Cannabis como subtipos. Se atienden dentro de Biológicos (los dos primeros); Cannabis no se ofrece.

*Fuente: D.E. 27/2024 Art. 2 núm. 91; taxonomía Biológicos vs. Biotecnológicos; Ley 242/2021.*

---

### 🔴 Z3 — Higiénicos, Plaguicidas, Excepción y Publicidad: sin matriz validada

El portal tiene checklists para estas cuatro categorías, construidos leyendo los decretos directamente (855 RTCA higiénicos, 848 RTCA plaguicidas) **sin revisión del área regulatoria**. Para medicamentos existe una matriz que tú validaste; para estas cuatro no existe nada equivalente.

Necesito: o validar los checklists actuales, o producir matriz, o confirmar que no se ofrecen en el portal.

Ricardo dejó la decisión de negocio pendiente de conversarla contigo (R1).

**Respuesta:**

---

### 🟡 Z4 — Síntesis Química: falta la versión "guía"

En la carpeta oficial de matrices, las diez categorías tienen versión legal, pero Síntesis Química **solo tiene la legal** — no aparece la versión guía. Es la categoría de mayor volumen.

¿Existe y está en otro lado, o falta producirla?

**Respuesta:**

---

## B.2 Discrepancias entre las matrices y el portal

### 🔴 Z5 — Suplementos: el portal pide cuatro documentos que la matriz no lista

La matriz de Suplementos lista 14 requisitos. **No incluye** Clave de Lote, Proceso de Fabricación, Controles en Proceso, ni Patrones Analíticos.

El portal sí los exige, porque los aplica como base común a todos los subtipos de medicamento.

Una de dos: o la matriz no pretende ser exhaustiva de todo lo que FADDI pide en pantalla, o el portal le está pidiendo al cliente cuatro documentos de más. Necesito saber cuál.

Esta misma pregunta aplica en principio a Productos Naturales, Huérfanos y Radiofármacos, que también tienen exenciones conocidas.

**Respuesta:**

---

### 🔴 Z6 — Los poderes: ¿son uno o son tres?

La matriz distingue con claridad tres documentos: poder al abogado, autorización de trámite al farmacéutico, y poder del representante legal — cada uno con su formalidad (memorial, apostilla, traducción).

El portal tiene **un solo** documento llamado "Poder Original".

¿Son tres cargas separadas en FADDI, o se suben juntos en un mismo campo? Si son separados, necesito el código de campo FADDI de cada uno.

**Respuesta:**

---

### 🟡 Z7 — BPM: ¿uno por producto o uno por establecimiento?

La matriz dice "por CADA establecimiento que interviene en la fabricación (fabricante API, a granel, acondicionador primario y secundario)".

El portal lo trata como un documento único. ¿Debe permitir cargar varios BPM? ¿FADDI acepta múltiples archivos en ese campo?

**Respuesta:**

---

### 🟡 Z8 — Declaración Jurada de Procedimiento Abreviado

La matriz de Suplementos la exige explícitamente para el procedimiento abreviado (Res. 550/2019, Art. 4 num. 4). El portal, para Abreviado, solo agrega el expediente aprobado por la autoridad de referencia.

¿Aplica a **todos** los subtipos en vía abreviada, o solo a Suplementos?

**Respuesta:**

---

### 🔴 Z9 — Declaración Jurada de Renovación sin cambios

¿Aplica a todos los subtipos, o solo a los que la matriz correspondiente la menciona?

*Subió a prioridad crítica: Ricardo confirmó que renovaciones entran en el MVP.*

**Respuesta:**

---

## B.3 Verificaciones en la plataforma FADDI

### 🔴 Z10 — Dos códigos de campo FADDI sin confirmar

Hay dos documentos en el portal cuyo código de campo FADDI está pendiente porque el valor sugerido choca con otro campo ya usado:

| Documento | Código sugerido | Choca con |
|---|---|---|
| Etiquetas del envase primario y secundario | 15.16 | `patrones` (Patrones Analíticos) |
| Contrato de Fabricación | 15.11 | `monografia` (Monografía) |

Esto **solo se resuelve entrando a FADDI** y viendo el número real de esos dos campos en el Paso 15. No se puede deducir de los documentos.

Es bloqueante para producción: si el código está mal, el documento se sube al campo equivocado.

**Respuesta:**

---

## B.4 Vías de registro y normativa

### 🔴 Z11 — La matriz WLA está marcada "verificar"

El archivo se llama literalmente `Matriz_Reconocimiento_WLA_Farmazed verificar.docx`. No puedo usarla como fuente hasta saber si está validada o sigue en borrador.

*Bloqueante: Ricardo confirmó que WLA entra en el alcance.*

**Respuesta:**

---

### 🔴 Z17 — WHO-PQP: no existe matriz *(nuevo)*

Tu flujo de Fase 3 lista WHO-PQP como quinta vía de registro, y Ricardo decidió incluirla en el portal. **No hay ninguna matriz de WHO-PQP en el Drive.**

Para construir esa vía necesito la matriz de requisitos: qué documentos se exigen, con qué fundamento normativo, y qué cambia respecto de las otras vías.

Si WHO-PQP en realidad no es una vía que Farmazed ofrezca —y aparece en el flujo solo de forma informativa— avísame y se saca del alcance.

**Respuesta:**

---

### 🔴 Z18 — Renovaciones y modificaciones: ¿requisitos transversales o por subtipo? *(nuevo)*

Ricardo confirmó que renovaciones y modificaciones entran en el MVP.

Las matrices por categoría mencionan la renovación dentro de cada requisito ("en renovaciones sin cambios…", "en renovaciones con cambios…"), pero no existe una matriz consolidada de renovación ni de modificación.

Necesito saber si:
- **(a)** El conjunto de requisitos de renovación es el mismo para todos los subtipos, y basta una sola lista transversal; o
- **(b)** Varía por subtipo, y hay que extraer la regla de renovación de cada una de las diez matrices.

Y lo mismo para modificaciones, que además tienen tipos distintos según la lista de precios.

**Respuesta:**

---

### 🟡 Z20 — Intercambiabilidad: ¿cuál de los tres documentos es la fuente? *(nuevo)*

Ricardo decidió que intercambiabilidad sea un trámite propio en el portal. En el Drive hay tres documentos: *Intercambiabilidad Medicamento de Referencia*, *Intercambiabilidad medicamento Procedimiento Regular*, y *Requisitos para la renovación de la intercambiabilidad*.

¿Son tres variantes del mismo trámite que el cliente elige, o uno es el checklist principal y los otros son casos particulares? ¿Cómo se le pregunta al cliente cuál le corresponde?

**Respuesta:**

---

### 🔴 Z13 — Resolución 985 de 3 de julio de 2025 — **RESPUESTA PARCIAL**

**Respuesta (14 sept. 2026):** Sí, cambia — y más de lo que suponíamos. La **Res. 985/2025 deroga y reemplaza las Res. 385 y 386/2023**, consolidando una sola lista de **173 principios activos, TODOS obligatorios al momento del registro**. Desaparece la bifurcación obligatorio/voluntario que el portal asume hoy.

**Lo que falta:** las matrices y diagramas de Farmazed **siguen citando Res. 385/386 sin actualizar**. Hasta que se actualicen no se puede confirmar qué requisitos puntuales del checklist cambian más allá de la cita normativa.

⚠ Esto pega directo en el trámite de Intercambiabilidad, que Ricardo aprobó como tipo propio (R3). Ver Z22.

*Fuente: registro regulatorio interno (sept. 2026).*

---

### 🟡 Z14 — D.E. 2/2025 (WLA) — **RESPUESTA PARCIAL**

**Respuesta (14 sept. 2026):** Confirmado — el **D.E. 2/2025 es el instrumento que rige la vía WLA**, y cubre la red EMRN más nueve autoridades nacionales reconocidas.

**Lo que falta:** nadie ha verificado si `Matriz_Reconocimiento_WLA_Farmazed` refleja el decreto completo. Requiere comparación artículo por artículo — revisión de Zelky.

*Fuente: D.E. 2/2025 (registro regulatorio interno).*

---

### 🔴 Z22 — Actualizar las matrices que citan Res. 385/386/2023 *(nuevo, derivado de Z13)*

Consecuencia directa de Z13: toda matriz, diagrama o documento de Farmazed que cite las Res. 385 y 386/2023 está citando normativa **derogada**.

Necesito saber cuáles documentos hay que actualizar y con qué prioridad, porque el portal construye el checklist desde esas matrices. Mientras no se actualicen, el trámite de Intercambiabilidad no se puede construir sobre fuente confiable.

**Respuesta:**

---

## B.5 Preguntas nuevas derivadas de las decisiones de Ricardo

### 🔴 Z19 — Fases 5 y 13: hay que reescribirlas *(nuevo)*

Ricardo cambió el plan de cobro: **se cobra el 100% de los honorarios de Farmazed en la Fase 5**, no un porcentaje con saldo en Fase 13.

Tu documento maestro describe hoy la Fase 5 como pago parcial con "porcentaje de avance" y la Fase 13 como "cancelación del saldo pendiente".

Se decidió conservar las 14 fases, con la Fase 13 convertida en verificación de saldo cero antes de radicar. **Necesito que actualices el texto de ambas fases** en tu documento y en el diagrama SVG, para que el flujo oficial y el portal no digan cosas distintas.

Pregunta adicional: las tasas oficiales (DNFD, IEA, Colegio Nacional de Farmacéuticos) ¿las paga el cliente directamente, o pasan por Farmazed y se cobran también en la Fase 5?

**Respuesta parcial (14 sept. 2026) — ⚠ hay un conflicto de decisiones:**

Salió a la luz que **Zelky ya había decidido el 12 de septiembre que la Fase 13 desaparecía** — flujo de 13 fases, con todo el cobro fusionado en la Fase 5. La decisión de Ricardo del 14 de septiembre (R11) dice lo contrario: mantener las 14 fases, con la Fase 13 reconvertida en verificación de saldo cero.

**Resuelto por Ricardo (14 sept. 2026) — ver R18:** la **Fase 13 se mantiene**, por seguridad, en caso de que el trámite incurra en gastos extras. El flujo queda en 14 fases, con la Fase 13 como punto de control de gastos imprevistos antes de radicar.

**Tasas oficiales — resuelto por Ricardo (14 sept. 2026):** **todas las tasas se incluyen en el pago de la Fase 5**, que el cliente le hace a Farmazed. Farmazed paga después a cada autoridad (DNFD, IEA, Colegio Nacional de Farmacéuticos). La razón: así Farmazed controla el trámite y no depende de que el cliente ejecute el pago a tiempo.

**Lo que sigue pendiente de Zelky:** actualizar el texto de las Fases 5 y 13 en tu documento maestro y en el diagrama SVG, para que el flujo oficial y el portal digan lo mismo.

*Fuente: nota interna (Zelky, 12 sept.) vs. decisiones de Ricardo (14 sept., R11 y R18).*

---

### 🟡 Z21 — Firma electrónica del abogado y del farmacéutico regente *(nuevo)*

Ricardo decidió que el abogado y el farmacéutico regente tengan login propio en el portal.

Si la idea es que firmen o refrenden dentro del sistema, necesito saber si la DNFD acepta firma electrónica para estos actos, o si el refrendo del Colegio Nacional de Farmacéuticos y la firma del abogado tienen que seguir siendo físicos y solo se cargan como documento escaneado.

Es una pregunta regulatoria, no técnica: define si el portal es un repositorio de firmas o un instrumento de firma.

**Respuesta:**

---

## B.6 Organización del Drive

### 🔴 Z15 — "Matrices Definitivas para cliente" existe duplicada, con contenido distinto

Hay dos carpetas con ese nombre exacto:

| Ubicación | Creada | Estado |
|---|---|---|
| `Operaciones / Matrices Definitivas para cliente` | 12 sept | **Solo 4 de 10 carpetas tienen archivos** |
| `Operaciones / Flujos… / Proceso flujo cliente carpetas / Fase 10 / Matrices Definitivas para cliente` | 2 sept | **Las 10 completas** |

La de Fase 10 es la buena. La de Operaciones está a medio llenar y es la que un developer encontraría primero, porque está en el nivel superior.

Necesito que quede **una sola**, y saber cuál es la oficial.

**Respuesta:**

---

### 🟡 Z16 — "Guía" vs "LEGAL": ¿cuál alimenta el portal?

Cada categoría tiene dos documentos. Mi lectura es que la versión **guía** es la operativa (qué documentos pedirle al cliente) y la **LEGAL** es el sustento normativo (qué artículo respalda cada requisito).

Si es así, el portal se construye desde la guía y usa la legal para mostrarle al cliente el fundamento de cada requisito.

Confirmar. Nota: la nomenclatura no es uniforme — en Gas Medicinal la que parece ser la guía se llama `Matriz_Correo_Gas_Medicinal-3 definitiva.docx`, mientras que en otras categorías el prefijo `Matriz_Correo_` identifica a la legal. No puedo clasificarlas con certeza solo por el nombre.

**Respuesta:**

---

# PARTE C — Sin bloqueo externo
### Trabajo del developer

1. **Mover `repo/` a `_to_delete/`** y trabajar solo en `Proyecto Farmazetd Regulatory/`. *(R15 decidido)*
2. **Push inicial** del código completo al repositorio remoto.
3. **Validar el enum de `status` en backend** — hoy `cases.js` acepta cualquier string. Aplica ya con el modelo de 14 fases. *(R10 decidido)*
4. **Confirmar si `seed_pricing.js` se ejecutó** contra el Firestore de producción.
5. **Prueba visual end-to-end** con cuenta real, cliente y admin. Nunca se ha hecho.
6. **Bug abierto:** `observations/bug_documents_500.md`.
7. **Sincronizar `TIPOS_MED` en `wizard.js` con las claves de `faddi_checklists.js`** cada vez que se toque una de las dos. Un nombre distinto hace que el checklist salga vacío en silencio.

8. **Agregar campo `responsable` a cada documento del checklist** (`cliente` | `farmazed`). Derivado de R19: al cobrar Farmazed todas las tasas y pagarlas después a cada autoridad, los comprobantes dejan de ser carga del cliente. Cambian de responsable estos tres:
   - `tasa_servicio` (faddiCode 15.17) — recibo de la tasa DNFD
   - `recibo_iea` (15.1) — recibo del pago al IEA
   - `recibo_cnf` (16.1.1) — recibo del refrendo del Colegio Nacional de Farmacéuticos

   Hoy el portal se los pide al cliente. Debe pedírselos al equipo de Farmazed, y no bloquear el avance del cliente por documentos que él no puede aportar.

9. **El módulo de pagos necesita dos eventos distintos, no uno:** "cliente pagó a Farmazed" (Fase 5) y "Farmazed desembolsó la tasa a la autoridad". Son fechas y comprobantes separados, y el segundo alimenta los tres documentos del punto anterior.

10. **La cotización debe desglosar honorarios Farmazed vs. tasas oficiales.** El cliente paga un monto único, pero se compone de dos cosas de naturaleza distinta. La tabla de precios ya viene separada (ej. Abreviado: Farmazed $2,055 + DNFD $2,525 = $4,580), así que el dato existe — falta reflejarlo en el documento que ve el cliente.

---

## Resumen de bloqueos críticos

**Cerradas el 14 de septiembre (4):**

| ID | Resultado |
|---|---|
| Z1 | Vacuna → dentro de Biológicos. Se elimina como subtipo del portal. |
| Z2 | Hemoderivados y Alérgenos → dentro de Biológicos. Cannabis → fuera de alcance (Ley 242/2021). |
| R18 | Fase 13 se mantiene — punto de control de gastos imprevistos. Flujo queda en 14 fases. |
| R19 | Todas las tasas dentro del pago de Fase 5, cobradas por Farmazed. |

**Para la reunión Ricardo + Zelky (3):**

| ID | Qué se decide |
|---|---|
| R1 + Z3 | Los cuatro trámites sin matriz validada: ocultar, dejar con aviso, o validar los checklists. Decisión de negocio (Ricardo) + validación regulatoria (Zelky). Van juntas. |
| R17 | Entrega única o por etapas, y cuáles van primero. |
| Z15 | Cuál carpeta de "Matrices Definitivas para cliente" queda como oficial. Organizativa, no regulatoria. |

**De Zelky — regulatorias, bloquean ahora (10):**

| ID | Bloquea |
|---|---|
| Z5 | Que Suplementos no pida documentos de más |
| Z6 | Estructura de poderes |
| Z9 | Flujo de renovaciones (ahora en MVP) |
| Z10 | Salida a producción — códigos FADDI |
| Z11 | Vía WLA (ahora en alcance) |
| Z13 | Alcance real del cambio que trae Res. 985/2025 |
| Z17 | Vía WHO-PQP (ahora en alcance) — no existe matriz |
| Z18 | Flujo de renovaciones y modificaciones |
| Z22 | Matrices que citan normativa derogada (Res. 385/386) |

**De Zelky — prioridad media (6):** Z4, Z7, Z8, Z16, Z20, Z21. Más Z14 (verificar si la matriz WLA refleja el D.E. 2/2025 completo).

---

# PARTE D — Preguntas del mapeo 25-sep (solo Rick)

Salen del mapa de solo lectura (`handover.md` → "MAPA DEL PROYECTO — 2026-09-25"). Ninguna se decidió ni se ejecutó.

### 🔴 Q1 — ¿Dónde viven las decisiones F-1…F-7? ¿Ratificas F-6?
En el repo solo hay rastros: el commit `cf0949b` cita F-2 y F-7, y los comentarios de código citan F-6. El 21-sep a las 13:43 se aplicó sin registro un **espejo backend de F-2** (lista blanca en `tramites_habilitados.js`, guards en `cases.js` y `mcp.js`), después de que el handover dijera "backend sin tocar". ¿Lo ratificas? ¿Copio aquí la lista F-n para que quede en el repo?
**Respuesta:**

### 🔴 Q2 — Autorización para versionar (D01)
Hay un mes de trabajo (+2877 líneas, 7 rutas nuevas) solo en Patch, y `cf0949b` sin push. ¿Autorizas al dev a commitear por bloques y hacer push después de revisar que no entre ningún secreto?
**Respuesta:**

### 🔴 Q3 — Claves viejas en el repo público
`fz-admin-2026` / `fz-mcp-2026` están en `tracker/.env.example` y en `dashboard.html:736`. ¿Confirmas que en prod `ADMIN_KEY` y `MCP_KEY` son otras? ¿Las rotamos igual?
**Respuesta:**

### 🟡 Q4 — ¿Un solo frontend de cliente?
Conviven la raíz (`login.html` → `client-dashboard.html`), que es el frontend real desde el pivote del 26-ago, y `portal/` (`portal/login.html` → `portal/dashboard.html`, +1374 líneas sin commitear). ¿Se retira `portal/login.html` + `portal/dashboard.html` y todo va a la raíz?
**Respuesta:**

### 🟡 Q5 — Entorno para el dev
Hoy solo se puede correr contra el Firestore/GCS de producción. ¿Staging, emulador o acceso a prod? ¿Quién le da acceso GCP al dev? Esto bloquea D02/D03 (el 500 del Paso 4) y D07.
**Respuesta:**

### 🟡 Q6 — Decisiones del roadmap todavía abiertas
De `organizacion/04`: la **1** (entrega por etapas, R17), la **3** (WHO-PQP), la **4** (qué xlsx de precios manda) y la **5** (pasarela ahora o manual). La **2** ya quedó resuelta con F-2. ¿Alguna se decidió fuera del repo?
**Respuesta:**

### ⚪ Q7 — Host canónico de la API
¿`api.farmazed.com` o la URL `run.app` del tracker? Hoy el código usa ambos.
**Respuesta:**

### ⚪ Q8 — ¿Actualizo CLAUDE.md y PM_INSTRUCTIONS.md y ejecutamos R15?
Los dos siguen describiendo el pre-pivote y T0 con `repo/`. R15 (mover `repo/` a `_to_delete/`) se decidió el 14-sep y no se hizo.
**Respuesta:**

### ⚪ Q9 — Estado de las preguntas a Zelky (Z3–Z22)
¿Hubo avances en la reunión del 15-sep? El PM no tiene canal con Zelky y el insumo está en .docx/.pdf que el relay no lee.
**Respuesta:**

---

*Documento mantenido por el PM. Las respuestas se incorporan a `handover.md` como instrucciones al developer.*

---

# PARTE E — Respuestas de Rick (25-sep noche, directas al dev, relevadas por Argus)

1. **F-6 ratificada.** Se conserva el espejo backend de F-2.
2. **Claves vigentes → rotarlas con gcloud.** Advertencia de Argus (vinculante): primero sacar la clave del código público (`dashboard.html:736`, `.env.example`) y autenticar `/api/scans` del lado del servidor; recién después rotar. Rotar y volver a hardcodear es cosmético.
3. **Un solo frontend:** el de git/producción; el otro se borra. El dev demostró con sha256 contra farmazed.com que prod sirve la raíz (versión prototipo) → se retiró `portal/login.html`, `portal/dashboard.html`, `shell.js`, `shell.css` en `ecea3b0`, reversible desde `af3f304`.
4. **Correr contra producción** (no hay clientes reales). Bloqueado: falta ADC en Patch (lo debe ejecutar Rick).
5. **Commitear después de confirmar el código real; sin push.** Hecho: 8 commits locales `6ec1c98…63f7fa4`, `main` ahead de origin, sin push.

**Revisión del PM:** entrega aceptada salvo el punto 2 — el dev dejó la clave en el código "hasta rotar", orden inverso al correcto. Tarea asignada: mover `/api/scans` a `requireAuth+requireAdmin` y quitar la clave del JS y del `.env.example`. La rotación queda para después y necesita que Rick autorice/ejecute los `gcloud` que el clasificador bloqueó.
**Hallazgo:** producción sigue sirviendo el prototipo con credenciales demo; el trabajo del 25-26 ago nunca se desplegó.

**Entrega del ajuste Q2 — ACEPTADA** (verificada por Argus por ssh): commit local `49119a9`. `/api/scans` exige requireAuth+requireAdmin, `dashboard.html` manda Bearer idToken, `.env.example` en `change-me`, grep de las claves viejas fuera de docs = 0. Sin push, sin deploy, sin rotar.
**Corrección al análisis:** el repo es público y las dos claves ya están en `origin/main` desde antes. El push reduce la fuga (el tip deja de tenerlas); según T4, prod ya rechaza `fz-admin-2026`. La rotación sigue pendiente, pero es menos urgente. Push, deploy, gcloud y ADC están escalados a Rick (decisión #36).

---

# PARTE F — RUNBOOK DE DEPLOY Y ROTACIÓN (decisiones #36/#42) — escrito, NO ejecutado

Estado de partida: `main` va 11 commits por delante de `origin/main` (hasta `49119a9` + docs). Producción sirve el prototipo del 25-ago (`login.html` con `ricardo`/`user` + `admins123`).
Fuentes: `DEPLOY.md:44-66` (web), `PM_INSTRUCTIONS.md:515` (usar el método gcr.io en dos pasos, no `--source .`), `handover.md:215-235` (tracker).
**Orden obligatorio:** tracker antes que web. El `dashboard.html` nuevo llama a `/api/scans` con Bearer, y eso solo lo entiende el tracker nuevo.

### Paso 1 — Allow list · **lo edita Rick**
Archivo: `Proyecto Farmazetd Regulatory/.claude/settings.local.json`, dentro de `permissions.allow`:
```json
"Bash(git push origin main)",
"Bash(curl -s*)"
```
- La primera permite el push del paso 2. La segunda permite las comprobaciones del paso 5.
- **Recomendación del PM: no dar `gcloud` al dev.** DEPLOY.md:46 dice que el deploy se hace desde Cloud Shell. Además, en la rotación las claves nuevas quedarían escritas en el transcript del dev. Por eso los pasos 3 y 4 los corre Rick en Cloud Shell.
- Si Rick igual quiere delegarlo, las líneas serían `"Bash(gcloud builds submit --tag gcr.io/farmazed/*)"` y `"Bash(gcloud run deploy farmazed-*)"`. El paso 4 sigue siendo de Rick.

### Paso 2 — Push · **lo corre el dev** (o Rick)
```bash
cd "/home/claude-msi/Projects/Farmazed/Proyecto Farmazetd Regulatory"
git status -sb            # esperado: ## main...origin/main [ahead 11], sin cambios de código
git log origin/main..main --oneline
git diff origin/main..main | grep -n "fz-admin-2026\|fz-mcp-2026\|admins123"   # solo líneas '-' o docs
git push origin main
```
Resultado esperado: `git status -sb` → `## main...origin/main`, sin ahead.

### Paso 3 — Deploy · **lo corre Rick en Cloud Shell** (console.cloud.google.com, proyecto `farmazed`)
```bash
cd ~/Farmazed && git pull origin main      # si no existe: git clone https://github.com/RichoX-Hub/Farmazed.git
git log -1 --oneline                       # debe coincidir con el HEAD que se empujó

# 3a) Tracker (API) — handover.md:226-234
cd ~/Farmazed/tracker
gcloud builds submit --tag gcr.io/farmazed/farmazed-tracker
gcloud run deploy farmazed-tracker \
  --image gcr.io/farmazed/farmazed-tracker \
  --region us-central1 \
  --service-account farmazed-api-sa@farmazed.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port 8080
curl -s https://farmazed-tracker-267037695065.us-central1.run.app/health   # → {"status":"ok"...}

# 3b) Web — DEPLOY.md:59-65 con el método de PM_INSTRUCTIONS.md:515
cd ~/Farmazed
gcloud builds submit --tag gcr.io/farmazed/farmazed-web
gcloud run deploy farmazed-web \
  --image gcr.io/farmazed/farmazed-web \
  --region us-central1 \
  --allow-unauthenticated \
  --port 80 \
  --memory 256Mi \
  --quiet
```
- En 3a se omite `--set-env-vars` a propósito. Sin ese flag, el deploy conserva las variables actuales (`GCS_BUCKET`, `ADMIN_KEY`, `MCP_KEY`, `REDIRECT_URL`). Si se incluye, las reemplaza todas.
- El repo no define ningún `cloudbuild.yaml` ni script de deploy. Lo de arriba es todo lo que hay documentado.

### Paso 4 — Rotación de ADMIN_KEY y MCP_KEY · **lo corre Rick en Cloud Shell**
**Dónde viven hoy [S, sin verificar]:** en variables de entorno planas del servicio Cloud Run `farmazed-tracker`, puestas con `--set-env-vars` (handover.md:232). No se pudo confirmar porque le denegaron el `describe` al dev. Rick puede confirmarlo sin imprimir los valores:
```bash
gcloud run services describe farmazed-tracker --region us-central1 \
  --format="value(spec.template.spec.containers[0].env[].name)"
```
Rotación, conservando el mismo lugar (variables de entorno):
```bash
NEW_ADMIN=$(openssl rand -hex 32)
NEW_MCP=$(openssl rand -hex 32)
gcloud run services update farmazed-tracker --region us-central1 \
  --update-env-vars "ADMIN_KEY=$NEW_ADMIN,MCP_KEY=$NEW_MCP"
echo "$NEW_ADMIN"; echo "$NEW_MCP"    # copiar al gestor de contraseñas y cerrar la terminal
```
**Dónde quedan después:** en las mismas variables de entorno de `farmazed-tracker` (el valor solo lo ve quien tenga acceso al proyecto GCP) y en el gestor de contraseñas de Rick. **Nunca en el repo.**
**Quién usa cada clave:**
- `ADMIN_KEY`: `admin/precios.html` y `POST /api/admin/set-role`. El admin la escribe en pantalla, así que no hay que cambiar código.
- `MCP_KEY`: el plugin de Cowork (handover, Paso 8). Hay que actualizarle la clave; si no, deja de funcionar.

*Mejora opcional, no incluida:* pasar las claves a Secret Manager con `--update-secrets` y dar `secretAccessor` a `farmazed-api-sa`. Si se quiere hacer, es una tarea aparte.

### Paso 5 — Comprobación · **la corre el dev** (con `curl -s` permitido) **o Rick**
```bash
# a) Ya no se sirve el login demo
curl -s https://farmazed.com/login.html | grep -c "admins123"          # esperado: 0 (hoy: 2)
curl -s https://farmazed.com/login.html | grep -c "firebase-auth"      # esperado: ≥1
curl -s https://farmazed.com/login.html | sha256sum                    # igual a:
git show HEAD:farmazed-web/login.html | sha256sum
# repetir sha256 para dashboard.html y client-dashboard.html
curl -s -o /dev/null -w "%{http_code}\n" https://farmazed.com/portal/login.html   # el clon retirado ya no existe; ver qué devuelve (nginx puede mandar al index)

# b) /api/scans ya no acepta la clave por URL
T=https://farmazed-tracker-267037695065.us-central1.run.app
curl -s -o /dev/null -w "%{http_code}\n" "$T/api/scans?key=fz-admin-2026"   # esperado: 401

# c) Rotación efectiva (después del paso 4)
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$T/api/admin/set-role" -H "x-admin-key: fz-admin-2026"   # esperado: 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$T/mcp" -H "Authorization: Bearer fz-mcp-2026" \
  -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'              # esperado: 401
```
- Prueba manual de Rick: entrar a farmazed.com/login.html con la cuenta admin de Firebase y confirmar que el panel QR de `dashboard.html` carga. Eso depende de que la cuenta tenga el claim `admin` (handover, entrada `49119a9`).

### Aparte — login ADC para correr contra producción (Q4) · **lo corre Rick en Patch**
`! gcloud auth application-default login`. No se necesita para este runbook; sirve para desbloquear D02/D03/D07.

---

# PARTE G — Desvinculación de pb-website (Dominius) · 2026-09-28

Contexto: el repo propio es `github.com/commercialaffairs-lab/Farmazed` (es el mismo que `RichoX-Hub/Farmazed`, transferido; GitHub redirige). gitleaks sobre los 39 commits: las claves viejas `fz-admin-*`/`fz-mcp-*` están en 8 commits antiguos (ya fuera del código en HEAD). La apiKey web de Firebase no es secreto. `FADDI CREDENTIALS.txt` nunca estuvo en este repo.

Rescate: 11 assets de marca que solo vivían en el historial de pb-website → `~/Projects/Farmazed/Markting/rescate-pb-website-2026-09-28/` (verificados por hash contra el mirror `~/respaldo-2026-09-27/pb-website-mirror.git`). pm-dominius tiene el OK para purgar `products/portal/demo/Proyecto Farzetd Regulatory/` de su historial.

Decisiones de Rick (28-sep):
1. Repo **privado**: hecho (verificado con `gh api`).
2. Rotar `ADMIN_KEY`/`MCP_KEY`: **Rick autoriza `gcloud` al dev.** Reemplaza la recomendación del Paso 1/4 de la Parte F (allí era Rick en Cloud Shell). Regla: las claves nuevas no se imprimen en la terminal del dev.
3. Reescribir historial + force-push: **No.** Repo privado + rotación bastan.
4. Push de los 11 commits: **Sí**, previa actualización de `origin` a la URL nueva.
5. Quitar la propuesta de Farmazed de pb-website (`farzetd-regulatory/index.html`, nginx, Dockerfile, tarjeta en DemoApp): **Sí**, lo ejecuta pm-dominius.
6. Clave demo (`ricardo`/`user` del prototipo, citada en pb-website `LOCAL-DOCKER.md:273`): **Sí.** En Farmazed esas cuentas están en el `login.html` estático que sirve prod; desaparecen con el deploy del frontend nuevo (Parte F, paso 3b).

Seguimiento 28/29-sep:
- Push hecho: `main` = `origin/main` = `5729a63` en commercialaffairs-lab/Farmazed. `origin` local sigue en la URL de RichoX-Hub (redirige); el clasificador le negó `set-url` al dev, lo corre Rick.
- Rotación hecha: `farmazed-tracker` (proyecto `farmazed`) revisión 00003-ggw; claves viejas → 401. Claves nuevas solo en env vars de Cloud Run; Rick las copia a su gestor y a Cowork.
- **Rick (29-sep, confirmado en la sesión del PM):** deploy a prod (tracker y luego web) **lo corre el dev** con gcloud desde Patch, Parte F paso 3. Borrar **solo el servicio** `farmazed-tracker` del proyecto `durable-sky-484422-b5`; el proyecto se queda. (La misma orden llegó antes vía Dandy y no se ejecutó hasta la confirmación de Rick.)
- 29-sep, verificación DNS (pedida por Rick vía Dandy, solo lectura): el registrador delega farmazed.com a `ns-cloud-e1..e4` = zona `farmazed-zone` del proyecto `farmazed` (SOA serial 4 igual en los 4). A/AAAA/MX/SPF/DKIM/www/api: autoritativo = público (8.8.8.8). Certificados TLS válidos (farmazed.com hasta 12-nov-2026, www 15-nov, api 23-nov); domain mappings en True; dominio vence 23-abr-2027; sin DNSSEC. La zona `farmazed-com` de `durable-sky-484422-b5` (NS c1–c4, vacía) no la usa nadie. Borrarla: pendiente de orden directa de Rick.

---

# PARTE H — Encargo de Rick 29-sep: tres interfaces (cliente, empleados, admin) con cumplimiento estricto de los procesos

**Orden de Rick (directo):** "con la base de datos de procedimientos y matrices del Drive, desarrollen la interfaz de usuario, la de empleados y la del admin, para dar estricto cumplimiento a estos procesos. Queda Dandy a cargo mientras descanso."

**Lectura del PM:** es el roadmap ya escrito en `organizacion/04_ROADMAP.md` (E1 → E2 → E3). "Empleados" = los roles internos de R6/R7: analista, abogado, farmacéutica regente; "admin" = dirección. El cumplimiento estricto sale de las matrices del Drive (`organizacion/02_MAPA_DATA.md`) y de la máquina de 14 fases; las Fases 7, 10 y 12 son control manual y no avanzan solas.

**Orden de trabajo:**
- **Fase 0 — Entorno local:** emuladores de Firebase (Auth, Firestore, Storage) con datos de prueba. Todo lo que sigue se prueba ahí; nada escribe en producción.
- **Fase 1 = E1:** D17, D02→D03→D04, D05→D06→D07 (enum de 18 estados + migración, probada en emulador), D14, D15. D08 es lectura de prod: permitida solo lectura.
- **Fase 2 = E2:** D10→D11 (responsable por documento), D12, D13, D16 (prueba end-to-end cliente + admin).
- **Fase 3 = E3:** roles cliente/titular, analista, abogado+regente, admin; organizaciones multiusuario; interfaz de empleados; matriz de permisos con un test por celda; vista de hitos del cliente; biblioteca de formularios.

**Límites mientras Rick no esté (Dandy a cargo de lo rutinario):** sin deploy, sin commit/push, sin escribir en el Firestore/Storage de producción, sin recursos que cobren, sin `sudo`. Instalaciones en espacio de usuario (npx, JDK en ~/.local) sí.

**Decisiones abiertas del roadmap que siguen siendo de Rick** (se avanza con el supuesto indicado y se puede revertir): 1 entrega por etapas (supuesto: sí); 3 WHO-PQP (supuesto: fuera, oculto); 4 qué xlsx de precios manda (supuesto: el canónico del 12-sep, sin tocar prod); 5 pasarela de pago (supuesto: manual).

## H.1 — Etiquetas de las 14 fases y estados post-presentación (decisión del PM, 29-sep, revertible por Rick)
Fuente: SVG canónico de Zelky `Flujo_Cliente_Farmazed_ SVG 14_Fases_vertical.svg` (Drive `1FaoT49WePyC6QgyxeTXonIAsSguMUBFS`, 12-sep). El docx canónico `1zIRjEU3…` ya no está en Drive.
1 Contacto inicial por la web · 2 Captación de datos del cliente · 3 Vía de registro y categoría · 4 Cotización del servicio · 5 Pago de honorarios · 6 Expediente interno (CRM) · **7 Documentación digital** (control, subsanar) · 8 Paquete IEA y revisión legal · 9 Revisión del expediente · **10 Cotejo con matrices guía** (control; subsanar → vuelve a 7) · 11 Originales por DHL · **12 Verificación física** (control; subsanar → vuelve a 11) · 13 Pago de honorarios Farmazed · 14 Dossier y presentación.
Salida del flujo: "expediente presentado ante DNFD e IEA". **Lo que pasa después no es una fase.**
Decisión: el enum suma 3 estados post-presentación: `observado_dnfd` (DNFD pide subsanar), `aprobado`, `denegado` → **21 estados**. Mapeo legacy: `denied`→`denegado`, `approved`→`aprobado`, `observed`→`observado_dnfd`, `faddi_submitted`→`fase_14`. `in_review` y `faddi_ready` quedan provisionales.
Transiciones de subsanación permitidas hacia atrás: 10→7, 12→11, `observado_dnfd`→7 o 10.
**Pendiente de Rick:** el conteo de casos por estado en el Firestore de producción (solo lectura) fue denegado por el clasificador de permisos. Sin ese dato, el mapeo de `in_review`/`faddi_ready` sigue provisional y la migración no se corre en prod.

## H.2 — Módulo "Precios" del cliente (29-sep)
El dev construyó una lista de precios visible para todos los clientes (no existía ninguna vista de costo). Mostrar el tarifario completo es decisión comercial, y 5 montos pueden estar subfacturados (05_DIFF_PRECIOS_D09). **PM: queda detrás de un flag apagado por defecto.** El desglose honorarios/tasas se mostrará en la cotización de cada caso (E3, R5/R12). **Pregunta a Rick:** ¿el cliente debe ver el tarifario completo, o solo su cotización?

## H.3 — Qué pago bloquea cada fase (decisión del PM, 29-sep, revertible)
Fuentes: SVG de Zelky ("5 · Pago de honorarios", "13 · Pago de honorarios Farmazed") y `F05-Fase 5. Pago del Proceso de Registro.docx` ("Pago del costo del trámite… % de pago o método de pago").
Lectura: fase 5 y fase 13 son **pagos del cliente a Farmazed** (probable anticipo y saldo). El pago `farmazed_a_autoridad` (tasas DNFD/IEA/CNF/MEF) no es una fase: su comprobante es documento del dossier (15.17, 15.1, 16.1.1, responsable Farmazed) y se exige antes de salir de **fase_14** hacia la presentación.
Gates: fase_05 → `cliente_a_farmazed` con `fase:'fase_05'`; fase_13 → `cliente_a_farmazed` con `fase:'fase_13'`; salir de fase_14 → al menos un `farmazed_a_autoridad`. Override del admin intacto.
**Pregunta a Rick/Zelky:** ¿fase 5 y fase 13 son anticipo y saldo del mismo honorario, o la fase 5 incluye las tasas oficiales?

## H.4 — Especificación de E3: roles, empresas e interfaz de empleados (propuesta del PM, 29-sep, revertible)
Base: R6 (cuatro roles con login) y R7 (empresa con varios usuarios), PM_COMMENTS líneas 51-52; roadmap E3. **Sin firma electrónica** (Z21, E4).

**Roles (6 valores en el claim `role`, + `orgId` para los de cliente):**
| rol | quién | ve | puede |
|---|---|---|---|
| `cliente_titular` | dueño de la cuenta de la empresa | todos los casos de su empresa, en hitos | crear casos, subir docs del cliente, ver pagos, invitar/quitar miembros de su empresa |
| `cliente_miembro` | empleado de la empresa cliente | casos de su empresa | crear casos y subir docs; no gestiona usuarios |
| `analista` | empleado Farmazed | casos asignados a él | avanzar fases secuenciales, pedir documentos, confirmar controles **7** y **12**, subsanar |
| `abogado` | empleado Farmazed | casos asignados, sección legal | confirmar **fase 8** (revisión legal), marcar docs legales (poderes, autorizaciones) aprobados/observados |
| `regente` | farmacéutica regente | casos asignados, sección técnica | confirmar **fase 10** (cotejo con matrices), marcar docs técnicos aprobados/observados |
| `admin` | dirección | todo | todo lo anterior + override, registrar pagos, precios, asignar casos, gestionar empleados y empresas |

Reglas duras: override y pagos solo `admin`. Un cliente nunca ve casos de otra empresa (403). Cada confirmación de control guarda quién y cuándo en `statusHistory`. Un caso tiene `asignados: {analista, abogado, regente}`.

**Alta de usuarios (supuesto: por invitación, sin registro abierto):** el admin crea la empresa e invita al titular; el titular invita a sus miembros; el admin invita a los empleados. Enlace de invitación de un solo uso. La página de registro libre no se construye.

**Interfaz de empleados:** "Mi bandeja", con los casos asignados y la acción pendiente de cada uno según su rol (p.ej. "Cotejo con matrices pendiente"). Desde ahí se abre el expediente con solo las acciones que su rol permite.

**Vista del cliente (R9):** los 21 estados agrupados en 4 hitos (ya existe en client-dashboard), por empresa.

**Criterio de salida:** matriz endpoint × rol con un test por celda (permitido/403); spec Playwright por rol; un cliente de la empresa A recibe 403 en un caso de la empresa B.

**Preguntas a Rick:** (1) ¿invitación o registro abierto? (2) ¿el analista puede confirmar los controles 7 y 12, o solo el admin? (3) ¿abogado y regente son usuarios de Farmazed o externos por caso?

## H.5 — Respuestas vía Dandy (30-sep)
- GCP: el proyecto `farmazed` **se queda** en la organización de PBS.
- `set-url` del origin: lo hace Rick más tarde; no bloquea.
- §H.1–H.4: Rick las revisa en local; si las ve bien, quedan como están.
- Conteo de producción (solo lectura) y commit: autorizados por Rick **vía Dandy**. **No ejecutados.** El commit requiere orden escrita de Rick según las reglas del PM. La lectura de producción la bloquea el clasificador de permisos: Rick debe agregar la regla de permiso o correr el conteo él mismo.

## H.6 — Biblioteca de formularios (R14) y renovaciones (30-sep)
- Hecha en local con la serie canónica 1–13. Formularios **1, 2, 3 y 10** quedan `por_confirmar` (autorizaciones y declaración genérica sin vía ni tipo de solicitud en el texto). **Pregunta para Zelky, vía Rick:** ¿a qué trámites aplican los formularios 1, 2, 3 y 10?
- El modelo de casos no distingue Renovación (el wizard fija "Nuevo Registro"). Renovaciones y modificaciones **están en el MVP (R16)**, pero bloqueadas en E4-a: no hay matriz consolidada de Zelky (`04_ROADMAP.md` l.157, 213; Z18/Z9). No se construye el flujo sin checklist. Mientras tanto, los 6 formularios de renovación, intercambiabilidad y no comercializados solo se ven en la biblioteca del admin.

## H.7 — Cotizaciones (R5/R12) (30-sep)
- Hecha en local: cotización por empresa que agrupa casos, borrador automático al entrar a fase_04, ajuste con motivo, envío, aceptación **solo por el titular**, y gate fase_04→05.
- **Sin precio en el tarifario** (no se inventan; el admin los completa a mano): Regular + Biológicos/Homeopático/Suplementos/Vacuna; Abreviado + Vacuna/Contraste/Gas/Naturales. **Pregunta para Rick/Zelky:** montos de esas categorías.
- PM: el gate de cotización aplica también a casos sin `orgId` (se rechazan con mensaje claro; override del admin disponible). Un caso sin empresa es dato sin migrar, no una excepción al control.
- 30-sep (vía Dandy): las preguntas para Zelky de §H.3, §H.6 y §H.7 están en trámite (Raion la entrevista). Las de §H.4 son de Rick y las revisa en local. Se sigue avanzando con los supuestos actuales.

## H.8 — El flujo canónico pasa a 13 fases (decisión del PM con respaldo documental de Zelky, 30-sep) · **reemplaza §H.1 y §H.3**
Fuentes (Drive, Operaciones > "Flujos del proceso de registro sanitario", ambos de Zelky, 26-sep): `Matriz_flujo_cliente_.docx` (`1HZUNrJx5Xn-BsZnh3GwpNRAAc6OHBLKY`) y `Manual_flujo_al_cliente_.docx` (`1-yN2k57YiUoTBX2IIm45gaWq101EoETl`). La matriz dice: *"Los archivos … conservan la numeración anterior de 14 fases … hasta que se renombren"* → el SVG de 14 fases (12-sep) queda superado.

**Fases (bloque · nombre · responsable):**
A · 1 Primer contacto (Farmazed) · 2 Captación de información preliminar (Farmazed) · 3 Tipo de registro sanitario y ruta de registro (Farmazed · Lic. Zelky Marín)
B · 4 Elaboración y envío de cotización (Farmazed; el cliente acepta con nombre, firma y fecha; **NO acepta → cierre del expediente y archivo**) · 5 Pago de costos del trámite (Cliente paga, Farmazed verifica)
C · 6 Apertura de expediente interno — CRM (Farmazed) · 7 Instrucción al cliente: documentación requerida (Farmazed; **no enviar originales**) · **8 Recepción y revisión de documentación digital — PUNTO DE CONTROL** (Farmazed revisa: cotejo con matrices guía, verificación legal de poderes/declaraciones, consistencia cruzada IEA/DNFD, fórmula por unidad de dosis, límite 150 págs IEA; cliente subsana; NO → subsanación y nuevo cotejo **en la misma fase 8**)
D · 9 Solicitud y envío de documentos originales (cliente envía por DHL, Farmazed instruye) · **10 Recepción y verificación de originales — PUNTO DE CONTROL** (firmas, apostillas, vigencia, muestras; NO → vuelve a 9 o 10)
E · 11 Confección de dossiers DNFD e IEA (Farmazed · Lic. Zelky Marín) · 12 Ingreso ante DNFD e IEA (número de expediente DNFD al CRM) · 13 Seguimiento y gestión post-ingreso (observaciones del evaluador, resultados IEA; **salida: Certificado de Registro Sanitario entregado**)

**Máquina de estados resultante (21):** `fase_01`…`fase_13` + `draft`, `submitted`, `pending_docs`, `deleted` + `cerrado` (cotización rechazada, con motivo) + `observado_dnfd`, `aprobado` (certificado entregado), `denegado`.
Transiciones: secuencial; `fase_04`→`cerrado`; `fase_08`→`fase_08` (nuevo ciclo, se registra); `fase_10`→`fase_09`; `fase_13`→`observado_dnfd`→`fase_13`; `fase_13`→`aprobado`|`denegado`.
**Controles manuales:** fase 8 exige **dos confirmaciones**: legal (abogado) y técnica/matrices (regente); fase 10: analista. Admin puede todo con override.
**Plazo de subsanación DNFD** al entrar a `observado_dnfd`: Regular 3 meses, Abreviado 8 días hábiles (Art. 22 D.E. 27/2024). Se muestra la fecha límite.

**Pagos (reemplaza §H.3):** todo se paga en fase 5 según la cotización aceptada: honorarios Farmazed; tasas DNFD (tasa por servicio B/.200 + MEF B/.25 extranjeros); IEA si aplica (B/.1,500 regular / B/.2,250 expedita), **en cheques separados** → un registro de pago por concepto. Salir de fase 5 exige honorarios (monto del anticipo pactado) + tasas DNFD + IEA si aplica. El saldo de honorarios se registra y se ve, pero no bloquea fases (Zelky: "definición del porcentaje de avance… y de la cancelación del saldo").

**Precios:** el xlsx `Actualización de nuestros precios para la plataforma - copia.xlsx` (`15H9YqBTwdEyqQySmhsScGYKnFBAgKru-`, 24-sep) es más nuevo que el canónico del 12-sep y trae Abreviado (SQ, Biológicos, Prioridad innovadores, Suplementos, Homeopáticos, Radiofármacos, Huérfanos, Mutuo acuerdo, WLA WHO), Regular (general, SQ, Naturales, Gases, Contraste, Cosméticos por 10 variedades, Intercambiabilidad), 8 renovaciones y ~27 modificaciones. Se carga **solo en el emulador** con un informe de diferencias. En producción no cambia ningún precio sin Rick (es dinero). La fila "Renovación por trámite abreviado" tiene `#REF!`: queda sin total. Combinaciones que el xlsx no trae (Regular + Biológicos/Homeopático/Suplementos/Vacuna; Abreviado + Vacuna/Contraste/Gas/Naturales): **pregunta a Zelky** si existen como ruta o no deben ofrecerse.

**Pendiente de Zelky (vía Raion):** formularios 1, 2, 3 y 10 (§H.6), en trámite.
- 30-sep: Zelky no entendió la pregunta técnica sobre los formularios 1, 2, 3 y 10. El PM redactó una versión en lenguaje llano para que Raion se la reenvíe: nombre de cada formulario (1 Autorización de Representación Legal por Titular · 2 ídem por Casa Matriz · 3 Autorización de Trámite RS al Farmacéutico · 10 Declaración de Nombre Comercial MED), y para cada uno: en qué tipo de registro, para qué productos, y si va siempre o solo en ciertos casos (¿1 y 2 son alternativos?).

## H.9 — Qué se aplica de la auditoría checklist vs matrices SQ/BIO (decisión del PM, 30-sep, revertible) · ver `organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md`
Fuente de verdad: matrices de Zelky del 28-sep (carpeta Drive "Matriz_to Claude"). Solo registro nuevo.
1. **recibo_iea deja de depender del subtipo** y pasa a depender del caso: se exige solo si la cotización marcó `aplicaIEA` (Zelky decide en fase 3 si requiere IEA; BIO-03: en Abreviado no aplica, D.E. 29/2023 Art. 6).
2. **faddiCode 15.14** repetido en 3 documentos → los 3 quedan `PENDIENTE_VERIFICAR` como las otras colisiones conocidas.
3. **Biológicos y Biotecnológicos** siguen como dos opciones del wizard (así lo pide la plataforma), pero con **los mismos requisitos**: la matriz de Zelky es unificada. `farmacovigilancia_bio` aplica a ambos (BIO-29).
4. **Se agregan los FALTA** de la auditoría como documentos del cliente, con el fundamento normativo de la matriz en su descripción: SQ — declaración de protección de datos de prueba, especificaciones del principio activo y materias primas; BIO — los 7 de la auditoría. faddiCode `PENDIENTE_VERIFICAR` si la matriz no da uno.
5. Lo marcado **"⚠ VERIFICAR"** por Zelky (bioequivalencia SQ-15, BIO-S/N-1) entra como **opcional con nota "Farmazed confirma si aplica"**, sin bloquear.

## H.10 — Rick autoriza commit y push (30-sep, directo en la sesión del PM)
"procede con todo pero no hagas deployment aun, solo commit y push, asi yo pruebo todo en local desde la pc de argus." → commit por bloques + push a `origin main`. **Sin deploy y sin migraciones en producción.** El conteo de producción sigue bloqueado por el clasificador.

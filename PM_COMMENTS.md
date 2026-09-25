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

# 11 — Auditoría del checklist (`tracker/data/faddi_checklists.js`) contra las matrices nuevas de Zelky (28-sep)

**TAREA 24 (diagnóstico) + TAREA 25 (aplicado).** TAREA 24 comparó, requisito
por requisito, lo que exigen las matrices de Zelky del 28-sep contra lo que
pedía `faddi_checklists.js` para **Síntesis Química (SQ)** y
**Biológicos/Biotecnológicos (BIO)** — **sin tocar el checklist**, para que el
PM decidiera qué aplicar. El PM revisó (PM_COMMENTS §H.9) y TAREA 25 aplicó 5
de esas decisiones al código — la columna **"Aplicado en TAREA 25"** de cada
tabla dice, fila por fila, qué se tocó y qué se dejó igual a propósito (y por
qué). Alcance sin cambios: **solo registro nuevo** — renovaciones y
modificaciones quedan fuera (§H.6).

Las descripciones de "checklist hoy para..." que siguen (`DOC_RECIBO_IEA`
como constante fija, listas separadas por subtipo, etc.) describen el estado
**previo a TAREA 25** — se dejan tal cual porque son la base de comparación
de las tablas; el estado real y actual del código está en
`tracker/data/faddi_checklists.js` (ver también la nota en la sección D).

**Fuentes:**
- SQ: `Matriz_SQ_anexo1.docx` (Google Drive, id `1ox97pJUm0nVHKKpdyG8DbX8mdNffRHLo`), leída con el conector de Drive.
- BIO: `References/matrices_zelky_2026-09-28/Matriz_BIO_anexo1.md` (ya en el repo — "Matriz unificada — PRODUCTOS BIOLÓGICOS Y BIOTECNOLÓGICOS").
- Checklist actual: `tracker/data/faddi_checklists.js` (`MED_BASE_SHARED` + `MED_VARIABLE_BY_SUBTYPE` + `MED_ABREVIADO_EXTRA`).

## Leyenda de estado

| Estado | Significa |
|---|---|
| **ESTA** | El checklist ya tiene un documento que cubre este requisito. |
| **FALTA** | El checklist no tiene nada que cubra este requisito de registro nuevo. |
| **SOBRA** | El checklist pide un documento que esta matriz NO menciona explícitamente (no se borra nada aquí — puede tener respaldo en otra fuente). |
| **DISTINTO** | Existe algo parecido, pero la vía (regular/abreviado), el required/opcional, o el contenido no coincide con lo que dice la matriz. |
| **N/A (formulario)** | El requisito describe la solicitud/formulario de FADDI en sí (paso 15 de la plataforma), no un documento que se adjunta — no le corresponde una fila del checklist. |

Los `⚠ VERIFICAR` que Zelky dejó en sus propias matrices se marcan tal cual —
no se resuelven aquí, son preguntas suyas, no mías.

---

## A. Síntesis Química (SQ)

Checklist hoy para `tipoMedicamento: ['Síntesis Química']` = `MED_BASE_SHARED`
(18 docs) + `DOC_RECIBO_IEA, DOC_MUESTRA, DOC_METODO_ANALISIS, DOC_CONTRATO_FAB`
+ (solo si `tipoRegistro==='Abreviado'`) `MED_ABREVIADO_EXTRA` + `DOC_CERT_ANALISIS`.

| N.° matriz | Requisito (resumen) | Fundamento | Vía | Estado | Nota | Aplicado en TAREA 25 |
|---|---|---|---|---|---|---|
| 01 | Comprobante de pago — tasas DNFD (servicio, categoría, MEF, etc.) | Res. 126, núm. 7.1 | Ambas | DISTINTO | El checklist tiene `tasa_servicio` (15.17, solo "tasa por servicio"). La tasa MEF y la "tasa por categoría de producto" ya no son documentos del checklist — se gestionan como **pagos por concepto** (`tasa_dnfd`/`mef`, TAREA 23), no como adjuntos a FADDI. No es un gap del checklist, es un solape con el módulo de pagos — dejar constancia para que no se pida el mismo dato dos veces. | No aplicado (ya es pago por concepto, no un documento) |
| 02 | Tabla de tasas vigentes DNFD (remite a `Tasas_DNFD_Panama.docx`) | Tasas\_DNFD\_Panama.docx | Ambas | N/A (formulario) | Es referencia de montos, no un documento a adjuntar. | No aplica |
| 03 | Solicitud firmada y sellada (info del Anexo 2) | Res. 126, núm. 7.2 y Anexo 2 | Ambas | N/A (formulario) | Es el formulario/solicitud de la plataforma FADDI (paso 15), no un adjunto del checklist. | No aplica |
| 04 | Poder que acredita representación | D.E. 27/2024 Art. 7; Res. 126 núm. 7.4 | Ambas | ESTA | `poder` (15.2). | Ya estaba (sin cambio) |
| 05-06 | Declaración jurada de protección de datos (solo si se pide protección) | Dec. 1389/2012 Art. 5 | Ambas, opcional | **FALTA** | No existe ningún doc de "protección de datos" en el checklist de SQ (ni en ningún subtipo). | **Sí** — agregado `proteccion_datos` |
| 07 | CPF/CLV vigente + Certificado de BPM | Res. 126 núm. 7.3, 7.3.1, 7.3.2 | Ambas | ESTA | `clv` (15.3) + `bpm` (15.4). | Ya estaba (sin cambio) |
| 07B | Declaración jurada — identidad de fabricación y formulación (renovación sin/con cambios; menciona también el mecanismo de Abreviado D.E. 29/2023) | Res. 126 núm. 9.1.3/9.2; D.E. 29/2023 | Renovación (título de la fila) + posible Abreviado nuevo | Fuera de alcance (renovación) / **posible FALTA (Abreviado nuevo)** | El texto es confuso: mezcla renovación con una referencia al mecanismo de declaración jurada de Abreviado. La matriz BIO (BIO-07) SÍ deja claro que Abreviado **nuevo** necesita esta declaración jurada como documento propio, distinto del expediente ARR — ver hallazgo transversal más abajo; posible gap análogo en SQ. | No aplicado (fuera de alcance / no confirmado con Zelky) |
| 08 | Muestras del producto terminado (excepción cadena de frío/biológicos no aplica a SQ) | Res. 126 núm. 7.12-7.14; D.E. 27/2024 Art. 68 | Ambas | ESTA | `muestra` (15.15). | Ya estaba (sin cambio) |
| 09 | Fórmula cuali-cuantitativa | Res. 126 núm. 7.5 | Ambas | ESTA | `formula` (15.5). | Ya estaba (sin cambio) |
| 10 | Certificado de BPM (repite el 07) | Res. 126 núm. 7.3.2 | Ambas | ESTA | Mismo doc que 07 (`bpm`) — la matriz lo repite en dos filas. | Ya estaba (sin cambio) |
| 11 | Contrato de fabricación (cuando aplica tercero) | Res. 126 núm. 7.4 | Ambas, condicional | ESTA | `contrato_fabricacion` — pero `faddiCode` sigue `PENDIENTE_VERIFICAR` (ya señalado en el propio código: choca con 15.11 de "monografía"). | No aplicado (sigue `PENDIENTE_VERIFICAR`, sin cambio — no era de las 3 colisiones de 15.14) |
| 12 | Especificaciones de **principio activo y materias primas** (no confundir con las del producto terminado) | Res. 126 núm. 7.6; D.E. 27/2024 Art. 78 | Ambas | **FALTA** | El checklist solo tiene `especificaciones` (15.8), que es del **producto terminado** (ítem 13). No hay doc separado para especificaciones del PA/excipientes. | **Sí** — agregado `especificaciones_pa` |
| 13 | Especificaciones del producto terminado (RTCA Tabla N.° 1) | Res. 126 núm. 7.6/9.2.7; RTCA 11.03.47:07 | Ambas | ESTA | `especificaciones` (15.8). | Ya estaba (sin cambio) |
| 14 | Metodología analítica y validación | Res. 126 núm. 7.7; D.E. 851/2015 | Ambas (nota: en Abreviado la matriz dice que puede bastar la metodología simplificada — "confirmar con la DNFD", sin ser un `⚠ VERIFICAR` formal) | ESTA | `metodo_analisis` (15.6). | Ya estaba (sin cambio) |
| 15 | Estudios de bioequivalencia/biodisponibilidad | D.E. 27/2024 Arts. 80-85; D.E. 95 | Ambas (según lista DNFD) | **FALTA** | No hay documento de bioequivalencia/BE en el checklist de SQ. La propia matriz trae **`⚠ VERIFICAR: Confirmar con la DNFD la lista actualizada de principios activos que requieren estudios de BE.`** — se deja igual, sin resolver. | **Sí** — agregado opcional `bioequivalencia`, nota "Farmazed confirma si aplica" |
| 16 | Etiquetado (envase primario/secundario) | D.E. 849/2015; Res. 126 núm. 7.8/9.1.5 | Ambas | ESTA | `etiquetas` — `faddiCode` `PENDIENTE_VERIFICAR` (colisión ya señalada en el código con 15.16 de "patrones"). | No aplicado (sigue `PENDIENTE_VERIFICAR`, no era de las 3 colisiones de 15.14) |
| 17 | Estudio de estabilidad | Res. 126 núm. 7.9; D.E. 850/2015 | Ambas | ESTA | `estabilidad` (15.12), `required:true` fijo — correcto para SQ (no tiene la variante condicional de Suplementos/Naturales). | Ya estaba (sin cambio) |
| 18 | Monografía **e inserto** (un solo requisito en la matriz) | Res. 126 núm. 7.8 | Ambas | DISTINTO | El checklist lo separa en DOS docs: `monografia` (15.11, siempre requerido) y `prospecto` (15.10, opcional). Puede ser intencional (el inserto es más condicional en la práctica que la monografía), pero la matriz los trata como un solo bloque — dejar constancia. | No aplicado (el PM no pidió unificar monografía+inserto) |
| 19 | Protocolo de análisis / control de calidad (certificado de análisis del lote, firmado por el responsable de CC) | Res. 126 núm. 7.11 | **Ambas — sin calificar "solo Abreviado"** | DISTINTO | El checklist solo agrega `cert_analisis` (15.7) para SQ **cuando `tipoRegistro==='Abreviado'`** (línea 281 de `faddi_checklists.js`, decisión de la auditoría 2026-08-26). La matriz numera este requisito junto con los demás de la lista general (01-21), sin la calificación "solo abreviado" que sí usa explícitamente en otros ítems (ver 07B, 15). Posible que Regular también necesite este documento — **verificar con Zelky antes de tocar el código.** | No aplicado (el PM no pidió tocar el gate de `cert_analisis`/Abreviado) |
| 20 | Ficha de seguridad (MSDS) del PA/producto + manejo de desechos | D.E. 249/2008 Art. 9 | Ambas (renovación sin cambios: solo si no consta ya) | DISTINTO | El checklist tiene `disposicion` (15.13, "Información sobre manejo y disposición de residuos/muestras") — no menciona explícitamente una ficha de seguridad/MSDS del principio activo. Puede ser el mismo documento con otro nombre, o dos documentos distintos — verificar. | No aplicado (no confirmado si `disposicion` es el mismo documento) |
| 21 | Documentación técnica para modificaciones post-registro | Res. 126 Anexo 1 | Modificación | Fuera de alcance (§H.6) | — | Fuera de alcance (modificación) |
| 33 | Estudios clínicos / referencias bibliográficas (innovadores: clínicos; abreviado/genéricos: BE o publicaciones) | D.E. 27/2024 Arts. 80-85 | Condicional ("innovador" o "abreviado") | **FALTA** | El checklist no tiene ningún doc de "estudios clínicos" para el subtipo `Síntesis Química` (sí existe para Biológicos/Biotecnológicos/Vacuna/Huérfanos). El modelo de caso tampoco tiene un campo "es innovador" que dispare esta condición — ni el requisito ni el campo existen hoy. | **Sí (TAREA 26)** — se agregó el campo `esInnovador` (lo confirma el staff en fase_03, junto con vía y categoría) y el doc `estudios_clinicos_sq`, gateado igual que `recibo_iea` (obligatorio/no aplica/por confirmar). |
| 34 | Resumen de información de seguridad (farmacovigilancia) + Plan de Gestión de Riesgo si aplica | D.E. 27/2024 Arts. 86-88 | Ambas (Plan de Gestión de Riesgo: si lo exige la DNFD) | **FALTA** | Mismo caso que el 33 — no existe para `Síntesis Química` en el checklist. | **Sí (TAREA 26)** — se agregó `resumen_seguridad_sq`, mismo campo `esInnovador` del ítem 33. |

### Hallazgos de SQ (resumen)

- **3 FALTA claros**: protección de datos (05-06, opcional), especificaciones de principio activo/materias primas (12), bioequivalencia (15, con `⚠ VERIFICAR` propio de Zelky).
- **2 FALTA condicionales**: estudios clínicos (33) y resumen de seguridad/farmacovigilancia (34) — ambos dependen de si el producto es "innovador". *Resuelto en TAREA 26*: se agregó `esInnovador` al caso (lo confirma el staff en fase_03) y los 2 documentos correspondientes.
- **1 posible bug de vía**: `cert_analisis` limitado a Abreviado en el código (ítem 19), pero la matriz no lo restringe a esa vía — candidato a revisar con Zelky antes de cambiar nada.
- El resto de los 18 documentos de `MED_BASE_SHARED` que aplican a SQ tienen respaldo directo en la matriz (ESTA).

---

## B. Biológicos y Biotecnológicos (BIO)

**Nota estructural importante:** la matriz de Zelky es **una sola**, unificada
para "Biológicos y Biotecnológicos" — no los distingue. El checklist, en
cambio, los trata como **dos `tipoMedicamento` separados** (`'Biológicos'` y
`'Biotecnológicos'`) con listas de documentos extra ligeramente distintas
entre sí. Esto genera asimetrías que se señalan abajo — no está claro que
Zelky quiera esa distinción.

Checklist hoy para ambos subtipos = `MED_BASE_SHARED` (18 docs, comunes) +:
- `'Biológicos'`: `DOC_RECIBO_IEA, DOC_CERT_ANALISIS, DOC_MUESTRA, DOC_METODO_ANALISIS, DOC_CONTRATO_FAB, estudios_clinicos_bio (15.22), estudios_noclinicos_bio (15.23)`
- `'Biotecnológicos'`: lo mismo, **más** `farmacovigilancia_bio (15.20)`.

| N.° matriz | Requisito (resumen) | Fundamento | Vía | Estado | Nota | Aplicado en TAREA 25 |
|---|---|---|---|---|---|---|
| BIO-01 | Formulario oficial de solicitud (firmado por farmacéutico + abogado, refrendo CNF) | Res. 126 núm. 7.1; D.E. 27/2024 Arts. 19, 42, 43 | Todos | N/A (formulario) | Es el formulario de la plataforma FADDI, no un adjunto — pero SÍ menciona explícitamente el "refrendo del Colegio Nacional de Farmacéuticos" para **todos los trámites**, lo que respalda `recibo_cnf` (16.1.1, ver más abajo). | No aplica |
| BIO-02 | Recibo de tasa de servicio + tasa de registro (+ recibo MEF antes del certificado) | D.E. 27/2024 Art. 15, 44 | Todos | ESTA (parcial) | `tasa_servicio` (15.17) cubre la tasa de servicio. La tasa MEF ya no es un documento del checklist — se gestiona como pago por concepto (`mef`, TAREA 23), igual que en SQ-01. | No aplicado (tasa MEF ya es pago por concepto, no doc) |
| BIO-03 | Recibo de pago IEA / cotización externa | D.E. 27/2024 Arts. 21, 26, 38; D.E. 29/2023 Art. 6 | **Solo REGULAR — "en procedimiento ABREVIADO: no aplica"** | **DISTINTO (bug de vía)** | `recibo_iea` (`DOC_RECIBO_IEA`, `required:true` fijo) se exige para BIO **sin condicionar a `tipoRegistro`** — el código no tiene ninguna lógica de "solo si Regular" para IEA en NINGÚN subtipo (a diferencia de `cert_analisis` en SQ, que sí está condicionado a Abreviado). Este es el hallazgo más concreto y accionable de toda la auditoría: la matriz dice explícitamente que Abreviado NO debe pedir este recibo, y hoy el checklist lo pide siempre. | **Sí** — `recibo_iea` ahora depende de `aplicaIEA` de la cotización, no del subtipo (decisión 1) |
| BIO-04 | Poderes legales — **dos** poderes distintos (abogado + farmacéutico responsable) | Res. 126 núm. 4.37/4.39; D.E. 27/2024 Art. 19 | Todos | DISTINTO | El checklist tiene un solo `poder` (15.2, "Poder Original"). La matriz describe dos documentos con requisitos de forma distintos (poder al abogado notariado; autorización al farmacéutico responsable, original o copia autenticada) — verificar si conviene separarlos. | No aplicado (el PM no pidió separar el poder en dos documentos) |
| BIO-05-06 | Declaración jurada de protección de datos (opcional) | Dec. 1389/2012 Art. 5 | Todos, opcional | **FALTA** | Igual que SQ 05-06 — no existe en el checklist. | **Sí** — agregado `proteccion_datos` (compartido con SQ) |
| BIO-07 (abreviado) | Declaración jurada de **identidad de fabricación y formulación** | D.E. 27/2024 Art. 24 núm. 2; D.E. 29/2023 | **Solo ABREVIADO** | **FALTA** | El checklist solo tiene `aprobacion_arr` (15.14, "Expediente aprobado por ARR") para Abreviado — que es un documento DISTINTO (el expediente completo aprobado, no la declaración jurada de identidad). Esta declaración jurada específica no está en el checklist para ningún subtipo. | **Sí** — agregado `declaracion_identidad_abreviado` (solo Abreviado) |
| BIO-07 (renovación sin cambios) | Declaración jurada de renovación sin cambios | Res. 126 núm. 9.1.3 | Renovación | Fuera de alcance (§H.6) | — | Fuera de alcance (renovación) |
| BIO-09 | CPP/CLV vigente (nuevo y abreviado, con matiz de autoridad de alto estándar en abreviado) | Res. 126 núm. 7.3.1/9.1.4; D.E. 27/2024 Art. 28; D.E. 29/2023 Art. 2 | Ambas | ESTA | `clv` (15.3) — el matiz de "debe venir de una autoridad de alto estándar listada" en Abreviado es una condición de CONTENIDO del mismo documento, no un doc distinto. | Ya estaba (sin cambio) |
| BIO-10 | Certificado de BPM (por cada establecimiento fabricante) | Res. 126 núm. 7.3.2; D.E. 27/2024 Art. 29 | Ambas | ESTA | `bpm` (15.4). | Ya estaba (sin cambio) |
| BIO-11 | Contrato de fabricación (fabricación por terceros) | Res. 126 núm. 7.4 | Condicional | ESTA | `contrato_fabricacion` (mismo `faddiCode PENDIENTE_VERIFICAR` que en SQ). | Ya estaba (sin cambio) |
| BIO-12 | Fórmula cuali-cuantitativa (con contenido específico de biológicos: unidades protectoras, estado biológico del microorganismo, ADN/ARN recombinante, etc.) | Res. 126 núm. 7.5; D.E. 27/2024 Art. 35 núm. 8, Art. 102 núm. 12 | Ambas | ESTA (contenido genérico) | `formula` (15.5) existe, pero su `description` no menciona el contenido específico de biológicos que exige la matriz — no es un gap estructural, pero el texto que ve el cliente podría quedarse corto. | No aplicado (ajuste de texto no pedido) |
| BIO-13 | Especificaciones del producto terminado (para biológicos, ICH Q6B) | Res. 126 núm. 7.8; D.E. 27/2024 Art. 36 | Ambas | ESTA (contenido genérico) | `especificaciones` (15.8) — mismo comentario que BIO-12: el `description` no menciona ICH Q6B. | No aplicado (ajuste de texto no pedido) |
| BIO-14 | Certificado de análisis | D.E. 27/2024 Art. 27 | Ambas (regular y abreviado) | ESTA | `cert_analisis` (15.7) — a diferencia de SQ, en BIO este documento **sí** está `required:true` sin condicionar a la vía, lo cual **coincide** con lo que pide esta matriz (aquí no hay calificación "solo abreviado"). | Ya estaba (sin cambio) |
| BIO-15 | Método de análisis validado | Ley 419/2024 Art. 29; D.E. 851/2015 | Ambas (regular y abreviado) | ESTA | `metodo_analisis` (15.6). | Ya estaba (sin cambio) |
| BIO-16 | Clave del lote | D.E. 27/2024 Art. 37 | Nuevos | ESTA | `clave_lote` (15.9) — confirma que este doc de `MED_BASE_SHARED` tiene respaldo explícito, al menos para BIO (ver hallazgo transversal sobre SQ). | Ya estaba (sin cambio) |
| BIO-17 | Etiquetas (envase primario/secundario) | Res. 126 núm. 7.9; D.E. 849/2015 | Nuevos, renovaciones | ESTA | `etiquetas` (mismo `faddiCode PENDIENTE_VERIFICAR`). | Ya estaba (sin cambio) |
| BIO-18 | Inserto/prospecto ("para venta libre: opcional") | D.E. 849/2015; D.E. 27/2024 Art. 102 núms. 21-22 | Nuevos y renovaciones | DISTINTO | El checklist marca `prospecto` (15.10) como opcional siempre ("cuando el producto incluye inserto/prospecto"). La matriz da a entender que solo es opcional **para venta libre** — para productos de venta bajo receta (la mayoría de biológicos) podría ser obligatorio. Verificar. | No aplicado (el PM no pidió cambiar el required de `prospecto`) |
| BIO-19 | Monografía del producto terminado | Res. 126 núm. 7.6; D.E. 27/2024 Art. 33 | Nuevos y renovaciones | ESTA | `monografia` (15.11). | Ya estaba (sin cambio) |
| BIO-20 | Ficha técnica de disposición/destrucción (riesgo biológico, inactivación) | D.E. 249/2008 | Según hoja de chequeo | ESTA (contenido genérico) | `disposicion` (15.13) — mismo comentario de contenido que BIO-12/13: la descripción no menciona el riesgo biológico específico. | No aplicado (ajuste de texto no pedido) |
| BIO-21 | Estudios de estabilidad | D.E. 27/2024 Art. 58; Res. 126 núm. 7.10 | Nuevos (renovación: solo si no se presentó antes) | ESTA | `estabilidad` (15.12), `required:true` fijo — correcto (BIO no tiene variante condicional). | Ya estaba (sin cambio) |
| BIO-22 | Estudios clínicos de seguridad y eficacia | D.E. 27/2024 Art. 30, Art. 102 núms. 4-5, 20 | Innovadores, biosimilares, procedimiento regular y abreviado | ESTA | `estudios_clinicos_bio`/`estudios_clinicos` (15.22) — presente en ambos subtipos. | Ya estaba — unificado entre Biológicos/Biotecnológicos (decisión 3) |
| BIO-25 | Especificaciones de fuentes/técnicas de obtención del principio activo (+ banco de células maestro/trabajo, solo biotecnológicos) | D.E. 27/2024 Art. 102 núm. 1 | Todos (banco de células: solo biotecnológicos) | **FALTA** | No existe ningún documento para esto en ninguno de los dos subtipos. | **Sí** — agregado `especificaciones_fuentes_pa` |
| BIO-S/N-1 | Especificación de calidad y pureza del principio activo | D.E. 27/2024 Art. 102 núm. 16 | Todos | **FALTA** — **`⚠ VERIFICAR`** (de Zelky, sin resolver: *"Requisito tomado de la Matriz Legal; no está en la hoja de chequeo de la Guía. Confirmar si va."*) | Se deja igual — es la única `⚠ VERIFICAR` que la propia matriz dice que sigue pendiente. | **Sí** — agregado opcional `especificacion_calidad_pureza_pa`, nota "Farmazed confirma si aplica" |
| BIO-26 | Método de fabricación / controles en proceso / validaciones | D.E. 27/2024 Art. 102 núm. 17 | Nuevos (regular y abreviado) | ESTA | `proceso_fab` (15.18) + `controles` (15.19) — de `MED_BASE_SHARED`, así que también se piden hoy en SQ aunque la matriz SQ no los liste como ítem propio (ver hallazgo transversal). | Ya estaba (sin cambio) |
| BIO-S/N-2 | Especificación de calidad/pureza y métodos de control de los **excipientes** | D.E. 27/2024 Art. 102 núm. 14 | Nuevos (regular y abreviado) | **FALTA** | Distinto de `formula` (que es la fórmula cuali-cuantitativa, no las especificaciones de calidad de cada excipiente). | **Sí** — agregado `especificaciones_excipientes` |
| BIO-27 | Procedimientos para comprobar ausencia de agentes patógenos (agentes adventicios) | D.E. 27/2024 Art. 102 núm. 3 | Nuevos (regular y abreviado) | **FALTA** | — | **Sí** — agregado `ausencia_agentes_patogenos` |
| BIO-28 | Acreditación de ausencia de materias primas de especies afectadas por EET | D.E. 27/2024 Art. 102 núm. 15 | Productos con materias primas de origen animal | **FALTA** | Condicional — no hay campo en el modelo de caso que indique "origen animal" tampoco. | **Sí** — agregado `ausencia_materias_primas_eet` |
| BIO-29 | Plan de farmacovigilancia | D.E. 27/2024 Art. 102 núm. 6 | Nuevos (regular y abreviado) — **la matriz NO distingue biológicos de biotecnológicos** | **DISTINTO (asimetría)** | El checklist solo tiene `farmacovigilancia_bio` (15.20) para `'Biotecnológicos'` — el subtipo `'Biológicos'` **no lo tiene**, pese a que esta matriz unificada lo exige para ambos por igual. | **Sí** — `farmacovigilancia_bio` ahora aplica también a Biológicos (decisión 3) |
| BIO-30 | Programa de gestión de riesgo | D.E. 27/2024 Art. 102 núm. 7 | Nuevos (regular y abreviado) | **FALTA (ambos subtipos)** | No hay un documento propio para esto en ninguno de los dos — `farmacovigilancia_bio` lo menciona solo dentro de su `description` ("Plan de gestión de riesgos **y** farmacovigilancia"), no como dos entregables distintos, y solo existe para Biotecnológicos. | **Sí** — agregado `programa_gestion_riesgo` |
| BIO-31 | Condiciones de almacenamiento, distribución y transporte del PT | D.E. 27/2024 Art. 102 núm. 8 | Nuevos (regular y abreviado) — **sin excepción de renovación mencionada, a diferencia de otros ítems** | DISTINTO | El checklist tiene `almacenamiento` (15.21) como **opcional** ("cuando aplica cadena de frío"). La matriz lo lista sin calificarlo de condicional para BIO — posible que para biológicos deba ser `required:true`. | No aplicado (el PM no pidió cambiar el required de `almacenamiento`) |
| BIO-32 | Estudios no clínicos | D.E. 27/2024 Art. 102 núms. 4, 20 | Innovadores y biosimilares | ESTA | `estudios_noclinicos_bio`/`estudios_noclinicos` (15.23) — presente en ambos subtipos. | Ya estaba — unificado entre Biológicos/Biotecnológicos (decisión 3) |
| BIO-54 | Muestra del producto terminado | Ley 419/2024 Art. 29; D.E. 27/2024 Art. 34 | Nuevos (regular y abreviado) | ESTA | `muestra` (15.15). | Ya estaba (sin cambio) |
| BIO-55 | Patrones analíticos (cuando el laboratorio de referencia los requiera) | D.E. 27/2024 Art. 41; Res. 126 núm. 7.12 | Condicional | DISTINTO | `patrones` (15.16) está `required:true` fijo en `MED_BASE_SHARED` — la matriz lo condiciona a "cuando el laboratorio de referencia (IEA) lo requiera". | No aplicado (el PM no pidió cambiar el required de `patrones`) |
| BIO-53 | Renovación con cambios | Res. 126 Anexo 1 / núm. 9.2.3 | Renovación | Fuera de alcance (§H.6) | — | Fuera de alcance (renovación) |

### Hallazgos de BIO (resumen)

- **El más accionable: BIO-03 (recibo IEA) no debería pedirse en Abreviado**, y hoy el checklist lo exige siempre para Biológicos/Biotecnológicos (y también para Síntesis Química — ver SQ). Es un bug de vía concreto, no una ambigüedad de interpretación.
- **Asimetría Biológicos vs. Biotecnológicos**: la matriz de Zelky es una sola; el checklist las separa y les da documentos extra distintos (`farmacovigilancia_bio` solo en Biotecnológicos). Antes de "arreglar" esto habría que decidir si de verdad deben ser dos `tipoMedicamento` distintos o si deberían compartir exactamente la misma lista de documentos.
- **7 FALTA claros**: protección de datos (05-06), declaración jurada de identidad para Abreviado (BIO-07), especificaciones de fuentes del PA/banco de células (25), especificaciones de excipientes (S/N-2), ausencia de agentes patógenos (27), ausencia de materias primas EET (28), programa de gestión de riesgo (30).
- **1 `⚠ VERIFICAR` de Zelky sin resolver**: BIO-S/N-1.
- **2 documentos que hoy son `required:true` fijos pero la matriz los describe como condicionales**: `patrones` (BIO-55) y posiblemente `almacenamiento` (BIO-31, al revés — debería ser más obligatorio de lo que es hoy, no menos).

---

## C. Hallazgos transversales (aplican a las dos matrices o al checklist en general)

1. **Colisión de `faddiCode` 15.14 — tres documentos distintos, sin flag en el código.** `otros_docs` (base, opcional, cualquier trámite), `declaracion_paises` (solo Huérfanos) y `aprobacion_arr` (solo Abreviado) usan el mismo código `15.14`. Un caso de Síntesis Química o Biológicos en trámite Abreviado dispara `otros_docs` **y** `aprobacion_arr` a la vez — dos documentos distintos con el mismo `faddiCode`. Las otras dos colisiones conocidas (`etiquetas`/`patrones` en 15.16, `contrato_fabricacion`/`monografia` en 15.11) ya estaban señaladas como `PENDIENTE_VERIFICAR` en el propio código; esta de 15.14 no lo estaba.
2. **`recibo_iea` no distingue Regular de Abreviado en NINGÚN subtipo.** BIO-03 lo deja explícito ("en procedimiento ABREVIADO: no aplica"); la matriz SQ no es tan explícita para IEA en sí, pero el mismo principio (D.E. 29/2023 Art. 6 — en abreviado no se requieren ensayos analíticos previos) aplicaría igual. Hoy `DOC_RECIBO_IEA` es `required:true` fijo, sin mirar `tipoRegistro`, para Síntesis Química, Biológicos, Biotecnológicos, Homeopático, Medio de Contraste y Gas Medicinal.
3. **Solape entre "documento del checklist" y "pago por concepto" (TAREA 23).** Varios ítems de las matrices (tasa MEF, tasa por categoría) ya no corresponden a un documento que se sube a FADDI, sino a un registro de pago (`concepto: 'mef'`, etc.) — el checklist y el módulo de pagos hoy no se referencian entre sí; no es un bug, pero conviene que quede escrito para no duplicar el mismo requisito en dos sistemas.
4. **"Solicitud/formulario" (SQ-03, BIO-01) no son documentos del checklist** — son el formulario de la plataforma FADDI en sí. Se marcan N/A a propósito, no como gap.
5. **Estudios clínicos/no clínicos condicionados a "innovador"** (SQ-33/34) — *resuelto en TAREA 26*: el caso ahora tiene `esInnovador` (lo confirma el staff en fase_03, `cases.edit_via_categoria`), y Zelky también lo usa en precios ("Prioridad ... innovadores", ver `organizacion/10_DIFF_PRECIOS_24SEP.md`) — aunque esa parte de precios quedó sin mapear automáticamente (ver TAREA 26 en `handover.md`, la regla no es obvia).

---

## D. TAREA 24 vs. TAREA 25 vs. TAREA 26 — qué se hizo y cuándo

**TAREA 24 (diagnóstico, este documento cuando se entregó):**
- No se modificó `tracker/data/faddi_checklists.js` — instrucción explícita del PM: "NO cambies el checklist todavía; primero reviso la auditoría."

**TAREA 25 (aplicado, PM_COMMENTS §H.9):** sí se modificó
`tracker/data/faddi_checklists.js` — ver la columna "Aplicado en TAREA 25" de
cada tabla arriba para el detalle fila por fila. Resumen de las 5 decisiones
aplicadas:
1. `recibo_iea` depende de `aplicaIEA` de la cotización ACEPTADA del caso
   (`docReciboIea()`), no del subtipo — antes se excluía por subtipo
   (Suplementos/Naturales/Huérfanos/Vacuna/Radiofármaco no lo tenían; el
   resto lo tenía fijo `required:true`, incluso en Abreviado, que era el bug
   más concreto de la auditoría, BIO-03).
2. `otros_docs`, `declaracion_paises` y `aprobacion_arr` (los 3 con
   `faddiCode: '15.14'`) quedaron `PENDIENTE_VERIFICAR`.
3. `'Biológicos'` y `'Biotecnológicos'` comparten ahora exactamente los
   mismos documentos (`MED_BIO_DOCS`) — `farmacovigilancia_bio` aplica a
   ambos.
4. Se agregaron los FALTA de la auditoría: 2 en SQ (`proteccion_datos`,
   `especificaciones_pa`) + 7 en BIO (`proteccion_datos` — compartido con
   SQ —, `declaracion_identidad_abreviado`, `especificaciones_fuentes_pa`,
   `especificaciones_excipientes`, `ausencia_agentes_patogenos`,
   `ausencia_materias_primas_eet`, `programa_gestion_riesgo`), cada uno con
   `responsable:'cliente'` (por default, no está en `FARMAZED_DOC_IDS`),
   `faddiCode: 'PENDIENTE_VERIFICAR'` y el fundamento normativo (N.° + norma)
   de la matriz en su `description`.
5. Los `⚠ VERIFICAR` de Zelky (bioequivalencia SQ-15, BIO-S/N-1) entraron
   como opcionales (`bioequivalencia`, `especificacion_calidad_pureza_pa`)
   con `condition: 'Farmazed confirma si aplica'`.

**TAREA 26 (§H.9-2, cierre de esta ronda):** se agregó `esInnovador` al caso
— lo confirma el staff en fase_03, junto con `tipoRegistro`/`tipoMedicamento`
(`cases.edit_via_categoria`, nueva UI en `admin/expediente.html`). Con eso se
resolvieron los últimos 2 FALTA que quedaban pendientes (SQ-33/34):
`estudios_clinicos_sq` y `resumen_seguridad_sq`, con el mismo patrón
tri-estado que `recibo_iea` (obligatorio si `esInnovador===true`, no aplica
si `===false`, "por confirmar" si todavía no se definió). También se evaluó
si `resolverCategoriaPrecio()` (tracker/routes/quotes.js) debía usar
`esInnovador` para la categoría "Prioridad ... innovadores" del tarifario
24-sep — **se dejó sin mapear**: no es obvio si esa categoría debe
reemplazar la fila del subtipo (Biológicos/Huérfanos ya tienen su propia
fila obligatoria) o solo aplicar cuando no hay una más específica, y el
xlsx no aclara si es excluyente o un cargo adicional. Ver el comentario en
el propio código y `handover.md` para el detalle.

**Lo que NO se tocó, en ninguna de las tres tareas** (marcado "No aplicado"
en la columna de arriba, con su motivo puntual): los ítems donde el checklist
ya coincidía con la matriz (ESTA sin nota), las 3 diferencias de
"contenido/redacción" (BIO-12/13/20), la separación monografía/inserto
(SQ-18), el gate de `cert_analisis` solo-Abreviado en SQ (SQ-19, "verificar
con Zelky antes de tocar el código" — no se tocó), el `required` fijo de
`patrones`/`almacenamiento` (BIO-55/31), la separación del poder en dos
documentos (BIO-04), y el mapeo de "Prioridad innovadores" en
`resolverCategoriaPrecio()` (regla no obvia, ver arriba).

- No se auditó `Vacuna` (fuera del alcance — el PM pidió solo SQ y BIO). El código ya trae su propia advertencia (`⚠ Pendiente de verificar con el PM`) para ese subtipo.
- No se tocaron Renovaciones ni Modificaciones (§H.6, fuera de alcance por instrucción explícita).
- Sin commit, sin deploy (las tres tareas).

# 02 — MAPA DE LA DATA: QUE ES CANONICO Y QUE ES RUIDO (Fase 2 de 4)

- **Fecha de la corrida:** 2026-09-20, ~05:00–05:20 UTC
- **Cuenta lectora:** `pimentelmarinricardo@gmail.com` (MCP Google Drive, **solo lectura**)
- **Raiz:** "Farmazed Reference documents" — id `14wa5CoMFztQlrfB8_yeKNtlxZfe9Namv` (propiedad de Zelky)
- **Insumos:** `organizacion/01_INVENTARIO_DRIVE.md` (Fase 1), `PM_COMMENTS.md` Parte B y B.6, `handover.md`.
- **Credenciales:** `FADDI CREDENTIALS.txt` y el Doc `Contrasenas` existen en la raiz. **No fueron abiertos ni citados.**

## Estado del insumo de Fase 1

`01_INVENTARIO_DRIVE.md` **existe y es utilizable** (46 KB, 185 archivos, 61 carpetas). No quedo corto.
Su limitacion declarada: **no recorrio** (a) el contenido de las 13 carpetas `Fase N`, (b) las 7 subcarpetas de `Legal/`,
(c) las 2 subcarpetas de `Presentaciones`. Esta Fase 2 **cerro los huecos (a) y (b) parcialmente** con consultas
directas al Drive, porque ahi vivian justamente las respuestas a Z15, Z16 y Z22. El hueco (c) sigue abierto.

> Convencion: `/` = raiz. La subcarpeta principal es `Farmazed ` **con espacio final**.
> `handover.md` la llama "Regulatorios" y "Farmazed 2/": **ambos nombres estan mal** y hay que corregirlos en ese doc.

### Hallazgo estructural nuevo de esta fase

Las carpetas `Fase N` **no son carpetas de proceso vacias: son una copia paralela completa del arbol de Operaciones**.
La Fase 10 contiene su propia `Matrices Definitivas para cliente` (id `1y5-aPYLe2RZJBDaist_njX_bWGTjl1ge`) con **las 10
categorias llenas**, mientras que la copia de nivel superior en `Operaciones/` (id `1RankC8PmpVhzrg0XnuPgYVY0XbFaSmNQ`)
tiene **6 de 10 vacias**. Esto invierte la intuicion: **lo canonico esta enterrado y lo incompleto esta arriba.**

---

## Leyenda de estado

| estado | significado |
|---|---|
| **CANONICO** | fuente unica de verdad para ese dominio; el portal se construye desde aqui |
| **DUPLICADO** | copia byte-identica o casi de un CANONICO; se archiva, no se borra sin aprobacion |
| **OBSOLETO** | cita normativa derogada, o version superada por otra mas nueva |
| **DUDOSO** | no se puede decidir sin abrir el contenido o sin que Zelky confirme |
| **FALTA** | el portal lo necesita y **en el Drive no existe** |

---

# A. Vias / tipos de registro

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| `Mapa_Vias_Registro_Sanitario_DNFD_Farmazed_Definitivo Corregido.docx` | `1BLWa9HqCN4mttN8ozBjcrpWvV-IvlERT` | **CANONICO** | 343 KB, "Definitivo Corregido", 12 sept — el mas nuevo y el unico que mapea todas las vias | Fase 3 del wizard: diagnostico de via |
| `Registro Regular.docx` | `1yVWUcXgocnajKGtx4Si-qHkRgb3JUQDY` | CANONICO | unica fuente descriptiva de la via regular | texto explicativo via Regular |
| `Flujo de la documentación Registro x via Regular.xlsx` | `1kZWRT6ns-2lPLPSBk2WOFjtAU2uLS9uC` | CANONICO | unico xlsx de flujo documental por via | secuencia de carga de documentos |
| `Procedimiento abreviado y renovación decreto 29 de 2023.docx` | `1pDhD8Ip7LCcBD1--ali_ockyRglPFyml` | CANONICO | sustento de la via Abreviada | via Abreviado |
| `Matriz_Reconocimiento_Mutuo_Farmazed.docx` | `1yHeNFvgFMHS-9V--7LWvCT63uZ2XY6Jv` | **CANONICO** | 7 jun, version base de Reconocimiento Mutuo | checklist Reconocimiento Mutuo |
| `Matriz_Reconocimiento_Mutuo_Farmazed sin Equivalencia.docx` | `1sk2D8sHlD_P_Tm7_KBB6HlOjr2NoUSsb` | **DUDOSO** | 8 jun, un dia mas nueva. "sin Equivalencia" puede ser variante valida o descarte. **Zelky decide** | posible segunda rama del mismo tramite |
| `RECONOCIMIENTO MUTUO Res126-2021_Anexo_II_.docx` | `1y2IUOnnfZYRDZQV7mfiAgelTxEqEHiSU` | CANONICO | sustento normativo del Rec. Mutuo | fundamento mostrado al cliente |
| `Matriz_Reconocimiento_WLA_Farmazed verificar.docx` | `1M1WHckyY-c_VpilotTVPyj1EZ2JsVkjS` | **DUDOSO** | **la palabra "verificar" esta en el nombre del archivo.** Ver Z11 abajo | via WLA — bloqueada |
| idem, copia en carpeta de Fase | `1N0QsOoNHKFdePA_e07KSXhgnsOvBbqJe` | DUPLICADO | mismo tamano (18 523 B) y misma fecha (8 jun) que el anterior | — |
| `REGISTRO POR WLA DE_2_2025_WLA_Transcripcion_Farmazed.docx` | `1rU0S0QOsBSHuFpN5bbYUt2uNZYhmjL_o` | CANONICO | transcripcion del D.E. 2/2025, el instrumento que rige WLA (confirmado en Z14) | fundamento normativo WLA |
| `WLA OMS.docx` | `1NMLH-62EbRGMXakejIhHJxuk70jAdIMV` | CANONICO | contexto OMS de la lista WLA | material de apoyo |
| **Matriz de la via WHO-PQP** | — | **FALTA** | **no existe ningun archivo de WHO-PQP en todo el Drive.** Busqueda por titulo y por texto completo: cero resultados | quinta via del wizard — **no construible** |
| `Matriz_Equivalencia_Procedimiento_Regular.docx` | `1LiXtvzR9S7T7B6xGHRNxxKZBEBNJLyr-` | **OBSOLETO** | cita Res. 385/386 (ver Z22) | intercambiabilidad via regular |
| `Matriz_Equivalencia_Procedimiento_Abreviado.docx` | `1vMcJvJ3oCe1TW4VYCa08RBWdeBmSDtPv` | **OBSOLETO** | idem. Ojo: existe otra copia (`1XyvhKyrRGZbCOgdPcbfDwYCkQzn1VcJu`) de **13.4 KB vs 19.2 KB** — no son la misma version | intercambiabilidad via abreviada |
| `Matriz_Renovacion_Intercambiabilidad.docx` | `1YXGfw5wkPTTOtWoSimX-9w0k8v3PiU9v` | DUDOSO | unico doc de renovacion de intercambiabilidad; sin confirmar si refleja Res. 985 | renovacion de intercambiabilidad |
| `Intercambiabilidad Medicamento de Referencia.docx` | `1ic6jEhQl0la3PJWy3X0m4wFAsfoGaoa8` | DUDOSO | uno de los tres docs de Z20; no esta definido cual es el principal | tramite Intercambiabilidad |
| `Intercambiabilidad medicamento Procedimiento Regular.docx` | `1UmUT4IZs1IEK5c3jk-rJpC0BxpABWhgA` | DUDOSO | idem Z20 | idem |
| `Intercambiabilidad de medicamento proecdimiento abreviado.docx` *(sic)* | `1eEfnUz_FGjeX7IZA8onq9imdcHGUQaDl` | DUDOSO | idem Z20 + error de tipeo en el nombre | idem |
| `Requisitos para la renovación de la intercambiabilidad de medicamentos.docx` | `1ggXmjjbkOwHQYG7OqG3rE55SNmJQjvoJ` | DUDOSO | idem Z20 | idem |
| `Sobre Intercambiabilidad.docx` | `1PgMDjFWwb9_AihfXNZDBttICwnGTX6I9` | CANONICO | material docente de respaldo | texto explicativo |
| idem, copia en carpeta de Fase | `1l1uz_jj0_BGsbh_4NWX4jGyao59LAfKT` | DUPLICADO | 33 675 B, misma fecha exacta | — |
| **Matriz consolidada de RENOVACIONES** (transversal) | — | **FALTA** | Z18: las 10 matrices mencionan renovacion dentro de cada requisito, pero no hay lista consolidada | tramite Renovacion del MVP |
| **Matriz consolidada de MODIFICACIONES** | — | **FALTA** | Z18: idem, y la lista de precios ya distingue tipos de modificacion | tramite Modificacion del MVP |

---

# B. Matrices por categoria de producto

**Ubicacion canonica: la copia bajo `Fase 10` — id `1y5-aPYLe2RZJBDaist_njX_bWGTjl1ge`.** Las 10 categorias tienen archivo.
Cada categoria tiene un par **guia + LEGAL** (ver la regla real en Z16). Ids listados: guia primero, LEGAL despues.

| categoria (carpeta) | guia — id | LEGAL — id | estado | que alimenta en el portal |
|---|---|---|---|---|
| **SINTESIS QUIMICA** `1Le3oaFzhTWlJ81PcUAaZYh8aebQS5ldo` | **FALTA** | `MATRIZ LEGAL SINTESIS QUIMICA LEGAL PARA CORREO REGISTRO SANITARIO COPIA.docx` — `1S8TOLvlexpkdAf4KfFiEPlVNaF59CA_5` | **FALTA (guia)** / CANONICO (legal) | **la via mas comun del portal no tiene matriz operativa.** Maxima prioridad |
| **BIOLOGICOS / BIOTECNOLOGICOS** `12xo1gkSr3gv4JH2kmDW_KeTp1_xGLeSi` | `Biologicos con checklist para guia.docx` — `1eE02sdPA3Nixk9bKCcbGh2dWN-n8PG2x` (66.9 KB, 21 jul) | `Matriz_Correo_Biologicos LEGAL.docx` — `1ZK4kTtmvE3xyxmzg3m2Z1PXM2ku3H1t2` | **OBSOLETO (guia)** | superada por la de 18 sept — ver fila siguiente |
| ↳ **guia vigente de Biologicos** (vive **solo** en la copia de `Operaciones/`) | `Matriz_Guia_Biologicos_Biotecnologicos_1.docx` — `1HVRKK43iq2XWWRgdKORlJRxo7gaFZJC4` (56.6 KB, **18 sept 2026**) | — | **CANONICO** | **es el archivo mas nuevo de todo el Drive.** No esta en la copia de Fase 10 |
| **PRODUCTOS NATURALES / FITOFARMACOS** `1JCrotk8JDoTnbzunt1nVpxGZbq3jZjQn` | `Matriz Guia Productos Naturales.docx` — `1XgsZV9JhhEhteabH3qXstRurxltNWr1c` (54.9 KB) | `Matriz_Correo_Naturales_Fitofarmacos LEGAL.docx` — `11Nz2z9gEgTidQIA5a-9Kbm-DwHG6rmrR` | CANONICO | checklist naturales |
| **SUPLEMENTOS** `1nUkh5BstdEHu1APr5sVCE71U50BwPnjM` | `matriz  guia Suplementos 22-7-2026.docx` — `1EcQHZgMgUCf_zLpbIjAMr9gRVnnX6Zr_` (45.1 KB) | `Matriz_Correo_Suplementos Legal.docx` — `1lwAWP-LiYVCF3ntAb8UfsSAft_MuiL_P` | CANONICO | checklist suplementos |
| **HOMEOPATICOS** `1eT3Q-krzJAscPbBTiJi5E5NO4duY4wT2` | `Matriz  Guia homeopatico para corregir 10 julio 26 corregido.docx` — `16W1dDeOqCp-0HQUTdeaFJXvan3SZZtQQ` (72.5 KB) | `Matriz_Correo_Homeopatico legal.docx` — `1VCmObUHxGkf5w5xscgEU_IycQ3zI5aMC` | **DUDOSO (guia)** | el nombre dice "para corregir" **y** "corregido". Zelky debe confirmar si quedo cerrada |
| **HUERFANOS** `1Rl5iszsBHxENZtJYHPntNHJWh9YhblcT` | `Matriz_Huerfano 30-4-26.docx` — `1fyxIbwXIR8bybvI2LpvioMLWLIFN8SGE` (34.3 KB) | `Matriz_Correo_HuerfanoLEGAL.docx` — `1hHoMU-4ij9YIayB9REVvuXlA5eppnC1t` | **OBSOLETO (guia)** | cita Res. 385 — ver Z22 |
| **GASES MEDICINALES** `1B8r8SDi5LrEsQcMevK3i1I0nFZc5zKXl` | `Matriz_Correo_Gas_Medicinal-3 definitiva.docx` — `1mDVxEQNu1iMOwrG_h6dvn_XlJDsQNxbC` (25.9 KB) | `Matriz_05_Gas_Medicinal legal.docx` — `1pEDxma2jPhHTO7F4LN4gZxrVK3ugaY9j` (29.0 KB) | CANONICO (guia) / **OBSOLETO (legal)** | el legal cita Res. 385 — ver Z22. **Esta es la carpeta que confundia al PM en Z16** |
| **MEDIOS DE CONTRASTE** `15n2taQnygIU0aSxb63dWhhySMHPfLESR` | `Matriz_Medio_de_Contraste.docx` — `1t39pcTP3O701StUV415QnvWGT6M8KNBS` (29.1 KB) | `Matriz_Correo_Medio_Contraste legal.docx` — `1dk_deYc00wAKuE7SvewAyf-SpvYb43FW` | **OBSOLETO (guia)** | la guia cita Res. 385 — ver Z22 |
| **RADIOFARMACOS** `126U0YHkW_JLyz_WNVyxL_G8kSUh2rQtI` | `Matriz Radiofarmaco_v2-4 Definitiva.docx` — `16obgxV7xpWc5bw7MCK6-2_gi-TqYv5n7` (28.1 KB, 2 ago) | `Matriz_Correo_Radiofarmaco LEGAL.docx` — `1SBsh1WvhfmfFSsVobDF2RtTypRusrQ-c` | CANONICO | checklist radiofarmacos |
| **COSMETICOS** `1-w97KPe3YAbiK3co9p5uZNCdO1NbRwEd` | `cosmetico word.docx` — `1tJM3dqW8NLCdYuSbsDweH1qeTxCOY0us` (29.4 KB, 8 ago) | `Matriz_Correo_Cosmeticos LEGAL.docx` — `143zwQKphIpBNjwknL1sBZ2zIHvf4K7eh` | CANONICO (guia) | **el nombre `cosmetico word.docx` no sigue ninguna convencion**; renombrar |

## Copia de `Operaciones/` — id `1RankC8PmpVhzrg0XnuPgYVY0XbFaSmNQ` (creada 12 sept)

| categoria | contenido | estado |
|---|---|---|
| BIOLOGICOS `1OsK0J-Ms_8UJOrnhi9eCf9lsZhBBe6fj` | `Matriz_Guia_Biologicos_Biotecnologicos_1.docx` `1HVRKK4…` (18 sept) + `Matriz_Correo_Biologicos LEGAL.docx` `1WDTdXjEQR3vbjk1O8Xz98HvA-pcgY8sH` | **la guia es CANONICA**; el LEGAL es DUPLICADO (27 322 B, identico) |
| HOMEOPATICO `1f42YiQUd9G_ar9qBSXNkGZCbIV-R1FM-` | solo `Matriz_Correo_Homeopatico legal.docx` `14fm0VnG7Lilum9GDA5gEuXX3R7Ry2tUY` | DUPLICADO (24 474 B, misma fecha) |
| COSMETICO `1ho0Ufc0caz-GM-T0coFGKJWgJ8dcVzKw` | solo `Matriz_Correo_Cosmeticos LEGAL.docx` `1kZZDPg3zIy5h_WkQBdvKAroe5cW01Awi` | DUPLICADO (21 590 B) |
| SUPLEMENTOS `1Urhy6eT1LfUdTdTVSA9sWwK1RxExaumR` | solo `Matriz_Suplementos Legal.docx` `1CK_jlRLOQVy7Ho7u08snUHH-SC8gm5o1` | DUPLICADO (23 266 B) — **renombrado**: sin el `_Correo_` |
| Sintesis Quimica, Naturales, Radiofarmaco, Huerfano, Gas Medicinal, Medio de Contraste | **VACIAS** | 6 de 10 |

---

# C. Flujo de 14 fases

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| `Flujo_Cliente_Farmazed_14_Fases_Claude(1) Corregido.docx` | `1zIRjEU3v0iweVtYyV8YzXey1MeAiIt6K` | **CANONICO** (con reserva) | 12 sept, "Corregido". **Pero Z19 sigue abierto:** el texto de Fase 5 y Fase 13 aun no refleja la decision R11/R18 de Ricardo | maquina de estados de 14 fases; enum `status` del backend |
| `Flujo_Cliente_Farmazed_ SVG 14_Fases_vertical.svg` | `1FaoT49WePyC6QgyxeTXonIAsSguMUBFS` | **CANONICO** (con reserva) | 12 sept. Misma reserva Z19 | diagrama de progreso del cliente |
| Carpetas `Fase 1` a `Fase 13` (13 carpetas) | ver 01_INVENTARIO §3.2 | **DUDOSO** | **el doc y el SVG dicen 14 fases; solo hay 13 carpetas.** Falta la Fase 14 | estructura documental por fase |
| `Fase 10 …` (docx suelto dentro de la carpeta Fase 10) | `1RL1aDJdKeYHUwbKDt6BZeTM04-esxeoz` | CANONICO | descripcion de la fase; 14.2 KB, 12 sept | texto de la Fase 10 |
| Contenido de las carpetas `Fase 1`–`Fase 9`, `11`–`13` | — | **PENDIENTE DE RECORRER** | solo se abrio Fase 10 en esta corrida | — |

> **Correccion a la lectura previa del PM:** las carpetas `Fase N` **no son contenedores organizativos vacios**.
> Al menos la Fase 10 replica material de Operaciones (matrices, `guia para usuarios IEA`, `Muestras requisitos`,
> `Formulario - Solicitud de Cotización`). Es probable que las otras 12 hagan lo mismo. Eso multiplica el conteo
> real de duplicados muy por encima de lo que registro la Fase 1.

---

# D. Formularios

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| Serie completa **1–13** en `Formularios/Formularios para declaraciones y autorizaciones/` | ver 01_INVENTARIO §3.6 (13 ids) | **CANONICO** | **unica copia con la serie completa 1–13** y la mas nueva (30 mar) | los 13 formularios descargables del portal |
| Serie **4–13** en `Formularios/Poderes y autorizaciones…/` `1hEggn5LpJ3F3w2NEG--utIodLYC-S2hm` | 12 ids | DUPLICADO | le faltan los numeros 1, 2 y 3 | — |
| Serie **4–13** en `proceso documentacion/Poderes y autorizaciones…/` `1-7UeK7NQ0Kg53h_9H_73fEM2Zt4bNaS2` | 12 ids | DUPLICADO | tercera copia, mismos tamanos y fechas | — |
| `1. FU_Autorización_de_Representacion_Legal_por_Titular.docx` | `1MuoA4k6pCMW4bQJObWeqxqLG_LPXeHTW` | CANONICO | FU-1 | descarga FU-1 |
| `2. FU_Autorización_de_Representación_Legal_por_Casa_Matriz.docx` | `1EpJ6qzIX8Tkvq-qDbJdXUwnAs-B2y5ya` | CANONICO | FU-2 | descarga FU-2 |
| `3. FU_Autorización_de_TrámiteRS_al_Farmacéutico.docx` | `1sKBBlAInpmWrr2zPauZ4JI9_LS58pUb0` | CANONICO | FU-3 | descarga FU-3 |
| FU-1 — otras 3 copias | `17rDS4oCodTw2tF8qMulWyDvlcmiY2-b3`, `1xnvH9M1Z_oAlFe6ca_duwFuXgNnH7TyE`, `15V5l3JbfkbwLeSrg-SqT-s_awJ--8gKA` | DUPLICADO | 4 copias del mismo archivo de 38.5 KB en 4 carpetas | — |
| `f-01-srs-pf_formulario_de_solicitud_de_registro_sanitario…(7).xlsx` | `1vWlnCDhR2eqUtu7xnZdwlr3dQxL0Rw60` | CANONICO | formulario oficial DNFD de solicitud | formulario maestro de solicitud |
| `hc-01-srs-pf-drs_hoja_de_chequeo…ver01-2.docx` | `1HgFNASL1l2CNGS_9y2NvPpF-XRvhQf7M` | **DUDOSO** | **4 copias casi identicas** (61.8–62.0 KB) y ninguna dice cual rige. La `-2` es la mas nueva (20 may) y la mas grande | hoja de chequeo del expediente |
| `…ver01.docx` / `…ver01-4.docx` / `chequeo orignal.docx` *(sic)* | `1bUs6pUKvKFeDzbV6N6hNht43LZernnvH`, `1PMA_KNz2oyg8LGG5lZlYRWrODbHFZ5k3`, `1oKft-9A3RfdSSCFCAlRia2b8C_lC8mYh` | DUDOSO | las otras 3 de la serie; diferencias de 100–200 bytes, no se puede decidir por metadata | — |
| `hc-01-rm-pf_hoja_de_chequeo…reconocimiento_mutuo…ver01.docx` | `1nx0CA_dJdIpsO49YHKZc7HTYDslvCCm6` | CANONICO | unica hoja de chequeo de Rec. Mutuo | checklist Rec. Mutuo |
| `f-01-rm-pf-drs_formulario_de_solicitud_de_reconocimiento_mutuo…-2.docx` | `141aDOkjKGsDOyZcUvSReecq8rgiTRIXi` | CANONICO | unico formulario de Rec. Mutuo | formulario Rec. Mutuo |
| `f-02-srs-co_formulario…cosmeticos…(2).xlsx` | `1UU0aAO0D5FVyKDiY93g_Re9Rx0Fc2sYx` | CANONICO | unico formulario de cosmeticos | formulario cosmeticos |
| `f-03-em-pf-drs_formulario_para_entrega_de_muestra…ver01.docx` | `1SJoYpqi8iuFFiTsJId6E5ANYTk82dOO7` | CANONICO | entrega de muestras | Fase 11/12 |
| idem `-3` | `1UU7lzS4hPWoS4fDIZTVANL3NtGKPUAUb` | DUPLICADO | 46.6 KB ambos | — |
| `f-01-cre_rs_formulario_de_control_de_recepcion_de_expedientes*.docx` | `1Jgf2vr4bWjaQ0X7SuEN6GS5F451ZNSxP` (+ `-2` `1TsZ-PGwHuBI1kIDjzK_OAt_ZJEbSaClw`, `-4` `1X7XzOKqKp6uzQLj14K2vi8G25Sfanz_-`) | DUDOSO | **3 copias de 605 KB**; la `-4` es la mas nueva (7 jun) | control de recepcion, Fase 12 |
| `f-rs-clv_formulario…certificado_de_libre_venta….docx` | `1Y3iBZWgbMF1171ul8V_hhIC03QxrcySG` | CANONICO | unico CLV | solicitud de CLV |
| `f-rs-cr_formulario_para_solicitud_de_correccion….docx` | `1QVbMU2tbMCygxTp853MOAlXF-w1MvdoD` | CANONICO | unico de correcciones | tramite de correccion |
| `f-rs-cer_formulario…certificacion_de_registro_sanitario…-1.docx` | `1MS_AoZGWdKNFShFq4pnT11fDncQtN9c1` | CANONICO | unico de certificacion | tramite de certificacion |
| `f-02-ri-pf-drs_formulario…reingresos…ver01.docx` | `1M6oZ0ya6SUQzfHkJZMklcHmazY_9RG9-` | CANONICO | unico de reingresos | tramite de reingreso |
| `folleto_requisitos_para_registro_version_2.1.pdf` | `1fEGbcBD0GA_aWRlsg60nYB6UnhgeUjBG` | CANONICO | folleto oficial DNFD | material informativo |
| **Hoja de chequeo de la via WLA** | — | **FALTA** | existen las de Regular y Rec. Mutuo; no la de WLA | checklist WLA |
| **Hoja de chequeo de WHO-PQP** | — | **FALTA** | consecuencia de que no exista la matriz | checklist WHO-PQP |
| 4 archivos temporales `~$….docx` (162 B) | `1OzGG182cJc-XIpd9W4DkmTAY3HymkpfU`, `1Pxw6AKdYPbNWAwpk6KgebYJORh9KJTce`, `1m2E97hVn4L2_z1S_jM0M_XJ-AyrZgGdO`, `1a7SH79RLI2dRdT4UBT2AnJc7q5OHKDNI` | **RUIDO** | residuo de Word | nada — ver seccion J |

---

# E. IEA

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| `Matriz requisitos IEA enviar.docx` | `1Z9R7bY7raKty162f4W9z_QElaOdf0O9v` | **CANONICO** | matriz de requisitos IEA; "enviar" indica version de salida al cliente | checklist IEA |
| `Matriz_Requisitos_IEA.docx` | `1cCK7SBlUV02IcO60kqvrQd1YJ6y4QLFb` | DUPLICADO | **mismo archivo renombrado**: 18.6 KB y 20 may en ambos | — |
| `Instructivo IEA.docx` | `1tO1AgKBcslIdfyeDNzSr8cjEzNTLg1O5` / `1L3ypIlw_61NTKplQWSgB6SFfTMCxMG8U` | CANONICO / DUPLICADO | 22.1 KB identicos en las dos copias de `IEA Completo` | instructivo al cliente |
| `guia para usuarios IEA word listo.docx` | `1qwnE85-qrnoMEx7uuQweB-lAY0hLNgOX` / `1XHmt3b8GasNcb5yI67Bq0SLyt_eG77bo` / `1bs07EmLomuabZg7-vptE5TbebmkY4ThG` (Fase 10) | CANONICO + 2 DUPLICADO | **3 copias**; la de Fase 10 pesa 25.0 KB vs 24.6 KB — verificar | guia de usuario IEA |
| `guia para usuarios IEA word listo para correo.docx` | `1jSM_dNPnvpEtqXWlyMW16WlzEXe8RKkV` (24.8 KB) / `1dPk746WMqzIJxo-Yv0zxbLef22zYGnpM` (24.6 KB) | DUDOSO | **tamanos distintos**: son versiones diferentes, no copias | plantilla de correo IEA |
| `Guia_Entrega_Requisitos_IEA.docx` | `1Qv77OlR4iMVXnyh2YevMRvJ04TWN5vcL` | CANONICO | unico | entrega de requisitos |
| `Check List Proceso_Cotizacion_IEA.docx` | `1D6FR5KYjOrk-RAwgV9fB1CKcBPAZmoAd` | CANONICO | unico checklist de cotizacion IEA | Fase 4 |
| `IEA-ADM-F-001_Formulario_de_Solicitud_de_Cotizacion_ver_007.pdf` | `1bKrvvstopGabpB1a30n84FCCaBSXU85X` | CANONICO | formulario oficial IEA | solicitud de cotizacion IEA |
| idem, 2.ª copia | `1zUqEYmr5Z2eEhs1d2RG59aFLk8ZCYwEg` | DUPLICADO | 140 KB identico | — |
| `analitico-_proceso_de_entrega_de_la_documentacion_analitica_en_el_iea.pdf` | `1UwnVB5ICEcjL9kZpDqAz515Me5sG-Fa3` | CANONICO | doc oficial IEA | proceso analitico |
| idem, 3 copias mas | `178driS5d0feEsdXeKsY-QDAPACy97OoO`, `19wdXPwiqBMIbCzlPDU5HCVChc3cU6SAZ`, `1hCQs6gx5iJv3Zr04-sdyWzyxcFpFfrp3` | DUPLICADO | **4 copias identicas de 268 KB** en 4 carpetas | — |
| `Normativa para IEA estandar o Patrones.docx` | `1XGSA8kQIbpEplaF9S5zhX2xj4-KWp1yf` / `1eqXJw_GwJgmnqgrDe3fRf8eNSr2sDpvq` | CANONICO / DUPLICADO | 15.1 KB ambos | patrones y estandares |
| `Estándares de referencia ICQH Q6A.docx` | `1zdx-XpbUrwf-3UeboWy7k67YV5i86JxG` | CANONICO | referencia ICH Q6A | material de apoyo |
| `Muestras requisitos.docx` | `1PsYnb3rn6rAEUE9NDiSi_Y47dN1G9-9W` / `1R7jnk9xauax1b7Ghh4SNVSEK_Z-I6ocV` (Fase 10) | CANONICO / DUPLICADO | 18 720 B identicos | requisitos de muestras |
| `dnfd-19_procedimiento_de_entrega_de_muestras_para_analisis.pdf` | `13ktCJMdFC2GvMKjx86eZSHqoptWcSHp0` | CANONICO | procedimiento oficial | Fase 11/12 |
| `comunicado_iea_proced_a_listar_s_del_proceso_de_analisis.pdf` | `1Tivf__y8bkJ85pcaT38dkuEzLOJax38u` | CANONICO | comunicado oficial IEA | — |
| `Formulario - Solicitud de Cotización Productos Diversos.pdf` | `1LUBPgQFXsjwAPk-S2moRJtlp7qTm9SQB` | CANONICO | productos diversos | cotizacion |
| idem, 2 copias mas | `1vUFhF1sA98EH5fpOIGKXIGDfAgLXLjcY`, `1AA2_biz93AG4QgVA5lHPS75pjQcUfiQD` (Fase 10) | DUPLICADO | 178 KB (177 784 B) identicos | — |
| `Tabla_1_y_2_Decreto_851_RTCA.docx` / `Table_1_and_2_Decree_851_RTCA_English.docx` | `1umPOnxI3efSjty0AyDbgPWdMbscy-NOQ` / `1byrt024AH-uEcMkMyShupw8_DEiZGxS1` | CANONICO (par es/en) | **no es duplicado**: es la traduccion | material bilingue |
| `Process_for_Submission_of_Analytical_Documentation_IEA.docx` | `1wHQnQ7TXijNZE2KCUxP-Nii4Bm_ymtmJ` | CANONICO | version inglesa del proceso | material bilingue |
| `Guide for sanitary products registration.docx` | `1QMxRbqlMJLRP02T-L2u31H06qWbgIZPZ` | CANONICO | guia en ingles | cliente internacional |
| **`IEA Completo` duplicada entera** | `1hBoXNJDIEkrqy5pbzbE9Y1nUObUGOGn-` vs `1kI2J6u8ghJZsYH2es0nC3Dh7QwbcB-cx` | **DUPLICADO (arbol completo)** | mismas 2 subcarpetas, mismos 5 archivos, tamanos y fechas identicos | — |

---

# F. Precios

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| `Actualización de nuestros precios para la plataforma - copia.xlsx` | `1ZRmJ6Z0T5CbVoMppVB0ACtQlQB7WqhuK` | **CANONICO** | **12 sept, el mas nuevo**, y el titulo dice explicitamente "para la plataforma" | `seed_pricing.js` / tabla de precios del portal |
| `ANEXO 1 NO SE PAGAN.docx` | `1AI0JtRKLDOwPUhrQeDN9UKp1X1634jRG` | CANONICO | define modificaciones sin costo | logica de cobro de modificaciones |
| `ANEXO 2  SI PAGAN MODIFICACIONES.docx` *(doble espacio)* | `1gx58-eOrndDTlyFXIN7pvF4whjuHN2Uu` | CANONICO | define modificaciones con costo | idem |
| `COT-2026-001.docx` | `1THCbqPWLHG3QaZZIDBI62AwJCOJA7N9e` | CANONICO | plantilla/ejemplo de cotizacion | Fase 4 — generacion de cotizacion |
| `COT-2026-001 (2).pdf` | `1uCOITdQ4daJ5GHgqCG5GeEhCjVyrpIpr` | DUPLICADO | render PDF del anterior | — |
| **Tarifario oficial DNFD / IEA / Colegio de Farmaceuticos** | — | **FALTA** | R19: Farmazed cobra **todas** las tasas en Fase 5 y luego paga a cada autoridad. Para cotizar hace falta el monto oficial vigente de cada tasa, y **no hay un documento de tasas oficiales en el Drive** | calculo del total de Fase 5 |

> El sufijo `- copia` en el archivo canonico de precios es una trampa de nomenclatura: **la "copia" es el original vigente.**

---

# G. Legal / decretos

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| `Resolucion_985_de_2025_convertida.docx` | `1v4dk5BvaWiZhqQ14ZwMHbSvhAe0CNcjr` | **CANONICO** | **9 sept 2026.** Deroga las Res. 385 y 386/2023 (Z13). **Ya esta en el Drive** — la fuente de reemplazo existe | fundamento de Intercambiabilidad y equivalencia |
| idem `- copia` | `1igrZex47CBFBGi5r94z2L_x18WkPB7PT` | DUPLICADO | 44 244 B, misma fecha | — |
| `Resolucion_385_med para intercambiabilidad.docx` | `1_o7ZtX4tLXE2wxqsBPz3HF7Fauuy6tlF` | **OBSOLETO** | **derogada por la Res. 985/2025** | ninguno — archivar como historico |
| `Resolucion_386_2023(1).docx` | en `Legal/decretos pata trabajar/` *(sic "pata")* | **OBSOLETO** | derogada por la Res. 985/2025 | idem |
| `Matriz Legal para categorias de prod. Farmacéuticos/` (carpeta) | `1wlBmm2uFSoG2VOm3Q_H8UwxJjPqGBG82` | **DUDOSO** | contiene **4 variantes** de la matriz legal de sintesis quimica (`horizontal`, `por Claude`, `Word_…por Claude`, `MATRIZ CL. DE REQUISITOS… - copia`), 30–32 KB, todas mayo–junio. Ninguna marcada vigente | sustento legal de sintesis quimica |
| ↳ `Matriz_Sintesis_Quimica Legal_Correo-1 por Claude.docx` | `1GgmugOGDdw0eA_x5IyBsAeSXaI5qrqKT` | **CANONICO** (propuesto) | la mas nueva de las 4 (4 jun) | — |
| ↳ las otras 3 | `1XaSjlgN9fYokIqlJGNOCgL1AlKXTg2i3`, `1OpQXEd8XcnF7u_k0RnAQr6A0nAOg4b_2`, `10Uh81qj6szu_aZ7N1If7XHjfliMtJR-a` | DUPLICADO | variantes de formato del mismo contenido | — |
| `Legal/decretos pata trabajar/` *(sic)* | ver 01_INVENTARIO | **DUDOSO** | ~50 archivos, **con duplicados masivos pdf+docx del mismo decreto** (D.E. 27 aparece 6 veces entre las 4 subcarpetas de Legal) | corpus normativo de respaldo |
| `Legal/Decretos word/`, `Legal/Decretos/`, `Legal/Decretos y excell suplementos/` | `1vqVEtcJ1CG7qjttTIGONKhNrt72xdECK`, `18dvJnS8tYGz7JLCAIj-9TzDB6q6cgZ3f`, `1fORuSb-UuUuBC8AZJYGnpjdcNYt1VRp0` | **DUPLICADO (arboles solapados)** | **4 carpetas de decretos con contenido cruzado**. Ej.: `Dec 27 word 205 pags.` existe en 4 versiones (`1XTjPhk6…`, `1hteQVvH…`, `1x_sP6h3…`, `1W6ifVMY…`), 316–325 KB | — |
| `Legal/2020/` | `1nr6_RnTRoI0v27GyUK4JVYgRmYjW2T2B` | **OBSOLETO** | 7 guias DNFD **fechadas 2020**, superadas por el D.E. 27 y la Res. 126/2021 | archivo historico |
| `Legal/Legales Doc. Registro/` | — | CANONICO | apostilla, poderes, CLV — sustento de la documentacion legal del expediente | Fase 8 (poderes y IEA) |
| `Legal/Resumen/Índice Decreto 27 de 2024.docx` | — | CANONICO | indice util del decreto matriz | navegacion normativa |
| `ley-419-de-2024-ley-de-medicamentos.pdf` / `ley 419 de 2024.docx` | en `decretos pata trabajar/` y `Decretos word/` | CANONICO | ley vigente de medicamentos | marco legal general |
| `Guia_Individual_Requisitos_RS_por_Tipo_Medicamento.docx` | `1gdv_ajYPM5z5VK0JYWRVN4asy4NtLJdD` | **OBSOLETO** | cita Res. 385 — ver Z22 | requisitos por tipo |
| `Req Zelky  por productos.xlsx` *(doble espacio)* | `19d9RkwV7IA0eQO6bhGChx7_Hnyr06ivK` / `1nv4J0kLrGz7CP70q0mfzDNaCIEfd41Na` | **OBSOLETO** + DUPLICADO | cita Res. 385; 2 copias de 16 305 B | matriz de requisitos por producto |

---

# H. Plantillas y comunicacion al cliente

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| Los 10 `Matriz_Correo_*` (seccion B) | ver seccion B | CANONICO | **el prefijo `Matriz_Correo_` revela el origen**: nacieron como cuerpo de correo al cliente, antes de que existiera el portal | textos de requisitos + notificaciones |
| `guia para usuarios IEA word listo para correo.docx` | `1jSM_dNPnvpEtqXWlyMW16WlzEXe8RKkV` | DUDOSO | ver seccion E (2 versiones de distinto tamano) | plantilla de correo IEA |
| `RTCA_126 18_Paginas18-31 para correos.docx` | en `Legal/` | CANONICO | extracto normativo preparado para correo | fundamento en notificaciones |
| `Poderes y Certificados para correos.docx` | en `Legal/Matriz Legal…/` | CANONICO | plantilla de correo de poderes | Fase 8 |
| `Guardado  Decreto27_Paginas24_29 para correos.docx` *(doble espacio)* | en `Legal/` | CANONICO | extracto para correo | idem |
| `Refrendo del farmacéutico que fue Observación de Xenia.docx` | `1jlr_WdJuGAB-TKqf6oXdy6XCM0sVoIGZ` | DUDOSO | caso real de observacion; util como ejemplo, no como plantilla | biblioteca de observaciones |
| `matriz_para_observaciones-autorizaciones_declaracionesjuradas10.02.25.docx` | `1vIu2tlb5rs75IfaJJty-BdVvOAOQHAES` (22 may, 145 KB) | CANONICO | la mas nueva de 3 copias | manejo de observaciones DNFD |
| idem, 2 copias | `19Vr1R-k_dQH75ZayeTEwdIMuBGQ4x8Qo`, `1PJmLcPFX2FeGP6s9oiH-4MxFock4j9yq` | DUPLICADO | 146 KB, 20 feb | — |
| `Sisregsan.docx` (13.3 KB) vs `Sisregsan - copia.docx` (25.3 KB) | `1ujP4xxHCz4OXXfe8BI542nGi-7-DwS33` / `1AdN7XVJi9aqfApBBpMBl-CGZBeZ4sWny` | **DUDOSO** | **la "copia" pesa casi el doble**: no son la misma version. Hay que comparar contenido | integracion/registro SISREGSAN |
| **Plantillas de notificacion del portal** (correo de cambio de fase) | — | **FALTA** | el portal notifica en cada una de las 14 fases y no hay texto aprobado para ninguna | motor de notificaciones |

---

# I. Marketing / presentaciones / comercial

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| `Farmazed_Propuesta_Cliente_Definitiva(4).pptx` | `1IVBmTCLbZ3MQFHN0RwTRGixSj4r6_Tns` | **DUDOSO** | 22 may, 195 KB — **mas nueva pero mas chica** que la de la raiz | contenido del sitio publico |
| `Farmazed_Propuesta_Cliente Definitiva.pptx` | `1Eq0AE_y-NYnLkTJNZMOZG2YZdYKcjdYm` | DUDOSO | 8 may, 202 KB, en la **raiz** | idem |
| `Farmazed_Flujo_y_Tiempos.pptx` | `1kMTWU9MXsuyCmrv2Lh__8fQMpGtKdPKP` | CANONICO | unico doc de tiempos por fase | SLA/tiempos mostrados al cliente |
| `Carta_Presentacion_Farmazed.docx` | `1xcFXBafXyREPO_UFCy36bo6e_Xh5ZjIl` | CANONICO | carta de presentacion | landing / onboarding |
| `Farmazed_Presentacion.pptx` | `12ruinYvMtRS1i4llM-bOP7D40De589yE` | DUDOSO | 24 abr, la mas vieja de las 3 pptx | — |
| `Claud presentacion Farmazona.docx` *(sic x2)* | `1e0nTTcKylzlBHvtl9wY32SkQVmC5kfny` | DUDOSO | **el nombre tiene dos errores** ("Claud", "Farmazona"); contenido sin verificar | — |
| `Propuesta_Farmazed_2026` (Doc, `Proyecto Website/`) | `1btu27f0QZhc1plhM2bns0kodF0MI_X3L_3dKl-MV1vQ` | CANONICO | unica propuesta del sitio web | alcance del sitio |
| Activos de marca: `Logo Con Idoneidad.png`, `Firma*.png`, `Email.png`, `Tarjeta.png`, `idoneidad.jpg`, `arte tarjeta.docx` | ver 01_INVENTARIO §1 | CANONICO **mal ubicado** | son activos validos, pero **estan sueltos en la raiz** mezclados con documentacion regulatoria | identidad visual del portal |
| `Presentaciones Charlas/`, `Charla Farmazed/` | `1Eecf27znDyXuu6xtWIwW4-gkpI3Vzc7g`, `17_n-ZnzYNDzI_9G2SEfCIuooguMVNZCb` | **NO RECORRIDAS** | pendiente | — |
| `Markting/` *(sic, carpeta local)* | — | DUDOSO | el nombre esta mal escrito; no aparece en el Drive compartido | — |

---

# J. Ruido

| documento | id de Drive | estado | por que | que alimenta en el portal |
|---|---|---|---|---|
| `LBP6000_6018_R150_V110_W64_uk_EN_1.exe` (13.8 MB) | `1occsPvu0jxlnNqiSQt_zNr_zhSTGUcbt` | **RUIDO** | driver de impresora Canon en la raiz de un Drive regulatorio | nada |
| `Canon_LBP6018_R150_V110_W64_ZH.exe` (13.8 MB) | `1fWIfJXQj73ysA39MGpDcHRYLmIakxi-B` | **RUIDO** | idem. **27.6 MB combinados** | nada |
| `~$ia para usuarios IEA word listo.docx` (x2) | `1OzGG182cJc-XIpd9W4DkmTAY3HymkpfU`, `1Pxw6AKdYPbNWAwpk6KgebYJORh9KJTce` | **RUIDO** | temporal de Word, 162 B | nada |
| `~$GISTRO POR WLA DE_2_2025_WLA_Transcripcion_Farmazed.docx` | `1m2E97hVn4L2_z1S_jM0M_XJ-AyrZgGdO` | **RUIDO** | temporal de Word | nada |
| `~$-01-srs-pf-drs_hoja_de_chequeo…docx` | `1a7SH79RLI2dRdT4UBT2AnJc7q5OHKDNI` | **RUIDO** | temporal de Word | nada |
| `Copia de Prompt Ficha tecnicas CIMA ESPANA.txt` | `1OEWQBbxMDku87ispa2wy5O_jMmU8zAxt` | **RUIDO** (reubicable) | es un **prompt de IA** guardado dentro de una carpeta regulatoria. Util, pero no es documentacion regulatoria | herramienta interna |
| `Xenia Registro Sanitario Medicamentos Panama(1).xlsx` | `1D80JzxDGNKcLQrcRn3ap23U7TUjwi9KL` / `1pS6CasM32129gJqt1d_tGg5NBzlo9_zh` | DUPLICADO | 2 copias identicas de 31.5 KB (raiz + `proceso documentacion/`). **Es un caso de cliente real, no una plantilla** | biblioteca de casos |
| `desktop.ini` (varios, copia local) | — | **RUIDO** | metadata de Windows | nada |
| `Operaciones/Manuales y Procedimientos/` | `1jZcrq8jtV5kkf27teaOpUDsZXIGopTPc` | **RUIDO estructural** | carpeta **completamente vacia** | nada |
| 6 subcarpetas vacias en `Operaciones/Matrices Definitivas para cliente/` | ver seccion B | **RUIDO estructural** | estructura creada y nunca llenada; **enganan al developer** | nada |
| `_to_delete/` y `repo/` (solo copia local) | — | **RUIDO** | R15 ya decidio mover `repo/` a `_to_delete/` | nada |
| Archivos maritimos (`MSC-MEPC`, `Ship Particulars`, `MMC-152`…) | fuera de la carpeta compartida | **AJENO** | aparecen en busquedas de texto completo porque estan en el Drive personal de Ricardo, **no en la carpeta Farmazed**. Ignorar | nada |

---

# LOS CUATRO PUNTOS ABIERTOS DE PM_COMMENTS

## Z15 — Las dos carpetas "Matrices Definitivas para cliente"

**Resuelto. La de Fase 10 es la completa, pero ninguna de las dos sirve tal cual.**

| | `Operaciones/Matrices Definitivas para cliente` | `…/Fase 10/Matrices Definitivas para cliente` |
|---|---|---|
| id | `1RankC8PmpVhzrg0XnuPgYVY0XbFaSmNQ` | `1y5-aPYLe2RZJBDaist_njX_bWGTjl1ge` |
| creada | 2026-09-12 | 2026-09-02 |
| categorias con archivos | **4 de 10** | **10 de 10** |
| archivos totales | 5 | **19** |
| contenido unico | **si: `Matriz_Guia_Biologicos_Biotecnologicos_1.docx` (18 sept), el archivo mas nuevo de todo el Drive** | si: las guias de Naturales, Suplementos, Homeopatico, Huerfano, Gas Medicinal, Medio de Contraste, Radiofarmaco, Cosmetico y los LEGAL de Sintesis Quimica, Radiofarmaco, Medio de Contraste, Gas Medicinal, Huerfano, Naturales |

**Recomendacion:** oficializar **la de Fase 10** (`1y5-aPYLe2RZJBDaist_njX_bWGTjl1ge`), **pero antes copiar hacia ella**
`Matriz_Guia_Biologicos_Biotecnologicos_1.docx` (`1HVRKK43iq2XWWRgdKORlJRxo7gaFZJC4`), que solo existe en la de Operaciones
y **supera** a la guia de biologicos que hoy vive en Fase 10 (`Biologicos con checklist para guia.docx`, 21 jul).
Hecho eso, la de `Operaciones/` queda 100 % redundante y se archiva.

**Matiz que corrige a PM_COMMENTS:** el doc decia "la de Fase 10 es la buena" sin reservas. Es la buena **en cobertura**
(10/10 frente a 4/10), pero **no contiene el trabajo mas reciente de Zelky**. Archivar la de Operaciones sin copiar
antes ese archivo **perderia la unica version de la matriz de biologicos de 18 de septiembre.**

**Segundo matiz:** la carpeta se llama "Matrices **Definitivas**" y **la categoria mas comun del portal —sintesis
quimica— no tiene matriz guia en ninguna de las dos.** El nombre promete algo que no entrega.

---

## Z16 — "guia" frente a "LEGAL": la regla real de nomenclatura

**La lectura del PM es correcta en el fondo y equivocada en el criterio.**

- **Correcto:** la **guia** es operativa (que documentos pedirle al cliente) y la **LEGAL** es el sustento normativo
  (que articulo respalda cada requisito). El portal construye el checklist desde la **guia** y usa la **LEGAL** para
  mostrar el fundamento. Confirmado por el patron: en las 9 categorias con par completo, el archivo "LEGAL" pesa
  **21–29 KB** de forma consistente, mientras que las guias van de **25 a 72 KB** — la guia es el documento largo.

- **Equivocado:** el PM supuso que el prefijo `Matriz_Correo_` identifica a la LEGAL. **No es asi.**
  `Matriz_Correo_` marca el **origen** (nacieron como cuerpo de correo al cliente) y aparece en **ambos** tipos.

**REGLA REAL — el discriminador es el token `legal`/`LEGAL` en el nombre, en cualquier posicion y cualquier caja.
Si el nombre contiene "legal", es el sustento normativo. Si no lo contiene, es la guia operativa.**

Verificacion categoria por categoria (carpeta de Fase 10):

| categoria | archivo SIN "legal" → **GUIA** | archivo CON "legal" → **LEGAL** | ¿la regla funciona? |
|---|---|---|---|
| Biologicos | `Biologicos con checklist para guia.docx` | `Matriz_Correo_Biologicos LEGAL.docx` | si |
| Naturales | `Matriz Guia Productos Naturales.docx` | `Matriz_Correo_Naturales_Fitofarmacos LEGAL.docx` | si |
| Suplementos | `matriz  guia Suplementos 22-7-2026.docx` | `Matriz_Correo_Suplementos Legal.docx` | si |
| Homeopatico | `Matriz  Guia homeopatico … corregido.docx` | `Matriz_Correo_Homeopatico legal.docx` | si |
| Huerfano | `Matriz_Huerfano 30-4-26.docx` | `Matriz_Correo_HuerfanoLEGAL.docx` | si (pegado, sin espacio) |
| Radiofarmaco | `Matriz Radiofarmaco_v2-4 Definitiva.docx` | `Matriz_Correo_Radiofarmaco LEGAL.docx` | si |
| Medio de Contraste | `Matriz_Medio_de_Contraste.docx` | `Matriz_Correo_Medio_Contraste legal.docx` | si |
| Cosmetico | `cosmetico word.docx` | `Matriz_Correo_Cosmeticos LEGAL.docx` | si |
| **Gas Medicinal** | **`Matriz_Correo_Gas_Medicinal-3 definitiva.docx`** | `Matriz_05_Gas_Medicinal legal.docx` | **si — y es justo el caso que confundia al PM** |
| **Sintesis Quimica** | **no hay** | `MATRIZ LEGAL SINTESIS QUIMICA LEGAL PARA CORREO REGISTRO SANITARIO COPIA.docx` | la regla aplica; **la guia FALTA** |

**Gas Medicinal ya no es una excepcion:** `Matriz_Correo_Gas_Medicinal-3 definitiva` no dice "legal" → es la guia,
exactamente como sospechaba el PM. Lo que fallaba era usar `Matriz_Correo_` como criterio, no el archivo.

**Convencion propuesta** (renombres en la seccion final): `Matriz_Guia_<Categoria>.docx` y `Matriz_Legal_<Categoria>.docx`.
Elimina la ambiguedad, mata el prefijo `Matriz_Correo_` heredado de la era pre-portal y hace el parseo programatico trivial.

---

## Z11 y Z17 — Matrices de WLA y de WHO-PQP

### Z11 — WLA: **la matriz existe, pero no esta validada**

`Matriz_Reconocimiento_WLA_Farmazed verificar.docx` — `1M1WHckyY-c_VpilotTVPyj1EZ2JsVkjS` (18.5 KB, 8 jun 2026),
mas una copia identica en carpeta de Fase (`1N0QsOoNHKFdePA_e07KSXhgnsOvBbqJe`).
La palabra **"verificar" esta en el nombre del archivo**, puesta ahi por la propia Zelky. No se ha tocado desde el 8 de
junio, pese a que el D.E. 2/2025 quedo confirmado como instrumento rector en septiembre (Z14).
Hay material de respaldo: `REGISTRO POR WLA DE_2_2025_WLA_Transcripcion_Farmazed.docx` (`1rU0S0QOsBSHuFpN5bbYUt2uNZYhmjL_o`)
y `WLA OMS.docx` (`1NMLH-62EbRGMXakejIhHJxuk70jAdIMV`).

**Lo minimo que tiene que entregar Zelky:** un pase articulo por articulo de la matriz contra el D.E. 2/2025 —
cubriendo la red EMRN y las nueve autoridades nacionales reconocidas— y **renombrar el archivo quitando "verificar"**
(a `Matriz_Guia_WLA.docx`). Mientras el nombre diga "verificar", el developer no puede usarla como fuente.

### Z17 — WHO-PQP: **no existe nada. Cero.**

Busqueda por titulo (`PQP`) y por texto completo (`WHO-PQP`, `Precalificación OMS`) sobre todo el Drive: **cero
resultados**. No hay matriz, ni borrador, ni hoja de chequeo, ni nota. La via aparece unicamente **mencionada** como
quinta opcion en el flujo de la Fase 3.

**Lo minimo que tendria que entregar Zelky para poder construirla:**
1. **Decision previa:** ¿Farmazed ofrece realmente esta via, o esta en el flujo solo como informacion? Si es lo segundo,
   se saca del alcance y se cierra Z17 sin trabajo. **Esta pregunta debe responderse antes de cualquier otra cosa.**
2. Si entra al alcance: (a) el **instrumento normativo panameno** que reconoce la precalificacion OMS como via de
   registro —numero de decreto o resolucion y articulo—; (b) la **lista de documentos exigidos**, en el mismo formato
   de tabla que las otras matrices, cada requisito con su fundamento; (c) **que cambia frente a Reconocimiento Mutuo y
   frente a WLA** —las tres son vias de reconocimiento y el wizard tiene que saber distinguirlas—; (d) si aplica a
   todas las categorias de producto o solo a algunas.

**Comparacion util para dimensionar:** WLA tiene matriz sin validar (1 archivo + 2 de respaldo). WHO-PQP tiene 0 archivos.
**WLA se desbloquea con una revision; WHO-PQP requiere redactar una matriz desde cero.**

---

## Z22 — Documentos que citan la Res. 385/386 frente a la Res. 985/2025

**Buena noticia primero:** la norma de reemplazo **ya esta en el Drive** —
`Resolucion_985_de_2025_convertida.docx` (`1v4dk5BvaWiZhqQ14ZwMHbSvhAe0CNcjr`, 9 sept 2026, en `Legal/Decretos word/`),
con copia en `Legal/Decretos y excell suplementos/` (`1igrZex47CBFBGi5r94z2L_x18WkPB7PT`).
Zelky ya la subio; lo que falta es **propagarla a las matrices**.

### Documentos confirmados por busqueda de texto completo que citan la Res. 385 (hay que actualizar)

| # | documento | id de Drive | dominio | prioridad |
|---|---|---|---|---|
| 1 | `Matriz_05_Gas_Medicinal legal.docx` | `1pEDxma2jPhHTO7F4LN4gZxrVK3ugaY9j` | matriz LEGAL, gases medicinales | alta |
| 2 | `Matriz_Medio_de_Contraste.docx` | `1t39pcTP3O701StUV415QnvWGT6M8KNBS` | matriz **GUIA**, medios de contraste | **critica** — alimenta el checklist directamente |
| 3 | `Matriz_Huerfano 30-4-26.docx` | `1fyxIbwXIR8bybvI2LpvioMLWLIFN8SGE` | matriz **GUIA**, huerfanos | **critica** — idem |
| 4 | `Guia_Individual_Requisitos_RS_por_Tipo_Medicamento.docx` | `1gdv_ajYPM5z5VK0JYWRVN4asy4NtLJdD` | guia consolidada por tipo | alta |
| 5 | `Req Zelky  por productos.xlsx` | `19d9RkwV7IA0eQO6bhGChx7_Hnyr06ivK` | matriz de requisitos por producto | media |
| 6 | idem, 2.ª copia | `1nv4J0kLrGz7CP70q0mfzDNaCIEfd41Na` | duplicado del anterior | media |

### Documentos con alta probabilidad de estar afectados — requieren apertura manual

La bifurcacion obligatorio/voluntario que instauraban las Res. 385/386 es **exactamente** el objeto de estas matrices,
y sus nombres lo declaran. No los confirmo por texto completo porque la busqueda numerica devuelve demasiado ruido,
pero por dominio son los primeros a revisar:

| documento | id de Drive | por que |
|---|---|---|
| `Matriz_Equivalencia_Procedimiento_Regular.docx` | `1LiXtvzR9S7T7B6xGHRNxxKZBEBNJLyr-` | la equivalencia terapeutica **es** lo que regulaban la 385/386 |
| `Matriz_Equivalencia_Procedimiento_Abreviado.docx` | `1vMcJvJ3oCe1TW4VYCa08RBWdeBmSDtPv` | idem. **Ojo: la otra copia (`1XyvhKyrRGZbCOgdPcbfDwYCkQzn1VcJu`) pesa 13.4 KB frente a 19.2 KB — son versiones distintas** |
| `Matriz_Renovacion_Intercambiabilidad.docx` | `1YXGfw5wkPTTOtWoSimX-9w0k8v3PiU9v` | renovacion de intercambiabilidad |
| Los 4 documentos de Intercambiabilidad de `TIPOS DE REGISTRO/` | `1UmUT4IZ…`, `1ic6jEhQ…`, `1eEfnUz_…`, `1ggXmjjb…` | el tramite que Ricardo aprobo como tipo propio (R3) |
| `Equivalencia  Intercambiabilidad, Procedimiento Abreviado, procedimiento Regular.docx` | `1JK6p2plPXRbXX3054KgIxZfamg63tYbR` (+ copia `1fqbOkYrRnyu2kcqXiRH3gmhObzGkc_8C`) | material docente sobre el mismo tema |
| `Sobre Intercambiabilidad.docx` | `1PgMDjFWwb9_AihfXNZDBttICwnGTX6I9` (+ copia `1l1uz_jj0_BGsbh_4NWX4jGyao59LAfKT`) | idem |

### Documentos que NO se actualizan — se archivan como historico

`Resolucion_385_med para intercambiabilidad.docx` (`1_o7ZtX4tLXE2wxqsBPz3HF7Fauuy6tlF`), `Resolucion_386_2023(1).docx`
y los dos PDF de la Res. 386 en `Legal/decretos pata trabajar/`. Son las normas derogadas mismas: se conservan por
trazabilidad, **no se corrigen**.

**Impacto de una linea:** al menos **2 matrices guia** (Medio de Contraste y Huerfano) alimentan hoy el checklist del
portal con normativa derogada, y la Res. 985 elimina la bifurcacion obligatorio/voluntario que el portal asume en su
logica. **No es solo cambiar la cita: cambia el comportamiento del wizard.**

---

# PROPUESTA DE REORGANIZACION (NO EJECUTADA)

> **NADA DE ESTO SE HA EJECUTADO.** Google Drive se trato como **solo lectura** durante toda esta corrida.
> **Pendiente de aprobacion de Rick y de Zelky.** Zelky es la propietaria de la carpeta raiz: sin su visto bueno
> no se mueve ni un archivo. Se recomienda **copiar antes de mover** y no vaciar la papelera en 30 dias.

## Estructura destino propuesta

```
Farmazed Reference documents/            ← raiz, queda SOLO con la carpeta de trabajo y los docs del PM
├── 00_ADMIN/                            ← [NUEVA] credenciales y control (acceso restringido)
├── 01_VIAS_DE_REGISTRO/                 ← [NUEVA] una subcarpeta por via
│   ├── Regular/  Abreviado/  Reconocimiento_Mutuo/  WLA/  WHO_PQP/  Intercambiabilidad/
├── 02_MATRICES_POR_CATEGORIA/           ← la de Fase 10, promovida a primer nivel
│   └── <10 categorias>/ con Matriz_Guia_*.docx + Matriz_Legal_*.docx
├── 03_FLUJO_14_FASES/                   ← doc maestro + SVG + las 14 carpetas de fase (sin material duplicado)
├── 04_FORMULARIOS/                      ← UNA sola copia de la serie 1-13 + formularios DNFD + hojas de chequeo
├── 05_IEA/                              ← UNA sola copia (hoy son dos arboles identicos)
├── 06_PRECIOS_Y_COTIZACIONES/
├── 07_LEGAL/
│   ├── Vigente/                         ← Ley 419/2024, D.E. 27, Res. 126/2021, Res. 985/2025, D.E. 2/2025…
│   └── Historico/                       ← Res. 385, Res. 386, las guias de 2020
├── 08_PLANTILLAS_CLIENTE/
├── 09_MARCA_Y_COMERCIAL/                ← logos, firmas, tarjeta, pptx, cartas
├── 10_CASOS_REALES/                     ← expedientes de clientes (Xenia, observaciones)
└── _ARCHIVO/                            ← [NUEVA] duplicados y obsoletos; nada se borra, todo se archiva
```

## Movimientos y renombres

### Bloque 1 — urgente, desbloquea al developer

| # | accion | origen | destino | riesgo |
|---|---|---|---|---|
| 1 | **COPIAR** `Matriz_Guia_Biologicos_Biotecnologicos_1.docx` (`1HVRKK4…`) | `Operaciones/Matrices Definitivas…/BIOLOGICOS/` | `…/Fase 10/Matrices…/MATRIZ GUIA BIOLOGICOS…/` | **hacer esto ANTES que el punto 2** |
| 2 | **MOVER** toda `Operaciones/Matrices Definitivas para cliente` (`1RankC8…`) | `Operaciones/` | `_ARCHIVO/` | ninguno una vez hecho el 1 |
| 3 | **MOVER** la carpeta de Fase 10 (`1y5-aPY…`) | `…/Fase 10/` | `02_MATRICES_POR_CATEGORIA/` | dejar acceso directo en Fase 10 |
| 4 | **RENOMBRAR** los 19 archivos de matrices | — | `Matriz_Guia_<Cat>.docx` / `Matriz_Legal_<Cat>.docx` | **Zelky debe validar cada par antes** |
| 5 | **RENOMBRAR** `Matriz_Reconocimiento_WLA_Farmazed verificar.docx` | — | `Matriz_Guia_WLA.docx` | **solo despues de la validacion de Z11** |

### Bloque 2 — deduplicacion

| # | accion | detalle |
|---|---|---|
| 6 | **ARCHIVAR** una de las dos `IEA Completo` | la de `proceso documentacion/` (`1kI2J6u…`); arboles identicos |
| 7 | **ARCHIVAR** 2 de las 3 series de declaraciones juradas | conservar `Formularios/Formularios para declaraciones y autorizaciones/` (**la unica con 1–13 completa**) |
| 8 | **CONSOLIDAR** las 4 `hc-01-srs-pf-drs_hoja_de_chequeo` | **requiere que Zelky diga cual rige** — no se decide por metadata |
| 9 | **CONSOLIDAR** las 3 `f-01-cre_rs…expedientes` | idem |
| 10 | **ARCHIVAR** 3 de las 4 copias de `analitico-…_iea.pdf` | 268 KB identicos |
| 11 | **ARCHIVAR** 3 de las 4 copias de `1. FU_Autorización…Titular.docx` | 38.5 KB identicos |
| 12 | **FUSIONAR** las 4 carpetas de decretos de `Legal/` | en `07_LEGAL/Vigente/` + `07_LEGAL/Historico/`; el D.E. 27 esta 6 veces |
| 13 | **COMPARAR** `Sisregsan.docx` vs `Sisregsan - copia.docx` | **13.3 KB vs 25.3 KB: no son la misma version.** Requiere lectura |
| 14 | **COMPARAR** las 2 `Matriz_Equivalencia_Procedimiento_Abreviado.docx` | 13.4 KB vs 19.2 KB: idem |

### Bloque 3 — limpieza de ruido

| # | accion | detalle |
|---|---|---|
| 15 | **BORRAR** los 2 `.exe` de Canon | 27.6 MB de drivers de impresora. **Unico borrado que propongo de verdad** |
| 16 | **BORRAR** los 4 temporales `~$….docx` | 162 B c/u, residuo de Word |
| 17 | **MOVER** los 8 activos de marca de la raiz | → `09_MARCA_Y_COMERCIAL/` |
| 18 | **MOVER** `Copia de Prompt Ficha tecnicas CIMA ESPANA.txt` | → `00_ADMIN/herramientas/` |
| 19 | **MOVER** los 2 `Xenia…xlsx` y el `Refrendo…Observación de Xenia.docx` | → `10_CASOS_REALES/` — son datos de un cliente real |
| 20 | **BORRAR** `Operaciones/Manuales y Procedimientos/` | vacia |
| 21 | **BORRAR** las 6 subcarpetas vacias de la copia archivada de matrices | tras el punto 2 |
| 22 | **MOVER** `Legal/2020/` | → `07_LEGAL/Historico/2020/` |

### Bloque 4 — higiene de nombres

| # | accion | detalle |
|---|---|---|
| 23 | **RENOMBRAR** `Farmazed ` → `Farmazed` | **quitar el espacio final.** Rompe scripts y rutas |
| 24 | **RENOMBRAR** `Flujos del proceso  de  registro sanitario` | colapsar los dobles espacios |
| 25 | **RENOMBRAR** `Fase 6  CRM`, `Fase 7  Solicitar…`, `Productos  para registro Sanitario`, `Pre guntas  IEA…`, `Equivalencia  Intercambiabilidad…`, `Req Zelky  por productos.xlsx`, `ANEXO 2  SI PAGAN…`, `Guardado  Decreto27…`, `matriz  guia Suplementos…`, `Matriz  Guia homeopatico…` | dobles espacios |
| 26 | **RENOMBRAR** `Fase 11 …corregidos ` y ` Fase 12 Recepción…` | espacio final / espacio inicial |
| 27 | **COMPLETAR** el titulo truncado de `Fase 10 Se verifica la documentación con nuestras matrices guias de categorías de medicamentos de   ` | cortado a media frase + 3 espacios finales |
| 28 | **CORREGIR** erratas: `Presentaciones Carta y Power Pint` → `Power Point`; `decretos pata trabajar` → `para trabajar`; `chequeo orignal` → `original`; `Intercambiabilidad de medicamento proecdimiento abreviado` → `procedimiento`; `Datos Pataforma Faddi` → `Plataforma`; `Claud presentacion Farmazona` → `Claude presentacion Farmazed`; `Markting` → `Marketing` | 7 erratas |
| 29 | **RENOMBRAR** `cosmetico word.docx` | → `Matriz_Guia_Cosmeticos.docx` (parte del punto 4) |
| 30 | **RENOMBRAR** `Actualización de nuestros precios para la plataforma - copia.xlsx` | quitar `- copia`: **es el original vigente** y el sufijo confunde |

### Bloque 5 — correcciones en documentacion local (no en Drive)

| # | accion | detalle |
|---|---|---|
| 31 | **CORREGIR** `handover.md` | llama "Regulatorios" a la carpeta raiz y "Farmazed 2/" a la subcarpeta. **Los dos nombres estan mal**; la subcarpeta real es `Farmazed ` con espacio final |
| 32 | **REGISTRAR** en `handover.md` | que las carpetas `Fase N` contienen copias paralelas del arbol de Operaciones, no solo material de la fase |

---

# RESUMEN NUMERICO

| | cantidad |
|---|---|
| Filas clasificadas en este mapa | **131** |
| **CANONICO** | 58 |
| **DUPLICADO** | 33 |
| **OBSOLETO** | 13 |
| **DUDOSO** | 19 |
| **FALTA** | 8 |
| RUIDO / AJENO | 12 |

### Las 8 filas FALTA — lo mas valioso de este documento

| # | que falta | dominio | quien lo entrega | bloquea |
|---|---|---|---|---|
| 1 | **Matriz guia de SINTESIS QUIMICA** | B | Zelky | **la via mas comun del portal** |
| 2 | **Matriz de WHO-PQP** | A | Zelky (o Ricardo saca la via del alcance) | 5.ª via del wizard |
| 3 | **Matriz consolidada de RENOVACIONES** | A | Zelky | tramite de renovacion del MVP |
| 4 | **Matriz consolidada de MODIFICACIONES** | A | Zelky | tramite de modificacion del MVP |
| 5 | **Tarifario oficial DNFD / IEA / Colegio de Farmaceuticos** | F | Ricardo / Zelky | calculo del cobro total de Fase 5 (R19) |
| 6 | **Hoja de chequeo de la via WLA** | D | Zelky | checklist WLA |
| 7 | **Hoja de chequeo de WHO-PQP** | D | Zelky | checklist WHO-PQP |
| 8 | **Plantillas de notificacion de las 14 fases** | H | Zelky / Ricardo | motor de notificaciones del portal |

---

# PENDIENTE

Lo que **no** alcance a cubrir en el techo de 20 minutos:

1. **Contenido de 12 de las 13 carpetas `Fase N`.** Solo se abrio la Fase 10. Dado que la Fase 10 resulto contener una
   copia paralela completa del arbol de Operaciones, **es muy probable que las otras 12 tambien** — lo que elevaria el
   conteo real de duplicados bastante por encima de los 33 registrados aqui. **Es el hueco mas grande que queda.**
2. **La subcarpeta `Proceso flujo cliente carpetas`** (`1GSsrobz6gRkSh7WEQTpuxZqn3pYzPIiE`) y la carpeta padre
   `1Ox6cvNWgN8mL-4hRXYq_bkPg4CR4Q527`, donde aparecieron copias de las matrices de equivalencia y de WLA: no se
   identifico con certeza a que fase pertenecen.
3. **Verificacion Z22 abriendo archivos.** La lista de 6 documentos confirmados sale de busqueda por texto completo.
   Los 6 "de alta probabilidad" **no estan confirmados**: hay que abrirlos uno por uno. Ninguna matriz se leyo por dentro.
4. **Inventario completo de `Legal/`.** Se listaron 4 de las 7 subcarpetas por la copia local (que es de junio y puede
   estar desfasada del Drive). `Legales`, `Resumen` y `Matriz Legal…` solo se recorrieron parcialmente, y **no se
   verificaron los ids de Drive de la mayoria de los archivos de Legal** — varias filas de la seccion G citan la ruta
   pero no el id.
5. **`Presentaciones Charlas/` y `Charla Farmazed/`** — no recorridas.
6. **Comparacion real de contenido** en los 19 casos DUDOSO. Todo el criterio de esta corrida fue metadata (nombre,
   tamano, fecha). Las 4 hojas de chequeo, las 3 de recepcion de expedientes y el par `Sisregsan` **no se pueden
   resolver sin abrir los archivos**.
7. **Mapeo de cada documento a su campo FADDI.** La columna "que alimenta en el portal" es funcional, no de codigo de
   campo. El cruce fino contra `faddi_checklists.js` queda para la Fase 3.
8. **`Costos/`, `Formatos Dossier/`, `Info Farmazed/`, `docencia/`** — existen en la copia local y **no se verifico si
   tienen equivalente en el Drive compartido**. Pueden ser material solo-local o carpetas ajenas al Drive de Zelky.

**Siguiente paso sugerido para la Fase 3:** recorrer las 12 carpetas `Fase N` restantes antes que cualquier otra cosa.
Es el unico hueco que puede cambiar de forma material las conclusiones de este mapa.

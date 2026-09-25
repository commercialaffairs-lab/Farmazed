# 00 — RESUMEN DE LA CORRIDA NOCTURNA (indice)

**Fecha:** 2026-09-19 / 2026-09-20 (noche)
**Maquina:** Patch (`/home/claude-msi/Projects/Farmazed/Proyecto Farmazetd Regulatory/organizacion/`)
**Autorizado por:** Rick, 2026-09-20 — ordenar la data del proyecto para poder trazar un roadmap.
**Ejecutado por:** el PM (Claude Opus), despachado por Argus.

**Estado final de la cadena: COMPLETA. Las cuatro fases corrieron y las cuatro escribieron su archivo.**

---

## Reglas que gobernaron la corrida — y que se respetaron

- **Google Drive: solo lectura.** No se creo, movio, renombro, borro ni subio nada. La reorganizacion
  propuesta en la Fase 2 esta **escrita, no ejecutada**.
- **`FADDI CREDENTIALS.txt` y el Google Doc `Contrasenas`: nunca abiertos ni citados.** Solo se registro que
  existen y donde, como riesgo.
- **Ningun `git commit` ni `git push`.** Solo se escribieron archivos nuevos en `organizacion/`.
- **No se edito codigo.** Ni `tracker/` ni `farmazed-web/`. Esta cadena fue de documentacion.
- Cada fase corrio con **techo de 20 minutos de reloj** y cierra con su propia seccion `PENDIENTE`.

---

## Los cuatro artefactos

### `01_INVENTARIO_DRIVE.md` — que hay en el Drive
**46 KB · 517 lineas · Fase 1**

Recorrido de la carpeta compartida "Farmazed Reference documents" (id `14wa5CoMFztQlrfB8_yeKNtlxZfe9Namv`,
propiedad de Zelky). **185 archivos y 61 carpetas** identificados, con id de Drive, tamano, fecha y
propietario, carpeta por carpeta.

Cierra con **nueve señales** (S1–S9): nombres con espacios anomalos que rompen rutas, carpetas duplicadas,
archivos casi identicos, material ajeno al proyecto (dos drivers de impresora Canon de 13.8 MB, temporales de
Word), **7 carpetas vacias**, la inconsistencia "14 fases pero 13 carpetas", todo lo modificado despues del
1 de septiembre, entregables de plataforma sueltos en la raiz, y las credenciales en texto plano.

**Lo mas util de aqui:** S5 y S7. S5 muestra que **6 de las 10 matrices guia estan vacias**, incluida la de
Sintesis Quimica. S7 muestra que la actividad reciente se concentra en tres frentes vivos: el flujo de 14
fases, las matrices guia por categoria, y los bloques de data regulatoria.

**Su PENDIENTE:** corto a los ~13 minutos. Quedaron sin recorrer las 13 carpetas `Fase N`, 7 subcarpetas de
`Legal/` y 2 de `Presentaciones`.

---

### `02_MAPA_DATA.md` — que es canonico y que es ruido
**53 KB · 556 lineas · Fase 2**

Clasifica **131 filas** en cinco estados: **58 CANONICO, 33 DUPLICADO, 13 OBSOLETO, 19 DUDOSO, 8 FALTA**,
mas 12 de ruido. Organizado por dominio (vias de registro, matrices por categoria, flujo de 14 fases,
formularios, IEA, precios, legal, plantillas, marketing, ruido).

**Su hallazgo estructural:** las carpetas `Fase N` no son carpetas de proceso — **son una copia paralela
completa del arbol de Operaciones**. La Fase 10 contiene su propia `Matrices Definitivas para cliente` con
**10 de 10 categorias llenas**, mientras la de nivel superior tiene **6 de 10 vacias**. Lo canonico esta
enterrado y lo incompleto esta arriba.

Cierra los cuatro puntos abiertos de `PM_COMMENTS.md` (Z15, Z16, Z11/Z17, Z22), lista **las 8 filas FALTA**
—lo que el portal necesita y en el Drive no existe— e incluye una **propuesta de reorganizacion en cinco
bloques, NO ejecutada**.

**Lo mas util de aqui:** la tabla de las 8 FALTA. Es lo que hay que pedirle a Zelky, con nombre y apellido.

**Su PENDIENTE:** 12 de las 13 carpetas `Fase N` sin recorrer — declarado como **el hueco mas grande de toda
la cadena**, porque puede elevar bastante el conteo real de duplicados.

---

### `03_INSTRUCCIONES_DEV.md` — que puede hacer un developer manana
**25 KB · 193 lineas · Fase 3**

**17 tareas listas para ejecutar** (D01–D17), cada una con archivos que toca, **criterio de aceptacion
verificable** (un comando y su salida esperada, no "que funcione"), esfuerzo y riesgo. Mas **13 bloqueos**
(B01–B13) con quien los destraba, la pregunta exacta que hay que hacerle, y que se puede adelantar mientras
tanto. Mas un orden sugerido en siete bloques con la dependencia real de cada uno.

**Tres cosas que esta fase verifico contra el codigo y que contradicen lo que dicen los documentos:**
el endpoint de documentos **si existe y si esta montado** (descarta la primera hipotesis del bug report);
`TIPOS_MED` y `MED_VARIABLE_BY_SUBTYPE` **estan sincronizados hoy** (lo que falta es el guard);
y **no existe ningun enum de estados** — un admin puede escribir cualquier string en `status`.

Ademas detecto dos cosas que nadie habia registrado: **2,807 lineas sin commitear en una sola maquina**, y
que `seed_pricing.js` declara como fuente de precios **un archivo distinto** del que la Fase 2 declaro
canonico.

**Su PENDIENTE:** no se corrio el codigo (todo es lectura estatica), no se abrio `tracker/routes/mcp.js`
(553 lineas), y no se verifico `farmazed-web/admin/`.

---

### `04_ROADMAP.md` — el plan y las decisiones
**Fase 4 — este es el que Rick lee primero**

Cuatro etapas (**E1** piso tecnico · **E2** cerrar el flujo existente con R19 · **E3** el alcance nuevo que si
tiene insumo · **E4** lo bloqueado, partido en frente regulatorio y pasarela), cada una con alcance,
entregable, criterio de salida, dependencias tecnicas y de personas, y estimacion en semanas de developer
**declarada explicitamente como estimacion del PM y no como compromiso**.

Incluye: que entra en la primera entrega y que se posterga con su razonamiento; un mapa de dependencias en
texto; **5 decisiones para Rick** (cada una con opciones, recomendacion razonada y costo de no decidirla esta
semana); y las **preguntas para Zelky** consolidadas, separando las 5 que bloquean E1/E2 de las que no, y
sacando de la lista las que el Drive ya contesto (Z15, Z16, Z17, Z11 parcial, Z4).

**Su PENDIENTE:** las estimaciones no estan calibradas, E3 es la mas floja, no se estimo el esfuerzo de
**Zelky** (que esta en el camino critico de E4), y el roadmap no se cruzo contra `IMPLEMENTATION_PLAN.md` ni
`dev_build_order.md`.

---

## Orden de lectura recomendado

- **Rick:** `04` completo. De ahi, si algo no cuadra, bajar al artefacto que lo sustenta.
- **El developer:** `03` completo, y `04` solo la seccion de etapas y el mapa de dependencias.
- **Zelky:** `04` seccion "PREGUNTAS PARA ZELKY", y `02` la propuesta de reorganizacion y las 8 FALTA.

---

## Lo que esta cadena **no** hizo

- No toco Google Drive mas alla de leerlo.
- No toco ni una linea de codigo.
- No hizo ningun commit ni push — **y eso significa que estos cuatro archivos tambien estan sin versionar.**
  Entran en D01.
- No corrio el tracker, no llamo a ningun endpoint, no consulto Firestore.
- No abrio los dos archivos de credenciales.

---

*Indice de la cadena nocturna de cuatro fases. Documento del PM.*

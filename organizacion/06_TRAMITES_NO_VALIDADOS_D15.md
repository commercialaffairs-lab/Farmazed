# 06 — Los cuatro tramites sin matriz validada (Decision 2 / R1+Z3 / B10)

**Fecha:** 2026-09-20 · **Autor:** PM (Claude Opus, en Patch) · **Para:** Rick, antes de la reunion con Zelky
**Estado:** evidencia + palanca listas. **La decision NO esta tomada** — es de Rick con Zelky.

Alcance: higienicos, plaguicidas, excepcion, publicidad. Todo lo de abajo esta verificado leyendo el
codigo vivo en `Proyecto Farmazetd Regulatory/`, no el roadmap.

---

## 1. HALLAZGO VERIFICADO — que pasa hoy de verdad

### 1.1 Correccion al roadmap (esto es lo importante)

`04_ROADMAP.md:297-298` y `03_INSTRUCCIONES_DEV.md` (fila B10) afirman:

> *"hoy el portal hace de facto la (c) — **los muestra y bloquea con un toast**"*

**Eso es falso.** Los muestra, si. **No los bloquea.** No hay ningun toast, ningun aviso y ningun freno
para los cuatro tramites. El cliente los selecciona, avanza los cinco pasos, sube documentos y envia el
expediente a Farmazed, igual que si fueran medicamentos o cosmeticos.

El unico toast de bloqueo del wizard esta en `farmazed-web/portal/js/wizard.js:424-427`:

```js
if (state.data.tramiteType === 'medicamentos' && TIPOS_REGISTRO_SIN_FLUJO.includes(state.data.tipoRegistro)) {
  toast('Este tipo de trámite requiere gestión personalizada. Contáctenos directamente.', 'warning');
  return;
}
```

La condicion exige `tramiteType === 'medicamentos'`. Aplica al **selector de via** (Reconocimiento Mutuo /
Reconocimiento WLA dentro de medicamentos), **no** a la grilla de tramites. Higienicos, plaguicidas,
excepcion y publicidad nunca entran a ese `if`.

**Consecuencia para la reunion:** la opcion (c) "dejar como esta" no significa "muestra y avisa".
Significa **flujo completo, sin ninguna advertencia, sobre checklists que nadie del area regulatoria
valido**. La exposicion real es mayor que la que describe el roadmap, y eso cambia el peso de la decision.

### 1.2 Que ve y que puede hacer un cliente hoy, tramite por tramite

Ruta del codigo, identica para los cuatro:

1. **Paso 1 — aparece.** `wizard.js:25-32` declara los seis tramites en `TRAMITES`. `wizard.js:104`
   renderiza **todos** sin filtro: `grid.innerHTML = TRAMITES.map(t => ...)`. Los cuatro salen como
   tarjeta seleccionable, con icono y descripcion, al mismo nivel visual que medicamentos y cosmeticos.
2. **Se puede seleccionar.** `wizard.js:120-129`, handler de click: guarda `state.data.tramiteType` sin
   validar nada.
3. **Avanza.** `wizard.js:422-446`: la unica condicion que corta es `!state.data.tramiteType` (no elegiste
   nada). Despues llama `api.createCase(...)` y crea el caso en Firestore.
4. **El backend lo acepta.** `tracker/routes/cases.js:74-75` valida contra
   `TRAMITE_TYPES = ['medicamentos','cosmeticos','higienicos','plaguicidas','excepcion','publicidad']`
   (`tracker/data/faddi_checklists.js:289`). Los cuatro estan en la lista blanca. Se les asigna codigo de
   caso real: `TIPO_ABBR` en `cases.js:14-17` ya tiene `HIG`, `PLAG`, `EXC`, `PUB`.
5. **Recibe checklist.** `faddi_checklists.js:281-284` devuelve la lista no validada.
6. **Sube documentos y envia.** Paso 4 (`wizard.js:261-270`) y Paso 5 (`wizard.js:459-461`,
   `status: 'submitted'`).

| tramite | ¿aparece en Paso 1? | ¿seleccionable? | mensaje que recibe | ¿llega a armar expediente? | checklist que se le entrega |
|---|---|---|---|---|---|
| **Higienicos / Desinfectantes** | Si — tarjeta 🧼 (`wizard.js:28`) | Si | **Ninguno.** Cero avisos en todo el flujo | **Si, completo** hasta `submitted` | `HIG_DOCS`, **13 documentos**, 13 obligatorios (`faddi_checklists.js:168-184`) |
| **Plaguicidas** | Si — tarjeta 🌿 (`wizard.js:29`) | Si | **Ninguno** | **Si, completo** | `PLAG_DOCS`, **20 documentos** (`faddi_checklists.js:186-209`) — el mas pesado de los cuatro |
| **Excepcion al RS** | Si — tarjeta 🚨 (`wizard.js:30`) | Si | **Uno, pero no es sobre validacion.** `#excepcion-disclaimer` (`nuevo.html:128-131`, `client-dashboard.html:706`) dice: *"La Excepcion de Registro es una autorizacion temporal para importar un lote especifico. NO otorga Registro Sanitario permanente."* Es una aclaracion de alcance regulatorio, **no** un "contactanos" ni un "esto no esta validado" | **Si, completo** | `EXC_DOCS`, **8 documentos** (6 obligatorios, 2 condicionales) (`faddi_checklists.js:211-220`) |
| **Publicidad de Producto Registrado** | Si — tarjeta 📢 (`wizard.js:31`) | Si | **Ninguno** | **Si, completo** — ademas tiene campos propios de Paso 2 (`#tipo-pub-checks`, `wizard.js:181-191`; `TIPOS_PUBLICIDAD`, `wizard.js:52-54`) | `PUB_DOCS`, **3 documentos** (2 obligatorios) (`faddi_checklists.js:224-228`) |

**44 requisitos documentales** repartidos en los cuatro, ninguno validado por el area regulatoria.

### 1.3 Segunda correccion: D15 tal como esta escrito NO sirve para esta decision

`03_INSTRUCCIONES_DEV.md`, fila D15, y `04_ROADMAP.md:251` y `:302` dicen que D15 "construye exactamente
la palanca que esta decision va a accionar".

**No como esta redactado.** D15 dice literalmente: *"Convertir `TIPOS_REGISTRO` / `TIPOS_REGISTRO_SIN_FLUJO`
en una sola estructura declarativa"*. Esas dos constantes (`wizard.js:34` y `wizard.js:37`) son las **vias
de registro de medicamentos** — Regular / Abreviado / Mutuo / WLA / (WHO-PQP). Los cuatro tramites de esta
decision viven en **otro array**, `TRAMITES` (`wizard.js:25-32`), que D15 no menciona.

Si el developer ejecuta D15 al pie de la letra, Rick sale de la reunion con Zelky con una decision tomada
y **sin palanca para aplicarla**. El parche de la seccion 3 corrige esto: cubre las **dos** estructuras.

### 1.4 Riesgo que ya esta corriendo

- El bloqueo por `disponible: false` que se propone es **solo de front-end**. `cases.js:74` seguira
  aceptando los cuatro `tramiteType` por API. Un cliente con un `?caseId=` de un caso ya creado lo reabre
  (`wizard.js:507`). Hay que decidir si el corte tambien va al backend (ver seccion 4).
- El markup del Paso 1 esta **duplicado** en `farmazed-web/portal/nuevo.html` y
  `farmazed-web/client-dashboard.html` (ambos cargan el mismo `portal/js/wizard.js`:
  `nuevo.html:368`, `client-dashboard.html:1553`). El JS se toca una vez; **cualquier HTML nuevo se toca
  dos veces**. Esto encarece la opcion (b).

---

## 2. TABLA DE OPCIONES — que ve el cliente en cada escenario

Una fila por tramite. Las celdas describen la experiencia del cliente, no la implementacion.

| tramite | **(a) OCULTAR** | **(b) MOSTRAR CON AVISO "contactar a Farmazed"** | **(c) DEJAR COMO ESTA** |
|---|---|---|---|
| **Higienicos / Desinfectantes** | La tarjeta 🧼 no existe en el Paso 1. El cliente ve **4 tramites**, no 6. No hay explicacion de por que: simplemente no esta. Si necesita el tramite, tiene que buscar a Farmazed por fuera del portal (mail/telefono) — el portal no le dice que ese canal existe | Ve la tarjeta 🧼, la puede tocar. Al seleccionarla aparece un aviso: *"Este tramite requiere gestion personalizada. Contactanos."* Al pulsar Siguiente **no avanza** — no se crea caso, no ve checklist, no sube nada. Queda capturado como lead | Ve la tarjeta, la selecciona, avanza sin ningun aviso, recibe **13 requisitos obligatorios no validados** y arma el expediente completo creyendo que esa es la lista oficial |
| **Plaguicidas** | Igual: tarjeta 🌿 ausente. Cero senales en el portal | Igual: tarjeta visible, aviso al seleccionar, bloqueo al avanzar | Ve la tarjeta, avanza sin aviso, recibe **20 requisitos no validados** — la lista mas larga de los cuatro y por tanto la de mayor superficie de error |
| **Excepcion al RS** | Tarjeta 🚨 ausente. **Ojo:** el disclaimer de alcance temporal (`#excepcion-disclaimer`) queda muerto en el HTML; no molesta, pero hay que saber que quedo huerfano | Ve la tarjeta y **dos** mensajes: el disclaimer existente ("autorizacion temporal, NO otorga RS permanente") + el nuevo "contactanos". Hay que decidir si se muestran los dos o solo el nuevo, o el aviso se vuelve ruido | Ve la tarjeta, lee el disclaimer de alcance — que puede leerse como "el portal sabe de esto" — avanza y recibe **8 requisitos no validados**. Es el peor caso de los cuatro: el unico aviso existente **aumenta** la confianza en vez de moderarla |
| **Publicidad de Producto Registrado** | Tarjeta 📢 ausente. Los campos propios de Paso 2 (`#tipo-pub-checks`) quedan inalcanzables pero intactos — reversible | Tarjeta visible, aviso, bloqueo | Ve la tarjeta, avanza, recibe **3 requisitos no validados**. El riesgo unitario es el mas bajo (3 documentos, 2 obligatorios), pero es tambien el mas probable de usarse mal: es el tramite mas barato y mas frecuente |

**Lectura transversal:**

- **(a)** elimina el riesgo regulatorio por completo y **pierde el lead**: el cliente que buscaba higienicos
  se va sin saber que Farmazed lo gestiona.
- **(b)** conserva el lead y elimina el riesgo, pero es la unica de las tres que **hay que construir**
  (seccion 4). Es tambien la unica que le dice algo honesto al cliente.
- **(c)** es lo que esta pasando hoy sin que nadie lo haya decidido, y es **mas expuesto** de lo que el
  roadmap creia: sin toast, sin aviso, con 44 requisitos no validados entregados como si fueran oficiales.

---

## 3. QUE HAY QUE CONSTRUIR PARA LA OPCION (b) Y HOY NO EXISTE

Esta es la parte que cambia el costo. (a) y (c) son un booleano. (b) **no**.

| pieza | ¿existe hoy? | que falta |
|---|---|---|
| **Pantalla / bloque de aviso por tramite** | **NO.** Existe `#tipo-registro-contactenos` (`nuevo.html:102-104`) con el texto exacto que se querria — pero esta cableado al `<select id="tipoRegistro">`, que **solo se muestra dentro de medicamentos** (`wizard.js:115`, `#med-extra`). No hay ningun contenedor de aviso asociado a la grilla de tarjetas | Un `<div id="tramite-no-disponible">` nuevo en el Paso 1, **en los dos HTML** (`portal/nuevo.html` y `client-dashboard.html`), mas su sincronizacion en `renderStep1()` |
| **Bloqueo al pulsar Siguiente** | **NO** para tramites. El `if` de `wizard.js:424` filtra por `tramiteType === 'medicamentos'` | Extender la guarda de `nextStep()` (incluido en el diff, seccion 4) |
| **Texto del aviso, por tramite** | **NO.** El unico texto "contactanos" que existe es generico y esta escrito para vias de medicamentos | Copy aprobado. Si el aviso es identico para los cuatro, es 1 texto; si Zelky quiere matizar por tramite, son 4. **Decision de Rick+Zelky, no del developer** |
| **Convivencia con el disclaimer de excepcion** | Conflicto abierto | Decidir si en `excepcion` se muestran los dos bloques, solo el nuevo, o se fusionan |
| **Captura del lead** | **NO existe nada.** Hoy un cliente que ve un aviso y no puede avanzar **no deja rastro**: no se crea caso, no hay formulario de contacto, no hay evento. El valor comercial de (b) frente a (a) es precisamente el lead — y sin captura, (b) entrega casi lo mismo que (a) | Como minimo un mailto/telefono visible en el aviso. Idealmente un mini-form (nombre, mail, tramite) → esto **no** es un booleano, es una historia de usuario completa con endpoint nuevo |

**Estimacion comparada:**

- **(a) ocultar** — parche D15 ampliado y nada mas. 4 valores `disponible: false`. **S.**
- **(c) dejar como esta** — cero codigo. Pero conviene aplicar igual el parche D15 (con los cuatro en
  `true`) para tener la palanca lista el dia que se decida distinto.
- **(b) avisar** — parche D15 **+** markup nuevo en 2 archivos **+** guarda en `nextStep()` **+** copy
  aprobado **+** (si se quiere el lead de verdad) captura de contacto. **M, y con una dependencia de
  contenido que no es del developer.**

**Nota para la reunion:** (b) sin captura de lead cuesta mas que (a) y entrega casi el mismo resultado
comercial. Si Rick quiere (b), la pregunta util para Zelky es *"¿que le decimos exactamente al cliente y
por donde queremos que nos contacte?"* — esa respuesta es la que hace que (b) valga la diferencia.

---

## 4. PARCHE D15 (AMPLIADO) — DIFF, NO APLICADO

> **No aplicado.** No se toco ningun archivo del arbol de codigo. Reglas de la corrida: sin edicion,
> sin commit, sin push.
>
> Difiere de D15 tal como esta en `03_INSTRUCCIONES_DEV.md`: **cubre tambien `TRAMITES`**, porque sin eso
> la Decision 2 no tiene palanca (ver 1.3).

### 4.1 ANTES — `farmazed-web/portal/js/wizard.js:24-37`

```js
// ── FADDI Tramite metadata ─────────────────────────────────────────────────────
const TRAMITES = [
  { id: 'medicamentos', label: 'Medicamentos',                          icon: '💊', desc: '...' },
  { id: 'cosmeticos',   label: 'Cosméticos y Similares',               icon: '🧴', desc: '...' },
  { id: 'higienicos',   label: 'Higiénicos / Desinfectantes',          icon: '🧼', desc: '...' },
  { id: 'plaguicidas',  label: 'Plaguicidas',                           icon: '🌿', desc: '...' },
  { id: 'excepcion',    label: 'Excepción al Registro Sanitario',      icon: '🚨', desc: '...' },
  { id: 'publicidad',   label: 'Publicidad de Producto Registrado',    icon: '📢', desc: '...' },
];

const TIPOS_REGISTRO = ['Regular', 'Abreviado', 'Reconocimiento Mutuo', 'Reconocimiento WLA'];
// These two have no differentiated flow in the wizard yet — the client is
// directed to contact Farmazed directly instead of continuing.
const TIPOS_REGISTRO_SIN_FLUJO = ['Reconocimiento Mutuo', 'Reconocimiento WLA'];
```

Dos fuentes de verdad distintas: un array de objetos (tramites) y **dos** arrays de strings acoplados por
convencion (vias). WHO-PQP no existe en ninguna parte del codigo — se verifico:
`grep -rn "WHO\|PQP\|Precalific" tracker/ farmazed-web/ --include=*.js --include=*.html` solo devuelve
`seed_pricing.js:82` (`'Mutuo Acuerdo / WLA WHO'`, que es un grupo de precio, no una via del wizard) y dos
menciones de "OMS Precalificados" dentro del panel de paises de Abreviado.

### 4.2 DESPUES — diff

```diff
--- a/farmazed-web/portal/js/wizard.js
+++ b/farmazed-web/portal/js/wizard.js
@@ -23,18 +23,63 @@
-// ── FADDI Tramite metadata ─────────────────────────────────────────────────────
-const TRAMITES = [
-  { id: 'medicamentos', label: 'Medicamentos',                          icon: '💊', desc: 'Síntesis química, biológicos, homeopáticos, huérfanos y demás.' },
-  { id: 'cosmeticos',   label: 'Cosméticos y Similares',               icon: '🧴', desc: 'Cremas, shampoos, maquillaje, protectores solares, etc.' },
-  { id: 'higienicos',   label: 'Higiénicos / Desinfectantes',          icon: '🧼', desc: 'Antisépticos, desinfectantes de uso doméstico u hospitalario.' },
-  { id: 'plaguicidas',  label: 'Plaguicidas',                           icon: '🌿', desc: 'Uso doméstico o profesional (químico, biológico, otro).' },
-  { id: 'excepcion',    label: 'Excepción al Registro Sanitario',      icon: '🚨', desc: 'Calamidad, razón humanitaria, desabasto o investigación.' },
-  { id: 'publicidad',   label: 'Publicidad de Producto Registrado',    icon: '📢', desc: 'Aprobación de material publicitario de un RS vigente.' },
-];
-
-const TIPOS_REGISTRO = ['Regular', 'Abreviado', 'Reconocimiento Mutuo', 'Reconocimiento WLA'];
-// These two have no differentiated flow in the wizard yet — the client is
-// directed to contact Farmazed directly instead of continuing.
-const TIPOS_REGISTRO_SIN_FLUJO = ['Reconocimiento Mutuo', 'Reconocimiento WLA'];
+// ── FADDI Tramite metadata ─────────────────────────────────────────────────────
+// D15 — ESTRUCTURA DECLARATIVA UNICA.
+//
+//   disponible: false  → el trámite/vía NO se renderiza en el Paso 1.
+//   disponible: true   → se renderiza.
+//
+// Encender o apagar una vía es cambiar UN valor aquí. Ninguna función de
+// render se toca: todas leen de estas dos listas y de los derivados de abajo.
+//
+// `flujoPropio: false` significa "se muestra, pero no avanza: el cliente va a
+// gestión personalizada". Es independiente de `disponible`.
+const TRAMITES = [
+  { id: 'medicamentos', label: 'Medicamentos',                       icon: '💊', desc: 'Síntesis química, biológicos, homeopáticos, huérfanos y demás.',  disponible: true,  flujoPropio: true },
+  { id: 'cosmeticos',   label: 'Cosméticos y Similares',            icon: '🧴', desc: 'Cremas, shampoos, maquillaje, protectores solares, etc.',          disponible: true,  flujoPropio: true },
+  // ── Decisión 2 (R1+Z3 / B10) — checklist construido leyendo decretos, SIN
+  // validación del área regulatoria. El valor de `disponible` y `flujoPropio`
+  // de estos cuatro lo fija Rick con Zelky; aquí quedan como están hoy
+  // (visibles y con flujo completo) para que el parche NO cambie el
+  // comportamiento por sí solo. Ver organizacion/06_TRAMITES_NO_VALIDADOS_D15.md
+  //   (a) ocultar  → disponible: false
+  //   (b) avisar   → disponible: true,  flujoPropio: false
+  //   (c) como está→ disponible: true,  flujoPropio: true
+  { id: 'higienicos',   label: 'Higiénicos / Desinfectantes',       icon: '🧼', desc: 'Antisépticos, desinfectantes de uso doméstico u hospitalario.',    disponible: true,  flujoPropio: true },
+  { id: 'plaguicidas',  label: 'Plaguicidas',                        icon: '🌿', desc: 'Uso doméstico o profesional (químico, biológico, otro).',          disponible: true,  flujoPropio: true },
+  { id: 'excepcion',    label: 'Excepción al Registro Sanitario',   icon: '🚨', desc: 'Calamidad, razón humanitaria, desabasto o investigación.',         disponible: true,  flujoPropio: true },
+  { id: 'publicidad',   label: 'Publicidad de Producto Registrado', icon: '📢', desc: 'Aprobación de material publicitario de un RS vigente.',            disponible: true,  flujoPropio: true },
+];
+
+// Vías de registro (solo aplican a `medicamentos`).
+//   paisesARR: muestra el panel informativo de países (D.E. 29/2023).
+const VIAS_REGISTRO = [
+  { id: 'Regular',              label: 'Regular',              disponible: true,  flujoPropio: true,  paisesARR: false },
+  { id: 'Abreviado',            label: 'Abreviado',            disponible: true,  flujoPropio: true,  paisesARR: true  },
+  { id: 'Reconocimiento Mutuo', label: 'Reconocimiento Mutuo', disponible: true,  flujoPropio: false, paisesARR: true  },
+  { id: 'Reconocimiento WLA',   label: 'Reconocimiento WLA',   disponible: true,  flujoPropio: false, paisesARR: false },
+  // 5.ª vía — B01/Z17. La Fase 2 verificó el Drive completo: NO existe matriz,
+  // ni borrador, ni notas de WHO-PQP. Queda declarada y apagada: el día que
+  // Zelky entregue la matriz, esto es `disponible: true` y nada más.
+  { id: 'WHO-PQP',              label: 'Reconocimiento WHO-PQP', disponible: false, flujoPropio: false, paisesARR: false },
+];
+
+// ── Derivados. Nadie más filtra por su cuenta; todo sale de aquí. ─────────────
+const tramitesVisibles = () => TRAMITES.filter(t => t.disponible);
+const viasVisibles     = () => VIAS_REGISTRO.filter(v => v.disponible);
+const getTramite       = id => TRAMITES.find(t => t.id === id) || null;
+const getVia           = id => VIAS_REGISTRO.find(v => v.id === id) || null;
+
+// Compatibilidad con el resto del archivo: mismos nombres, mismo contenido,
+// ahora derivados en vez de escritos a mano en dos sitios.
+const TIPOS_REGISTRO           = viasVisibles().map(v => v.id);
+const TIPOS_REGISTRO_SIN_FLUJO = VIAS_REGISTRO.filter(v => !v.flujoPropio).map(v => v.id);
+const TIPOS_REGISTRO_CON_PAISES = VIAS_REGISTRO.filter(v => v.paisesARR).map(v => v.id);
@@ -102,7 +147,7 @@ function renderStep1() {
   const grid = $('#tramite-grid');
-  grid.innerHTML = TRAMITES.map(t => `
+  grid.innerHTML = tramitesVisibles().map(t => `
     <div class="col-md-4 col-sm-6">
       <label class="tramite-card ${state.data.tramiteType === t.id ? 'selected' : ''}" data-id="${t.id}">
@@ -138,11 +183,7 @@ function renderStep1() {
-    // Gap E (auditoría regulatoria PM 2026-08-26): panel informativo con los
-    // países habilitados para Abreviado/Reconocimiento Mutuo (D.E. 29/2023).
-    // No es un bloqueante — el cliente solo lo usa para autoevaluar elegibilidad
-    // antes de completar el trámite; Farmazed confirma en el diagnóstico real.
-    const TIPOS_REGISTRO_CON_PAISES = ['Abreviado', 'Reconocimiento Mutuo'];
+    // Gap E (auditoría regulatoria PM 2026-08-26): panel informativo de países
+    // habilitados (D.E. 29/2023). Ahora sale del flag `paisesARR` de VIAS_REGISTRO.
     const syncContactenos = () => {
@@ -420,10 +461,20 @@ async function nextStep() {
     if (state.step === 1) {
       if (!state.data.tramiteType) { toast('Selecciona el tipo de trámite.', 'warning'); return; }
-      if (state.data.tramiteType === 'medicamentos' && TIPOS_REGISTRO_SIN_FLUJO.includes(state.data.tipoRegistro)) {
+      // Guarda 1 — trámite apagado. Cubre el caso de un ?caseId= antiguo cuyo
+      // trámite ya no está disponible: la tarjeta no se ve, pero el estado
+      // restaurado (wizard.js:507) sí la trae.
+      const tramite = getTramite(state.data.tramiteType);
+      if (!tramite || !tramite.disponible) {
+        toast('Este trámite no está disponible en el portal. Contáctanos y un especialista de Farmazed te guiará.', 'warning');
+        return;
+      }
+      // Guarda 2 — trámite visible pero sin flujo propio (opción (b)).
+      if (!tramite.flujoPropio) {
+        toast('Este trámite requiere gestión personalizada. Contáctenos directamente.', 'warning');
+        return;
+      }
+      // Guarda 3 — vía de medicamentos sin flujo propio (comportamiento actual).
+      if (state.data.tramiteType === 'medicamentos' && TIPOS_REGISTRO_SIN_FLUJO.includes(state.data.tipoRegistro)) {
         toast('Este tipo de trámite requiere gestión personalizada. Contáctenos directamente.', 'warning');
         return;
       }
```

### 4.3 Demostracion: apagar una via la quita del Paso 1 sin tocar ninguna funcion de render

El Paso 1 dibuja dos cosas, y **solo dos**, desde estas listas:

1. **La grilla de tramites.** Unico punto de render: `wizard.js:104`,
   `grid.innerHTML = TRAMITES.map(...)`. El parche lo cambia a `tramitesVisibles().map(...)`.
   `tramitesVisibles()` es `TRAMITES.filter(t => t.disponible)`. Poner `disponible: false` en
   `higienicos` hace que el objeto no entre al `.map()`, no se genere el `<div class="col-md-4">`, y la
   tarjeta no exista en el DOM. **El cuerpo del template literal no se toca.**
   Verificado que no hay otro consumidor de `TRAMITES`:
   `grep -n "TRAMITES" farmazed-web/portal/js/wizard.js` → solo `25` (declaracion) y `104` (render).

2. **El `<select id="tipoRegistro">`.** Unico punto de render: `wizard.js:135`,
   `tipoRegSelect.innerHTML = TIPOS_REGISTRO.map(t => ...)`. Esa linea **no cambia en el diff**: lo que
   cambia es que `TIPOS_REGISTRO` pasa de ser una constante escrita a mano a ser
   `viasVisibles().map(v => v.id)`. Con WHO-PQP en `disponible: false`, no aparece en el `<select>`.
   Poner `disponible: false` en `'Reconocimiento Mutuo'` lo borra del desplegable, tambien sin tocar la
   linea 135.

**Prueba de aceptacion (la de D15, ampliada a tramites):**

| paso | accion | resultado esperado |
|---|---|---|
| 1 | `VIAS_REGISTRO` → `'Reconocimiento Mutuo'` a `disponible: false`, recargar `/portal/nuevo.html` | El `<select>` de Tipo de Procedimiento muestra 3 opciones: Regular, Abreviado, Reconocimiento WLA |
| 2 | Volverlo a `true`, recargar | Vuelven las 4. Ningun otro cambio |
| 3 | `TRAMITES` → `'higienicos'` a `disponible: false`, recargar | El Paso 1 muestra **5 tarjetas**; 🧼 no esta en el DOM |
| 4 | Con higienicos apagado, abrir un `?caseId=` de un caso higienicos previo y pulsar Siguiente | Toast *"Este trámite no está disponible…"*, no avanza (Guarda 1) |
| 5 | `'higienicos'` → `disponible: true, flujoPropio: false`, recargar | La tarjeta 🧼 vuelve, se selecciona, pero Siguiente muestra el toast de gestion personalizada (Guarda 2) |
| 6 | Verificar WHO-PQP | No aparece en el `<select>` en ningun momento, y su linea existe en el codigo |

En los seis pasos, los archivos tocados son **cero**: solo cambian valores dentro de las dos listas.
`renderStep1()`, `renderStep2()`, `syncContactenos()` y el `<select>` quedan igual.

### 4.4 Lo que este parche NO hace (y hay que decidir aparte)

- **No corta el backend.** `tracker/routes/cases.js:74` sigue aceptando los seis `tramiteType` via API
  directa. Para (a) estricto hay que espejar el flag en `faddi_checklists.js:289` (`TRAMITE_TYPES`) o
  filtrar en `cases.js`. **Recomendacion: hacerlo.** El front-end es una cortesia, no un control.
- **No crea el bloque de aviso de la opcion (b).** El diff aporta el *toast*; la opcion (b) descrita en la
  reunion habla de un aviso persistente en pantalla. Eso es markup nuevo en dos HTML (seccion 3).
- **No resuelve el disclaimer de `excepcion`.** `#excepcion-disclaimer` sigue cableado por id en
  `wizard.js:116` y `:129`. Si se decide (a) para excepcion, queda huerfano (inofensivo). Si se decide
  (b), hay que decidir si convive con el aviso nuevo.
- **No toca precios.** `seed_pricing.js` mantiene sus grupos; apagar un tramite en el wizard no altera la
  coleccion de precios.

---

## 5. LA PREGUNTA PARA ZELKY, CORREGIDA

B10 en `03_INSTRUCCIONES_DEV.md` propone preguntar sobre un portal que "muestra y bloquea con un toast".
Ese portal no existe. La pregunta honesta es:

> *"Hoy el portal deja que un cliente arme y envie un expediente completo de higienicos, plaguicidas,
> excepcion y publicidad — 44 requisitos documentales en total — sin ningun aviso, con checklists que
> construimos leyendo decretos y que tu no validaste. ¿Los apagamos hasta tener matriz, los dejamos
> visibles con un 'contactanos', o los validas tu?"*

Y la de cierre, que decide el costo de (b):

> *"Si elegimos el aviso: ¿que texto exacto ve el cliente, y por donde queremos que nos contacte?"*

---

## 6. PENDIENTE

Lo que no alcance a hacer en esta corrida:

- **No revise `farmazed-web/client-dashboard.html` linea por linea.** Confirme que carga el mismo
  `portal/js/wizard.js` (`:1553`) y que replica los ids del Paso 1 (`#tramite-grid`,
  `#excepcion-disclaimer`, `#tipo-registro-contactenos`), pero no verifique que **todo** el markup del
  Paso 2 este duplicado identico. Si hay divergencia, la opcion (b) puede costar mas de lo estimado.
- **No verifique el origen regulatorio de los 44 requisitos.** El documento afirma que no estan validados
  porque lo dice la Fase 2; no contrasté cada `faddiCode` contra decreto. Eso es trabajo de Zelky.
- ~~No revise `tracker/routes/mcp.js`~~ — **cerrado**: revisado. Solo expone lectura
  (`farmazed_list_cases`, `mcp.js:32-38`, y consultas de checklist/documentos). **No crea casos**, asi que
  el corte de backend de 4.4 solo necesita cubrir `tracker/routes/cases.js:74`.
- **El diff no fue probado ejecutando el portal.** Es correcto por lectura (los consumidores de `TRAMITES`
  y `TIPOS_REGISTRO` estan todos identificados por grep), pero no corri el wizard. La tabla de 4.3 es la
  prueba que hay que ejecutar antes de dar D15 por cerrado.
- **No propuse el copy del aviso de (b).** Es contenido que Zelky tiene que aprobar, no PM.

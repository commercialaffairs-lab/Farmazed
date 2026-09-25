# 05 — DIFF DE PRECIOS (D09)

`tracker/seed_pricing.js` vs. xlsx canonico de Drive
Corrida: 2026-09-20 · PM Farmazed (Patch) · Drive en SOLO LECTURA

---

## VEREDICTO (3 lineas)

1. **No hay dos xlsx que comparar: el archivo que el seed dice usar (`1D--X1LzONtN_iNRQ1095D0Bid87FApti`) NO existe o no es accesible** — Drive responde `Requested entity was not found`, y una busqueda full-text en todo el Drive devuelve un solo archivo con ese contenido: el canonico `1ZRmJ6Z0T5CbVoMppVB0ACtQlQB7WqhuK` ("- copia", 12 sept). El comentario de la linea 28 del seed apunta a un fantasma.
2. **5 de los 13 ids difieren del canonico**: `med_abreviado_huerfano` (+150), `intercambiabilidad` (+200), `modificacion_expedicion` (−1,100), `renovacion` (−1,300), `post_rs_modificacion` (−400). Los otros 8 coinciden al balboa.
3. **El seed cobra de MENOS en neto: −B/.1,650** (cobra B/.750 de mas en 3 tramites y B/.2,400 de menos en 2 tramites). El sesgo no es aleatorio: **Expedicion y Renovacion del seed estan subfacturados porque omiten honorarios de abogado y gastos de tramite**, que el xlsx si cobra.

> **Correccion de Argus (GM), 2026-09-20.** El PM escribio −B/.2,450 contando `post_rs_modificacion` como −400. Es al reves: seed 1,000 vs xlsx 600 = el seed cobra **+400 de mas** (su propia seccion de detalle lo dice bien). Recalculado: +150 +200 +400 −1,100 −1,300 = **−B/.1,650**. Los 13 totales del seed fueron recomputados de forma independiente desde el codigo y coinciden uno a uno con la tabla de abajo; el unico error era el signo en el neto.

> No adjudico cual precio gana. Eso lo decide Rick (F-4 / Decision 4).

---

## TABLA — 13 ids

Montos en B/. (Balboa = USD). "Monto en seed" = suma de los 8 `components`.

| # | id | Seed | xlsx canonico (12 sept) | xlsx citado por el seed | Coincide |
|---|----|------|-------------------------|--------------------------|----------|
| 1 | `med_abreviado_sintesis` | 4,580 | **4,580** | ❌ ilegible | **S** |
| 2 | `med_abreviado_biologico` | 4,580 | **4,580** | ❌ ilegible | **S** |
| 3 | `med_abreviado_suplemento` | 4,580 | **4,580** | ❌ ilegible | **S** |
| 4 | `med_abreviado_mutuo_acuerdo` | 4,580 | **4,580** | ❌ ilegible | **S** |
| 5 | `med_abreviado_huerfano` | 4,580 | **4,430** | ❌ ilegible | **N (+150)** |
| 6 | `med_regular_sintesis` | 3,930 | **3,930** | ❌ ilegible | **S** |
| 7 | `med_regular_natural` | 3,930 | **3,930** | ❌ ilegible | **S** |
| 8 | `med_regular_huerfano` | 3,080 | **3,080** | ❌ ilegible | **S** |
| 9 | `intercambiabilidad` | 4,030 | **3,830** | ❌ ilegible | **N (+200)** |
| 10 | `modificacion_expedicion` | 1,300 | **2,400** (rango bloque 1,800–3,100) | ❌ ilegible | **N (−1,100)** |
| 11 | `renovacion` | 1,300 | **2,600** (rango bloque 2,150–3,050) | ❌ ilegible | **N (−1,300)** |
| 12 | `post_rs_modificacion` | 1,000 | **600** (rango bloque 410–600) | ❌ ilegible | **N (+400)** |
| 13 | `cambio_rep_legal` | 425 | **425** | ❌ ilegible | **S** (total; composicion distinta) |

**Coinciden: 8 / 13. Difieren: 5 / 13.**
Delta neto seed − canonico: **−B/.1,650**. *(corregido por Argus; el PM habia escrito −2,450)*

---

## LAS TRES RESPUESTAS

**(a) ¿Los dos xlsx son el mismo contenido con distinto id, o difieren de verdad?**
Ninguna de las dos: **el segundo xlsx no se pudo abrir**. `get_file_metadata` sobre `1D--X1LzONtN_iNRQ1095D0Bid87FApti` devolvio el error literal `Requested entity was not found.` — el id no existe, fue borrado, o nunca estuvo compartido con `pimentelmarinricardo@gmail.com`. Ademas, una busqueda full-text en todo el Drive del usuario (`fullText contains 'precios para la plataforma'`) devolvio **un unico** archivo con esa tabla — el canonico — y el inventario de la Fase 2 (`01_INVENTARIO_DRIVE.md:360`) tampoco lista ningun otro xlsx de precios. La hipotesis "son el mismo archivo con distinto id" **no se pudo confirmar ni descartar**; lo unico verificado es que el id que el seed cita hoy no resuelve a nada.

**(b) ¿Cuantos de los 13 difieren, y cuales?**
**5 de 13**: `med_abreviado_huerfano`, `intercambiabilidad`, `modificacion_expedicion`, `renovacion`, `post_rs_modificacion`.

**(c) ¿El seed cobra de mas o de menos, y por cuanto?**
**De menos en neto, por B/.1,650 por juego completo de los 13 tramites.** Desglosado:
- Cobra **de MAS**: +B/.750 total (huerfano abreviado +150, intercambiabilidad +200, post-RS +400).
- Cobra **de MENOS**: −B/.2,400 total (expedicion −1,100, renovacion −1,300).

---

## DETALLE POR ID QUE DIFIERE

### 5. `med_abreviado_huerfano` — seed 4,580 vs xlsx 4,430 (seed +150)
Una sola componente difiere:

| componente | seed | xlsx |
|---|---|---|
| tasa_dnfd_servicio | **200** | **50** |

Todo lo demas es identico (1,200 / 250 / 605 / refrendo 50 / producto 750 / IEA 1,500 / MEF 25).
Contexto para Rick: en el xlsx **todos los demas** procedimientos abreviados llevan `tasa x servicio DNFD = 200`; solo huerfanos lleva 50. Puede ser un beneficio real de medicamentos huerfanos o un typo en la celda. El propio seed ya trae la nota `"DNFD trámite puede diferir — verificar con Zelky"` en este id. **No adjudico.**

### 9. `intercambiabilidad` — seed 4,030 vs xlsx 3,830 (seed +200)
| componente | seed | xlsx |
|---|---|---|
| tasa_dnfd_servicio | 200 | **250** |
| tasa_dnfd_tramite (tasa x producto) | 650 | **400** |
| refrendo_cnf | 0 | 0 (celda vacia) |

Honorarios (800), abogado (250), gastos (605), IEA (1,500) y MEF (25) coinciden. El seed reparte 850 entre servicio+producto donde el xlsx reparte 650. El seed ya trae la nota `"Tasas DNFD: confirmar con Zelky al momento del trámite"`.
Dato cruzado: mas abajo en el mismo xlsx, la fila *"Certificado de Intercambiabilidad bajo la condición de medicamento de referencia o intercambiable"* (bloque Expedicion) da **2,300** — es otro tramite, no el mismo; lo anoto para que no se confunda al adjudicar.

### 10. `modificacion_expedicion` — seed 1,300 vs xlsx 2,400 (seed −1,100)
Aqui la diferencia **no es una tasa: es estructural.** El seed pone a cero abogado y gastos de tramite:

| componente | seed | xlsx (fila "Expedición ... síntesis química") |
|---|---|---|
| honorarios_farmazed | 800 | 800 |
| honorarios_abogado | **0** | **250** |
| gastos_adicionales | **0** | **650** |
| tasa_dnfd_servicio | **0** | **200** |
| tasa_dnfd_tramite | 500 | 500 |
| **total** | **1,300** | **2,400** |

El bloque "Modificaciones" del xlsx tiene **12 filas de Expedicion**, con totales de **1,800 a 3,100**:
1,800 (huerfanos) · 2,300 (cosmeticos +10 variedades; intercambiabilidad) · 2,400 (sintesis quimica) · 2,600 (similares e higiene personal; cosmeticos hasta 10; fuentes alternas; otros productos/plaguicidas; reconocimiento mutuo) · 2,850 (innovadores/biologicos/biosimilares; tramite abreviado) · 3,100 (prioridad de tramite).
**El seed colapsa 12 tramites distintos en un solo id de 1,300.** Su propia nota dice `"Total orientativo B/.1,300–1,750"`, rango que **no aparece en ninguna parte del xlsx canonico**.

### 11. `renovacion` — seed 1,300 vs xlsx 2,600 (seed −1,300)
Mismo patron estructural:

| componente | seed | xlsx (fila "Renovación ... síntesis química") |
|---|---|---|
| honorarios_farmazed | 800 | **1,000** |
| honorarios_abogado | **0** | **250** |
| gastos_adicionales | **0** | **650** |
| tasa_dnfd_servicio | **0** | **200** |
| tasa_dnfd_tramite | 500 | 500 |
| **total** | **1,300** | **2,600** |

El bloque "Tasa por Servicio de Renovacion" del xlsx tiene **8 filas**, totales de **2,150 a 3,050**:
2,150 (renovacion de intercambiabilidad) · 2,400 (otros productos/plaguicidas) · 2,450 (reconocimiento mutuo) · 2,600 (sintesis quimica; cosmeticos/similares/higiene; fuentes alternas) · 2,850 (innovadores/biologicos/biosimilares) · 3,050 (tramite abreviado).
La nota del seed dice `"Total orientativo B/.1,050–1,950"` — de nuevo, **un rango que no existe en el xlsx canonico**. Ningun renovacion del xlsx baja de 2,150.

### 12. `post_rs_modificacion` — seed 1,000 vs xlsx 600 (seed +400) — *esta seccion siempre estuvo bien; el error estaba en el resumen*
| componente | seed | xlsx (fila tipica del bloque "Tasa por Servicio de Modificación") |
|---|---|---|
| honorarios_farmazed | **800** | **50** |
| honorarios_abogado | 0 | **250** |
| Modificaciones (columna propia del xlsx, sin equivalente en el seed) | — | **100** |
| tasa_dnfd_tramite | **200** | 200 |
| **total** | **1,000** | **600** |

El bloque tiene **28 filas** de modificaciones menores. **26 de ellas dan 600** (Ampliacion de presentacion, cambio de nombre comercial, razon social, monografia/inserto, vida util, almacenamiento, empacador primario/secundario, material de empaque, titular, origen/fabricante, modalidad de venta, excipientes, etiquetado, sitio de fabricacion, representante legal o prof. responsable, especificaciones, metodologia analitica, indicaciones terapeuticas, co-empaques, vias de administracion, fabricante del diluyente, denominacion del principio activo, otros cambios...); **2 dan 425** y **1 (huerfanos) da 410**.
Ojo: el xlsx tiene una columna llamada **`Modificaciones` (B/.100)** que el seed **no modela en ninguno de sus 8 `components`**.

### 13. `cambio_rep_legal` — total coincide (425 = 425), composicion NO
| componente | seed | xlsx ("Cambio del Representante Legal que reside en el país autorizado por el titular") |
|---|---|---|
| honorarios_farmazed | **400** | **50** |
| honorarios_abogado | **0** | **250** |
| Modificaciones | — | **100** |
| tasa_dnfd_tramite | 25 | 25 |
| **total** | **425** | **425** |

El total al cliente es el mismo, pero **el reparto interno es completamente distinto**: el seed se atribuye 400 de honorarios Farmazed donde el xlsx reparte 50 Farmazed + 250 abogado + 100 modificaciones. Si el portal muestra el desglose al cliente (la UI `precios.html` lo hace por componente), **el cliente vera un desglose que no corresponde a la realidad del gasto**. Marcado S en la tabla porque el criterio de D09 es el monto, pero Rick deberia saberlo.
La fila gemela *"Cambio del Profesional responsable autorizado por el titular"* tambien da 425, asi que el merge de los dos tramites en un solo id es consistente en monto.

---

## HALLAZGOS ADICIONALES (no pedidos, pero son dinero)

1. **El IEA esta hardcodeado en el piso del rango.** La fila de cabecera del xlsx canonico lleva, justo sobre la columna IEA, la anotacion **`"1,500 a 2,250"`**. Los 13 ids del seed que llevan IEA usan **siempre 1,500**, es decir el minimo. Si el IEA real de un tramite sale en 2,250, el seed subfactura **B/.750 adicionales** en ese tramite — y eso aplica a los 9 ids de Registros Nuevos, no a los 5 ya listados como divergentes. Esto **no esta contado** en el −1,650 de arriba.

2. **Merges de 1-a-muchos sin registro.** Cuatro ids del seed colapsan varias filas del xlsx:
   - `med_abreviado_suplemento` ← Suplementos Vitaminicos + Homeopaticos + Radiofarmacos (los 3 a 4,580 — merge seguro).
   - `med_abreviado_mutuo_acuerdo` ← Mutuo Acuerdo + Abreviado WLA WHO (ambos 4,580 — merge seguro).
   - `med_regular_natural` ← Productos Naturales + Gases Medicinales + Medicamentos de Contraste (los 3 a 3,930 — merge seguro).
   - `modificacion_expedicion` (12 filas, 1,800–3,100) y `renovacion` (8 filas, 2,150–3,050) — **merges NO seguros**: colapsan rangos de >1,200 B/. de amplitud en un precio unico.

3. **El comentario del seed (linea 26-28) es doblemente incorrecto**: cita un fileId que no resuelve, y lo ubica en una carpeta `Costos`; el canonico vive en **`Cotizaciones`** (folder id `1VCQCmJ6v1btYF555HznkqRzZBEhSZejd`, de zelkymarin30@gmail.com).

---

## PROPUESTA DE PARCHE (NO APLICADA — solo texto, segun instruccion)

Minimo indispensable para que el comentario del seed deje de mentir. **No cambia ni un monto** — la decision de montos es de Rick (F-4).

```diff
--- a/tracker/seed_pricing.js
+++ b/tracker/seed_pricing.js
@@ -24,8 +24,12 @@
 // ─── Price table ─────────────────────────────────────────────────────────────
 // All amounts in Panamanian Balboas (B/. = USD).
-// Source: "Actualización de nuestros precios para la plataforma.xlsx"
-//         Drive > Costos > fileId: 1D--X1LzONtN_iNRQ1095D0Bid87FApti
+// Source: "Actualización de nuestros precios para la plataforma - copia.xlsx"
+//         Drive > Cotizaciones > fileId: 1ZRmJ6Z0T5CbVoMppVB0ACtQlQB7WqhuK
+//         (mod. 2026-09-12, owner zelkymarin30@gmail.com)
+// OJO: el fileId citado antes aqui (1D--X1Lz…) no resuelve en Drive.
+// Diff seed↔xlsx al 2026-09-20: 5 de 13 ids divergen. Ver
+// organizacion/05_DIFF_PRECIOS_D09.md. Montos pendientes de decision (F-4).
```

---

## PENDIENTE

- **D08 — ¿el seed corrio en produccion?** No verificado y **no verificable en esta corrida**: requiere leer la coleccion `pricing` de Firestore, y ese acceso Rick todavia no lo dio. Tal como quedo instruido, **no toque Firestore**. Mientras esto no se resuelva no se sabe si los montos divergentes de arriba estan **solo en el repo** o **ya sirviendose a clientes**, que es lo que convierte a F-4 en riesgo de dinero real o en un simple cambio de archivo.
- **Rastrear el fileId fantasma `1D--X1LzONtN_iNRQ1095D0Bid87FApti`.** Solo Zelky (`zelkymarin30@gmail.com`, dueña de la carpeta) puede decir si ese archivo existio, si es el ancestro del "- copia", o si el id se tecleo mal al escribir el seed. Determina si el "- copia" es realmente una copia (y de que) o el original renombrado.
- **Verificar la columna `Modificaciones` (B/.100) del xlsx.** No tiene equivalente en el esquema de 8 `components` del seed ni en la UI `precios.html`. Si es un cobro real, falta modelarla.
- **Confirmar el rango del IEA (1,500–2,250)** y si el portal debe cobrarlo fijo o variable. Es la exposicion mas grande que encontre y no entra en el neto de −1,650.
- **Comparar contra un tercer origen.** No revise si `farmazed-web/` o la UI `precios.html` del Drive traen montos hardcodeados propios; si los traen, habria un tercer juego de precios en circulacion. Fuera de alcance de D09.

---

## METODO Y TRAZABILIDAD

- Montos del seed: calculados ejecutando la misma reduccion que usa `seed()` sobre `COMPONENT_KEYS` (`tracker/seed_pricing.js:245-258`), no leidos a ojo.
- Montos del xlsx: leidos con `read_file_content` sobre `1ZRmJ6Z0T5CbVoMppVB0ACtQlQB7WqhuK` (**solo lectura**; no se creo, movio, renombro, borro ni subio nada a Drive).
- Columnas del xlsx en orden: `nombre | honorarios | abogado | Modificaciones | gastos trámite | Subtotal | (3 vacias) | refrendo colegio | tasa x servicio DNFD | tasa x producto | IEA | MEF | Subtotal tasas | (vacia) | TOTAL`.
- Verificacion de la ausencia del segundo xlsx: `get_file_metadata` (error `Requested entity was not found.`) + `search_files fullText contains 'precios para la plataforma'` (1 resultado) + grep sobre `01_INVENTARIO_DRIVE.md` (1 resultado).
- No se ejecuto `git commit` ni `git push`. No se edito codigo. No se leyo `FADDI CREDENTIALS.txt` ni el Doc `Contrasenas`.

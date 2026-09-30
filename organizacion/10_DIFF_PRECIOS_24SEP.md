# 10 — Diferencias del tarifario 24-sep vs el canónico (12-sep)

**Fuente nueva:** `_Zelky-Drive-2026-09-25/F04-Actualización de nuestros precios para la plataforma - copia.xlsx` (24-sep) — más reciente que el tarifario que ya vive en `tracker/seed_pricing.js` (12-sep). Por instrucción del PM: este tarifario se carga **solo en el emulador** (`tracker/scripts/seed_pricing_24sep.js`, ids con sufijo `_24sep`) — **`seed_pricing.js` de producción no se tocó**, ningún precio cambia en producción sin que Rick lo apruebe.

Generado a partir del xlsx con un parser propio (sin dependencias nuevas: lee `xl/worksheets/sheet1.xml` + `xl/sharedStrings.xml` directamente) — no a mano, para no transcribir mal ninguno de los ~53 renglones.

---

## 1. Categorías que YA EXISTÍAN — comparación de precio

| Categoría (24-sep) | id nuevo | Total viejo (12-sep) | Total nuevo (24-sep) | Diferencia |
|---|---|---:|---:|---:|
| Síntesis química Procedimiento abreviado | `med_abreviado_sintesis_24sep` | B/.4,580 (`med_abreviado_sintesis`) | B/.4,580 | sin cambio |
| Biológicos Biotecnológicos   , Procedimiento Abreviado | `med_abreviado_biologicos_24sep` | B/.4,580 (`med_abreviado_biologico`) | B/.4,580 | sin cambio |
| Suplementos Vitamínicos, Alimenticios y dietéticos    Procedimiento Abreviado | `med_abreviado_suplementos_24sep` | B/.4,580 (`med_abreviado_suplemento`) | B/.4,580 | sin cambio |
| Productos Homeopáticos    Procedimiento Abreviado | `med_abreviado_homeopaticos_24sep` | B/.4,580 (`med_abreviado_suplemento`) | B/.4,580 | sin cambio |
| Radiofármacos   Procedimiento Abreviado | `med_abreviado_radiofarmacos_24sep` | B/.4,580 (`med_abreviado_suplemento`) | B/.4,580 | sin cambio |
| Huérfanos    Procedimiento Abreviado | `med_abreviado_huerfanos_24sep` | B/.3,880 (`med_abreviado_huerfano`) | B/.3,880 | sin cambio |
| Mutuo Acuerdo | `med_mutuo_acuerdo_24sep` | B/.4,580 (`med_abreviado_mutuo_acuerdo`) | B/.4,130 | ⚠️ B/.-450 |
| Abreviado WLA WHO | `med_abreviado_wla_who_24sep` | B/.4,580 (`med_abreviado_mutuo_acuerdo`) | B/.4,580 | sin cambio |
| Síntesis química Procedimiento Regular | `med_regular_sintesis_24sep` | B/.3,930 (`med_regular_sintesis`) | B/.4,130 | ⚠️ B/.+200 |
| Productos Naturales Registro Regular | `med_regular_naturales_24sep` | B/.3,930 (`med_regular_natural`) | B/.3,930 | sin cambio |
| Gases  Medicinales  Registro Regular | `med_regular_gases_24sep` | B/.3,930 (`med_regular_natural`) | B/.3,930 | sin cambio |
| Medicamentos de Contraste  Registro Regular | `med_regular_contraste_24sep` | B/.3,930 (`med_regular_natural`) | B/.3,930 | sin cambio |
| Huérfano | `med_regular_huerfano_24sep` | B/.3,080 (`med_regular_huerfano`) | B/.3,080 | sin cambio |
| Intercambiabilidad | `intercambiabilidad_24sep` | B/.4,030 (`intercambiabilidad`) | B/.3,880 | ⚠️ B/.-150 |

**Nota sobre "Suplementos/Homeopáticos/Radiofármacos" y "Mutuo Acuerdo/WLA WHO":** el tarifario viejo los combinaba en 1 sola categoría cada uno; el xlsx del 24-sep los separa en categorías propias con nombre distinto (incluso cuando el precio da igual, como Suplementos/Homeopáticos/Radiofármacos — los 3 dan B/.4,580 — o distinto, como Mutuo Acuerdo (B/.4,130) vs WLA WHO (B/.4,580), que el viejo trataba como una sola cosa a B/.4,580).

### Diferencias de precio reales (no solo de agrupación)

- **Mutuo Acuerdo**: B/.4,580 (viejo, combinado con WLA WHO) → **B/.4,130** (nuevo, separado) — B/.450 menos. WLA WHO por su lado se queda en B/.4,580 (sin cambio).
- **Síntesis Química, Procedimiento Regular**: B/.3,930 (viejo) → **B/.4,130** (nuevo) — B/.200 más. El xlsx trae una fila aparte "Procedimiento Regular" (genérica, sin subtipo, fila 21) con el mismo total B/.4,130 — revisar con Zelky si "Síntesis Química Regular" y "Procedimiento Regular" genérico son la misma cosa o dos cosas distintas que casualmente el xlsx dejó con el mismo precio.
- **Intercambiabilidad**: B/.4,030 (viejo) → **B/.3,880** (nuevo) — B/.150 menos, y cambia la composición: el viejo tenía `refrendo_cnf:0`, tasa_dnfd_tramite:650; el nuevo trae `refrendo_cnf:50`, tasa_dnfd_tramite:400.

---

## 2. Inconsistencias DENTRO del xlsx 24-sep (el total declarado no cuadra con sus propios componentes)

Encontradas comparando cada fila contra la suma de sus propias columnas — no es una diferencia contra el tarifario viejo, es el xlsx contradiciéndose a sí mismo. Se cargó la SUMA DE COMPONENTES (más confiable que un total que pudo quedar desactualizado tras una edición), pero queda documentado para que Zelky lo revise:

| Fila | Categoría | Total de tasas: declarado vs. suma de columnas | Total general: declarado vs. suma |
|---|---|---|---|
| 5 | Biológicos Biotecnológicos   , Procedimiento Abreviado | 2325 vs **2525** | 4380 vs **4580** |
| 7 | Prioridad para el trámite de solicitud de registros sanitarios de medicamentos innovadores inicial, renovación y modificación | 2325 vs **2525** | 4180 vs **4380** |

---

## 3. Fila rota (`#REF!` en el xlsx original)

**Fila 42 — "Renovación de registro sanitario por trámite abreviado"**: la celda de IEA (y por lo tanto el Total de tasas y el Total general) tienen una fórmula rota (`#REF!`) en el xlsx fuente — no un valor, un error de Excel. Se cargó `iea: null` y `total: null` en `seed_pricing_24sep.js` — **no se inventó un número** para tapar el hueco (mismo criterio que "por_confirmar" en formularios, TAREA 17). Los demás componentes de esta fila (honorarios B/.1,200, abogado B/.250, gastos B/.650, refrendo B/.50, tasa servicio DNFD B/.200, tasa trámite DNFD B/.750, MEF B/.25) sí están completos. Pendiente de que Zelky mande la fórmula correcta.

---

## 4. Categorías que el xlsx AGREGA (sin equivalente en el tarifario viejo)

### Abreviado (adicionales)

| id | Categoría | Total |
|---|---|---:|
| `med_abreviado_prioridad_innovadores_24sep` | Prioridad para el trámite de solicitud de registros sanitarios de medicamentos innovadores inicial, renovación y modificación | B/.4,380 |
### Regular / otros (adicionales)

| id | Categoría | Total |
|---|---|---:|
| `med_regular_general_24sep` | Procedimiento Regular | B/.4,130 |
| `cosmeticos_10_variedades_24sep` | Expedición de registro sanitario para cosméticos por cada 10 variedades adicionales | B/.2,430 |
### Renovaciones (categoría completa, no existía)

| id | Categoría | Total |
|---|---|---:|
| `renovacion_sintesis_quimica_24sep` | Renovación de registro sanitario para productos farmacéuticos de síntesis química | B/.2,675 |
| `renovacion_innovadores_biologicos_24sep` | Renovación de registro sanitario para productos farmacéuticos innovadores, biológicos, biotecnológicos y biosimilares | B/.2,925 |
| `renovacion_abreviado_24sep` | Renovación de registro sanitario por trámite abreviado | **sin dato (`#REF!` en el xlsx — ver sección 3)** |
| `renovacion_cosmeticos_24sep` | Renovación de registro sanitario para cosméticos y similares, y productos sanitarios de higiene personal | B/.2,675 |
| `renovacion_otros_plaguicidas_24sep` | Renovación de registro sanitario de otros productos para la salud humana y de Registro Sanitario de plaguicidas de uso doméstico y de salud pública para uso profesional | B/.2,475 |
| `renovacion_intercambiabilidad_24sep` | Renovación de la intercambiabilidad bajo la condición de medicamento de Referencia o Intercambiable | B/.2,225 |
| `renovacion_reconocimiento_mutuo_24sep` | Renovación de registro sanitario por reconocimiento mutuo | B/.2,525 |
| `renovacion_fuentes_alternas_24sep` | Renovación de registro sanitario para medicamentos de fuentes alternas de fabricación | B/.2,675 |
### Modificaciones (categoría completa, no existía — 27 filas)

| id | Categoría | Total |
|---|---|---:|
| `mod_ampliacion_de_presentacion_24sep` | Ampliación de presentación | B/.1,025 |
| `mod_cambio_o_modificacion_en_el_nombre_comer_24sep` | Cambio o modificación en el nombre comercial | B/.1,025 |
| `mod_cambio_de_razon_social_del_fabricante_em_24sep` | Cambio de razón social del fabricante, empacador o titular en el certificado de registro | B/.1,025 |
| `mod_cambio_en_la_monografia_inserto_adicion_24sep` | Cambio en la monografía, inserto, adición de inserto | B/.1,025 |
| `mod_cambio_en_el_periodo_de_vida_util_24sep` | Cambio en el periodo de vida útil | B/.1,025 |
| `mod_cambio_en_las_condiciones_de_almacenamie_24sep` | Cambio en las condiciones de almacenamiento | B/.1,025 |
| `mod_cambio_de_empacador_primario_24sep` | Cambio de empacador primario | B/.1,025 |
| `mod_cambio_de_empacador_secundario_24sep` | Cambio de empacador secundario | B/.1,025 |
| `mod_cambio_o_adicion_en_el_tipo_de_material_24sep` | Cambio o adición en el tipo de material del empaque primario o del sistema envase cierre | B/.1,025 |
| `mod_adicion_de_un_nuevo_empaque_primario_24sep` | Adición de un nuevo empaque primario | B/.1,025 |
| `mod_cambio_de_titular_24sep` | Cambio de Titular | B/.1,025 |
| `mod_cambio_de_origen_o_en_caso_de_fabricacio_24sep` | Cambio de origen o en caso de fabricación por terceros: a. Cambio de Fabricante. b. Cambio de fabricante y de país de origen | B/.1,025 |
| `mod_cambio_de_modalidad_de_venta_24sep` | Cambio de modalidad de venta | B/.1,025 |
| `mod_cambio_de_excipientes_24sep` | Cambio de excipientes | B/.1,025 |
| `mod_cambio_de_informacion_o_diseno_en_el_eti_24sep` | Cambio de información o diseño en el etiquetado primario y secundario | B/.1,025 |
| `mod_cambio_en_el_sitio_de_fabricacion_dentro_24sep` | Cambio en el sitio de fabricación dentro de un mismo país | B/.1,025 |
| `mod_cambio_en_el_representante_legal_o_del_p_24sep` | Cambio en el representante legal o del profesional responsable | B/.1,025 |
| `mod_cambio_o_actualizacion_en_las_especifica_24sep` | Cambio o actualización en las especificaciones del producto terminado | B/.1,025 |
| `mod_cambio_o_actualizacion_en_la_metodologia_24sep` | Cambio o actualización en la metodología analítica | B/.1,025 |
| `mod_cambio_o_ampliacion_de_indicaciones_tera_24sep` | Cambio o ampliación de indicaciones terapéuticas | B/.1,025 |
| `mod_autorizacion_de_comercializacion_conjunt_24sep` | Autorización de comercialización conjunta (Co-Empaques) | B/.1,025 |
| `mod_modificacion_de_las_vias_de_administraci_24sep` | Modificación de las vías de administración | B/.1,025 |
| `mod_cambio_del_fabricante_del_diluyente_24sep` | Cambio del Fabricante del diluyente | B/.1,025 |
| `mod_modificacion_de_la_denominacion_del_prin_24sep` | Modificación de la denominación del principio activo | B/.1,025 |
| `mod_cambio_del_representante_legal_que_resid_24sep` | Cambio del Representante Legal que reside en el país autorizado por el titular | B/.850 |
| `mod_cambio_del_profesional_responsable_autor_24sep` | Cambio del Profesional responsable autorizado por el titular | B/.850 |
| `mod_otros_cambios_en_la_informacion_aportada_24sep` | Otros cambios en la información aportada en la obtención del Registro Sanitario | B/.1,025 |
| `mod_modificaciones_para_medicamentos_huerfan_24sep` | Modificaciones para Medicamentos Huérfanos | B/.875 |

---

## 5. Lo que el xlsx del 24-sep TAMPOCO trae (pregunta a Zelky sigue abierta)

Ya estaba anotado en PM_COMMENTS §H.8 antes de esta tarea, y sigue sin resolverse: el xlsx no trae las combinaciones **Regular + Biológicos/Homeopático/Suplementos/Vacuna** ni **Abreviado + Vacuna/Medio de Contraste/Gas Medicinal/Productos Naturales**. `resolverCategoriaPrecio()` (tracker/routes/quotes.js) las sigue devolviendo `null` (el admin completa el precio a mano) — no se inventó ninguna de las dos.

---

## 6. `resolverCategoriaPrecio()` actualizado

Se agregaron las resoluciones nuevas que el xlsx SÍ cubre con certeza (medicamentos, Nuevo Registro — Abreviado/Regular/Reconocimiento Mutuo/WLA), apuntando a los ids `_24sep` (más específicos que los combinados viejos). Renovaciones y modificaciones **no se conectaron** a `resolverCategoriaPrecio()` — el caso no tiene forma de marcarse como "Renovación" (`tipoSolicitud` sigue fijo en 'Nuevo Registro', gap ya documentado en TAREA 17/§H.6) ni de indicar QUÉ modificación específica pidió el cliente (27 tipos distintos, sin campo en el modelo de caso) — se cargaron al tarifario para que existan y el admin las pueda asignar a mano, no se inventó un criterio de selección automática que no hay forma de sustentar con los datos de hoy.


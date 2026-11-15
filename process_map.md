> **REEMPLAZADO — v1.0 del 25-ago-2026. No refleja el código actual. Fuente vigente: tracker/data/case_status.js y tracker/data/faddi_checklists.js.**

# Farmazed — Mapa de Proceso: Solicitar Nuevo Registro
**Versión:** 1.0 | **Fecha:** 2026-08-25 | **Autor:** PM Farmazed (Claude)
**Base regulatoria:** D.E. 27/2024 (medicamentos), D.E. 178/2001 (cosméticos), RTCA 71.03.35:21, D.E. 29/2023 (Abreviado)

---

## 1. Visión general del wizard (5 pasos)

```
[Paso 1 — Tipo]
    → ¿Qué producto? ¿Qué procedimiento? ¿Qué subtipo?
    → Se crea el caso en Firestore aquí

[Paso 2 — Datos del producto]
    → Información técnica del producto (campos varían por tramiteType)

[Paso 3 — Entidades]
    → Fabricante, titular, solicitante, regente farmacéutico, abogado, etc.

[Paso 4 — Carga documental]
    → Checklist dinámico de documentos (obligatorios + condicionales/opcionales)
    → Subida de archivos por documento (máx. 50 MB c/u)

[Paso 5 — Confirmación]
    → Resumen del caso + alerta de documentos faltantes
    → Envío formal (status → 'submitted')
```

---

## 2. Árbol de decisión — Paso 1

### Nivel 1: ¿Qué tipo de trámite?

```
Solicitar Nuevo Registro
│
├── 1. Medicamentos ────────────────────── ver Sección 3
├── 2. Cosméticos ──────────────────────── ver Sección 4
├── 3. Higiénicos/Desinfectantes ────────── ver Sección 5
├── 4. Plaguicidas ─────────────────────── ver Sección 6
├── 5. Excepción de Registro ───────────── ver Sección 7
└── 6. Publicidad ──────────────────────── ver Sección 8
```

---

## 3. MEDICAMENTOS — Ruta completa

### 3.1 Decisiones en Paso 1

#### Nivel 2: ¿Qué tipo de registro?

| tipoRegistro | Descripción | Requisito clave |
|---|---|---|
| **Regular** | Registro nuevo estándar ante DNFD/MINSA | Expediente técnico completo |
| **Abreviado** | Basado en expediente aprobado por ARR (FDA/EMA/INVIMA/etc.) | Expediente ARR apostillado (D.E. 29/2023) |
| **Reconocimiento Mutuo** | Acuerdo bilateral entre países COMCA | Trámite especial — no cubierto por wizard actual |
| **Reconocimiento WLA** | OMS Lista de Precalificación | Trámite especial — no cubierto por wizard actual |

> **Nota para el developer:** Reconocimiento Mutuo y WLA actualmente no tienen flujo diferenciado en el wizard. Documentar como pendiente de diseño regulatorio.

#### Nivel 3: ¿Qué tipo(s) de medicamento? (selección múltiple)

| tipoMedicamento | Docs extra obligatorios | Base legal |
|---|---|---|
| Síntesis Química | Ninguno | Base |
| **Biotecnológicos** | +3 docs (farmacovigilancia, clínicos, no clínicos) | Art. 102 D.E. 27/2024 |
| Homeopáticos | Ninguno | Base |
| **Huérfanos** | +1 obligatorio (DJ países) + 1 condicional (clínicos) | Arts. 107-108 D.E. 27/2024 |
| Radiofármacos | Ninguno | Base |
| **Biológicos** | +2 docs (clínicos, no clínicos) | Base — CTD módulos 4 y 5 |
| Suplemento Con Propiedad Terapéutica | Ninguno | Base |
| Producto Natural Medicinal | Ninguno | Base |
| Producto Hemoderivado | Ninguno | Base |
| **Vacuna** | +2 docs (clínicos, no clínicos) | Base — datos eficacia e inmunogenicidad |
| Alérgeno | Ninguno | Base |
| Medio de Contraste | Ninguno | Base |
| Cannabis | Ninguno | Base (regulación específica pendiente) |

> La selección múltiple es posible: un producto puede ser Biotecnológico + Biológico simultáneamente. Los documentos se acumulan sin duplicados.

---

### 3.2 Documentos — Medicamentos Regular (base)

**Total base: 21 documentos** (16 obligatorios + 5 condicionales)

#### Obligatorios (siempre requeridos)

| Código FADDI | Documento | Descripción operativa |
|---|---|---|
| 15.1 | Recibo pago I.E.A. | Comprobante honorarios análisis (Universidad de Panamá) |
| 15.2 | Poder Original | Notarial titular→regente, apostillado/legalizado |
| 15.3 | Certificado de Libre Venta (CLV) | Autoridad sanitaria país de fabricación, apostillado |
| 15.4 | Certificado BPM | Fabricante vigente, apostillado |
| 15.5 | Fórmula Cuali-Cuantitativa | PA + excipientes con concentraciones |
| 15.6 | Método de Análisis | Métodos validados de control de calidad |
| 15.7 | Certificado de Análisis | Lote enviado como muestra al IEA |
| 15.8 | Especificaciones PT | Especificaciones técnicas completas |
| 15.9 | Clave de Lote | Sistema de codificación de lotes |
| 15.12 | Estudios de Estabilidad | Zona IVb (40°C/75% HR); si vida útil ≤24m: informe + DJ |
| 15.18 | Proceso de Fabricación | Descripción detallada del proceso |
| 15.19 | Controles en Proceso | Controles de calidad durante fabricación |
| 15.17 | Recibo Tasa por Servicio | Comprobante pago $200 (MEF) |
| 15.15 | Muestra Física | Envase comercial para análisis IEA |
| 15.16 | Patrones Analíticos | Referencia del principio activo |
| 16.1.1 | Recibo CNF | Refrendo Colegio Nacional de Farmacéuticos |

#### Condicionales (se activan según el producto)

| Código FADDI | Documento | Cuándo aplica |
|---|---|---|
| 15.10 | Prospecto o Inserto | Cuando el producto incluye inserto/prospecto |
| 15.11 | Monografía | Según tipo de medicamento |
| 15.13 | Info disposición de desecho | Cuando requiere disposición especial |
| 15.21 | Condiciones almacenamiento/transporte | Cadena de frío u otras condiciones especiales |
| 15.14 | Otros Documentos Aclaratorios | Observaciones previas o documentos adicionales |

---

### 3.3 Documentos adicionales por tipo de medicamento

#### Biotecnológicos (+3 obligatorios)

| Código FADDI | Documento |
|---|---|
| 15.20 | Programa de Manejo de Riesgo y Plan de Farmacovigilancia |
| 15.22 | Estudios Clínicos (Módulo 5 CTD) |
| 15.23 | Estudios No Clínicos (Módulo 4 CTD) |

#### Biológicos (+2 obligatorios)

| Código FADDI | Documento |
|---|---|
| 15.22 | Estudios Clínicos (Módulo 5 CTD) |
| 15.23 | Estudios No Clínicos (Módulo 4 CTD) |

#### Huérfanos (+1 obligatorio, +1 condicional)

| Código FADDI | Documento | Tipo |
|---|---|---|
| 15.14 | Declaración notarial de países con registro | Obligatorio |
| 15.22 | Estudios clínicos (resumen disponible) | Condicional — según disponibilidad |

#### Vacuna (+2 obligatorios)

| Código FADDI | Documento |
|---|---|
| 15.22 | Estudios Clínicos (eficacia e inmunogenicidad) |
| 15.23 | Estudios No Clínicos (seguridad) |

---

### 3.4 Documentos adicionales — Procedimiento Abreviado (+1 obligatorio)

| Código FADDI | Documento | Nota |
|---|---|---|
| 15.14 | Expediente aprobado por ARR (FDA/EMA/INVIMA/etc.) | Apostillado/legalizado. ARR = Autoridad Regulatoria de Referencia. Base: D.E. 29/2023 |

---

### 3.5 Resumen de conteo de documentos — Medicamentos

| Ruta | Obligatorios | Condicionales | Total posible |
|---|---|---|---|
| Regular — Síntesis Química (base) | 16 | 5 | 21 |
| Regular — Biotecnológicos | 19 | 5 | 24 |
| Regular — Biológicos | 18 | 5 | 23 |
| Regular — Huérfanos | 17 | 6 | 23 |
| Regular — Vacuna | 18 | 5 | 23 |
| Abreviado (cualquier tipo base) | 17 | 5 | 22 |
| Abreviado — Biotecnológicos | 20 | 5 | 25 |

---

### 3.6 Datos de producto requeridos (Paso 2 — Medicamentos)

| Campo | Obligatorio | Descripción |
|---|---|---|
| Nombre Comercial | ✓ | |
| Principio Activo | ✓ | |
| Concentración | ✓ | |
| Forma Farmacéutica | ✓ | |
| Vía de Administración | ✓ | |
| Condición de Venta | ✓ | (con receta / sin receta / uso hospitalario) |
| Código ATC | — | Opcional |
| Descripción del Envase | ✓ | |
| Vida Útil | ✓ | |
| Condiciones de Almacenamiento | ✓ | |
| Descripción de Presentación | ✓ | |
| Tipo de Presentación | ✓ | |

---

## 4. COSMÉTICOS — Ruta completa

**Paso 1:** Solo se selecciona tramiteType = "cosméticos". No hay subramas.

### Documentos (9 total — 7 obligatorios + 2 condicionales)

#### Obligatorios

| Código FADDI | Documento | Descripción operativa |
|---|---|---|
| 11.1 | Poder Original | Notarial titular→regente, apostillado |
| 11.2 | Certificado BPM | RTCA 71.03.49:08, apostillado |
| 11.3 | Fórmula Cuali-Cuantitativa | Ingredientes INCI con porcentaje |
| 11.5 | Especificaciones PT | Físico-químicas y microbiológicas (RTCA 71.03.45:07) |
| 11.7 | Foto de la Muestra Física | Fotografía del producto en envase comercial |
| 10.7 | Refrendo CNF | Farmacéutico responsable (D.E. 178/2001) |
| EXTRA | Certificado de Libre Venta (CLV) | ⚠️ No en FADDI — presentar en ventanilla física. Requisito RTCA 71.03.35:21 |

#### Condicionales

| Código FADDI | Documento | Cuándo aplica |
|---|---|---|
| 11.4 | Documentos que avalan propiedades específicas | Si reclama FPS, anti-edad u otras propiedades |
| 11.6 | Otros Documentos Aclaratorios | Cuando aplique |

> **⚠️ Alerta al cliente:** El CLV de cosméticos NO se carga en FADDI — debe presentarse físicamente en ventanilla DNFD. Farmazed debe notificar esto al cliente en el flujo.

---

## 5. HIGIÉNICOS / DESINFECTANTES / ANTISÉPTICOS — Ruta completa

**Paso 1:** Solo se selecciona tramiteType = "higiénicos". No hay subramas.

### Documentos (13 total — 12 obligatorios + 1 condicional)

#### Obligatorios

| Código FADDI | Documento | Descripción operativa |
|---|---|---|
| 28.1 | Poder | Apostillado/legalizado |
| 29.2 | Personería Jurídica | Original o copia legalizada |
| 30.3 | Certificado de Libre Venta | Apostillado del país de origen |
| 31.4 | Certificado BPM | Vigente del fabricante |
| 32.5 | Copia del permiso de operación | Licencia sanitaria del fabricante |
| 33.6 | Fórmula Cuali-cuantitativa | Composición completa con concentraciones |
| 34.7 | Especificaciones PT | Control de calidad |
| 35.8 | Hoja de datos de seguridad (SDS) | Formato GHS/SGA |
| 36.9 | Muestra | En envase comercial |
| 37.10 | Declaración jurada | Del representante legal |
| 10.7 | Refrendo CNF | Farmacéutico responsable |
| EXTRA | Cotización de I.E.A. | Cotización de análisis (no estándar FADDI — gestión previa requerida) |

#### Condicional

| Código FADDI | Documento | Cuándo aplica |
|---|---|---|
| 38.11 | Otros Documentos | Cuando aplique |

---

## 6. PLAGUICIDAS — Ruta completa

**Paso 1:** Solo se selecciona tramiteType = "plaguicidas". No hay subramas.

### Documentos (20 total — 19 obligatorios + 1 condicional)

#### Obligatorios

| Código FADDI | Documento | Descripción operativa |
|---|---|---|
| 11.1 | Poder | Apostillado/legalizado |
| 11.2 | Certificado de Libre Venta | País de fabricación |
| 11.3 | Certificado BPM de fabricación | Del fabricante |
| 11.4 | Licencia Sanitaria o permiso de funcionamiento | Vigente del fabricante |
| 11.5 | Fórmula cuali-cuantitativa | IA y coadyuvantes |
| 11.6 | Método de análisis | Del principio activo |
| 11.7 | Especificaciones PT | Del producto terminado |
| 11.8 | Certificado de análisis | Del lote |
| 11.9 | Estudios de estabilidad | Condiciones climáticas relevantes |
| 11.10 | Información del tipo de empaque o envase | Compatibilidad envase-formulado |
| 11.11 | Hoja de seguridad (SDS) | Formato GHS |
| 11.12 | Estudio de Eficacia de la formulación | Demuestra eficacia del plaguicida |
| 11.13 | Estudio de toxicidad aguda | DL50 oral, dérmica, inhalatoria |
| 11.14 | Residualidad e info ecotoxicológica (PA) | Información ecotoxicológica del IA |
| 11.15 | Muestras | Del producto |
| 11.16 | Codificación de lote | Sistema de codificación |
| 11.17 | Método de destrucción | Eliminación segura |
| 13.1 | Refrendo CNF | Farmacéutico responsable |
| 13.2 | Cotización de I.E.A. | Análisis del IEA |

#### Condicional

| Código FADDI | Documento | Cuándo aplica |
|---|---|---|
| 11.18 | Otros Documentos | Cuando aplique |

> **Nota:** Plaguicidas es el trámite más documental (20 docs). Proceso más largo y con más requisitos técnicos.

---

## 7. EXCEPCIÓN DE REGISTRO — Ruta completa

**Paso 1:** tramiteType = "excepción". No hay subramas de tipo de producto.
**Uso:** Importación urgente para casos específicos (calamidad, desabasto, uso compasivo, paciente específico, compra institucional directa).

### Documentos (8 total — 6 obligatorios + 2 condicionales)

#### Obligatorios

| Código FADDI | Documento | Descripción operativa |
|---|---|---|
| 5.1 | Tasa de Servicio | Comprobante de pago |
| 5.2 | Nota que sustenta la Solicitud | Justificación oficial (calamidad / razón humanitaria / desabasto) |
| 5.3 | Certificado de Buenas Prácticas | BPM del fabricante del país de origen |
| 5.4 | Certificado de Análisis de Lote a Importar | Del lote específico que se importará |
| 5.6 | Registro Sanitario del país de origen (ARR) | RS de autoridad de alto estándar (FDA/EMA/etc.) |
| 5.7 | Declaración Jurada | Del solicitante |

#### Condicionales

| Código FADDI | Documento | Cuándo aplica |
|---|---|---|
| 5.5 | Receta u Orden de Compra | Paciente → receta médica; Compra directa → orden de compra institucional |
| 5.8 | Otros documentos aclaratorios | Cuando aplique |

> **⚠️ Importante:** Excepción no otorga Registro Sanitario permanente. Es una autorización temporal para importar un lote específico.

---

## 8. PUBLICIDAD — Ruta completa

**Paso 1:** tramiteType = "publicidad". Trámite de revisión/aprobación de materiales publicitarios de productos ya registrados.

### Documentos (3 total — 2 obligatorios + 1 condicional)

#### Obligatorios

| Código FADDI | Documento | Descripción operativa |
|---|---|---|
| 3.1 | Justificante del pago de tasas | Comprobante pago tasa revisión publicidad |
| 3.2 | Muestras de material a evaluar | Impresos, storyboard, guión, etc. |

#### Condicional

| Código FADDI | Documento | Cuándo aplica |
|---|---|---|
| 3.3 | Documentos aclaratorios | Cuando aplique |

---

## 9. Entidades requeridas — Paso 3 (todos los trámites)

| Campo | Obligatorio | Descripción |
|---|---|---|
| Fabricante | ✓ | Empresa que fabrica el producto |
| Titular | ✓ | Dueño del registro sanitario |
| Solicitante | ✓ | Quien presenta la solicitud ante DNFD |
| Representante Legal | ✓ | Representante legal local |
| Abogado | ✓ | Abogado tramitador |
| Farmacéutico Regente | ✓ | Regente farmacéutico habilitado en Panamá |
| Distribuidores | — | Lista de distribuidores (puede ser vacía) |

---

## 10. Resumen comparativo de trámites

| Trámite | Docs obligatorios | Docs condicionales | Complejidad | Tiempo estimado |
|---|---|---|---|---|
| Medicamentos Regular (base) | 16 | 5 | Alta | 6–12 meses |
| Medicamentos Abreviado | 17 | 5 | Alta | 3–6 meses |
| Cosméticos | 7 | 2 | Media | 3–6 meses |
| Higiénicos | 12 | 1 | Media | 3–6 meses |
| Plaguicidas | 19 | 1 | Muy alta | 6–12 meses |
| Excepción | 6 | 2 | Baja | 2–4 semanas |
| Publicidad | 2 | 1 | Baja | 2–4 semanas |

---

## 11. Flujo paso a paso desde el punto de vista del cliente

```
CLIENTE inicia sesión en el portal
    ↓
Clic en "Solicitar Nuevo Registro"
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 1 — TIPO DE TRÁMITE                                    │
│                                                             │
│  1. Selecciona tramiteType (6 opciones)                     │
│  2. Si medicamentos:                                        │
│     a. Selecciona tipoRegistro (4 opciones)                 │
│     b. Selecciona tipoMedicamento (1-13, múltiple)          │
│                                                             │
│  → Sistema crea caso en Firestore                           │
│  → URL actualiza a ?caseId=XXX (puede retomar después)      │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 2 — DATOS DEL PRODUCTO                                 │
│                                                             │
│  Medicamentos: 12 campos técnicos                           │
│  Cosméticos: campos específicos de cosméticos               │
│  Otros: campos según tipo                                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 3 — ENTIDADES                                          │
│                                                             │
│  - Fabricante, titular, solicitante                         │
│  - Representante legal, abogado, farmacéutico               │
│  - Distribuidores (lista)                                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 4 — CARGA DOCUMENTAL                                   │
│                                                             │
│  Sistema carga checklist dinámico vía API:                  │
│  GET /api/cases/:id/checklist                               │
│                                                             │
│  Sección A: Documentos Obligatorios                         │
│  Sección B: Condicionales / Opcionales                      │
│                                                             │
│  Por cada documento:                                        │
│  - Estado: pendiente / subido / aprobado / rechazado        │
│  - Botón "Subir archivo" → máx. 50 MB                       │
│  - Barra de progreso general                                │
│                                                             │
│  ⚠️ Cliente puede guardar y retomar (caseId en URL)         │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│ PASO 5 — CONFIRMACIÓN                                       │
│                                                             │
│  Resumen: nombre, tipo de trámite, progreso documental      │
│  Alerta si hay documentos obligatorios faltantes            │
│  Botón "Enviar Solicitud" → status = 'submitted'            │
│  Notificación al equipo Farmazed                            │
└─────────────────────────────────────────────────────────────┘
    ↓
FARMAZED recibe la solicitud en el panel admin
→ Revisión, asignación de gestor, inicio de trámite FADDI
```

---

## 12. Gaps y observaciones para el developer

| # | Observación | Prioridad | Acción |
|---|---|---|---|
| 1 | Reconocimiento Mutuo y WLA no tienen flujo diferenciado | Media | Agregar pantalla informativa o deshabilitar con mensaje "contáctenos" |
| 2 | CLV de cosméticos no se carga en FADDI — debe ir a ventanilla | Alta | Agregar nota prominente en el checklist para cosméticos |
| 3 | Excepción no otorga RS permanente | Alta | Agregar disclaimer claro en Paso 1 al seleccionar "excepción" |
| 4 | Campos de Paso 2 para cosméticos, higiénicos, plaguicidas no están documentados en wizard.js | Media | Verificar que el wizard renderice los campos correctos para cada tramiteType |
| 5 | Distribuidor puede ser lista vacía — validar que no bloquee avance | Baja | QA en Paso 3 |
| 6 | Estado del checklist documental depende de GET /api/cases/:id/checklist — endpoint debe existir en el backend | Alta | Verificar en tracker/routes/ que este endpoint esté implementado |

---

*Documento generado por PM Farmazed — solo para referencia interna del equipo.*
*No compartir con clientes. Actualizar cuando cambien normas DNFD/MINSA.*

/**
 * formularios.js — R14 (organizacion/04_ROADMAP.md), TAREA 17.
 *
 * Catálogo de los 13 formularios/declaraciones juradas canónicos (serie
 * F08-Form-1..13, `~/Projects/Farmazed/_Zelky-Drive-2026-09-25/`, ver
 * organizacion/02_MAPA_DATA.md sección D — esa serie es la marcada CANONICO,
 * la más nueva y la única completa 1–13). Los archivos viven en
 * `farmazed-web/formularios/`, servidos como estáticos públicos (son
 * plantillas en blanco, sin datos de ningún cliente — no necesitan signed
 * URL ni control de acceso por caso, a diferencia de un documento YA
 * subido por un cliente).
 *
 * `firma`: quién suscribe el formulario, leído del propio título/cuerpo del
 * documento (no inventado) — uno o más de: 'titular', 'representante_legal',
 * 'fabricante', 'farmaceutico', 'casa_matriz'.
 *
 * `aplica`: a qué trámites/vías/subtipos de MEDICAMENTOS corresponde, de un
 * vocabulario fijo (medicamentos_regular, medicamentos_abreviado,
 * reconocimiento_mutuo, renovaciones, suplementos, intercambiabilidad,
 * no_comercializados, medicamentos_siempre, nuevo_registro) — o el string
 * `'por_confirmar'` para la biblioteca completa del admin (sin caso de por
 * medio no hay con certeza una sola respuesta — ver `aplicaSegunCaso`).
 *
 * TAREA 28 (PM_COMMENTS §H.11, respuestas de Zelky ronda 2 — cierra §H.6):
 *   - **F1** (`form-01`): autorización del TITULAR al representante legal —
 *     aplica cuando el titular actúa directo (`representacion ===
 *     'titular_directo'`).
 *   - **F2** (`form-02`): autorización del representante legal de la CASA
 *     MATRIZ a un representante local — aplica cuando el titular actúa vía
 *     casa matriz + distribuidor (`representacion ===
 *     'casa_matriz_distribuidor'`).
 *   - **F3** (`form-03`): poder del representante legal en Panamá al
 *     farmacéutico responsable — aplica SIEMPRE (`medicamentos_siempre`),
 *     ya no depende de nada.
 *   - **F10** (`form-10`): declaración de nombre comercial ligada al
 *     CLV/CPF — aplica a todo registro NUEVO de medicamentos
 *     (`nuevo_registro`), ya no depende de vía ni subtipo.
 * F1 y F2 usan `aplicaSegunCaso(caseData)` (tri-estado real por caso, no un
 * tag estático) porque dependen del campo `representacion` del caso
 * (`tracker/routes/cases.js`, lo confirma el staff en la tarjeta de Fase 3,
 * junto con vía/categoría/innovador) — mientras no esté definido, quedan
 * `por_confirmar` para ESE caso puntual (no para la biblioteca completa, que
 * sigue sin contexto de caso).
 *
 * Hueco de datos conocido (documentado, no resuelto aquí): el modelo de
 * casos hoy NO tiene forma de marcar que una solicitud es una RENOVACIÓN —
 * `wizard.js` fija `tipoSolicitud: 'Nuevo Registro'` siempre, sin UI para
 * cambiarlo. Los formularios etiquetados `renovaciones`/`intercambiabilidad`/
 * `no_comercializados` (4, 5, 7, 8, 12, 13) nunca calzarán con el filtro del
 * cliente (`getFormulariosParaCaso`) mientras ese hueco siga abierto — se
 * siguen listando en la biblioteca completa del admin, que no filtra. Por la
 * misma razón, `nuevo_registro` (F10) le calza a TODOS los casos de hoy —
 * es el comportamiento correcto mientras `tipoSolicitud` sea siempre
 * 'Nuevo Registro'; el día que deje de serlo, deja de calzarle a las
 * renovaciones automáticamente, sin tocar este archivo.
 */

const FORMULARIOS = [
  {
    id: 'form-01',
    numero: 1,
    titulo: 'Autorización de Representación Legal en Panamá (otorgada por el Titular)',
    archivo: 'formulario-01-autorizacion-representacion-legal-titular.docx',
    firma: ['titular'],
    aplica: 'por_confirmar', // biblioteca completa (sin caso): ver aplicaSegunCaso para el caso real.
    notaAplicacion: 'Autorización del titular al representante legal para presentar la solicitud ante la DNFD — aplica cuando el titular actúa directo (Zelky, §H.11).',
    aplicaSegunCaso: (caseData) => {
      if (caseData.representacion === 'titular_directo') return 'si';
      if (caseData.representacion === 'casa_matriz_distribuidor') return 'no';
      return 'por_confirmar';
    },
  },
  {
    id: 'form-02',
    numero: 2,
    titulo: 'Autorización de Representación Legal (otorgada por la Casa Matriz)',
    archivo: 'formulario-02-autorizacion-representacion-legal-casa-matriz.docx',
    firma: ['casa_matriz'],
    aplica: 'por_confirmar', // biblioteca completa (sin caso): ver aplicaSegunCaso para el caso real.
    notaAplicacion: 'Autorización del representante legal de la casa matriz a un representante legal con domicilio en Panamá (distribuidor), que luego da poder al abogado y al farmacéutico — aplica cuando el titular actúa vía casa matriz + distribuidor local (Zelky, §H.11).',
    aplicaSegunCaso: (caseData) => {
      if (caseData.representacion === 'casa_matriz_distribuidor') return 'si';
      if (caseData.representacion === 'titular_directo') return 'no';
      return 'por_confirmar';
    },
  },
  {
    id: 'form-03',
    numero: 3,
    titulo: 'Autorización de Trámite de Registro Sanitario al Farmacéutico (Profesional Responsable)',
    archivo: 'formulario-03-autorizacion-tramite-rs-farmaceutico.docx',
    firma: ['titular', 'representante_legal'],
    aplica: ['medicamentos_siempre'],
    notaAplicacion: 'Poder del representante legal en Panamá al farmacéutico responsable del trámite — aplica siempre (Zelky, §H.11), sin importar vía, subtipo ni representación.',
  },
  {
    id: 'form-04',
    numero: 4,
    titulo: 'Declaración Jurada de Renovación Sin Cambios (por Titular o Representante Legal)',
    archivo: 'formulario-04-renovacion-sin-cambios-titular-rep-legal.docx',
    firma: ['titular', 'representante_legal'],
    aplica: ['renovaciones'],
  },
  {
    id: 'form-05',
    numero: 5,
    titulo: 'Declaración Jurada de Renovación Sin Cambios (por Farmacéutico en Panamá)',
    archivo: 'formulario-05-renovacion-sin-cambios-farmaceutico.docx',
    firma: ['farmaceutico'],
    aplica: ['renovaciones'],
  },
  {
    id: 'form-06',
    numero: 6,
    titulo: 'Declaración Jurada — Procedimiento Abreviado, Nuevo Registro Sanitario',
    archivo: 'formulario-06-abreviado-nuevo-registro-sanitario.docx',
    firma: ['titular', 'fabricante', 'representante_legal'],
    aplica: ['medicamentos_abreviado'],
  },
  {
    id: 'form-07',
    numero: 7,
    titulo: 'Declaración Jurada — Procedimiento Abreviado, Renovación con Cambios',
    archivo: 'formulario-07-abreviado-renovacion-con-cambios.docx',
    firma: ['titular', 'fabricante', 'representante_legal'],
    aplica: ['medicamentos_abreviado', 'renovaciones'],
  },
  {
    id: 'form-08',
    numero: 8,
    titulo: 'Declaración Jurada de Renovación — Productos No Comercializados',
    archivo: 'formulario-08-renovacion-productos-no-comercializados.docx',
    firma: ['titular'],
    aplica: ['no_comercializados', 'renovaciones'],
  },
  {
    id: 'form-09',
    numero: 9,
    titulo: 'Declaración Jurada para Reconocimiento Mutuo',
    archivo: 'formulario-09-reconocimiento-mutuo.docx',
    firma: ['titular', 'representante_legal'],
    aplica: ['reconocimiento_mutuo'],
  },
  {
    id: 'form-10',
    numero: 10,
    titulo: 'Declaración de Nombre Comercial del Producto (Medicamentos)',
    archivo: 'formulario-10-declaracion-nombre-comercial.docx',
    firma: ['titular', 'representante_legal'],
    aplica: ['nuevo_registro'],
    notaAplicacion: 'Declara que el nombre comercial coincide con el CLV/CPF — aplica a todo registro NUEVO de medicamentos (Zelky, §H.11), sin importar vía ni subtipo.',
  },
  {
    id: 'form-11',
    numero: 11,
    titulo: 'Declaración Jurada — Inscripción de Suplementos Vitamínicos, Dietéticos y Alimenticios',
    archivo: 'formulario-11-suplementos-inscripcion.docx',
    firma: ['titular', 'fabricante', 'representante_legal'],
    aplica: ['suplementos'],
  },
  {
    id: 'form-12',
    numero: 12,
    titulo: 'Declaración Jurada — Renovación de Suplementos Vitamínicos, Dietéticos y Alimenticios',
    archivo: 'formulario-12-suplementos-renovacion.docx',
    firma: ['fabricante'],
    aplica: ['suplementos', 'renovaciones'],
  },
  {
    id: 'form-13',
    numero: 13,
    titulo: 'Declaración Jurada de Renovación por Intercambiabilidad de Medicamentos',
    archivo: 'formulario-13-intercambiabilidad-renovacion.docx',
    firma: ['fabricante', 'titular'],
    aplica: ['intercambiabilidad', 'renovaciones'],
  },
];

// Vocabulario fijo de `aplica` — cualquier tag fuera de esta lista es un bug
// de esta tabla, no una categoría real.
const APLICA_TAGS = [
  'medicamentos_regular', 'medicamentos_abreviado', 'reconocimiento_mutuo',
  'renovaciones', 'suplementos', 'intercambiabilidad', 'no_comercializados',
  // TAREA 28 (§H.11): F3 y F10 ya no son "por_confirmar" — tienen una
  // condición cierta, aunque hoy le calce a todos los casos por igual.
  'medicamentos_siempre', 'nuevo_registro',
];

for (const f of FORMULARIOS) {
  if (f.aplica !== 'por_confirmar') {
    for (const tag of f.aplica) {
      if (!APLICA_TAGS.includes(tag)) {
        throw new Error(`formularios.js: "${f.id}" tiene un tag de aplica desconocido: "${tag}"`);
      }
    }
  }
}

/**
 * Tags derivados de un CASO real — solo lo que el modelo de datos puede
 * expresar hoy (ver el hueco de `tipoSolicitud` documentado arriba). Usado
 * por `getFormulariosParaCaso()` y por GET /api/cases/:id/formularios.
 */
function tagsDelCaso(caseData) {
  const tags = [];
  if (caseData.tramiteType !== 'medicamentos') return tags; // la serie 1-13 es solo de medicamentos

  // TAREA 28 (§H.11): F3 aplica siempre que el trámite sea medicamentos —
  // sin importar vía, subtipo ni representación.
  tags.push('medicamentos_siempre');
  // F10 aplica a todo registro NUEVO — hoy tipoSolicitud es siempre 'Nuevo
  // Registro' (hueco documentado arriba), así que le calza a todos los
  // casos de hoy; el día que exista un tipoSolicitud real de renovación,
  // esto deja de calzarle solo.
  if (caseData.tipoSolicitud === 'Nuevo Registro') tags.push('nuevo_registro');

  if (caseData.tipoRegistro === 'Regular')             tags.push('medicamentos_regular');
  if (caseData.tipoRegistro === 'Abreviado')            tags.push('medicamentos_abreviado');
  if (caseData.tipoRegistro === 'Reconocimiento Mutuo') tags.push('reconocimiento_mutuo');
  if ((caseData.tipoMedicamento || []).includes('Suplementos')) tags.push('suplementos');
  // `renovaciones`/`intercambiabilidad`/`no_comercializados`: sin campo hoy
  // en el modelo de casos — nunca se agregan (ver el hueco documentado
  // arriba). Si tipoSolicitud alguna vez deja de ser fijo en 'Nuevo
  // Registro', agregar aquí `if (caseData.tipoSolicitud === 'Renovación')
  // tags.push('renovaciones');` y lo que corresponda.

  return tags;
}

/**
 * Formularios que aplican con certeza a este caso (`aplica` incluye algún
 * tag del caso, o `aplicaSegunCaso(caseData)` devuelve 'si') y los que
 * quedan `por_confirmar` (se muestran aparte, nunca se ocultan ni se afirma
 * que aplican). TAREA 28 (§H.11): F1/F2 usan `aplicaSegunCaso` — tri-estado
 * real por caso (depende de `representacion`), no un tag estático; un
 * resultado `'no'` los excluye de los dos grupos, igual que un formulario
 * cuyo tag no calza con ninguno de los del caso.
 */
function getFormulariosParaCaso(caseData) {
  const tags = tagsDelCaso(caseData);
  const aplicables = [];
  const porConfirmar = [];
  for (const f of FORMULARIOS) {
    if (f.aplicaSegunCaso) {
      const resultado = f.aplicaSegunCaso(caseData);
      if (resultado === 'si') aplicables.push(f);
      else if (resultado === 'por_confirmar') porConfirmar.push(f);
      continue; // 'no' -> no entra en ninguno de los dos grupos.
    }
    if (f.aplica === 'por_confirmar') { porConfirmar.push(f); continue; }
    if (f.aplica.some(t => tags.includes(t))) aplicables.push(f);
  }
  return { aplicables, porConfirmar, tags };
}

module.exports = { FORMULARIOS, APLICA_TAGS, tagsDelCaso, getFormulariosParaCaso };

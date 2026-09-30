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
 * no_comercializados) — o el string `'por_confirmar'` cuando el NOMBRE del
 * formulario no lo dice con certeza (4 de los 13: 1, 2, 3 y 10 — son
 * autorizaciones/declaraciones genéricas de representación legal o de
 * nombre comercial que no mencionan una vía o tipo de solicitud específica).
 * No se adivinó ninguno — ver el comentario de cada entrada.
 *
 * Hueco de datos conocido (documentado, no resuelto aquí): el modelo de
 * casos hoy NO tiene forma de marcar que una solicitud es una RENOVACIÓN —
 * `wizard.js` fija `tipoSolicitud: 'Nuevo Registro'` siempre, sin UI para
 * cambiarlo. Los formularios etiquetados `renovaciones`/`intercambiabilidad`/
 * `no_comercializados` (4, 5, 7, 8, 12, 13) nunca calzarán con el filtro del
 * cliente (`getFormulariosParaCaso`) mientras ese hueco siga abierto — se
 * siguen listando en la biblioteca completa del admin, que no filtra.
 */

const FORMULARIOS = [
  {
    id: 'form-01',
    numero: 1,
    titulo: 'Autorización de Representación Legal en Panamá (otorgada por el Titular)',
    archivo: 'formulario-01-autorizacion-representacion-legal-titular.docx',
    firma: ['titular'],
    aplica: 'por_confirmar',
    notaAplicacion: 'Autorización general de representación legal ante la DNFD — el nombre no especifica vía ni tipo de solicitud. Probablemente aplica a cualquier trámite de medicamentos que requiera representante legal en Panamá, pero no se pudo confirmar con certeza solo con el nombre.',
  },
  {
    id: 'form-02',
    numero: 2,
    titulo: 'Autorización de Representación Legal (otorgada por la Casa Matriz)',
    archivo: 'formulario-02-autorizacion-representacion-legal-casa-matriz.docx',
    firma: ['casa_matriz'],
    aplica: 'por_confirmar',
    notaAplicacion: 'Mismo propósito que el Formulario 1, cuando quien otorga la representación es la casa matriz en vez del titular directamente — el nombre tampoco especifica vía ni tipo de solicitud.',
  },
  {
    id: 'form-03',
    numero: 3,
    titulo: 'Autorización de Trámite de Registro Sanitario al Farmacéutico (Profesional Responsable)',
    archivo: 'formulario-03-autorizacion-tramite-rs-farmaceutico.docx',
    firma: ['titular', 'representante_legal'],
    aplica: 'por_confirmar',
    notaAplicacion: 'El titular (o su representante legal) autoriza a un farmacéutico a actuar como profesional responsable del trámite — el nombre no dice para qué vía o tipo de solicitud.',
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
    aplica: 'por_confirmar',
    notaAplicacion: 'Declara que el nombre comercial coincide con el CLV/CPF — el nombre del formulario no dice si aplica solo a registro nuevo, a alguna vía en particular, o a todas.',
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
 * tag del caso) y los que quedan `por_confirmar` (se muestran aparte, nunca
 * se ocultan ni se afirma que aplican).
 */
function getFormulariosParaCaso(caseData) {
  const tags = tagsDelCaso(caseData);
  const aplicables   = FORMULARIOS.filter(f => f.aplica !== 'por_confirmar' && f.aplica.some(t => tags.includes(t)));
  const porConfirmar = FORMULARIOS.filter(f => f.aplica === 'por_confirmar');
  return { aplicables, porConfirmar, tags };
}

module.exports = { FORMULARIOS, APLICA_TAGS, tagsDelCaso, getFormulariosParaCaso };

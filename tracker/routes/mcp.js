/**
 * Farmazed MCP Server (Streamable HTTP transport)
 * MCP spec: https://spec.modelcontextprotocol.io
 *
 * Claude Cowork installs this as a plugin:
 *   URL: https://api.farmazed.com/mcp
 *   Auth: Bearer <MCP_KEY>
 *
 * Available tools:
 *   farmazed_list_cases        — list cases with optional filters
 *   farmazed_get_case          — full case detail + checklist
 *   farmazed_list_documents    — list documents for a case
 *   farmazed_get_document      — get signed URL for a document
 *   farmazed_get_faddi_context — structured FADDI-fill context
 *   farmazed_update_case       — update status/notes/assignee
 *   farmazed_request_document  — flag a doc as needed from client
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireMcpKey } = require('../middleware/auth');
const { getChecklist }  = require('../data/faddi_checklists');
const { rechazoTramite } = require('../data/tramites_habilitados');
const { getSignedUrl }  = require('../services/storage');
const { CASE_STATUSES, isValidStatus, DOC_STATUSES, PENDING_DOCS } = require('../data/case_status');
const { serializeTimestamps } = require('../utils/serialize');
const { checkTransition, computeSideEffects, afterTransition } = require('../services/transitions');
const { getAcceptedQuoteLineForCase } = require('./quotes');

const router = Router();
const db     = () => admin.firestore();

// ─── MCP Tool definitions ─────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'farmazed_list_cases',
    description: 'List Farmazed client cases. Filter by status, tramiteType, or assignedTo. Returns summary list.',
    inputSchema: {
      type: 'object',
      properties: {
        status:      { type: 'string', description: `Filter by status: ${CASE_STATUSES.join('|')}` },
        tramiteType: { type: 'string', description: 'Filter by type: medicamentos|cosmeticos|higienicos|plaguicidas|excepcion|publicidad' },
        assignedTo:  { type: 'string', description: 'Filter by assigned admin email' },
        limit:       { type: 'number', description: 'Max results (default 50)' },
      },
    },
  },
  {
    name: 'farmazed_get_case',
    description: 'Get complete case details including product data, entities, FADDI field mappings, and document checklist with upload status.',
    inputSchema: {
      type: 'object',
      required: ['caseId'],
      properties: {
        caseId: { type: 'string', description: 'Firestore case document ID (e.g. case_ABC123)' },
      },
    },
  },
  {
    name: 'farmazed_list_documents',
    description: 'List all uploaded documents for a case, organized by FADDI step. Includes upload status and review notes.',
    inputSchema: {
      type: 'object',
      required: ['caseId'],
      properties: {
        caseId: { type: 'string' },
        faddiStep: { type: 'number', description: 'Filter by FADDI step number (e.g. 15)' },
        status: { type: 'string', description: `Filter: ${DOC_STATUSES.join('|')}` },
      },
    },
  },
  {
    name: 'farmazed_get_document',
    description: 'Get a 1-hour signed download URL for a specific document. Use this to open/read a PDF before filling FADDI.',
    inputSchema: {
      type: 'object',
      required: ['caseId', 'docId'],
      properties: {
        caseId: { type: 'string' },
        docId:  { type: 'string', description: 'Document ID from farmazed_list_documents' },
      },
    },
  },
  {
    name: 'farmazed_get_faddi_context',
    description: `Get a structured, FADDI-ready context block for a case.
Returns all data organized by FADDI tab/step, ready to fill the form at
https://sisregsan.minsa.gob.pa/forms/user/{type}/registrar.aspx
Use this at the start of any FADDI fill-assist session.`,
    inputSchema: {
      type: 'object',
      required: ['caseId'],
      properties: {
        caseId: { type: 'string' },
      },
    },
  },
  {
    name: 'farmazed_update_case',
    description: 'Update case status, admin notes, priority or assignee. Use after completing FADDI submission.',
    inputSchema: {
      type: 'object',
      required: ['caseId'],
      properties: {
        caseId:     { type: 'string' },
        status:     { type: 'string', description: `New status value: ${CASE_STATUSES.join('|')}` },
        notes:      { type: 'string', description: 'Internal admin notes' },
        assignedTo: { type: 'string', description: 'Admin email to assign' },
        faddi:      { type: 'object', description: 'FADDI tracking data: { expedienteNumber, solicitudNumber, submittedAt, lastFaddiStatus, observations }' },
        override:   { type: 'boolean', description: 'Fuerza un salto de status fuera del mapa de transiciones validas (queda registrado en el historial del caso)' },
        reason:     { type: 'string', description: 'Motivo del override — se guarda en el historial cuando override=true' },
      },
    },
  },
  {
    name: 'farmazed_request_document',
    description: 'Flag a document as required from the client. Sets its status to "requested" and records what is needed.',
    inputSchema: {
      type: 'object',
      required: ['caseId', 'faddiDocId', 'message'],
      properties: {
        caseId:     { type: 'string' },
        faddiDocId: { type: 'string', description: 'The checklist document ID (e.g. clv, bpm, poder)' },
        message:    { type: 'string', description: 'Specific instructions for the client about what to upload' },
      },
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleListCases({ status, tramiteType, assignedTo, limit = 50 }) {
  let query = db().collection('cases').orderBy('createdAt', 'desc');
  if (status)      query = query.where('status', '==', status);
  if (tramiteType) query = query.where('tramiteType', '==', tramiteType);
  if (assignedTo)  query = query.where('assignedTo', '==', assignedTo);

  const snap  = await query.limit(limit).get();
  const cases = snap.docs.map(d => {
    const data = d.data();
    return {
      id:           d.id,
      status:       data.status,
      tramiteType:  data.tramiteType,
      tipoSolicitud: data.tipoSolicitud,
      tipoRegistro:  data.tipoRegistro,
      productName:  data.product?.nombreComercial || '(sin nombre)',
      clientEmail:  data.clientEmail,
      assignedTo:   data.assignedTo,
      priority:     data.priority,
      createdAt:    data.createdAt?.toDate?.()?.toISOString(),
      updatedAt:    data.updatedAt?.toDate?.()?.toISOString(),
    };
  });
  return { total: cases.length, cases };
}

async function handleGetCase({ caseId }) {
  const snap = await db().collection('cases').doc(caseId).get();
  if (!snap.exists) throw new Error(`Case ${caseId} not found`);

  const data      = snap.data();
  const linea     = await getAcceptedQuoteLineForCase(caseId);
  const checklist = getChecklist(data.tramiteType, {
    tipoRegistro:    data.tipoRegistro,
    tipoMedicamento: data.tipoMedicamento,
    aplicaIEA:       linea?.aplicaIEA,
    esInnovador:     data.esInnovador,
  });

  // Get doc upload status
  const docsSnap   = await db().collection('cases').doc(caseId).collection('documents').get();
  const uploadedMap = {};
  docsSnap.docs.forEach(d => {
    const dd = d.data();
    uploadedMap[dd.faddiDocId] = { docId: d.id, status: dd.status, fileName: dd.fileName };
  });

  const enrichedChecklist = checklist.map(item => ({
    ...item,
    uploadStatus: uploadedMap[item.id] || null,
  }));

  return {
    id:   caseId,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
    checklist: enrichedChecklist,
    documentProgress: {
      uploaded: enrichedChecklist.filter(i => i.uploadStatus).length,
      total:    enrichedChecklist.length,
    },
  };
}

async function handleListDocuments({ caseId, faddiStep, status }) {
  let query = db().collection('cases').doc(caseId).collection('documents').orderBy('uploadedAt', 'desc');
  if (faddiStep) query = query.where('faddiStep', '==', faddiStep);
  if (status)    query = query.where('status', '==', status);

  const snap = await query.get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id:           d.id,
      faddiDocId:   data.faddiDocId,
      faddiCode:    data.faddiCode,
      faddiDocName: data.faddiDocName,
      faddiStep:    data.faddiStep,
      fileName:     data.fileName,
      fileSize:     data.fileSize,
      status:       data.status,
      reviewNotes:  data.reviewNotes,
      uploadedAt:   data.uploadedAt?.toDate?.()?.toISOString(),
    };
  });
}

async function handleGetDocument({ caseId, docId }) {
  const snap = await db().collection('cases').doc(caseId).collection('documents').doc(docId).get();
  if (!snap.exists) throw new Error(`Document ${docId} not found`);

  const data      = snap.data();
  const signedUrl = await getSignedUrl(data.storagePath);

  return {
    id:           docId,
    faddiDocId:   data.faddiDocId,
    faddiCode:    data.faddiCode,
    faddiDocName: data.faddiDocName,
    faddiStep:    data.faddiStep,
    fileName:     data.fileName,
    mimeType:     data.mimeType,
    status:       data.status,
    signedUrl,                          // ← Claude opens this to read the PDF
    expiresIn:    '1 hour',
    uploadedAt:   data.uploadedAt?.toDate?.()?.toISOString(),
  };
}

async function handleGetFaddiContext({ caseId }) {
  const caseData = await handleGetCase({ caseId });
  const { product = {}, entities = {}, monografia = {}, tramiteType, tipoSolicitud, tipoRegistro, tipoMedicamento = [] } = caseData;

  const faddiUrl = {
    medicamentos: 'https://sisregsan.minsa.gob.pa/forms/user/medicamentos/registrar.aspx',
    cosmeticos:   'https://sisregsan.minsa.gob.pa/forms/user/cosmeticos/registrar.aspx',
    higienicos:   'https://sisregsan.minsa.gob.pa/forms/user/higienicos/registrar.aspx',
    plaguicidas:  'https://sisregsan.minsa.gob.pa/forms/user/plaguicidas/registrar.aspx',
    excepcion:    'https://sisregsan.minsa.gob.pa/forms/user/excepcion/registrar.aspx',
    publicidad:   'https://sisregsan.minsa.gob.pa/forms/user/publicidad/registrar.aspx',
  }[tramiteType] || '';

  // Build FADDI-step-by-step context
  const context = {
    meta: {
      caseId,
      tramiteType,
      faddiUrl,
      instructions: `Navigate to ${faddiUrl}. Fill each field exactly as specified. Do NOT click submit/finalizar until the admin confirms. Use farmazed_get_document to open PDFs when you need to verify data.`,
    },
    steps: {},
    documents: {},
  };

  // Build per-tramite context
  if (tramiteType === 'medicamentos') {
    context.steps['paso_1_2'] = {
      label: 'Paso 1 y 2 — Datos de la Solicitud + Tipo de Medicamento',
      fields: [
        { faddiLabel: '1.1 Tipo de Solicitud',   faddiTab: 'Paso 1 y 2', value: tipoSolicitud },
        { faddiLabel: '1.2 Tipo de Registro',     faddiTab: 'Paso 1 y 2', value: tipoRegistro },
        { faddiLabel: '2.1 Tipo de Medicamento (checkboxes)', faddiTab: 'Paso 1 y 2', value: tipoMedicamento.join(', ') || '⚠️ NOT SET' },
      ],
    };
    context.steps['paso_3'] = {
      label: 'Paso 3 — Datos del Producto + Presentaciones',
      fields: [
        { faddiLabel: '3.1.1 Nombre de Producto',              value: product.nombreComercial || '⚠️ NOT SET' },
        { faddiLabel: '3.1.2 Nombre del Principio Activo (DCI)', value: product.principioActivo || '⚠️ NOT SET' },
        { faddiLabel: '3.1.3 Concentración',                   value: product.concentracion || '⚠️ NOT SET' },
        { faddiLabel: '3.1.4 Forma Farmacéutica',              value: product.formaFarmaceutica || '⚠️ NOT SET' },
        { faddiLabel: '3.1.5 Vía de Administración',           value: product.viaAdministracion || '⚠️ NOT SET' },
        { faddiLabel: '3.1.6 Condición de Venta',              value: product.condicionVenta || '⚠️ NOT SET' },
        { faddiLabel: '3.1.7 Código ATC',                      value: product.codigoATC || '—' },
        { faddiLabel: '3.1.8 Descripción de Envase',           value: product.descripcionEnvase || '—' },
        { faddiLabel: '3.1.9 Vida Útil',                       value: product.vidaUtil || '⚠️ NOT SET' },
        { faddiLabel: '3.1.10 Condiciones de Almacenamiento',  value: product.condicionesAlmacenamiento || '—' },
        { faddiLabel: '3.2.1 Tipo de Presentación',            value: product.tipoPresentacion || 'Comercial' },
        { faddiLabel: '3.2.2 Descripción de la Presentación',  value: product.descripcionPresentacion || '⚠️ NOT SET' },
      ],
    };
    context.steps['paso_4'] = {
      label: 'Paso 4 — Fabricantes',
      fields: [
        { section: '4.1 Fabricante Principal', fields: [
          { faddiLabel: '4.1.1 Correo',    value: entities.fabricante?.correo    || '⚠️ NOT SET' },
          { faddiLabel: '4.1.2 Nombre',    value: entities.fabricante?.nombre    || '⚠️ NOT SET' },
          { faddiLabel: '4.1.3 País',      value: entities.fabricante?.pais      || '⚠️ NOT SET' },
          { faddiLabel: '4.1.4 Dirección', value: entities.fabricante?.direccion || '⚠️ NOT SET' },
        ]},
        { section: '4.2 Fabricante del Diluyente (si aplica)', fields: [
          { faddiLabel: '4.2.1 Correo', value: entities.fabricanteDiluyente?.correo || '(No aplica)' },
        ]},
        { section: '4.3 Fabricante del Principio Activo (si aplica)', fields: [
          { faddiLabel: '4.3.1 Correo', value: entities.fabricantePrincipioActivo?.correo || '(No aplica)' },
        ]},
      ],
    };
    context.steps['paso_5'] = {
      label: 'Paso 5 — Acondicionador',
      fields: [
        { faddiLabel: '5.1 Tipo de Acondicionador', value: entities.acondicionador?.tipo || 'No Aplica [El Fabricante Es Acondicionador Primario y Secundario]' },
        { faddiLabel: '5.1.2.1 Correo (Primario)',  value: entities.acondicionador?.correo    || '—' },
        { faddiLabel: '5.1.2.2 Nombre',              value: entities.acondicionador?.nombre    || '—' },
        { faddiLabel: '5.1.2.3 País',                value: entities.acondicionador?.pais      || '—' },
        { faddiLabel: '5.1.2.4 Dirección',           value: entities.acondicionador?.direccion || '—' },
      ],
    };
    context.steps['paso_6'] = {
      label: 'Paso 6 — Titular',
      fields: [
        { faddiLabel: '6.1 Correo',    value: entities.titular?.correo    || '⚠️ NOT SET' },
        { faddiLabel: '6.2 Nombre',    value: entities.titular?.nombre    || '⚠️ NOT SET' },
        { faddiLabel: '6.3 País',      value: entities.titular?.pais      || '⚠️ NOT SET' },
        { faddiLabel: '6.4 Dirección', value: entities.titular?.direccion || '⚠️ NOT SET' },
      ],
    };
    context.steps['paso_7'] = {
      label: 'Paso 7 — Distribuidor(es)',
      fields: (entities.distribuidores || []).map((d, i) => ({
        faddiLabel: `7.1 Distribuidor ${i + 1} — N° Licencia`, value: d.numeroLicencia || '⚠️ NOT SET',
      })),
    };
    context.steps['paso_8'] = {
      label: 'Paso 8 — Empresa Solicitante',
      fields: [
        { faddiLabel: '8.1 RUC',       value: entities.solicitante?.ruc       || '—' },
        { faddiLabel: '8.2 Nombre',    value: entities.solicitante?.nombre    || '⚠️ NOT SET' },
        { faddiLabel: '8.3 Teléfono',  value: entities.solicitante?.telefono  || '⚠️ NOT SET' },
        { faddiLabel: '8.4 Correo',    value: entities.solicitante?.correo    || '⚠️ NOT SET' },
        { faddiLabel: '8.5 Dirección', value: entities.solicitante?.direccion || '⚠️ NOT SET' },
      ],
    };
    context.steps['paso_9'] = {
      label: 'Paso 9 — Representante Legal',
      fields: [
        { faddiLabel: '9.1 Cédula',    value: entities.representanteLegal?.cedula    || '—' },
        { faddiLabel: '9.2 Nombre',    value: entities.representanteLegal?.nombre    || '⚠️ NOT SET' },
        { faddiLabel: '9.3 Teléfono',  value: entities.representanteLegal?.telefono  || '⚠️ NOT SET' },
        { faddiLabel: '9.4 Correo',    value: entities.representanteLegal?.correo    || '⚠️ NOT SET' },
        { faddiLabel: '9.5 Dirección', value: entities.representanteLegal?.direccion || '⚠️ NOT SET' },
      ],
    };
    context.steps['paso_10'] = {
      label: 'Paso 10 — Abogado',
      fields: [
        { faddiLabel: '10.1 Cédula',     value: entities.abogado?.cedula     || '—' },
        { faddiLabel: '10.2 Nombre',     value: entities.abogado?.nombre     || '—' },
        { faddiLabel: '10.3 Teléfono',   value: entities.abogado?.telefono   || '—' },
        { faddiLabel: '10.4 Correo',     value: entities.abogado?.correo     || '—' },
        { faddiLabel: '10.5 Dirección',  value: entities.abogado?.direccion  || '—' },
        { faddiLabel: '10.6 Idoneidad',  value: entities.abogado?.idoneidad  || '—' },
      ],
    };
    context.steps['paso_11'] = {
      label: 'Paso 11 — Farmacéutico + RCPR',
      fields: [
        { faddiLabel: '11.1.1 Cédula Farm.',    value: entities.farmaceutico?.cedula    || '⚠️ NOT SET' },
        { faddiLabel: '11.1.2 Idoneidad',        value: entities.farmaceutico?.idoneidad || '⚠️ NOT SET' },
        { faddiLabel: '11.1.3 Nombre',           value: entities.farmaceutico?.nombre    || '⚠️ NOT SET' },
        { faddiLabel: '11.1.4 Teléfono',         value: entities.farmaceutico?.telefono  || '—' },
        { faddiLabel: '11.1.5 Correo',           value: entities.farmaceutico?.correo    || '—' },
        { faddiLabel: '11.1.6 Dirección',        value: entities.farmaceutico?.direccion || '—' },
        { faddiLabel: '11.2.1 Cédula RCPR',      value: entities.rcpr?.cedula    || '—' },
        { faddiLabel: '11.2.2 Idoneidad RCPR',   value: entities.rcpr?.idoneidad || '—' },
        { faddiLabel: '11.2.3 Nombre RCPR',      value: entities.rcpr?.nombre    || '—' },
      ],
    };
    context.steps['paso_12'] = {
      label: 'Paso 12 — Monografía',
      fields: [
        { faddiLabel: '12.1 Indicaciones Terapéuticas', value: monografia.indicacionesTerapeuticas || '(dejar en blanco — se llenará según inserto)' },
        { faddiLabel: '12.2 Contraindicaciones',         value: monografia.contraindicaciones       || '(dejar en blanco — se llenará según inserto)' },
      ],
    };
    context.steps['paso_13'] = {
      label: 'Paso 13 — Bioequivalencia',
      fields: [
        { faddiLabel: '13.1 Requiere bioequivalencia', value: product.requiereBioequivalencia || 'NO' },
      ],
    };
    context.steps['paso_14'] = {
      label: 'Paso 14 — Farmacovigilancia',
      fields: [
        { faddiLabel: '14.1.1 Nombre',  value: entities.responsableFarmacovigilancia?.nombre    || '—' },
        { faddiLabel: '14.1.2 Cédula',  value: entities.responsableFarmacovigilancia?.cedula    || '—' },
        { faddiLabel: '14.1.3 Correo',  value: entities.responsableFarmacovigilancia?.correo    || '—' },
        { faddiLabel: '14.1.4 Dir.',    value: entities.responsableFarmacovigilancia?.direccion || '—' },
        { faddiLabel: '14.2.1 Certificado Dietilenglicol',   value: 'NO' },
        { faddiLabel: '14.2.2 Psicotrópico o Estupefaciente', value: product.esPsicotropico ? 'SI' : 'NO' },
        { faddiLabel: '14.2.6 Inserto', value: product.tieneInserto ? 'SI' : 'NO' },
      ],
    };
    context.steps['paso_15_16'] = {
      label: 'Paso 15 — Documentos Adjuntos (subir en FADDI) + Paso 16 — Culminación',
      note: 'Use farmazed_list_documents to get signed URLs for each file, then upload them one by one in FADDI step 15. Max 50 MB per file.',
    };
  }

  // Attach document index
  const docsSnap = await db().collection('cases').doc(caseId).collection('documents').get();
  docsSnap.docs.forEach(d => {
    const dd = d.data();
    context.documents[dd.faddiDocId] = {
      docId:       d.id,
      faddiCode:   dd.faddiCode,
      faddiDocName: dd.faddiDocName,
      faddiStep:   dd.faddiStep,
      fileName:    dd.fileName,
      status:      dd.status,
      note: `Call farmazed_get_document(caseId="${caseId}", docId="${d.id}") to get the signed URL.`,
    };
  });

  return context;
}

async function handleUpdateCase({ caseId, status, notes, assignedTo, faddi, tramiteType, override, reason }) {
  // F-6: tramiteType no es un campo actualizable de esta herramienta; si un
  // cliente MCP lo manda, debe ser un trámite habilitado (antes se ignoraba).
  if (tramiteType !== undefined) {
    const rechazo = rechazoTramite(tramiteType);
    if (rechazo) {
      throw Object.assign(new Error(rechazo.body.error), { rpcCode: -32602, rpcData: rechazo.body });
    }
  }

  // D06/D06b (07 §4#8, §5): esta es la segunda ruta de escritura de status —
  // sin esto, cualquier cliente MCP puede saltarse por completo la
  // validacion de cases.js. Error sin rpcCode -> el handler por defecto lo
  // manda como -32000 (ver mcpError() mas abajo).
  if (status !== undefined && !isValidStatus(status)) {
    throw new Error(`status invalido: "${status}". Validos: ${CASE_STATUSES.join(', ')}`);
  }

  let caseData = null;
  if (status !== undefined) {
    const snap = await db().collection('cases').doc(caseId).get();
    if (!snap.exists) throw Object.assign(new Error('Case not found'), { rpcCode: -32602 });
    caseData = snap.data();
  }

  const update = { updatedAt: admin.firestore.Timestamp.now() };
  if (status     !== undefined) update.status     = status;
  if (notes      !== undefined) update.notes      = notes;
  if (assignedTo !== undefined) update.assignedTo = assignedTo;
  if (faddi      !== undefined) update.faddi       = faddi;

  // TAREA 22 (ajuste PM sobre TAREA 21): mismos gates que cases.js (REST),
  // vía tracker/services/transitions.js — antes esta ruta solo repetía
  // transición+pago, sin cotización de fase_04 ni las dos confirmaciones de
  // fase_08 (hueco de cumplimiento real: Cowork podía saltárselos). El
  // permiso por ROL (canTransitionCase) no aplica aquí — MCP_KEY ya es
  // acceso de nivel admin, sin usuario individual en esta capa.
  const isRealTransition = status !== undefined
    && (status !== caseData.status || (status === 'fase_08' && caseData.status === 'fase_08'));
  let gateResult = { ok: true, gatesSaltados: [], isFase8Recycle: false };

  if (isRealTransition) {
    gateResult = await checkTransition(caseData, caseId, status, { override: override === true, reason });
    if (!gateResult.ok) {
      throw new Error(gateResult.error.replace('{"override":true}', 'override:true en la llamada MCP'));
    }
    Object.assign(update, computeSideEffects(caseData, status, gateResult.isFase8Recycle));
  }

  await db().collection('cases').doc(caseId).update(update);

  if (isRealTransition) {
    const isOverride = gateResult.gatesSaltados.length > 0 && override === true;
    const registrarMotivo = isOverride || status === 'cerrado';
    await db().collection('cases').doc(caseId).collection('statusHistory').add({
      from: caseData.status, to: status,
      override: isOverride,
      reason: registrarMotivo ? (reason || '') : null,
      by: 'mcp', byEmail: null,
      at: admin.firestore.Timestamp.now(),
    });
    await afterTransition(caseId, caseData, status, { uid: 'mcp', email: null });
  }

  return { updated: true, caseId, fields: Object.keys(update) };
}

async function handleRequestDocument({ caseId, faddiDocId, message }) {
  const now = admin.firestore.Timestamp.now();
  // Check if doc already exists with that faddiDocId
  const existing = await db()
    .collection('cases').doc(caseId)
    .collection('documents')
    .where('faddiDocId', '==', faddiDocId)
    .limit(1).get();

  if (!existing.empty) {
    // Update existing doc to "requested" status
    await existing.docs[0].ref.update({ status: 'requested', reviewNotes: message, reviewedAt: now });
  } else {
    // Create a placeholder entry
    await db().collection('cases').doc(caseId).collection('documents').add({
      faddiDocId,
      faddiCode: '',
      faddiDocName: '',
      faddiStep: 0,
      fileName: '(pendiente)',
      fileSize: 0,
      mimeType: '',
      storagePath: '',
      status: 'requested',
      reviewNotes: message,
      uploadedAt: now,
      uploadedBy: 'admin',
    });
  }

  // Update case status to pending_docs. Entrar a pending_docs es siempre
  // valido desde cualquier fase (isValidTransition — §H.1), pero se registra
  // igual para el historial de auditoria de las 3 rutas de escritura.
  const caseSnap = await db().collection('cases').doc(caseId).get();
  const prevStatus = caseSnap.exists ? caseSnap.data().status : null;

  await db().collection('cases').doc(caseId).update({
    status: PENDING_DOCS,
    updatedAt: now,
  });

  if (prevStatus !== null && prevStatus !== PENDING_DOCS) {
    await db().collection('cases').doc(caseId).collection('statusHistory').add({
      from: prevStatus, to: PENDING_DOCS, override: false,
      by: 'mcp', byEmail: null, at: now,
    });
  }

  return { requested: true, faddiDocId, message };
}

// ─── MCP JSON-RPC handler ────────────────────────────────────────────────────

const HANDLERS = {
  farmazed_list_cases:       handleListCases,
  farmazed_get_case:         handleGetCase,
  farmazed_list_documents:   handleListDocuments,
  farmazed_get_document:     handleGetDocument,
  farmazed_get_faddi_context: handleGetFaddiContext,
  farmazed_update_case:      handleUpdateCase,
  farmazed_request_document: handleRequestDocument,
};

function mcpSuccess(id, result) {
  return { jsonrpc: '2.0', result, id };
}
function mcpError(id, code, message, data) {
  return { jsonrpc: '2.0', error: { code, message, ...(data !== undefined && { data }) }, id };
}

router.post('/', requireMcpKey, async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const { jsonrpc, method, params = {}, id } = req.body || {};

  if (jsonrpc !== '2.0') {
    return res.status(400).json(mcpError(id, -32600, 'Invalid JSON-RPC version'));
  }

  // ── initialize ──────────────────────────────────────────────────────────────
  if (method === 'initialize') {
    return res.json(mcpSuccess(id, {
      protocolVersion: '2024-11-05',
      capabilities:    { tools: {} },
      serverInfo:      { name: 'farmazed-mcp', version: '2.0.0' },
    }));
  }

  // ── notifications/initialized ───────────────────────────────────────────────
  if (method === 'notifications/initialized') {
    return res.status(204).end();
  }

  // ── tools/list ──────────────────────────────────────────────────────────────
  if (method === 'tools/list') {
    return res.json(mcpSuccess(id, { tools: TOOLS }));
  }

  // ── tools/call ──────────────────────────────────────────────────────────────
  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params;
    const handler = HANDLERS[name];

    if (!handler) {
      return res.json(mcpError(id, -32601, `Unknown tool: ${name}`));
    }

    try {
      const result = await handler(args);
      return res.json(mcpSuccess(id, {
        content: [{ type: 'text', text: JSON.stringify(serializeTimestamps(result), null, 2) }],
      }));
    } catch (e) {
      return res.json(mcpError(id, e.rpcCode || -32000, e.message, e.rpcData));
    }
  }

  return res.json(mcpError(id, -32601, `Unknown method: ${method}`));
});

// ── GET /mcp — metadata for Cowork plugin discovery ─────────────────────────
router.get('/', (req, res) => {
  res.json({
    name:        'Farmazed',
    version:     '2.0.0',
    description: 'Gestión de expedientes regulatorios y asistencia de llenado FADDI/DNFD',
    transport:   'streamable-http',
    endpoint:    '/mcp',
    auth:        'Bearer token — contact Farmazed admin for your MCP_KEY',
    // D06c (07 §4#9): incluir inputSchema, no solo el nombre — es donde
    // viven las descripciones generadas desde CASE_STATUSES/DOC_STATUSES
    // (ver TOOLS arriba). Sin esto, GET /mcp nunca mostraba el enum.
    tools:       TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  });
});

module.exports = router;

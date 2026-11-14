/**
 * demo.js — Modo demo (decisión de Rick, 01-nov-2026; ampliado a 4 cuentas el 08-nov, a 5 con admin.demo el 13-nov y
 * con la cuenta de SIMULACIÓN el 14-nov): cuentas de demostración con datos de ejemplo para que un prospecto (cliente)
 * o un empleado nuevo (Responsable Farmacéutico o Legal) recorra la plataforma, y un reinicio que lo deja todo como al
 * principio. Lo usan scripts/seed_demo.js (CLI), routes/demo.js (POST /api/demo/reiniciar) y tests/demo.test.js.
 *
 * Cuentas (producción, públicas por diseño; Rick 01-nov y 08-nov): cliente.demo, regente.demo y
 * farmaceutico.demo (las dos con rol `regente` = Responsable Farmacéutico) y legal.demo (rol `abogado` =
 * Responsable Legal) y admin.demo (rol `admin`), todas @farmazed.com. El personal demo solo ve los casos demo:true
 * (los de ejemplo) y el admin demo solo lo de la empresa demo (demo:true o `demo-org`; ver utils/demo_scope.js y
 * middleware/demo_admin.js): por eso conviven con clientes reales en el mismo despliegue. Lo global (precios,
 * configuración, facturación, invitaciones, usuarios reales) el admin demo lo ve pero no lo guarda.
 *
 * DOS ÁMBITOS aislados con los mismos datos de ejemplo (AMBITOS):
 *   - `demo-org`  — las 5 cuentas demo de arriba.
 *   - `sim-org`   — la cuenta `simulacion@farmazed.com` (Rick, 14-nov-2026): UNA cuenta genérica para entrenar y
 *     evaluar al personal, con claims demo:true + simulacion:true + orgId sim-org. Cambia de PERFIL (Cliente, Admin,
 *     Responsable Farmacéutico, Responsable Legal) desde el topbar (cabecera X-Fz-Perfil, middleware/auth.js) y recorre
 *     el flujo de la A a la Z sobre el MISMO expediente: como cliente lo crea y paga (PayPal sandbox), como admin
 *     ajusta y envía la cotización, como farmacéutico y legal confirma la fase 8. Todo lo de sim-org lleva `sim:true`.
 *
 * Aislamiento: todo lo demo lleva `demo:true` (claims, empresa, casos, cotizaciones, lead) y el reinicio borra SOLO lo
 * de su ámbito. Una cuenta demo nunca paga con dinero real (services/payments getProvider(user): PayPal SANDBOX o el
 * mock, nunca la API live) ni recibe correos (services/correo.js omite los correos `*.demo@` y `simulacion@`).
 *
 * Estado inicial del recorrido (igual en los dos ámbitos): empresa sin captación (paso 1 del cliente), sin "Producto
 * Ejemplo 1" (lo crea el cliente), "Producto Ejemplo 2" con cotización enviada (aceptar y pagar), "Producto Ejemplo 3"
 * pagado y en fase 8 (el Responsable Farmacéutico confirma el cotejo técnico y el Legal la parte legal), con mensajes, y
 * "Producto Ejemplo 4" en fase 4 con la cotización en borrador (la ajusta y envía el admin).
 */
const admin = require('../utils/firebase_admin.js');
const { createConceptPayment } = require('./payments_ledger');
const { uploadFile, deleteFile } = require('./storage');
const { pdfFormulaEjemplo, pdfPoderEjemplo } = require('../utils/pdf_ejemplo');
const { applyTransition } = require('./transitions');

const { DEMO_ORG_ID, SIM_ORG_ID, ORGS_AISLADAS, esCuentaDemo, esDocDelAmbito } = require('../utils/demo_scope');

// Actor de los avances automáticos de la demo (statusHistory.by / byEmail).
const ACTOR_DEMO = { uid: 'demo-automatico', email: 'Farmazed (avance automático de la demo)' };
const DEMO_DOMINIO = process.env.DEMO_DOMINIO || 'farmazed.com';
// *.demo@ (las 5 cuentas demo) y simulacion@ (la cuenta de simulación): a ninguna se le manda correo.
const CORREO_DEMO_RE = /^([a-z0-9-]+\.demo|simulacion)@/i;

// Las claves NO viven en el repo (es público): DEMO_PASSWORD_CLIENTE / _REGENTE / _FARMACEUTICO / _LEGAL / _ADMIN /
// _SIMULACION (Secret Manager en Cloud Run, tracker/.env en local). Obligatorias para crear la cuenta la
// primera vez; si faltan en un reinicio, la cuenta conserva la clave que ya tenía.
const CUENTAS = [
  { uid: 'demo-cliente', correo: `cliente.demo@${DEMO_DOMINIO}`, nombre: 'Cliente Ejemplo', role: 'cliente_titular', orgId: DEMO_ORG_ID,
    get password() { return process.env.DEMO_PASSWORD_CLIENTE || null; } },
  { uid: 'demo-regente', correo: `regente.demo@${DEMO_DOMINIO}`, nombre: 'Regente Ejemplo', role: 'regente',
    get password() { return process.env.DEMO_PASSWORD_REGENTE || null; } },
  { uid: 'demo-farmaceutico', correo: `farmaceutico.demo@${DEMO_DOMINIO}`, nombre: 'Responsable Farmacéutico Ejemplo', role: 'regente',
    get password() { return process.env.DEMO_PASSWORD_FARMACEUTICO || null; } },
  { uid: 'demo-legal', correo: `legal.demo@${DEMO_DOMINIO}`, nombre: 'Responsable Legal Ejemplo', role: 'abogado',
    get password() { return process.env.DEMO_PASSWORD_LEGAL || null; } },
  { uid: 'demo-admin', correo: `admin.demo@${DEMO_DOMINIO}`, nombre: 'Administrador Ejemplo', role: 'admin',
    get password() { return process.env.DEMO_PASSWORD_ADMIN || null; } },
];
// Cuenta de simulación: nace como cliente (perfil por defecto); los demás perfiles los toma por cabecera. El uid empieza por
// `demo-` como el resto del personal demo (routes/cases.js asignacionEsDemo lo acepta en `asignados`).
const CUENTA_SIMULACION = {
  uid: 'demo-simulacion', correo: `simulacion@${DEMO_DOMINIO}`, nombre: 'Simulación Farmazed', role: 'cliente_titular', orgId: SIM_ORG_ID, simulacion: true,
  get password() { return process.env.DEMO_PASSWORD_SIMULACION || null; },
};

/**
 * Los dos ámbitos: ids fijos de lo sembrado (el recorrido, demo_recorrido.js, los usa para distinguir lo que trae el
 * seed de lo que la persona creó), cuentas, empresa y quién figura como cliente y como personal asignado.
 */
const AMBITOS = {
  [DEMO_ORG_ID]: {
    orgId: DEMO_ORG_ID, prefijo: 'demo', codigo: 'FZ-DEMO', sim: false, nombreEmpresa: 'Laboratorios Ejemplo S.A.',
    website: 'https://www.laboratorios-ejemplo.example', cuentas: CUENTAS,
    cliente: { uid: 'demo-cliente', correo: `cliente.demo@${DEMO_DOMINIO}`, nombre: 'Cliente Ejemplo' },
    regente: { uid: 'demo-regente', nombre: 'Responsable Farmacéutico Ejemplo' },
    asignados: { analista: null, abogado: 'demo-legal', regente: 'demo-regente' },
  },
  [SIM_ORG_ID]: {
    orgId: SIM_ORG_ID, prefijo: 'sim', codigo: 'FZ-SIM', sim: true, nombreEmpresa: 'Laboratorio Simulación S.A.',
    website: 'https://www.laboratorio-simulacion.example', cuentas: [CUENTA_SIMULACION],
    cliente: { uid: 'demo-simulacion', correo: `simulacion@${DEMO_DOMINIO}`, nombre: 'Simulación Farmazed' },
    regente: { uid: 'demo-simulacion', nombre: 'Simulación Farmazed (Responsable Farmacéutico)' },
    asignados: { analista: null, abogado: 'demo-simulacion', regente: 'demo-simulacion' },
  },
};

/** Ids de lo sembrado en un ámbito (`demo-caso-2`, `sim-cotizacion-4`, …). */
function idsDe(ambitoId = DEMO_ORG_ID) {
  const p = AMBITOS[ambitoId]?.prefijo || 'demo';
  return {
    caso2: `${p}-caso-2`, caso3: `${p}-caso-3`, caso4: `${p}-caso-4`,
    cotizacion2: `${p}-cotizacion-2`, cotizacion3: `${p}-cotizacion-3`, cotizacion4: `${p}-cotizacion-4`,
    msg1: `${p}-msg-1`, msg2: `${p}-msg-2`,
    docRegente: `${p}-doc-3-formula`, // fórmula cuali-cuantitativa subida en el Producto 3, la revisa el Responsable Farmacéutico
    docLegal: `${p}-doc-3-poder`,     // poder original (15.2) subido en el Producto 3, lo revisa el Responsable Legal
    lead: `${p}-lead-1`,
    orden3: `${p.toUpperCase()}-ORDEN-0003`, captura3: `${p.toUpperCase()}-CAPTURA-0003`,
    casosSembrados: [`${p}-caso-2`, `${p}-caso-3`, `${p}-caso-4`], mensajesSembrados: [`${p}-msg-1`, `${p}-msg-2`],
  };
}
// Compatibilidad: los ids de la demo clásica con sus nombres de siempre.
const IDS_DEMO = idsDe(DEMO_ORG_ID);
const CASOS_SEMBRADOS    = IDS_DEMO.casosSembrados;
const CASO_ADMIN_ID      = IDS_DEMO.caso4;        // Producto 4: en fase 4 con la cotización en borrador, para que el admin demo la ajuste y la envíe
const COTIZACION_ADMIN_ID = IDS_DEMO.cotizacion4;
const MENSAJES_SEMBRADOS = IDS_DEMO.mensajesSembrados;
const DOC_REGENTE_ID     = IDS_DEMO.docRegente;
const DOC_LEGAL_ID       = IDS_DEMO.docLegal;

const esCorreoDemo = (correo) => CORREO_DEMO_RE.test(String(correo || ''));
/** Aislamiento de las cuentas demo: solo ven/tocan documentos de SU ámbito (demo-org o sim-org); una cuenta normal, todo. */
const visibleParaDemo = (user, doc) => !esCuentaDemo(user) || esDocDelAmbito(user, doc);

const db   = () => admin.firestore();
const auth = () => admin.auth();

function ambitoOFalla(ambitoId) {
  const a = AMBITOS[ambitoId];
  if (!a) throw new Error(`Ámbito demo desconocido: ${ambitoId} (válidos: ${ORGS_AISLADAS.join(', ')})`);
  return a;
}

async function upsertCuenta(c) {
  const datos = { email: c.correo, displayName: c.nombre, emailVerified: true, ...(c.password ? { password: c.password } : {}) };
  try { await auth().updateUser(c.uid, datos); }
  catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    if (!c.password) throw new Error(`Falta la variable con la clave de ${c.correo} (DEMO_PASSWORD_CLIENTE / _REGENTE / _FARMACEUTICO / _LEGAL / _ADMIN / _SIMULACION) para crear la cuenta.`);
    await auth().createUser({ uid: c.uid, ...datos });
  }
  await auth().setCustomUserClaims(c.uid, {
    role: c.role, ...(c.orgId ? { orgId: c.orgId } : {}), demo: true, origen: 'demo', ...(c.simulacion ? { simulacion: true } : {}),
  });
  await auth().revokeRefreshTokens(c.uid); // una sesión abierta antes del reinicio vuelve a pedir login
}

function casoBase(amb, overrides) {
  const now = admin.firestore.Timestamp.now();
  return {
    createdAt: now, updatedAt: now, demo: true, ...(amb.sim ? { sim: true } : {}),
    tramiteType: 'medicamentos', tipoSolicitud: 'Nuevo Registro', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'],
    orgId: amb.orgId, clientId: amb.cliente.uid, clientEmail: amb.cliente.correo, clientName: amb.cliente.nombre,
    asignados: { ...amb.asignados }, // el resto del personal demo ve los casos por demo:true (middleware/permissions.js canAccessCase)
    assignedTo: null, priority: 'normal', notes: '', faddi: {}, vencimiento: null, entities: {}, monografia: {},
    ...overrides,
  };
}

// Montos de la fila "Síntesis química Procedimiento Regular" del tarifario 24-sep (seed_pricing_24sep.js),
// fijos aquí para que la demo no dependa de que el tarifario esté sembrado.
const CONCEPTOS_EJEMPLO = { honorarios: 1855, tasa_dnfd: 750, mef: 25, iea: 1500 };
function lineaCotizacion(caseId, caseCode) {
  const honorariosFarmazed = CONCEPTOS_EJEMPLO.honorarios;
  const tasasOficiales = CONCEPTOS_EJEMPLO.tasa_dnfd + CONCEPTOS_EJEMPLO.mef + CONCEPTOS_EJEMPLO.iea;
  return {
    caseId, caseCode, tipo: 'principal', categoriaPrecio: 'med_regular_sintesis_24sep',
    tarifarioHonorarios: honorariosFarmazed, tarifarioTasas: tasasOficiales,
    honorariosFarmazed, tasasOficiales, monto: honorariosFarmazed + tasasOficiales,
    tarifarioConceptos: { ...CONCEPTOS_EJEMPLO }, conceptos: { ...CONCEPTOS_EJEMPLO },
    ajustado: false, motivoAjuste: null, esExtranjero: false, aplicaIEA: false, modalidadIEA: null,
  };
}

/** Borra la empresa del ámbito con todo lo que cuelga de ella (casos y sus subcolecciones, cotizaciones, lead, invitaciones). */
async function borrarDatosDemo(ambitoId = DEMO_ORG_ID) {
  const amb = ambitoOFalla(ambitoId);
  const borrados = { casos: 0, cotizaciones: 0, leads: 0, invitaciones: 0 };
  const casos = await db().collection('cases').where('orgId', '==', amb.orgId).get();
  for (const caso of casos.docs) {
    for (const sub of await caso.ref.listCollections()) {
      const docs = await sub.get();
      for (const d of docs.docs) {
        // Los archivos de los documentos (los del seed y los que subió la persona en la demo)
        // también se borran de Storage: si no, cada reinicio dejaría archivos huérfanos.
        const { storagePath } = d.data();
        if (sub.id === 'documents' && storagePath) {
          await deleteFile(storagePath).catch(err => console.error('[demo] no se pudo borrar el archivo', { storagePath, error: err.message }));
        }
        await d.ref.delete();
      }
    }
    await caso.ref.delete();
    borrados.casos++;
  }
  for (const [coleccion, campo, valor, clave] of [
    ['quotes', 'orgId', amb.orgId, 'cotizaciones'],
    ['invitations', 'orgId', amb.orgId, 'invitaciones'],
  ]) {
    const snap = await db().collection(coleccion).where(campo, '==', valor).get();
    for (const d of snap.docs) { await d.ref.delete(); borrados[clave]++; }
  }
  // Los leads no tienen orgId: los de la simulación llevan sim:true, los de la demo no. Solo se borran los del ámbito.
  const leads = await db().collection('contactLeads').where('demo', '==', true).get();
  for (const d of leads.docs) {
    if ((d.data().sim === true) !== amb.sim) continue;
    await d.ref.delete(); borrados.leads++;
  }
  await db().collection('orgs').doc(amb.orgId).delete();
  return borrados;
}

/** Deja las cuentas y los datos del ámbito en el estado inicial del recorrido. Idempotente. */
async function sembrarDemo(ambitoId = DEMO_ORG_ID) {
  const amb = ambitoOFalla(ambitoId);
  const I = idsDe(amb.orgId);
  const marca = { demo: true, ...(amb.sim ? { sim: true } : {}) };
  await borrarDatosDemo(amb.orgId);
  const now = admin.firestore.Timestamp.now();
  for (const c of amb.cuentas) await upsertCuenta(c);

  await db().collection('orgs').doc(amb.orgId).set({
    nombre: amb.nombreEmpresa, ...marca, plan: 'registro', pais: 'Panamá',
    telefonoContacto: '+507 6000-0000', website: amb.website,
    createdAt: now, createdBy: 'seed_demo',
    prefillCaptacion: {
      paisYNombreFabricante: `Panamá — ${amb.nombreEmpresa}`,
      categoriasProducto: ['medicamentos'], productosPorCategoria: { medicamentos: 3 },
    },
  });

  // Producto 2: cotización enviada, esperando que el cliente la acepte y pague.
  await db().collection('cases').doc(I.caso2).set(casoBase(amb, {
    status: 'fase_04', caseCode: `${amb.codigo}-2026-0002`,
    product: { nombreComercial: 'Producto Ejemplo 2 — Analgésico 500 mg', formaFarmaceutica: 'Tableta', fabricante: amb.nombreEmpresa },
  }));
  await db().collection('quotes').doc(I.cotizacion2).set({
    orgId: amb.orgId, ...marca, caseIds: [I.caso2], estado: 'enviada',
    lineas: [lineaCotizacion(I.caso2, `${amb.codigo}-2026-0002`)], total: 4130,
    historial: [{ tipo: 'linea_agregada', caseId: I.caso2, por: 'seed_demo', at: now }, { tipo: 'enviada', por: 'seed_demo', at: now }],
    createdAt: now, updatedAt: now, enviadaEn: now,
  });

  // Producto 4: en fase 4 con la cotización en BORRADOR (en la vida real la crea el sistema al llegar a fase 4):
  // el admin la revisa y la "envía" (simulado: sin correo); el cliente la ve y puede pagarla.
  await db().collection('cases').doc(I.caso4).set(casoBase(amb, {
    status: 'fase_04', caseCode: `${amb.codigo}-2026-0004`,
    product: { nombreComercial: 'Producto Ejemplo 4 — Antiácido 400 mg', formaFarmaceutica: 'Tableta masticable', fabricante: amb.nombreEmpresa },
  }));
  await db().collection('quotes').doc(I.cotizacion4).set({
    orgId: amb.orgId, ...marca, caseIds: [I.caso4], estado: 'borrador',
    lineas: [lineaCotizacion(I.caso4, `${amb.codigo}-2026-0004`)], total: 4130,
    historial: [{ tipo: 'linea_agregada', caseId: I.caso4, por: 'seed_demo', at: now }],
    createdAt: now, updatedAt: now,
  });

  // Producto 3: cotizado y pagado (pago simulado), en fase 8: confirman el cotejo técnico (Farmacéutico) y la parte legal (Legal).
  await db().collection('cases').doc(I.caso3).set(casoBase(amb, {
    status: 'fase_08', caseCode: `${amb.codigo}-2026-0003`,
    product: { nombreComercial: 'Producto Ejemplo 3 — Jarabe pediátrico', formaFarmaceutica: 'Jarabe', fabricante: amb.nombreEmpresa },
  }));
  await db().collection('quotes').doc(I.cotizacion3).set({
    orgId: amb.orgId, ...marca, caseIds: [I.caso3], estado: 'aceptada',
    lineas: [lineaCotizacion(I.caso3, `${amb.codigo}-2026-0003`)], total: 4130,
    pagoPaypal: { estado: 'capturada', proveedor: 'mock', orderId: I.orden3, capturaId: I.captura3, expectedAmount: 4130, expectedCurrency: 'USD', capturadaEn: now },
    historial: [
      { tipo: 'linea_agregada', caseId: I.caso3, por: 'seed_demo', at: now }, { tipo: 'enviada', por: 'seed_demo', at: now },
      { tipo: 'aceptada', por: amb.cliente.uid, at: now }, { tipo: 'pago_capturado', por: amb.cliente.uid, at: now },
    ],
    createdAt: now, updatedAt: now, enviadaEn: now, respondidaEn: now,
  });
  const batch = db().batch();
  for (const [concepto, monto] of Object.entries(CONCEPTOS_EJEMPLO)) {
    await createConceptPayment(I.caso3, {
      concepto, monto, origen: 'mock', paypalOrderId: I.orden3,
      registradoPor: amb.cliente.uid, registradoPorEmail: amb.cliente.correo,
      paymentId: `${I.orden3}_${I.caso3}_${concepto}`, batch, demo: true,
    });
  }
  await batch.commit();
  const mensajes = db().collection('cases').doc(I.caso3).collection('messages');
  await mensajes.doc(I.msg1).set({ senderRole: 'client', senderId: amb.cliente.uid, senderName: amb.cliente.nombre, text: 'Hola, ya realizamos el pago de la cotización. ¿Cuál es el siguiente paso?', createdAt: now });
  await mensajes.doc(I.msg2).set({ senderRole: 'admin', senderId: amb.regente.uid, senderName: amb.regente.nombre, text: 'Recibido, gracias. Ya revisamos la documentación digital; en cuanto confirmemos el cotejo técnico pasamos a los originales.', createdAt: now });
  await sembrarDocumentoRegente(amb, I, now);
  await sembrarDocumentoLegal(amb, I, now);

  // Lead de ejemplo para el CRM del personal.
  await db().collection('contactLeads').doc(I.lead).set({
    nombre: 'Farmacia Ejemplo', correo: `lead.demo@${DEMO_DOMINIO}`, telefono: '+507 6000-0001', tipoSolicitante: 'empresa',
    empresa: 'Farmacia Ejemplo S.A.', website: 'https://www.farmacia-ejemplo.example', pais: 'Panamá', cantidadProductos: 2,
    interes: ['cosmeticos'], intencion: 'cuenta', fuente: 'referido', plan: 'consulta', mensaje: 'Queremos registrar dos cremas dermatológicas.',
    tipoProducto: null, estado: 'nuevo', notas: null, invitado: false, ...marca,
    createdAt: now, actualizadoEn: now, actualizadoPor: null,
  });

  return { cuentas: amb.cuentas.map(c => ({ correo: c.correo, rol: c.role })), orgId: amb.orgId };
}

/**
 * Documento ya subido en el Producto 3 (fórmula cuali-cuantitativa, 15.5) para que el Responsable Farmacéutico
 * tenga algo que aprobar o rechazar en su recorrido. Mismos campos que escribe
 * routes/documents.js al subir un archivo real, con el PDF en Storage.
 */
async function sembrarDocumentoRegente(amb, I, now) {
  const buffer = await pdfFormulaEjemplo();
  const nombre = 'formula-cuali-cuantitativa-ejemplo.pdf';
  const { gcsPath, storagePath } = await uploadFile(I.caso3, `${I.docRegente}-v1`, nombre, buffer, 'application/pdf');
  await db().collection('cases').doc(I.caso3).collection('documents').doc(I.docRegente).set({
    faddiDocId: 'formula', faddiCode: '15.5', faddiDocName: 'Fórmula Cuali-Cuantitativa', faddiStep: 15,
    fileName: nombre, fileSize: buffer.length, mimeType: 'application/pdf', storagePath, gcsPath, pageCount: 1,
    status: 'uploaded', reviewNotes: '', reviewedBy: null, reviewedAt: null,
    uploadedAt: now, uploadedBy: amb.cliente.uid, version: 1,
  });
}

/** Poder original (15.2) ya subido en el Producto 3 para que el Responsable Legal tenga algo que revisar. */
async function sembrarDocumentoLegal(amb, I, now) {
  const buffer = await pdfPoderEjemplo();
  const nombre = 'poder-original-ejemplo.pdf';
  const { gcsPath, storagePath } = await uploadFile(I.caso3, `${I.docLegal}-v1`, nombre, buffer, 'application/pdf');
  await db().collection('cases').doc(I.caso3).collection('documents').doc(I.docLegal).set({
    faddiDocId: 'poder', faddiCode: '15.2', faddiDocName: 'Poder Original', faddiStep: 15,
    fileName: nombre, fileSize: buffer.length, mimeType: 'application/pdf', storagePath, gcsPath, pageCount: 1,
    status: 'uploaded', reviewNotes: '', reviewedBy: null, reviewedAt: null,
    uploadedAt: now, uploadedBy: amb.cliente.uid, version: 1,
  });
}

/**
 * Tras el pago de una cuenta demo (routes/quotes.js /pago/capturar) los casos pagados avanzan solos
 * fase_04 -> fase_05 -> fase_06, lo que en la vida real hace el personal de Farmazed: así el
 * prospecto ve moverse el expediente sin esperar a nadie. Pasa por applyTransition con sus gates
 * normales (cotización aceptada, pagos por concepto) y queda en statusHistory con ACTOR_DEMO.
 * Nunca falla el pago: un error aquí solo se registra.
 * SOLO para demo-org: en la simulación el propio personal en formación mueve el expediente cambiando de perfil.
 */
async function avanzarTrasPagoDemo(caseIds) {
  const avanzados = [];
  for (const caseId of caseIds) {
    try {
      const snap = await db().collection('cases').doc(caseId).get();
      if (!snap.exists || snap.data().orgId !== DEMO_ORG_ID || snap.data().status !== 'fase_04') continue;
      for (const to of ['fase_05', 'fase_06']) {
        const r = await applyTransition({ caseId, to, update: { status: to, updatedAt: admin.firestore.Timestamp.now() }, actor: ACTOR_DEMO });
        if (!r.ok) { console.error('[demo] avance automático detenido', { caseId, to, error: r.error }); break; }
        avanzados.push({ caseId, to });
      }
    } catch (e) {
      console.error('[demo] avance automático falló', { caseId, error: e.message });
    }
  }
  return avanzados;
}

module.exports = {
  DEMO_ORG_ID, SIM_ORG_ID, AMBITOS, CUENTAS, CUENTA_SIMULACION, idsDe,
  CASOS_SEMBRADOS, MENSAJES_SEMBRADOS, DOC_REGENTE_ID, DOC_LEGAL_ID, CASO_ADMIN_ID, COTIZACION_ADMIN_ID,
  esCorreoDemo, esCuentaDemo, visibleParaDemo, sembrarDemo, borrarDatosDemo, avanzarTrasPagoDemo,
};

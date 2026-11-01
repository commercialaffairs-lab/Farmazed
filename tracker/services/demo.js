/**
 * demo.js — Modo demo (decisión de Rick, 01-nov-2026): dos cuentas de demostración con datos de
 * ejemplo para que un prospecto (cliente) o un empleado nuevo (regente) recorra la plataforma, y
 * un reinicio que lo deja todo como al principio. Lo usan scripts/seed_demo.js (CLI),
 * routes/demo.js (POST /api/demo/reiniciar) y tests/demo.test.js.
 *
 * Cuentas (producción, públicas por diseño; Rick 01-nov): cliente.demo@farmazed.com y
 * regente.demo@farmazed.com. El regente solo ve los casos que tiene asignados (los de ejemplo), por
 * eso puede convivir con clientes reales en el mismo despliegue; no hay admin demo.
 *
 * Aislamiento: todo lo demo lleva `demo:true` (claims, empresa `demo-org`, casos, cotizaciones,
 * lead) y el reinicio borra SOLO eso. Una cuenta demo nunca paga con dinero real
 * (services/payments getProvider(user) devuelve el mock) ni recibe correos (services/correo.js
 * omite los correos `*.demo@`).
 *
 * Estado inicial del recorrido: empresa sin captación (paso 1 del cliente), sin "Producto Ejemplo 1"
 * (lo crea el cliente), "Producto Ejemplo 2" con cotización enviada (aceptar y pagar) y "Producto
 * Ejemplo 3" pagado y en fase 8 (el regente confirma el cotejo técnico), con mensajes.
 */
const admin = require('../utils/firebase_admin.js');
const { createConceptPayment } = require('./payments_ledger');

const DEMO_ORG_ID  = 'demo-org';
const DEMO_DOMINIO = process.env.DEMO_DOMINIO || 'farmazed.com';
const CORREO_DEMO_RE = /^[a-z0-9-]+\.demo@/i;

// Las claves NO viven en el repo (es público): DEMO_PASSWORD_CLIENTE / DEMO_PASSWORD_REGENTE
// (Secret Manager en Cloud Run, tracker/.env en local). Obligatorias para crear la cuenta la
// primera vez; si faltan en un reinicio, la cuenta conserva la clave que ya tenía.
const CUENTAS = [
  { uid: 'demo-cliente', correo: `cliente.demo@${DEMO_DOMINIO}`, nombre: 'Cliente Ejemplo', role: 'cliente_titular', orgId: DEMO_ORG_ID,
    get password() { return process.env.DEMO_PASSWORD_CLIENTE || null; } },
  { uid: 'demo-regente', correo: `regente.demo@${DEMO_DOMINIO}`, nombre: 'Regente Ejemplo', role: 'regente',
    get password() { return process.env.DEMO_PASSWORD_REGENTE || null; } },
];

const esCorreoDemo = (correo) => CORREO_DEMO_RE.test(String(correo || ''));
const esCuentaDemo = (user) => user?.demo === true;
/** Aislamiento del personal demo: solo ve/toca documentos marcados demo:true (una cuenta normal, todo). */
const visibleParaDemo = (user, doc) => !esCuentaDemo(user) || doc?.demo === true;

const db   = () => admin.firestore();
const auth = () => admin.auth();

async function upsertCuenta(c) {
  const datos = { email: c.correo, displayName: c.nombre, emailVerified: true, ...(c.password ? { password: c.password } : {}) };
  try { await auth().updateUser(c.uid, datos); }
  catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    if (!c.password) throw new Error(`Falta la variable con la clave de ${c.correo} (DEMO_PASSWORD_CLIENTE / DEMO_PASSWORD_REGENTE) para crear la cuenta.`);
    await auth().createUser({ uid: c.uid, ...datos });
  }
  await auth().setCustomUserClaims(c.uid, { role: c.role, ...(c.orgId ? { orgId: c.orgId } : {}), demo: true, origen: 'demo' });
  await auth().revokeRefreshTokens(c.uid); // una sesión abierta antes del reinicio vuelve a pedir login
}

function casoBase(overrides) {
  const now = admin.firestore.Timestamp.now();
  return {
    createdAt: now, updatedAt: now, demo: true,
    tramiteType: 'medicamentos', tipoSolicitud: 'Nuevo Registro', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'],
    orgId: DEMO_ORG_ID, clientId: 'demo-cliente', clientEmail: `cliente.demo@${DEMO_DOMINIO}`, clientName: 'Cliente Ejemplo',
    asignados: { analista: null, abogado: null, regente: 'demo-regente' },
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

/** Borra la empresa demo con todo lo que cuelga de ella (casos y sus subcolecciones, cotizaciones, lead, invitaciones). */
async function borrarDatosDemo() {
  const borrados = { casos: 0, cotizaciones: 0, leads: 0, invitaciones: 0 };
  const casos = await db().collection('cases').where('orgId', '==', DEMO_ORG_ID).get();
  for (const caso of casos.docs) {
    for (const sub of await caso.ref.listCollections()) {
      const docs = await sub.get();
      for (const d of docs.docs) await d.ref.delete();
    }
    await caso.ref.delete();
    borrados.casos++;
  }
  for (const [coleccion, campo, valor, clave] of [
    ['quotes', 'orgId', DEMO_ORG_ID, 'cotizaciones'],
    ['contactLeads', 'demo', true, 'leads'],
    ['invitations', 'orgId', DEMO_ORG_ID, 'invitaciones'],
  ]) {
    const snap = await db().collection(coleccion).where(campo, '==', valor).get();
    for (const d of snap.docs) { await d.ref.delete(); borrados[clave]++; }
  }
  await db().collection('orgs').doc(DEMO_ORG_ID).delete();
  return borrados;
}

/** Deja las cuentas y los datos demo en el estado inicial del recorrido. Idempotente. */
async function sembrarDemo() {
  await borrarDatosDemo();
  const now = admin.firestore.Timestamp.now();
  for (const c of CUENTAS) await upsertCuenta(c);

  await db().collection('orgs').doc(DEMO_ORG_ID).set({
    nombre: 'Laboratorios Ejemplo S.A.', demo: true, plan: 'registro', pais: 'Panamá',
    telefonoContacto: '+507 6000-0000', website: 'https://www.laboratorios-ejemplo.example',
    createdAt: now, createdBy: 'seed_demo',
    prefillCaptacion: {
      paisYNombreFabricante: 'Panamá — Laboratorios Ejemplo S.A.',
      categoriasProducto: ['medicamentos'], productosPorCategoria: { medicamentos: 3 },
    },
  });

  // Producto 2: cotización enviada, esperando que el cliente la acepte y pague.
  await db().collection('cases').doc('demo-caso-2').set(casoBase({
    status: 'fase_04', caseCode: 'FZ-DEMO-2026-0002',
    product: { nombreComercial: 'Producto Ejemplo 2 — Analgésico 500 mg', formaFarmaceutica: 'Tableta', fabricante: 'Laboratorios Ejemplo S.A.' },
  }));
  await db().collection('quotes').doc('demo-cotizacion-2').set({
    orgId: DEMO_ORG_ID, demo: true, caseIds: ['demo-caso-2'], estado: 'enviada',
    lineas: [lineaCotizacion('demo-caso-2', 'FZ-DEMO-2026-0002')], total: 4130,
    historial: [{ tipo: 'linea_agregada', caseId: 'demo-caso-2', por: 'seed_demo', at: now }, { tipo: 'enviada', por: 'seed_demo', at: now }],
    createdAt: now, updatedAt: now, enviadaEn: now,
  });

  // Producto 3: cotizado y pagado (proveedor de prueba), en fase 8: el regente confirma el cotejo técnico.
  await db().collection('cases').doc('demo-caso-3').set(casoBase({
    status: 'fase_08', caseCode: 'FZ-DEMO-2026-0003',
    product: { nombreComercial: 'Producto Ejemplo 3 — Jarabe pediátrico', formaFarmaceutica: 'Jarabe', fabricante: 'Laboratorios Ejemplo S.A.' },
  }));
  await db().collection('quotes').doc('demo-cotizacion-3').set({
    orgId: DEMO_ORG_ID, demo: true, caseIds: ['demo-caso-3'], estado: 'aceptada',
    lineas: [lineaCotizacion('demo-caso-3', 'FZ-DEMO-2026-0003')], total: 4130,
    pagoPaypal: { estado: 'capturada', proveedor: 'mock', orderId: 'DEMO-ORDEN-0003', capturaId: 'DEMO-CAPTURA-0003', expectedAmount: 4130, expectedCurrency: 'USD', capturadaEn: now },
    historial: [
      { tipo: 'linea_agregada', caseId: 'demo-caso-3', por: 'seed_demo', at: now }, { tipo: 'enviada', por: 'seed_demo', at: now },
      { tipo: 'aceptada', por: 'demo-cliente', at: now }, { tipo: 'pago_capturado', por: 'demo-cliente', at: now },
    ],
    createdAt: now, updatedAt: now, enviadaEn: now, respondidaEn: now,
  });
  const batch = db().batch();
  for (const [concepto, monto] of Object.entries(CONCEPTOS_EJEMPLO)) {
    await createConceptPayment('demo-caso-3', {
      concepto, monto, origen: 'mock', paypalOrderId: 'DEMO-ORDEN-0003',
      registradoPor: 'demo-cliente', registradoPorEmail: `cliente.demo@${DEMO_DOMINIO}`,
      paymentId: `DEMO-ORDEN-0003_demo-caso-3_${concepto}`, batch,
    });
  }
  await batch.commit();
  const mensajes = db().collection('cases').doc('demo-caso-3').collection('messages');
  await mensajes.doc('demo-msg-1').set({ senderRole: 'client', senderId: 'demo-cliente', senderName: 'Cliente Ejemplo', text: 'Hola, ya realizamos el pago de la cotización. ¿Cuál es el siguiente paso?', createdAt: now });
  await mensajes.doc('demo-msg-2').set({ senderRole: 'admin', senderId: 'demo-regente', senderName: 'Regente Ejemplo', text: 'Recibido, gracias. Ya revisamos la documentación digital; en cuanto confirmemos el cotejo técnico pasamos a los originales.', createdAt: now });

  // Lead de ejemplo para el CRM del personal.
  await db().collection('contactLeads').doc('demo-lead-1').set({
    nombre: 'Farmacia Ejemplo', correo: `lead.demo@${DEMO_DOMINIO}`, telefono: '+507 6000-0001', tipoSolicitante: 'empresa',
    empresa: 'Farmacia Ejemplo S.A.', website: 'https://www.farmacia-ejemplo.example', pais: 'Panamá', cantidadProductos: 2,
    interes: ['cosmeticos'], intencion: 'cuenta', fuente: 'referido', plan: 'consulta', mensaje: 'Queremos registrar dos cremas dermatológicas.',
    tipoProducto: null, estado: 'nuevo', notas: null, invitado: false, demo: true,
    createdAt: now, actualizadoEn: now, actualizadoPor: null,
  });

  return { cuentas: CUENTAS.map(c => ({ correo: c.correo, rol: c.role })), orgId: DEMO_ORG_ID };
}

module.exports = { DEMO_ORG_ID, CUENTAS, esCorreoDemo, esCuentaDemo, visibleParaDemo, sembrarDemo, borrarDatosDemo };

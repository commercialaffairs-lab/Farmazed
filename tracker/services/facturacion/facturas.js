/**
 * facturas.js — Facturación electrónica de Farmazed (Rick, 01-nov-2026).
 *
 * Una factura nace de un PAGO CONFIRMADO del cliente y recorre un flujo con tres pasos:
 *
 *   pago confirmado ──► `pendiente` ──► (emitiendo) ──► `emitida` (CUFE de la DGI vía PAC) ──► (enviando) ──► `enviada`
 *                            │                               │                                        │
 *                            └──── error_emision ◄───────────┘                 error_envio ◄──────────┘   (se reintentan)
 *
 * Cada MÉTODO DE PAGO tiene su disparador y su workflow (config `workflows`, editable por el admin):
 *   · paypal        → al capturar la orden (routes/quotes.js) o al llegar el webhook PAYMENT.CAPTURE.COMPLETED
 *                     (services/paypal_webhook.js): automático, emite y envía sin tocar nada.
 *   · rapid_paypro  → cuando el admin confirma el pago del enlace (routes/pago_externo.js): automático.
 *   · manual        → cuando el admin registra un cheque/transferencia con comprobante (routes/payments.js):
 *                     por defecto queda `pendiente` para que el admin revise y pulse "Emitir y enviar" en
 *                     Finanzas (auto:false); se puede poner en automático.
 *   Lo automático corre en segundo plano tras responder; `procesarPendientes()` (POST /procesar-pendientes,
 *   para Cloud Scheduler o el botón del admin) recoge lo que quedó a medias (Cloud Run puede congelar
 *   trabajo posterior a la respuesta).
 *
 * Decisiones de diseño:
 *   · Una factura por evento de pago (captura PayPal = todas las líneas de la cotización; confirmación
 *     Rapid PayPro = la línea del producto; registro manual = ese pago). Id determinista
 *     (fac_pp_<orderId>, fac_rpp_<quoteId>_<caseId>, fac_man_<caseId>_<paymentId>) y, además, un pago con
 *     `facturaId` nunca se vuelve a facturar: repetir cualquier disparador no duplica.
 *   · El total de la factura ES lo que el cliente pagó. Por defecto el ITBMS va INCLUIDO en el monto
 *     cobrado por honorarios (neto = monto / 1.07); las tasas oficiales (DNFD/MEF/IEA) van exentas como
 *     gasto reembolsable. Todo configurable: es una decisión fiscal de Farmazed (revisar con el contador).
 *   · Las facturas de cuentas demo o del PAC simulado numeran con su propio contador (DEMO-000001) y nunca
 *     consumen la secuencia fiscal real.
 *   · Transiciones por compare-and-set (reclamar): dos ejecuciones concurrentes no emiten ni envían dos veces.
 *   · El PDF fiscal lo genera el PAC; se guarda en Storage junto al expediente para servirlo después.
 *   · Las cuentas demo usan SIEMPRE el PAC simulado y nunca reciben correo (services/correo.js).
 */
const admin = require('../../utils/firebase_admin.js');
const { HttpError } = require('../../utils/http_error');
const { uploadFile, downloadFile } = require('../storage');
const correo = require('../correo');
const { getPac, proveedorActual } = require('./pac');
const { esProduccion } = require('../../config');

const db = () => admin.firestore();
const { FieldValue, FieldPath } = admin.firestore;

const COLECCION = 'facturas';
const configRef = () => db().collection('config').doc('facturacion');

const ORIGENES = ['paypal', 'rapid_paypro', 'manual'];
const DISPARADORES = ['captura', 'webhook', 'confirmacion_admin', 'registro_admin', 'manual_admin'];
const ESTADOS = ['pendiente', 'emitiendo', 'emitida', 'enviando', 'enviada', 'error_emision', 'error_envio', 'anulada'];
const ESTADOS_CLIENTE = ['emitida', 'enviando', 'enviada', 'anulada']; // lo que ve la empresa receptora
const TASA_PCT = { '00': 0, '01': 7 }; // código DGI de tasa ITBMS → porcentaje
// Códigos DGI de forma de pago (catálogo de la factura electrónica): 01 crédito, 02 efectivo,
// 03 tarjeta de crédito, 04 tarjeta de débito, 05 transferencia/ACH, 08 cheque, 99 otro.
const FORMAS_PAGO_DGI = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '99'];
const LEASE_MS = 5 * 60 * 1000;   // un paso "en curso" más viejo que esto se considera muerto y se retoma
const PREFIJO_DEMO = 'DEMO';

const CONFIG_POR_DEFECTO = {
  emisor: {
    ruc: '', dv: '', razonSocial: 'Farmazed', codigoSucursal: '0000', puntoFacturacion: '001',
    codigoUbicacion: '8-8-7', correo: '', telefono: '', direccion: '',
  },
  conceptos: {
    honorarios:       { descripcion: 'Honorarios profesionales — gestión de registro sanitario', itbms: '01' },
    honorarios_saldo: { descripcion: 'Honorarios profesionales — saldo',                          itbms: '01' },
    tasa_dnfd:        { descripcion: 'Tasa DNFD — gasto oficial reembolsable',                    itbms: '00' },
    mef:              { descripcion: 'Tasa MEF — gasto oficial reembolsable',                     itbms: '00' },
    iea:              { descripcion: 'Informe de evaluación (IEA) — gasto oficial reembolsable',  itbms: '00' },
  },
  itbmsIncluidoEnMonto: true,
  formasPago: { paypal: '03', rapid_paypro: '03', manual: '05' },
  workflows: { paypal: { auto: true }, rapid_paypro: { auto: true }, manual: { auto: false } },
  prefijo: 'FZ',
};

const ahora = () => admin.firestore.Timestamp.now();
const aCentavos = (n) => Math.round(Number(n || 0) * 100);
const deCentavos = (c) => c / 100;
const dinero = (n) => `US$ ${Number(n || 0).toFixed(2)}`;
const fechaCorta = (ts) => (ts?.toDate ? ts.toDate() : new Date(ts || Date.now())).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Panama' });
const millis = (ts) => (ts?.toMillis ? ts.toMillis() : 0);

/** Aritmética en centavos (sin flotantes). `incluido`: el ITBMS ya viene dentro del monto pagado. */
function calcularItem(monto, tasaPct, incluido) {
  const montoC = aCentavos(monto);
  if (!tasaPct) return { neto: deCentavos(montoC), itbms: 0, pagado: deCentavos(montoC) };
  if (incluido) {
    const netoC = Math.round(montoC * 100 / (100 + tasaPct));
    return { neto: deCentavos(netoC), itbms: deCentavos(montoC - netoC), pagado: deCentavos(montoC) };
  }
  const itbmsC = Math.round(montoC * tasaPct / 100);
  return { neto: deCentavos(montoC), itbms: deCentavos(itbmsC), pagado: deCentavos(montoC + itbmsC) };
}

// ─── Configuración ────────────────────────────────────────────────────────────────────────────

function fusionarConfig(guardada = {}) {
  const conceptos = { ...CONFIG_POR_DEFECTO.conceptos };
  for (const [k, v] of Object.entries(guardada.conceptos || {})) conceptos[k] = { ...conceptos[k], ...v };
  const workflows = { ...CONFIG_POR_DEFECTO.workflows };
  for (const [k, v] of Object.entries(guardada.workflows || {})) workflows[k] = { ...workflows[k], ...v };
  return {
    emisor: { ...CONFIG_POR_DEFECTO.emisor, ...(guardada.emisor || {}) },
    conceptos,
    itbmsIncluidoEnMonto: typeof guardada.itbmsIncluidoEnMonto === 'boolean' ? guardada.itbmsIncluidoEnMonto : CONFIG_POR_DEFECTO.itbmsIncluidoEnMonto,
    formasPago: { ...CONFIG_POR_DEFECTO.formasPago, ...(guardada.formasPago || {}) },
    workflows,
    prefijo: guardada.prefijo || CONFIG_POR_DEFECTO.prefijo,
    contador: Number(guardada.contador) || 0,
    contadorDemo: Number(guardada.contadorDemo) || 0,
    actualizadoEn: guardada.actualizadoEn || null,
    actualizadoPor: guardada.actualizadoPor || null,
  };
}

async function leerConfig() {
  const snap = await configRef().get();
  return { ...fusionarConfig(snap.exists ? snap.data() : {}), proveedor: proveedorActual() };
}

const esTexto = (v, max) => typeof v === 'string' && v.trim().length <= max;

/** Valida y guarda los cambios del admin. Solo acepta las claves conocidas; devuelve la config fusionada. */
async function guardarConfig(cambios = {}, usuario) {
  const errores = [];
  const limpio = {};
  if (cambios.emisor !== undefined) {
    if (typeof cambios.emisor !== 'object' || cambios.emisor === null) errores.push('emisor debe ser un objeto');
    else {
      limpio.emisor = {};
      for (const k of Object.keys(CONFIG_POR_DEFECTO.emisor)) {
        if (cambios.emisor[k] === undefined) continue;
        if (!esTexto(cambios.emisor[k], 120)) errores.push(`emisor.${k} debe ser texto (máx. 120)`);
        else limpio.emisor[k] = cambios.emisor[k].trim();
      }
      if (limpio.emisor.ruc && !/^[0-9A-Z-]{3,30}$/i.test(limpio.emisor.ruc)) errores.push('emisor.ruc tiene un formato inválido (p. ej. 155600000-2-2026)');
      if (limpio.emisor.dv && !/^\d{1,2}$/.test(limpio.emisor.dv)) errores.push('emisor.dv debe ser 1 o 2 dígitos');
      if (limpio.emisor.codigoSucursal && !/^\d{3,4}$/.test(limpio.emisor.codigoSucursal)) errores.push('emisor.codigoSucursal: 3 o 4 dígitos (p. ej. 0000)');
      if (limpio.emisor.puntoFacturacion && !/^\d{3}$/.test(limpio.emisor.puntoFacturacion)) errores.push('emisor.puntoFacturacion: 3 dígitos (p. ej. 001)');
      if (limpio.emisor.codigoUbicacion && !/^\d{1,2}-\d{1,2}-\d{1,2}$/.test(limpio.emisor.codigoUbicacion)) errores.push('emisor.codigoUbicacion: provincia-distrito-corregimiento (p. ej. 8-8-7)');
    }
  }
  if (cambios.conceptos !== undefined) {
    limpio.conceptos = {};
    for (const [k, v] of Object.entries(cambios.conceptos || {})) {
      if (!CONFIG_POR_DEFECTO.conceptos[k]) { errores.push(`concepto desconocido: ${k}`); continue; }
      const c = {};
      if (v?.descripcion !== undefined) { if (!esTexto(v.descripcion, 200) || !v.descripcion.trim()) errores.push(`conceptos.${k}.descripcion inválida`); else c.descripcion = v.descripcion.trim(); }
      if (v?.itbms !== undefined) { if (!(v.itbms in TASA_PCT)) errores.push(`conceptos.${k}.itbms debe ser '00' (exento) o '01' (7 %)`); else c.itbms = v.itbms; }
      limpio.conceptos[k] = c;
    }
  }
  if (cambios.itbmsIncluidoEnMonto !== undefined) {
    if (typeof cambios.itbmsIncluidoEnMonto !== 'boolean') errores.push('itbmsIncluidoEnMonto debe ser true/false');
    else limpio.itbmsIncluidoEnMonto = cambios.itbmsIncluidoEnMonto;
  }
  if (cambios.formasPago !== undefined) {
    limpio.formasPago = {};
    for (const [k, v] of Object.entries(cambios.formasPago || {})) {
      if (!ORIGENES.includes(k)) { errores.push(`método de pago desconocido: ${k}`); continue; }
      if (!FORMAS_PAGO_DGI.includes(String(v))) errores.push(`formasPago.${k} debe ser un código DGI válido (${FORMAS_PAGO_DGI.join(', ')})`);
      else limpio.formasPago[k] = String(v);
    }
  }
  if (cambios.workflows !== undefined) {
    limpio.workflows = {};
    for (const [k, v] of Object.entries(cambios.workflows || {})) {
      if (!ORIGENES.includes(k)) { errores.push(`método de pago desconocido: ${k}`); continue; }
      if (typeof v?.auto !== 'boolean') errores.push(`workflows.${k}.auto debe ser true/false`);
      else limpio.workflows[k] = { auto: v.auto };
    }
  }
  if (cambios.prefijo !== undefined) {
    if (!/^[A-Z]{1,5}$/.test(String(cambios.prefijo)) || String(cambios.prefijo) === PREFIJO_DEMO) errores.push('prefijo: 1 a 5 letras mayúsculas (DEMO está reservado)');
    else limpio.prefijo = cambios.prefijo;
  }
  if (errores.length) throw new HttpError(400, { error: 'Configuración inválida', detalles: errores });
  if (!Object.keys(limpio).length) throw new HttpError(400, { error: 'Nada que guardar: claves válidas emisor, conceptos, itbmsIncluidoEnMonto, formasPago, workflows, prefijo.' });
  await configRef().set({ ...limpio, actualizadoEn: ahora(), actualizadoPor: usuario?.uid || null }, { merge: true });
  return leerConfig();
}

// ─── Armado de la factura ─────────────────────────────────────────────────────────────────────

function idFactura({ origen, orderId, quoteId, caseId, paymentId }) {
  if (origen === 'paypal' && orderId) return `fac_pp_${orderId}`;
  if (origen === 'rapid_paypro' && quoteId && caseId) return `fac_rpp_${quoteId}_${caseId}`;
  if (caseId && paymentId) return `fac_man_${caseId}_${paymentId}`;
  throw new Error('idFactura: faltan datos para un id determinista');
}

/** Receptor fiscal: la entidad "solicitante" del expediente (trae el RUC); si falta, la empresa. */
function armarReceptor(caso = {}, org = {}) {
  const sol = caso.entities?.solicitante || {};
  const rep = caso.entities?.representanteLegal || {};
  return {
    razonSocial: (sol.nombre || org.nombre || caso.clientName || 'Consumidor final').trim(),
    ruc: (sol.ruc || org.ruc || '').trim(),
    dv: (sol.dv || org.dv || '').trim(),
    correo: (sol.correo || caso.clientEmail || org.correo || rep.correo || '').trim(),
    telefono: (sol.telefono || org.telefonoContacto || '').trim(),
    direccion: (sol.direccion || org.direccion || '').trim(),
    pais: (sol.paisCodigo || org.paisCodigo || 'PA').trim().toUpperCase(), // ISO-2; 'PA' salvo que el expediente diga otra cosa
    nombreContacto: (rep.nombre || caso.clientName || '').trim(),
  };
}

function armarItems(pagos, config, casos) {
  const items = pagos.map((p) => {
    const def = config.conceptos[p.concepto];
    if (!def) throw new Error(`concepto sin definición fiscal en la configuración: "${p.concepto}" (Finanzas → Configuración)`);
    const caso = casos[p.caseId] || {};
    const sufijo = [caso.product?.nombreComercial, caso.caseCode].filter(Boolean).join(' · ');
    const calc = calcularItem(p.monto, TASA_PCT[def.itbms] || 0, config.itbmsIncluidoEnMonto);
    return {
      concepto: p.concepto, caseId: p.caseId, paymentId: p.paymentId || null,
      descripcion: sufijo ? `${def.descripcion} (${sufijo})` : def.descripcion,
      monto: calc.neto, itbms: TASA_PCT[def.itbms] ? '01' : '00', valorItbms: calc.itbms, pagado: calc.pagado,
    };
  }).filter(it => it.pagado > 0);
  const suma = (campo) => deCentavos(items.reduce((s, it) => s + aCentavos(it[campo]), 0));
  return { items, totales: { neto: suma('monto'), itbms: suma('valorItbms'), total: suma('pagado') } };
}

async function cargarCasos(caseIds) {
  const snaps = await Promise.all([...new Set(caseIds)].map(id => db().collection('cases').doc(id).get()));
  return Object.fromEntries(snaps.filter(s => s.exists).map(s => [s.id, s.data()]));
}

const pagoRef = (caseId, paymentId) => db().collection('cases').doc(caseId).collection('payments').doc(paymentId);

/**
 * Punto de entrada de los disparadores. Crea la factura `pendiente` (idempotente por id y por pago) y,
 * si el workflow del método es automático, la emite y envía en segundo plano. Quien llama NO debe dejar
 * que un fallo aquí afecte al pago: el pago ya quedó registrado y la factura se resuelve desde Finanzas.
 * @returns {{ id: string|null, creada: boolean, auto: boolean, motivo?: string }}
 */
async function registrarPagoConfirmado({ origen, disparador, quoteId = null, orderId = null, pagos, usuario = null, demo = false, enSegundoPlano = true }) {
  if (!ORIGENES.includes(origen)) throw new Error(`origen inválido: ${origen}`);
  if (!DISPARADORES.includes(disparador)) throw new Error(`disparador inválido: ${disparador}`);
  const validos = (pagos || []).filter(p => p && p.caseId && p.concepto && Number(p.monto) > 0);
  if (!validos.length) return { id: null, creada: false, auto: false, motivo: 'sin pagos con monto' };

  const caseIds = [...new Set(validos.map(p => p.caseId))];
  const id = idFactura({ origen, orderId, quoteId, caseId: caseIds[0], paymentId: validos[0].paymentId });
  const ref = db().collection(COLECCION).doc(id);
  const config = await leerConfig();
  const casos = await cargarCasos(caseIds);
  const principal = casos[caseIds[0]] || {};
  const orgId = principal.orgId || null;
  const org = orgId ? (await db().collection('orgs').doc(orgId).get()).data() || {} : {};
  const esDemo = demo || org.demo === true || usuario?.demo === true || config.proveedor !== 'ebi_pac';
  const { items, totales } = armarItems(validos, config, casos);
  if (!items.length) return { id: null, creada: false, auto: false, motivo: 'sin ítems' };

  const resultado = await db().runTransaction(async (t) => {
    if ((await t.get(ref)).exists) return { id, creada: false, motivo: 'ya existía' };
    // Un pago ya facturado (por otro disparador o a mano) no se factura dos veces.
    const conPago = validos.filter(p => p.paymentId);
    const snaps = await Promise.all(conPago.map(p => t.get(pagoRef(p.caseId, p.paymentId))));
    const yaFacturado = snaps.find(s => s.exists && s.data().facturaId && s.data().facturaId !== id);
    if (yaFacturado) return { id: yaFacturado.data().facturaId, creada: false, motivo: `el pago ${yaFacturado.id} ya tiene factura` };
    t.create(ref, {
      numero: null, numeroFiscal: null, estado: 'pendiente', origen, disparador,
      orgId, caseIds, quoteId, orderId, demo: esDemo,
      pagos: validos.map(p => ({ caseId: p.caseId, concepto: p.concepto, monto: deCentavos(aCentavos(p.monto)), paymentId: p.paymentId || null })),
      receptor: armarReceptor(principal, org), items, totales, moneda: 'USD', itbmsIncluido: config.itbmsIncluidoEnMonto,
      formaPago: config.formasPago[origen] || '99',
      pac: null, correo: null, pdf: null, errores: [], leaseEn: null,
      historial: [{ tipo: 'creada', disparador, por: usuario?.uid || 'sistema', at: ahora() }],
      creadaEn: ahora(), creadaPor: usuario?.uid || 'sistema', actualizadaEn: ahora(),
    });
    for (const p of conPago) t.update(pagoRef(p.caseId, p.paymentId), { facturaId: id });
    return { id, creada: true };
  });

  const auto = !!config.workflows[origen]?.auto;
  if (resultado.creada && auto && enSegundoPlano) {
    setImmediate(() => ejecutar(id).catch(e => console.error('[facturas] workflow automático falló', { id, error: e.message })));
  }
  return { ...resultado, auto };
}

// ─── Pasos del flujo ──────────────────────────────────────────────────────────────────────────

async function cargar(id) {
  const snap = await db().collection(COLECCION).doc(String(id)).get();
  if (!snap.exists) throw new HttpError(404, { error: 'Factura no encontrada' });
  return { ref: snap.ref, data: snap.data() };
}

async function anotarError(ref, paso, mensaje, estado) {
  await ref.update({
    estado, leaseEn: null, actualizadaEn: ahora(),
    errores: FieldValue.arrayUnion({ paso, mensaje: String(mensaje).slice(0, 500), at: ahora() }),
  });
}

/**
 * Compare-and-set: pasa la factura de uno de los estados `desde` al estado transitorio `a` (con
 * marca de tiempo). Si otro proceso ya la tiene en `a` y su marca es reciente, informa `enCurso`; si
 * la marca es vieja (proceso muerto), la retoma. Devuelve `{ ok, data }`.
 */
async function reclamar(ref, desde, a) {
  return db().runTransaction(async (t) => {
    const snap = await t.get(ref);
    const data = snap.data();
    const caducado = data.estado === a && Date.now() - millis(data.leaseEn) > LEASE_MS;
    if (data.estado === a && !caducado) return { ok: false, enCurso: true, data };
    if (!desde.includes(data.estado) && !caducado) return { ok: false, enCurso: false, data };
    t.update(ref, { estado: a, leaseEn: ahora(), actualizadaEn: ahora() });
    return { ok: true, data: { ...data, estado: a } };
  });
}

/**
 * Reserva el número en una transacción sobre el contador: la secuencia fiscal real (FZ-000001 /
 * 0000000001) solo la consumen facturas reales; demo y PAC simulado usan `contadorDemo` (DEMO-000001).
 * La fecha de emisión se toma del intento actual (un reintento días después no manda una fecha vieja).
 */
async function asignarNumero(ref, prefijo, esDemo) {
  return db().runTransaction(async (t) => {
    const [fac, cfg] = await Promise.all([t.get(ref), t.get(configRef())]);
    const datos = fac.data();
    const fechaEmision = ahora();
    if (datos.numero) { t.update(ref, { fechaEmision }); return { ...datos, fechaEmision }; }
    const campo = esDemo ? 'contadorDemo' : 'contador';
    const siguiente = (Number(cfg.exists ? cfg.data()[campo] : 0) || 0) + 1;
    const numeroFiscal = String(siguiente).padStart(10, '0');
    const numero = `${esDemo ? PREFIJO_DEMO : prefijo}-${String(siguiente).padStart(6, '0')}`;
    t.set(configRef(), { [campo]: siguiente }, { merge: true });
    t.update(ref, { numero, numeroFiscal, fechaEmision, actualizadaEn: fechaEmision });
    return { ...datos, numero, numeroFiscal, fechaEmision };
  });
}

function faltantesEmisor(emisor) {
  return ['ruc', 'dv', 'razonSocial', 'codigoSucursal', 'puntoFacturacion'].filter(k => !String(emisor[k] || '').trim());
}

/** Paso 1: emitir en la DGI a través del PAC. Idempotente: con CUFE ya asignado no vuelve a llamar al PAC. */
async function emitir(id, { usuario } = {}) {
  const { ref, data } = await cargar(id);
  if (data.estado === 'anulada') throw new HttpError(409, { error: 'La factura está anulada.' });
  if (data.pac?.cufe) return data; // emitida, enviando, enviada o error_envio: la DGI ya la tiene
  const config = await leerConfig();
  if (!data.demo && config.proveedor === 'ebi_pac') {
    const faltan = faltantesEmisor(config.emisor);
    if (faltan.length) {
      await anotarError(ref, 'emision', `Faltan datos del emisor: ${faltan.join(', ')}.`, 'error_emision');
      throw new HttpError(422, { error: `Faltan datos del emisor (${faltan.join(', ')}): complétalos en Finanzas → Configuración.` });
    }
  }
  const reclamo = await reclamar(ref, ['pendiente', 'error_emision'], 'emitiendo');
  if (!reclamo.ok) {
    if (reclamo.enCurso) throw new HttpError(409, { error: 'La emisión ya está en curso; espera unos segundos.' });
    return reclamo.data; // otro proceso la emitió mientras tanto
  }
  let pac;
  try { pac = getPac({ demo: !!data.demo }); } catch (e) {
    await anotarError(ref, 'emision', e.message, 'error_emision');
    throw new HttpError(503, { error: e.message });
  }
  const conNumero = await asignarNumero(ref, config.prefijo, !!data.demo || pac.nombre === 'mock');
  let respuesta;
  try {
    respuesta = await pac.emitir({ ...conNumero, fechaEmision: conNumero.fechaEmision?.toDate?.() || new Date() }, config.emisor);
  } catch (e) {
    await anotarError(ref, 'emision', e.message, 'error_emision');
    throw new HttpError(502, { error: `El PAC no respondió: ${e.message}` });
  }
  if (!respuesta.aceptada) {
    await anotarError(ref, 'emision', `${respuesta.codigo}: ${respuesta.mensaje}`, 'error_emision');
    throw new HttpError(422, { error: `La DGI rechazó la factura (${respuesta.codigo}): ${respuesta.mensaje}` });
  }
  const pacDatos = {
    proveedor: pac.nombre, cufe: respuesta.cufe, qr: respuesta.qr || null, protocolo: respuesta.protocolo || null,
    codigo: respuesta.codigo, mensaje: respuesta.mensaje || '', fechaRecepcionDGI: respuesta.fechaRecepcionDGI || null, emitidaEn: ahora(),
  };
  await ref.update({
    estado: 'emitida', pac: pacDatos, leaseEn: null, actualizadaEn: ahora(),
    historial: FieldValue.arrayUnion({ tipo: 'emitida', por: usuario?.uid || 'sistema', at: ahora(), cufe: respuesta.cufe }),
  });
  return { ...conNumero, estado: 'emitida', pac: pacDatos };
}

/** PDF fiscal: el guardado en Storage si ya existe; si no, se pide al PAC y se guarda. */
async function obtenerPdf(id) {
  const { ref, data } = await cargar(id);
  if (!data.pac?.cufe) throw new HttpError(409, { error: 'La factura todavía no está emitida.' });
  if (data.pdf?.storagePath) {
    try { return { buffer: await downloadFile(data.pdf.storagePath), nombre: data.pdf.nombre, data }; }
    catch (e) { console.warn('[facturas] no se pudo leer el PDF guardado, se pide al PAC', { id, error: e.message }); }
  }
  const pac = getPac({ demo: !!data.demo });
  const buffer = await pac.descargarPdf(data.pac.cufe);
  const nombre = `factura-${data.numero}.pdf`;
  try {
    const { storagePath } = await uploadFile(data.caseIds[0], `factura-${id}`, nombre, buffer, 'application/pdf');
    await ref.update({ pdf: { storagePath, nombre, guardadoEn: ahora() }, actualizadaEn: ahora() });
  } catch (e) {
    console.warn('[facturas] no se pudo guardar el PDF fiscal en Storage', { id, error: e.message });
  }
  return { buffer, nombre, data };
}

/** Paso 2: correo al cliente con el PDF fiscal. Idempotente y con reclamo: dos envíos concurrentes no duplican. */
async function enviar(id, { usuario } = {}) {
  const { ref, data: inicial } = await cargar(id);
  if (inicial.estado === 'enviada') return inicial;
  if (inicial.estado === 'anulada') throw new HttpError(409, { error: 'La factura está anulada.' });
  const reclamo = await reclamar(ref, ['emitida', 'error_envio'], 'enviando');
  if (!reclamo.ok) {
    if (reclamo.enCurso) throw new HttpError(409, { error: 'El envío ya está en curso; espera unos segundos.' });
    if (reclamo.data.estado === 'enviada') return reclamo.data;
    throw new HttpError(409, { error: `Solo se envía una factura emitida (esta está '${reclamo.data.estado}').` });
  }
  const data = reclamo.data;
  const destinatario = data.receptor?.correo;
  if (!destinatario) {
    await anotarError(ref, 'envio', 'El receptor no tiene correo.', 'error_envio');
    throw new HttpError(422, { error: 'El receptor no tiene correo: corrígelo en el expediente (solicitante) y reintenta.' });
  }
  let pdf;
  try { pdf = await obtenerPdf(id); } catch (e) {
    await anotarError(ref, 'envio', e.message, 'error_envio');
    throw e instanceof HttpError ? e : new HttpError(502, { error: `No se pudo obtener el PDF fiscal: ${e.message}` });
  }
  let enviado = false;
  try {
    enviado = await correo.enviarFactura({
      correo: destinatario, nombre: data.receptor.nombreContacto || data.receptor.razonSocial, numero: data.numero,
      fecha: fechaCorta(data.fechaEmision), total: dinero(data.totales.total), cufe: data.pac.cufe, pdf: pdf.buffer, nombreArchivo: pdf.nombre,
    });
  } catch (e) {
    await anotarError(ref, 'envio', e.message, 'error_envio');
    throw new HttpError(502, { error: `No se pudo enviar el correo: ${e.message}` });
  }
  // Sin SMTP (o cuenta demo) fuera de producción se da por enviada, marcada como simulada; en
  // producción sin SMTP queda con error para que el admin la mande a mano.
  if (!enviado && esProduccion(process.env) && !data.demo) {
    await anotarError(ref, 'envio', 'SMTP no configurado: la factura no se envió.', 'error_envio');
    throw new HttpError(503, { error: 'SMTP no configurado: la factura quedó emitida pero no se envió.' });
  }
  const correoDatos = { enviadoA: destinatario, enviadoEn: ahora(), simulado: !enviado, por: usuario?.uid || 'sistema' };
  // El cierre asegura que seguimos siendo quien reclamó el envío (nadie la anuló en medio).
  await db().runTransaction(async (t) => {
    const actual = (await t.get(ref)).data();
    if (actual.estado !== 'enviando') throw new HttpError(409, { error: `La factura cambió a '${actual.estado}' durante el envío.` });
    t.update(ref, {
      estado: 'enviada', correo: correoDatos, leaseEn: null, actualizadaEn: ahora(),
      historial: FieldValue.arrayUnion({ tipo: enviado ? 'enviada' : 'enviada_simulada', a: destinatario, por: usuario?.uid || 'sistema', at: ahora() }),
    });
  });
  return { ...data, estado: 'enviada', correo: correoDatos };
}

/** Workflow completo (emitir → enviar). Lo usan los disparadores automáticos, "Reintentar" y el barrido. */
async function ejecutar(id, opciones = {}) {
  const tras = await emitir(id, opciones);
  if (tras.estado === 'enviada') return tras;
  return enviar(id, opciones);
}

async function anular(id, motivo, { usuario } = {}) {
  const { ref, data } = await cargar(id);
  if (data.estado === 'anulada') return data;
  if (!data.pac?.cufe) throw new HttpError(409, { error: 'Solo se anula una factura emitida.' });
  if (['emitiendo', 'enviando'].includes(data.estado) && Date.now() - millis(data.leaseEn) <= LEASE_MS) {
    throw new HttpError(409, { error: 'La factura tiene un paso en curso; espera unos segundos.' });
  }
  const config = await leerConfig();
  const r = await getPac({ demo: !!data.demo }).anular(config.emisor, data.numeroFiscal, motivo);
  if (!r.aceptada) throw new HttpError(422, { error: `La DGI no aceptó la anulación (${r.codigo}): ${r.mensaje}` });
  const anulacion = { motivo: String(motivo || '').slice(0, 200), por: usuario?.uid || null, at: ahora(), codigo: r.codigo };
  await ref.update({ estado: 'anulada', anulacion, leaseEn: null, actualizadaEn: ahora(), historial: FieldValue.arrayUnion({ tipo: 'anulada', ...anulacion }) });
  return { ...data, estado: 'anulada', anulacion };
}

async function estadoEnPac(id) {
  const { data } = await cargar(id);
  if (!data.numeroFiscal) return { estado: data.estado, pac: null };
  const config = await leerConfig();
  return { estado: data.estado, pac: await getPac({ demo: !!data.demo }).estado(config.emisor, data.numeroFiscal) };
}

/**
 * Barrido (Cloud Scheduler o botón del admin): retoma las facturas de workflows automáticos que
 * quedaron a medias (pendiente, emitida sin enviar, errores, pasos en curso caducados) con más de
 * `minutos` sin actividad. Devuelve el detalle por factura; nunca lanza por una factura puntual.
 */
async function procesarPendientes({ minutos = 2, limite = 20 } = {}) {
  const config = await leerConfig();
  const corte = Date.now() - Number(minutos) * 60 * 1000;
  const snap = await db().collection(COLECCION)
    .where('estado', 'in', ['pendiente', 'emitiendo', 'emitida', 'enviando', 'error_emision', 'error_envio'])
    .limit(200).get();
  const candidatas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(f => config.workflows[f.origen]?.auto && millis(f.actualizadaEn) <= corte)
    .sort((a, b) => millis(a.actualizadaEn) - millis(b.actualizadaEn))
    .slice(0, Math.min(Number(limite) || 20, 100));
  const resultados = [];
  for (const f of candidatas) {
    try {
      const r = await ejecutar(f.id, { usuario: { uid: 'barrido' } });
      resultados.push({ id: f.id, antes: f.estado, despues: r.estado });
    } catch (e) {
      resultados.push({ id: f.id, antes: f.estado, error: e.message });
    }
  }
  return { revisadas: candidatas.length, resultados };
}

// ─── Consultas ────────────────────────────────────────────────────────────────────────────────

/** Lista ordenada por creación (desc) en la consulta misma: requiere los índices de firestore.indexes.json. */
async function listar({ orgId = null, estado = null, origen = null, limite = 100 } = {}) {
  let q = db().collection(COLECCION);
  if (orgId) q = q.where('orgId', '==', orgId);
  if (estado) q = q.where('estado', '==', estado);
  if (origen) q = q.where('origen', '==', origen);
  const snap = await q.orderBy('creadaEn', 'desc').limit(Math.min(Number(limite) || 100, 500)).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Lo que ve la empresa receptora: solo facturas con CUFE y sin campos internos (errores, uids, rutas). */
function vistaCliente(f) {
  if (!f || !ESTADOS_CLIENTE.includes(f.estado)) return null;
  return {
    id: f.id, numero: f.numero, estado: f.estado, fechaEmision: f.fechaEmision, origen: f.origen, moneda: f.moneda,
    receptor: f.receptor, items: f.items, totales: f.totales, caseIds: f.caseIds,
    pac: f.pac ? { cufe: f.pac.cufe, qr: f.pac.qr, protocolo: f.pac.protocolo } : null,
    correo: f.correo ? { enviadoA: f.correo.enviadoA, enviadoEn: f.correo.enviadoEn } : null,
    anulacion: f.anulacion ? { motivo: f.anulacion.motivo, at: f.anulacion.at } : null,
  };
}

const ORIGEN_POR_PAGO = { paypal: 'paypal', rapidpaypro: 'rapid_paypro', rapid_paypro: 'rapid_paypro' };

/**
 * Pagos del cliente sin factura asociada. Recorre el grupo `payments` por páginas ordenadas por id
 * (el filtro `facturaId` no es consultable en los pagos antiguos, que no traen el campo).
 */
async function pagosSinFactura(limite = 300) {
  const tope = Math.min(Number(limite) || 300, 1000);
  const encontrados = [];
  let ultimo = null;
  for (let pagina = 0; pagina < 40 && encontrados.length < tope; pagina++) {
    let q = db().collectionGroup('payments').where('tipo', '==', 'cliente_a_farmazed').orderBy(FieldPath.documentId()).limit(300);
    if (ultimo) q = q.startAfter(ultimo);
    const snap = await q.get();
    if (snap.empty) break;
    ultimo = snap.docs[snap.docs.length - 1];
    for (const d of snap.docs) {
      const p = d.data();
      if (p.facturaId) continue;
      encontrados.push({ paymentId: d.id, caseId: d.ref.parent.parent.id, concepto: p.concepto, monto: p.monto, fecha: p.fecha, origen: ORIGEN_POR_PAGO[p.origen] || 'manual', paypalOrderId: p.paypalOrderId || null, registradoPorEmail: p.registradoPorEmail || null });
    }
    if (snap.size < 300) break;
  }
  return encontrados.sort((a, b) => millis(b.fecha) - millis(a.fecha)).slice(0, tope);
}

/** El admin factura a mano uno o varios pagos del mismo caso que quedaron sin factura. */
async function facturarPagos({ caseId, paymentIds, usuario }) {
  if (!caseId || !Array.isArray(paymentIds) || !paymentIds.length) throw new HttpError(400, { error: 'caseId y paymentIds (lista) son obligatorios.' });
  const snaps = await Promise.all(paymentIds.map(id => pagoRef(String(caseId), String(id)).get()));
  const pagos = [];
  for (const s of snaps) {
    if (!s.exists) throw new HttpError(404, { error: `Pago ${s.id} no encontrado en el caso ${caseId}.` });
    const p = s.data();
    if (p.tipo !== 'cliente_a_farmazed') throw new HttpError(400, { error: `El pago ${s.id} no es un pago del cliente a Farmazed.` });
    if (p.facturaId) throw new HttpError(409, { error: `El pago ${s.id} ya tiene la factura ${p.facturaId}.`, facturaId: p.facturaId });
    pagos.push({ caseId, concepto: p.concepto, monto: p.monto, paymentId: s.id, origen: ORIGEN_POR_PAGO[p.origen] || 'manual', orderId: p.paypalOrderId || null });
  }
  // Un pago de PayPal se factura con su id de orden (fac_pp_<orderId>), el mismo que usarían la captura o
  // el webhook: así ninguno de los tres caminos puede crear una segunda factura para esos pagos.
  const origen = pagos[0].origen;
  const orderId = origen === 'paypal' && pagos.every(p => p.orderId && p.orderId === pagos[0].orderId) ? pagos[0].orderId : null;
  const r = await registrarPagoConfirmado({ origen, disparador: 'manual_admin', pagos, orderId, usuario, enSegundoPlano: false });
  if (!r.creada) throw new HttpError(409, { error: `No se creó una factura nueva: ${r.motivo}.`, facturaId: r.id });
  await ejecutar(r.id, { usuario }); // lo pidió el admin desde Finanzas: se completa de una vez
  return r;
}

module.exports = {
  CONFIG_POR_DEFECTO, ORIGENES, ESTADOS, ESTADOS_CLIENTE, TASA_PCT, FORMAS_PAGO_DGI, LEASE_MS, PREFIJO_DEMO,
  leerConfig, guardarConfig, registrarPagoConfirmado, emitir, enviar, ejecutar, anular, estadoEnPac, procesarPendientes,
  obtenerPdf, listar, vistaCliente, pagosSinFactura, facturarPagos, cargar, armarReceptor, armarItems, calcularItem, idFactura,
};

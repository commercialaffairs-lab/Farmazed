/**
 * ebi_pac.js — Cliente del PAC EBI-PAC (facturación electrónica de Panamá, DGI).
 *
 * Portado del módulo `api/src/services/ebi-pac.js` del repo PBS-Agentic-Website (PBS Panamá),
 * que ya emitió facturas reales contra `integraciondemo.ebi-pac.com` (smoke test 14-may-2026).
 * Se conservan las correcciones de campo que ese equipo aprendió a golpes (ver su HANDOVER §9):
 *   · fechaEmision en ISO con "T" y desfase explícito -05:00 (si no, código 109).
 *   · unidadMedida 'und' en minúsculas, cantidad con 2 decimales ('1.00').
 *   · envioContenedor '1', formaPagoFact '01', valorCuotaPagada = total recibido.
 *   · totalISC se omite (lo rechaza en 0); totalMontoGravado = solo el ITBMS.
 *   · totalTodosItems = suma de valorTotal de los ítems (con ITBMS incluido).
 *
 * Cambios respecto al original (Farmazed cobra honorarios + gastos oficiales reembolsables):
 *   · ITBMS por ítem: '01' (7 %) para honorarios, '00' (exento) para tasas DNFD/MEF/IEA — lo decide
 *     la configuración (services/facturacion/facturas.js CONFIG_POR_DEFECTO), no este archivo.
 *   · Receptor: empresa con RUC jurídico → tipoClienteFE '01'; cédula → persona natural '02';
 *     sin RUC válido → consumidor final '02' (sin tomar prestado el RUC del emisor, como hacía PBS).
 *   · codFormaPago según el método de pago (PayPal/Rapid PayPro = tarjeta, manual = transferencia),
 *     también configurable.
 *
 * Demo:  https://integraciondemo.ebi-pac.com     Prod: https://integracion.ebi-pac.com
 * Credenciales en EBI_TOKEN_USUARIO / EBI_TOKEN_PASSWORD (Secret Manager en prod; nunca en el repo).
 */

const BASE_URL = () => process.env.EBI_BASE_URL || 'https://integraciondemo.ebi-pac.com';
const TOKEN_CACHE_MS = 50 * 60 * 1000;
const TIEMPO_MAX_MS = 30 * 1000;

// Códigos de respuesta de /api/Enviar que significan "documento aceptado con CUFE":
//   200 = enviado correctamente; 102 = ya existía ese número (idempotente, devuelve el CUFE).
const CODIGOS_ACEPTADO = ['200', '102'];

let tokenCache = { valor: null, vence: 0 };

const fmt2 = (n) => Number(n || 0).toFixed(2);
const redondear = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Teléfono local panameño: EBI-PAC acepta "6612-3456" / "222-2222", sin +507. */
const telefonoLocal = (tel) => String(tel || '').replace(/^\+?507[\s-]?/, '').trim().slice(0, 15);

/** Fecha local de Panamá (UTC-5, sin horario de verano) en ISO con desfase explícito. */
function fechaEmisionPanama(fecha = new Date()) {
  const local = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
  return `${local.toISOString().substring(0, 19)}-05:00`;
}

const RUC_JURIDICO = /^\d{4,}-\d{1,4}-\d{1,6}$/;                 // "155600000-2-2026", "1234567-1-654321"
const CEDULA       = /^(PE|E|N|\d{1,2}(AV|PI)?)-\d{1,5}-\d{1,6}$/i; // "8-123-4567", "PE-12-345", "E-8-12345"

/**
 * Clasifica al receptor según el catálogo DGI de tipoClienteFE: 01 contribuyente (jurídico con RUC o
 * natural con cédula), 02 consumidor final (sin identificación), 04 extranjero (país distinto de PA).
 * 03 (gobierno) no aplica a Farmazed. Confirmar contra la especificación de EBI-PAC antes del go-live.
 */
function clasificarReceptor(receptor = {}) {
  const ruc = String(receptor.ruc || '').trim().toUpperCase().replace(/\s+/g, '');
  const dv  = String(receptor.dv || '').trim();
  const pais = String(receptor.pais || 'PA').trim().toUpperCase() || 'PA';
  if (pais !== 'PA') return { tipoClienteFE: '04', tipoContribuyente: '2', ruc, dv, pais };
  if (ruc && RUC_JURIDICO.test(ruc)) return { tipoClienteFE: '01', tipoContribuyente: '2', ruc, dv, pais };
  if (ruc && CEDULA.test(ruc)) return { tipoClienteFE: '01', tipoContribuyente: '1', ruc, dv, pais };
  return { tipoClienteFE: '02', tipoContribuyente: '1', ruc: '', dv: '', pais }; // consumidor final
}

/**
 * Arma el cuerpo de POST /api/Enviar a partir de una factura de Farmazed y los datos del emisor.
 * Exportado para poder probarlo sin red.
 */
function construirDocumento(factura, emisor = {}) {
  const items = (factura.items || []).map((it) => {
    const neto  = redondear(it.monto);
    const itbms = redondear(it.valorItbms);
    return {
      descripcion:             String(it.descripcion || it.concepto || 'Servicio').slice(0, 500),
      unidadMedida:            'und',
      cantidad:                '1.00',
      precioUnitario:          fmt2(neto),
      precioUnitarioDescuento: '0.00',
      precioItem:              fmt2(neto),
      codigoGTIN:              '0',
      cantGTINCom:             '0.00',
      codigoGTINInv:           '0',
      cantGTINComInv:          '0.00',
      valorTotal:              fmt2(neto + itbms),
      tasaITBMS:               it.itbms === '01' ? '01' : '00',
      valorITBMS:              fmt2(itbms),
    };
  });
  if (!items.length) throw new Error('La factura no tiene ítems.');

  const r = factura.receptor || {};
  const tipo = clasificarReceptor(r);
  const cliente = {
    tipoClienteFE:        tipo.tipoClienteFE,
    tipoContribuyente:    tipo.tipoContribuyente,
    numeroRUC:            tipo.ruc,
    digitoVerificadorRUC: tipo.dv,
    razonSocial:          String(r.razonSocial || 'Consumidor final').slice(0, 100),
    correoElectronico1:   String(r.correo || '').slice(0, 100),
    telefono1:            telefonoLocal(r.telefono),
    direccion:            String(r.direccion || '').slice(0, 100),
    pais:                 tipo.pais,
    codigoUbicacion:      r.codigoUbicacion || emisor.codigoUbicacion || '8-8-7',
  };

  const neto  = redondear(factura.totales?.neto);
  const itbms = redondear(factura.totales?.itbms);
  const total = redondear(factura.totales?.total);
  const totalTodosItems = items.reduce((s, it) => s + Number(it.valorTotal), 0);

  return {
    documento: {
      codigoSucursalEmisor: emisor.codigoSucursal || '0000',
      tipoSucursal:         '2', // emisor general (no minorista); '1' daba error 1532 en PBS
      datosTransaccion: {
        tipoEmision:            '01',
        tipoDocumento:          '01', // factura de operación interna
        numeroDocumentoFiscal:  String(factura.numeroFiscal).replace(/\D/g, '').slice(-10).padStart(10, '0'),
        puntoFacturacionFiscal: emisor.puntoFacturacion || '001',
        fechaEmision:           fechaEmisionPanama(factura.fechaEmision ? new Date(factura.fechaEmision) : new Date()),
        naturalezaOperacion:    '01',
        tipoOperacion:          '1',
        destinoOperacion:       '1',
        formatoCAFE:            '2',
        entregaCAFE:            '2',
        envioContenedor:        '1',
        procesoGeneracion:      '1',
        tipoVenta:              '1',
        cliente,
      },
      listaItems: items,
      totalesSubTotales: {
        totalPrecioNeto:    fmt2(neto),
        totalITBMS:         fmt2(itbms),
        totalMontoGravado:  fmt2(itbms),
        totalDescuento:     '0.00',
        totalFactura:       fmt2(total),
        totalValorRecibido: fmt2(total),
        vuelto:             '0.00',
        tiempoPago:         '1', // contado
        nroItems:           String(items.length),
        totalTodosItems:    fmt2(totalTodosItems),
        listaFormaPago: [{
          formaPagoFact:      '01',
          codFormaPago:       String(factura.formaPago || '05').padStart(2, '0'),
          valorCuotaPagada:   fmt2(total),
          valorReciboTotales: fmt2(total),
        }],
      },
    },
  };
}

async function llamar(ruta, body, token) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAX_MS);
  try {
    const res = await fetch(`${BASE_URL()}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: control.signal,
    });
    if (!res.ok) {
      const texto = await res.text().catch(() => '');
      const error = new Error(`EBI-PAC ${ruta} HTTP ${res.status}: ${texto.slice(0, 300)}`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  } finally {
    clearTimeout(temporizador);
  }
}

/** Llamada autenticada: si el token cacheado ya no vale (401), se renueva una vez y se reintenta. */
async function llamarAutenticado(ruta, body) {
  try {
    return await llamar(ruta, body, await autenticar());
  } catch (e) {
    if (e.status !== 401) throw e;
    tokenCache = { valor: null, vence: 0 };
    return llamar(ruta, body, await autenticar());
  }
}

async function autenticar() {
  if (tokenCache.valor && Date.now() < tokenCache.vence) return tokenCache.valor;
  const usuario = process.env.EBI_TOKEN_USUARIO;
  const clave   = process.env.EBI_TOKEN_PASSWORD;
  if (!usuario || !clave) throw new Error('EBI-PAC sin credenciales (EBI_TOKEN_USUARIO / EBI_TOKEN_PASSWORD).');
  const data = await llamar('/api/Autenticacion', { usuario, clave });
  const token = typeof data === 'string' ? data : (data.token || data.Token || data.resultado || '');
  if (!token) throw new Error('EBI-PAC autenticación: la respuesta no trae token.');
  tokenCache = { valor: token, vence: Date.now() + TOKEN_CACHE_MS };
  return token;
}

/** Normaliza la respuesta de /api/Enviar a una forma estable para el resto del módulo. */
function normalizarRespuestaEnvio(r = {}) {
  const codigo = String(r.codigo ?? r.Codigo ?? '');
  return {
    aceptada: CODIGOS_ACEPTADO.includes(codigo) && !!(r.cufe || r.Cufe),
    codigo,
    mensaje: r.mensaje || r.Mensaje || r.resultado || r.Resultado || '',
    cufe: r.cufe || r.Cufe || null,
    qr: r.qr || r.Qr || null,
    protocolo: r.nroProtocoloAutorizacion || r.NroProtocoloAutorizacion || null,
    fechaRecepcionDGI: r.fechaRecepcionDGI || r.FechaRecepcionDGI || null,
  };
}

/** Emite la factura en la DGI. Devuelve la respuesta normalizada (nunca lanza por rechazo; sí por red). */
async function emitir(factura, emisor) {
  const cuerpo = construirDocumento(factura, emisor);
  const respuesta = await llamarAutenticado('/api/Enviar', cuerpo);
  return { ...normalizarRespuestaEnvio(respuesta), crudo: respuesta };
}

const datosDocumento = (emisor, numeroFiscal) => ({
  codigoSucursalEmisor:   emisor.codigoSucursal || '0000',
  numeroDocumentoFiscal:  String(numeroFiscal).padStart(10, '0'),
  puntoFacturacionFiscal: emisor.puntoFacturacion || '001',
  tipoDocumento:          '01',
  tipoEmision:            '01',
});

async function estado(emisor, numeroFiscal) {
  return llamarAutenticado('/api/EstadoDocumento', datosDocumento(emisor, numeroFiscal));
}

/** PDF fiscal (CAFE) del documento. Devuelve un Buffer. */
async function descargarPdf(cufe) {
  const r = await llamarAutenticado('/api/Descarga', { cufe, tipoArchivo: 'PDF' });
  const base64 = r.Archivo || r.archivo;
  if (!base64) throw new Error(`EBI-PAC no devolvió el PDF fiscal (código ${r.Codigo ?? r.codigo ?? 'N/A'}: ${r.Mensaje || r.mensaje || ''})`);
  return Buffer.from(base64, 'base64');
}

async function anular(emisor, numeroFiscal, motivo) {
  const r = await llamarAutenticado('/api/Anulacion', {
    motivoAnulacion: String(motivo || 'Anulación solicitada por Farmazed').slice(0, 200),
    datosDocumento: datosDocumento(emisor, numeroFiscal),
  });
  const codigo = String(r.codigo ?? r.Codigo ?? '');
  return { aceptada: codigo === '200', codigo, mensaje: r.mensaje || r.Mensaje || '', crudo: r };
}

module.exports = {
  nombre: 'ebi_pac',
  emitir, estado, descargarPdf, anular,
  construirDocumento, clasificarReceptor, fechaEmisionPanama, normalizarRespuestaEnvio, CODIGOS_ACEPTADO,
};

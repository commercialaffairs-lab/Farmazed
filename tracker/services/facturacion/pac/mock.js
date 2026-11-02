/**
 * mock.js — PAC simulado para el emulador, las pruebas y las cuentas demo. Misma interfaz que
 * ebi_pac.js (emitir / estado / descargarPdf / anular) sin tocar la red: devuelve un CUFE y un
 * protocolo inventados pero con la forma real, y genera el "PDF fiscal" con pdf-lib.
 *
 * Igual que services/payments/mock.js: estado en memoria, nunca en producción con cuentas reales
 * (ver pac/index.js y config.js resolverProveedorFacturacion).
 */
const { construirDocumento } = require('./ebi_pac');
const { pdfEjemplo } = require('../../../utils/pdf_ejemplo');

const emitidas = new Map(); // numeroFiscal → { cufe, factura, anulada }

const fmt = (n) => `US$ ${Number(n || 0).toFixed(2)}`;

function cufeDe(factura, emisor) {
  const ruc = String(emisor.ruc || '000000000-0-0000').replace(/\s+/g, '');
  return `FE0120000${ruc}-${String(emisor.dv || '00').padStart(2, '0')}${String(factura.numeroFiscal).padStart(10, '0')}MOCK${Date.now().toString(36).toUpperCase()}`;
}

async function emitir(factura, emisor = {}) {
  construirDocumento(factura, emisor); // valida la forma como lo haría el PAC real
  const numero = String(factura.numeroFiscal).padStart(10, '0');
  const previa = emitidas.get(numero);
  if (previa) {
    return { aceptada: true, codigo: '102', mensaje: 'Documento ya enviado anteriormente (mock).', cufe: previa.cufe, qr: previa.qr, protocolo: previa.protocolo, fechaRecepcionDGI: previa.fecha, crudo: null };
  }
  const cufe = cufeDe(factura, emisor);
  const registro = {
    cufe, factura,
    qr: `https://dgi-fep.mef.gob.pa/Consultas/FacturasPorCUFE?CUFE=${cufe}`,
    protocolo: `MOCK-${numero}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    fecha: new Date().toISOString(), anulada: false,
  };
  emitidas.set(numero, registro);
  return { aceptada: true, codigo: '200', mensaje: 'El documento se envió correctamente (mock).', cufe, qr: registro.qr, protocolo: registro.protocolo, fechaRecepcionDGI: registro.fecha, crudo: null };
}

async function estado(_emisor, numeroFiscal) {
  const r = emitidas.get(String(numeroFiscal).padStart(10, '0'));
  if (!r) return { codigo: '102', mensaje: 'Documento no encontrado (mock).' };
  return { codigo: '200', mensaje: r.anulada ? 'Documento anulado (mock).' : 'Documento autorizado (mock).', cufe: r.cufe, nroProtocoloAutorizacion: r.protocolo, anulado: r.anulada };
}

async function descargarPdf(cufe) {
  const registro = [...emitidas.values()].find(r => r.cufe === cufe);
  const f = registro?.factura || {};
  const lineas = (f.items || []).map(it => `${it.descripcion}: ${fmt(it.monto)}${Number(it.valorItbms) ? ` + ITBMS ${fmt(it.valorItbms)}` : ''}`);
  return pdfEjemplo(`Factura electrónica ${f.numero || ''} (simulación)`, [
    'Este PDF lo genera el PAC simulado del entorno de pruebas: no tiene validez fiscal.',
    `Receptor: ${f.receptor?.razonSocial || '—'}${f.receptor?.ruc ? ` · RUC ${f.receptor.ruc}${f.receptor.dv ? ` DV ${f.receptor.dv}` : ''}` : ''}`,
    ...lineas,
    `Total: ${fmt(f.totales?.total)} (ITBMS ${fmt(f.totales?.itbms)})`,
    `CUFE: ${cufe}`,
  ]);
}

async function anular(_emisor, numeroFiscal, motivo) {
  const r = emitidas.get(String(numeroFiscal).padStart(10, '0'));
  if (!r) return { aceptada: false, codigo: '404', mensaje: 'Documento no encontrado (mock).', crudo: null };
  r.anulada = true;
  r.motivo = motivo;
  return { aceptada: true, codigo: '200', mensaje: 'Documento anulado (mock).', crudo: null };
}

/** Solo para las pruebas. */
function reiniciar() { emitidas.clear(); }

module.exports = { nombre: 'mock', emitir, estado, descargarPdf, anular, reiniciar };

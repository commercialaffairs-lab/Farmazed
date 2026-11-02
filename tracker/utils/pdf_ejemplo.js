/**
 * pdf_ejemplo.js — PDF de una página con texto fijo, para el modo demo (services/demo.js):
 * el documento que el seed deja subido en "Producto Ejemplo 3" (lo revisa el regente) y el
 * archivo que el cliente descarga desde el panel "Recorrido demo" para subirlo en su producto
 * (farmazed-web/demo/documento-ejemplo.pdf, generado con scripts/generar_pdf_ejemplo.js).
 *
 * Usa pdf-lib (ya es dependencia del tracker por utils/pdf_pages.js). Sin imágenes ni fuentes
 * externas: Helvetica estándar, WinAnsi, así que acentos y eñes se ven bien.
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const A4 = [595.28, 841.89];
const AZUL = rgb(27 / 255, 79 / 255, 138 / 255);
const GRIS = rgb(0.42, 0.45, 0.5);
const MARGEN = 60;

/**
 * @param {string} titulo       Título grande (p. ej. "Fórmula cuali-cuantitativa").
 * @param {string[]} parrafos   Líneas de texto bajo el título.
 * @returns {Promise<Buffer>}
 */
async function pdfEjemplo(titulo, parrafos = []) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  pdf.setAuthor('Farmazed — modo demo');
  const page = pdf.addPage(A4);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const ancho = A4[0] - MARGEN * 2;
  let y = A4[1] - 90;

  page.drawText('DOCUMENTO DE EJEMPLO — SIN VALIDEZ', { x: MARGEN, y, size: 10, font: negrita, color: AZUL });
  y -= 36;
  page.drawText(titulo, { x: MARGEN, y, size: 22, font: negrita, color: rgb(0.12, 0.16, 0.23) });
  y -= 30;
  page.drawText('Laboratorios Ejemplo S.A. · Farmazed, modo demo', { x: MARGEN, y, size: 11, font: normal, color: GRIS });
  y -= 40;
  for (const linea of parrafos) {
    page.drawText(linea, { x: MARGEN, y, size: 11.5, font: normal, color: rgb(0.2, 0.22, 0.27), maxWidth: ancho, lineHeight: 16 });
    const renglones = Math.max(1, Math.ceil(normal.widthOfTextAtSize(linea, 11.5) / ancho));
    y -= 16 * renglones + 6;
  }
  page.drawText('Este archivo existe solo para probar la plataforma. No representa un documento real.', {
    x: MARGEN, y: 70, size: 9, font: normal, color: GRIS,
  });
  return Buffer.from(await pdf.save());
}

/** El PDF que el cliente de la demo descarga y sube en su "Producto Ejemplo 1". */
function pdfDocumentoCliente() {
  return pdfEjemplo('Documento de ejemplo', [
    'Usa este archivo para probar la carga de documentos en el portal de Farmazed.',
    'En un trámite real, aquí irían el poder, el certificado de libre venta, la fórmula',
    'cuali-cuantitativa y los demás documentos que pide la DNFD para tu producto.',
  ]);
}

/** El PDF que el seed deja subido en "Producto Ejemplo 3" para que el regente lo revise. */
function pdfFormulaEjemplo() {
  return pdfEjemplo('Fórmula cuali-cuantitativa', [
    'Producto Ejemplo 3 — Jarabe pediátrico, frasco de 120 mL.',
    'Principio activo: Paracetamol 160 mg / 5 mL.',
    'Excipientes: sorbitol, glicerina, sacarina sódica, esencia de fresa, agua purificada c.s.p.',
    'Documento de ejemplo para la revisión técnica del regente en la demo.',
  ]);
}

module.exports = { pdfEjemplo, pdfDocumentoCliente, pdfFormulaEjemplo };

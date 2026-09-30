/**
 * pdf_pages.js — R13 (TAREA 19): cuenta páginas de un PDF con pdf-lib (pura
 * JS, sin dependencias nativas — única dependencia nueva de esta tarea).
 *
 * Nunca lanza: un archivo que no es un PDF válido (imagen, .docx, PDF
 * corrupto/cifrado sin poder abrirse) devuelve `null` — el llamador lo trata
 * como "no cuenta" para el límite de páginas, nunca como error que bloquee
 * la subida (R13: la advertencia de páginas NUNCA bloquea, y contar páginas
 * tampoco debe poder hacerlo).
 */

const { PDFDocument } = require('pdf-lib');

async function countPdfPages(buffer) {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch (e) {
    return null;
  }
}

module.exports = { countPdfPages };

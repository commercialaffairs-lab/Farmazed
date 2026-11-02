/**
 * generar_pdf_ejemplo.js — Escribe farmazed-web/demo/documento-ejemplo.pdf, el PDF que el panel
 * "Recorrido demo" del portal ofrece para descargar y subir como documento de ejemplo
 * (utils/pdf_ejemplo.js). Se corre a mano y el resultado se versiona; solo hace falta repetirlo
 * si cambia el texto del PDF.
 *
 *   cd tracker && node scripts/generar_pdf_ejemplo.js
 */
const fs = require('fs');
const path = require('path');
const { pdfDocumentoCliente } = require('../utils/pdf_ejemplo');

const destino = path.resolve(__dirname, '..', '..', 'farmazed-web', 'demo', 'documento-ejemplo.pdf');

pdfDocumentoCliente().then((buffer) => {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, buffer);
  console.log(`✅ ${destino} (${buffer.length} bytes)`);
}).catch((err) => { console.error('❌ generar_pdf_ejemplo:', err); process.exit(1); });

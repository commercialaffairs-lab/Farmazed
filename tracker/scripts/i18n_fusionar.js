/**
 * i18n_fusionar.js — Fusiona las traducciones parciales (farmazed-web/i18n/_partes/*.json, una por
 * área de la interfaz) en los diccionarios que carga el navegador (farmazed-web/i18n/{en,fr,pt}.json).
 *
 *   node tracker/scripts/i18n_fusionar.js        # escribe en.json, fr.json, pt.json
 *   npm run i18n                                  # (en tracker/)
 *
 * Reglas: las claves son el texto en español exacto; una clave repetida en dos partes con la misma
 * traducción es normal (misma palabra en varias pantallas); con traducciones DISTINTAS es un conflicto
 * y se avisa (gana la primera parte por orden alfabético, para que el resultado sea determinista).
 * Un idioma al que le falte una clave presente en otro también se avisa: eso es una mezcla.
 *
 * `fusionar()` se exporta para tests/i18n.test.js, que comprueba que los JSON del repo coincidan.
 */
const fs = require('fs');
const path = require('path');

const IDIOMAS = ['en', 'fr', 'pt'];
const RAIZ = path.join(__dirname, '..', '..', 'farmazed-web', 'i18n');
const PARTES = path.join(RAIZ, '_partes');

function leerPartes(dir = PARTES) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map((f) => {
    const contenido = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { nombre: f, contenido };
  });
}

/**
 * Devuelve { diccionarios: { en, fr, pt }, conflictos: [...], faltantes: { en: [...], ... } }.
 * Los diccionarios salen con las claves ordenadas (misma salida siempre → se pueden commitear).
 */
function fusionar(partes = leerPartes()) {
  const acumulado = Object.fromEntries(IDIOMAS.map(i => [i, {}]));
  const origen = Object.fromEntries(IDIOMAS.map(i => [i, {}]));
  const conflictos = [];
  for (const { nombre, contenido } of partes) {
    for (const idioma of IDIOMAS) {
      for (const [clave, trad] of Object.entries(contenido[idioma] || {})) {
        if (typeof trad !== 'string') { conflictos.push(`${nombre} [${idioma}] "${clave}": la traducción no es texto`); continue; }
        if (clave in acumulado[idioma]) {
          if (acumulado[idioma][clave] !== trad) conflictos.push(`[${idioma}] "${clave}": "${acumulado[idioma][clave]}" (${origen[idioma][clave]}) ≠ "${trad}" (${nombre})`);
          continue;
        }
        acumulado[idioma][clave] = trad;
        origen[idioma][clave] = nombre;
      }
    }
  }
  const todas = new Set(IDIOMAS.flatMap(i => Object.keys(acumulado[i])));
  const faltantes = Object.fromEntries(IDIOMAS.map(i => [i, [...todas].filter(c => !(c in acumulado[i])).sort()]));
  const diccionarios = Object.fromEntries(IDIOMAS.map(i => [i, Object.fromEntries(Object.keys(acumulado[i]).sort().map(c => [c, acumulado[i][c]]))]));
  return { diccionarios, conflictos, faltantes, total: todas.size };
}

const serializar = (dic) => `${JSON.stringify(dic, null, 2)}\n`;

function main() {
  const { diccionarios, conflictos, faltantes, total } = fusionar();
  for (const idioma of IDIOMAS) {
    fs.writeFileSync(path.join(RAIZ, `${idioma}.json`), serializar(diccionarios[idioma]));
    console.log(`${idioma}.json: ${Object.keys(diccionarios[idioma]).length} claves`);
  }
  console.log(`claves distintas: ${total}`);
  for (const c of conflictos) console.warn(`⚠ conflicto: ${c}`);
  for (const idioma of IDIOMAS) for (const c of faltantes[idioma]) console.warn(`⚠ falta en ${idioma}: "${c}"`);
  if (conflictos.length || IDIOMAS.some(i => faltantes[i].length)) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { fusionar, leerPartes, serializar, IDIOMAS, RAIZ, PARTES };

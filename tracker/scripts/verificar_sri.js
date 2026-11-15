#!/usr/bin/env node
/**
 * verificar_sri.js — TAREA 66. Lista los recursos externos de los html servidos (farmazed-web/) que
 * no cumplen Subresource Integrity:
 *   - `<script src>` y `<link rel=stylesheet|modulepreload>` con URL http(s):// o //
 *   - deben llevar `integrity="sha384-…"` y `crossorigin="anonymous"`,
 *   - y la URL debe fijar una versión exacta (nada de @latest, ni sin versión, ni rangos).
 * Excluido a propósito: Google Fonts (fonts.googleapis.com / fonts.gstatic.com): su CSS cambia según el
 * navegador, así que ningún hash sirve. Aviso aparte: los `import … from 'https://…'` de módulos ES no
 * admiten integrity (hoy: Firebase JS en gstatic, versión fijada 10.11.0).
 *
 *   node tracker/scripts/verificar_sri.js              # revisión estructural (sin red). Exit 1 si hay problemas.
 *   node tracker/scripts/verificar_sri.js --descargar  # además baja cada recurso y compara el hash real.
 *
 * Los hashes se calculan sobre el archivo descargado:  openssl dgst -sha384 -binary <archivo> | openssl base64 -A
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const RAIZ = path.join(__dirname, '../../farmazed-web');
const EXCLUIDOS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const ETIQUETA = /<(script|link)\b[^>]*>/gi;

function htmls(dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmls(p, salida);
    else if (e.name.endsWith('.html')) salida.push(p);
  }
  return salida;
}

/** Valor de un atributo (comillas dobles o simples) o undefined. */
function attr(tag, nombre) {
  const m = tag.match(new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2]) : undefined;
}

/** ¿La URL fija una versión exacta? (@5.3.3, /3.4.17, /10.11.0/…). */
function versionFijada(url) {
  if (/@(latest|next|beta|canary)\b/i.test(url)) return false;
  return /[@/]v?\d+\.\d+\.\d+([-.+][\w.]+)?(?=[/?#]|$)/.test(url);
}

/** Recursos externos con integrity/crossorigin/versión: [{archivo, url, problemas[], integrity}] */
function revisar(raiz = RAIZ) {
  const filas = [];
  for (const f of htmls(raiz)) {
    const s = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = ETIQUETA.exec(s))) {
      const tag = m[0];
      const esScript = m[1].toLowerCase() === 'script';
      if (!esScript && !/rel\s*=\s*["']?(stylesheet|modulepreload)/i.test(tag)) continue;
      const url = attr(tag, esScript ? 'src' : 'href');
      if (!url || !/^(https?:)?\/\//i.test(url)) continue;
      const host = new URL(url.startsWith('//') ? 'https:' + url : url).host;
      if (EXCLUIDOS.has(host)) continue;
      const integrity = attr(tag, 'integrity');
      const problemas = [];
      if (!integrity || !/^sha384-[A-Za-z0-9+/]{64}$/.test(integrity.trim())) problemas.push('sin integrity sha384 válido');
      if (attr(tag, 'crossorigin') !== 'anonymous') problemas.push('sin crossorigin="anonymous"');
      if (!versionFijada(url)) problemas.push('versión sin fijar');
      filas.push({ archivo: path.relative(path.join(raiz, '..'), f), url, integrity, problemas });
    }
  }
  return filas;
}

async function hashReal(url) {
  const res = await fetch(url.startsWith('//') ? 'https:' + url : url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return 'sha384-' + crypto.createHash('sha384').update(Buffer.from(await res.arrayBuffer())).digest('base64');
}

async function main() {
  const filas = revisar();
  if (process.argv.includes('--descargar')) {
    const cache = new Map();
    for (const fila of filas) {
      try {
        if (!cache.has(fila.url)) cache.set(fila.url, await hashReal(fila.url));
        if (fila.integrity && fila.integrity.trim() !== cache.get(fila.url)) fila.problemas.push(`el hash no coincide (real ${cache.get(fila.url)})`);
      } catch (e) { fila.problemas.push(`no se pudo descargar para comparar: ${e.message}`); }
    }
  }
  const malas = filas.filter(f => f.problemas.length);
  const urls = new Set(filas.map(f => f.url));
  console.log(`Recursos externos revisados: ${filas.length} etiquetas, ${urls.size} URL distintas (Google Fonts excluido: su CSS cambia por navegador).`);
  for (const f of malas) console.log(`✗ ${f.archivo}: ${f.url} — ${f.problemas.join('; ')}`);
  if (!malas.length) console.log('✓ Todos llevan integrity sha384 + crossorigin="anonymous" y versión fija' + (process.argv.includes('--descargar') ? ' (hashes comprobados contra el archivo real).' : ' (hashes sin comprobar: usa --descargar).'));
  process.exitCode = malas.length ? 1 : 0;
}

if (require.main === module) main();
module.exports = { revisar, versionFijada, attr };

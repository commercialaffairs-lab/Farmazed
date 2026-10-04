/**
 * _ip.js — TAREA 42. El rate limit de los endpoints públicos es POR IP y vive en el proceso del
 * tracker, que comparten TODAS las suites: si dos suites usan la misma IP sintética, una se come
 * el cupo (5 por 10 min) de la otra y falla según el orden. Esta IP es única por proceso de
 * prueba (el pid va en los 3 últimos octetos) y distinta en cada llamada (primer octeto).
 */
let llamadas = 0;
const ipUnica = () => `${100 + (llamadas++ % 100)}.${(process.pid >> 16) & 255}.${(process.pid >> 8) & 255}.${process.pid & 255}`;
module.exports = { ipUnica };

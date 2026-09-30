/**
 * plazo_subsanacion.js — §H.8 (TAREA 21): al entrar a `observado_dnfd`, se
 * calcula la fecha límite para subsanar (Art. 22 D.E. 27/2024): Regular 3
 * meses, Abreviado 8 días hábiles. Ninguna otra vía (Reconocimiento
 * Mutuo/WLA, etc.) tiene un plazo confirmado en §H.8 — se deja SIN fecha,
 * con una nota explícita, en vez de adivinar un número.
 *
 * "Días hábiles" aquí = lunes a viernes. NO excluye feriados de Panamá (no
 * hay un calendario de feriados en este repo) — limitación documentada, no
 * un bug: la fecha real de DNFD puede ser un poco más generosa que la
 * calculada si hay un feriado de por medio.
 */

function addBusinessDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0=domingo, 6=sábado
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function calcularFechaLimiteSubsanacion(tipoRegistro, from = new Date()) {
  if (tipoRegistro === 'Regular') {
    return { fecha: addMonths(from, 3), nota: null };
  }
  if (tipoRegistro === 'Abreviado') {
    return { fecha: addBusinessDays(from, 8), nota: null };
  }
  return {
    fecha: null,
    nota: `Vía "${tipoRegistro}" sin plazo de subsanación confirmado en §H.8 (solo fija Regular y Abreviado, Art. 22 D.E. 27/2024) — confirmar con Zelky.`,
  };
}

module.exports = { calcularFechaLimiteSubsanacion, addBusinessDays, addMonths };

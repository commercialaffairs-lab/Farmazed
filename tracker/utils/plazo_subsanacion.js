/**
 * plazo_subsanacion.js — §H.8 (TAREA 21): al entrar a `observado_dnfd`, se
 * calcula la fecha límite para subsanar: Regular 3 meses, Abreviado 8 días
 * hábiles. Ninguna otra vía (Reconocimiento Mutuo/WLA, etc.) tiene un plazo
 * confirmado en §H.8 — se deja SIN fecha, con una nota explícita, en vez de
 * adivinar un número.
 *
 * D5 (14-nov-2026, auditoría del PM contra las matrices de octubre): la
 * cita normativa del artículo se retiró del rótulo y de los comentarios. El cálculo
 * no cambia. Para Abreviado se devuelve además `notaInterna` — solo la ve el
 * back-office (routes/cases.js la quita al cliente), porque el texto del
 * decreto indica 3 meses y el instrumento de los 8 días hábiles está
 * pendiente de confirmar.
 *
 * "Días hábiles" aquí = lunes a viernes. NO excluye feriados de Panamá (no
 * hay un calendario de feriados en este repo) — limitación documentada, no
 * un bug: la fecha real de DNFD puede ser un poco más generosa que la
 * calculada si hay un feriado de por medio.
 */

const NOTA_INTERNA_ABREVIADO = 'Plazo operativo de Farmazed (práctica de ventanilla). El texto del decreto indica 3 meses; instrumento de los 8 días hábiles pendiente de confirmar.';

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

/**
 * @returns {{ fecha: Date|null, nota: string|null, notaInterna: string|null }}
 *   `nota` la ve también el cliente (sustituye a la fecha cuando no hay plazo);
 *   `notaInterna` es solo para el back-office.
 */
function calcularFechaLimiteSubsanacion(tipoRegistro, from = new Date()) {
  if (tipoRegistro === 'Regular') {
    return { fecha: addMonths(from, 3), nota: null, notaInterna: null };
  }
  if (tipoRegistro === 'Abreviado') {
    return { fecha: addBusinessDays(from, 8), nota: null, notaInterna: NOTA_INTERNA_ABREVIADO };
  }
  return {
    fecha: null,
    nota: `Vía "${tipoRegistro}" sin plazo de subsanación confirmado en §H.8 (solo fija Regular y Abreviado) — confirmar con Zelky.`,
    notaInterna: null,
  };
}

module.exports = { calcularFechaLimiteSubsanacion, addBusinessDays, addMonths, NOTA_INTERNA_ABREVIADO };

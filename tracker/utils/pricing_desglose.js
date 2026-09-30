/**
 * pricing_desglose.js — D13, factorizado en TAREA 18 (R5/R12) para que
 * quotes.js (cotización) y pricing.js (tarifario) compartan la MISMA
 * fórmula de desglose honorarios Farmazed vs. tasas oficiales — antes solo
 * vivía dentro de pricing.js.
 */

const HONORARIOS_KEYS = ['honorarios_farmazed', 'honorarios_abogado', 'gastos_adicionales'];
const TASAS_KEYS       = ['refrendo_cnf', 'tasa_dnfd_servicio', 'tasa_dnfd_tramite', 'iea', 'tasa_mef'];

function desglose(components = {}) {
  const sum = (keys) => keys.reduce((s, k) => s + (Number(components[k]) || 0), 0);
  return {
    honorariosFarmazed: sum(HONORARIOS_KEYS),
    tasasOficiales:     sum(TASAS_KEYS),
  };
}

module.exports = { HONORARIOS_KEYS, TASAS_KEYS, desglose };

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

// TAREA 33 (PM_COMMENTS §H.14): el pago por PayPal cobra TODO junto
// (honorarios + tasa DNFD + MEF + IEA, un solo cargo) pero Farmazed
// después emite los cheques SEPARADOS a DNFD/IEA — para eso hace falta la
// misma partición que ya usa el pago manual por concepto
// (`tracker/routes/payments.js`, `CONCEPTOS_CLIENTE`), no solo los 2
// bucket de `desglose()` de arriba (ahí tasa_dnfd/mef/iea quedan
// mezclados dentro de "tasasOficiales"). Partición exacta de TASAS_KEYS —
// los 3 conceptos suman lo mismo que `tasasOficiales`.
const CONCEPTO_KEYS = {
  honorarios: HONORARIOS_KEYS,
  tasa_dnfd:  ['refrendo_cnf', 'tasa_dnfd_servicio', 'tasa_dnfd_tramite'],
  mef:        ['tasa_mef'],
  iea:        ['iea'],
};

function desgloseConceptos(components = {}) {
  const sum = (keys) => keys.reduce((s, k) => s + (Number(components[k]) || 0), 0);
  return {
    honorarios: sum(CONCEPTO_KEYS.honorarios),
    tasa_dnfd:  sum(CONCEPTO_KEYS.tasa_dnfd),
    mef:        sum(CONCEPTO_KEYS.mef),
    iea:        sum(CONCEPTO_KEYS.iea),
  };
}

module.exports = { HONORARIOS_KEYS, TASAS_KEYS, CONCEPTO_KEYS, desglose, desgloseConceptos };

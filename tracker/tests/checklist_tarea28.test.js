/**
 * checklist_tarea28.test.js — TAREA 28 (PM_COMMENTS §H.11, respuestas de
 * Zelky ronda 2): "Vacuna = Biológicos" — no es categoría aparte, mismos
 * requisitos del checklist (MED_BIO_DOCS). Prueba unitaria PURA sobre
 * `getChecklist()` (tracker/data/faddi_checklists.js) — sin emulador ni
 * HTTP. Corre con: node --test tracker/tests/checklist_tarea28.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getChecklist } = require('../data/faddi_checklists');

describe('TAREA 28 — Vacuna = Biológicos (mismo checklist)', () => {
  test('Regular: Vacuna tiene exactamente los mismos documentos que Biológicos', () => {
    const vacuna = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Vacuna'] });
    const bio    = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Biológicos'] });
    assert.deepEqual(vacuna.map(d => d.id).sort(), bio.map(d => d.id).sort());
  });

  test('Abreviado: Vacuna también trae declaracion_identidad_abreviado (como Biológicos)', () => {
    const vacuna = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Vacuna'] });
    const bio    = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Biológicos'] });
    assert.deepEqual(vacuna.map(d => d.id).sort(), bio.map(d => d.id).sort());
    assert.ok(vacuna.some(d => d.id === 'declaracion_identidad_abreviado'));
  });

  test('farmacovigilancia_bio aplica a Vacuna también', () => {
    const vacuna = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Vacuna'] });
    const doc = vacuna.find(d => d.id === 'farmacovigilancia_bio');
    assert.ok(doc);
    assert.equal(doc.required, true);
  });
});

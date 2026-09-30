/**
 * checklist_tarea26.test.js — TAREA 26 parte 2 (PM_COMMENTS §H.9-2, sobre
 * organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md): los 2 FALTA de Síntesis
 * Química que dependían de un campo "innovador" que el caso no tenía. Ahora
 * existe `esInnovador` (lo confirma el staff en fase_03,
 * `cases.edit_via_categoria`, junto con tipoRegistro/tipoMedicamento).
 * Prueba unitaria PURA sobre `getChecklist()` — no usa emulador ni HTTP.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getChecklist } = require('../data/faddi_checklists');

function byId(checklist, id) {
  return checklist.find(d => d.id === id);
}

describe('TAREA 26 — esInnovador (matriz SQ ítems 33/34)', () => {
  test('sin confirmar (esInnovador undefined): "por confirmar", no obligatorio', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
    for (const id of ['estudios_clinicos_sq', 'resumen_seguridad_sq']) {
      const doc = byId(cl, id);
      assert.ok(doc, `${id} debería existir siempre para Síntesis Química`);
      assert.equal(doc.required, false);
      assert.match(doc.condition, /Por confirmar/);
    }
  });

  test('esInnovador=true: ambos obligatorios', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'], esInnovador: true });
    assert.equal(byId(cl, 'estudios_clinicos_sq').required, true);
    assert.equal(byId(cl, 'resumen_seguridad_sq').required, true);
  });

  test('esInnovador=false: ambos "no aplica", no obligatorios', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'], esInnovador: false });
    for (const id of ['estudios_clinicos_sq', 'resumen_seguridad_sq']) {
      const doc = byId(cl, id);
      assert.equal(doc.required, false);
      assert.match(doc.condition, /No aplica/);
    }
  });

  test('no aparece fuera de Síntesis Química (la auditoría no encontró este gap en otros subtipos)', () => {
    const bio = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Biológicos'], esInnovador: true });
    assert.equal(byId(bio, 'estudios_clinicos_sq'), undefined);
    assert.equal(byId(bio, 'resumen_seguridad_sq'), undefined);
  });

  test('cada doc trae el fundamento normativo (N.° de la matriz) en la descripción', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'], esInnovador: true });
    assert.match(byId(cl, 'estudios_clinicos_sq').description, /matriz SQ ítem 33/);
    assert.match(byId(cl, 'resumen_seguridad_sq').description, /matriz SQ ítem 34/);
  });
});

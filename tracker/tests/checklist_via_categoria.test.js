/**
 * checklist_via_categoria.test.js — TAREA 26 parte 2 (PM_COMMENTS §H.9-2, sobre
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

describe('esInnovador (matriz SQ ítems 33/34)', () => {
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

// ─── Alineación con las matrices de octubre (Rick, 14-nov-2026: D1–D3, D6–D8) ────────────
// Una prueba por regla. Solo donde la matriz es explícita; lo "FUERA DE ALCANCE" no se toca.

describe('D1: declaracion_identidad_abreviado en TODO Abreviado, cualquier categoría (D.E. 27/2024 Art. 24 núm. 2)', () => {
  const categorias = ['Síntesis Química', 'Homeopático', 'Medio de Contraste', 'Suplementos', 'Radiofármaco', 'Gas Medicinal', 'Biológicos'];

  test('Abreviado: presente y obligatoria para cada categoría', () => {
    for (const cat of categorias) {
      const doc = byId(getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: [cat] }), 'declaracion_identidad_abreviado');
      assert.ok(doc, `${cat} Abreviado debería traer la declaración jurada`);
      assert.equal(doc.required, true, `${cat}: debería ser obligatoria`);
      assert.equal(doc.faddiCode, 'PENDIENTE_VERIFICAR');
    }
  });

  test('Regular: NO aparece en ninguna categoría', () => {
    for (const cat of categorias) {
      assert.equal(byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: [cat] }), 'declaracion_identidad_abreviado'), undefined, `${cat} Regular no debería traerla`);
    }
  });

  test('la descripción cita el Art. 24 núm. 2, las filas de las matrices y el Formulario 6, sin atarse solo a BIO-07', () => {
    const doc = byId(getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Homeopático'] }), 'declaracion_identidad_abreviado');
    assert.match(doc.description, /Art\. 24 núm\. 2/);
    assert.match(doc.description, /Formulario 6/);
    for (const fila of ['SQ-07A', 'HOM-07', 'SUP-07A', 'RAD-05', 'GAS-05', 'CON-05']) assert.match(doc.description, new RegExp(fila));
    assert.doesNotMatch(doc.description, /sección Abreviado\)/); // la redacción exclusiva de BIO-07 ya no está
  });
});

describe('D2: Gas Medicinal — sin estabilidad (GAS-19), muestra = envase vacío (GAS-21)', () => {
  test('estabilidad no aparece cuando el caso es Gas Medicinal (Regular y Abreviado)', () => {
    for (const via of ['Regular', 'Abreviado']) {
      assert.equal(byId(getChecklist('medicamentos', { tipoRegistro: via, tipoMedicamento: ['Gas Medicinal'] }), 'estabilidad'), undefined, `${via}: Gas Medicinal está exento de estabilidad`);
    }
  });

  test('muestra sigue obligatoria y describe el envase vacío con su sistema de cierre, sin el gas', () => {
    const doc = byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Gas Medicinal'] }), 'muestra');
    assert.ok(doc);
    assert.equal(doc.required, true);
    assert.match(doc.description, /envase vacío/);
    assert.match(doc.description, /sistema de cierre/);
    assert.match(doc.description, /no se presenta el gas/);
    assert.match(doc.description, /GAS-21/);
  });

  test('si Gas Medicinal va combinado con otra categoría que exige estabilidad, se conserva', () => {
    assert.ok(byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química', 'Gas Medicinal'] }), 'estabilidad'));
  });
});

describe('D3: Radiofármaco — estabilidad condicional (RAD-19, D.E. 27/2024 Art. 127)', () => {
  test('required:false con la condición de vida útil > 24 meses, mismo id que la base', () => {
    const doc = byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Radiofármaco'] }), 'estabilidad');
    assert.ok(doc);
    assert.equal(doc.required, false);
    assert.equal(doc.condition, 'Solo si la vida útil declarada es mayor a 24 meses');
    assert.match(doc.description, /Art\. 127/);
    assert.match(doc.description, /RAD-19/);
  });

  test('las demás categorías siguen con estabilidad obligatoria (no regresión)', () => {
    for (const cat of ['Síntesis Química', 'Biológicos', 'Homeopático', 'Medio de Contraste', 'Huérfanos']) {
      assert.equal(byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: [cat] }), 'estabilidad').required, true, cat);
    }
  });
});

describe('D6: Cosméticos — cos_etiquetas (COS-09 / COS-10)', () => {
  test('presente, obligatoria, paso 11, faddiCode PENDIENTE_VERIFICAR, cita el RTCA 71.03.36:21', () => {
    const doc = byId(getChecklist('cosmeticos'), 'cos_etiquetas');
    assert.ok(doc, 'falta cos_etiquetas');
    assert.equal(doc.required, true);
    assert.equal(doc.faddiStep, 11);
    assert.equal(doc.faddiCode, 'PENDIENTE_VERIFICAR');
    assert.equal(doc.responsable, 'cliente');
    assert.match(doc.description, /RTCA 71\.03\.36:21/);
    assert.match(doc.description, /una etiqueta por variante solo si los artes difieren/);
  });
});

describe('D7: Huérfanos — estudios clínicos e inserto obligatorios (Arts. 108 y 109 núm. 8)', () => {
  test('estudios_clinicos_hue: obligatorio, sin condición, nombre "Resumen de estudios clínicos (Huérfanos)"', () => {
    const doc = byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Huérfanos'] }), 'estudios_clinicos_hue');
    assert.ok(doc);
    assert.equal(doc.required, true);
    assert.equal(doc.condition, null);
    assert.equal(doc.name, 'Resumen de estudios clínicos (Huérfanos)');
    assert.match(doc.description, /Art\. 108/);
  });

  test('prospecto: obligatorio en Huérfanos (variante propia), condicional en la base', () => {
    const hue = byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Huérfanos'] }), 'prospecto');
    assert.equal(hue.required, true);
    assert.equal(hue.condition, null);
    assert.match(hue.description, /Art\. 109 núm\. 8/);
    const sq = byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] }), 'prospecto');
    assert.equal(sq.required, false, 'la base común no cambia');
  });
});

describe('D8: Productos Naturales — contrato de fabricación condicional (NAT-11)', () => {
  test('contrato_fabricacion presente y condicional; la descripción ya no dice "No aplica a Productos Naturales"', () => {
    const doc = byId(getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Productos Naturales'] }), 'contrato_fabricacion');
    assert.ok(doc, 'falta contrato_fabricacion en Productos Naturales');
    assert.equal(doc.required, false);
    assert.match(doc.condition, /tercero/);
    assert.doesNotMatch(doc.description, /No aplica a Productos Naturales/);
    assert.match(doc.description, /NAT-11/);
  });
});

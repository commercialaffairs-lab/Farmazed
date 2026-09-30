/**
 * checklist_tarea25.test.js — TAREA 25 (PM_COMMENTS §H.9, decisiones sobre
 * organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md). Prueba unitaria PURA de
 * `getChecklist()` (tracker/data/faddi_checklists.js) — no necesita
 * emulador ni servidor, la función no hace I/O. Corre con:
 *   node --test tracker/tests/checklist_tarea25.test.js
 *
 * Cubre las 5 decisiones de §H.9:
 *   1. recibo_iea depende de `aplicaIEA` (case-level), no del subtipo.
 *   2. Las 3 colisiones de faddiCode 15.14 quedan PENDIENTE_VERIFICAR.
 *   3. Biológicos y Biotecnológicos tienen exactamente los mismos documentos.
 *   4. Se agregan los FALTA de la auditoría (SQ: 2: BIO: 7).
 *   5. Los "⚠ VERIFICAR" de Zelky (bioequivalencia SQ, BIO-S/N-1) entran
 *      opcionales con nota "Farmazed confirma si aplica".
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getChecklist } = require('../data/faddi_checklists');

function byId(checklist, id) {
  return checklist.find(d => d.id === id);
}

describe('TAREA 25 — decisión 1: recibo_iea depende de aplicaIEA, no del subtipo', () => {
  test('sin cotización aceptada (aplicaIEA undefined): "por confirmar", no obligatorio', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
    const doc = byId(cl, 'recibo_iea');
    assert.ok(doc, 'recibo_iea debe existir siempre, para cualquier subtipo');
    assert.equal(doc.required, false);
    assert.match(doc.condition, /Por confirmar/);
  });

  test('cotización marcó aplicaIEA=true: obligatorio', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'], aplicaIEA: true });
    const doc = byId(cl, 'recibo_iea');
    assert.equal(doc.required, true);
    assert.equal(doc.condition, null);
  });

  test('cotización marcó aplicaIEA=false: no aplica, no obligatorio', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'], aplicaIEA: false });
    const doc = byId(cl, 'recibo_iea');
    assert.equal(doc.required, false);
    assert.match(doc.condition, /No aplica/);
  });

  test('aparece igual (con aplicaIEA) para subtipos que ANTES lo excluían por completo (Suplementos, Huérfanos)', () => {
    const suplementos = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Suplementos'], aplicaIEA: true });
    const huerfanos    = getChecklist('medicamentos', { tipoRegistro: 'Regular',   tipoMedicamento: ['Huérfanos'],    aplicaIEA: true });
    assert.equal(byId(suplementos, 'recibo_iea').required, true);
    assert.equal(byId(huerfanos, 'recibo_iea').required, true);
  });
});

describe('TAREA 25 — decisión 2: faddiCode 15.14 (3 documentos) queda PENDIENTE_VERIFICAR', () => {
  test('otros_docs (base, siempre presente)', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
    assert.equal(byId(cl, 'otros_docs').faddiCode, 'PENDIENTE_VERIFICAR');
  });

  test('declaracion_paises (Huérfanos)', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Huérfanos'] });
    assert.equal(byId(cl, 'declaracion_paises').faddiCode, 'PENDIENTE_VERIFICAR');
  });

  test('aprobacion_arr (Abreviado)', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Síntesis Química'] });
    assert.equal(byId(cl, 'aprobacion_arr').faddiCode, 'PENDIENTE_VERIFICAR');
  });

  test('un caso Abreviado con Huérfanos dispara los 3 a la vez, y los 3 tienen PENDIENTE_VERIFICAR', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Huérfanos'] });
    for (const id of ['otros_docs', 'declaracion_paises', 'aprobacion_arr']) {
      assert.equal(byId(cl, id).faddiCode, 'PENDIENTE_VERIFICAR', `${id} debería ser PENDIENTE_VERIFICAR`);
    }
  });
});

describe('TAREA 25 — decisión 3: Biológicos y Biotecnológicos, los MISMOS documentos', () => {
  test('mismos ids, mismo required, para Regular', () => {
    const bio    = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Biológicos'] });
    const biotec = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Biotecnológicos'] });
    const idsBio    = bio.map(d => d.id).sort();
    const idsBiotec = biotec.map(d => d.id).sort();
    assert.deepEqual(idsBio, idsBiotec);
    for (const id of idsBio) {
      assert.equal(byId(bio, id).required, byId(biotec, id).required, `required de "${id}" debería coincidir`);
    }
  });

  test('farmacovigilancia_bio aplica a Biológicos también (antes solo a Biotecnológicos)', () => {
    const bio = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Biológicos'] });
    const doc = byId(bio, 'farmacovigilancia_bio');
    assert.ok(doc, 'Biológicos debe tener farmacovigilancia_bio');
    assert.equal(doc.required, true);
  });

  test('declaracion_identidad_abreviado: solo con Abreviado, para ambos subtipos', () => {
    const bioRegular   = getChecklist('medicamentos', { tipoRegistro: 'Regular',   tipoMedicamento: ['Biológicos'] });
    const bioAbreviado = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Biológicos'] });
    const biotecAbreviado = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Biotecnológicos'] });
    assert.equal(byId(bioRegular, 'declaracion_identidad_abreviado'), undefined);
    assert.ok(byId(bioAbreviado, 'declaracion_identidad_abreviado'));
    assert.ok(byId(biotecAbreviado, 'declaracion_identidad_abreviado'));
  });
});

describe('TAREA 25 — decisión 4: los FALTA de la auditoría, agregados', () => {
  test('SQ: proteccion_datos y especificaciones_pa presentes', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
    assert.ok(byId(cl, 'proteccion_datos'));
    assert.equal(byId(cl, 'proteccion_datos').required, false); // opcional, solo si se solicita protección
    const especifPA = byId(cl, 'especificaciones_pa');
    assert.ok(especifPA);
    assert.equal(especifPA.required, true);
    assert.notEqual(especifPA.id, 'especificaciones'); // distinto del doc de especificaciones del PT
  });

  test('BIO: los 7 FALTA de la auditoría presentes (Biológicos, alcanza para Biotecnológicos por la decisión 3)', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Biológicos'] });
    const ids = [
      'proteccion_datos',
      'declaracion_identidad_abreviado',
      'especificaciones_fuentes_pa',
      'especificaciones_excipientes',
      'ausencia_agentes_patogenos',
      'ausencia_materias_primas_eet',
      'programa_gestion_riesgo',
    ];
    for (const id of ids) {
      assert.ok(byId(cl, id), `falta agregar "${id}"`);
    }
  });

  test('cada FALTA agregado trae el fundamento normativo (N.° + norma) en la descripción', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Abreviado', tipoMedicamento: ['Biológicos'] });
    for (const id of ['proteccion_datos', 'especificaciones_fuentes_pa', 'programa_gestion_riesgo']) {
      const doc = byId(cl, id);
      assert.match(doc.description, /matriz (SQ|BIO) ítem/, `"${id}" debería citar el N.° de la matriz en su descripción`);
    }
  });
});

describe('TAREA 25 — decisión 5: los "⚠ VERIFICAR" de Zelky, opcionales con nota', () => {
  test('bioequivalencia (SQ-15): opcional, "Farmazed confirma si aplica"', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] });
    const doc = byId(cl, 'bioequivalencia');
    assert.ok(doc);
    assert.equal(doc.required, false);
    assert.equal(doc.condition, 'Farmazed confirma si aplica');
  });

  test('especificacion_calidad_pureza_pa (BIO-S/N-1): opcional, "Farmazed confirma si aplica"', () => {
    const cl = getChecklist('medicamentos', { tipoRegistro: 'Regular', tipoMedicamento: ['Biológicos'] });
    const doc = byId(cl, 'especificacion_calidad_pureza_pa');
    assert.ok(doc);
    assert.equal(doc.required, false);
    assert.equal(doc.condition, 'Farmazed confirma si aplica');
  });
});

describe('TAREA 25 — no regresión: subtipos no auditados no cambiaron de forma inesperada', () => {
  test('Cosméticos/Higiénicos/Plaguicidas/Excepción/Publicidad no dependen de aplicaIEA (no son medicamentos)', () => {
    for (const tramiteType of ['cosmeticos', 'higienicos', 'plaguicidas', 'excepcion', 'publicidad']) {
      const cl = getChecklist(tramiteType, {});
      assert.ok(cl.length > 0, `${tramiteType} debería seguir teniendo su checklist`);
      assert.equal(byId(cl, 'recibo_iea'), undefined, `${tramiteType} no debería tener recibo_iea`);
    }
  });
});

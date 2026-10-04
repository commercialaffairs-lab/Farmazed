/**
 * formularios.test.js — TAREA 28 (PM_COMMENTS §H.11, respuestas de
 * Zelky ronda 2, cierra §H.6). Prueba unitaria PURA de
 * `getFormulariosParaCaso()` (tracker/data/formularios.js) — no usa
 * emulador ni HTTP. Corre con: node --test tracker/tests/formularios.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { FORMULARIOS, getFormulariosParaCaso } = require('../data/formularios');

function ids(list) { return list.map(f => f.id).sort(); }

const BASE = { tramiteType: 'medicamentos', tipoSolicitud: 'Nuevo Registro', tipoRegistro: 'Regular', tipoMedicamento: [] };

describe('F1/F2 dependen de `representacion` (tri-estado)', () => {
  test('sin representacion: F1 y F2 quedan por_confirmar, ninguno aplicable', () => {
    const r = getFormulariosParaCaso({ ...BASE });
    assert.deepEqual(ids(r.porConfirmar), ['form-01', 'form-02']);
    assert.ok(!r.aplicables.some(f => f.id === 'form-01' || f.id === 'form-02'));
  });

  test('representacion=titular_directo: F1 aplicable, F2 ni aplicable ni por_confirmar', () => {
    const r = getFormulariosParaCaso({ ...BASE, representacion: 'titular_directo' });
    assert.ok(r.aplicables.some(f => f.id === 'form-01'));
    assert.ok(!r.aplicables.some(f => f.id === 'form-02'));
    assert.ok(!r.porConfirmar.some(f => f.id === 'form-01' || f.id === 'form-02'));
  });

  test('representacion=casa_matriz_distribuidor: F2 aplicable, F1 excluido', () => {
    const r = getFormulariosParaCaso({ ...BASE, representacion: 'casa_matriz_distribuidor' });
    assert.ok(r.aplicables.some(f => f.id === 'form-02'));
    assert.ok(!r.aplicables.some(f => f.id === 'form-01'));
    assert.ok(!r.porConfirmar.some(f => f.id === 'form-01' || f.id === 'form-02'));
  });
});

describe('F3 aplica siempre, F10 a todo registro nuevo de medicamentos', () => {
  test('F3 aplicable en cualquier combinación de vía/subtipo', () => {
    const combos = [
      { ...BASE, tipoRegistro: 'Regular' },
      { ...BASE, tipoRegistro: 'Abreviado' },
      { ...BASE, tipoRegistro: 'Reconocimiento Mutuo' },
      { ...BASE, tipoMedicamento: ['Suplementos'] },
    ];
    for (const c of combos) {
      const r = getFormulariosParaCaso(c);
      assert.ok(r.aplicables.some(f => f.id === 'form-03'), `form-03 debería aplicar siempre: ${JSON.stringify(c)}`);
    }
  });

  test('F10 aplicable mientras tipoSolicitud sea Nuevo Registro', () => {
    const r = getFormulariosParaCaso({ ...BASE, tipoSolicitud: 'Nuevo Registro' });
    assert.ok(r.aplicables.some(f => f.id === 'form-10'));
  });

  test('ni F3 ni F10 quedan ya "por_confirmar"', () => {
    const r = getFormulariosParaCaso({ ...BASE });
    assert.ok(!r.porConfirmar.some(f => f.id === 'form-03' || f.id === 'form-10'));
  });
});

describe('no regresión: los 13 formularios siguen existiendo', () => {
  test('FORMULARIOS sigue teniendo 13 entradas', () => {
    assert.equal(FORMULARIOS.length, 13);
  });
});

/**
 * precios.test.js — TAREA 28 (PM_COMMENTS §H.11, respuestas de
 * Zelky ronda 2). Prueba unitaria PURA de `resolverCategoriaPrecio()`
 * (tracker/routes/quotes.js) — no usa emulador ni HTTP, la función no hace
 * I/O. Corre con: node --test tracker/tests/precios.test.js
 *
 * IMPORTANTE: `PRICING_TABLE` se lee UNA sola vez, al cargar el módulo
 * (`const TARIFARIO_24SEP = process.env.PRICING_TABLE === '24sep'`) — hay
 * que fijar la variable de entorno ANTES del `require`, no después.
 */

process.env.PRICING_TABLE = '24sep';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { resolverCategoriaPrecio } = require('../services/quotes');

describe('"Vacuna = Biológicos" (§H.11)', () => {
  test('Abreviado + Vacuna -> misma categoría que Biológicos/Biotecnológicos', () => {
    const vacuna = resolverCategoriaPrecio({ tramiteType: 'medicamentos', tipoRegistro: 'Abreviado', tipoMedicamento: ['Vacuna'] });
    const bio    = resolverCategoriaPrecio({ tramiteType: 'medicamentos', tipoRegistro: 'Abreviado', tipoMedicamento: ['Biológicos'] });
    const biotec = resolverCategoriaPrecio({ tramiteType: 'medicamentos', tipoRegistro: 'Abreviado', tipoMedicamento: ['Biotecnológicos'] });
    assert.equal(vacuna, bio);
    assert.equal(vacuna, biotec);
    assert.equal(vacuna, 'med_abreviado_biologicos_24sep');
  });
});

describe('Regular + categoría sin fila propia -> "Procedimiento Regular" (§H.11)', () => {
  test('Regular + Vacuna/Biológicos/Biotecnológicos/Homeopático/Radiofármaco/Suplementos -> fila genérica', () => {
    for (const tipo of ['Vacuna', 'Biológicos', 'Biotecnológicos', 'Homeopático', 'Radiofármaco', 'Suplementos']) {
      const r = resolverCategoriaPrecio({ tramiteType: 'medicamentos', tipoRegistro: 'Regular', tipoMedicamento: [tipo] });
      assert.equal(r, 'med_regular_general_24sep', `Regular + ${tipo} debería caer en la fila genérica`);
    }
  });

  test('categorías con fila propia en Regular NO caen en la genérica', () => {
    assert.notEqual(resolverCategoriaPrecio({ tramiteType: 'medicamentos', tipoRegistro: 'Regular', tipoMedicamento: ['Huérfanos'] }), 'med_regular_general_24sep');
    assert.notEqual(resolverCategoriaPrecio({ tramiteType: 'medicamentos', tipoRegistro: 'Regular', tipoMedicamento: ['Síntesis Química'] }), 'med_regular_general_24sep');
  });
});

describe('Abreviado + Contraste/Gas/Naturales -> sin precio, confirmado (§H.11)', () => {
  test('ruta no tarifada: categoriaPrecio null', () => {
    for (const tipo of ['Medio de Contraste', 'Gas Medicinal', 'Productos Naturales']) {
      const r = resolverCategoriaPrecio({ tramiteType: 'medicamentos', tipoRegistro: 'Abreviado', tipoMedicamento: [tipo] });
      assert.equal(r, null, `Abreviado + ${tipo} debería seguir sin precio`);
    }
  });
});

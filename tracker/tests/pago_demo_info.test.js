/**
 * pago_demo_info.test.js — Panel de pago de prueba (Rick, 14-nov-2026): qué le cuenta el tracker a una cuenta
 * demo/simulación sobre cómo paga (`infoPagoDemo`, services/payments/index.js) para que el portal muestre la cuenta
 * compradora sandbox con botones "Copiar". Sin emuladores: solo objetos `env` sintéticos.
 *
 *   node --test tracker/tests/pago_demo_info.test.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { infoPagoDemo } = require('../services/payments');

const APP_SANDBOX = { PAYPAL_SANDBOX_CLIENT_ID: 'app-sandbox', PAYPAL_SANDBOX_CLIENT_SECRET: 'secreto-sandbox' };
const COMPRADOR = { PAYPAL_SANDBOX_COMPRADOR_EMAIL: 'sb-comprador@personal.example.com', PAYPAL_SANDBOX_COMPRADOR_PASSWORD: 'clave-de-prueba' };

describe('infoPagoDemo — proveedor y cuenta compradora de prueba para las cuentas demo', () => {
  test('sin credenciales sandbox paga el mock y no hay comprador (aunque esté configurado: el mock no abre PayPal)', () => {
    assert.deepEqual(infoPagoDemo({}), { proveedor: 'mock', comprador: null });
    assert.deepEqual(infoPagoDemo({ ...COMPRADOR }), { proveedor: 'mock', comprador: null });
  });

  test('con app sandbox y comprador completo: paypal-sandbox + correo y clave', () => {
    assert.deepEqual(infoPagoDemo({ ...APP_SANDBOX, ...COMPRADOR }), {
      proveedor: 'paypal-sandbox',
      comprador: { correo: 'sb-comprador@personal.example.com', clave: 'clave-de-prueba' },
    });
  });

  test('vale también la app general con PAYPAL_ENV=sandbox; el correo se recorta', () => {
    const env = { PAYPAL_ENV: 'sandbox', PAYPAL_CLIENT_ID: 'id', PAYPAL_CLIENT_SECRET: 'sec', PAYPAL_SANDBOX_COMPRADOR_EMAIL: '  sb-comprador@personal.example.com  ' };
    assert.deepEqual(infoPagoDemo(env), { proveedor: 'paypal-sandbox', comprador: { correo: 'sb-comprador@personal.example.com', clave: null } });
  });

  test('clave vacía o marcador <...> de .env.example cuenta como "sin configurar" (clave null, el correo sí se muestra)', () => {
    assert.equal(infoPagoDemo({ ...APP_SANDBOX, ...COMPRADOR, PAYPAL_SANDBOX_COMPRADOR_PASSWORD: '' }).comprador.clave, null);
    assert.equal(infoPagoDemo({ ...APP_SANDBOX, ...COMPRADOR, PAYPAL_SANDBOX_COMPRADOR_PASSWORD: '<clave>' }).comprador.clave, null);
  });

  test('sin correo no hay comprador, aunque haya sandbox y clave', () => {
    assert.deepEqual(infoPagoDemo({ ...APP_SANDBOX, PAYPAL_SANDBOX_COMPRADOR_PASSWORD: 'x' }), { proveedor: 'paypal-sandbox', comprador: null });
  });
});

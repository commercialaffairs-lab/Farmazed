// playwright.config.js — Config de Playwright para e2e/, SOLO contra el
// emulador Firebase (ver DEV_LOCAL.md y run.sh). Reutilizable: nuevos specs
// (D16) solo necesitan un archivo *.spec.js en esta carpeta.
const { defineConfig, devices } = require('@playwright/test');

const STATIC_PORT = process.env.FZ_STATIC_PORT || 8092;
const API_PORT    = process.env.FZ_API_PORT    || '8080';
const AUTH_PORT   = process.env.FZ_AUTH_PORT   || '9099';

module.exports = defineConfig({
  testDir: '.',
  timeout: 45_000, // corriendo todos los specs juntos, el emulador acumula más datos y algunas cargas de página (reload de client-dashboard.html) tardan más
  fullyParallel: false, // los specs comparten un mismo caso de prueba en Firestore
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: require.resolve('./global-setup.js'),
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${STATIC_PORT}`,
    // TAREA 42: los puertos del tracker y del emulador de Auth (config.js los lee de localStorage:
    // fzApiPort / fzAuthPort) se fijan UNA vez, para TODOS los specs — así corren en puertos
    // aislados, al lado de la demo, sin que cada spec tenga que acordarse de ponerlos.
    storageState: {
      cookies: [],
      origins: [{ origin: `http://localhost:${STATIC_PORT}`, localStorage: [
        { name: 'fzApiPort', value: String(API_PORT) },
        { name: 'fzAuthPort', value: String(AUTH_PORT) },
      ] }],
    },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

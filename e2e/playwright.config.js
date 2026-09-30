// playwright.config.js — Config de Playwright para e2e/, SOLO contra el
// emulador Firebase (ver DEV_LOCAL.md y run.sh). Reutilizable: nuevos specs
// (D16) solo necesitan un archivo *.spec.js en esta carpeta.
const { defineConfig, devices } = require('@playwright/test');

const STATIC_PORT = process.env.FZ_STATIC_PORT || 8092;

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
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

/**
 * meta.js — Metadata pública del enum de estados (D18/D19, 07 §1.2/§4).
 *
 * Mounts on the main Express app (index.js):
 *   const metaRouter = require('./routes/meta');
 *   app.use('/', metaRouter);
 *
 * Endpoint:
 *   GET /api/meta/statuses → CASE_STATUSES + labels + manual + TRANSITIONS
 *
 * Público (sin auth) — es la misma información que ya vive en
 * tracker/data/case_status.js, no hay nada sensible. El objetivo es que el
 * frontend (admin/casos.html, admin/expediente.html, client-dashboard.html)
 * lea este endpoint en vez de repetir la lista de estados como literales.
 */

const express = require('express');
const router  = express.Router();
const {
  CASE_STATUSES,
  CASE_STATUS_META,
  MANUAL_PHASES,
  TERMINAL_STATUSES,
  POST_PRESENTACION,
  TRANSITIONS,
  DOC_STATUSES,
  BLOCK_LABELS,
} = require('../data/case_status');

router.get('/api/meta/statuses', (req, res) => {
  res.json({
    statuses:        CASE_STATUSES,
    meta:            CASE_STATUS_META,
    manual:          [...MANUAL_PHASES],
    terminal:        [...TERMINAL_STATUSES],
    postPresentacion: POST_PRESENTACION,
    transitions:     TRANSITIONS,
    docStatuses:     DOC_STATUSES,
    // §H.8 (TAREA 21): los 5 bloques A-E del flujo canónico — cada fase
    // trae su bloque en `meta[fase].block`; esto es solo la etiqueta legible
    // de cada letra, para no repetirla en cada frontend.
    blockLabels:     BLOCK_LABELS,
  });
});

module.exports = router;

/**
 * system.js — TAREA 41b (PM_COMMENTS §H.16). Endpoints de "Configuración" del admin.
 *
 *   GET /api/admin/code-graph  → el HTML interactivo del grafo del código
 *                                (tracker/assets/code-graph.html, generado con
 *                                tracker/scripts/actualizar_grafo.sh).
 *
 * El grafo expone la ESTRUCTURA interna del backend, así que solo lo ve quien tenga
 * `system.code_graph` (admin) y NUNCA se publica como archivo estático en farmazed-web/
 * (todo lo que está ahí se sirve sin auth). `Last-Modified` (cabecera CORS-safelisted)
 * lleva la fecha de generación para que la página la muestre.
 */
const { Router } = require('express');
const fs         = require('node:fs/promises');
const path       = require('node:path');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

const router = Router();
const GRAFO  = path.join(__dirname, '..', 'assets', 'code-graph.html');

router.get('/code-graph', requireAuth, requirePermission('system.code_graph'), async (req, res, next) => {
  try {
    const [html, stat] = await Promise.all([fs.readFile(GRAFO, 'utf8'), fs.stat(GRAFO)]);
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Last-Modified': stat.mtime.toUTCString(),
      'Cache-Control': 'private, no-store', // contenido interno: que ningún proxy/caché lo guarde
    });
    res.send(html);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ error: 'El mapa del código todavía no se ha generado. Correr tracker/scripts/actualizar_grafo.sh y volver a desplegar.' });
    }
    next(e); // otro fallo: el handler global (500 genérico + log)
  }
});

module.exports = router;

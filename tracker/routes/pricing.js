/**
 * pricing.js — Farmazed Admin Pricing Router
 *
 * Mounts on the main Express app (index.js):
 *   const pricingRouter = require('./routes/pricing');
 *   app.use('/', pricingRouter);
 *
 * Endpoints:
 *   GET  /api/admin/pricing               → all categories (public)
 *   PATCH /api/admin/pricing/:categoryId  → update one category (token de Firebase, rol admin)
 *   GET  /api/pricing/:tramiteType        → public, filtered by grupo (for portal)
 *
 * TAREA 15/E3 parte 2: se migró de `x-admin-key` (login propio y separado en
 * admin/precios.html) a token de Firebase con `pricing.write` — mismo
 * sistema de roles que el resto del tracker. `ADMIN_KEY` ya no tiene ningún
 * lector en el código (TAREA 16(a) le quitó también el último, en
 * `POST /api/admin/set-role` de index.js) — la variable de entorno en Cloud
 * Run no se tocó, es decisión de Rick retirarla o no.
 */

const express = require('express');
const router  = express.Router();
const admin   = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Get the already-initialised Firestore instance (same singleton as index.js).
// Do NOT require('../index') — that creates a circular require and db comes back undefined.
const db = admin.firestore();

// ─── D13 (organizacion/03_INSTRUCCIONES_DEV.md fila D13) ────────────────────
// Desglose honorarios Farmazed vs. tasas oficiales. El dato ya vive en
// `components` (seed_pricing.js) — esto solo lo agrupa antes de mandarlo, una
// sola vez, para que ninguna pantalla (admin/precios.html, la vista del
// cliente) tenga que repetir la fórmula. Factorizado en TAREA 18 a
// utils/pricing_desglose.js — quotes.js (cotizaciones, R5/R12) usa la misma
// fórmula al copiar el tarifario a una línea de cotización.
const { desglose } = require('../utils/pricing_desglose');

function withDesglose(doc) {
  const { honorariosFarmazed, tasasOficiales } = desglose(doc.components);
  return {
    ...doc,
    honorariosFarmazed,
    tasasOficiales,
    // El total ya viene guardado (seed_pricing.js / PATCH lo recomputan) —
    // se re-verifica aquí para que un dato corrupto no se sirva en silencio.
    totalCuadra: honorariosFarmazed + tasasOficiales === doc.total,
  };
}

// ─── GET /api/admin/pricing ──────────────────────────────────────────────────
// Returns the full pricing table. Public read — prices are not secret.

router.get('/api/admin/pricing', async (req, res) => {
  try {
    const snap = await db.collection('pricing').orderBy('grupo').get();
    const docs = snap.docs.map(d => withDesglose(d.data()));
    res.json({ ok: true, pricing: docs });
  } catch (err) {
    console.error('GET /api/admin/pricing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/admin/pricing/:categoryId ────────────────────────────────────
// Merges supplied component fields, recomputes total, writes audit fields.
// Body: { components: { honorarios_farmazed: 1300, tasa_dnfd_tramite: 800 } }

router.patch('/api/admin/pricing/:categoryId', requireAuth, requirePermission('pricing.write'), async (req, res) => {
  const { categoryId } = req.params;
  const { components, notes } = req.body;

  if (!components || typeof components !== 'object') {
    return res.status(400).json({ error: 'Body must include { components: { ... } }' });
  }

  try {
    const ref = db.collection('pricing').doc(categoryId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: `Category '${categoryId}' not found` });
    }

    const existing = snap.data();
    const merged = { ...existing.components, ...components };

    // Recompute total — sum all numeric component values
    const COMPONENT_KEYS = [
      'honorarios_farmazed',
      'honorarios_abogado',
      'gastos_adicionales',
      'refrendo_cnf',
      'tasa_dnfd_servicio',
      'tasa_dnfd_tramite',
      'iea',
      'tasa_mef'
    ];
    const total = COMPONENT_KEYS.reduce((sum, k) => sum + (Number(merged[k]) || 0), 0);

    const update = {
      components: merged,
      total,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.email
    };
    if (notes !== undefined) update.notes = notes;

    await ref.update(update);

    const updated = (await ref.get()).data();
    res.json({ ok: true, pricing: withDesglose(updated) });
  } catch (err) {
    console.error(`PATCH /api/admin/pricing/${categoryId} error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/pricing/:tramiteType ───────────────────────────────────────────
// Public endpoint for the portal to display "Costo estimado".
// :tramiteType is matched against the `grupo` field for now; extend as needed.
// Example: GET /api/pricing/Registros%20Nuevos

router.get('/api/pricing/:tramiteType', async (req, res) => {
  const { tramiteType } = req.params;
  try {
    const snap = await db.collection('pricing')
      .where('grupo', '==', tramiteType)
      .get();
    const docs = snap.docs.map(d => withDesglose(d.data()));
    res.json({ ok: true, pricing: docs });
  } catch (err) {
    console.error('GET /api/pricing/:tramiteType error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

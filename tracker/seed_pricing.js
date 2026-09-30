/**
 * seed_pricing.js — One-time Firestore seed for the pricing collection
 *
 * Run ONCE after first deploy from the tracker/ directory:
 *   node seed_pricing.js
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or the service account key
 * configured the same way as the main API.
 *
 * Safe to re-run: uses set() with merge:false — will OVERWRITE existing docs.
 * To update a single category later, use the Admin Pricing UI instead.
 */

const admin = require('firebase-admin');

// ─── Init (same pattern as index.js) ────────────────────────────────────────
// FIREBASE_PROJECT_ID solo se usa en dev local contra el emulador (ver
// DEV_LOCAL.md) — sin la env var, mismo comportamiento de siempre en prod.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'farmazed'
  });
}
const db = admin.firestore();

// ─── Price table ─────────────────────────────────────────────────────────────
// All amounts in Panamanian Balboas (B/. = USD).
// Source: "Actualización de nuestros precios para la plataforma.xlsx"
//         Drive > Costos > fileId: 1D--X1LzONtN_iNRQ1095D0Bid87FApti

const PRICING_DATA = [
  // ── Registros Nuevos ───────────────────────────────────────────────────────
  {
    id: 'med_abreviado_sintesis',
    name: 'Síntesis Química — Procedimiento Abreviado',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 1200,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 750,
      iea: 1500,
      tasa_mef: 25
    },
    notes: ''
  },
  {
    id: 'med_abreviado_biologico',
    name: 'Biológicos / Biotecnológicos — Procedimiento Abreviado',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 1200,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 750,
      iea: 1500,
      tasa_mef: 25
    },
    notes: ''
  },
  {
    id: 'med_abreviado_suplemento',
    name: 'Suplementos / Homeopáticos / Radiofármacos — Procedimiento Abreviado',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 1200,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 750,
      iea: 1500,
      tasa_mef: 25
    },
    notes: ''
  },
  {
    id: 'med_abreviado_mutuo_acuerdo',
    name: 'Mutuo Acuerdo / WLA WHO',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 1200,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 750,
      iea: 1500,
      tasa_mef: 25
    },
    notes: ''
  },
  {
    id: 'med_abreviado_huerfano',
    name: 'Huérfanos — Procedimiento Abreviado',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 1200,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 750,
      iea: 1500,
      tasa_mef: 25
    },
    notes: 'DNFD trámite puede diferir — verificar con Zelky'
  },
  {
    id: 'med_regular_sintesis',
    name: 'Síntesis Química — Procedimiento Regular',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 800,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 500,
      iea: 1500,
      tasa_mef: 25
    },
    notes: ''
  },
  {
    id: 'med_regular_natural',
    name: 'Productos Naturales / Gases Medicinales / Contraste — Procedimiento Regular',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 800,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 500,
      iea: 1500,
      tasa_mef: 25
    },
    notes: ''
  },
  {
    id: 'med_regular_huerfano',
    name: 'Huérfano — Procedimiento Regular',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 400,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 50,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 50,
      iea: 1500,
      tasa_mef: 25
    },
    notes: ''
  },
  {
    id: 'intercambiabilidad',
    name: 'Intercambiabilidad (Res. 385 & 386/2023)',
    grupo: 'Registros Nuevos',
    components: {
      honorarios_farmazed: 800,
      honorarios_abogado: 250,
      gastos_adicionales: 605,
      refrendo_cnf: 0,
      tasa_dnfd_servicio: 200,
      tasa_dnfd_tramite: 650,
      iea: 1500,
      tasa_mef: 25
    },
    notes: 'Tasas DNFD: confirmar con Zelky al momento del trámite'
  },

  // ── Modificaciones ─────────────────────────────────────────────────────────
  {
    id: 'modificacion_expedicion',
    name: 'Modificaciones (Expedición RS y tipos principales)',
    grupo: 'Modificaciones',
    components: {
      honorarios_farmazed: 800,
      honorarios_abogado: 0,
      gastos_adicionales: 0,
      refrendo_cnf: 0,
      tasa_dnfd_servicio: 0,
      tasa_dnfd_tramite: 500,
      iea: 0,
      tasa_mef: 0
    },
    notes: 'Total orientativo B/.1,300–1,750. Ajustar según tipo específico de modificación.'
  },

  // ── Renovaciones ───────────────────────────────────────────────────────────
  {
    id: 'renovacion',
    name: 'Renovaciones (tipos principales)',
    grupo: 'Renovaciones',
    components: {
      honorarios_farmazed: 800,
      honorarios_abogado: 0,
      gastos_adicionales: 0,
      refrendo_cnf: 0,
      tasa_dnfd_servicio: 0,
      tasa_dnfd_tramite: 500,
      iea: 0,
      tasa_mef: 0
    },
    notes: 'Total orientativo B/.1,050–1,950. Honorarios y tasas varían por tipo de renovación.'
  },

  // ── Post-RS ────────────────────────────────────────────────────────────────
  {
    id: 'post_rs_modificacion',
    name: 'Cambios Post-RS (modificaciones menores)',
    grupo: 'Modificaciones',
    components: {
      honorarios_farmazed: 800,
      honorarios_abogado: 0,
      gastos_adicionales: 0,
      refrendo_cnf: 0,
      tasa_dnfd_servicio: 0,
      tasa_dnfd_tramite: 200,
      iea: 0,
      tasa_mef: 0
    },
    notes: ''
  },
  {
    id: 'cambio_rep_legal',
    name: 'Cambio Rep. Legal / Prof. Responsable',
    grupo: 'Modificaciones',
    components: {
      honorarios_farmazed: 400,
      honorarios_abogado: 0,
      gastos_adicionales: 0,
      refrendo_cnf: 0,
      tasa_dnfd_servicio: 0,
      tasa_dnfd_tramite: 25,
      iea: 0,
      tasa_mef: 0
    },
    notes: ''
  }
];

// ─── Compute and seed ─────────────────────────────────────────────────────────

const COMPONENT_KEYS = [
  'honorarios_farmazed', 'honorarios_abogado', 'gastos_adicionales',
  'refrendo_cnf', 'tasa_dnfd_servicio', 'tasa_dnfd_tramite', 'iea', 'tasa_mef'
];

async function seed() {
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const item of PRICING_DATA) {
    const total = COMPONENT_KEYS.reduce((s, k) => s + (Number(item.components[k]) || 0), 0);
    const doc = { ...item, total, updatedAt: now, updatedBy: 'seed' };
    const ref = db.collection('pricing').doc(item.id);
    batch.set(ref, doc);
  }

  await batch.commit();
  console.log(`✅ Seeded ${PRICING_DATA.length} pricing categories.`);
}

seed().then(() => process.exit(0)).catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});

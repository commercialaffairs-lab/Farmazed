/**
 * Farmazed API Server v2
 * Exposes: /qr (legacy QR), /api/cases, /api/cases/:id/documents, /mcp, /api/admin/pricing
 */
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const admin    = require('firebase-admin');
const { Firestore } = require('@google-cloud/firestore');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { requirePermission } = require('./middleware/permissions');

// Firebase Admin init — credentials via attached service account (Cloud Run)
// or GOOGLE_APPLICATION_CREDENTIALS env var (local dev).
// FIREBASE_PROJECT_ID solo se usa en dev local contra los emuladores
// (ver DEV_LOCAL.md) — sin la env var, se comporta igual que antes en prod.
admin.initializeApp({
  projectId:     process.env.FIREBASE_PROJECT_ID || 'farmazed',
  storageBucket: process.env.GCS_BUCKET || 'farmazed-docs',
});

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    'https://farmazed.com',
    'https://www.farmazed.com',
    /\.farmazed\.com$/,
    'http://localhost:8092',
    'http://localhost:3000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Health
app.get('/',       (req, res) => res.json({ service: 'farmazed-api', version: '2.0.0', status: 'ok' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Legacy QR tracking ────────────────────────────────────────────────────────
const db           = admin.firestore();
const REDIRECT_URL = process.env.REDIRECT_URL || 'https://farmazed.com';

function detectDevice(ua) {
  if (/mobile/i.test(ua))     return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

app.get('/qr', async (req, res) => {
  try {
    const ua  = req.headers['user-agent'] || '';
    const ip  = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    await db.collection('qr_scans').add({ timestamp: Firestore.Timestamp.now(), ip, device: detectDevice(ua), ua });
  } catch (e) { console.error('QR log error:', e.message); }
  res.redirect(302, REDIRECT_URL);
});

// Admin only: Firebase ID token (Authorization: Bearer) with the admin claim. No shared key in the URL.
app.get('/api/scans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const snap  = await db.collection('qr_scans').orderBy('timestamp', 'desc').limit(1000).get();
    const scans = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, timestamp: data.timestamp.toDate().toISOString(), ip: data.ip, device: data.device };
    });
    res.json({ total: scans.length, scans });
  } catch (e) { console.error('Firestore read error:', e.message); res.status(500).json({ error: e.message }); }
});

// ── Admin: dar/quitar el rol admin a una cuenta existente ─────────────────────
// TAREA 16(a): esto usaba `x-admin-key` (ADMIN_KEY) — cualquiera con la clave
// se volvía admin sin invitación ni auditoría, una puerta trasera al modelo
// de roles de E3. Ahora exige token de Firebase con `admin.set_role` (solo
// admin) y cada uso queda en `adminAuditLog`. Dar el PRIMER admin (cuando
// todavía no existe ninguno para poder llamar esto) ya no pasa por HTTP —
// ver tracker/scripts/bootstrap_admin.js, credenciales de GCP por línea de
// comandos. `ADMIN_KEY` queda sin ningún lector en este archivo.
app.post('/api/admin/set-role', requireAuth, requirePermission('admin.set_role'), async (req, res) => {
  const { uid, admin: isAdmin } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    const target   = await admin.auth().getUser(uid);
    const existing = target.customClaims || {};
    // merge, no reemplaza — pisar con setCustomUserClaims(uid, {admin:false})
    // a secas borraría un `role`/`orgId` que la cuenta ya tuviera.
    const updated = { ...existing };
    if (isAdmin) {
      updated.admin = true;
      updated.role  = 'admin';
    } else {
      delete updated.admin;
      if (updated.role === 'admin') delete updated.role;
    }
    await admin.auth().setCustomUserClaims(uid, updated);

    await db.collection('adminAuditLog').add({
      action: 'set_role', targetUid: uid, targetEmail: target.email,
      admin: !!isAdmin, by: req.user.uid, byEmail: req.user.email,
      at: admin.firestore.Timestamp.now(),
    });

    res.json({ uid, admin: !!isAdmin, updated: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Cases, Documents & Messages ───────────────────────────────────────────────
const casesRouter       = require('./routes/cases');
const documentsRouter   = require('./routes/documents');
const messagesRouter    = require('./routes/messages');
const paymentsRouter    = require('./routes/payments');
const orgsRouter        = require('./routes/orgs');
const invitationsRouter = require('./routes/invitations');
const employeesRouter   = require('./routes/employees');
const meRouter          = require('./routes/me');
const formulariosRouter = require('./routes/formularios');
const quotesRouter      = require('./routes/quotes');

app.use('/api/cases', casesRouter);
app.use('/api/cases/:caseId/documents', documentsRouter);
app.use('/api/cases/:caseId/messages',  messagesRouter);
app.use('/api/cases/:caseId/payments',  paymentsRouter);
app.use('/api/cases/:caseId/formularios', formulariosRouter.porCaso);

// ── R14: biblioteca de formularios (TAREA 17) ─────────────────────────────────
app.use('/api/formularios', formulariosRouter.biblioteca);

// ── R5/R12: cotizaciones (TAREA 18) — por encima de los casos, agrupa N por empresa ──
app.use('/api/quotes', quotesRouter);

// ── E3 parte 1/2: empresas + alta por invitación + permisos (PM_COMMENTS §H.4) ──
app.use('/api/orgs',         orgsRouter);
app.use('/api/invitations',  invitationsRouter);
app.use('/api/employees',    employeesRouter);
app.use('/api/me',           meRouter);

// ── MCP Server for Claude Cowork ──────────────────────────────────────────────
const mcpRouter = require('./routes/mcp');
app.use('/mcp', mcpRouter);

// ── Pricing (admin read + update, portal read) ────────────────────────────────
const pricingRouter = require('./routes/pricing');
app.use('/', pricingRouter);

// ── Metadata del enum de estados (D18/D19) ──────────────────────────────────
const metaRouter = require('./routes/meta');
app.use('/', metaRouter);

// ── 404 + global error ────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`farmazed-api v2 on :${PORT}`);
  console.log('  /api/cases         -> Case management');
  console.log('  /mcp               -> Claude Cowork MCP server');
  console.log('  /api/admin/pricing -> Pricing table');
});

// Export db so routes/pricing.js (and future modules) can import it
module.exports = { db };

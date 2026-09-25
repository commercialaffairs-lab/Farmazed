/**
 * Farmazed API Server v2
 * Exposes: /qr (legacy QR), /api/cases, /api/cases/:id/documents, /mcp, /api/admin/pricing
 */
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const admin    = require('firebase-admin');
const { Firestore } = require('@google-cloud/firestore');

// Firebase Admin init — credentials via attached service account (Cloud Run)
// or GOOGLE_APPLICATION_CREDENTIALS env var (local dev)
admin.initializeApp({
  projectId:     'farmazed',
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
const ADMIN_KEY    = process.env.ADMIN_KEY;

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

app.get('/api/scans', async (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const snap  = await db.collection('qr_scans').orderBy('timestamp', 'desc').limit(1000).get();
    const scans = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, timestamp: data.timestamp.toDate().toISOString(), ip: data.ip, device: data.device };
    });
    res.json({ total: scans.length, scans });
  } catch (e) { console.error('Firestore read error:', e.message); res.status(500).json({ error: e.message }); }
});

// ── Admin: set Firebase custom claims (role) ──────────────────────────────────
app.post('/api/admin/set-role', async (req, res) => {
  if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  const { uid, admin: isAdmin } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid required' });
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: !!isAdmin });
    res.json({ uid, admin: !!isAdmin, updated: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Cases, Documents & Messages ───────────────────────────────────────────────
const casesRouter     = require('./routes/cases');
const documentsRouter = require('./routes/documents');
const messagesRouter  = require('./routes/messages');

app.use('/api/cases', casesRouter);
app.use('/api/cases/:caseId/documents', documentsRouter);
app.use('/api/cases/:caseId/messages',  messagesRouter);

// ── MCP Server for Claude Cowork ──────────────────────────────────────────────
const mcpRouter = require('./routes/mcp');
app.use('/mcp', mcpRouter);

// ── Pricing (admin read + update, portal read) ────────────────────────────────
const pricingRouter = require('./routes/pricing');
app.use('/', pricingRouter);

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

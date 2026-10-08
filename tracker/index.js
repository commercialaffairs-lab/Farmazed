/**
 * Farmazed API Server v2
 * Exposes: /qr (legacy QR), /api/cases, /api/cases/:id/documents, /mcp, /api/admin/pricing
 */
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const admin    = require('./utils/firebase_admin.js');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { requirePermission } = require('./middleware/permissions');
const { crearLimitador } = require('./utils/rate_limit');
const { serializeTimestamps } = require('./utils/serialize');
const { obtenerConfig, origenPermitido } = require('./config');

// TAREA 40: ningún proceso malogrado se queda "a medias" sin que nadie se entere.
process.on('unhandledRejection', (razon) => console.error('[unhandledRejection]', razon));
process.on('uncaughtException', (err) => { console.error('[uncaughtException]', err); process.exit(1); });

// TAREA 40: la configuración se valida UNA vez, al arrancar (tracker/config.js):
// sin proyecto/bucket por defecto, sin apuntar a producción por accidente desde un
// entorno local, y con pagos reales + MCP_KEY fuerte en producción. Si algo falta,
// el proceso sale con un mensaje claro en vez de arrancar mal configurado.
let config;
try {
  config = obtenerConfig();
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}

if (config.produccion && process.env.PAYPAL_ENV === 'sandbox') {
  console.warn('[config] ⚠️  producción con PAYPAL_ENV=sandbox: los cobros NO son reales (pero sí abren el gate de fase_05).');
}

// Firebase Admin init — credentials via attached service account (Cloud Run)
// or GOOGLE_APPLICATION_CREDENTIALS env var (local dev).
admin.initializeApp({ projectId: config.projectId, storageBucket: config.bucket });

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));

// CORS (TAREA 40/41): producción solo los orígenes de la LISTA explícita (CORS_ORIGINS; default
// https://farmazed.com y https://www.farmazed.com — sin comodines de subdominio). Fuera de
// producción (= emulador) se acepta además cualquier puerto de localhost/127.0.0.1:
// el del frontend/tracker varía según qué esté libre en Patch esa corrida (TAREA 31).
// Ver origenPermitido() en tracker/config.js.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // same-origin, curl, server-to-server: sin header Origin.
    callback(null, origenPermitido(origin, config));
  },
  credentials: true,
}));
// TAREA 39: Cloud Run pone UN balanceador delante — con trust proxy 1, req.ip es la
// IP que ese balanceador agregó (la real), no el x-forwarded-for que mande el cliente.
app.set('trust proxy', config.trustProxy); // TRUST_PROXY (default 1); si delante hay más saltos (LB/CDN), 2...
app.use(express.json({ limit: '1mb' }));

// TAREA 40 — errores 500 genéricos. Las rutas atrapan sus errores y responden
// `{ error: e.message }`: ese texto puede traer detalles internos (rutas de Firestore,
// el cuerpo de una respuesta de PayPal con su debug_id…). Toda respuesta 500 con
// `error` sale con un mensaje genérico y el detalle va al log del servidor con la ruta
// y el usuario. Los 4xx con mensaje de negocio (y el 502 ya genérico del proveedor de
// pagos) no se tocan; una respuesta 500 deliberadamente informativa se marca con
// `res.locals.errorControlado = true`.
const MENSAJE_500 = 'Error interno del servidor. Si se repite, contacta a Farmazed.';
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (cuerpo) => {
    if (res.statusCode === 500 && !res.locals.errorControlado && cuerpo && typeof cuerpo === 'object' && 'error' in cuerpo) {
      console.error('[500]', req.method, req.originalUrl, { uid: req.user?.uid || null, error: cuerpo.error });
      return json({ error: MENSAJE_500 });
    }
    return json(cuerpo);
  };
  next();
});

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

// TAREA 39: endpoint público que escribe en Firestore en cada visita — mismo
// limitador que register/contact-leads (por IP real, req.ip). Pasado el límite
// igual redirige, solo deja de registrar el escaneo.
const qrLimitador = crearLimitador({ ventanaMs: 10 * 60 * 1000, max: 60 });
app.get('/qr', async (req, res) => {
  try {
    if (!qrLimitador.estaLimitado(req.ip)) {
      const ua = req.headers['user-agent'] || '';
      await db.collection('qr_scans').add({ timestamp: admin.firestore.Timestamp.now(), ip: req.ip, device: detectDevice(ua), ua });
    }
  } catch (e) { console.error('QR log error:', e.message); }
  res.redirect(302, REDIRECT_URL);
});

// Admin only: Firebase ID token (Authorization: Bearer) with the admin claim. No shared key in the URL.
app.get('/api/scans', requireAuth, requireAdmin, async (req, res) => {
  try {
    const snap  = await db.collection('qr_scans').orderBy('timestamp', 'desc').limit(1000).get();
    const scans = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, timestamp: serializeTimestamps(data.timestamp), ip: data.ip, device: data.device };
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
const registerRouter    = require('./routes/register');

app.use('/api/cases', casesRouter);
app.use('/api/cases/:caseId/documents', documentsRouter);
app.use('/api/cases/:caseId/messages',  messagesRouter);
app.use('/api/cases/:caseId/payments',  paymentsRouter);
app.use('/api/cases/:caseId/formularios', formulariosRouter.porCaso);

// ── R14: biblioteca de formularios (TAREA 17) ─────────────────────────────────
app.use('/api/formularios', formulariosRouter.biblioteca);

// ── R5/R12: cotizaciones (TAREA 18) — por encima de los casos, agrupa N por empresa ──
app.use('/api/quotes/:id/lineas/:caseId/pago-externo', require('./routes/pago_externo')); // Rapid PayPro por enlace (07-oct)
app.use('/api/quotes', quotesRouter);

// ── E3 parte 1/2: empresas + alta por invitación + permisos (PM_COMMENTS §H.4) ──
app.use('/api/orgs',         orgsRouter);
app.use('/api/invitations',  invitationsRouter);
app.use('/api/employees',    employeesRouter);
app.use('/api/me',           meRouter);
app.use('/api/register',     registerRouter); // TAREA 32: registro abierto, público
app.use('/api/subscription', require('./routes/subscription')); // TAREA 33: plan recurrente §H.14
app.use('/api/webhooks/paypal', require('./routes/webhooks'));  // TAREA 33: listo, sin uso en local
app.use('/api/admin/revisiones-pago', require('./routes/revisiones_pago')); // pagos por revisar (avisos del webhook)
app.use('/api/contact-leads', require('./routes/contact_leads')); // TAREA 34: leads sin cuenta, §H.15
app.use('/api/admin', require('./routes/system'));                // TAREA 41b: Configuración del admin (mapa del código)
app.use('/api/empresarial', require('./routes/empresarial'));     // TAREA 34: Plan Empresarial, §H.15

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
// Errores que llegan hasta aquí (throw síncrono, next(err), JSON malformado del body).
app.use((err, req, res, next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  console.error(`[${status}]`, req.method, req.originalUrl, { uid: req.user?.uid || null }, err);
  res.status(status).json({ error: status === 500 ? MENSAJE_500 : 'Petición inválida.' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`farmazed-api v2 on :${PORT}`);
  console.log('  /api/cases         -> Case management');
  console.log('  /mcp               -> Claude Cowork MCP server');
  console.log('  /api/admin/pricing -> Pricing table');
});

// Export db so routes/pricing.js (and future modules) can import it
module.exports = { db };

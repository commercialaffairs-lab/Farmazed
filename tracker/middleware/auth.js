const admin = require('../utils/firebase_admin.js');
const crypto = require('crypto');

// TAREA 32 (ajuste del PM tras la entrega — la verificación de correo solo
// en el front se salta llamando la API directo): refuerzo en el backend,
// pero SOLO para cuentas del registro abierto. `routes/register.js` pone
// el claim `origen:'registro'` — las de invitación (`invitations.js`,
// quedan `emailVerified:true` automático al aceptar), las semilla
// (`scripts/seed_*.js`, también `emailVerified:true`) y cualquier cuenta
// legacy nunca tienen este claim, así que esta regla no las toca.
//
// Sin excepciones de ruta hoy: reenviar el correo (`sendEmailVerification`)
// es una llamada directa al SDK de Firebase, no pasa por ningún endpoint
// de este tracker — no hay nada que el front necesite llamar aquí mientras
// espera la verificación. Si en el futuro aparece uno, agregarlo a
// EXEMPT_PATHS (contra `req.path`, relativo al router donde se monte
// requireAuth — ver Express docs).
// Rutas que una cuenta del registro abierto puede usar ANTES de verificar su correo
// (`req.path` es relativo al router: /api/register/reenviar-verificacion -> '/reenviar-verificacion').
const EXEMPT_PATHS = ['/reenviar-verificacion'];

/**
 * Verifies Firebase ID token from Authorization: Bearer <token>
 * Attaches decoded token to req.user
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(token, true); // checkRevoked: un admin degradado o una sesión cerrada dejan de valer YA, no al expirar el token (1 h)
    if (decoded.origen === 'registro' && decoded.email_verified === false && !EXEMPT_PATHS.includes(req.path)) {
      return res.status(403).json({ error: 'Verifica tu correo antes de continuar.' });
    }
    req.user = decoded; // uid, email, role (custom claim)
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Requires admin role. E3 (PM_COMMENTS §H.4): admite tanto el claim legacy
 * `admin: true` como el nuevo `role: 'admin'` — así ninguna cuenta creada
 * antes de la migración de roles pierde acceso admin. Ver
 * middleware/permissions.js para el resto de la matriz de roles.
 */
function requireAdmin(req, res, next) {
  if (!req.user?.admin && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * MCP key auth — separate from user auth.
 * The Cowork plugin sends: Authorization: Bearer mcp_<key>
 */
function requireMcpKey(req, res, next) {
  const header = req.headers.authorization || '';
  const key = header.startsWith('Bearer ') ? header.slice(7) : '';
  const validKey = process.env.MCP_KEY;
  // Comparación en tiempo constante (TAREA 39): se comparan los SHA-256, que
  // miden siempre lo mismo (timingSafeEqual exige igual largo).
  const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
  if (!validKey || !crypto.timingSafeEqual(sha(key), sha(validKey))) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Unauthorized — invalid MCP key' },
      id: null
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireMcpKey };

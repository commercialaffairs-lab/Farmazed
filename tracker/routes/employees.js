/**
 * employees.js — E3 parte 2 (UI), PM_COMMENTS §H.4.
 *
 * Lista de empleados de Farmazed (analista/abogado/regente/admin) — para el
 * selector "asignar caso" en admin/expediente.html y la vista de gestión en
 * admin/empresas.html.
 */

const { Router } = require('express');
const admin       = require('../utils/firebase_admin.js');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, STAFF_ROLES } = require('../middleware/permissions');
const { enviarRestablecimiento } = require('../services/correo');

const router = Router();
const EMPLOYEE_ROLES = [...STAFF_ROLES, 'admin'];

// ─── POST /api/employees/restablecer-contrasena (admin) ───────────────────────────────────
// Decisión 14 de Rick (31-oct-2026): el admin nunca ve contraseñas; en su lugar dispara el correo
// de restablecer para cualquier cuenta (empleado o cliente) por su correo.
router.post('/restablecer-contrasena', requireAuth, requirePermission('employees.list'), async (req, res) => {
  try {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return res.status(400).json({ error: 'Correo inválido.' });
    let user;
    try { user = await admin.auth().getUserByEmail(correo); } catch (e) {
      if (e.code === 'auth/user-not-found') return res.status(404).json({ error: 'No hay ninguna cuenta con ese correo.' });
      throw e;
    }
    const correoEnviado = await enviarRestablecimiento({ correo: user.email, nombre: user.displayName });
    res.json({ correoEnviado });
  } catch (e) {
    console.error('[employees] restablecer-contrasena', { error: e.message });
    res.status(500).json({ error: 'No se pudo enviar el correo de restablecimiento.' });
  }
});

// ─── GET /api/employees (admin) ────────────────────────────────────────────────
router.get('/', requireAuth, requirePermission('employees.list'), async (req, res) => {
  try {
    const usersResult = await admin.auth().listUsers(1000);
    const employees = usersResult.users
      .filter(u => EMPLOYEE_ROLES.includes(u.customClaims?.role))
      .map(u => ({ uid: u.uid, email: u.email, displayName: u.displayName || u.email, role: u.customClaims.role }));

    res.json({ total: employees.length, employees });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

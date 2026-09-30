/**
 * employees.js — E3 parte 2 (UI), PM_COMMENTS §H.4.
 *
 * Lista de empleados de Farmazed (analista/abogado/regente/admin) — para el
 * selector "asignar caso" en admin/expediente.html y la vista de gestión en
 * admin/empresas.html.
 */

const { Router } = require('express');
const admin       = require('firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, STAFF_ROLES } = require('../middleware/permissions');

const router = Router();
const EMPLOYEE_ROLES = [...STAFF_ROLES, 'admin'];

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

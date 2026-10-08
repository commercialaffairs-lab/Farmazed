/**
 * orgs.js (servicio) — TAREA 41. UNA sola función para crear una empresa (`orgs/{id}`).
 * Antes cuatro rutas (register, invitations, contact_leads, orgs) hacían su propio
 * `db().collection('orgs').add({...})` con campos ligeramente distintos; ahora todas
 * producen el mismo documento base y solo difieren en los campos opcionales que pasan.
 *
 * Campos: `nombre` (trim), `createdAt`, `createdBy` (uid de quien la creó, o `null` si
 * fue un auto-registro) y, solo si se pasan, `plan`, `pais`, `telefonoContacto`.
 */
const admin = require('../utils/firebase_admin.js');

/** Crea la empresa y devuelve su `DocumentReference`. */
async function createOrg({ nombre, createdBy = null, plan, pais, telefonoContacto }) {
  if (typeof nombre !== 'string' || !nombre.trim()) throw new Error('createOrg: nombre inválido');
  const data = {
    nombre: String(nombre).trim(),
    createdAt: admin.firestore.Timestamp.now(),
    createdBy,
    ...(plan !== undefined && { plan }),
    ...(pais !== undefined && { pais }),
    ...(telefonoContacto !== undefined && { telefonoContacto }),
  };
  return admin.firestore().collection('orgs').add(data);
}

module.exports = { createOrg };

/**
 * validar_texto.js — TAREA 37 (C1). Tope de longitud y tipo en los campos que
 * llegan de endpoints públicos (contact_leads, register, captación): lo que
 * se guarda aquí lo ve luego el staff en la bandeja.
 *
 * textoError(etiqueta, valor, max, requerido) -> mensaje de error o null.
 * Solo acepta `string` (un número/objeto/array es 400, no se castea), con
 * trim previo para medir el largo.
 */
function textoError(etiqueta, valor, max, requerido = true) {
  if (valor != null && typeof valor !== 'string') return `${etiqueta} debe ser texto.`;
  const limpio = (valor || '').trim();
  if (!limpio) return requerido ? `${etiqueta} es obligatorio.` : null;
  return limpio.length > max ? `${etiqueta} no puede pasar de ${max} caracteres.` : null;
}

// TAREA 39c: contraseña de CUENTAS NUEVAS (registro y aceptar invitación): 8 a 128.
// No se fuerza a las cuentas existentes (siguen entrando con la suya).
const PASSWORD_MIN = 8;
function errorPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > 128) return 'La contraseña no puede pasar de 128 caracteres.';
  return null;
}

// `j***@dominio.com` — para mostrar un correo sin exponerlo entero (GET público de la
// invitación, logs de los scripts de mantenimiento).
function enmascararCorreo(correo) {
  const texto = String(correo);
  const arroba = texto.lastIndexOf('@');
  return arroba > 0 ? `${[...texto.slice(0, arroba)][0]}***${texto.slice(arroba)}` : '***';
}

const trimOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

module.exports = { textoError, trimOrNull, errorPassword, enmascararCorreo, PASSWORD_MIN };

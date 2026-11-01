/**
 * correo.js — Correos transaccionales de Farmazed enviados por el tracker (07-oct-2026).
 *
 * Firebase envía su propio correo de verificación, pero su plantilla es texto plano (sin logo
 * ni colores). Con SMTP configurado, el tracker genera el enlace de verificación con el admin
 * SDK y lo manda con la plantilla de marca (emails/verificacion.html). Sin SMTP, no hace nada
 * y el portal sigue usando el correo de Firebase (sendEmailVerification en el navegador).
 *
 * Variables: SMTP_HOST, SMTP_PORT (587 STARTTLS | 465 TLS), SMTP_USER, SMTP_PASS,
 * SMTP_FROM ("Farmazed <no-reply@farmazed.com>"). Ver CORREOS.md.
 */
const fs = require('fs');
const path = require('path');
const admin = require('../utils/firebase_admin.js');
const { obtenerConfig } = require('../config');

const PLANTILLAS = path.join(__dirname, '..', 'emails');
let transporte = null;

function correoConfigurado(env = process.env) {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM);
}

function transportador() {
  if (!transporte) {
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 587;
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      // Google muestra la contraseña de aplicación en grupos de 4 ("xxxx xxxx …"): los espacios no forman parte de ella.
      auth: { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASS).replace(/\s+/g, '') },
    });
  }
  return transporte;
}

const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => HTML_ESC[c]);

// Rellena {{campo}} escapando todo (el nombre lo escribió el usuario).
function plantilla(nombreArchivo, valores) {
  const html = fs.readFileSync(path.join(PLANTILLAS, nombreArchivo), 'utf8');
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(valores[k]));
}

/**
 * Envía el correo de verificación de marca a `correo`. Devuelve true si lo envió, false si no
 * hay SMTP configurado. Lanza si el envío falla (quien llama decide si cae al correo de Firebase).
 */
async function enviarVerificacion({ correo, nombre }) {
  if (!correoConfigurado()) return false;
  const enlace = await admin.auth().generateEmailVerificationLink(correo, {
    url: `${obtenerConfig().portalUrl}/verificar-correo.html`, // a dónde vuelve tras confirmar
  });
  const html = plantilla('verificacion.html', { nombre: nombre || 'cliente', enlace, anio: new Date().getFullYear() });
  await transportador().sendMail({
    from: process.env.SMTP_FROM, to: correo,
    subject: 'Confirma tu correo para entrar al portal Farmazed',
    html,
    text: `Hola ${nombre || ''},\n\nTu cuenta en el portal de Farmazed ya está creada. Confirma tu correo con este enlace:\n${enlace}\n\nSi no creaste una cuenta en Farmazed, ignora este mensaje.\n\nFarmazed · Asuntos Regulatorios Farmacéuticos · Panamá`,
    attachments: [{ filename: 'logo.png', path: path.join(PLANTILLAS, 'logo.png'), cid: 'logo' }],
  });
  return true;
}

/**
 * Correo de invitación a crear la cuenta (decisión de Rick, 31-oct-2026): el admin invita, la
 * persona recibe el enlace y crea su contraseña. Devuelve true si lo envió, false si no hay SMTP.
 * Lanza si el envío falla (quien llama decide; el enlace sigue visible en el panel).
 */
async function enviarInvitacion({ correo, rol, empresa, enlace }) {
  if (!correoConfigurado()) return false;
  const html = plantilla('invitacion.html', {
    rol, empresa: empresa ? ` de ${empresa}` : '', enlace, anio: new Date().getFullYear(),
  });
  await transportador().sendMail({
    from: process.env.SMTP_FROM, to: correo,
    subject: 'Te invitaron al portal Farmazed — crea tu cuenta',
    html,
    text: `Hola,\n\nFarmazed te invitó a crear tu cuenta en su portal como ${rol}${empresa ? ` de ${empresa}` : ''}. Abre este enlace para elegir tu contraseña (vence en 7 días):\n${enlace}\n\nSi no esperabas esta invitación, ignora este mensaje.\n\nFarmazed · Asuntos Regulatorios Farmacéuticos · Panamá`,
    attachments: [{ filename: 'logo.png', path: path.join(PLANTILLAS, 'logo.png'), cid: 'logo' }],
  });
  return true;
}

/**
 * Correo para definir una contraseña nueva (decisión 14 de Rick, 31-oct-2026): lo pide el propio
 * usuario desde el login ("¿Olvidó su contraseña?") o el admin desde el panel. El enlace lo genera
 * Firebase Auth y lleva a su página de nueva contraseña; al terminar vuelve al login del portal.
 * Devuelve true si lo envió, false si no hay SMTP. Lanza si el envío falla.
 */
async function enviarRestablecimiento({ correo, nombre }) {
  if (!correoConfigurado()) return false;
  const enlace = await admin.auth().generatePasswordResetLink(correo, { url: `${obtenerConfig().portalUrl}/login.html` });
  const html = plantilla('restablecer.html', { nombre: nombre || 'cliente', enlace, anio: new Date().getFullYear() });
  await transportador().sendMail({
    from: process.env.SMTP_FROM, to: correo,
    subject: 'Define una contraseña nueva para el portal Farmazed',
    html,
    text: `Hola ${nombre || ''},\n\nRecibimos una solicitud para cambiar la contraseña de tu cuenta en el portal de Farmazed. Abre este enlace para definir una nueva (vence en 1 hora):\n${enlace}\n\nSi no fuiste tú, ignora este mensaje: tu contraseña actual sigue igual.\n\nFarmazed · Asuntos Regulatorios Farmacéuticos · Panamá`,
    attachments: [{ filename: 'logo.png', path: path.join(PLANTILLAS, 'logo.png'), cid: 'logo' }],
  });
  return true;
}

module.exports = { correoConfigurado, enviarVerificacion, enviarInvitacion, enviarRestablecimiento, plantilla };

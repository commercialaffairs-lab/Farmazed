# Correos de Farmazed (verificación de cuenta)

Guía para Rick (07-oct-2026). Dos niveles: lo que se puede arreglar hoy en la consola de
Firebase, y el correo de marca que envía el tracker para producción.

## 1. Hoy: plantilla de Firebase en español (consola)

Firebase envía el correo de verificación con su propia plantilla. **No admite HTML** (ni
logo ni colores): solo remitente, asunto y texto con el enlace. Para dejarlo en español:

Firebase Console → proyecto → **Authentication → Plantillas → Verificación de dirección de
correo electrónico** → lápiz:

- **Nombre del remitente**: `Farmazed`
- **Responder a**: `info@farmazed.com`
- **Asunto**: `Confirma tu correo para entrar al portal Farmazed`
- **Mensaje**:

```
Hola %DISPLAY_NAME%:

Tu cuenta en el portal de Farmazed ya está creada. Confirma que este correo es tuyo con el siguiente enlace:

%LINK%

Si no creaste una cuenta en Farmazed, ignora este mensaje: nadie podrá usar tu correo sin confirmarlo.

Farmazed · Asuntos Regulatorios Farmacéuticos · Panamá
```

- Idioma de la plantilla (icono del idioma, arriba): **Español**.
- Repetir en el proyecto de producción (`farmazed`) y en el de pruebas (`farmazed-pruebas`).

Con esto el correo llega en español y firmado por Farmazed, aunque sigue saliendo de
`noreply@<proyecto>.firebaseapp.com`. Para que salga de `no-reply@farmazed.com` hay que
verificar el dominio en esa misma pantalla ("Personalizar dominio": añade registros DNS en
farmazed.com) — recomendable para producción, mejora la entrega.

## 2. Producción: correo de marca enviado por el tracker

Con SMTP configurado, el tracker genera el enlace de verificación (admin SDK) y envía
`tracker/emails/verificacion.html`: logo, paleta del portal, botón "Confirmar mi correo",
enlace alternativo y pie con los datos de Farmazed. El navegador ya no manda el de Firebase.
Sin SMTP, todo sigue como hoy (correo de Firebase).

Variables (Secret Manager en Cloud Run; `tracker/.env` en local):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info@farmazed.com
SMTP_PASS=<contraseña de aplicación de Google>
SMTP_FROM=Farmazed <info@farmazed.com>
```

El correo oficial es `info@farmazed.com` (Google Workspace). Para enviar desde él:
`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=info@farmazed.com`, `SMTP_PASS=<contraseña
de aplicación>` (Google: cuenta info@ → Seguridad → verificación en 2 pasos activada → Contraseñas
de aplicaciones → nueva, 16 caracteres) y `SMTP_FROM=Farmazed <info@farmazed.com>`. Google ya firma
SPF/DKIM del dominio. Límite de Workspace: ~2.000 correos/día por cuenta, de sobra.

Dónde se usa: `POST /api/register` (al crear la cuenta) y `POST /api/register/reenviar-verificacion`
(botón "Reenviar correo"). El enlace vuelve a `PORTAL_URL/verificar-correo.html`.

Vista previa sin enviar nada (desde `tracker/`): `node -e "const c=require('./services/correo');
process.stdout.write(c.plantilla('verificacion.html',{nombre:'Ana',enlace:'https://ejemplo',anio:2026}))" > /tmp/vista.html`.

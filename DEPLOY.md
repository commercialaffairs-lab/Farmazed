# Farmazed — Deployment Guide

## Repositorio
- **GitHub:** https://github.com/RichoX-Hub/Farmazed
- **Branch:** `main`
- **Visibilidad:** Público (requerido para clone en Cloud Shell sin auth)

---

## Producción — Google Cloud Run

### Datos del proyecto
| Campo | Valor |
|-------|-------|
| GCP Project ID | `farmazed` |
| Project Number | `267037695065` |
| Region | `us-central1` |
| Service | `farmazed-web` |
| Service URL | `https://farmazed-web-267037695065.us-central1.run.app` |
| Dominio principal | `https://farmazed.com` |
| Dominio www | `https://www.farmazed.com` |

### DNS — Cloud DNS
- **Zona:** `farmazed-zone`
- **Nameservers:**
  - `ns-cloud-e1.googledomains.com`
  - `ns-cloud-e2.googledomains.com`
  - `ns-cloud-e3.googledomains.com`
  - `ns-cloud-e4.googledomains.com`
- **Registrador:** Squarespace (migrado desde Google Domains)

### Registros DNS configurados
| Nombre | Tipo | Valor |
|--------|------|-------|
| `farmazed.com.` | A | `216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21` |
| `www.farmazed.com.` | CNAME | `ghs.googlehosted.com.` |

### Domain Mappings en Cloud Run
```
farmazed.com     → farmazed-web (us-central1)
www.farmazed.com → farmazed-web (us-central1)
```

### Cómo redesplegar (desde Google Cloud Shell)

> **IMPORTANTE:** La auth local (`gcloud auth login`) no funciona en esta máquina.
> Usar siempre **Cloud Shell** en console.cloud.google.com

```bash
# 1. Clonar o actualizar el repo
git clone https://github.com/RichoX-Hub/Farmazed.git
# o si ya existe:
cd ~/Farmazed && git pull origin main

# 2. Ir a la carpeta raíz del proyecto
cd ~/Farmazed

# 3. Desplegar
gcloud run deploy farmazed-web \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 80 \
  --memory 256Mi \
  --quiet
```

### ANTES de desplegar el tracker (TAREAS 39/39b) — paso previo OBLIGATORIO

Desde la TAREA 39 una cuenta **sin claim `role`** (y sin el legacy `admin:true`) ya NO es
`cliente_titular` por defecto: recibe 403 en todo. Las cuentas reales creadas antes de E3 no tienen
`role`, así que hay que migrarlas **antes** de que el tracker nuevo reciba tráfico. La ejecución real
es decisión de Rick; el script ya trae el camino seguro (probado solo contra el emulador):

```bash
# Desde Cloud Shell (credenciales GCP de la sesión), en tracker/ de un clon al día:
cd ~/Farmazed/tracker && npm ci
# NO definir FIRESTORE_EMULATOR_HOST ni FIREBASE_AUTH_EMULATOR_HOST. El proyecto se nombra SIEMPRE con
# --project=<id> (si FIREBASE_PROJECT_ID/GOOGLE_CLOUD_PROJECT están definidos, deben coincidir).

# 1) DRY-RUN (por defecto con --prod): solo LISTA qué cuenta recibiría qué rol y qué casos recibirían
#    orgId. No escribe nada.
node scripts/migrate_roles.js --prod --project=farmazed

# 2) Revisar la lista (¿alguna cuenta que no debería ser cliente_titular? ¿empresas de más?).
#    Cada cuenta sin role se vuelve titular de una empresa PROPIA nueva (id `mig_<uid>`);
#    admin:true -> role:'admin'.

# 3) Solo con el visto bueno de Rick — escribe de verdad (idempotente: salta las que ya tienen role):
node scripts/migrate_roles.js --prod --project=farmazed --confirm
```

**Es reanudable** (TAREA 39c): por cuenta el orden es empresa (id determinista) → `orgId` en sus casos →
claims (lo último). Si se corta a mitad (red, credenciales, Ctrl-C), basta volver a correr el MISMO
comando: las cuentas ya migradas se saltan y las pendientes se completan sin empresas duplicadas ni
casos huérfanos.

El script se niega a correr sin `--prod` fuera del emulador, sin `--project=<id>`, a combinar `--prod`
con un emulador, con UN solo emulador definido, y `--confirm` sin `--prod`. En el emulador
(pruebas/demo) sigue escribiendo salvo `--dry-run`.

**Backfill de correos de invitaciones viejas** (mismo patrón y mismos modos; también previo al deploy,
para que el 409 de `register.js` vea las invitaciones guardadas antes de TAREA 39b con mayúsculas/espacios):

```bash
node scripts/backfill_invitaciones.js --prod --project=farmazed              # dry-run: lista los cambios
node scripts/backfill_invitaciones.js --prod --project=farmazed --confirm    # con el visto bueno de Rick
```

**Caducidad de invitaciones** (TAREA 39c): toda invitación caduca a los 7 días (`expiresAt` = creación +
7 d). Las ya existentes, sin `expiresAt`, se tratan como creadas + 7 días en el código (NO hace falta
backfill): las de más de 7 días darán 410 al abrirlas — el admin crea otra desde `admin/empresas.html`.
**Contraseñas**: las cuentas NUEVAS (registro y aceptar invitación) exigen mínimo 8 caracteres; las
existentes no se tocan.

**Variable `TRUST_PROXY`** (TAREA 39, rate limit por IP real): el tracker hace `app.set('trust proxy',
Number(TRUST_PROXY) || 1)`. El default `1` es correcto cuando delante de Cloud Run hay UN solo salto
(Cloud Run directo o domain mapping). Si `api.farmazed.com` pasa por otro intermediario (Load Balancer
externo, CDN, Firebase Hosting rewrite) hay que poner `TRUST_PROXY=2` (o los saltos que sean) en el
servicio; con un valor menor todos los usuarios compartirían la IP del intermediario (un solo cupo de
5 registros/10 min para todos). Verificar las cabeceras reales (`x-forwarded-for`) en el primer despliegue.

**Demo local (tmux `farmazed-demo`)**: corre el código anterior hasta reiniciarla. `demo_local.sh` ya
migra roles tras sembrar; si solo se reinicia el tracker sobre un emulador YA sembrado,
`cliente@farmazed.test` (cuenta legacy sin role) recibirá 403 hasta correr
`node tracker/scripts/migrate_roles.js` contra ese emulador (con `FIRESTORE_EMULATOR_HOST`/
`FIREBASE_AUTH_EMULATOR_HOST` de la demo).

### Configuración del tracker en producción (TAREA 40) — el servicio NO arranca sin esto

Desde la TAREA 40 el tracker valida su entorno al arrancar (`tracker/config.js`) y **sale con un error
claro** si falta algo; ya no hay proyecto/bucket por defecto ni cae al mock de pagos. El servicio
Cloud Run del tracker necesita, como mínimo:

| Variable | Valor / nota |
|---|---|
| `NODE_ENV` | `production` (Cloud Run además define `K_SERVICE`, que también cuenta como producción) |
| `FIREBASE_PROJECT_ID` | `farmazed` (ya no es el default implícito) |
| `GCS_BUCKET` | `farmazed-docs` (ya no es el default implícito) |
| `MCP_KEY` | aleatoria, **>= 32 caracteres** (`openssl rand -hex 32`); guardarla en Secret Manager |
| `PAYPAL_ENV` | `sandbox` o `live` |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` | de la app en developer.paypal.com (Secret Manager); guía completa en `PAYPAL_SETUP.md` |
| `TRUST_PROXY` | opcional, default `1` (ver arriba) |
| `CORS_ORIGINS` | opcional: orígenes https permitidos, separados por coma (lista explícita, sin comodines). Default `https://farmazed.com,https://www.farmazed.com` |

Nunca definir `FIRESTORE_EMULATOR_HOST` ni `PAYMENTS_PROVIDER=mock` en producción (ambos son error de
arranque). El mock de pagos solo corre con los emuladores (o `PAYMENTS_PROVIDER=mock` fuera de producción).

> **REQUISITO DURO, no un aviso:** el servicio actual probablemente corre SIN `FIREBASE_PROJECT_ID`,
> `GCS_BUCKET` ni las variables de PayPal (usaba defaults y el mock). Con este código esa revisión
> **no arranca** hasta que existan, y las de PayPal exigen que Rick cree antes la app en
> developer.paypal.com. No desplegar el tracker nuevo sin tener todo listo.

Orden seguro (desde Cloud Shell):
```bash
# 1) Ver el entorno ACTUAL del servicio (qué falta):
gcloud run services describe <servicio-tracker> --region us-central1 --format='value(spec.template.spec.containers[0].env)'
# 2) Poner las variables (secretos en Secret Manager, no en claro):
gcloud run services update <servicio-tracker> --region us-central1 \
  --set-env-vars=NODE_ENV=production,FIREBASE_PROJECT_ID=farmazed,GCS_BUCKET=farmazed-docs,PAYPAL_ENV=sandbox \
  --update-secrets=MCP_KEY=mcp-key:latest,PAYPAL_CLIENT_ID=paypal-client-id:latest,PAYPAL_CLIENT_SECRET=paypal-client-secret:latest,PAYPAL_WEBHOOK_ID=paypal-webhook-id:latest
# 3) Desplegar la revisión nueva SIN tráfico y comprobar que arranca (si falla la validación, sale con el
#    error de config y el tráfico sigue en la revisión anterior):
gcloud run deploy <servicio-tracker> --source . --region us-central1 --no-traffic --tag candidata
curl -s https://candidata---<servicio-tracker>-<hash>-uc.a.run.app/health
# 4) Solo entonces, pasar el tráfico:
gcloud run services update-traffic <servicio-tracker> --region us-central1 --to-latest
```
(`PAYPAL_ENV=sandbox` en producción arranca con una advertencia en el log: los cobros no son reales
pero sí abren el gate de fase_05; usar `live` solo con la app real aprobada.)

**Reglas de Firebase** (`firestore.rules`, `storage.rules`): deny-all — el front no accede directo, todo
va por el tracker (Admin SDK, que ignora las reglas). `firebase.json` ya apunta a ellas. **No están
desplegadas**: `firebase deploy --only firestore:rules,storage` (con `--project farmazed`) es decisión
de Rick; antes, confirmar en la consola de Firebase que las reglas de producción actuales no son
distintas a lo esperado.

**CORS**: producción acepta solo los orígenes de `CORS_ORIGINS` (por defecto `https://farmazed.com` y
`https://www.farmazed.com`, coincidencia exacta: ni subdominios, ni `http://`, ni `evil-farmazed.com`, ni
`localhost`). Si se agrega un front en otro subdominio, hay que listarlo explícitamente.

### Permisos requeridos (ya configurados)
- Service account `267037695065-compute@developer.gserviceaccount.com` tiene:
  - `roles/cloudbuild.builds.builder`
  - `roles/storage.admin`
  - `roles/run.invoker` para `allUsers`
- Org policy `iam.allowedPolicyMemberDomains` → Override: Allow All (proyecto farmazed)
- DNSSEC: **Deshabilitado** en el dominio

### Verificar estado del dominio
```bash
gcloud beta run domain-mappings describe --domain farmazed.com --region us-central1
gcloud beta run domain-mappings describe --domain www.farmazed.com --region us-central1
gcloud dns record-sets list --zone=farmazed-zone
```

---

## Local — Docker Desktop

### Datos del contenedor
| Campo | Valor |
|-------|-------|
| Nombre | `farmazed-web` |
| Puerto | `http://localhost:8092` |
| Imagen base | `nginx:alpine` |
| Dockerfile | `./Dockerfile` |
| Build context | `.` (raíz del proyecto) |

### Estructura nginx (local y producción)
```
root: /usr/share/nginx/html/farmazed-web
index: index.html
location /: try_files $uri $uri/ /index.html
```

### Comandos locales

```bash
# Construir y levantar
cd "Proyecto Farmazetd Regulatory/"
docker compose up --build -d

# Ver logs
docker logs farmazed-web

# Detener
docker compose down

# Reiniciar sin rebuild
docker compose restart
```

### Nota sobre el stack LOCAL-DOCKER.md
Este contenedor corre en el puerto `8092` para no colisionar con el stack principal de `pb-website`. No modifica `LOCAL-DOCKER.md`.

---

## Flujo de trabajo recomendado

```
1. Editar archivos en farmazed-web/
2. Probar local: docker compose up --build -d → localhost:8092
3. Commit y push: git add . && git commit -m "..." && git push origin main
4. Desplegar: Cloud Shell → git pull && gcloud run deploy ...
5. Verificar en farmazed.com
```

---

## Archivos clave
| Archivo | Propósito |
|---------|-----------|
| `Dockerfile` | Build nginx:alpine, copia farmazed-web/ como root |
| `nginx.conf` | Sirve farmazed-web/ en `/`, subpaths funcionan directamente |
| `docker-compose.yml` | Contenedor local puerto 8092 |
| `farmazed-web/` | Todo el sitio web (self-contained) |
| `farmazed-web/css/farmazed.css` | Overrides y responsive CSS |
| `farmazed-web/src/approx/` | Approx admin template (dashboards) |
| `farmazed-web/src/wecare/` | WeCare frontend template (landing) |
| `farmazed-web/src/images/` | Imágenes del sitio (Logo.png, About1-6.png, etc.) |
| `farmazed-web/src/icons/` | Iconos de categorías regulatorias |

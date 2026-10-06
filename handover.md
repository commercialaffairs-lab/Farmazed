# Farmazed — PM → Developer Handover
**Last updated:** 2026-08-25
**Prepared by:** Claude (PM)
**For:** Next development session

---

## Auditoría del Sitio en Producción (verificado 2026-08-25)

| URL / Servicio | Estado | Notas |
|---|---|---|
| `farmazed.com/` | ✅ Live | Marketing site completo, profesional |
| `farmazed.com/login.html` | ✅ Live (prototipo) | Login estático con credenciales hardcodeadas |
| `farmazed.com/portal/*` | ❌ NOT deployed | nginx sin rutas → fallback al marketing site |
| `farmazed.com/admin/*` | ❌ NOT deployed | nginx sin rutas → fallback al marketing site |
| `farmazed-tracker` → `/qr` | ✅ Live (v1) | Redirige a farmazed.com ✓ |
| `farmazed-tracker` → `/health` | ✅ (en v2) | Existe en el código v2, no desplegado aún |
| `farmazed-tracker` → `/api/*` | ❌ | No existe en v1 — tracker sigue en v1 |

**Credenciales del prototipo estático actual:**
- Admin: `user=ricardo` / `pass=admins123` → redirige a `dashboard.html`
- Cliente demo: `user=user` / `pass=admins123` → redirige a `client-dashboard.html`
- Estas credenciales son hardcodeadas en `farmazed-web/login.html` y DESAPARECEN cuando se despliegue el v2 con Firebase Auth real.

**Design Reference — NO BORRAR:**
- `farmazed-web/dashboard.html` — prototipo del panel admin (es la spec de diseño, ~100KB)
- `farmazed-web/client-dashboard.html` — prototipo del portal cliente (es la spec de diseño, ~73KB)
- Ambos son los prototipos originales que sirvieron de referencia para construir el v2. Deben conservarse como documentación de diseño, NO son duplicados del v2.

---

## ESTADO DEL CÓDIGO (2026-08-25)

> **Corrección (Claude Code IDE, 2026-08-25):** Esta sección y el "PASO 0B" de abajo describen un problema que ya fue resuelto el 25-ago en una sesión anterior — `Proyecto Farmazetd Regulatory\` SÍ está bajo git, con `origin` apuntando a `github.com/RichoX-Hub/Farmazed`, y ya se hizo `git push origin main` (confirmado de nuevo ahora: local y `origin/main` están sincronizados, 0 commits de diferencia). La carpeta `repo\` nunca fue necesaria — no es parte del pipeline de deploy (Cloud Shell clona fresco). El procedimiento de copia por PowerShell del PASO 0B es innecesario; no ejecutarlo. Ver `sessions/2026-08-25.md` (Session 2) para el detalle completo de cómo se resolvió (fue un problema de credenciales de GitHub, no de integración de código).
>
> El código de precios (`pricing.js`, `seed_pricing.js`, `precios.html`, más el mount en `index.js`) sí seguía sin commitear hasta ahora — ese es el único paso pendiente real, y se resuelve con un commit + push normal desde `Proyecto Farmazetd Regulatory\`, no con la copia a `repo\`.

El código nuevo (tracker v2 + portal + admin) está en `Proyecto Farmazetd Regulatory\` y **ya fue integrado al repositorio real** (`origin/main` en GitHub) — ver corrección arriba.

### Gaps identificados en el código v2 (TODOS CORREGIDOS — ver archivos adjuntos)

| # | Archivo | Problema | Fix |
|---|---|---|---|
| 1 | `tracker/index.js` | `pricingRouter` no estaba montado | Agregar `require('./routes/pricing')` + `app.use('/', pricingRouter)` |
| 2 | `tracker/index.js` | `db` no se exportaba | Agregar `module.exports = { db }` al final |
| 3 | `repo/nginx.conf` | Faltaban bloques `/portal/` y `/admin/` | Agregar las dos `location` blocks |
| 4 | `farmazed-web/portal/js/config.js` | `FIREBASE_CONFIG` tiene `REPLACE_WITH_*` | Llenar en Touchpoint 1 (esperado) |

**Los archivos corregidos (`index.js` y `nginx.conf`) están adjuntos a este handover como archivos separados. Copiarlos directamente.**

### Código que está limpio (sin cambios necesarios)

| Archivo | Estado |
|---|---|
| `tracker/middleware/auth.js` | ✅ Limpio — Firebase token verify + admin claim + MCP key |
| `tracker/routes/cases.js` | ✅ Con bugs fixes de la sesión 08-ago ya aplicados |
| `tracker/routes/documents.js` | ✅ Con bugs fixes de la sesión 08-ago ya aplicados |
| `tracker/routes/mcp.js` | ✅ 7 herramientas Cowork |
| `tracker/routes/pricing.js` | ✅ Creado en sesión 2026-08-25 |
| `tracker/data/faddi_checklists.js` | ✅ 6 módulos dinámicos |
| `tracker/package.json` | ✅ Todas las dependencias presentes |
| `farmazed-web/portal/js/config.js` | ⏳ API_BASE correcto, Firebase config pendiente (T1) |
| `farmazed-web/portal/js/auth.js` | ✅ Firebase Auth modular SDK v10, correcto |
| `farmazed-web/portal/js/api.js` | ✅ apiFetch wrapper correcto, todos los endpoints coinciden |
| `farmazed-web/portal/js/wizard.js` | ✅ Con bugs fixes de la sesión 08-ago ya aplicados |
| `farmazed-web/admin/precios.html` | ✅ UI de precios admin — creado en sesión 2026-08-25 |
| `tracker/seed_pricing.js` | ✅ Seed de 13 categorías de precios — creado en sesión 2026-08-25 |

---

## CHECKLIST COMPLETO — START HERE

Ejecutar en este orden exacto. Cada touchpoint desbloquea el siguiente.

---

### PASO 0A — Aplicar los 2 fixes de código ANTES de copiar al repo

> Los archivos corregidos están adjuntos a este handover. Copiarlos sobre los originales.

```
fixes/index.js   →  Proyecto Farmazetd Regulatory\tracker\index.js
fixes/nginx.conf →  repo\nginx.conf
```

**Qué cambia en index.js:**
- Agrega `const pricingRouter = require('./routes/pricing'); app.use('/', pricingRouter);`
- Agrega `module.exports = { db };` al final

**Qué cambia en nginx.conf:**
- Agrega bloques `location /portal/` y `location /admin/` antes del catch-all `/`

---

### ~~PASO 0B — Integrar código al repo (T0 original)~~ ✅ YA NO NECESARIO

> Ver corrección arriba — `origin/main` ya tiene todo este código desde una sesión anterior. Dejado abajo solo como referencia histórica; no ejecutar.

**Tiempo estimado:** 30–45 min

```powershell
$src = "C:\Users\richy\Desktop\Programas en PYTON\Farmazed\Proyecto Farmazetd Regulatory"
$dst = "C:\Users\richy\Desktop\Programas en PYTON\Farmazed\repo"

# Tracker completo (reemplaza v1)
Copy-Item "$src\tracker\index.js"       "$dst\tracker\index.js" -Force
Copy-Item "$src\tracker\package.json"   "$dst\tracker\package.json" -Force
Copy-Item "$src\tracker\Dockerfile"     "$dst\tracker\Dockerfile" -Force

New-Item -ItemType Directory -Force "$dst\tracker\middleware"
Copy-Item "$src\tracker\middleware\auth.js" "$dst\tracker\middleware\auth.js"

New-Item -ItemType Directory -Force "$dst\tracker\services"
Copy-Item "$src\tracker\services\storage.js" "$dst\tracker\services\storage.js"

New-Item -ItemType Directory -Force "$dst\tracker\routes"
Copy-Item "$src\tracker\routes\cases.js"     "$dst\tracker\routes\cases.js"
Copy-Item "$src\tracker\routes\documents.js" "$dst\tracker\routes\documents.js"
Copy-Item "$src\tracker\routes\mcp.js"       "$dst\tracker\routes\mcp.js"
Copy-Item "$src\tracker\routes\pricing.js"   "$dst\tracker\routes\pricing.js"

New-Item -ItemType Directory -Force "$dst\tracker\data"
Copy-Item "$src\tracker\data\faddi_checklists.js" "$dst\tracker\data\faddi_checklists.js"
Copy-Item "$src\tracker\seed_pricing.js"           "$dst\tracker\seed_pricing.js"

# Portal y admin
Copy-Item "$src\farmazed-web\portal" "$dst\farmazed-web\portal" -Recurse -Force
Copy-Item "$src\farmazed-web\admin"  "$dst\farmazed-web\admin"  -Recurse -Force
```

**Verificar que existen:**
```bash
ls tracker/middleware/auth.js
ls tracker/routes/cases.js
ls tracker/routes/pricing.js
ls farmazed-web/portal/login.html
ls farmazed-web/admin/casos.html
```

**Commit:**
```bash
cd "C:\Users\richy\Desktop\Programas en PYTON\Farmazed\repo"
git add .
git commit -m "feat: integrate tracker v2 (API + MCP + pricing) + client portal + admin panel"
git push origin main
```

---

### PASO 1 — Firebase Project Setup (1–2 horas)

**Donde:** https://console.firebase.google.com → proyecto "farmazed"

```
1. Authentication → Sign-in method → Habilitar "Email/Password"
2. Firestore Database → Create database:
   - Region: us-central1
   - Mode: Production (locked rules — se abren en Fase 3)
3. Project Settings → General → "Add app" → Web → nickname "farmazed-portal"
4. Copiar el objeto firebaseConfig que aparece
5. Abrir: repo/farmazed-web/portal/js/config.js
   Reemplazar:
     REPLACE_WITH_YOUR_API_KEY  → apiKey real
     REPLACE_WITH_SENDER_ID     → messagingSenderId real
     REPLACE_WITH_APP_ID        → appId real
   (authDomain y projectId ya están correctos: farmazed.firebaseapp.com / farmazed)
6. git add farmazed-web/portal/js/config.js && git commit -m "config: firebase credentials for portal"
```

---

### PASO 2 — GCS Bucket (30 min)

**Donde:** GCP Console → Cloud Shell

```bash
gsutil mb -l us-central1 gs://farmazed-docs

cat > cors.json << 'EOF'
[{
  "origin": ["https://farmazed.com", "https://www.farmazed.com", "http://localhost:8092"],
  "method": ["GET", "POST", "DELETE"],
  "maxAgeSeconds": 3600,
  "responseHeader": ["Content-Type", "Authorization"]
}]
EOF

gsutil cors set cors.json gs://farmazed-docs
# El bucket queda PRIVADO — docs se sirven via signed URLs de 1h
```

---

### PASO 3 — Service Account (20 min)

**Donde:** GCP Console → IAM & Admin → Service Accounts

```
1. Crear service account: farmazed-api-sa
2. Asignar roles:
   - Cloud Datastore User (Firestore)
   - Storage Object Admin (Cloud Storage)
   - Firebase Admin SDK Administrator Service Agent
3. NO descargar JSON key para producción (Cloud Run inyecta credenciales automáticamente)
4. Para dev local: descargar JSON y setear GOOGLE_APPLICATION_CREDENTIALS
```

---

### PASO 4 — Redeploy farmazed-tracker con código v2 (15 min)

⚠️ Usar Google Cloud Shell — NO gcloud local (no funciona en esta máquina)

```bash
# En Cloud Shell:
git clone https://github.com/RichoX-Hub/Farmazed.git
# (o si ya existe: cd ~/Farmazed && git pull origin main)

cd ~/Farmazed/tracker

# Generar claves (guardar en gestor de contraseñas):
openssl rand -hex 32   # → ADMIN_KEY
openssl rand -hex 32   # → MCP_KEY

# Build y redeploy del servicio existente:
gcloud builds submit --tag gcr.io/farmazed/farmazed-tracker

gcloud run deploy farmazed-tracker \
  --image gcr.io/farmazed/farmazed-tracker \
  --region us-central1 \
  --service-account farmazed-api-sa@farmazed.iam.gserviceaccount.com \
  --set-env-vars "GCS_BUCKET=farmazed-docs,ADMIN_KEY=<tu-ADMIN_KEY>,MCP_KEY=<tu-MCP_KEY>,REDIRECT_URL=https://farmazed.com" \
  --allow-unauthenticated \
  --port 8080
```

> ⚠️ El servicio se llama **`farmazed-tracker`**, NO crear uno nuevo.
> Guardar `MCP_KEY` — se necesita en el Paso 8 para el plugin de Cowork.

**Verificar después del deploy:**
```bash
curl https://farmazed-tracker-267037695065.us-central1.run.app/health
# → {"status":"ok"}
```

---

### PASO 4.5 — Seed de precios en Firestore (5 min)

**Ejecutar UNA SOLA VEZ después del Paso 4, desde la carpeta tracker/:**

```bash
# En local (con GOOGLE_APPLICATION_CREDENTIALS configurado):
cd "C:\Users\richy\Desktop\Programas en PYTON\Farmazed\Proyecto Farmazetd Regulatory\tracker"
node seed_pricing.js
# → ✅ Seeded 13 pricing categories.

# O desde Cloud Shell (después de git pull):
cd ~/Farmazed/tracker
node seed_pricing.js
```

Este script crea la colección `pricing` en Firestore con las 13 categorías de precios. Sin esto, la página `/admin/precios.html` aparece vacía.

---

### PASO 5 — Primer Usuario Admin (5 min)

```bash
# 1. Firebase Console → Authentication → Users → Add user
#    (email + password para Zelky o Ricardo)

# 2. Copiar el UID del usuario

# 3. Asignar rol admin:
curl -X POST https://api.farmazed.com/api/admin/set-role \
  -H "x-admin-key: <ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"uid": "<firebase_uid>", "admin": true}'
```

> Si `api.farmazed.com` aún no está mapeado al servicio, usar la URL directa del Cloud Run en su lugar.

---

### PASO 6 — Redeploy farmazed-web (20 min)

El nginx.conf ya fue actualizado en el Paso 0A. Solo hace falta redeploy:

```bash
cd ~/Farmazed
gcloud run deploy farmazed-web \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 80 \
  --memory 256Mi \
  --quiet
```

---

### PASO 7 — Verificación End-to-End (15 min)

```
1. GET https://api.farmazed.com/health → {"status":"ok"}

2. Abrir https://farmazed.com/portal/login.html
   → Debe cargar el login de Firebase (NO el prototipo estático)
   → Registrar cuenta de prueba
   → Verificar que aparece en Firebase Console → Authentication

3. Crear caso de prueba (tramiteType: medicamentos, tipoRegistro: Regular)
   → Completar los 5 pasos del wizard
   → Verificar en Firestore: colección 'cases', status: 'submitted'

4. Subir un PDF de prueba
   → Verificar que aparece en gs://farmazed-docs

5. Abrir https://farmazed.com/admin/casos.html con usuario admin
   → Verificar que el caso aparece en la lista

6. Abrir el expediente → clicar "Abrir en Cowork" → copiar contexto generado

7. GET https://api.farmazed.com/api/admin/pricing
   → Debe retornar las 13 categorías de precios
```

---

### PASO 8 — Plugin MCP en Cowork (5 min/persona)

Para cada miembro del equipo Farmazed que use Claude Cowork:

```
1. Claude Cowork → Settings → Plugins → Add MCP Server
2. URL: https://api.farmazed.com/mcp
3. Auth: Bearer <MCP_KEY>  (generado en Paso 4)
4. Verificar: pedir a Claude "farmazed_list_cases" → debe retornar lista de casos
```

---

## Después del deploy — Prioridades Fase 3

1. **Firestore security rules** — actualmente Production (todo bloqueado excepto Admin SDK). Escribir reglas para que clientes solo lean/escriban sus propios casos.

2. **Email notifications** (SendGrid) — trigger al crear expediente, cambiar estado, solicitar documento. Agregar `SENDGRID_API_KEY` como env var en Cloud Run.

3. **Domain mapping `api.farmazed.com`** — si no está mapeado aún al servicio `farmazed-tracker`:
   ```bash
   gcloud beta run domain-mappings create \
     --service farmazed-tracker \
     --domain api.farmazed.com \
     --region us-central1
   ```

---

## Preguntas abiertas para Ricardo

- ¿Portal permite auto-registro, o Farmazed invita clientes manualmente?
- ¿Email de notificaciones (`notificaciones@farmazed.com`) o usar Gmail personal?
- ¿Panel admin protegido por contraseña separada, o solo Firebase custom claim?

---

## Bugs corregidos (Sesión 08-ago — ya en código)

- `cases.js` — submit del wizard quedaba en `draft` forever
- `cases.js` — `productName` nunca se computaba → "(sin nombre)" en todos los cards
- `cases.js` + `faddi_checklists.js` — tramiteType inválido producía `NaN%` en progreso
- `middleware/auth.js` + `index.js` — claves hardcodeadas en repo público; eliminadas
- `documents.js` — faltaba endpoint REST `POST /:caseId/documents/request`
- `admin/expediente.html` — botón "Solicitar documento" sin auth header y a ruta inexistente
- `portal/dashboard.html` — links de casos apuntaban a ruta 404
- `portal/js/wizard.js` — listener de upload se re-adjuntaba en cada refresh → uploads duplicados
- `tracker/Dockerfile` — `COPY . .` enviaba `node_modules` de Windows; agregado `.dockerignore`

## Bugs corregidos (Sesión 2026-08-25 — archivos adjuntos)

- `tracker/index.js` — `pricingRouter` no estaba montado → endpoints de precios daban 404
- `tracker/index.js` — `module.exports = { db }` agregado (no rompe nada, queda como referencia para futuros módulos)
- `repo/nginx.conf` — faltaban bloques `/portal/` y `/admin/` → portal/admin caían en marketing site
- `tracker/routes/pricing.js` — **BUG CRÍTICO (detectado por Claude Code IDE):** `const { db } = require('../index')` creaba un circular require. Node resuelve el circular require devolviendo los exports de `index.js` en el punto en que se encuentran al requerirse — que es vacío, porque `module.exports = { db }` está al final del archivo. Resultado: `db` era `undefined` en tiempo de ejecución y cada endpoint de precios lanzaba `Cannot read properties of undefined (reading 'collection')`. Fix aplicado: reemplazado por `const admin = require('firebase-admin'); const db = admin.firestore();` — el mismo patrón que usan `cases.js` y `documents.js`.

---

## Observaciones PM — Sesión 2026-08-25 (wizard en local)

> PM revisó el wizard corriendo en localhost. Anotar y resolver antes de siguiente deploy.

---

### BUG CRÍTICO — GET /api/cases/:id/documents → 500 Internal Server Error

**Síntoma:** Consola del navegador muestra dos veces:
```
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
GET :8080/api/cases/<caseId>/documents
```

**Impacto:** El Paso 4 (Carga Documental) no carga el checklist. El wizard queda bloqueado — ningún cliente puede avanzar más allá del Paso 3.

**Causa probable:** La ruta `GET /api/cases/:id/documents` no está implementada en el backend, o falla al consultar Firestore.

**Fix requerido:** Verificar si la ruta existe:
```bash
grep -r "documents" tracker/routes/
grep -r "checklist" tracker/routes/
```
Si no existe, implementarla. El endpoint debe:
1. Leer el caso desde Firestore por `caseId`
2. Extraer `tramiteType`, `tipoRegistro`, `tipoMedicamento`
3. Llamar a `getChecklist(tramiteType, { tipoRegistro, tipoMedicamento })` de `faddi_checklists.js`
4. Devolver `{ ok: true, documents: checklist }`

Ejemplo mínimo:
```javascript
const { getChecklist } = require('../data/faddi_checklists');

router.get('/api/cases/:caseId/documents', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection('cases').doc(req.params.caseId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Case not found' });
    const data = snap.data();
    const checklist = getChecklist(data.tramiteType, {
      tipoRegistro:    data.tipoRegistro    || 'Regular',
      tipoMedicamento: data.tipoMedicamento || [],
    });
    res.json({ ok: true, documents: checklist });
  } catch (err) {
    console.error('GET /api/cases/:caseId/documents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

### UX — Paso 2 "Datos del Producto": campos libres que deben ser dropdowns

**Principio:** Solo dejar campo de texto libre cuando el valor es único por producto (nombre propio). Todo campo con catálogo finito de valores válidos → dropdown. Cuando el valor de un campo determina las opciones del siguiente → campos en cascada.

#### Bug de etiqueta
El campo "Forma Farmacéutica" aparece etiquetado como **"Forma Cosmética"** incluso en trámites de medicamentos. El label debe ser dinámico según `tramiteType`:
- `medicamentos` → "Forma Farmacéutica"
- `cosmeticos` → "Forma Cosmética"
- `higienicos` / `plaguicidas` → "Forma de Presentación"

#### Campos faltantes en pantalla actual
Comparando con los 12 campos requeridos por el proceso regulatorio, faltan:

| Campo | Tipo |
|---|---|
| Principio Activo | Texto libre |
| Concentración | Número libre + dropdown de unidad (mg / mg/mL / % / UI / mcg / g) |
| Vía de Administración | Dropdown — filtrado por Forma Farmacéutica |
| Condición de Venta | Dropdown |
| Código ATC | Texto libre (opcional) |
| Vida Útil | Dropdown |
| Condiciones de Almacenamiento | Dropdown multi-selección |

#### Campos actuales que deben convertirse a dropdown

| Campo | Acción |
|---|---|
| Clasificación (muestra "Para el dolor" como texto libre) | → Dropdown: Grupo Terapéutico |
| Forma Farmacéutica / "Forma Cosmética" | → Dropdown + activa cascada hacia Vía de Administración |
| Descripción del Envase | → Dropdown |
| Presentación del Producto | → Campo compuesto: cantidad (número) + unidad (dropdown) |

#### Lógica de cascada recomendada
Los campos se habilitan en secuencia. Forma Farmacéutica filtra las opciones de Vía de Administración:
```
Tableta / Cápsula / Jarabe / Suspensión Oral  →  Vía: Oral
Tableta Sublingual                             →  Vía: Sublingual
Solución Inyectable / Polvo para Inyectable   →  Vía: IV / IM / SC
Crema / Gel / Parche                          →  Vía: Tópica / Transdérmica
Aerosol / Polvo para Inhalación               →  Vía: Inhalatoria
Supositorio                                   →  Vía: Rectal
Óvulo / Crema Vaginal                         →  Vía: Vaginal
Colirio                                       →  Vía: Oftálmica
```

#### Catálogos completos

**Forma Farmacéutica:**
Tableta, Tableta Recubierta, Tableta de Liberación Prolongada, Cápsula, Cápsula de Gelatina Blanda, Polvo para Suspensión Oral, Granulado, Comprimido Masticable, Jarabe, Solución Oral, Suspensión Oral, Gotas Orales, Solución Inyectable, Polvo para Solución Inyectable, Suspensión Inyectable, Concentrado para Infusión, Crema, Ungüento, Gel, Loción, Solución Tópica, Parche Transdérmico, Aerosol para Inhalación, Polvo para Inhalación, Solución para Nebulización, Supositorio, Óvulo, Crema Vaginal, Colirio, Ungüento Oftálmico, Gotas Óticas, Implante, Película Oral

**Condición de Venta:**
Con Receta Médica, Sin Receta Médica (OTC), Uso Hospitalario, Producto Controlado

**Descripción del Envase:**
Frasco de Vidrio, Frasco Plástico (HDPE), Frasco Plástico (PET), Frasco Gotero, Ampolla, Vial, Caja (con blister), Blister, Strip, Tubo (Aluminio), Tubo (Plástico), Sachet/Sobre, Jeringa Precargada, Bolsa para Infusión, Tarro, Lata, Aerosol

**Unidades de Concentración:**
mg, mg/mL, mg/5mL, g, g/100mL, %, UI, mcg, mcg/mL, mEq/mL, mg/g

**Vida Útil:**
12 meses, 18 meses, 24 meses, 30 meses, 36 meses, 48 meses, 60 meses

**Condiciones de Almacenamiento (multi-selección):**
Temperatura ambiente (15–30°C), Refrigerar (2–8°C), Congelar (≤–20°C), Proteger de la luz, Proteger de la humedad, No requiere condiciones especiales

**Grupo Terapéutico:**
Sistema Nervioso Central, Sistema Cardiovascular, Sistema Respiratorio, Sistema Digestivo y Metabolismo, Antiinfecciosos, Sistema Musculoesquelético, Sistema Genitourinario y Hormonas Sexuales, Hormonas Sistémicas, Dermatológicos, Oftalmológicos y Otológicos, Antineoplásicos e Inmunomoduladores, Sistema Hematológico, Nutrición y Metabolismo, Diagnóstico y Contraste, Otros

**Tipo de Presentación:**
Unitaria, Múltiple, Institucional / Hospital

---

### Respuesta developer — BUG CRÍTICO 500 en /api/cases/:id/documents: NO reproducible

> **Claude Code IDE, 2026-08-25:** Investigado antes de implementar el fix propuesto arriba, porque no coincidía con el código real: `GET /api/cases/:id/documents` (en `documents.js`) ya existe y es un endpoint distinto de `/api/cases/:id/checklist` (en `cases.js`) — que es el que `wizard.js` realmente llama en Paso 4 (confirmado por grep, `wizard.js` nunca llama a `/documents`).
>
> Probado end-to-end con un usuario y caso de prueba reales (token real vía Identity Toolkit, no simulado): `POST /api/cases` → `GET /api/cases/:id/checklist` → `GET /api/cases/:id/documents`. Los tres devuelven `200` con datos correctos. Cero errores en los logs del servidor local (corriendo toda la sesión).
>
> Hipótesis: el PM probablemente testeó contra el `node_modules` corrupto que esta sesión encontró y arregló más temprano (faltaban archivos internos de `firebase-admin` y `whatwg-url` — cualquier ruta que tocara Firestore habría lanzado 500 con esa corrupción). Ya resuelto vía `rm -rf node_modules && npm install` limpio + `package-lock.json` commiteado.
>
> No se implementó el fix propuesto (habría agregado una ruta duplicada con semántica incorrecta — mezclar checklist y documentos). Si el 500 reaparece con node_modules limpio, avisar con el caseId y el stack trace completo del servidor para diagnosticar el caso real.

### Documentos de referencia del proceso (generados sesión 2026-08-25)

| Archivo | Contenido |
|---|---|
| `process_map.md` | Mapa completo de las 6 rutas del wizard — decisiones, documentos por path, flujo paso a paso |
| `dev_build_order.md` | Orden de desarrollo recomendado: 8 fases de menor a mayor complejidad, con criterios de aceptación por fase |

---

## Deuda técnica conocida (no urgente)

- Ownership-check duplicado en cases.js/documents.js
- `express-validator` declarado en package.json pero no usado
- Tablas de icons/URLs por tramiteType duplicadas en wizard.js, dashboard.html, casos.html, mcp.js
- Design spec (`References/Frontend Farmazed/Maindasboard.md`) más rico que lo implementado

---

## Actualización developer — Sesión 2026-08-26 (pivote de arquitectura frontend + gaps de datos reales)

### Pivote de arquitectura: el frontend real ahora es el prototipo raíz, no portal/

Decisión de Ricardo (Product Owner), tomada directamente conmigo en sesión: `farmazed-web/login.html`, `farmazed-web/client-dashboard.html` y `farmazed-web/dashboard.html` (los archivos en la raíz de `farmazed-web/`) dejan de ser solo "spec de diseño" — pasan a ser el ÚNICO frontend real del sistema. Esto reemplaza la lógica de la sección "Design Reference — DO NOT DELETE" más arriba: ya no hay que "replicar" estos archivos dentro de `portal/`, hay que conectarles datos reales directamente, in place, conservando el diseño exacto.

Como consecuencia:
- `farmazed-web/portal/login.html`, `farmazed-web/portal/dashboard.html` (un clon que se había construido esta misma sesión antes del pivote), `portal/js/shell.js` y `portal/css/shell.css` quedan sin usar. No se borraron (a la espera de que Ricardo confirme), pero no forman parte del flujo activo.
- `farmazed-web/portal/js/auth.js` y `portal/js/api.js` SÍ se siguen usando — se importan directamente desde los archivos de la raíz (ej. `import { login } from './portal/js/auth.js'` en `login.html`).
- La lógica real del wizard de 5 pasos (`portal/nuevo.html` + `portal/js/wizard.js`, con las reglas por trámite de las Fases 2-8 ya construidas) queda huérfana — el módulo "Solicitar Registro" dentro de `client-dashboard.html` todavía corre el wizard falso de 4 pasos del prototipo original, que nunca llama a `createCase()`. Ver gap #7 abajo.

### Trabajo ya aplicado esta sesión

- `farmazed-web/login.html` — login de credenciales hardcodeadas reemplazado por Firebase Auth real (`login()` / `isAdmin()` de `portal/js/auth.js`), mismo diseño exacto.
- `farmazed-web/client-dashboard.html` — auth guard de sessionStorage reemplazado por `requireLogin()` / `logout()` reales.
- `farmazed-web/dashboard.html` — mismo cambio + gate de admin (`isAdmin()`; si el usuario no es admin, redirige a `client-dashboard.html`).
- `farmazed-web/client-dashboard.html` — el objeto `DATA` hardcodeado (2 pendientes, 5 productos, 10 documentos, 3 hilos de mensajes de ejemplo) se vació a cero/arrays vacíos, con estados vacíos agregados en Productos/Documentos/Mensajes para que no se rompa nada con una cuenta recién creada.

### Gaps entre el diseño del prototipo y los datos reales disponibles

Comparé `client-dashboard.html` campo por campo contra `tracker/routes/cases.js`, `tracker/routes/documents.js` y `tracker/data/faddi_checklists.js`. Necesito que el PM/Ricardo decida el alcance de los marcados "Sí" antes de terminar de conectar esos módulos con datos reales:

| # | Gap | Dónde se ve | ¿Decisión de producto? | Detalle |
|---|---|---|:---:|---|
| 1 | Sin fecha de vencimiento/renovación en `cases` (solo hay `createdAt`/`updatedAt`) | Resumen ("Próximos a vencer"), Productos (columna vencimiento) | Sí | Agregar campo `vencimiento` al caso (¿quién lo carga: cliente, FADDI, o Farmazed tras aprobación?) vs. quitar esa funcionalidad por ahora |
| 2 | Sin código de expediente legible (tipo "FZ-0234") — Firestore usa IDs random | Productos, Documentos | Sí | Generar secuencial al crear el caso (trabajo pequeño) vs. mostrar solo el nombre comercial del producto |
| 3 | Categorías inventadas del prototipo (síntesis/natural/biológico/suplemento/homeopático) no son los 6 trámites reales (`medicamentos, cosmeticos, higienicos, plaguicidas, excepcion, publicidad`) | Productos (badges), Solicitar Registro | No — corrección directa | Lo remapeo yo al conectar el módulo, sin esperar decisión |
| 4 | Los documentos no se agrupan en las 4 fases del prototipo — el checklist real solo trae `faddiStep` (número de paso interno de FADDI, ej. 15/16), no el modelo de 4 fases visual | Productos (documentos agrupados por fase dentro de cada producto expandido) | Sí | Definir manualmente a qué fase visual corresponde cada `faddiStep`, por trámite (mapeo de negocio, yo lo implemento) vs. aplanar a una lista sin agrupar |
| 5 | Sin historial de actividad por expediente — solo existen `createdAt`/`updatedAt` en el caso | Productos ("Actividad reciente") | Sí | Construir subcolección `cases/{id}/activity` con un evento por cambio de estado/subida de documento (trabajo mediano) vs. aproximar solo con fechas existentes, sin narrativa |
| 6 | Módulo Mensajes sin backend — ya identificado antes como funcionalidad real a construir, no stub visual | Módulo Mensajes completo | Ya decidido que se construye — falta priorizar en el orden de trabajo | Nueva colección Firestore + rutas API + conexión al frontend (trabajo grande) |
| 7 | Wizard de "Solicitar Registro" en `client-dashboard.html` es la maqueta de 4 pasos del prototipo original — nunca llama a `createCase()`. La lógica real de 5 pasos vive en `portal/nuevo.html`/`wizard.js`, ahora fuera del flujo activo | Módulo Solicitar Registro | No — trabajo de desarrollo puro | Portar la lógica real de `wizard.js` al módulo inline, conservando el diseño visual del prototipo |

**Orden de trabajo propuesto (salvo que el PM priorice distinto):** Documentos → Productos → Resumen → Solicitar → Mensajes (al final, por ser lo más grande).

---

## Key File Locations

| Archivo | Path | Notas |
|---|---|---|
| FADDI credentials | `References/FADDI CREDENTIALS.txt` | Credenciales reales — no exponer en logs ni commits |
| Firebase config | `farmazed-web/portal/js/config.js` | Llenar en Paso 1 |
| Deploy guide | `DEPLOY.md` | Comandos GCP completos |
| FADDI platform map | `FADDI_platform_knowledge.md` | Referencia campo por campo |
| Checklist logic | `tracker/data/faddi_checklists.js` | 6 módulos dinámicos |
| MCP tools | `tracker/routes/mcp.js` | 7 herramientas Cowork |
| Pricing route | `tracker/routes/pricing.js` | GET + PATCH admin, GET portal |
| Pricing seed | `tracker/seed_pricing.js` | Ejecutar UNA VEZ post-deploy (Paso 4.5) |
| Admin pricing UI | `farmazed-web/admin/precios.html` | Panel de gestión de precios |

---

## Respuestas PM a Gaps del Developer — 2026-08-26

Respuestas de Ricardo / decisiones de producto para los 7 gaps identificados por el developer.

---

### Gap 1 — Fecha de vencimiento/renovación

**Decisión:** Farmazed no tiene conexión virtual con FADDI ni con MINSA/DNFD. El seguimiento de fechas de vencimiento es gestión interna de Farmazed, no se obtiene automáticamente de ninguna API.

**Implementación:**
- Agregar campo `vencimiento` (tipo Timestamp, nullable) al documento de caso en Firestore.
- Solo los usuarios admin de Farmazed pueden escribir este campo (regla en `tracker/routes/cases.js`).
- El equipo de Farmazed lo llena manualmente al recibir notificación de aprobación de FADDI.
- En el dashboard del cliente, mostrar la fecha si existe; si es null → mostrar "Pendiente de aprobación".
- La sección "Próximos a vencer" del admin filtra por `vencimiento <= hoy + 90 días`.

---

### Gap 2 — Códigos de expediente propietarios

**Decisión:** Implementar códigos propietarios Farmazed. El código debe revelar en sí mismo el tipo de trámite y la categoría, para facilitar segregación en la UI de admin y auditoría.

**Esquema:**

```
FZ-{TIPO}-{SUBTIPO}-{AÑO}-{SECUENCIA}
```

| Componente | Descripción | Ejemplos |
|---|---|---|
| `FZ` | Prefijo Farmazed — siempre fijo | FZ |
| `TIPO` | Tipo de trámite (3–4 chars) | MED, COS, HIG, PLAG, EXC, PUB |
| `SUBTIPO` | Solo para Medicamentos: tipo de registro | REG, ABR, REC, WLA |
| `AÑO` | Año de creación del caso | 2026, 2027… |
| `SECUENCIA` | Consecutivo global, 4 dígitos con cero inicial | 0001, 0002… |

**Ejemplos:**

| Trámite | Código ejemplo |
|---|---|
| Medicamentos Regular | `FZ-MED-REG-2026-0001` |
| Medicamentos Abreviado | `FZ-MED-ABR-2026-0002` |
| Medicamentos Reconocimiento Mutuo | `FZ-MED-REC-2026-0003` |
| Medicamentos WLA | `FZ-MED-WLA-2026-0004` |
| Cosméticos | `FZ-COS-2026-0005` |
| Higiénicos | `FZ-HIG-2026-0006` |
| Plaguicidas | `FZ-PLAG-2026-0007` |
| Excepción de Registro | `FZ-EXC-2026-0008` |
| Publicidad | `FZ-PUB-2026-0009` |

**Implementación técnica:**
- Mantener un contador global en Firestore: documento `meta/counters` → campo `caseSequence` (integer).
- En `tracker/routes/cases.js`, al crear un caso (`POST /api/cases`), usar una **transacción Firestore** para:
  1. Leer y incrementar `caseSequence` atómicamente.
  2. Generar el código: `FZ-${tipo}${subtipo ? '-'+subtipo : ''}-${year}-${String(seq).padStart(4,'0')}`.
  3. Guardar el campo `caseCode` en el nuevo documento de caso.
- `caseCode` es **inmutable** una vez asignado.
- El `id` de Firestore (UUID) sigue siendo la clave primaria interna. `caseCode` es el identificador legible para humanos y admins.

---

### Gap 3 — Categorías del prototipo vs. trámites reales

**Decisión:** Corrección directa del developer. Confirmado, sin más input necesario del PM.

---

### Gap 4 — Agrupación de documentos por fases

**Decisión:** No usar las 4 fases visuales del prototipo. Usar dos niveles:

1. **Documentos de inicio** — todos los requeridos para presentar el expediente (obligatorios + condicionales que apliquen). El usuario los carga antes del primer submit.
2. **Documentos adicionales** — si FADDI o el proceso requiere más documentos durante la revisión, el admin de Farmazed abre una nueva ronda de carga.

Ver diseño completo en la sección "Flujo documental" más abajo.

---

### Gap 5 — Historial de actividad por expediente

**Decisión:** Posponer. No construir la subcolección `activity` en esta fase. Aproximar con `createdAt`/`updatedAt` del caso y fechas de subida de documentos. Retomar cuando el flujo principal esté completo.

---

### Gap 6 — Mensajes: backend pendiente

**Decisión:** Último en el orden de trabajo, como ya acordado: Documentos → Productos → Resumen → Solicitar → **Mensajes**.

---

### Gap 7 — Wizard de Solicitar Registro: portar wizard.js a inline

**Decisión:** Luz verde. Portar la lógica real de 5 pasos de `portal/js/wizard.js` al módulo inline de `client-dashboard.html`. Conservar el diseño visual del prototipo; reemplazar solo la lógica funcional.

`portal/nuevo.html` y `portal/js/wizard.js` quedan como referencia hasta que el módulo inline esté funcionando y probado — luego se pueden marcar deprecated.

---

### Flujo documental — Diseño definitivo

**Principio:** Agrupar todos los documentos necesarios para iniciar el trámite. Si el proceso requiere documentos adicionales en etapas posteriores, habilitar carga progresiva con submit por ronda.

**Ronda 1 — Apertura del expediente (Submit inicial):**
- Mostrar todos los documentos obligatorios del checklist según `faddi_checklists.js`.
- Mostrar documentos condicionales con indicador claro de cuándo aplican.
- El usuario carga los que aplican y hace submit.
- Validar que todos los obligatorios estén cargados antes de permitir el submit.
- Estado del caso pasa a `submitted`.

**Rondas adicionales — Documentos requeridos durante el proceso:**
- El admin de Farmazed puede abrir una nueva ronda desde el panel de admin con la lista de documentos adicionales.
- El cliente recibe notificación y puede cargar y hacer submit parcial.
- Estado del caso: `pending_additional_docs` (ronda abierta) → `in_review` (al cerrarla).

**Modelo de datos sugerido:**

```
cases/{caseId}
  ├── status: submitted | in_review | pending_additional_docs | approved | rejected
  ├── caseCode: "FZ-MED-REG-2026-0001"
  ├── vencimiento: Timestamp | null
  ├── documents/{docId}
  │     ├── docKey: string (ej. "15.1")
  │     ├── label: string
  │     ├── required: boolean
  │     ├── uploadedAt: Timestamp
  │     ├── fileUrl: string
  │     └── round: number (1 = apertura, 2+ = rondas adicionales)
  └── rounds/{roundId}
        ├── roundNumber: number
        ├── requestedAt: Timestamp
        ├── requestedBy: adminUid
        ├── closedAt: Timestamp | null
        └── requestedDocs: [{ docKey, label }]
```

---

### Tiempos estimados de proceso (referencia interna Farmazed)

No hay tiempos oficiales documentados por FADDI (solo la ventana de 48h para subir firma). Los estimados en `process_map.md` → Sección 10 son de mercado:

| Trámite | Tiempo estimado |
|---|---|
| Medicamentos Regular | 6–12 meses |
| Medicamentos Abreviado | 3–6 meses |
| Cosméticos | 3–6 meses |
| Higiénicos | 3–6 meses |
| Plaguicidas | 6–12 meses |
| Excepción de Registro | 2–4 semanas |
| Publicidad | 2–4 semanas |

Estos son estimados orientativos para el cliente — no son SLAs garantizados.

---

*Respuestas PM — 2026-08-26. Implementar según prioridades ya establecidas.*

---

## Observación developer — Sesión 2026-08-26 (bloqueante antes de implementar Gap 4)

Revisé las respuestas del PM a los 7 gaps. Todas claras y accionables excepto una inconsistencia técnica real en el Gap 4 que necesito resolver antes de tocar código — no es cosmética, afecta el modelo de datos.

**El problema:** El diseño "Flujo documental — Diseño definitivo" (respuesta al Gap 4, arriba) propone `status: submitted | in_review | pending_additional_docs | approved | rejected`. Pero el enum real ya implementado en `tracker/routes/cases.js` tiene 10 valores: `draft, submitted, in_review, faddi_ready, faddi_submitted, approved, observed, denied, pending_docs, deleted`. Sobre ese enum completo ya habíamos acordado antes en esta sesión una tabla status→fase (draft→Diagnóstico; submitted/in_review→Revisión [pending_docs=variante bloqueada]; faddi_ready→Elaboración; faddi_submitted/approved/observed→Obtención [observed=variante bloqueada, approved=hecho]; denied=badge propio fuera del flujo; deleted=excluido) que ya está aprobada y en uso para el pipeline visual de 4 fases.

El nuevo `pending_additional_docs` del diseño de rondas no existe en el enum actual, y no queda claro si `rejected` reemplaza a `denied`/`observed` o es un estado adicional distinto. Tampoco está claro si el modelo de `rounds/{roundId}` + `documents/{docId}.round` reemplaza el modelo actual de documentos (que no tiene noción de rondas) o convive con él.

**Pregunta para el PM:** ¿`pending_additional_docs` se agrega como un valor nuevo al enum de 10 que ya existe (conservando `draft/faddi_ready/faddi_submitted/observed/denied/pending_docs` tal cual, sin tocar la tabla status→fase ya aprobada), o el PM quiere reemplazar el enum completo por el modelo simplificado de 5 estados del diseño de rondas?

**Estado:** No se tocó código. Esperando aclaración antes de implementar Gap 4 (agrupación/rondas de documentos). Los demás gaps (1, 2, 3, 5, 6, 7) no dependen de esta respuesta y se pueden trabajar en paralelo según el orden ya acordado (Documentos → Productos → Resumen → Solicitar → Mensajes).

---

## Respuesta PM al bloqueante Gap 4 — 2026-08-26

Revisé directamente `tracker/routes/cases.js` y `tracker/routes/documents.js`. El código es claro. Corrijo el error de diseño de mi respuesta anterior:

**Respuesta directa:** Ninguna de las dos opciones. El diseño de 5 estados que propuse era incorrecto y redundante con lo que ya existe. **El enum de 10 estados se mantiene exactamente como está, sin agregar nada.**

---

### Reconciliación: mi diseño vs. el código real

**Error #1 — `pending_additional_docs` ya existe como `pending_docs`:**
El estado que propuse como `pending_additional_docs` es exactamente `pending_docs`, que ya está implementado y ya se setea automáticamente en `documents.js` línea 149 (`POST /documents/request`). No agregar nada. Usar `pending_docs`.

**Error #2 — `rejected` a nivel de caso era nomenclatura equivocada:**
- A nivel de caso: el término correcto es `denied` (ya en el enum) → caso denegado permanentemente por FADDI/MINSA.
- A nivel de documento individual: `status: 'rejected'` ya existe en `documents.js` → admin rechaza un archivo específico subido por el cliente.
- Son cosas distintas. Mi modelo de 5 estados los confundió.

**Error #3 — `rounds/{roundId}` no es necesario ahora:**
El mecanismo ya existe completo en el código actual. El "flujo de rondas" que describí ya funciona así:

```
Admin: POST /cases/:id/documents/request  →  doc.status = 'requested'  +  case.status = 'pending_docs'
Cliente: ve los docs 'requested' y los sube (POST /documents)           →  doc.status = 'uploaded'
Admin: revisa y actualiza  (PATCH /documents/:docId)                    →  doc.status = 'approved' | 'rejected'
Admin: cuando todo está OK, PATCH case status → 'in_review' (o next)
→ ciclo puede repetirse cuantas veces sea necesario
```

No se necesita una subcolección `rounds`. La trazabilidad se da por los campos `reviewedBy`/`reviewedAt`/`uploadedAt` ya presentes en cada documento.

---

### Instrucción definitiva para Gap 4

1. **Enum de estados: no tocar.** Los 10 valores existentes + la tabla status→fase visual ya aprobada se mantienen intactos.

2. **`pending_docs`** es el estado que indica "el admin solicitó documentos adicionales — cliente bloqueado hasta que los suba". Ya funciona. Solo asegurarse de que el dashboard cliente lo muestre con un aviso visible (banner o badge de alerta) listando exactamente qué documentos tienen `status: 'requested'`.

3. **Vista de documentos en el dashboard cliente (Ronda 1 + rondas adicionales):**
   - Mostrar el checklist completo del trámite (de `GET /cases/:id/checklist`).
   - Cada ítem del checklist muestra: obligatorio/condicional + si ya fue subido (`uploaded: true/false`).
   - Si un documento tiene `status: 'requested'` en la subcolección → mostrar badge de alerta "Requerido por Farmazed".
   - El botón de submit inicial solo se habilita cuando todos los obligatorios tienen `uploaded: true`.

4. **Vista admin:** El admin puede llamar `POST /documents/request` con cualquier `faddiDocId` para solicitar documentos adicionales en cualquier momento del proceso. No se necesita un panel especial — es una acción inline desde la vista del caso.

5. **`rounds/{roundId}` y el campo `round` en documentos:** Posponer. Implementar junto con el historial de actividad (Gap 5) en una fase futura, cuando el flujo principal esté completo y probado.

---

*Respuesta PM — 2026-08-26. El bloqueante está resuelto. Proceder con Gap 4 sin cambiar el enum ni agregar subcollecciones.*

---

## Auditoría de Datos Regulatorios — Sesión 2026-08-26

> PM comparó `tracker/data/faddi_checklists.js` contra tres fuentes primarias de GDrive:
> - **"Cuadro presentacion registro sanitario MINSA CORREGIDO.xlsx"** — matriz maestra de 35 requisitos × 9 subtipos de medicamentos
> - **"Matriz Suplementos"** — requisitos específicos Suplementos Vitamínicos/Dietéticos/Alimenticios
> - **"Matriz Productos Naturales"** — requisitos RTCA 11.03.64:19 (Resolución N.° 56 de 2024)
> - **"Tasas por Servicios DECRETO 27 DE 2024.docx"** — tasas oficiales DNFD vigentes
> - **"PAISES ALTO ESTANDAR Decreto 29 de 2023.docx"** — países habilitados para Abreviado/Reconocimiento Mutuo
>
> **Resultado: `faddi_checklists.js` tiene 8 bugs/gaps respecto a los datos regulatorios reales.** Detalles abajo. Archivo marcado como ⚠️ hasta que se corrija.

---

### Bug 1 — `recibo_iea` incorrectamente requerido para Suplementos y Productos Naturales

**Fuente:** Matriz maestra, Fila 2 (IEA — Control Previo); Matriz Suplementos (requisito 1: "No aplica IEA").

**Problema actual en `faddi_checklists.js`:** `recibo_iea` está en `MED_BASE_DOCS` (se aplica a TODOS los subtipos sin excepción).

**Realidad regulatoria:** El IEA (Instituto Especializado de Análisis, Universidad de Panamá) solo aplica a: Síntesis Química, Biológico/Biotecnológico, Homeopático, Medio de Contraste, Gas Medicinal. **No aplica a:** Suplementos, Productos Naturales, Huérfano, Radiofármaco.

**Fix requerido:** Mover `recibo_iea` de `MED_BASE_DOCS` a `MED_EXTRA_BY_TYPE` para los subtipos que sí lo requieren, o — más limpio — crear listas negativas por subtipo que lo excluyan. El patrón de exclusión es preferible porque la base actual asume "todos lo requieren".

---

### Bug 2 — `cert_analisis` incorrectamente requerido para todos los medicamentos

**Fuente:** Matriz maestra, Fila 14 (Certificado de análisis del fabricante).

**Problema actual:** `cert_analisis` está en `MED_BASE_DOCS`.

**Realidad regulatoria:**
- Requerido para: Biológico, Huérfano, Radiofármaco, Homeopático, Medio de Contraste, Gas Medicinal, Productos Naturales.
- Para Síntesis Química: **solo en trámite Abreviado** (no en Regular ni Reconocimiento Mutuo).
- **No requerido para Suplementos.**

**Fix requerido:** Sacar `cert_analisis` de `MED_BASE_DOCS`. Agregarlo a `MED_EXTRA_BY_TYPE` para los subtipos que sí lo requieren. Para Síntesis Química Abreviado, está correctamente manejado en `MED_ABREVIADO_EXTRA` — pero se debe asegurar que NO esté en la base general.

---

### Bug 3 — `muestra` incorrectamente requerido para Suplementos y Huérfanos

**Fuente:** Matriz maestra, Fila 21 (Muestra del producto terminado); Matriz Suplementos (no lista muestra física entre sus 14 requisitos).

**Problema actual:** `muestra` está en `MED_BASE_DOCS`.

**Realidad regulatoria:**
- Requerido para: Síntesis Química, Biológico, Homeopático, Medio de Contraste, Gas Medicinal, Productos Naturales. Para Radiofármaco: condicional (A en la matriz).
- **No requerido para: Suplementos, Huérfanos.**

**Fix requerido:** Mover `muestra` fuera de `MED_BASE_DOCS` y tratarlo por subtipo.

---

### Bug 4 — `disposicion` marcado como opcional, debe ser OBLIGATORIO

**Fuente:** Matriz maestra, Fila 33 (Disposición/Destrucción de muestras); Decreto 249/2008.

**Problema actual en `faddi_checklists.js`:**
```javascript
{ id: 'disposicion', faddiCode: '15.22', label: 'Disposición/Destrucción de muestras', required: false, condition: '...' }
```

**Realidad regulatoria:** La disposición/destrucción de muestras aparece como **X (obligatorio)** para los 9 subtipos en la matriz maestra. No es condicional.

**Fix requerido:**
```javascript
{ id: 'disposicion', faddiCode: '15.22', label: 'Disposición/Destrucción de muestras', required: true }
```

---

### Bug 5 — `monografia` marcado como opcional, debe ser OBLIGATORIO

**Fuente:** Matriz maestra, Fila 18 (Monografía del producto); Matriz Suplementos (requisito 7, Resolución 550/2019, Art. 4, numeral 7).

**Problema actual en `faddi_checklists.js`:**
```javascript
{ id: 'monografia', faddiCode: '15.18', label: 'Monografía del producto', required: false, condition: 'Cuando aplica según tipo de medicamento' }
```

**Realidad regulatoria:** La monografía aparece como **X (obligatorio)** para los 9 subtipos de medicamentos en la matriz maestra, incluyendo Suplementos (confirmado por Resolución 550/2019, Art. 4, numeral 7) y Productos Naturales.

**Fix requerido:**
```javascript
{ id: 'monografia', faddiCode: '15.18', label: 'Monografía del producto', required: true }
```

---

### Bug 6 — `metodo_analisis` incorrectamente requerido para varios subtipos

**Fuente:** Matriz maestra, Fila 15 (Método de análisis fisicoquímico y microbiológico).

**Problema actual:** `metodo_analisis` está en `MED_BASE_DOCS`.

**Realidad regulatoria:**
- Requerido para: Síntesis Química, Biológico, Huérfano, Gas Medicinal, Productos Naturales.
- **No requerido para: Suplementos, Radiofármaco, Homeopático, Medio de Contraste.**

**Fix requerido:** Mover `metodo_analisis` fuera de `MED_BASE_DOCS` y tratarlo por subtipo.

---

### Bug 7 — Documento `etiquetas` completamente ausente del checklist

**Fuente:** Matriz maestra, Fila 16 (Etiquetas del envase primario y secundario).

**Problema:** Este documento no existe en `faddi_checklists.js`. La matriz maestra indica que es obligatorio (X) para **los 9 subtipos de medicamentos.**

**Fix requerido:** Agregar a `MED_BASE_DOCS`:
```javascript
{
  id: 'etiquetas',
  faddiCode: '15.16',
  faddiDocName: 'Etiquetas del envase primario y secundario',
  faddiStep: 15,
  label: 'Etiquetas del envase primario y secundario',
  required: true,
}
```

> **Nota al developer:** Verificar el `faddiCode` exacto ('15.16') en la plataforma FADDI — la numeración de la matriz puede diferir de la asignada en FADDI. Si el código difiere, corregir.

---

### Bug 8 — Documento `contrato_fabricacion` completamente ausente del checklist

**Fuente:** Matriz maestra, Fila 11 (Contrato de fabricación — cuando aplica tercero).

**Problema:** Este documento no existe en `faddi_checklists.js`.

**Realidad regulatoria:** Aplicable cuando el fabricante es un tercero (maquilador). Aplica para: Síntesis Química, Biológico, Huérfano, Radiofármaco, Homeopático, Medio de Contraste, Gas Medicinal, Suplementos. (Condicionado a si hay tercerización de fabricación.)

**Fix requerido:** Agregar como documento condicional:
```javascript
{
  id: 'contrato_fabricacion',
  faddiCode: '15.11',
  faddiDocName: 'Contrato de fabricación (tercero)',
  faddiStep: 15,
  label: 'Contrato de fabricación (cuando aplica tercero)',
  required: false,
  condition: 'Cuando el producto es fabricado por un tercero (maquilador)',
}
```

> **Nota al developer:** Confirmar `faddiCode` en FADDI. Este documento solo aplica a los subtipos listados — Productos Naturales no lo lista en su matriz específica.

---

### Error descriptivo — `tasa_servicio` tiene el monto incorrecto en el label

**Fuente:** Decreto 27/2024 (D.E. N.° 27 de 10 de mayo de 2024).

**Problema actual en `faddi_checklists.js`:**
```javascript
{ id: 'tasa_servicio', ..., label: 'Recibo de pago de tasa de $200 (MEF)' }
```

**Realidad:** B/. 200 es la tasa de **modificaciones**, NO del registro inicial. Las tasas reales por tipo según Decreto 27/2024:

| Tipo de Registro | Tasa DNFD |
|---|---|
| Síntesis Química (nuevo o renovación) | B/. 500 |
| Biológico/Biotecnológico/Biosimilar (nuevo o renovación) | B/. 750 |
| Abreviado (nuevo o renovación) | B/. 750 |
| Reconocimiento Mutuo (nuevo o renovación) | B/. 500 |
| Medicamento Huérfano (Certificado de Inscripción) | B/. 50 |
| Cosméticos hasta 10 variedades (nuevo o renovación) | B/. 500 |
| Cosméticos por cada 10 variedades adicionales | B/. 200 |
| Higiénicos/similares (nuevo o renovación) | B/. 500 |
| Plaguicidas y otros productos (nuevo o renovación) | B/. 500 |
| Excepción para adquisición pública/privada | B/. 500 |
| Excepción para adquisición pública por compra directa del Estado | Sin costo |
| Excepción para pacientes | Sin costo |
| Publicidad/propaganda (con prescripción médica) | B/. 50 |
| Modificaciones (mayoría de tipos) | B/. 200 |

**Fix requerido:** El label de `tasa_servicio` en `MED_BASE_DOCS` no debe especificar un monto fijo porque varía por subtipo. Cambiar a:
```javascript
label: 'Recibo de pago de tasa DNFD (según Decreto 27/2024)'
```
El monto correcto se muestra al cliente desde el módulo de pricing, no desde el checklist.

---

### Gap estructural — `MED_EXTRA_BY_TYPE` incompleto: faltan 6 subtipos

**Problema:** `MED_EXTRA_BY_TYPE` en `faddi_checklists.js` solo tiene entradas para: `Biotecnológicos`, `Biológicos`, `Huérfanos`, `Vacunas`. Los siguientes 6 subtipos **no tienen documentos adicionales definidos** y caen solo en `MED_BASE_DOCS` — lo cual, combinado con los bugs 1–6 arriba, resulta en checklists incorrectos para todos ellos:

| Subtipo faltante | Documentos únicos confirmados por matrices |
|---|---|
| Radiofármaco | Sin `recibo_iea`, sin `metodo_analisis`; `muestra` condicional; `cert_analisis` sí requerido |
| Homeopático | `recibo_iea` sí requerido; sin `metodo_analisis` |
| Medio de Contraste | `recibo_iea` sí requerido; sin `metodo_analisis`; `muestra` requerida |
| Gas Medicinal | `recibo_iea` sí requerido; `metodo_analisis` sí requerido; `cert_analisis` sí requerido |
| Suplementos | Sin `recibo_iea`, sin `cert_analisis`, sin `muestra`, sin `metodo_analisis`; `monografia` sí requerida; `estabilidad` condicional (solo si vida útil > 24 meses) |
| Productos Naturales | Sin `recibo_iea`; `cert_analisis` sí requerido; `metodo_analisis` sí requerido; `muestra` sí requerida; `estabilidad` condicional (≤24 meses: informe análisis + DJ; >24 meses: estudio completo) |

**Fix requerido:** El developer debe definir entradas en `MED_EXTRA_BY_TYPE` para estos 6 subtipos — o rediseñar el motor de checklists para soportar exclusiones por subtipo además de adiciones. La arquitectura actual (base + adiciones) es insuficiente cuando múltiples documentos de la base no aplican a ciertos subtipos.

**Recomendación de arquitectura:** Cambiar de modelo "base + extras" a modelo "por subtipo con herencia":
1. Definir un `MED_BASE_SHARED` con los documentos que aplican a TODOS (ej. poder, CLV, BPM, fórmula, tasa, prospecto, monografía, disposición, etiquetas).
2. Para cada subtipo, definir su lista completa de documentos (heredando de `MED_BASE_SHARED` + agregando los propios).
3. Esto evita la lógica de exclusión que se vuelve frágil con 9 subtipos y 35+ documentos.

---

### Información regulatoria — Decreto 29/2023 (países habilitados para Abreviado)

**Fuente:** "PAISES ALTO ESTANDAR Decreto 29 de 2023.docx"

El cliente que selecciona `tipoRegistro = 'Abreviado'` o `'Reconocimiento Mutuo'` debe poder verificar si el país de origen del producto califica. Esta información NO está expuesta en el portal actualmente.

**Tres categorías de países habilitados:**

**1. Miembros PIC/S (Síntesis Química, Biológicos, y demás):**
Alemania, Argentina, Australia, Austria, Bélgica, Canadá, Chipre, Corea del Sur, Croacia, Dinamarca, Eslovaquia, Eslovenia, España, Estados Unidos, Estonia, Finlandia, Francia, Grecia, Hungría, Indonesia, Irán, Irlanda, Islandia, Israel, Italia, Japón, Letonia, Liechtenstein, Lituania, Malasia, Malta, México, Noruega, Nueva Zelanda, Países Bajos, Polonia, Portugal, Reino Unido, República Checa, Rumania, Singapur, Sudáfrica, Suecia, Suiza, Tailandia, Turquía, Ucrania.

**2. OMS Precalificados — Solo Vacunas:**
China, Egipto, India, Indonesia, Serbia, Sudáfrica, Tailandia, Vietnam.

**3. OPS Reconocidos — Solo Síntesis Química (ARR Regional):**
Argentina (ANMAT), Brasil (ANVISA), Chile (ISP), Colombia (INVIMA), Cuba (CECMED), México (COFEPRIS).

**Acción sugerida para el developer:** En el wizard, cuando el usuario seleccione `tipoRegistro = 'Abreviado'`, mostrar un panel informativo con las tres listas. Esto ayuda al cliente a verificar si su producto califica antes de completar el formulario. No es un bloqueante funcional — es UX informativa.

---

### Verificación pendiente — Datos de precios en Firestore

La arquitectura de `pricing.js` es correcta (Firestore, modelo por componentes). Los montos de `tasa_dnfd_tramite` en la colección Firestore deben ser verificados contra Decreto 27/2024 (tabla de tasas arriba). No es posible confirmar los valores reales de Firestore desde esta sesión — el developer debe hacer:

```bash
# En Cloud Shell o local con credenciales:
firebase firestore:get pricing
# Verificar que tasa_dnfd_tramite coincide con Decreto 27/2024 para cada categoría
```

---

*Auditoría PM — 2026-08-26. Fuentes: matrices GDrive + decretos oficiales. `faddi_checklists.js` marcado como ⚠️ — no desplegar a producción hasta corregir los 8 bugs listados.*

---

## Revisión del trabajo del developer — Sesión 2026-08-26

> PM revisó el estado actual de tres archivos clave tras la auditoría regulatoria del día.
> Resultado: dos archivos ✅ implementados correctamente; un archivo con 6 gaps pendientes.

---

### `tracker/data/faddi_checklists.js` — ✅ Rediseño arquitectónico completo

El developer implementó el rediseño recomendado correctamente:

- **`MED_BASE_SHARED`** contiene los documentos universales (poder, CLV, BPM, fórmula, especificaciones, clave_lote, estabilidad, proceso_fab, controles, tasa_servicio, prospecto, monografia `required:true`, disposicion `required:true`, almacenamiento, otros_docs, patrones, recibo_cnf, etiquetas).
- **`MED_VARIABLE_BY_SUBTYPE`** define los documentos específicos por subtipo, cubriendo los 9 subtipos. Los 6 subtipos que antes faltaban (Radiofármaco, Homeopático, Medio de Contraste, Gas Medicinal, Suplementos, Productos Naturales) ahora están definidos correctamente.
- Constantes named (`DOC_RECIBO_IEA`, `DOC_CERT_ANALISIS`, `DOC_MUESTRA`, etc.) usadas como bloques reutilizables — arquitectura limpia.
- `DOC_ESTABILIDAD_SUPLEMENTOS` y `DOC_ESTABILIDAD_NATURALES` definidos con condiciones correctas.
- Lógica de `getChecklist()` actualizada: aplica sustitución de `estabilidad` por subtipo, agrega `cert_analisis` para Síntesis Química solo en Abreviado.
- Bugs 1–8 de la auditoría anterior: **todos corregidos.**

**2 ítems pendientes de verificación en plataforma FADDI** (developer debe confirmar antes de producción):

| Documento | `faddiCode` asignado | Posible colisión | Acción |
|---|---|---|---|
| `etiquetas` | `'PENDIENTE_VERIFICAR'` (era '15.16') | '15.16' puede estar asignado a `patrones` | Verificar en FADDI la pantalla 15, ítem 16 |
| `contrato_fabricacion` | `'PENDIENTE_VERIFICAR'` (era '15.11') | '15.11' puede estar asignado a `monografia` | Verificar en FADDI la pantalla 15, ítem 11 |

Una vez confirmados los códigos reales, reemplazar `'PENDIENTE_VERIFICAR'` con el valor correcto. No desplegar a producción con `faddiCode: 'PENDIENTE_VERIFICAR'`.

---

### `tracker/routes/cases.js` — ✅ Gap 1 y Gap 2 implementados correctamente

**Gap 2 — caseCode:**

```javascript
const TIPO_ABBR = { medicamentos: 'MED', cosmeticos: 'COS', higienicos: 'HIG',
                    plaguicidas: 'PLAG', excepcion: 'EXC', publicidad: 'PUB' };
const SUBTIPO_ABBR = { 'Regular': 'REG', 'Abreviado': 'ABR',
                       'Reconocimiento Mutuo': 'REC', 'Reconocimiento WLA': 'WLA' };
```

- Transacción Firestore atómica (`meta/counters.caseSequence`) — correcto, evita colisiones en concurrencia.
- Formato `FZ-MED-ABR-2026-0001` — coincide con el esquema aprobado.
- Subtipo solo se agrega para `medicamentos` — correcto.
- `seqStr` con `padStart(4, '0')` — correcto.

**Gap 1 — vencimiento:**

- Campo `null` en `caseData` al crear — correcto.
- `ADMIN_FIELDS` incluye `vencimiento` — solo admins pueden setear la fecha.
- Conversión ISO→Timestamp con `admin.firestore.Timestamp.fromDate(new Date(update.vencimiento))` — correcto.
- `null` se guarda directamente (no se convierte) — correcto.

---

### `farmazed-web/client-dashboard.html` — ⚠️ 6 gaps pendientes

El developer conectó el script de datos reales (`import api` + `requireLogin`), obtiene `activeCases` y los `docLists` del API. Sin embargo, la mayoría de las secciones del dashboard siguen usando datos de `window.DATA` que **nunca se populan desde el API**. Detalles:

---

#### Dashboard Gap A — `DATA.productos` nunca se popula desde el API

**Problema:** La pestaña "Productos" siempre muestra el estado vacío. El código obtiene `activeCases` pero nunca los asigna a `DATA.productos`.

**Fix requerido:** Después de obtener `activeCases`, mapear cada caso al formato que `renderProductos()` espera:

```javascript
window.DATA.productos = activeCases.map(c => ({
  id: c.id,
  nombre: c.productName || c.nombre || 'Sin nombre',
  tipo: c.tramiteType,
  estado: c.status,
  caseCode: c.caseCode || '—',
  updatedAt: c.updatedAt,
}));
```

Verificar qué campos devuelve `api.listCases()` y ajustar el mapeo a los nombres reales del response.

---

#### Dashboard Gap B — `DATA.metricas` nunca se computa desde datos reales

**Problema:** Los 4 contadores de métricas siempre muestran 0. `DATA.metricas` no se calcula desde `activeCases`.

**Fix requerido:** Derivar métricas desde `activeCases` tras obtenerlos:

```javascript
window.DATA.metricas = {
  activos:    activeCases.filter(c => !['approved','denied','deleted'].includes(c.status)).length,
  enRevision: activeCases.filter(c => ['submitted','in_review','faddi_ready','faddi_submitted'].includes(c.status)).length,
  aprobados:  activeCases.filter(c => c.status === 'approved').length,
  pendientes: activeCases.filter(c => c.status === 'pending_docs').length,
};
```

Ajustar las claves al formato que `renderMetricas()` espera.

---

#### Dashboard Gap C — `DATA.pendientes` nunca se popula

**Problema:** La sección "Pendientes" siempre está oculta. `DATA.pendientes` nunca se asigna.

**Contexto:** Un caso con `status === 'pending_docs'` tiene documentos individuales con `status === 'requested'`. El cliente debe ver exactamente qué documentos le están solicitando.

**Fix requerido:**

```javascript
// Para cada caso en pending_docs, obtener sus documentos con status 'requested'
const pendientesCases = activeCases.filter(c => c.status === 'pending_docs');
const pendientesLists = await Promise.all(
  pendientesCases.map(c => api.listDocuments(c.id).catch(() => ({ documents: [] })))
);

window.DATA.pendientes = pendientesCases.flatMap((c, i) => {
  const reqDocs = (pendientesLists[i].documents || []).filter(d => d.status === 'requested');
  return reqDocs.map(d => ({
    caseId: c.id,
    caseCode: c.caseCode || c.id,
    productName: c.productName || 'Sin nombre',
    docId: d.faddiDocId || d.id,
    docLabel: d.label || d.faddiDocName || d.id,
  }));
});
```

La UI debe mostrar un banner de alerta visible por cada documento pendiente, con botón para ir a subir el archivo.

---

#### Dashboard Gap D — `wizSubmit()` es falso (Gap 7 no implementado)

**Problema:** La función `wizSubmit()` muestra una pantalla de éxito sin llamar al API. No crea ningún caso en Firestore.

**Comportamiento actual:**
```javascript
function wizSubmit() {
  // muestra step 5 (pantalla de éxito)
  // sin llamar createCase() — FAKE
}
```

**Fix requerido:** `wizSubmit()` debe:
1. Recopilar todos los datos del wizard (tramiteType, tipoRegistro, tipoMedicamento, productName, etc.).
2. Llamar `await api.createCase({ tramiteType, tipoRegistro, tipoMedicamento, productName, ... })`.
3. Si OK: mostrar pantalla de éxito con el `caseCode` retornado por el API.
4. Si error: mostrar mensaje de error, no ocultar el wizard.
5. Después del éxito, refrescar `DATA.productos` y `DATA.metricas` para que el dashboard muestre el nuevo caso sin recargar la página.

---

#### Dashboard Gap E — `PAISES_ABREVIADO` usa lista antigua e incorrecta

**Problema:** El wizard tiene una lista `PAISES_ABREVIADO` hardcodeada que proviene del prototipo inicial (29 países, incompleta, sin la estructura de tres categorías).

**Fix requerido:** Reemplazar con la lista completa de Decreto 29/2023 (ya documentada en la sección "Información regulatoria — Decreto 29/2023" de este handover). Las tres categorías son:

1. **Miembros PIC/S** (Síntesis Química, Biológicos, y demás) — ~47 países.
2. **OMS Precalificados** (solo Vacunas) — China, Egipto, India, Indonesia, Serbia, Sudáfrica, Tailandia, Vietnam.
3. **OPS Reconocidos** (solo Síntesis Química — ARR Regional) — Argentina, Brasil, Chile, Colombia, Cuba, México.

En el wizard, cuando el usuario seleccione `tipoRegistro = 'Abreviado'` o `'Reconocimiento Mutuo'`, mostrar las tres listas separadas con sus encabezados. El usuario debe poder seleccionar el país de origen y la UI debe filtrar automáticamente qué categoría aplica según el subtipo de medicamento seleccionado.

---

#### Dashboard Gap F — `expandedHTML()` agrupa por `d.fase` (campo que no existe en datos reales)

**Problema:** La función que expande un caso para mostrar su lista de documentos agrupa los documentos por `d.fase` (un entero 1–4). Los documentos reales del API no tienen este campo.

**Comportamiento actual:**
```javascript
function expandedHTML(p) {
  const fases = [1, 2, 3, 4];
  fases.forEach(f => {
    const docs = p.docs.filter(d => d.fase === f);
    // ... renderiza grupo por fase
  });
}
```

**Realidad:** `api.listDocuments(caseId)` retorna documentos con campos como `id`, `faddiDocId`, `faddiDocName`, `status` (`uploaded`, `approved`, `rejected`, `requested`), `uploadedAt`, `reviewedAt`. No tienen campo `fase`.

**Fix requerido:** Eliminar el agrupamiento por `fase`. Mostrar los documentos como una lista plana ordenada por nombre, o agrupar por `status` (documentos aprobados / documentos pendientes / documentos rechazados / documentos solicitados). Ejemplo simplificado:

```javascript
function expandedHTML(caso, docs) {
  const grupos = {
    requested: docs.filter(d => d.status === 'requested'),
    rejected:  docs.filter(d => d.status === 'rejected'),
    uploaded:  docs.filter(d => d.status === 'uploaded'),
    approved:  docs.filter(d => d.status === 'approved'),
  };
  // renderizar cada grupo con su encabezado y badge de color
}
```

---

### Resumen para el developer

| Archivo | Estado | Acción |
|---|---|---|
| `tracker/data/faddi_checklists.js` | ✅ Correcto | Verificar 2 faddiCodes en plataforma FADDI antes de producción |
| `tracker/routes/cases.js` | ✅ Correcto | Ninguna — Gap 1 y Gap 2 implementados correctamente |
| `farmazed-web/client-dashboard.html` | ⚠️ 6 gaps | Implementar Dashboard Gaps A–F descritos arriba |

**Prioridad sugerida para dashboard:**
1. Gap D (wizSubmit real) — bloqueante funcional, sin esto el portal no sirve
2. Gap A + B + C (datos reales) — sin esto el dashboard siempre muestra ceros/vacío
3. Gap E (PAISES_ABREVIADO) — importante para Abreviado y Reconocimiento Mutuo
4. Gap F (expandedHTML) — corregir antes de mostrar documentos a clientes reales

*Revisión PM — 2026-08-26.*

---

## Revisión del trabajo del developer — Sesión 2026-08-26 (Parte 2: wizard.js)

### Estado general tras la revisión completa

| Archivo | Estado | Detalle |
|---|---|---|
| `tracker/data/faddi_checklists.js` | ✅ Sin regresiones | 8 bugs regulatorios corregidos. 2 faddiCodes siguen como PENDIENTE_VERIFICAR (esperado). |
| `tracker/routes/cases.js` | ✅ Sin regresiones | Gap 1 (vencimiento) y Gap 2 (caseCode) implementados correctamente. |
| `farmazed-web/client-dashboard.html` | ✅ Todos los gaps corregidos | Gaps A–F completamente resueltos por el developer. |
| `farmazed-web/portal/js/wizard.js` | ⚠️ Bug crítico nuevo | Gap D y Gap E correctamente implementados. **Pero se encontró un bug nuevo de naming que rompe el checklist para varios subtipos.** |

---

### Gaps confirmados como RESUELTOS (wizard.js + dashboard)

- **Gap D (wizSubmit real)** ✅ — `nextStep()` en step 1 llama `api.createCase(...)`, obtiene `state.caseId`, lo persiste en la URL (`?caseId=`). Step 5 llama `api.updateCase(state.caseId, { status: 'submitted' })`. Funciona.
- **Gap E (PAISES_ABREVIADO)** ✅ — `syncContactenos()` en wizard.js togglea `#abreviado-paises-panel` (Decreto 29/2023 completo en client-dashboard.html líneas 683–703). Funciona.
- **Gaps A–F (dashboard)** ✅ — Todos implementados con datos reales del API. `expandedHTML` agrupa por ESTADO_MAP (pendiente / en_revision / aprobado / rechazado). Correcto.

---

### Bug crítico — `TIPOS_MED` en wizard.js no coincide con las keys de `MED_VARIABLE_BY_SUBTYPE` en faddi_checklists.js

#### El problema

`wizard.js` (líneas ~38–43) define la lista de subtipos de medicamentos que el cliente puede seleccionar:

```javascript
const TIPOS_MED = [
  'Síntesis Química', 'Biotecnológicos', 'Homeopáticos', 'Huérfanos',
  'Radiofármacos', 'Biológicos', 'Suplemento Con Propiedad Terapéutica',
  'Producto Natural Medicinal', 'Producto Hemoderivado', 'Vacuna',
  'Alérgeno', 'Medio de Contraste', 'Cannabis',
];
```

`faddi_checklists.js` usa estas keys exactas en `MED_VARIABLE_BY_SUBTYPE`:

```javascript
// Keys reales en faddi_checklists.js:
'Síntesis Química' | 'Biotecnológicos' | 'Biológicos' | 'Huérfanos' |
'Vacuna' | 'Radiofármaco' | 'Homeopático' | 'Medio de Contraste' |
'Gas Medicinal' | 'Suplementos' | 'Productos Naturales'
```

`getChecklist()` hace `MED_VARIABLE_BY_SUBTYPE[tipo] || []`. Si el nombre no coincide exactamente, retorna `[]` en silencio — el caso se crea sin los documentos variables requeridos.

#### Tabla de discrepancias

| Valor en wizard.js TIPOS_MED | Key en faddi_checklists.js | Problema |
|---|---|---|
| `'Homeopáticos'` | `'Homeopático'` | Plural → lookup retorna `[]` — missing variable docs |
| `'Radiofármacos'` | `'Radiofármaco'` | Plural → lookup retorna `[]` — missing variable docs |
| `'Suplemento Con Propiedad Terapéutica'` | `'Suplementos'` | Nombre diferente → lookup retorna `[]` |
| `'Producto Natural Medicinal'` | `'Productos Naturales'` | Nombre diferente → lookup retorna `[]` |
| `'Producto Hemoderivado'` | (no existe en checklist) | No hay entry en MED_VARIABLE_BY_SUBTYPE |
| `'Alérgeno'` | (no existe en checklist) | No hay entry en MED_VARIABLE_BY_SUBTYPE |
| `'Cannabis'` | (no existe en checklist) | No hay entry en MED_VARIABLE_BY_SUBTYPE |
| (ausente de wizard) | `'Gas Medicinal'` | El cliente no puede seleccionar este subtipo |

**Total: 4 nombres rotos + 3 subtypes sin checklist + 1 subtipo faltante en el wizard.**

#### Impacto

Los valores de `tipoMedicamento` se persisten en Firestore al crear el caso. Si se crean casos con los nombres incorrectos ahora, el checklist del servidor siempre retornará sólo los documentos base (MED_BASE_SHARED) para esos subtipos — los documentos variables específicos nunca aparecerán. Esto es un bug silencioso: no hay error, sólo documentos faltantes en el checklist.

#### Fix requerido

**Opción A — cambiar wizard.js para usar los nombres canónicos de faddi_checklists.js (RECOMENDADA).**

Los casos aún no están en producción, así que no hay datos de Firestore con los nombres incorrectos que limpiar. Es más limpio corregir el wizard.

Reemplazar `TIPOS_MED` en `wizard.js` con:

```javascript
const TIPOS_MED = [
  'Síntesis Química',
  'Biológicos',
  'Biotecnológicos',
  'Homeopático',       // antes: 'Homeopáticos'
  'Huérfanos',
  'Radiofármaco',      // antes: 'Radiofármacos'
  'Vacuna',
  'Medio de Contraste',
  'Gas Medicinal',     // antes: ausente
  'Suplementos',       // antes: 'Suplemento Con Propiedad Terapéutica'
  'Productos Naturales', // antes: 'Producto Natural Medicinal'
];
```

Y eliminar `'Producto Hemoderivado'`, `'Alérgeno'`, `'Cannabis'` de la lista hasta que existan entradas en `faddi_checklists.js` para ellos (ver punto siguiente).

**Opción B — agregar los subtypes faltantes a faddi_checklists.js.** Sólo si Ricardo confirma que Producto Hemoderivado, Alérgeno y Cannabis son tramites que Farmazed efectivamente va a gestionar. Si es así, el developer debe investigar en la plataforma FADDI qué documentos requieren y agregar los entries correspondientes en `MED_VARIABLE_BY_SUBTYPE`.

#### Prioridad

**CRÍTICA — bloquea el checklist para la mitad de los subtipos de medicamentos.** Debe corregirse antes del primer deploy a producción.

---

### Resumen actualizado para el developer

| Archivo | Estado | Acción requerida |
|---|---|---|
| `tracker/data/faddi_checklists.js` | ✅ | Verificar 2 faddiCodes PENDIENTE_VERIFICAR en plataforma FADDI |
| `tracker/routes/cases.js` | ✅ | Ninguna |
| `farmazed-web/client-dashboard.html` | ✅ | Ninguna |
| `farmazed-web/portal/js/wizard.js` | ❌ Bug crítico | Corregir `TIPOS_MED` — usar nombres canónicos de faddi_checklists.js (Opción A arriba) |

**Próximo paso para el developer:** Corregir `TIPOS_MED` en `wizard.js`, commit, push.

*Revisión PM — 2026-08-26 (Parte 2).*

---

## Revisión del trabajo del developer — Sesión 2026-08-26 (Parte 3: mensajes + TIPOS_MED)

### Archivos revisados

`tracker/routes/messages.js`, `tracker/index.js`, `farmazed-web/portal/js/api.js`, `farmazed-web/portal/js/wizard.js`, `farmazed-web/client-dashboard.html`.

---

### TIPOS_MED — ✅ Correcto

`wizard.js` ahora tiene los 11 nombres exactos que usa `MED_VARIABLE_BY_SUBTYPE`:

```javascript
const TIPOS_MED = [
  'Síntesis Química', 'Biológicos', 'Biotecnológicos', 'Homeopático',
  'Huérfanos', 'Radiofármaco', 'Vacuna', 'Medio de Contraste',
  'Gas Medicinal', 'Suplementos', 'Productos Naturales',
];
```

El developer agregó un comentario en el código explicando por qué se quitaron `'Producto Hemoderivado'`, `'Alérgeno'` y `'Cannabis'` (no tienen entrada en `faddi_checklists.js` todavía). Bug crítico cerrado.

---

### Módulo Mensajes — ✅ Correcto

#### Backend (`tracker/routes/messages.js`)

- `mergeParams: true` — correcto, necesario para recibir `:caseId` del router padre.
- `getCaseOrFail()` — mismo helper de auth/ownership que `documents.js`. Cliente solo ve sus propios casos (403 si intenta acceder a un caso ajeno).
- `GET /`: ordena por `createdAt asc`, retorna DTO limpio (`id`, `senderRole`, `senderName`, `text`, `createdAt` ISO). `senderId` se guarda en Firestore pero no se expone al frontend — correcto por privacidad.
- `POST /`: valida texto vacío (400) y límite de 4000 caracteres. `senderRole` se deriva de `req.user.admin` — el cliente no puede autoproclamarse admin. Actualiza `updatedAt` del caso al enviar mensaje, igual que al subir un documento. Retorna ISO string del Timestamp.
- Montado correctamente en `index.js` línea 86: `app.use('/api/cases/:caseId/messages', messagesRouter)`.

#### Frontend (`api.js` + `client-dashboard.html`)

- `listMessages(caseId)` y `sendMessage(caseId, text)` agregados limpiamente al objeto `api`.
- `window.__fzApi = api` expuesto desde el module script para que el classic script pueda llamar al API real.
- `DATA.mensajes` se construye para todos los casos activos aunque no tengan mensajes todavía — el cliente puede escribir primero.
- `REMITENTE_MAP = { client: 'client', admin: 'fz' }` — mapea `senderRole` del API a las clases CSS correctas (`.fz-chat-msg.client` / `.fz-chat-msg.fz`). Bug del prototipo corregido.
- `sendMessage()` llama `window.__fzApi.sendMessage(h.caseId, txt)`, empuja la respuesta del API al array local (optimistic update correcto — usa `sent.senderRole` del servidor, no un valor inventado).
- Race condition de `activeThread` corregida: se inicializa en `null` al parse (DATA vacío), y se re-evalúa correctamente dentro de `renderAll()` una vez que los datos reales están disponibles.
- Enter sin Shift envía el mensaje. Textarea se deshabilita durante el envío. ✅

#### Bugs extra que corrigió el developer (confirmados en el código)

1. `remitente:'cliente'` (español) vs clases CSS en inglés — corregido con `REMITENTE_MAP`.
2. `activeThread` inicializado antes de tener datos — corregido con el patrón `renderAll()`.

---

### Estado final del proyecto (2026-08-26)

| Archivo | Estado | Pendiente |
|---|---|---|
| `tracker/data/faddi_checklists.js` | ✅ | Verificar 2 faddiCodes PENDIENTE_VERIFICAR en FADDI platform |
| `tracker/routes/cases.js` | ✅ | — |
| `tracker/routes/messages.js` | ✅ Nuevo | — |
| `tracker/index.js` | ✅ | — |
| `farmazed-web/client-dashboard.html` | ✅ | Prueba visual con cuenta real |
| `farmazed-web/portal/js/wizard.js` | ✅ | Decisión de Ricardo: ¿Farmazed gestiona Hemoderivado, Alérgeno, Cannabis? |
| `farmazed-web/portal/js/api.js` | ✅ | — |

**Próximo paso para el developer:** prueba visual end-to-end desde el navegador con cuenta real (cliente + admin). Nada más pendiente de código.

**Decisión pendiente de Ricardo (a discutir con Zelky):** ¿Farmazed gestiona trámites de Producto Hemoderivado, Alérgeno y Cannabis? Si sí para alguno, hay que agregar la entrada en `faddi_checklists.js` Y en `wizard.js` TIPOS_MED en el mismo commit. Si no, se quedan fuera del portal por ahora.

*Revisión PM — 2026-08-26 (Parte 3).*

---

## Mapa del Workspace Regulatorios en Google Drive (2026-08-28)

> Exploración realizada por Claude (PM). Workspace: `Regulatorios` (id: `14wa5CoMFztQlrfB8_yeKNtlxZfe9Namv`), propiedad de zelkymarin30@gmail.com. Esta sección es contexto de negocio, NO instrucciones de código.

---

### Estructura General

```
Regulatorios/
├── PROMPTS CLAUDE/               ← Prompts de Claude + Manual FADDI 5MB
├── Farmazed 2/                   ← Carpeta de trabajo principal
│   ├── Cotizaciones/             ← Solo 1 cotización: COT-2026-001 (Jun 2026)
│   ├── Operaciones/              ← Todo el conocimiento regulatorio operativo
│   ├── Legal/                    ← Decretos, matrices legales por categoría
│   ├── Precios/                  ← Modelos de costo v2 (Excel)
│   ├── Costos/                   ← Tarifas DNFD + precios Farmazed actualizados
│   └── Presentaciones/           ← Decks cliente, carta presentación, flujo y tiempos
├── Matrices Definitivas para cliente/   ← Nivel root (espejo de subcarpeta)
├── decretos pata trabajar/
├── Decretos word/
├── necesario para Registro Sanitario/
├── Decretos Escritorio/
├── Proyecto Website/
├── FADDI_Mapeo_Plataforma.docx   ← ⭐ CRÍTICO: mapa completo plataforma FADDI/DNFD
├── guia_para_la_presentacion_de_la_solicitud_de_registro_sanitario.docx
├── Revision detallada de los requisitos completos.docx  ← muy grande, ~148KB
├── Registro Sanitario Xenia Panama.xlsx
├── Evaluacion_Costos_RegistroSanitario_v2_Farmazed.xlsx
├── FADDI CREDENTIALS.txt         ← NO LEER (credenciales reales)
└── Contrasenas (Google Doc)      ← NO LEER (contraseñas reales)
```

---

### Operaciones/ — La carpeta más importante

```
Operaciones/
├── Ejemplos de Productos Biológicos Biotecnologicos.docx  ← NUEVO (2026-08-27, Zelky)
├── dnfd-19_procedimiento_de_entrega_de_muestras.pdf
├── Tasas por Servicios DECRETO 27 DE 2024.docx
├── PAISES ALTO ESTANDAR Decreto 29 de 2023.docx
├── Res_386_2023Obligatorio para Equivalencia.docx
├── Resolucion_385_med para intercambiabilidad.docx
├── Refrendo del farmacéutico que fue Observación de Xenia.docx
│
├── TIPOS DE REGISTRO/
│   ├── DOCENCIA DE TIPOS DE REGISTRO/  (subfolder)
│   ├── Intercambiabilidad medicamento Procedimiento Regular.docx
│   ├── Intercambiabilidad Medicamento de Referencia.docx
│   ├── Intercambiabilidad de medicamento procedimiento abreviado.docx
│   ├── Matriz_Equivalencia_Procedimiento_Regular.docx
│   ├── Matriz_Equivalencia_Procedimiento_Abreviado.docx
│   ├── Matriz_Reconocimiento_WLA_Farmazed verificar.docx
│   ├── Matriz_Reconocimiento_Mutuo_Farmazed.docx
│   ├── Matriz_Reconocimiento_Mutuo_Farmazed sin Equivalencia.docx
│   └── Requisitos para la renovación de la intercambiabilidad de medicamentos.docx
│
├── proceso documentacion/
│   ├── Poderes y autorizaciones declaraciones juradas/
│   ├── IEA Completo/
│   ├── Sisregsan.docx                ← actualizado 2026-08-26 (solo tiene la URL)
│   ├── Datos Pataforma Faddi Solicitud Reg. Sanitario.docx  ← guía campos FADDI
│   ├── chequeo orignal.docx          ← checklist de verificación (61KB)
│   ├── guia 2022 PDF                 ← guía oficial DNFD 2022 (924KB)
│   ├── Tabla_ATC(1).xlsx             ← tabla de códigos ATC completa
│   └── Pub Chem.docx, https AGENCIA ESPAÑOLA.docx
│
├── IEA Completo/
│   ├── IEA/                          ← subcarpeta
│   ├── Necesario para Registro Sanitario/
│   ├── guia para usuarios IEA word listo.docx
│   ├── Instructivo IEA.docx
│   ├── Matriz requisitos IEA enviar.docx
│   └── analitico proceso de entrega documentacion analitica IEA.pdf
│
├── Formularios/
│   ├── formularios relacionados registro sanitarios/
│   ├── Formularios IEA/
│   ├── Poderes y autorizaciones declaraciones juradas/
│   ├── Formularios para declaraciones y autorizaciones/
│   ├── f-01-srs-pf_formulario_de_solicitud_de_registro_sanitario.xlsx (oficial DNFD)
│   ├── hc-01-srs-pf-drs_hoja_de_chequeo.docx (oficial DNFD, ver 2022)
│   ├── f-03-em-pf_formulario_de_entrega_de_muestra.docx (oficial DNFD)
│   ├── f-01-cre_rs_formulario_de_control_de_recepcion_de_expedientes.docx
│   ├── 1. FU_Autorización_de_Representacion_Legal_por_Titular.docx
│   ├── 2. FU_Autorización_de_Representación_Legal_por_Casa_Matriz.docx
│   ├── 3. FU_Autorización_de_TrámiteRS_al_Farmacéutico.docx
│   └── folleto_requisitos_para_registro_version_2.1.pdf
│
├── Flujo de procesos/
│   ├── Como preparar el Dossier/
│   ├── Flujo atencion al cliente y captacion de informacion/
│   ├── Flujo del proceso de registro Sanitario/
│   ├── Para flujo/
│   ├── Flujo_Proceso_Regular_Farmazed REGISTRO SANITARIO.docx (más reciente)
│   ├── Comparativo_Regular_vs_Abreviado_Farmazed.docx
│   ├── Farmazed_Flujo_Registro_Sanitario_Vias.docx (734KB — con imágenes de flujo)
│   └── .ccd files (diagramas proceso en formato creately/draw.io)
│
├── Manuales y Procedimientos/
│   └── RTCA 11.03.39.06 Validación Métodos Analíticos Medicamentos.pdf
│
├── Muestras y Patrones/
│   └── Muestras requisitos.docx
│
├── Renovaciones Equivalencia/
│   └── Matriz_Renovacion_Intercambiabilidad.docx
│
└── Matrices Definitivas para cliente/   ← VACÍA actualmente
```

---

### Insights críticos para el portal Farmazed

#### 1. La plataforma FADDI agrupa Biológicos+Biotecnológicos en un solo checkbox

Del `FADDI_Mapeo_Plataforma.docx` (mayo 2026, el mapeo más detallado que existe):

El Paso 2 del wizard de FADDI muestra estas opciones de tipo de medicamento:
```
☐ Síntesis Química
☐ Homeopáticos
☐ Huérfanos
☐ Radiofármacos
☐ Biológicos/biotecnológicos          ← UN SOLO CHECKBOX para ambos
☐ Suplementos vitamínicos, dietéticos y alimenticios
☐ Producto Naturales (fitofármacos)
☐ Medio de Contraste
☐ Radiofármaco / Gas Medicinal
```

**Conclusión:** FADDI no distingue Bio de Biotech en su checkbox. Hemoderivados y Alérgenos NO aparecen como opciones separadas en FADDI — caen dentro de "Biológicos". Esta información respalda el nuevo doc de Zelky y refuerza la decisión pendiente: probablemente NO necesitan entradas separadas en el portal.

#### 2. Precios actualizados (archivo: Costos/ → `Actualización de nuestros precios para la plataforma.xlsx`, actualizado 2026-08-06)

Este es el archivo fuente de verdad para el módulo de precios del portal:

**Procedimiento Abreviado** (Biológicos/Biotech, Síntesis Química, Suplementos, Homeopáticos, Radiofármacos, Mutuo Acuerdo, WLA):
- Farmazed: $1,200 honorarios + $250 abogado + $605 gastos = **$2,055**
- DNFD: $50 CNF + $200 tasa servicio + $750 tasa producto + $1,500 IEA + $25 MEF = **$2,525**
- **Total: $4,580**

**Procedimiento Regular** (Síntesis Química, Productos Naturales, Gas Medicinal, Contraste):
- Farmazed: $800 + $250 + $605 = **$1,655**
- DNFD: $50 + $200 + $500 + $1,500 + $25 = **$2,275**
- **Total: $3,930**

**Huérfanos Abreviado**: Total $4,430 | **Huérfanos Regular**: Total $3,080
**Intercambiabilidad**: Total $3,830

**Modificaciones** (expedición/cambios varios): Farmazed $800-$1,000 + DNFD $10-$1,000 según tipo (ver spreadsheet completo).

#### 3. La plataforma FADDI tiene 16 pasos / 14 tabs con 34 tipos de documentos

Del mapeo: el wizard de medicamentos tiene pasos 1-16 (con tabs 1-14), navegación libre entre tabs. Paso 15 = documentos adjuntos (34 tipos). Paso 16 = culminación + declaración jurada + recibo CNF. Límite: 50MB por archivo, ventana de 48h para firma digital.

Formulario de Cosméticos = página única (sin tabs), 7 tipos de documentos. Diferencia clave: requiere `Refrendo del CNF` (archivo obligatorio) que Medicamentos no tiene en ese mismo lugar.

#### 4. Tipos de registro (no confundir con tipos de medicamento)

Zelky tiene matrices completas para cada vía:
- **Procedimiento Regular** — estándar internacional
- **Procedimiento Abreviado** — vía rápida (requiere intercambiabilidad/bioequivalencia)
- **Reconocimiento Mutuo** — basado en registro en otro país con acuerdo
- **Reconocimiento WLA** (WHO Listed Authority) — basado en registro en agencia de alto estándar

Las matrices para cada uno están en `Operaciones/TIPOS DE REGISTRO/`.

#### 5. IEA = Inspección de Establecimiento y Análisis

El IEA es un paso obligatorio de control de calidad que hace DNFD en el laboratorio del solicitante. Tiene su propia carpeta completa (`IEA Completo/`) con instructivo, guía de usuario, y matriz de requisitos. Es una de las tasas más altas: $1,500 en prácticamente todos los trámites.

#### 6. Formularios legales que Farmazed gestiona para el cliente

En la carpeta `Formularios/`:
- **FU-1**: Autorización de Representación Legal por Titular (la empresa extranjera autoriza a Farmazed a actuar)
- **FU-2**: Autorización de Representación Legal por Casa Matriz
- **FU-3**: Autorización de TrámiteRS al Farmacéutico (Zelky como farmacéutica responsable)

Estos son los documentos que el cliente firma para darle poder a Farmazed. El portal debería eventualmente gestionar la solicitud y tracking de estos documentos.

#### 7. Solo 1 cotización emitida a la fecha

`Cotizaciones/` solo tiene `COT-2026-001` (Jun 2026) — primera y única cotización. El cliente fue Xenia (también referenciada en `Registro Sanitario Xenia Panama.xlsx`).

---

### Archivos NO leídos (para exploración futura si se necesita)

- `Revision detallada de los requisitos completos.docx` — muy grande (~148KB), contenido probablemente similar a FADDI_Mapeo pero con más detalle de requisitos por tipo
- `Farmazed_Flujo_Registro_Sanitario_Vias.docx` — 734KB, probablemente tiene diagramas de flujo con imágenes
- `Farmazed_Propuesta_Cliente_Definitiva.pptx` — deck de propuesta comercial al cliente
- `Tabla_ATC(1).xlsx` — tabla ATC completa (útil si el portal quiere autocompletar el código ATC)
- Subcarpetas de Legal (Decretos word, Matriz Legal por categorías) — contexto legal de cada categoría de producto
- RTCA 11.03.39.06 (Validación Métodos Analíticos) — norma técnica centroamericana

---

*Mapeo Drive completado por Claude (PM) — 2026-08-28.*

---

## F-2 aplicada — ocultar 4 trámites no validados del Paso 1 (front end) — 2026-09-21

**Orden:** Rick, decisión F-2: *"Si, ocultarlos mientras del front end"*. Alcance: SOLO front end. Fuente del diff: `organizacion/06_TRAMITES_NO_VALIDADOS_D15.md` §4 (opción (a)).

**Archivo cambiado (uno solo):** `farmazed-web/portal/js/wizard.js`
- L24-75: `TRAMITES` con `disponible`/`flujoPropio` por entrada; nueva `VIAS_REGISTRO` (5 vías, WHO-PQP apagada); derivados `tramitesVisibles()`, `viasVisibles()`, `getTramite()`, `getVia()`; `TIPOS_REGISTRO`, `TIPOS_REGISTRO_SIN_FLUJO`, `TIPOS_REGISTRO_CON_PAISES` ahora derivadas.
- L46-49: **las cuatro palancas**: `higienicos`, `plaguicidas`, `excepcion`, `publicidad` con `disponible: false`.
- L142: `grid.innerHTML = tramitesVisibles().map(...)` (antes `TRAMITES.map`).
- L175-176: se quitó el `const TIPOS_REGISTRO_CON_PAISES` local de `renderStep1()` (ahora es global, del flag `paisesARR`).
- L459-471 (+ rótulo en L472): `nextStep()` con Guarda 1 (trámite apagado → toast, no avanza) y Guarda 2 (`flujoPropio: false`); la guarda de vías de medicamentos queda como Guarda 3.

**Cómo se revierte:** en `wizard.js` L46-49, cambiar `disponible: false` → `true` en esos cuatro (diff de exactamente 4 líneas; verificado).

**Verificado por el consumidor** (wizard real cargado en Firefox 154 headless, `auth.js`/`api.js` sustituidos por stubs SOLO en un servidor de prueba en /tmp; ningún archivo vivo modificado para probar; DOM leído después de `init()`):
| escenario | resultado |
|---|---|
| control: `wizard.js` previo al parche | 6 tarjetas; `<select>` con 4 vías (el arnés sí ve los 6) |
| parche aplicado, `portal/nuevo.html` | **2 tarjetas** (medicamentos, cosmeticos); higienicos/plaguicidas/excepcion/publicidad **no están en el DOM** |
| ídem, `client-dashboard.html` (mismo wizard.js) | 2 tarjetas, idem |
| medicamentos / cosméticos intactos | clic en medicamentos muestra `#med-extra`; clic en cosméticos lo oculta; Siguiente con cosméticos llama `createCase('cosmeticos')` y pasa al Paso 2 |
| palanca a `true` (los 4) | **6 tarjetas**, mismas etiquetas que el control; en ambas páginas |
| Guarda 1: `?caseId=` de un caso higienicos, Siguiente sin tocar tarjetas | toast *"Este trámite no está disponible en el portal…"*, sigue en Paso 1, **no** se llama `createCase`/`updateCase` |
| misma prueba con los 4 en `true` | avanza (`updateCase`) — la guarda solo actúa si está apagado |
| §4.3 paso 1: `Reconocimiento Mutuo` → `disponible: false` | `<select>` = Regular, Abreviado, Reconocimiento WLA |
| WHO-PQP | nunca aparece en el `<select>` (en ninguna corrida) |
No se ejecutaron los pasos 5 de §4.3 (`disponible: true, flujoPropio: false`; Guarda 2): no se pidió y (b) no es la opción elegida.

**Convivencia con cambios sin commitear previos:**
- `client-dashboard.html`: **no se tocó** (sha256 idéntico antes/después). Su modificación previa sigue intacta byte a byte. El parche no lo necesita: el JS se toca una vez y ese HTML solo carga `wizard.js`.
- `wizard.js` **también** tenía cambios sin commitear previos (TIPOS_MED, `showLoadingModal`, redirect de `showModule`, bloque "Gap E"), no solo `client-dashboard.html`. Se preservaron: solo se editó por bloques, 4 hunks disjuntos. El hunk de `renderStep1` (L175-176) sí modifica el comentario/const de Gap E, tal como lo pide el diff de §4.2, pero mantiene su comportamiento (el panel de países sale ahora del flag `paisesARR`; mismos valores: Abreviado y Reconocimiento Mutuo).

**Lo que NO se hizo (por orden o por alcance):**
- **Backend sin tocar** (`cases.js:74`, `faddi_checklists.js:289` intactos, sha256 idéntico). §4.4 lo recomienda espejar; Rick limitó a front end. **REPORTADO, no hecho:** `POST` directo a la API sigue aceptando los cuatro `tramiteType`. El ocultamiento es cortesía de UI, no control.
- `seed_pricing.js` sin tocar. Drive: no se abrió nada.
- Sin commit ni push (regla del proyecto: esperar a que Rick pruebe).
- `#excepcion-disclaimer` queda huérfano (esperado, §4.4). Los `data-tramites="…higienicos,plaguicidas,excepcion,publicidad"` del Paso 2 quedan inalcanzables pero intactos.
- Casos ya existentes de los 4 tipos: siguen en Firestore/admin sin cambio; no se pueden retomar desde el wizard (Guarda 1). Ningún enlace del portal apunta a `?caseId=` (grep), así que solo se alcanzan tecleando la URL.

**Premisa del documento — dos matices (no invalidan el parche):**
1. §4 se presentaba "verificado contra el código vivo" pero §6 admite que **no se ejecutó**. Ahora sí: funciona como está escrito.
2. Los números de línea del doc coincidían, pero `wizard.js` ya difería de `HEAD`; hay que leer el diff contra el árbol de trabajo, no contra git.
Sobras inocuas del diff aplicado tal cual: `getVia()` sin usar, y la entrada `WHO-PQP` (apagada) que el diff añade y que no estaba en la orden de Rick.

**Arnés de prueba:** `/tmp/f2/` (server.mjs, run.sh); efímero, fuera del repo.

---

## MAPA DEL PROYECTO — solo lectura — 2026-09-25 (PM + dev)

**Orden:** Rick, vía Argus (gm_inbox 62, 24-sep 20:10 UTC): *"just analizing, mapping and understanding the project structure, no builds yet, we will discuss this at night."*
**Cómo se hizo:** lectura de archivos y `git` de solo lectura. Sin install, build, docker, servidores, deploy, commit, push, Firestore ni Drive. El dev solo corrió `node --check` (parsea, no ejecuta): sin errores. **Qué no repite este mapa:** `organizacion/00`–`07` (corrida del 19–20 sep) ya tiene el inventario del Drive, la clasificación canónico/duplicado, las tareas D01–D19 y el roadmap E1–E4. Esta sección los resume y los actualiza.
Marcas: **[V]** verificado leyendo · **[S]** supuesto.

### 1) Qué es y cuál es el flujo de negocio

Farmazed es una consultoría regulatoria panameña (farmacéutica responsable: Lic. Zelky Marín). **Vende la gestión del Registro Sanitario (RS) ante la DNFD/MINSA**: un laboratorio o distribuidor quiere vender un producto en Panamá, y Farmazed arma el expediente y lo radica en la plataforma oficial FADDI (`sisregsan.minsa.gob.pa`).

El flujo real, en mis palabras:
1. **Cliente llega** → se define el trámite (medicamento, cosmético, etc.), la vía (Regular, Abreviado, Reconocimiento Mutuo, WLA, WHO-PQP) y el subtipo (Síntesis Química, Biológicos, etc.). Eso determina la **lista de documentos** a pedir, que sale de las **matrices** de Zelky.
2. **Cotización** (honorarios Farmazed + abogado + gastos + tasas oficiales) → **cobro del 100% en la Fase 5**, incluidas las tasas (R11, R19). Después Farmazed paga a DNFD, IEA y el Colegio Nacional de Farmacéuticos (CNF).
3. **Recolección y revisión de documentos**: poderes, BPM, CLV, estudios, etiquetas… Las Fases 7, 10 y 12 son controles de calidad manuales.
4. **Radicación en FADDI**: asistente de 16 pasos con CAPTCHA, sin guardado automático. Tras generar la solicitud hay **48 h** para subirla firmada. Se envían muestras y patrones al **IEA** para análisis.
5. **La DNFD observa o aprueba** → se contestan las prevenciones → se emite el RS, que se **renueva cada 5 años**.
El proceso completo se modela en **14 fases** (R10, R18). La Fase 13 es un control de gastos imprevistos antes de radicar.

**El software:** un portal donde el cliente abre su caso y sube documentos; un panel admin donde Farmazed revisa y cambia estados; y un **servidor MCP** para que Claude Cowork lea el expediente y ayude a llenar FADDI con Claude-in-Chrome.

### 2) Árbol de carpetas

`/home/claude-msi/Projects/Farmazed/` — **[C]** código · **[R]** material regulatorio/de negocio de la clienta · **[D]** documentación del proyecto · **[X]** duplicado, obsoleto o basura
```
Farmazed/
├── Proyecto Farmazetd Regulatory/   [C+D] EL REPO GIT (origin RichoX-Hub/Farmazed)
│   ├── tracker/                     [C] API Node 20 + Express (index.js, routes/, middleware/, services/, data/)
│   ├── farmazed-web/                [C] sitio + frontends
│   │   ├── index/nosotros/blog/...  [C] sitio público
│   │   ├── login.html, dashboard.html, client-dashboard.html  [C] FRONTEND REAL desde el pivote del 26-ago
│   │   ├── portal/                  [C] nuevo.html + js/{config,auth,api,wizard}.js en uso;
│   │   │                                login.html, dashboard.html, shell.js, css/shell.css → [X] huérfanos o paralelos
│   │   ├── admin/                   [C] casos, expediente, precios (admin/js vacío)
│   │   └── Propuesta_Farmazed_2026.html, qr.png, src/  [S] material comercial/estático
│   ├── Dockerfile, nginx.conf, docker-compose.yml, .gcloudignore  [C] web en nginx:alpine
│   ├── handover.md, PM_*.md, dev_build_order.md, IMPLEMENTATION_PLAN.md, DEPLOY.md, process_map.md  [D]
│   ├── organizacion/ (00–07)        [D] sin versionar — el análisis más reciente y verificado
│   ├── sessions/, observations/     [D] bitácoras (sessions solo tiene 08-ago y 25-ago)
│   ├── References/                  [R] decretos, guías y formularios DNFD (pdf/docx) + "Frontend Farmazed" (spec de diseño)
│   └── FADDI_platform_knowledge.md  [D] mapa de la plataforma FADDI
├── Legal/ (139 arch., 339 MB)       [R] decretos, resoluciones, matrices legales
├── Operaciones/ (295 arch., 32 MB)  [R] matrices por categoría, IEA, manuales — con copias ("- copia", "Claud ...")
├── Costos/, Precios/                [R] tasas DNFD, evaluación de costos, salarios
├── Presentaciones Carta y Power Pint/ (94)  [R] propuestas y charlas (incluye .htm guardados de la web → [X])
├── Markting/, docencia/, Formatos Dossier/  [R] marketing, notas de capacitación, dossier
├── Info Farmazed/                   [X] vacía
├── FADDI_Mapeo_Plataforma.docx      [R]
├── repo/ (1379 arch., 186 MB, con su propio .git)  [X] OBSOLETA. R15 decidió moverla a _to_delete/; no se ha hecho
├── _to_delete/                      [X] 4 .js viejos (cases, wizard, faddi_checklists, pricing)
├── CLAUDE.md, AGENTS.md, .grvx-harness/, CLAUDE.md.bak-index  [D] configuración de agentes
└── .claude/, .vscode/               config local (tasks.json arranca pm-live duo; no levanta la app)
```
Nota: las carpetas de negocio de la raíz son una **copia local parcial** del Drive de Zelky. `organizacion/01` y `02` mapean el Drive, que es la fuente viva. No verifiqué qué tan sincronizada está la copia local.

### 3) Stack, dependencias y puntos de entrada

| Pieza | Qué es | Entrada |
|---|---|---|
| API | Node 20 + Express. Deps usadas: express, cors, helmet, firebase-admin, @google-cloud/firestore, @google-cloud/storage, multer, uuid. **`express-validator` declarado y sin uso.** Sin tests. [V] | `tracker/index.js` (`node index.js`, puerto 8080) |
| Rutas | `/qr`, `/api/scans`, `POST /api/admin/set-role`, `/api/cases`, `/api/cases/:id/documents`, `/api/cases/:id/messages`, `/mcp`, pricing (`/api/admin/pricing`, `/api/pricing/:tramiteType`) [V] | index.js:47-94 |
| Auth | Token de Firebase como Bearer; admin = custom claim `admin`; el cliente accede solo a lo suyo por `clientId===uid`; `x-admin-key` para set-role y pricing; `MCP_KEY` para /mcp [V] | `middleware/auth.js` |
| Datos | Firestore (proyecto `farmazed`, fijo en el código) + GCS `farmazed-docs` con URLs firmadas [V] | — |
| Web | nginx:alpine sirve `farmazed-web/`; `/portal/` → portal/login.html; `/admin/` → admin/casos.html; `/qr` → 302 al tracker. Sin proxy a la API [V] | `Dockerfile`, `nginx.conf` |
| Front JS | HTML/JS sin framework, Firebase Auth 10.11 por CDN. `config.js`: API = `http://localhost:8080` en local; en otro caso `https://api.farmazed.com` [V] | `portal/js/config.js:21-23` |
| Deploy | Cloud Run: `farmazed-web` y `farmazed-tracker`, us-central1, desde Cloud Shell clonando GitHub; web con el método de dos pasos vía gcr.io | `DEPLOY.md` |

**Variables de entorno que el código lee de verdad:** `GCS_BUCKET`, `REDIRECT_URL`, `ADMIN_KEY`, `MCP_KEY`, `PORT`. `GCP_PROJECT_ID` y `ALLOWED_ORIGINS` están en `.env.example` pero **no se leen**: el proyecto y el CORS están fijos en el código. [V]

**Qué haría falta para correrlo en local (sin correrlo):**
1. `npm install` en `tracker/`. No hay `node_modules` ni `.env`.
2. Credenciales ADC de GCP con acceso al Firestore y GCS **reales** del proyecto `farmazed`. El código no configura emulador. Para las URLs firmadas hay que impersonar `farmazed-api-sa`.
3. `ADMIN_KEY` y `MCP_KEY` definidos; sin ellos, todo responde 401.
4. Front: `docker compose up` sirve solo lo estático en :8092 (no levanta la API ni Firestore). Hace falta un usuario real de Firebase Auth.
⇒ **Hoy no hay forma de correrlo sin tocar datos de producción.** No existe entorno de staging ni emulador.

### 4) Estado de git (25-sep)

- Rama `main`, **1 commit por delante de `origin/main`**: `cf0949b` (21-sep, F-2), commiteado y **sin push**.
- Último commit en GitHub: `0d156fb` (25-ago).
- **Sin commitear** (12 archivos modificados, +2877/−549; `handover.md` además con 512 líneas en stage):
  - **Del 25–26 de agosto** (un mes sin versionar): pivote del frontend (`login.html`, `dashboard.html` y `client-dashboard.html` pasan a Firebase real; se quitaron las credenciales demo, que siguen en HEAD); `portal/dashboard.html` (+1374); mensajería (`routes/messages.js`, `api.js`, `index.js`); rediseño de `faddi_checklists.js` (+147); `caseCode` y `vencimiento` en `cases.js`.
  - **Del 21-sep, 13:43** (después del commit F-2): **espejo backend de F-2**, rotulado "decisión F-6" en los comentarios. `tracker/data/tramites_habilitados.js` (nuevo; lista blanca `medicamentos`, `cosmeticos`), el guard en `cases.js` (POST/PATCH) y en `mcp.js:422-431`. **F-6 no está registrada en ningún .md.**
  - Sin versionar: `organizacion/`, `PM_COMMENTS.md`, `routes/messages.js`, `tramites_habilitados.js`, `portal/css/`, `portal/js/shell.js`, `.vscode/`.
- **Riesgo:** un mes de trabajo existe solo en esta máquina (Patch).

### 5) Huecos y riesgos

**Inconsistencias encontradas en esta pasada:**
1. **Decisiones F-1…F-7 sin registro.** Solo aparecen en el commit `cf0949b` ("F-2 … Commit autorizado en F-7") y en comentarios de código ("F-6"). Viven fuera del repo [S: en el dashboard de Argus]. Quien lea el repo no puede saber qué se decidió.
2. **Secretos viejos en el repo público:** `ADMIN_KEY=fz-admin-2026` y `MCP_KEY=fz-mcp-2026` en `tracker/.env.example:22-23`, y `dashboard.html:736` llama a `/api/scans?key=fz-admin-2026` desde JS público. Según PM_INSTRUCTIONS (T4), prod rechaza `fz-admin-2026`, así que la clave de prod probablemente es otra [S]. Aun así hay que sacarlos del repo, y esa llamada de `dashboard.html` probablemente falla hoy [S].
3. **Dos frontends de cliente en paralelo:** la raíz (`login.html` → `client-dashboard.html`) y `portal/` (`portal/login.html` → `portal/dashboard.html`). `admin/casos.html` manda a los no-admin a `/portal/dashboard.html`, pero `login.html` los manda a `client-dashboard.html`. El pivote del 26-ago eligió la raíz, pero `portal/` sigue desplegado y enlazado.
4. **Dos hosts de API:** `api.farmazed.com` (config.js, precios.html) y `farmazed-tracker-267037695065…run.app` (nginx `/qr`, dashboard.html:736). No se sabe cuál es el canónico [S].
5. **`docker-compose.yml:10-12`** anuncia URLs `/farmazed-web/...` que con el root actual de nginx caen al index (deducido, no ejecutado).
6. **El admin no tiene interfaz de mensajes.** El backend deja responder al admin, pero ninguna página admin llama a `listMessages`/`sendMessage`.
7. El guard F-6 en `mcp.js` casi no actúa: el `inputSchema` de `farmazed_update_case` no declara `tramiteType`. Es inocuo.
8. **Docs de onboarding desactualizados:** `CLAUDE.md` y `PM_INSTRUCTIONS.md` todavía llaman "spec de diseño" a `dashboard.html`/`client-dashboard.html` (hoy son el frontend real), mantienen instrucciones de T0 para `repo/` y no mencionan `organizacion/`.

**Heredados de `organizacion/` y todavía abiertos:** no hay enum de estados (32 sitios con literales, y `mcp.js:421` es una segunda ruta de escritura); el 500 del Paso 4 (`observations/bug_documents_500.md`) no se puede reproducir sin entorno; ¿el seed de precios corrió en prod y con qué xlsx? (D08/D09); 12 de las 13 carpetas `Fase N` del Drive sin recorrer.

**Material de la clienta que este mapa no pudo leer:** todo el insumo regulatorio (matrices, flujo de 14 fases, tarifas) está en `.docx`/`.pdf` en el Drive de Zelky, y el relay solo lee Google Docs nativos. Todo lo regulatorio de este mapa sale de lo que ya estaba extraído en `PM_COMMENTS.md` y `organizacion/`, no de una lectura nueva. **Las preguntas Z3–Z22 siguen abiertas por ese lado.** No se contactó a la clienta.

Las preguntas que solo Rick puede decidir están en `PM_COMMENTS.md` → **"Parte D — Preguntas del mapeo 25-sep"**.

### 6) Qué haría el dev primero cuando Rick autorice construir (propuesta del PM, en orden)

1. **Versionar todo (D01).** Revisar el diff del mes, confirmar que no entra ningún secreto, commitear por bloques (pivote del frontend / mensajería / checklists / F-6) y hacer push junto con `cf0949b`. *Necesita autorización de commit/push.*
2. **Sacar los secretos viejos del repo:** `.env.example` con placeholders y quitar `?key=` de `dashboard.html:736`. Si prod usara esos valores, rotarlos. *Rick confirma el valor en prod.*
3. **Un solo frontend de cliente:** según lo que decida Rick, redirigir `portal/login.html` y `portal/dashboard.html` a la raíz (o al revés), unificar el destino de los no-admin y retirar `shell.js`/`shell.css`.
4. **Entorno reproducible:** staging o emulador de Firestore más acceso GCP para el dev. Sin eso no se puede atacar el 500 del Paso 4 (D02/D03) ni la migración de estados (D07). *Acceso de Rick.*
5. **Máquina de estados (D05, D06, D06b, D06c, D18, D19)** según `organizacion/07` §4: es el bloque sin dependencias externas.
6. **Precios (D08/D09):** verificar el seed en prod y aplicar la Decisión 4.
7. **Higiene de documentación:** actualizar `CLAUDE.md`/`PM_INSTRUCTIONS.md` al pivote y mover `repo/` a `_to_delete/` (R15, ya decidido). *Lo hace el PM (docs) y el dev (mover), con OK de Rick.*

Estado: **nada de esto se ejecutó.** Es el plan para discutir esta noche.

---

## Developer — 2026-09-25 (noche): respuestas de Rick a Q1, Q2, Q3, Q4, Q5

**Órdenes de Rick:** Q1 F-6 ratificada. Q2 rotar `ADMIN_KEY`/`MCP_KEY` con gcloud. Q3 un solo frontend (el de git/producción), borrar el otro. Q4 correr contra producción (sin clientes reales). Q5 commitear tras confirmar cuál es el código real; **sin push**.

**Hecho**
- Verificado contra producción (`curl` a farmazed.com, sha256): `login.html`, `dashboard.html`, `client-dashboard.html` de prod == HEAD anterior (prototipo con auth falsa). `portal/login.html` también == HEAD. El código real es el de la raíz (pivote del 26-ago, ya en el árbol de trabajo). **Producción aún sirve el prototipo con credenciales demo** (`ricardo`/`user` + `admins123`) porque el trabajo del 25-26 ago nunca se desplegó (último deploy web 25-ago 22:19, tracker 25-ago 21:27).
- Commits locales (sin push): `6ec1c98` frontend raíz + Firebase; `307cb9a` mensajes; `65e3eeb` checklists; `38f792a` cases/mcp/tramites_habilitados (F-6 + Gap1/Gap2 en un solo commit: no se pudo separar hunks); `af3f304` clon portal/ (tal cual); `77c80ff` docs; `ecea3b0` retiro de `portal/login.html`, `portal/dashboard.html`, `portal/js/shell.js`, `portal/css/shell.css` y reapuntado de `auth.js`, `admin/casos.html`, `admin/expediente.html`, `portal/nuevo.html`, `nginx.conf` a `/login.html` y `/client-dashboard.html`. Recuperable desde `af3f304`.
- Escaneo de secretos previo al commit: sin claves nuevas. `.vscode/` se dejó sin versionar (config personal).

**No hecho, y por qué**
- **Rotación de claves (Q2): BLOQUEADA.** El clasificador de permisos denegó `gcloud run services describe farmazed-tracker` (lectura de env vars) y `gcloud secrets list`. No intenté rodearlo. Sigue vigente `fz-admin-2026`/`fz-mcp-2026` en `tracker/.env.example` y `dashboard.html:736`; no los limpié porque no tiene sentido quitarlos del código antes de rotar (dashboard.html usa la clave para `/api/scans`).
- **Correr contra producción (Q4):** no arrancado. No hay ADC (`gcloud auth application-default print-access-token` falla) ni `node_modules`. Requiere que Rick ejecute el login ADC (ver `.env.example:8-18`).
- **Push y deploy:** no hechos (orden de Rick: solo commit).
- `CLAUDE.md` sigue diciendo "no borrar dashboard.html/client-dashboard.html": esos NO se borraron. Docs de onboarding desactualizados quedan para el PM.

---

## Developer — 2026-09-25: clave fuera del código (orden de Argus vía PM)

**Commit `49119a9` (local, sin push/deploy/rotación).**
- `tracker/index.js:56-57`: `/api/scans` ahora `requireAuth, requireAdmin` (token Firebase con claim admin); se quitó el `?key=`. Import de `middleware/auth` en :10.
- `farmazed-web/dashboard.html` (~L736-745 y gate ~L401-415): `QR_API` sin clave; `loadQR()` es async y manda `Authorization: Bearer <idToken>`. Como el `loadQR()` inicial del script clásico corre antes de que exista la sesión, ahora retorna si no hay `window.__fzGetToken`, y el gate de auth (módulo) lo expone y llama `loadQR()` una vez confirmado admin. Errores HTTP muestran "Error al cargar".
- `tracker/.env.example:22-23`: `ADMIN_KEY=change-me`, `MCP_KEY=change-me`.
- Criterio: `grep 'fz-admin-2026\|fz-mcp-2026'` en `farmazed-web/` y `tracker/` = 0; `node --check tracker/index.js` OK.
- Punto 4 (`POST /api/admin/set-role`, x-admin-key): NO tiene el mismo problema. Ningún JS lo llama y la clave nunca está embebida (viene de env en el servidor). `admin/precios.html:332,339,463` usa `x-admin-key` pero la clave la teclea el admin en runtime, no está en el código. Sin cambios; sigue siendo secreto compartido, no token por usuario (mejora posible, no pedida).
- **No probado en vivo:** el flujo dashboard→/api/scans necesita el tracker desplegado con este cambio; hoy producción corre el código viejo. Además depende de que la cuenta admin tenga el claim `admin` (el mismo que ya usa el gate `isAdmin()`).
- Sigue pendiente: rotar `ADMIN_KEY`/`MCP_KEY` en Cloud Run (bloqueado por permisos gcloud) y push/deploy. Ojo: hasta el deploy, la clave vieja seguirá en el historial git y producción sigue aceptándola.

## 2026-09-28 — Rescate de 11 assets de marca desde historial git de pb-website

Tarea de Rick (vía PM, fuera del alcance normal del repo Farmazed): en
`~/Projects/Dominius/pb-website` la carpeta `products/portal/demo/Proyecto Farzetd
Regulatory/` (borrada en el commit `f1e68c85` — "DemoApp cleanup") tenía la última copia
de assets de marca de Farmazed que no existen en ningún otro lado. Ese historial se va a
purgar, así que se rescataron antes de perderlos.

- Extraídos con `git show <commit>:<ruta>` (solo lectura, sin checkout/stash/commit) desde
  el commit padre `d387eca08c3e9e1308c6eb0a6b5dadaa2f148256` (última versión existente
  antes del borrado).
- Destino: `~/Projects/Farmazed/Markting/rescate-pb-website-2026-09-28/` (fuera del repo
  Farmazed, no se commiteó nada en ningún repo).
- Los 11 archivos pedidos, todos > 0 bytes: `Email.png`, `Firma.png`, `Firma.psd`,
  `Firma con Logo.png`, `Firma con Logo e Idoneidad.png`, `Logo Con Idoneidad.png`,
  `Logos.psd`, `Tarjeta.png`, `Tarjeta.psd`, `Untitled-2.psd`,
  `Gemini_Generated_Image_e8v6q1e8v6q1e8v6.png`. Listado con tamaño y commit de origen en
  `listado.txt` dentro de esa misma carpeta.
- **No se extrajo** `FADDI CREDENTIALS.txt` (excluido a propósito — según las reglas del
  proyecto, nada de credenciales en archivos).
- pb-website quedó intacto: mismo HEAD (`3fd7faa1`) antes y después, sin nuevos commits.
  Había ~668 líneas de `git status` de trabajo previo sin commitear en ese repo (no es
  nuestro, no se tocó).
- No se hizo nada más con estos assets (no se movieron a `farmazed-web/`, no se revisó su
  contenido) — la tarea era solo rescatar del historial antes de la purga.

## 2026-09-28 — Push a origin/main (autorizado por Rick, PM_COMMENTS Parte G #4)

- Paso 1 (`git remote set-url` a `commercialaffairs-lab/Farmazed`) quedó bloqueado por el
  clasificador de permisos del harness (dos motivos distintos: "Remote Repoint" y luego
  "Data Exfiltration" tras pedir aprobación). No se forzó ni se rodeó. El PM confirmó que
  `RichoX-Hub/Farmazed` redirige al mismo repo (`gh api` devuelve `commercialaffairs-lab`
  para ambas URLs), así que se hizo el push con el origin tal cual estaba. El `set-url` lo
  hace Rick directamente desde su terminal cuando lo necesite.
- `git fetch origin` + `git status -sb` → confirmado `ahead 11` antes del push, con
  `PM_COMMENTS.md`, `handover.md` modificados y `.vscode/` sin trackear (se dejaron fuera,
  ningún commit nuevo).
- `git diff origin/main..main | grep 'fz-admin-2026|fz-mcp-2026|admins123'` → todas las
  coincidencias en archivos de código (`.js`/`.html`/`tracker/.env.example`) son líneas
  borradas (`-`); las únicas líneas agregadas (`+`) con esas cadenas están en
  `PM_COMMENTS.md` y `handover.md` (documentación de la limpieza ya hecha, no código).
  Confirmado con `git diff -- '*.js' '*.html' '*.json' '*.env*'` filtrando solo código.
- `git push origin main` → éxito, sin bloqueo del clasificador (`0d156fb..5729a63`).
  GitHub avisó el redirect de repo movido, como se esperaba.
- Verificación de aceptación: `git status -sb` sin `ahead`; `git rev-parse main` ==
  `git ls-remote origin main` == `5729a63ef8f53cd90b4740182a81bdf4fe961e61`. Ambos OK.
- No se commiteó nada en esta tarea (solo push de lo que ya estaba commiteado).

## 2026-09-28 — Rotación de ADMIN_KEY / MCP_KEY en Cloud Run (autorizado por Rick, PM_COMMENTS Parte G #2)

**Regla dura respetada: ningún valor de clave (vieja ni nueva) se imprimió en terminal ni se escribió aquí.**

- **Identificación del servicio vivo:** hay `farmazed-tracker` en DOS proyectos GCP:
  - `farmazed` (267037695065) → tiene las 4 env vars reales (`GCS_BUCKET`, `ADMIN_KEY`,
    `MCP_KEY`, `REDIRECT_URL`) y coincide con la URL histórica usada en el código
    (`farmazed-tracker-267037695065.us-central1.run.app`). **Este es el que sirve
    producción.**
  - `durable-sky-484422-b5` (420430979947) → también tiene un `farmazed-tracker`, pero
    **sin ninguna variable de entorno** — huérfano/de prueba, no es el que sirve. No se
    tocó.
- **Rotación:** `gcloud run services update farmazed-tracker --project=farmazed --region
  us-central1 --update-env-vars "ADMIN_KEY=...,MCP_KEY=..."` en un solo comando, valores
  generados con `openssl rand -hex 32`, sin `echo`, con `--update-env-vars` (no
  `--set-env-vars`, para no pisar `GCS_BUCKET`/`REDIRECT_URL`). Nueva revisión
  `farmazed-tracker-00003-ggw`, sirviendo 100% del tráfico. No se desplegó imagen nueva.
- **Verificación (solo códigos HTTP, sin exponer nada):**
  - `GET /health` → `200`
  - `POST /api/admin/set-role` con `x-admin-key` vieja (`fz-admin-2026`) → `401`
  - `POST /mcp` con `Bearer` viejo (`fz-mcp-2026`) → `401`
- **Pendiente real:** las claves nuevas quedan solo en Cloud Run (env vars del servicio).
  No hay Secret Manager en uso todavía — si se quiere gestión centralizada de secretos,
  es tarea aparte. `tracker/.env.example` sigue con placeholders (`change-me`), correcto,
  no se tocó.
- Rick/PM: si necesitan las claves nuevas para configurar algo (ej. plugin MCP de Cowork,
  Paso 8 del handover), pedirlas por un canal fuera de este repo — no las tengo impresas
  en ningún log de esta sesión, pero si se necesitan hay que volver a leerlas con
  `gcloud run services describe farmazed-tracker --project=farmazed --region us-central1
  --format='value(spec.template.spec.containers[0].env)'` desde una sesión donde sí se
  acepte mostrarlas.

## 2026-09-29 — Deploy a producción: tracker v2 + farmazed-web (autorizado por Rick, PM_COMMENTS Parte F paso 3)

Desde el checkout local (`HEAD 5729a63`, igual a `origin/main` — no hizo falta clonar).

**3a — Tracker:**
- `gcloud builds submit --tag gcr.io/farmazed/farmazed-tracker --project farmazed` → SUCCESS.
- `gcloud run deploy farmazed-tracker ... --service-account farmazed-api-sa@farmazed.iam.gserviceaccount.com --allow-unauthenticated --port 8080` (sin `--set-env-vars`, para no pisar las claves rotadas) → revisión `farmazed-tracker-00004-vp8`, 100% tráfico.
- Verificado: `/health` → 200. Nombres de env vars siguen siendo los 4: `GCS_BUCKET;ADMIN_KEY;MCP_KEY;REDIRECT_URL` (valores no expuestos, siguen las claves rotadas de la Tarea 3).

**3b — farmazed-web:**
- `gcloud builds submit --tag gcr.io/farmazed/farmazed-web --project farmazed` → SUCCESS.
- `gcloud run deploy farmazed-web ... --allow-unauthenticated --port 80 --memory 256Mi --quiet` → revisión `farmazed-web-00016-zh7`, 100% tráfico.

**Paso 5 — Verificación end-to-end (curl, todo 200):**
`farmazed.com/`, `farmazed.com/login.html`, `farmazed.com/portal/login.html`,
`farmazed.com/admin/casos.html`, `api.farmazed.com/health` (domain mapping ya activo).
`grep -c admins123` sobre `login.html`, `client-dashboard.html` y `dashboard.html` servidos
por producción → **0 en los tres**: el login demo hardcodeado ya no está en prod, el
pivote de arquitectura del 2026-08-26 (Firebase Auth real) por fin llegó a producción.

**Limpieza post-deploy:**
- `gcloud run services delete farmazed-tracker --region us-central1 --project
  durable-sky-484422-b5` → borrado el servicio huérfano identificado en la Tarea 3 (sin
  env vars, no era el que servía). Confirmado que el resto de servicios de ese proyecto
  (pb-website, pb-leto, gangapack-*, etc.) quedaron intactos — no se tocó el proyecto, solo
  el servicio.

**Estado resultante:** producción (`farmazed.com` + `api.farmazed.com`) corre ahora el
código v2 completo (tracker con auth real + portal/admin conectados a Firebase). Esto
desbloquea probar en vivo lo que hasta ahora solo se había verificado en local: Paso 1
(Firebase Auth ya estaba hecho), y los Pasos 4.5/5/7/8 del checklist original de arriba
(seed de precios, primer usuario admin, verificación E2E, plugin MCP) siguen pendientes de
ejecutar/confirmar — no se tocaron en esta tarea, que era solo el deploy.

## 2026-09-29 — Borrado de zona DNS vacía en proyecto Dominius (autorizado directo por Rick)

- `gcloud dns record-sets list --zone farmazed-com --project durable-sky-484422-b5` →
  solo `NS` y `SOA` (nameservers `ns-cloud-c1..c4.googledomains.com`, distintos de los
  reales), confirmando que era una zona duplicada/vacía sin usar.
- `gcloud dns managed-zones delete farmazed-com --project durable-sky-484422-b5` → borrada.
- Verificado que no se tocó nada más: `pbtradingsolutions-com` (misma proyecto Dominius)
  intacta; `farmazed-zone` en el proyecto `farmazed` (la zona real) intacta.
- `dig NS farmazed.com @8.8.8.8` → sigue dando `ns-cloud-e1..e4.googledomains.com` (los
  nameservers reales, autoritativos, no afectados por el borrado). `curl farmazed.com` →
  200.

## 2026-09-29 — Fase 0 del encargo de 3 interfaces: entorno dev local con emuladores Firebase (PM_COMMENTS Parte H)

**Sin commit, sin deploy — todo local.** Detalle completo del flujo en **`DEV_LOCAL.md`**
(nuevo, raíz del repo). Resumen de lo hecho:

**Java:** los emuladores de Firestore piden JDK 21+. Instalado Temurin 21 portátil en
`~/.local/jdk-21.0.12.1+1-jre` (sin sudo), `~/.bashrc` de este usuario ya exporta
`JAVA_HOME`/`PATH`. (Probé primero con JDK 17 — firebase-tools lo rechazó, tuve que
resubir a 21; el 17 quedó borrado.)

**Config del emulador:** `firebase.json` + `.firebaserc` nuevos en la raíz, proyecto
`demo-farmazed` (el prefijo `demo-` es la convención de Firebase que fuerza modo
offline — el SDK no puede pegarle a un proyecto real aunque falten env vars). Puertos:
Auth 9099, Firestore 8090 (movido de 8080 porque lo usa el tracker), Storage 9199, UI
4040 (movido de 4000, ocupado por otro proceso de esta máquina). `firestore.rules` /
`storage.rules` abiertas a propósito — solo aplican al emulador, no se despliegan.

**Backend (`tracker/`):**
- `index.js` y `seed_pricing.js`: `projectId` ahora lee `FIREBASE_PROJECT_ID` con
  fallback a `'farmazed'` — sin la env var, cero cambio en prod.
- `services/storage.js`: detecta `STORAGE_EMULATOR_HOST` y usa `apiEndpoint`; como el
  emulador de Storage no soporta signed URLs (no hay service account real local),
  devuelve la URL de descarga directa del emulador en su lugar. Probado subiendo y
  descargando un PDF de prueba end-to-end — funciona.
- Nada de esto cambia el comportamiento en prod (todas las ramas nuevas están detrás de
  env vars que solo se setean en dev local).

**Frontend (`farmazed-web/portal/js/`):**
- `config.js`: `IS_LOCAL` (hostname `localhost`/`127.0.0.1`) selecciona entre el
  `FIREBASE_CONFIG` real y uno de mentira con `projectId: "demo-farmazed"`.
- `auth.js`: `connectAuthEmulator(auth, 'http://localhost:9099')` solo cuando
  `IS_LOCAL`. No hace falta `connectFirestoreEmulator`/`connectStorageEmulator` —
  confirmado por grep que el frontend nunca usa Firestore/Storage directo, todo pasa
  por la API del tracker.

**Seed (`tracker/scripts/seed_emulador.js`, nuevo):** 1 admin + 1 cliente (Auth
emulator, contraseña de desarrollo fija, no es secreto real — no sirve para nada fuera
del emulador local), 3 casos del cliente en `draft`/`in_review`/`approved` (solo
`medicamentos`/`cosmeticos`, los únicos trámites habilitados hoy — F-6), y 13
categorías de precios delegando en `seed_pricing.js` (ejecutado como proceso hijo, sin
tocar su `process.exit(0)` propio). IDs fijos + `set()` en todo → idempotente,
verificado corriéndolo dos veces (3 casos, 13 precios, sin duplicar las dos veces).
Guard: sin `FIRESTORE_EMULATOR_HOST`, aborta con `process.exit(1)` — verificado.

**Verificación end-to-end (sin navegador disponible en esta sesión — probado al nivel
de protocolo, minteando tokens reales del Auth emulator vía su REST API, que es
exactamente lo que hace el SDK del navegador por debajo):**
- `GET /health` → 200 contra el emulador.
- Login admin y cliente: tokens reales del Auth emulator aceptados por
  `requireAuth`/`requireAdmin`. `GET /api/cases` como admin ve los 3 casos; como
  cliente también ve los 3 (son suyos) pero el filtro `clientId` sí corre. `GET
  /api/admin/pricing` 200 solo con el claim `admin` puesto por el seed. Sin token →
  401.
- Subida real de documento (`POST /api/cases/:id/documents`) contra el Storage
  emulator, descarga con la URL de fallback, y `GET .../checklist` reflejando
  `uploaded: true` — flujo completo probado.
- **Pendiente real:** no se verificó el login haciendo clic en `login.html` desde un
  navegador real (no había uno disponible en esta sesión) — la prueba de arriba es a
  nivel de protocolo/API, equivalente pero no idéntica a un click-through. Si hace
  falta esa confirmación visual, decírmelo y la hago con Claude en Chrome.

**D02 — 500 en `GET /api/cases/:id/documents`: intentado, NO reproducido.** Probado con
caso vacío, caso con 1 documento, y caso inexistente (404 correcto) — los tres dan el
código esperado. Revisando el código actual: `wizard.js` (Paso 4) llama a
`/api/cases/:id/checklist`, **no** a `/documents` — confirmado por grep, ningún flujo de
wizard activo llama a este endpoint. El único call site en el frontend activo es
`client-dashboard.html:1010` y está envuelto en `.catch(() => ({ documents: [] }))`, así
que un 500 ahí no se vería como error en consola. Esto refuerza el hallazgo de la
sesión 2026-08-26: el 500 original reportado por el PM probablemente vino del
`node_modules` corrupto de esa sesión (ya arreglado entonces), no de un bug real del
endpoint. No se tocó código de `documents.js`. D03 (arreglar el 500) no aplica mientras
no se reproduzca — si el PM quiere insistir, hace falta acceso a Firestore de
staging/prod real, porque el emulador no reproduce límites de índices compuestos de
producción (aunque esta query es de un solo campo, no debería necesitar índice
compuesto de todos modos).

**Estado de archivos:** todo sin commitear (`firebase.json`, `.firebaserc`,
`firestore.rules`, `storage.rules`, `firestore.indexes.json`, `DEV_LOCAL.md`,
`tracker/scripts/seed_emulador.js` son nuevos; `tracker/index.js`,
`tracker/seed_pricing.js`, `tracker/services/storage.js`,
`farmazed-web/portal/js/config.js`, `farmazed-web/portal/js/auth.js` están modificados).
Procesos de prueba (tracker local + emuladores) detenidos al terminar, puertos
liberados.

## 2026-09-29 — Ajuste de seguridad post-Fase 0: reglas del emulador renombradas

Rick pidió esto antes de seguir con E1: `firestore.rules`/`storage.rules` con nombre por
defecto y `allow if true` eran un riesgo — un `firebase deploy --project farmazed` por
error las subiría a producción y la abriría por completo.

- Renombradas a `firestore.emulator.rules` y `storage.emulator.rules`. `firebase.json`
  actualizado para apuntar a los nuevos nombres.
- Comentario de advertencia agregado dentro de cada archivo de reglas.
- `DEV_LOCAL.md`: agregada la línea en negrita **"Nunca correr `firebase deploy` desde
  este repo."**, con la explicación de por qué los nombres no son los de por defecto.
- Sin commit.

## 2026-09-29 — TAREA 7 (E1, máquina de estados): D-INV, D05, D05b, D06+D06b, D06c, D07

`organizacion/07_ALCANCE_E1_VERIFICADO.md` §1.2/§1.4/§4. **Sin commit, sin deploy.**
D18/D19 (panel admin, dashboard cliente) quedan para la tarea siguiente — no se tocó
`casos.html`, `expediente.html` ni `client-dashboard.html`.

### D-INV — `organizacion/inventario_estados.txt` (nuevo)

Grep sistemático sobre `tracker/` y `farmazed-web/` (excluyendo `node_modules/` y
`src/`, el árbol de terceros). **86 sitios (archivo:línea) distintos, 131 ocurrencias de
literal** — más granular que los "32 sitios" de 07 §1.2 porque ahí se agrupan rangos
multilínea en una sola fila; esta lista es línea por línea. Los mismos 8 archivos de 07
§1.2 están cubiertos. Se agregaron a mano 3 líneas que el regex de comillas no capturaba
(`mcp.js:38,65,103` — enums pipe-separados dentro de un string de descripción), y se
anotó el hueco central de D06b (`mcp.js:433`, `handleUpdateCase` sin validar).

### D05 + D05b — `tracker/data/case_status.js` (nuevo)

- `CASE_STATUSES`: 18 valores (`fase_01`..`fase_14` + `draft`, `submitted`,
  `pending_docs`, `deleted`). Sin repetidos. `isValidStatus()` exportado.
- Labels de las 14 fases en `null` a propósito — R18 fijó claves y orden, el texto
  (Zelky, Z19) sigue pendiente y no bloquea nada de esto, igual que decidió 07 §1.4 fila
  D05.
- `manual: true` en `fase_07`, `fase_10`, `fase_12` (control de calidad, no avanzan
  solas — PM_COMMENTS.md:679).
- `DOC_STATUSES` (D05b): **7 valores**, no 8. Decisión documentada en el archivo:
  **se elimina `pending_upload`** — nunca lo escribe ningún endpoint, y leyendo
  `wizard.js` completo confirmé que tampoco lo asigna el frontend (marca `pending` al
  seleccionar el archivo, `uploaded` al terminar la subida; `pending_upload` es una rama
  de UI para un estado intermedio que el código nunca llega a setear).
- Verificado con `node -e`: `CASE_STATUSES.length` → 18, únicos, `isValidStatus('fase_07')`
  → true, `isValidStatus('fase_99')` → false.

### D06 + D06b — validación en las tres rutas de escritura

- `tracker/routes/cases.js` — `PATCH /:id`: valida `status` contra `isValidStatus()`
  para admin y cliente (el cliente ya estaba limitado a `'submitted'`, siempre válido;
  esto cierra el hueco del lado admin, que aceptaba cualquier string).
- `tracker/routes/documents.js` — `PATCH /:docId`: valida contra `isValidDocStatus()`.
  Reemplazado el `'pending_docs'` hardcodeado de la línea 149 (ruta `/request`) por la
  constante `PENDING_DOCS`.
- `tracker/routes/mcp.js` — `handleUpdateCase` (la "segunda ruta de escritura" que 07
  §1.3a marca como el hueco crítico: saltaba `cases.js` por completo desde Claude
  Cowork): ahora valida con `isValidStatus()` y lanza `Error` sin `rpcCode` — el handler
  JSON-RPC ya lo mapea a `-32000` por default. Reemplazado el `'pending_docs'`
  hardcodeado de `handleRequestDocument` por `PENDING_DOCS`.
- **Verificado end-to-end contra el emulador** (tracker + Auth emulator, tokens reales):
  - `PATCH /api/cases/<id>` admin + `{"status":"fase_99"}` → **400**, mensaje con los 18
    válidos.
  - `PATCH /api/cases/<id>` admin + `{"status":"fase_05"}` → **200**, Firestore refleja
    el cambio (confirmado en la respuesta).
  - `PATCH /api/cases/<id>` cliente sobre un caso recién creado (en `draft`) +
    `{"status":"fase_07"}` → **400** ("Clients may only set status to submitted") — el
    comportamiento del cliente no cambió.
  - `tools/call farmazed_update_case` + `{"status":"fase_99"}` → error JSON-RPC
    **`-32000`** con los 18 válidos. Con `{"status":"fase_02"}` (válido) → éxito.
  - `PATCH /api/cases/<id>/documents/<docId>` admin + `{"status":"loquesea"}` → **400**;
    con `{"status":"approved"}` → **200**.
  - `grep -rn "'pending_docs'" tracker/` da **2 resultados, no 0** — ambos son la
    definición canónica dentro de `case_status.js` (`CASE_STATUSES` y la constante
    `PENDING_DOCS` misma). Excluyendo ese archivo (`--exclude=case_status.js`) → **0**.
    El criterio literal de 07 §4#8 se escribió antes de que existiera una fuente única
    de verdad — interpretarlo al pie de la letra sería imposible (el string tiene que
    vivir en algún lado). Si el PM quiere el grep literal en 0 sin excepciones, dímelo y
    lo resolvemos de otra forma (ej. derivar el string de otra constante ofuscada, lo
    cual sería peor).

### D06c — descripciones del MCP generadas desde el enum

- `mcp.js:38,65,103` (los mismos 3 sitios que marcaba 07 §1.4): las descripciones de
  `farmazed_list_cases`, `farmazed_list_documents` y `farmazed_update_case` ahora usan
  `` `...${CASE_STATUSES.join('|')}` `` / `DOC_STATUSES.join('|')` en vez de texto
  literal.
- **Encontré y corregí un hueco no anticipado por 07:** `GET /mcp` (el endpoint de
  discovery del plugin) devolvía solo `{name, description}` por tool — el
  `inputSchema` (donde vive el enum) nunca se exponía ahí, solo en `tools/list`. Sin
  este fix, el criterio de aceptación de D06c ("GET /mcp muestra los 18 valores") era
  imposible de cumplir literalmente. Cambié `GET /mcp` para incluir también
  `inputSchema`.
- Verificado: `GET /mcp` → `farmazed_list_cases.inputSchema.properties.status.description`
  lista los 18 valores exactos. Prueba de "agregar un estado no rompe mcp.js": agregué
  temporalmente un valor de prueba a `CASE_STATUSES`, reinicié el tracker, apareció en
  `GET /mcp` sin tocar `mcp.js`, y revertí el cambio.

### D07 — `tracker/scripts/migrate_status.js` (nuevo)

**Mapeo PROVISIONAL — ver cabecera del archivo, no confirmado por Rick.** 07 §1.3b es
explícito: la tabla real necesita un conteo de valores distintos en el `cases` de
producción (mismo acceso de lectura que D08, que esta tarea no tiene). Lo que sí se
puede afirmar sin ese acceso:
- `draft`, `submitted`, `pending_docs`, `deleted` — sin cambio de nombre, ya están en el
  enum de 18 tal cual.
- `in_review`→`fase_03`, `faddi_ready`→`fase_06`, `faddi_submitted`→`fase_08`,
  `observed`→`fase_11`, `approved`→`fase_14` — **provisional**, basado en la agrupación
  de 4 fases ya aprobada (sesión 2026-08-26) más los anclajes confirmados (`fase_07/10/12`
  control manual, `fase_13` verificación de saldo — R18).
- **`denied` NO tiene mapeo — decisión pendiente del PM.** El enum de 18 que pidió esta
  tarea no incluye ningún estado terminal de "rechazado". Migrar `denied` sin que
  alguien decida su destino (¿queda fuera del enum como estado 19? ¿se mapea a
  `deleted`? ¿a alguna fase terminal?) sería inventar una regla de negocio que no me
  corresponde. El script detecta casos `denied`, los reporta, y **no los toca** — no
  crashea el resto de la migración por esto.
- Un valor de `status` que no esté ni en el enum de 18 ni en la tabla de mapeo hace que
  el script **falle en voz alta y no escriba nada** (ni siquiera los casos que sí sabía
  migrar) — verificado sembrando un caso con `status:'foobar123'`: exit code 1, mensaje
  claro, cero escrituras.
- **Solo corre contra el emulador** — se niega si falta `FIRESTORE_EMULATOR_HOST`,
  verificado. No se corrió ni se intentó correr contra producción.
- **Probado en el emulador** sembrando los 9 valores legacy (los 3 del seed normal +
  6 adicionales creados directo en Firestore para esta prueba: `submitted`,
  `pending_docs`, `deleted`, `faddi_ready`, `faddi_submitted`, `observed`) más un caso
  `denied` y uno con valor basura:
  - 1ª corrida: migró los 5 que necesitaban remapeo, reconoció los 4 sin cambio,
    reportó el `denied` sin tocarlo.
  - 2ª corrida (sin sembrar nada nuevo): **"Nada que migrar" — 0 cambios.** Idempotencia
    confirmada.
  - Con el caso basura presente: falla con exit code 1, no escribe nada; borrado el caso
    de prueba, la migración volvió a correr limpia.

### Pendiente para el PM/Rick

1. **Decidir el destino de `denied`** en el enum de 18 (ver arriba) — bloquea que D07
   pueda migrar el 100% de los casos reales.
2. **Confirmar o corregir el mapeo provisional** de `in_review`/`faddi_ready`/
   `faddi_submitted`/`observed`/`approved` a fases concretas — necesita el conteo real
   de Firestore (mismo acceso que D08).
3. Si el criterio literal `grep -rn "'pending_docs'" tracker/` → 0 (sin excepciones) es
   importante tal cual está escrito en 07 §4#8, decírmelo — hoy da 2 (la fuente única de
   verdad en `case_status.js`).

## 2026-09-29 — TAREA 7b: enum de 21 estados, etiquetas reales, máquina de transiciones (PM_COMMENTS §H.1)

Decisiones del PM en §H.1 (SVG canónico de Zelky) resueltas. **Sin commit, sin deploy,
sin tocar Firestore de producción en ninguna forma** (ni lectura — el conteo real sigue
pendiente de Rick).

### `tracker/data/case_status.js` — 21 estados

- **14 etiquetas reales** (antes `null`): Contacto inicial por la web, Captación de
  datos del cliente, Vía de registro y categoría, Cotización del servicio, Pago de
  honorarios, Expediente interno (CRM), Documentación digital, Paquete IEA y revisión
  legal, Revisión del expediente, Cotejo con matrices guía, Originales por DHL,
  Verificación física, Pago de honorarios Farmazed, Dossier y presentación.
- **+3 estados post-presentación**: `observado_dnfd` (no terminal — puede volver a
  fase_07/fase_10), `aprobado` y `denegado` (terminales). `CASE_STATUSES.length` → **21**,
  sin repetidos (verificado).
- **`TRANSITIONS` + `isValidTransition(from, to)`** (nuevo): avance secuencial
  fase_01→...→fase_14; subsanación fase_10→fase_07, fase_12→fase_11,
  observado_dnfd→fase_07|fase_10; fase_14→{observado_dnfd, aprobado, denegado}.
  `pending_docs`/`deleted` son "interrupciones" — se puede entrar desde cualquier
  estado, y desde `pending_docs` se puede volver a cualquiera (no hay dónde guardar "a
  qué fase volver" sin la subcolección de actividad de Gap 5, que sigue pospuesta).
  `aprobado`/`denegado` sin salida.

### Validación de transición + `override` en las 3 rutas de escritura

- `cases.js` (`PATCH /:id`), `mcp.js` (`handleUpdateCase`): antes de escribir, comparan
  el `status` nuevo contra el actual con `isValidTransition()`. Salto inválido → **400**
  (cases.js) / **-32000** (mcp.js) con el mensaje `"X" -> "Y"` y la instrucción de usar
  `override:true`. En cases.js el override solo lo puede activar un admin (un cliente
  nunca llega a este punto con un status fuera de `'submitted'`, ya estaba así); en
  mcp.js el `MCP_KEY` ya es acceso de nivel admin, no hay usuario individual en esa capa.
- **Nuevo: subcolección `cases/{id}/statusHistory`.** Cada cambio de `status` (válido,
  por subsanación, o forzado con override) escribe un documento `{from, to, override,
  by, byEmail, at}`. Se agregó también a `documents.js`/`mcp.js` en el punto donde se
  fuerza `pending_docs` (siempre válido por diseño, pero se audita igual, por
  consistencia con las otras dos rutas). Esto NO es el Gap 5 completo (actividad
  general, pospuesto en 2026-08-26) — es un log angosto, solo para transiciones de
  status, construido porque esta tarea explícitamente pidió que el override "quede
  registrado en el historial del caso".
- **Verificado en vivo contra el emulador** (tracker + Auth emulator + Firestore
  emulator, con casos reales creados vía Admin SDK):
  - `fase_09`→`fase_10` (secuencial) → 200, historial `override:false`.
  - `fase_10`→`fase_07` (subsanación) → 200, historial `override:false`.
  - `fase_07`→`fase_12` (salto inválido) sin `override` → 400; con `override:true` →
    200, historial `override:true`.
  - Cliente: caso nuevo (`draft`) → `PATCH {"status":"submitted"}` → 200 (sin cambio de
    comportamiento).
  - MCP: `fase_02`→`fase_14` sin `override` → `-32000` con el mensaje; con
    `override:true` → éxito, historial `by:"mcp"`.
  - `POST /api/cases/:id/documents/request` (admin) → `pending_docs`, y quedó
    registrado en `statusHistory` (`fase_14 -> pending_docs`).

### `tracker/scripts/migrate_status.js` — mapeo actualizado

Confirmado (ya no provisional, §H.1): `denied`→`denegado`, `approved`→`aprobado`,
`observed`→`observado_dnfd`, `faddi_submitted`→`fase_14` (el SVG de Zelky ubica
"enviado a FADDI" en la última fase, no en una intermedia como se había estimado
antes de leer el SVG). Siguen **provisionales**: `in_review`→`fase_03`,
`faddi_ready`→`fase_06` — pendientes del conteo real de Firestore (Rick).

Probado en el emulador con los 9 valores legacy + `denied`:
- 1ª corrida: migró los 6 que necesitaban remapeo (incluido `denied`→`denegado`,
  antes bloqueado como "sin destino"), reconoció los 4 sin cambio.
- 2ª corrida: **"Nada que migrar" — 0 cambios.** Idempotencia confirmada de nuevo con
  el mapeo nuevo.
- No se tocó ni se intentó leer el Firestore de producción en ningún momento de esta
  tarea.

### Pendiente para el PM/Rick

Solo queda el conteo real de Firestore de producción para confirmar
`in_review`/`faddi_ready` — todo lo demás de §H.1 quedó implementado y probado.

## 2026-09-29 — TAREA 8: D18 (admin) + D19 (cliente) sobre el enum de 21 estados

**Sin commit, sin deploy.** ⚠️ **Bloqueo real: no pude hacer la prueba visual en
navegador con Claude en Chrome — esa herramienta no está conectada en esta sesión**
(`ToolSearch` no encontró ningún `mcp__claude-in-chrome__*`, ni el `enable__...`). Hice
en su lugar una verificación funcional completa a nivel de API/protocolo, contra el
emulador, ejecutando exactamente las mismas llamadas que la UI hace — ver el detalle en
"Verificación" más abajo — pero **no hay capturas de pantalla reales**, porque no había
navegador que capturar. No las inventé. Si Rick/el PM tienen una sesión con Chrome
conectado, o quieren que lo intente en otra sesión de Claude Code, avísenme.

### (a) Backend — `GET /api/meta/statuses` (nuevo, `tracker/routes/meta.js`)

Expone `CASE_STATUSES`, `CASE_STATUS_META` (label+manual), `manual`, `terminal`,
`postPresentacion`, `TRANSITIONS`, `DOC_STATUSES` — público, sin auth (es la misma
info que ya vive en `case_status.js`, nada sensible). El frontend lee esto en vez de
repetir la lista de estados. También agregué `GET /api/cases/:id/history` en
`cases.js` (mismo control de acceso admin/cliente que el resto) para exponer
`cases/{id}/statusHistory` (la subcolección de auditoría de TAREA 7b).

`tracker/routes/cases.js` y `tracker/routes/mcp.js`: agregado soporte para `reason`
(motivo del override) — se guarda en `statusHistory.reason` solo cuando
`override:true` y la transición no era válida por sí sola; en cualquier otro caso
queda `null`.

### (b) D18 — `farmazed-web/admin/casos.html` + `expediente.html`

Nuevo módulo compartido **`farmazed-web/portal/js/status_ui.js`** — única fuente de
presentación (colores Bootstrap por estado, íconos de estado de documento). Todo lo
demás (labels, transiciones, manual/terminal) viene de `GET /api/meta/statuses`, nunca
repetido como literal.

- `casos.html`: quitadas las 8 clases CSS `.badge-<estado>` y los mapas `BADGE`/`LABEL`
  hardcodeados. Badges/labels ahora salen de `status_ui.js`. Contadores rediseñados
  (ya no tienen sentido los 4 viejos "en_review/faddi_ready/faddi_submitted/approved"):
  Total, Control manual, Docs Pendientes, Post-presentación, Aprobados. Chips de
  filtro generados dinámicamente por cada estado que efectivamente aparece en los
  casos cargados (con 21 estados posibles, chips vacíos para todos sería ruido).
- `expediente.html`:
  - El `<select>` de estado ya no es una lista fija de 7 — se construye con
    `GET /api/meta/statuses`: solo el estado actual + las transiciones válidas desde
    ahí (`TRANSITIONS[status_actual]`). Con el checkbox "Forzar (override)" marcado,
    se repuebla con los 21 estados completos.
  - **Override con motivo obligatorio**: al marcar el checkbox aparece un campo de
    texto; sin motivo, el botón de guardar rechaza el submit antes de llamar a la API.
  - **Confirmación explícita en fase_07/10/12**: si el estado ACTUAL del caso es una
    fase manual y se intenta cambiarlo, un `confirm()` pide verificar
    ("Verifique: <label de la fase>. ¿Confirma el avance a...?") antes de guardar.
  - **Historial de estado**: nueva tarjeta que lista `cases/{id}/statusHistory`
    (from→to, override, motivo si aplica, quién y cuándo).
  - Iconos/colores de estado de documento (antes hardcodeados en dos objetos
    inline) ahora vienen de `status_ui.js` (`getDocStatusIcon`/`getDocStatusColor`).

### (c) D19 — `farmazed-web/client-dashboard.html`

`STATUS_PHASE` (antes 9 entradas) remapeado a las 21, conservando el flag
`bloqueado`. Agrupación en las 4 fases visuales del pipeline existente (no se rediseñó
el pipeline de 4 puntos — eso sería un cambio de diseño mayor no pedido): 1
Diagnóstico = draft+fase_01-03; 2 Revisión = submitted+fase_04-07; 3 Elaboración =
fase_08-10; 4 Obtención = fase_11-14 + los 3 post-presentación. `pending_docs` ancla a
fase 2 igual que antes (no hay forma de saber a qué fase real volver sin la
subcolección de actividad de Gap 5, pospuesta).

**"El cliente ve la fase con su nombre real"**: nueva función `claroTextFor(status,
label)` — para las 14 fases y draft/submitted/pending_docs usa el label real del enum
(`GET /api/meta/statuses`, no un texto duplicado); para los 3 post-presentación da
texto claro específico: "DNFD solicitó correcciones" / "¡Registro aprobado!" /
"Registro denegado". Se renderiza debajo del pipeline de 4 puntos en cada tarjeta de
producto.

`estadoFromStatus()` y `fases_completadas` actualizados de `approved`/`denied` a
`aprobado`/`denegado`. Verificado por grep: **cero** literales `'approved'`/`'denied'`/
`'observed'`/`'in_review'`/`'faddi_ready'`/`'faddi_submitted'` restantes en el archivo.

### Verificación (nivel API/protocolo, sin navegador — ver bloqueo arriba)

Contra el emulador (tracker + Auth + Firestore), con un caso sembrado en `fase_06`:
- `PATCH status:fase_07` → 200 (06→07).
- `GET /api/meta/statuses` → `transitions.fase_07 = ['fase_08']` — confirmado que
  `fase_09` **no** estaría entre las opciones del `<select>` en ese estado.
- `PATCH status:fase_09` directo (saltándose la UI) → **400**, confirmando que el
  backend también lo rechaza si alguien lo intenta fuera del `<select>`.
- Avance real 07→08→09→10, luego subsanación **10→07** → 200 en los 5 pasos.
- `GET /api/cases/:id/history` → los 5 pasos en orden, incluyendo la subsanación.
- Como cliente (`GET /api/cases`): el caso muestra `status: fase_07` — confirma que
  el cliente vería el cambio reflejado (el label "Documentación digital" y el texto
  claro salen del mismo `GET /api/meta/statuses` ya verificado en TAREA 7b).

### Grep de literales sueltos (organizacion/inventario_estados.txt)

Repetido el grep de D-INV sobre los 3 archivos tocados + `status_ui.js`. Lo que queda:
- **Único uso legítimo de un solo estado** (contadores/filtros específicos:
  `'pending_docs'`, `'aprobado'`, `'missing'` como default) — no son mapas duplicados,
  son referencias puntuales a un estado con sentido propio.
- **Los mapas canónicos esperados**: `status_ui.js` (colores, íconos de doc),
  `client-dashboard.html`'s `STATUS_PHASE`/`claroTextFor`/`ESTADO_MAP`/`estadoBadge`/
  `docBadge` (cada uno es SU mapa único para su propia decisión de presentación, no
  una copia de otro).
- **`portal/js/wizard.js` NO se tocó** — está fuera del alcance de D18/D19 (solo
  `casos.html`/`expediente.html`/`client-dashboard.html`) y sigue siendo código
  huérfano desde el pivote de arquitectura de 2026-08-26 (Gap 7, aún sin portar).
  Conserva sus literales viejos, incluido `pending_upload` (ya decidido eliminar en
  D05b, pero solo del enum del backend — el frontend orgánico de wizard.js no se
  edita hasta que se porte).

### Estado de archivos

Nuevos: `tracker/routes/meta.js`, `farmazed-web/portal/js/status_ui.js`. Modificados:
`tracker/data/case_status.js` (agregado `POST_PRESENTACION` a los exports),
`tracker/index.js` (monta `meta.js`), `tracker/routes/cases.js` (`GET .../history` +
`reason`), `tracker/routes/mcp.js` (`reason`), `farmazed-web/admin/casos.html`,
`farmazed-web/admin/expediente.html`, `farmazed-web/client-dashboard.html`,
`farmazed-web/portal/js/api.js` (`getCaseHistory`, `getStatusMeta`). Todo sin
commitear. Servicios de prueba (tracker, emuladores, servidor estático) detenidos al
terminar, puertos liberados. `config.js` quedó revertido a su puerto documentado
(8080) tras el cambio temporal a 8081 usado solo para esta prueba (8080 seguía
ocupado por un proceso ajeno de esta máquina).

## 2026-09-29 — TAREA 8 (ajuste): prueba visual real con Playwright — `e2e/`

Rick señaló que Patch ya tiene el Chromium de Playwright cacheado en
`~/.cache/ms-playwright` (`chromium-1243`) — se pudo hacer la prueba visual real que
TAREA 8 pedía. **Sin commit, sin deploy.** Carpeta nueva `e2e/` (paquete npm propio,
separado de `tracker/`, no se despliega):

- **`e2e/estados.spec.js`** — recorrido completo en un Chromium real contra el
  emulador: login admin → expediente de un caso en `fase_06` (llegado ahí clicando
  desde `casos.html`, no por URL directa) → avanzar 06→07 → confirmar que desde
  fase_07 el `<select>` NO ofrece `fase_09` (solo `fase_08`, verificado leyendo las
  `<option>` reales del DOM) → 07→08 (con la confirmación de fase manual, aceptada
  automáticamente — ver abajo) → 08→09→10 → subsanación 10→07 (confirmación de nuevo)
  → override sin motivo intentando un salto inválido (`fase_14`) → verificado que
  **no se guardó nada** (reload + el estado sigue en fase_07) → historial de estado
  visible con las 5 transiciones correctas → logout admin → login cliente →
  `client-dashboard.html` → el cliente ve "Documentación digital" en su tarjeta de
  producto.
- **`e2e/global-setup.js`** — resetea el caso de prueba a `fase_06` y limpia su
  `statusHistory` antes de cada corrida (spec repetible).
- **`e2e/playwright.config.js`** — Chromium únicamente, `baseURL` apuntando al
  servidor estático.
- **`e2e/run.sh`** — script reutilizable de un solo comando: levanta emuladores +
  siembra + tracker + frontend estático, corre Playwright, y apaga todo al salir
  (pase o falle). Maneja el mismo problema de siempre en esta máquina (puerto 8080
  ocupado por un proceso ajeno) apuntando `config.js` al puerto libre temporalmente y
  **restaurándolo siempre**, incluso si el test falla (`trap cleanup EXIT`).
- **`page.on('dialog', d => d.accept())`**: la UI de `expediente.html` usa
  `alert()`/`confirm()` nativos (ya existían antes de TAREA 8, más el `confirm()`
  nuevo de fase manual) — Playwright los maneja de forma nativa con un listener, sin
  necesidad de JavaScript injection ni trucos. Un solo listener por test cubre las 7
  veces que aparecen a lo largo del recorrido (confirmaciones de avance + alerts de
  "Estado actualizado"/"El override necesita un motivo").
- **Bugs reales encontrados y corregidos gracias a la prueba real** (no hubiera
  aparecido con la verificación por curl de la corrida anterior):
  1. `run.sh`: el `cleanup()` usaba una ruta relativa a `config.js` — al terminar
     desde dentro de `e2e/` (por el `cd e2e` antes de correr Playwright), la
     restauración fallaba en silencio y dejaba `config.js` apuntando al puerto
     temporal. Corregido con rutas absolutas basadas en `$REPO_ROOT`.
  2. `run.sh`: matar solo el PID de `npx firebase-tools emulators:start` dejaba
     huérfanos los procesos `java` de Firestore/Storage (hijos independientes, no
     mueren con el padre) — la siguiente corrida encontraba los puertos ocupados.
     Corregido agregando `pkill -f` por los tres patrones de proceso.
  3. `estados.spec.js` (bug de la prueba, no del producto): un `getByText('Mis
     Productos')` y un `getByText('Analgen Test Visual')` eran ambiguos (coincidían
     con el link del sidebar, un `<h4>`, y con el nombre del caso repetido en el
     módulo de Mensajes) — acotados con selectores CSS más específicos.
  4. **Hallazgo real de timing, no de la app**: una captura tomada justo después de
     guardar un cambio de estado llegaba antes de que `renderStatusHistory()`
     terminara su fetch async, mostrando "Sin cambios de estado todavía" un instante
     desactualizado. Agregado un `waitForHistoryCount()` antes de cada captura para
     que refleje el estado real. La UI en sí nunca tuvo el bug — solo la prueba
     necesitaba esperar correctamente.
- **Nada de la UI en sí necesitó arreglo** — los 21 estados, las transiciones, el
  override, y el historial funcionaron correctamente a la primera en un navegador
  real.

**Capturas — `sessions/2026-09-29/`** (9 archivos, un paso cada una):
`01-admin-login-ok.png`, `02-expediente-fase06.png`, `03-fase07.png`,
`04-fase08-tras-confirmacion.png`, `05-fase10.png`, `06-subsanacion-fase07.png`,
`07-override-sin-motivo-bloqueado.png`, `08-historial-visible.png`,
`09-cliente-ve-fase-real.png`.

**Observación menor (no es bug, no se tocó):** los casos seed legacy sin migrar
(`seed-case-approved` con `status:'approved'`, `seed-case-in-review` con
`status:'in_review'`) se ven en el dashboard del cliente como "Fase actual: approved"
/ "Fase actual: in_review" — el fallback de `claroTextFor()` muestra el status crudo
cuando no está en el enum de 21 porque son datos *deliberadamente* pre-migración (para
probar D07). Después de correr `migrate_status.js` se verían con su nombre real. No es
un `undefined` en pantalla (cumple el criterio de 07 §4#11), solo se ve "crudo" porque
el dato de prueba es crudo a propósito.

**Aceptación cumplida:** el spec pasa en verde (`1 passed`), las 9 capturas existen y
se revisaron visualmente (contenido correcto, sin `undefined`, historial y selects
consistentes con lo esperado en cada paso).

## 2026-09-29 — TAREA 8: 3 ajustes de Rick sobre la prueba visual

Rick miró las capturas y pidió 3 cambios puntuales. **Sin commit, sin deploy.**

### (1) Captura de cliente ilegible a 1280px — causa real, no cosmética

El sidebar es del template vendored (`src/approx/`, `startbar`). Su propio
`app.js` colapsa el sidebar a un riel de íconos (105px) entre 310–1440px de
ancho, pero lo **expande a 270px en `:hover`** (flyout) — un patrón normal de
UI. El bug estaba en mi prueba: el `click()` sobre el link "Mis Productos"
(dentro del sidebar) deja el mouse virtual de Playwright posado justo ahí, y
la captura se tomó con el sidebar en su estado flyout expandido tapando el
contenido. **La UI nunca tuvo el bug** — un usuario real mueve el mouse.
Arreglado en `estados.spec.js`: `page.mouse.move(...)` a un punto del
contenido antes de cada captura del dashboard cliente. Se agregaron además
capturas a **1440px y 390px** (móvil) — ambas se ven correctas: a 1440 el
sidebar sigue en modo riel (el breakpoint del template es inclusivo hasta
1440), y a 390 el sidebar se oculta fuera de pantalla por su propio media
query existente (`@media max-width:767.98px`), sin overlap en ningún caso.

### (2) Fallback neutro para estados sin migrar (no mentirle al cliente)

Antes: un caso con `status` fuera del enum de 21 (legacy, sin migrar — ej.
`approved`, `in_review` de los datos de seed) caía en `{ fase: 1 }` en
`client-dashboard.html`, mostrando "1 Diagnóstico / En trámite" — **le
mentiría a un cliente en realidad aprobado.**

- `client-dashboard.html`: `claroTextFor()` y `estadoFromStatus()` ahora
  chequean `statusMeta.statuses.includes(status)` primero. Si no está en el
  enum: texto **"Estado en actualización"**, badge **`sin_migrar`** (gris,
  `fz-badge-gray`), `console.warn()` con el status crudo, y el fallback de
  `STATUS_PHASE` cambió de `{fase:1}` a **`{fase:0}`** — `0` no coincide con
  ningún dot del pipeline (1–4), así que **ningún hito queda marcado** (ni
  activo ni completado), en vez de simular falsamente "recién empezado".
- `farmazed-web/admin/casos.html`: mismo criterio. `colorForCaseStatus()` en
  **`status_ui.js`** (la fuente única de color, usada también por
  `expediente.html`) ahora devuelve `secondary` (gris) para cualquier status
  fuera del enum de 21, antes de cualquier otro chequeo — antes caía en el
  `info` azul genérico, indistinguible de una fase real. El label muestra
  `"<status crudo> (sin migrar)"` (ej. `"approved (sin migrar)"`) y se
  emite `console.warn()` por cada caso sin migrar que aparece en la tabla.
- **Verificado en el spec** (paso nuevo): la tabla de `casos.html` muestra
  `seed-case-approved` con badge gris `bg-secondary` + texto "sin migrar",
  y se capturó el `console.warn` correspondiente vía
  `page.on('console', ...)`. En el dashboard del cliente, los 2 casos
  legacy (`approved` e `in_review`) muestran "Estado en actualización" (4
  coincidencias: label + badge × 2 casos) y sus 2 `console.warn`
  respectivos, verificados igual.

### (3) `run.sh` ya NO edita `config.js` — ni temporalmente

Antes: `run.sh` hacía backup + `sed` + restore de `config.js` para apuntar
el tracker a un puerto libre cuando 8080 está ocupado (pasa siempre en esta
máquina). Si el script se cortaba a mitad (Ctrl-C, crash), el restore nunca
corría y `config.js` quedaba modificado en el árbol de trabajo — commiteable
o desplegable por error.

**Solución (opción de Rick: localStorage, no abortar):**
`farmazed-web/portal/js/config.js` ahora resuelve el puerto local con
`localApiPort()`: primero `?apiPort=` en la URL, si no, `localStorage`, si no,
el default `'8080'` de siempre — **nunca cambia el comportamiento en
producción** (la rama solo corre dentro de `IS_LOCAL`, y en prod
`API_BASE` sigue siendo el string fijo de `api.farmazed.com`, sin tocar
`localStorage` en absoluto). `estados.spec.js` usa
`page.addInitScript()` en `beforeEach` para poner `fzApiPort` en
`localStorage` antes de CADA carga de página del test (sobrevive a los
redirects internos de `login.html`) — `run.sh` ya no toca ningún archivo
fuente, solo pasa `FZ_API_PORT` como variable de entorno a Playwright.

**Verificado exactamente como pidió el criterio de aceptación:**
- `git diff config.js` después de correr `./e2e/run.sh estados.spec.js`
  completo → solo el diff legítimo de esta función, sin rastro del puerto
  temporal.
- `md5sum` de `config.js` antes de correr, y de nuevo tras cortar `run.sh`
  a mitad (con `timeout 8s`, mientras los emuladores seguían arrancando) →
  **idéntico**. El `trap cleanup EXIT` mata los procesos igual, sin haber
  tocado ningún archivo fuente que restaurar.

### Capturas finales — `sessions/2026-09-29/` (13 archivos)

`01-admin-login-ok`, `02-expediente-fase06`, `03-fase07`,
`04-fase08-tras-confirmacion`, `05-fase10`, `06-subsanacion-fase07`,
`07-override-sin-motivo-bloqueado`, `08-historial-visible`,
`09-admin-sin-migrar-gris` (nueva), `10-cliente-ve-fase-real-1280` (nueva),
`11-cliente-ve-fase-real-1440` (nueva), `12-cliente-ve-fase-real-390`
(nueva), `13-cliente-sin-migrar-neutro` (nueva). Las 4 primeras del cliente
se revisaron visualmente una por una — todas legibles, sin overlap, sin
`undefined`.

### Observación aparte, no pedida, no tocada

En la captura del admin (`09-admin-sin-migrar-gris.png`) la columna
"Actualizado" muestra "Invalid Date" en las 4 filas — parece que
`c.updatedAt` llega como Timestamp de Firestore (`{_seconds,...}`), no como
string parseable por `new Date()`, en `casos.html`. Es un bug preexistente,
no relacionado con los 3 ajustes de esta tarea — no lo toqué. Si quieren que
lo arregle, decírmelo como tarea aparte.

## 2026-09-29 — TAREA 9: D10 (responsable) + D11 (UI cliente/Farmazed) + bug de fechas

**Sin commit, sin deploy.**

### (a) D10 — `tracker/data/faddi_checklists.js`

`responsable` (`'cliente'`\|`'farmazed'`) en **todos** los documentos de **todos** los
trámites y subtipos — no se anotó a mano en cada uno de los ~80 literales (mucha
superficie de error si alguien agrega un doc y se olvida). En vez de eso: un
`FARMAZED_DOC_IDS = new Set(['tasa_servicio','recibo_iea','recibo_cnf'])`, y
`getChecklist()` ahora arma `docs` internamente (los `return` tempranos de cada `case`
del switch pasaron a `docs = ...; break;`) y hace **un solo** `.map()` final que le
pone `responsable` a cada documento antes de devolverlo. Cualquier documento nuevo que
se agregue después nace `'cliente'` automáticamente, sin tocar esta función.

Verificado con `node -e`: para **los 6 trámites** + **los 11 subtipos de
medicamentos** (con y sin `tipoRegistro:'Abreviado'`) → **0** documentos sin
`responsable` en total. Para medicamentos, `tasa_servicio`/`recibo_iea`/`recibo_cnf`
traen `"farmazed"`, el resto `"cliente"`.

### (b) D11 — identificación de la pantalla real + implementación

**La pantalla real NO es la que 03_INSTRUCCIONES_DEV.md asume muerta.** Antes de tocar
nada, grep para confirmar: `farmazed-web/client-dashboard.html:1614` tiene
`<script type="module" src="portal/js/wizard.js"></script>`, y el HTML del módulo
"Solicitar Registro" (línea ~646, comentario "Wizard real — Gap 7") tiene la misma
estructura/IDs que `wizard.js` espera. **`wizard.js` está vivo, cargado directamente
por `client-dashboard.html`** — mi nota de TAREA 6 (basada en el handover de
2026-08-26, antes de que alguien completara el Gap 7 portándolo así) estaba
desactualizada. Corrijo el registro: D11 se implementó en `portal/js/wizard.js`, que
es exactamente donde decía 03_INSTRUCCIONES_DEV.md — el archivo nunca estuvo muerto,
solo lo estaba el `portal/nuevo.html` standalone (que sigue existiendo como referencia,
sin tocar, según pidió el PM).

Cambios en `wizard.js`:
- `renderChecklist()`: separa por `responsable`, no por obligatorio/opcional (esa
  distinción se sigue viendo en el badge de cada tarjeta) — dos secciones:
  **"Documentos que subes tú"** y **"Documentos que aporta Farmazed"**.
- `renderDocCard()`: un doc `responsable:'farmazed'` no tiene botón de subir — badge
  "A cargo de Farmazed" + leyenda "no necesitas subirlo tú, y no bloquea tu avance".
- **Nueva `updateNextButtonState()`**: deshabilita `#btn-next` en el Paso 4 solo si
  faltan documentos obligatorios de `responsable:'cliente'`. Se llama al terminar
  `renderChecklist()` y de nuevo al final del `finally` de `nextStep()` — necesario
  porque `setLoading(btn,false)` (ya existía) **siempre** rehabilita el botón sin
  saber nada de documentos, así que sin este segundo llamado el gate se deshacía solo
  en cada click.
- Guard defensivo en `nextStep()` (paso 4): revalida `missingCliente` antes de avanzar,
  por si el botón se reactiva por fuera (devtools, estado viejo).

Cambios en `admin/expediente.html`: un doc `responsable:'farmazed'` sin subir muestra
badge **"Tarea interna Farmazed"** + **"Pendiente (interno)"** en vez del botón
"Solicitar" (pedirle al cliente algo que es tarea de Farmazed no tiene sentido). Los
docs opcionales del cliente sin subir conservan su "Solicitar" normal.

**Hallazgo aparte, no relacionado con D10/D11, no tocado:** al escribir el spec
encontré que `renderStep2()` (la función que rellena los checkboxes de
`tipoMedicamento` y otros campos dinámicos del Paso 2) **solo se llama desde
`prevStep()`, nunca desde el avance normal `nextStep()` 1→2**. Resultado: hoy, un
cliente que avanza 1→2→3→4 en línea recta (el camino normal) nunca ve pobladas las
casillas de subtipo de medicamento — solo se rellenan si retrocede de 3 a 2 y vuelve a
avanzar. No lo arreglé (fuera del alcance de esta tarea, y toca navegación del wizard,
no D10/D11) — lo marco aquí porque es un bug real que probablemente afecta a clientes
reales hoy. Avísenme si quieren que lo arregle como tarea aparte.

### (c) Bug "Invalid Date" — serialización de Timestamps

Causa: `res.json({ ...data })` en varias rutas mandaba el Timestamp de Firestore crudo
(`{_seconds, _nanoseconds}`); `new Date(...)` del lado del cliente no sabe parsear eso.
Antes se arreglaba a mano, campo por campo, en algunos endpoints sí y en otros no (de
ahí que solo "Actualizado" en `casos.html` lo sufriera visiblemente, pero el mismo
problema existía silencioso en más lugares).

**Arreglado en el backend, de raíz — nuevo `tracker/utils/serialize.js`**:
`serializeTimestamps(value)` recorre el objeto completo (incluye anidados como
`faddi.submittedAt`) y convierte cualquier Timestamp a ISO string. Aplicado en
**todos** los `res.json(...)` de `cases.js` y `documents.js` que puedan traer un
Timestamp (list/create/get/update/history en cases.js; list/create/get/patch en
documents.js), y en el resultado que `mcp.js` le manda a Claude Cowork (antes de
`JSON.stringify`). Los `.toDate?.()?.toISOString()` manuales que ya existían en un par
de sitios se reemplazaron por la función genérica — menos repetido, mismo resultado.

El frontend no necesitó cambios: `client-dashboard.html`'s `tsToISODate()` ya manejaba
`typeof ts === 'string'` como caso válido (lo tenía por si acaso); ahora es el caso que
siempre ocurre. `casos.html`'s `new Date(c.updatedAt)` ahora recibe un ISO string real.

### Verificación (Playwright, capturas nuevas en `sessions/2026-09-29/`)

**Nuevo spec `e2e/checklist.spec.js`** (spec separado, sigue el patrón "un spec por
flujo" para D16): cliente crea un caso de medicamentos real por la UI, llega al Paso 4,
verifica las 2 secciones y que el botón está deshabilitado; sube 2 documentos reales
vía `input[type=file]` (multipart real contra el Storage emulator); completa el resto
de los documentos obligatorios del cliente directo en Firestore (11 uploads reales por
UI hubiera sido mucho para un solo spec — el mecanismo de upload ya se prueba con los
2 primeros); recarga y confirma que el botón se **habilita** aunque los 2 documentos de
Farmazed sigan sin subir; hace logout y entra como admin a ese mismo expediente,
confirma que ambos aparecen como "Tarea interna Farmazed" / "Pendiente (interno)", sin
botón "Solicitar". **Pasa en verde**, junto con `estados.spec.js` (subí el timeout
global de Playwright de 30s a 45s: corriendo los dos specs juntos, el emulador
acumula más datos y algunas recargas de página tardan un poco más).

Capturas: `01-checklist-01-bloqueado-faltan-docs-cliente.png` (las 2 secciones, botón
gris), `02-checklist-02-habilitado-solo-faltan-farmazed.png` (botón azul, los 2
Farmazed siguen pendientes), `03-checklist-03-admin-tarea-interna.png` (admin, 13/18
docs, los 2 de Farmazed con su badge). Las 13 capturas de `estados.spec.js` se
regeneraron en la misma corrida — `09-admin-sin-migrar-gris.png` confirma visualmente
el bug de fechas resuelto ("29-sept"/"27-sept" en vez de "Invalid Date").

### Estado de archivos

Nuevos: `tracker/utils/serialize.js`, `e2e/checklist.spec.js`. Modificados:
`tracker/data/faddi_checklists.js` (D10), `tracker/routes/cases.js` /
`tracker/routes/documents.js` / `tracker/routes/mcp.js` (serializeTimestamps),
`farmazed-web/portal/js/wizard.js` (D11), `farmazed-web/admin/expediente.html` (D11
admin), `e2e/playwright.config.js` (timeout), `e2e/estados.spec.js` (wait extra tras
reload). Todo sin commitear. Servicios de prueba detenidos, puertos liberados,
`config.js` sin tocar (confirmado de nuevo con `git diff` — 0 coincidencias de "8081").

## 2026-09-29 — TAREA 10: fix de renderStep2() + D13 (desglose honorarios/tasas)

**Sin commit, sin deploy.** 4 specs de Playwright en verde juntos (`checklist`, `estados`,
`pricing` — nuevo — corridos con `./e2e/run.sh`).

### (a) Bug real corregido — `portal/js/wizard.js`

Confirmado el diagnóstico de TAREA 9: en `nextStep()`, después de `showStep(state.step +
1)` había `if (state.step === 4) await renderChecklist();` y
`if (state.step === 5) await renderConfirmation();` pero **ningún** `if (state.step ===
2) renderStep2()`. `renderStep2()` solo se llamaba desde `prevStep()`. Arreglado con una
línea: `if (state.step === 2) renderStep2();` en el mismo bloque. Ahora las casillas de
`tipoMedicamento` (y el resto de los campos dinámicos del Paso 2: condición de venta,
tipo de publicidad, etc.) se pueblan también al avanzar 1→2 en línea recta, no solo al
retroceder y volver a avanzar.

**Verificado con un recorrido 1→2→3→4 en línea recta** (spec reescrito,
`e2e/checklist.spec.js`): captura del Paso 2 mostrando las 9 casillas de subtipo de
medicamento visibles y clicables sin haber retrocedido nunca; se marca "Síntesis
Química"; en el Paso 4 se confirma que el checklist **corresponde al subtipo elegido**
— aparecen `muestra` y `metodo_analisis` (obligatorios, `responsable:'cliente'`) y
`recibo_iea` (obligatorio, `responsable:'farmazed'`), los 3 exclusivos de ese subtipo
(`MED_VARIABLE_BY_SUBTYPE['Síntesis Química']` en `faddi_checklists.js`) — si el
checklist mostrado fuera el genérico de antes del fix, estos 3 no existirían. El resto
del spec (D10/D11 de TAREA 9) se actualizó de 2 a 3 documentos de Farmazed en todas
partes, ya que ahora sí aparece `recibo_iea`.

### (b) D13 — desglose honorarios Farmazed / tasas oficiales

**Backend — `tracker/routes/pricing.js`:** nuevo `withDesglose(doc)` — agrupa
`honorarios_farmazed + honorarios_abogado + gastos_adicionales` → `honorariosFarmazed`,
y `refrendo_cnf + tasa_dnfd_servicio + tasa_dnfd_tramite + iea + tasa_mef` →
`tasasOficiales`, más un `totalCuadra` (bool) que verifica que ambos grupos sumen el
`total` guardado — para que un dato corrupto no se sirva en silencio. Aplicado en las 3
respuestas (`GET /api/admin/pricing`, `GET /api/pricing/:tramiteType`, `PATCH
/api/admin/pricing/:categoryId`), una sola fuente de verdad para toda pantalla.

**Admin — `farmazed-web/admin/precios.html`:** cada tarjeta ahora muestra las 2 cifras
(verde/azul) arriba de los inputs de componentes, recalculadas en vivo mientras el
admin edita (`recomputeTotal()` extendido). De paso, unifiqué su resolución de puerto
local con el patrón de `config.js` (localStorage `fzApiPort`) — antes tenía su propio
`http://localhost:8080` hardcodeado, sin forma de probarlo en esta máquina donde 8080
está ocupado; ahora es consistente y sí se pudo probar con Playwright.

**Cliente — nueva pantalla `client-dashboard.html` → nav "Precios":** módulo de solo
lectura (`GET /api/admin/pricing`, que ya es público — no pide `x-admin-key` para leer),
agrupado por `grupo` (Registros Nuevos / Modificaciones / Renovaciones), mismo desglose
de 2 cifras + total por categoría. Antes **no existía ninguna pantalla de costo para el
cliente** en el código (`wizard.js` no tiene paso de costo, ninguna otra página del
portal llamaba a `/api/pricing/*`) — D13 pedía agregar el desglose "en la pantalla de
costo/cotización del cliente", así que había que construirla, no solo agruparle datos a
una que ya existiera.

**Verificado (`e2e/pricing.spec.js`, nuevo) con 3 categorías de `grupo` distintos**
(una de cada uno, para cubrir el "probarlo con 3 categorías" del criterio):
- `med_abreviado_sintesis` → Honorarios 2,055 · Tasas 2,525 · Total 4,580 (coincide
  exacto con el ejemplo del criterio en 03_INSTRUCCIONES_DEV.md).
- `cambio_rep_legal` → Honorarios 400 · Tasas 25 · Total 425.
- `renovacion` → Honorarios 800 · Tasas 500 · Total 1,300.

Cada una verificada primero contra la API directamente (`honorariosFarmazed +
tasasOficiales === total`), y después visualmente en ambas pantallas (cliente y admin),
con captura de cada una.

**Sobre `organizacion/05_DIFF_PRECIOS_D09.md` — no se tocó ningún monto**, tal como
indicó el PM. Los montos usados son los que ya están en `seed_pricing.js` hoy, con sus
5 discrepancias conocidas contra el xlsx canónico (`med_abreviado_huerfano`,
`intercambiabilidad`, `modificacion_expedicion`, `renovacion`, `post_rs_modificacion`)
sin resolver — eso es decisión de Rick (F-4), no de esta tarea. Las 3 categorías que
elegí para el spec (`med_abreviado_sintesis`, `cambio_rep_legal`, `renovacion`)
incluyen a propósito una que SÍ diverge del xlsx (`renovacion`, seed 1,300 vs. xlsx
2,600 — ver el detalle en 05) para que quede visible en la captura que el desglose ya
funciona sobre datos que, según el PM (Argus), están subfacturados. No se cambió nada
al respecto.

### Capturas nuevas — `sessions/2026-09-29/`

`checklist`: `00-paso2-casillas-pobladas`, `01-bloqueado-faltan-docs-cliente` (ahora
con 3 docs de Farmazed y `muestra`/`metodo_analisis` visibles), `02-habilitado-solo-
faltan-farmazed`, `03-admin-tarea-interna`. `pricing`: `01-pricing-cliente-precios`
(las 13 categorías con desglose), `02-pricing-admin-precios` (mismo desglose en el
panel de edición).

### Estado de archivos

Nuevos: `e2e/pricing.spec.js`. Modificados: `farmazed-web/portal/js/wizard.js` (fix +
D11 de TAREA 9 ya estaba), `tracker/routes/pricing.js` (D13), `farmazed-web/admin/
precios.html` (D13 + fix de puerto), `farmazed-web/client-dashboard.html` (nuevo
módulo Precios), `farmazed-web/portal/js/api.js` (`getPricing`), `e2e/checklist.spec.js`
(reescrito con el subtipo real). Todo sin commitear. Servicios de prueba detenidos,
puertos liberados, `config.js` intacto.

## 2026-09-29 — TAREA 10 (ajuste): módulo "Precios" del cliente detrás de feature flag (PM_COMMENTS §H.2)

Rick decidió que mostrar el tarifario completo al cliente es alcance nuevo y decisión
comercial suya, no algo a habilitar por defecto solo porque el código ya existe (5/13
montos de `seed_pricing.js` divergen del xlsx canónico, ver `05_DIFF_PRECIOS_D09.md`).
No se borró nada de lo construido en TAREA 10 — se apagó por defecto.

**`farmazed-web/portal/js/config.js`:** nuevo `FEATURES = { clientePrecios:
isFeatureOn('clientePrecios') }`. `isFeatureOn(name)` devuelve `false` de inmediato si
`!IS_LOCAL` — no hay forma de encenderlo en producción pase lo que pase en la URL o en
`localStorage`. Dentro de `IS_LOCAL`, revisa `?feature_clientePrecios=1` y luego
`localStorage.getItem('feature_clientePrecios')`.

**`farmazed-web/client-dashboard.html`:** importa `FEATURES`, expone
`window.__fzFeatures`; el `<li id="nav-precios-item">` queda `style="display:none"` por
defecto y solo se revela si el flag está prendido. `showModule('precios')` y
`loadPrecios()` tienen guardas de salida temprana — ni siquiera invocándolas a mano
desde la consola se llega al módulo sin el flag. El `<li>` **no se borra** del DOM
(instrucción explícita de Rick), solo queda oculto.

**`e2e/pricing.spec.js`** dividido en 2 pruebas: una confirma que el módulo está oculto
por defecto (`toBeHidden()`, no `toHaveCount(0)` — el nodo sigue en el DOM a propósito);
la otra enciende el flag solo para esa prueba vía
`localStorage.setItem('feature_clientePrecios','1')` y repite las 3 verificaciones de
desglose de D13. Suite completa corrida 2 veces — 4/4 en verde la segunda vez (la
primera tuvo un `net::ERR_ABORTED` transitorio de arranque en `checklist.spec.js`, se
resolvió solo al reintentar, y un `toHaveCount(0)` mal puesto en `pricing.spec.js` que
corregí a `toBeHidden()`).

Verificado: `git diff config.js | grep -c 8081` → `0` (run.sh nunca lo tocó), puertos
de emulador/tracker/estático liberados tras el cierre. Sin commit, sin deploy.

## 2026-09-29 — TAREA 11: D12 — modelo de los dos eventos de pago (organizacion/03 fila D12, Parte C.9)

**Reconciliación de nombres de campo:** el encargo verbal de esta tarea usó
`farmazed_a_entidad`; el documento fuente (`organizacion/03_INSTRUCCIONES_DEV.md`, fila
D12) usa literalmente `farmazed_a_autoridad` + `autoridad ∈ {DNFD,IEA,CNF,MEF}`, y ese
es el valor que su propio criterio de aceptación testea explícitamente ("con
`farmazed_a_autoridad` y sin `autoridad` → 400"). Usé el nombre literal de 03, no la
paráfrasis — si el nombre `farmazed_a_entidad` era intencional, avisar y lo renombro
(es un solo string en `tracker/routes/payments.js`, sin costo). Además agregué
`comprobante` (archivo, no `comprobanteDocId` de un doc ya subido en otro lado — el
pago sube su propio comprobante) y `registradoPor`, tal como pidió el encargo,
ampliando el modelo de 03 sin contradecirlo.

**Confirmado contra `PM_COMMENTS.md` §9/R19 antes de programar:** "todas las tasas
oficiales van dentro del pago de Fase 5 (cliente → Farmazed); Farmazed paga después a
cada autoridad" — o sea fase_05 es el evento `cliente_a_farmazed` (el cliente paga TODO,
honorarios + tasas, de una vez) y fase_13 es `farmazed_a_autoridad` (Farmazed
desembolsando después a DNFD/IEA/CNF/MEF). Coincide exactamente con lo que ya había
diseñado antes de leer ese párrafo — quedó como confirmación, no como corrección.

**Modelo — `tracker/routes/payments.js` (nuevo), montado en `tracker/index.js` como
`/api/cases/:caseId/payments`:**
- `POST /` (admin only, multipart con archivo `comprobante`): valida `tipo ∈
  {cliente_a_farmazed, farmazed_a_autoridad}` (400 listando los válidos si no),
  `autoridad` obligatoria y válida solo si `tipo==='farmazed_a_autoridad'` (400 si
  falta o es inválida), `monto` positivo, `comprobante` obligatorio (registro manual,
  sin pasarela — Parte H). Sube el archivo reusando `services/storage.js` (mismo
  patrón que `documents.js`), guarda `{tipo, autoridad, monto, fecha, comprobanteDocId,
  comprobantePath, registradoPor, registradoPorEmail, createdAt}` en
  `cases/{id}/payments/{paymentId}`. Devuelve 201 con `comprobanteUrl` firmada.
- `GET /` — lista los pagos del caso (mismo control de acceso admin/dueño que el resto
  de subcolecciones).
- Exporta `hasRequiredPayment(caseId, fromStatus)` — `true` si esa fase no tiene gate de
  pago (todas menos fase_05/fase_13), o si ya existe al menos un pago del tipo que esa
  fase exige.

**Conexión con la máquina de estados — mismo patrón en las 3 rutas de escritura de
status que ya existían para `override` (§H.1):**
- `cases.js` (`PATCH /:id`): tras validar que el SALTO es estructuralmente válido, si
  se sale de `fase_05` o `fase_13` sin `override:true`, verifica
  `hasRequiredPayment(id, statusActual)`; si falta el pago, 400 con el tipo exigido. El
  override del admin lo sigue pasando por encima — `isOverride` en `statusHistory` ahora
  es `true` tanto si el salto era estructuralmente inválido como si faltaba el pago,
  para que quede auditado en cualquiera de los dos casos.
- `mcp.js` (`handleUpdateCase`): mismo gate, mismo mensaje de error, misma regla de
  `override` — para que un cliente MCP no pueda saltarse por un canal distinto lo que sí
  se exige en `cases.js` (mismo razonamiento que ya se aplicó en TAREA 7 para
  `isValidTransition`).

**UI admin — `farmazed-web/admin/expediente.html`:** tarjeta nueva "Pagos (D12)" junto
al Historial de Estado — lista de pagos ya registrados (tipo, autoridad si aplica,
monto, fecha, quién lo registró, link al comprobante) + formulario para registrar uno
nuevo (select de tipo, select de autoridad que solo aparece si el tipo lo pide, monto,
fecha, input de archivo). `farmazed-web/portal/js/api.js`: `getPayments`,
`registerPayment` (multipart, mismo patrón que `uploadDocument`).

**UI cliente — `farmazed-web/client-dashboard.html`:** cada tarjeta de producto, al
expandirse, muestra un badge "Pagado" / "Pendiente de pago" según si existe un pago
`cliente_a_farmazed` para ese caso — el cliente NO ve el pago `farmazed_a_autoridad`
(es interno, no le compete). Dato cargado junto con documentos/mensajes en la misma
carga inicial (`api.getPayments(c.id)` por caso, en paralelo).

**Verificado con `e2e/payments.spec.js` (nuevo):** caso de prueba separado
(`test-pago-visual`, fase_05, sin pagos — `e2e/global-setup.js` lo resetea en cada
corrida junto con `test-flujo-visual`, sin tocarlo). Recorrido: (1) intentar fase_05→
fase_06 sin pago y sin override → bloqueado, capturado, y confirmado con reload que no
se guardó nada; (2) registrar el pago `cliente_a_farmazed` con comprobante PDF de
prueba adjunto vía `setInputFiles`; (3) reintentar el mismo avance → esta vez pasa sin
necesitar override, y el historial NO lo marca como override (el pago lo habilitó, no
una excepción manual); (4) el cliente, al loguearse, ve el badge "Pagado" en su
producto. 5 capturas en `sessions/2026-09-29/*-pagos-*.png`. Suite completa (5 specs)
corrida junta — 5/5 en verde.

**No implementado — fuera del alcance explícito de esta tarea (el propio 03 lo dice:
"Es el modelo, no la integración (esa es B06)"):** el comprobante de un pago
`farmazed_a_autoridad` NO alimenta automáticamente los 3 documentos del checklist que
PM_COMMENTS §9 menciona (`tasa_servicio`, `recibo_iea`, `recibo_cnf` — los mismos
`FARMAZED_DOC_IDS` de D10) — eso es B06, una integración aparte, no D12. Tampoco hay
pasarela de pago (Parte H, supuesto explícito: manual). Sin commit, sin deploy.

Estado de archivos: nuevos `tracker/routes/payments.js`, `e2e/payments.spec.js`.
Modificados: `tracker/index.js` (monta el router), `tracker/routes/cases.js` +
`tracker/routes/mcp.js` (gate de pago), `farmazed-web/admin/expediente.html` (UI de
pagos), `farmazed-web/client-dashboard.html` (badge de pago), `farmazed-web/portal/
js/api.js` (`getPayments`/`registerPayment`), `e2e/global-setup.js` (segundo caso de
prueba). Servicios de prueba detenidos, puertos liberados, `config.js` intacto.

## 2026-09-29 — TAREA 11 (corrección): fase_13 NO es el pago a la autoridad (PM_COMMENTS §H.3)

Rick corrigió el diseño anterior de TAREA 11 antes de aceptarlo: el nombre
`farmazed_a_autoridad` de `organizacion/03` estaba bien (no era un rename), pero el
gate que yo había puesto en fase_13 estaba mal — según el SVG canónico de Zelky, fase_13
es **"Pago de honorarios Farmazed"**, es decir el **cliente** paga a Farmazed (probable
saldo, fase_05 probable anticipo), no Farmazed pagando a una autoridad. El pago a la
autoridad (DNFD/IEA/CNF/MEF) no es una fase — es el comprobante que se exige antes de
**salir de fase_14** hacia la presentación.

**Modelo corregido — `tracker/routes/payments.js`:** los pagos `cliente_a_farmazed`
ahora llevan un campo obligatorio `fase: 'fase_05' | 'fase_13'` — son DOS eventos
distintos con su propio comprobante y fecha, y un pago de fase_05 **no** satisface el
gate de fase_13 (ni al revés). `GATES_PAGO` quedó:
- `fase_05` → exige `cliente_a_farmazed` con `fase:'fase_05'`.
- `fase_13` → exige `cliente_a_farmazed` con `fase:'fase_13'`.
- `fase_14` → exige `farmazed_a_autoridad` (cualquiera de las 4 autoridades) para poder
  salir hacia `observado_dnfd`/`aprobado`/`denegado`.

`hasRequiredPayment(caseId, fromStatus)` ahora agrega un segundo `where('fase', '==',
...)` cuando el gate lo pide (dos igualdades, sin necesidad de índice compuesto en
Firestore). `POST /payments` valida `fase` como obligatoria y válida
(`fase_05`/`fase_13`) cuando `tipo==='cliente_a_farmazed'`, con el mismo formato de
error 400 que ya tenían `tipo`/`autoridad`.

**`cases.js`/`mcp.js`:** sin cambios de estructura — solo pasaron de leer
`PAGO_REQUERIDO_POR_FASE[status]` (un tipo plano) a `describeGate(status)`, que arma el
mensaje de error incluyendo la fase cuando aplica (ej. `"cliente_a_farmazed (fase:
fase_13)"`). El gate de fase_14 se activa con el mismo mecanismo: al salir de fase_14
sin `farmazed_a_autoridad` registrado y sin `override`, bloquea igual que fase_05/13.

**UI admin (`expediente.html`):** el formulario de registrar pago ahora muestra un
select "Fase que cubre" (Fase 5 / Fase 13) cuando el tipo es `cliente_a_farmazed`, y el
select de autoridad solo cuando es `farmazed_a_autoridad` — son mutuamente excluyentes,
nunca los dos visibles a la vez. El listado de pagos muestra la fase o la autoridad
según corresponda.

**UI cliente (`client-dashboard.html`):** el badge único "Pagado" se separó en DOS
(`pagoFase05`/`pagoFase13`), mostrados como "Anticipo (fase 5)" y "Honorarios (fase
13)" con su propio badge Pagado/Pendiente cada uno — un cliente con el anticipo pagado
y el saldo pendiente ve exactamente eso, no un "Pagado" ambiguo.

**`e2e/global-setup.js`:** 2 casos de prueba nuevos (además de `test-pago-visual` para
fase_05): `test-pago-fase13` (sembrado en fase_13 **con un pago de fase_05 ya
registrado**, a propósito, para probar que NO alcanza) y `test-pago-fase14` (en fase_14,
sin pagos).

**`e2e/payments.spec.js` reescrito con los 3 gates que pidió el ajuste, cada uno en su
propio test (antes era 1 test único):**
1. fase_05 sin pago → bloqueado; con pago de fase_05 → avanza; cliente ve "Anticipo
   (fase 5)" y "Honorarios (fase 13)" por separado.
2. fase_13 con **solo** un pago de fase_05 ya registrado → sigue bloqueado (prueba que
   el gate mira la `fase`, no solo el `tipo`); se registra el pago de fase_13 → avanza.
3. fase_14 sin pago a autoridad → bloqueado; **override con motivo** → avanza, y el
   historial queda con el badge `override` + el motivo visible (auditoría intacta).

12 capturas nuevas en `sessions/2026-09-29/*-pagos-*.png`. Suite completa (7 specs:
checklist, estados, 3×payments, 2×pricing) corrida junta — 7/7 en verde.

Sin commit, sin deploy. Pendiente de Rick/Zelky (ya registrado en PM_COMMENTS §H.3):
si fase_05 y fase_13 son anticipo+saldo del mismo honorario, o si fase_05 ya incluye
las tasas oficiales — no afecta el código (el gate es el mismo pase lo que pase), pero
sí el texto que ve el cliente.

## 2026-09-29 — TAREA 12: D16, cierre de E2 — prueba end-to-end completa

Un solo spec nuevo, `e2e/flujo_completo.spec.js`, que recorre un caso de medicamentos
(Síntesis Química, vía Regular) de punta a punta como lo viviría Zelky: cliente se
registra (invocando `register()` de `auth.js` directo, no hay página de registro — ver
abajo), wizard 1→4 con los **15 documentos obligatorios subidos uno por uno via UI
real** (no batch), envío, y el admin recorriendo `fase_01`→`fase_14`→`aprobado` con los
2 pagos del cliente (`fase_05`/`fase_13`), el pago a la autoridad (`fase_14`, DNFD), una
**subsanación real** (`fase_10→fase_07→...→fase_10`, ciclo completo, no solo el salto),
y una **solicitud de documento** (`pending_docs`) en medio del camino. El cliente entra
3 veces a verificar (fase, pagos, documentos pendientes). 21 capturas en
`sessions/2026-09-29/*-flujo-*.png`. Detalle completo, con qué se probó y qué queda
fuera, en **`organizacion/08_PRUEBA_E2E_E2.md`** (nuevo, tal como pidió la tarea).

**3 bugs de producto encontrados y arreglados** viviendo el flujo (no leyendo código):

1. **El caso recién enviado quedaba invisible para el cliente.** El wizard embebido en
   `client-dashboard.html` (el modo real, no el standalone `nuevo.html`) solo cambiaba
   de módulo a "Mis Productos" tras enviar, sin recargar — `DATA.productos` se carga una
   sola vez al abrir la página, antes de que el caso existiera. El modo standalone sí
   recargaba y por eso nunca tuvo el bug. Arreglo: unificar ambos a recargar siempre.
   (`portal/js/wizard.js`, `nextStep()` paso 5.)
2. **La confirmación final del wizard asustaba al cliente sin motivo.**
   `renderConfirmation()` contaba TODO el checklist obligatorio como "faltante" sin
   filtrar por responsable — un cliente con sus 15 documentos ya subidos igual veía
   "⚠️ faltantes (3)" listando los 3 documentos que son tarea interna de Farmazed
   (tasa_servicio/recibo_cnf/recibo_iea, D10/D11). Arreglo: mismo filtro
   `responsable !== 'farmazed'` que ya usan `updateNextButtonState()`/`renderChecklist()`
   en el mismo archivo. (`portal/js/wizard.js`, `renderConfirmation()`.)
3. **El admin no podía salir de "Documentos pendientes" sin marcar un override que el
   backend luego ignoraba.** `buildStatusOptions()` en `expediente.html` lee el mapa
   ESTÁTICO de transiciones, que no tiene entrada para `pending_docs` (a propósito,
   `isValidTransition()` lo trata como comodín — sale hacia cualquier estado sin
   override, D07). Sin este caso especial, el select solo ofrecía "pending_docs",
   obligando al admin a marcar Forzar+motivo que el backend descartaba en silencio
   (la transición YA era válida, nunca se registraba como override real). Arreglo: el
   select trata `current==='pending_docs'` igual que override marcado. Verificado en el
   propio spec: `fase_07` aparece en las opciones sin override, y el historial de esa
   transición no lleva el badge `override`. (`admin/expediente.html`,
   `buildStatusOptions()`.)

**Lo que NO se pudo probar** (detalle completo en el .md nuevo): no existe página de
registro de clientes en el producto (gap de alcance, no bug — se probó llamando
`register()` directo); los botones "Subir archivo" de la sección Pendientes del
resumen del cliente no tienen `onclick` (no hacen nada); el pago `farmazed_a_autoridad`
no alimenta automáticamente los 3 documentos del dossier que PM_COMMENTS §9 menciona
(eso es B06, integración, no D12/D16 — el propio 03 dice "es el modelo, no la
integración"); FADDI real y el conteo de casos en producción por fase (pendiente de
Rick, sin cambios).

Suite completa (8 specs: checklist, estados, flujo_completo, 3×payments, 2×pricing)
corrida junta — 8/8 en verde. Sin commit, sin deploy. `config.js` intacto, puertos
liberados.

## 2026-09-29 — TAREA 13: conectar "Subir archivo" de Pendientes (cierra el gap #2 de TAREA 12)

El botón "Subir archivo" de la sección Pendientes del cliente (Resumen) era decorativo
— `pendActionBtn()` lo generaba sin `onclick` ni listener. Es el lazo de subsanación
del cliente: si el admin le pide un documento y el caso queda en `pending_docs`, hoy el
cliente no tenía forma de subirlo desde ahí (solo podía, indirectamente, resumir el
wizard con `?caseId=` en la URL — nunca documentado ni enlazado). Conectado.

**Backend — bug encontrado al conectar el botón (`tracker/routes/documents.js`):**
`POST /documents` siempre creaba un `uuid()` nuevo, sin importar si ya existía un
registro con el mismo `faddiDocId`. El placeholder que crea
`POST /documents/request` (status `requested`, `fileName:'(pendiente)'`) se quedaba
como una fila separada, **más vieja**, y `admin/expediente.html`'s `docsById[d.faddiDocId]
= d` (recorriendo el array en orden `uploadedAt desc`) terminaba mostrando esa fila
vieja, no la subida real — el admin nunca veía el documento que el cliente acababa de
subir. Arreglo: buscar si ya existe un documento con ese `faddiDocId` antes de subir; si
existe, **reemplazarlo en el mismo id** (`docsCol.doc(docId).set(docData)`) en vez de
crear uno nuevo. Mismo criterio aplica a cualquier re-subida futura (ej. un documento
`rejected` que el cliente corrige), no solo al caso de `pending_docs` — un solo registro
por `faddiDocId`, siempre.

**Frontend (`farmazed-web/client-dashboard.html`):**
- `DATA.pendientes` ahora incluye `caseId`, `faddiDocId`, `faddiCode`, `faddiDocName`,
  `faddiStep` (antes solo tenía el código/nombre para mostrar, nada para poder subir).
- `pendActionBtn()`: para `tipo_accion:'subir'`, genera un `<label>` + `<input type=file
  class="d-none">` (mismo patrón que ya usa `wizard.js` para su checklist), en vez del
  `<button>` sin handler de antes.
- `renderPendientes()`: listener delegado (`dataset.wired`, igual que
  `renderChecklist()` en `wizard.js`) sobre `#pendientes-list` — sube el archivo con
  `window.__fzApi.uploadDocument(caseId, file, {faddiDocId,...})`, y al terminar hace
  `alert()` + `window.location.reload()` (misma razón que el fix de TAREA 12: una
  recarga completa es la forma simple de traer datos frescos — ya no hay pendiente, tal
  vez cambió el estado del documento, etc.).

**`e2e/flujo_completo.spec.js` actualizado** — reemplaza el atajo de TAREA 12 (el admin
resolvía `pending_docs` sin que el cliente hubiera subido nada de verdad) por el flujo
real: el cliente sube el documento solicitado desde "Subir archivo" en Resumen, se
verifica que `#sec-pendientes` desaparece, y que el admin ve el documento con status
subido (ya no "Solicitar", ahora "Ver") antes de retomar `pending_docs -> fase_07`.
Nueva captura `11c-cliente-resuelve-pendiente-subiendo`.

Suite completa (8 specs) corrida junta — 8/8 en verde (una corrida tuvo el mismo
`net::ERR_ABORTED` transitorio ya documentado en TAREA 9/estados — se resolvió al
reintentar, no es un bug de este cambio). Sin commit, sin deploy. `config.js` intacto,
puertos liberados. **No se tocó la página de registro** (decisión explícita de Rick:
se define en E3 — invitación de empresa vs. registro abierto).

## 2026-09-29 — TAREA 13 (ajuste de cumplimiento): versionado de documentos

Rick aceptó TAREA 13 con una condición: "reemplazar el doc en el mismo id" no puede
significar "perder" la versión anterior — un documento rechazado y su reemplazo deben
quedar trazables.

**`tracker/routes/documents.js`, `POST /`:** antes de sobrescribir un documento existente
(el mismo `faddiDocId`), la versión ANTERIOR (si tenía un archivo real, no el placeholder
vacío de `requested`) se archiva en la subcolección `documents/{docId}/versions` con su
`storagePath`, `status`, `reviewNotes` (motivo de rechazo si lo hubo) y quién/cuándo la
subió. **El archivo viejo nunca se borra de Storage** — se sube la nueva versión con un
nombre de objeto distinto (`${docId}-v${version}`, no `${docId}` a secas) para no pisar
los bytes del anterior. El doc VISIBLE lleva un campo `version` (1, 2, 3…).

**Nuevo endpoint** `GET /api/cases/:caseId/documents/:docId/versions` — versiones
archivadas, más nueva primero, con signed URL fresca cada una.

**Admin (`admin/expediente.html`):** cuando `version > 1`, aparece el badge
"v{N} · ver versiones anteriores" junto al nombre del documento — abre un modal nuevo
(`#versionsModal`) con cada versión archivada, su status/motivo, y un link al archivo
viejo (que sigue existiendo).

**`e2e/document_versions.spec.js` (nuevo):** cliente sube v1 → admin la rechaza con
motivo → cliente re-sube v2 → admin ve el badge, abre el modal, confirma que la v1
archivada muestra el motivo, y que el link al archivo viejo **responde 200 con el
contenido original intacto** (fetch directo al signedUrl, no solo un registro en Firestore
— prueba real de que no se borró de Storage). Suite completa (9 specs) corrida junta —
9/9 en verde. Sin commit, sin deploy.

## 2026-09-29 — TAREA 14: E3 parte 1 (backend) — roles, empresas, permisos, invitaciones

Según PM_COMMENTS §H.4. Alcance: solo backend, sin UI (como pidió la tarea). Todo
verificado contra el emulador; nada de esto se corrió ni se migró en producción.

### (a) Roles + orgs + asignación

6 roles en el claim `role` (`cliente_titular`, `cliente_miembro`, `analista`, `abogado`,
`regente`, `admin`), `orgId` además para los dos de cliente. Nueva colección `orgs`
(`{nombre, createdAt, createdBy}`). Los casos ahora llevan `orgId` (de qué EMPRESA es,
no de quién lo creó — así un `cliente_miembro` ve los casos de su `cliente_titular` y
viceversa) y `asignados: {analista, abogado, regente}` (uids, para que el staff solo vea
lo que tiene asignado).

**Compatibilidad con cuentas sin migrar — decisión deliberada, no un descuido:**
`effectiveRole(user)` (en `tracker/middleware/permissions.js`, nuevo) traduce una cuenta
SIN `role` (todas las de antes de hoy) así: `admin:true` → `'admin'`; cualquier otra →
`'cliente_titular'` — que es exactamente lo que esas cuentas ya podían hacer (crear/leer
sus propios casos por `clientId`). Gracias a esto, **los 9 specs de Playwright existentes
siguen pasando sin tocarlos** (confirmado corriendo la suite completa después de todo
este cambio) — nadie pierde acceso por no haber sido migrado todavía.

### (b) Middleware de permisos — un archivo, una tabla

`tracker/middleware/permissions.js` (nuevo): la tabla `PERMISSIONS` (endpoint/acción ×
rol) es la ÚNICA fuente de verdad — ninguna ruta compara roles a mano. Expone:
- `requirePermission(nombre)` — middleware Express, 403 si el rol efectivo no está en la
  tabla para ese nombre.
- `canAccessCase(user, caso)` — reemplaza el `data.clientId !== user.uid` repetido en
  `cases.js`/`documents.js`/`messages.js`/`payments.js`: admin ve todo; cliente ve su
  `orgId` (o su `clientId` si la cuenta no está migrada); staff ve lo que tiene asignado.
- `canTransitionCase(role, fromStatus)` — dentro de `cases.advance`/`confirm_*`, qué rol
  de staff puede sacar el caso de CADA fase (no cabe en la tabla rol×endpoint porque
  depende del `status` actual del caso, no solo de la ruta).
- `generateMarkdownTable()` — la tabla en Markdown, usada por
  `scripts/generate_permissions_doc.js` para escribir
  **`organizacion/09_TABLA_PERMISOS.md`** (el entregable pedido, generado desde el
  código — no a mano).

**No incluye `pricing.js`** — ese router usa `x-admin-key` por header (el login separado
de `admin/precios.html`), no token de Firebase; migrarlo es trabajo aparte, listado en la
tabla sin poder exigirlo de verdad habría sido una mentira documental. Tampoco toca
`mcp.js` (su propio `MCP_KEY`, mismo criterio).

### (c) Reglas conectadas a los endpoints reales (no solo declaradas)

- `cases.js`: `POST /` exige `cases.create` (cliente_titular/miembro/admin). `PATCH /:id`
  reparte los campos editables en 3 grupos (admin: todo incluido `asignados`; cliente:
  datos del caso en borrador; staff: solo `status`/`notes`) y, cuando el cambio es de
  `status`, valida con `canTransitionCase()` que ESE rol de staff pueda sacar el caso de
  la fase en la que está (abogado solo fase_08, regente solo fase_10, analista todo lo
  demás incluidas fase_07/fase_12) — `override` sigue siendo estrictamente
  `effectiveRole===admin`. `GET /` filtra por `orgId`/`asignados.<rol>` según quién
  pregunta.
- `documents.js`: `POST /` (subir) exige `documents.upload`; `POST /request` y
  `PATCH /:docId` (revisar) exigen `documents.request`/`documents.review`
  (analista/abogado/regente/admin — ya no `requireAdmin` a secas).
- `payments.js`: `POST /` exige `payments.create` (admin, sin cambio de comportamiento,
  ahora vía la tabla en vez de `requireAdmin` suelto).
- `messages.js`: mismo `canAccessCase()` que el resto.

### (d) Alta por invitación (`tracker/routes/invitations.js`, `orgs.js`, nuevos)

Sin registro abierto (decisión de Rick — la página de registro NO se construyó, como
pidió explícitamente). Tres rutas, cada una de un solo uso (`invitations/{token}`,
`used:boolean`):
- `POST /api/invitations/titular` (admin) — crea la empresa Y la invitación del primer
  usuario (titular) juntas.
- `POST /api/invitations/empleado` (admin) — invita analista/abogado/regente/admin.
- `POST /api/invitations/miembro` (cliente_titular) — invita a SU propia empresa; el
  `orgId` sale del token del que invita, nunca del body (un titular no puede colar el
  `orgId` de otra empresa aunque lo mande a mano).
- `POST /api/invitations/:token/accept` — sin `requireAuth` a propósito (quien acepta
  puede no tener sesión todavía); body `{uid}`, asigna los custom claims y marca la
  invitación usada. Quién junta "crear cuenta" + "aceptar invitación" en una pantalla es
  trabajo de frontend, fuera de esta tarea ("Sin UI todavía").

### (e) Seed — `tracker/scripts/seed_roles.js` (nuevo)

2 empresas (Laboratorios Alfa, Farmacéutica Beta) + 7 cuentas (1 por rol, más un segundo
`cliente_titular` en la empresa Beta para poder probar el 403 cruzado) + varios casos de
prueba AISLADOS por escenario (uno por fase de control 7/8/10/12, uno para pagos, uno
para documentos, uno para override) — aislados a propósito para que las pruebas que
mutan estado no se pisen entre sí. Completamente independiente del seed de `e2e/`
(`seed_emulador.js`) — no comparte UIDs ni casos.

### (f) Migración + tests

**`tracker/scripts/migrate_roles.js` (nuevo, SOLO EMULADOR):** recorre TODAS las cuentas
de Auth; la que ya tiene `role` se salta (idempotente — no rompe las de `seed_roles.js`);
`admin:true` sin `role` → `role:'admin'` (conserva `admin:true`); cualquier otra → `role:
'cliente_titular'` de una empresa nueva, y hace un segundo paso para agregarle `orgId` a
los casos existentes de esa cuenta que no lo tuvieran (si no, habrían quedado invisibles
para ella — el filtro nuevo de `GET /api/cases` es por `orgId`).

**`tracker/tests/permissions.test.js` + `migration.test.js` (nuevos, `node --test`
nativo, sin dependencias nuevas):** corren con
**`tracker/scripts/run_permission_tests.sh`** (nuevo — arranca Auth+Firestore, siembra
LEGACY (`seed_emulador.js`) + roles (`seed_roles.js`), levanta el tracker, corre la
matriz, corre la migración sobre las cuentas legacy, y verifica el resultado). 48 pruebas
de permisos (crear caso, listar/leer con ownership por org y por asignación, **el 403
cruzado entre empresas que pidió la tarea explícitamente**, subir/solicitar/revisar
documentos, registrar pagos, gestionar empresas, las 3 rutas de invitación, asignar
staff, y las 4 confirmaciones de fase 7/8/10/12 cada una con su rol correcto y los
incorrectos bloqueados) + 5 de migración (admin legacy → role admin; cliente legacy →
cliente_titular con org nueva; sus 3 casos legacy quedan con `orgId` y él los sigue
viendo; las cuentas ya migradas no se tocan de nuevo) — **53/53 en verde**.

Suite completa de Playwright (9 specs) corrida DESPUÉS de todo este cambio — **9/9 sigue
en verde**, sin tocar ni un spec existente.

### Lo que no se hizo (fuera de alcance explícito de esta tarea)

Ninguna UI (dicho por la propia tarea). `mcp.js` y `pricing.js` no pasaron al sistema de
roles (auth propia cada uno, ver arriba). El criterio "spec Playwright por rol" de
§H.4 (probar los roles desde el navegador, no solo por HTTP) queda para cuando haya UI
que probar — hoy no hay pantallas que reaccionen a `cliente_miembro`/`analista`/
`abogado`/`regente` de forma distinta a como ya reaccionan a "admin"/"cliente".

Estado de archivos: nuevos `tracker/middleware/permissions.js`, `tracker/routes/orgs.js`,
`tracker/routes/invitations.js`, `tracker/scripts/seed_roles.js`,
`tracker/scripts/migrate_roles.js`, `tracker/scripts/generate_permissions_doc.js`,
`tracker/scripts/run_permission_tests.sh`, `tracker/tests/permissions.test.js`,
`tracker/tests/migration.test.js`, `organizacion/09_TABLA_PERMISOS.md`. Modificados:
`tracker/middleware/auth.js` (`requireAdmin` acepta `role:'admin'` además de
`admin:true`), `tracker/index.js` (monta `orgs`/`invitations`), `tracker/routes/cases.js`,
`documents.js`, `messages.js`, `payments.js`. Sin commit, sin deploy.

## 2026-09-29 — TAREA 15: E3 parte 2 (UI) — bandeja, empresas, invitación pública, Mi Empresa

Según PM_COMMENTS §H.4, sobre la base de TAREA 14. Todo verificado contra el emulador;
nada tocó producción.

### (a) "Mi Bandeja" — `farmazed-web/admin/bandeja.html` (nuevo)

Landing del staff (analista/abogado/regente/admin): lista SOLO sus casos asignados
(el backend ya filtra — `GET /api/cases` de TAREA 14) con una "acción pendiente" por
fila (ej. "Revisión legal pendiente", "Cotejo con matrices guía pendiente",
"N documento(s) por revisar"). La etiqueta usa un mapeo fase→texto que es solo
COSMÉTICO — no decide nada; si se equivocara, el backend igual rechaza cualquier
intento fuera de rol (ya probado en los 48 tests de permisos). Abre `expediente.html`
al hacer clic en una fila.

**Ampliación necesaria del gate de acceso:** `admin/casos.html` y
`admin/expediente.html` antes solo dejaban entrar a `isAdmin()` — bloqueaban por
completo a analista/abogado/regente, que SÍ necesitan `expediente.html` para confirmar
sus fases. Nuevo helper `hasBackofficeAccess()` en `portal/js/auth.js` (admin o staff)
reemplaza ese gate en ambas páginas — "Mi Bandeja" es la entrada recomendada del staff,
pero no se les bloquea `casos.html` tampoco (el backend ya les muestra solo lo suyo).

**`admin/expediente.html` — "SOLO los botones que su rol permite":** al cargar, pide
`GET /api/me/permissions` (nuevo endpoint, `tracker/routes/me.js`) y con eso:
- Oculta "Forzar (override)" si no tiene `cases.override` (solo admin).
- Oculta el formulario de registrar pago si no tiene `payments.create` (solo admin) —
  la lista de pagos ya registrados se sigue viendo (todos los roles tienen
  `payments.read`).
- Oculta la nueva tarjeta "Equipo Asignado" si no tiene `cases.assign` (solo admin).
- Agrega botones ✓/✗ (aprobar/rechazar, con motivo) en cada documento subido, visibles
  con `documents.review` (analista/abogado/regente/admin — antes este endpoint existía
  en el backend desde TAREA 13 pero SIN ningún botón que lo llamara).
- Resalta con fondo amarillo pálido los documentos **legales** (`poder`, `clv`) cuando
  quien mira es **abogado**, y los **técnicos** (todos los demás no-Farmazed) cuando es
  **regente** — es una convención de estilo hardcodeada en esta página (comentada como
  tal), no una regla de `permissions.js`.
- El desplegable de estado se deja visible e igual para todos los roles de back-office
  (no se intenta adivinar client-side cuál transición específica puede pedir cada uno —
  el backend ya lo exige con `canTransitionCase()`, TAREA 14; duplicarlo en el front
  sería exactamente lo que la tarea pidió NO hacer).

El front **nunca repite la tabla de `permissions.js`** — todo sale de
`GET /api/me/permissions` (`{role, orgId, permissions: [...]}`).

### (b) Admin: gestión de empresas y empleados — `admin/empresas.html` (nuevo)

Lista de empresas (con "Ver miembros"), lista de empleados Farmazed, y 2 formularios de
invitación (titular → crea empresa nueva; empleado → analista/abogado/regente/admin) +
tabla de invitaciones con su estado (Pendiente/Usada) y el link de aceptación (todavía
no se manda por correo — el link se muestra en la tabla, "dev" explícito en el
encabezado de esa columna). Asignar analista/abogado/regente a UN caso específico vive
en `expediente.html` (tarjeta "Equipo Asignado"), no aquí — aquí es gestión general.

Backend nuevo: `GET /api/orgs/:orgId/members` (cualquier empresa, admin),
`GET /api/employees` (staff + admin), `GET /api/invitations/:token` (público, para la
página de aceptar).

### (c) Página pública de aceptar invitación — `farmazed-web/aceptar-invitacion.html` (nuevo)

`?token=...` → `GET /api/invitations/:token` (sin auth) muestra el correo/rol de la
invitación → la persona pone su nombre y contraseña → `register()` (mismo `auth.js` de
siempre) crea la cuenta de Firebase → `POST /api/invitations/:token/accept` asigna los
custom claims y marca la invitación usada (409 si ya se había usado) → se fuerza un
refresh del ID token (`getIdTokenResult(true)`) para que el rol recién asignado ya esté
disponible sin tener que volver a loguearse → redirige a `client-dashboard.html`
(cliente) o `admin/bandeja.html` (staff/admin) ya logueado.

### (d) Cliente titular: "Mi Empresa" — módulo nuevo en `client-dashboard.html`

Nav "Mi Empresa" para TODO cliente (titular o miembro, sin flag — a diferencia de
Precios, esto no es una decisión comercial pendiente). Muestra los miembros de la
empresa (`GET /api/me/org`, nuevo); el **titular** además ve sus invitaciones enviadas y
un formulario para invitar un miembro nuevo (`POST /api/invitations/miembro` — el
`orgId` sale del token de quien invita, nunca de lo que el formulario mande, ya
verificado en TAREA 14). El **miembro** ve la misma info, sin el formulario.

### (e) `pricing.js` + `admin/precios.html` migrados a token de Firebase con rol admin

`PATCH /api/admin/pricing/:categoryId` pasó de `x-admin-key` (una clave compartida en
un header) a `requireAuth + requirePermission('pricing.write')` — mismo sistema de roles
que el resto del tracker. `admin/precios.html` ya no pide "admin key": usa
`requireLogin`/`isAdmin` como `casos.html`/`expediente.html`, y manda
`Authorization: Bearer <token>`. `GET /api/admin/pricing` sigue público (los precios no
son secretos, sin cambio).

**Pregunta respondida — qué más usa `ADMIN_KEY`:** `POST /api/admin/set-role` en
`tracker/index.js` (asignación de claims por clave compartida, el mecanismo de arranque
de antes de que existieran las invitaciones). **No se tocó** — sigue siendo la única
otra ruta que usa `ADMIN_KEY`, así que la variable de entorno se queda definida en Cloud
Run por esa razón, no por `pricing.js`.

`e2e/pricing.spec.js` actualizado (ya no llena `#admin-key-input` — usa la sesión de
Firebase ya iniciada).

### (f) Tests

**`tracker/tests/permissions.test.js`** sin cambios de fondo, pero la migración de
`pricing.js` se verificó aparte (48/48 sigue en verde tras el cambio, y
`pricing.spec.js` de Playwright confirma la UI real).

**`e2e/roles.spec.js` (nuevo, 7 specs):** un test por cada uno de los 6 roles —
`cliente_titular` (Mi Empresa + solo sus casos), `cliente_miembro` (misma empresa, sin
invitar), `analista` (bandeja + expediente sin override/pagos/asignar),
`abogado` (bandeja + doc legal resaltado), `regente` (bandeja + doc técnico resaltado),
`admin` (ambas empresas + todo visible) — más un 7º test end-to-end: admin invita a un
titular nuevo desde `empresas.html`, se extrae el token real de la tabla, se visita
`/aceptar-invitacion.html?token=...`, se completa el registro, y se confirma que la
cuenta nueva entra ya logueada viendo su propia empresa recién creada. 15 capturas
nuevas. Usa el fixture de `tracker/scripts/seed_roles.js` (2 empresas + 1 cuenta por
rol) — `e2e/run.sh` ahora también corre ese seed además del legacy
(`seed_emulador.js`), sin tocar ningún caso/UID existente.

Suite completa de Playwright (16 specs: los 9 de antes + `roles.spec.js` ×7) — **16/16
en verde**. `node --test` de permisos y migración — **53/53 sigue en verde** tras la
migración de `pricing.js`. Sin commit, sin deploy. `config.js` intacto, puertos
liberados.

Estado de archivos: nuevos `farmazed-web/admin/bandeja.html`,
`farmazed-web/admin/empresas.html`, `farmazed-web/aceptar-invitacion.html`,
`tracker/routes/me.js`, `tracker/routes/employees.js`, `e2e/roles.spec.js`.
Modificados: `tracker/routes/pricing.js`, `tracker/routes/orgs.js`,
`tracker/routes/invitations.js`, `tracker/middleware/permissions.js` (agrega
`pricing.write`/`orgs.read_members`/`employees.list`/`invitations.read` +
`permissionsForRole()`), `tracker/index.js`, `farmazed-web/admin/precios.html`,
`farmazed-web/admin/casos.html`, `farmazed-web/admin/expediente.html`,
`farmazed-web/client-dashboard.html`, `farmazed-web/portal/js/auth.js` (`getRole`,
`getOrgId`, `isStaff`, `hasBackofficeAccess`), `farmazed-web/portal/js/api.js`,
`e2e/pricing.spec.js`, `e2e/run.sh` (siembra también `seed_roles.js`).

## 2026-09-29 — TAREA 16: cierre antes de que vuelva Rick — set-role, tabla completa, ENTREGA

### (a) `POST /api/admin/set-role` ya no usa `ADMIN_KEY`

Era una puerta trasera real al modelo de roles: cualquiera con la clave se hacía admin
sin invitación ni registro de quién lo hizo. Ahora exige token de Firebase +
`admin.set_role` (nuevo permiso, solo admin) y cada uso queda en la nueva colección
`adminAuditLog` (`{action, targetUid, targetEmail, admin, by, byEmail, at}`). También
arreglé un bug de paso: el endpoint viejo hacía `setCustomUserClaims(uid, {admin:bool})`
a secas, que REEMPLAZA todos los claims — revocar admin a alguien con `role`/`orgId` se
los habría borrado sin querer. Ahora hace merge: lee los claims actuales, solo toca
`admin`/`role`.

**`tracker/scripts/bootstrap_admin.js` (nuevo):** da el PRIMER admin (cuando todavía no
existe ninguno para invitar) con credenciales de GCP por línea de comandos, nunca por
HTTP. A propósito NO tiene el guard "solo emulador" de los demás scripts — su trabajo es
poder correr contra producción cuando haga falta; se probó igual contra el emulador
(`FIREBASE_AUTH_EMULATOR_HOST`) sin tocar producción. Confirmado manualmente: da el rol,
es idempotente (correrlo de nuevo dice "ya es admin, nada que hacer").

**Qué más lee `ADMIN_KEY` — respuesta a la pregunta:** nada. Después de este cambio no
queda ningún lector en el código (pricing.js ya se había migrado en TAREA 15). La
variable de entorno en Cloud Run no se tocó — queda ahí hasta que Rick decida retirarla.

### (b) Tabla de permisos completada — endpoints que faltaban

Auditué cada ruta de `cases.js`/`documents.js`/`messages.js` contra la tabla y agregué
las que faltaban: `cases.edit_faddi`/`cases.edit_notes` (staff+admin, nunca cliente —
`faddi` faltaba en `STAFF_FIELDS`, ya estaba en `ADMIN_FIELDS` pero no en el otro lado),
`cases.delete`, `cases.read_history`, `cases.read_checklist`, `documents.delete`,
`messages.read`, y `admin.set_role`. Todas conectadas con `requirePermission()` en su
ruta real, no solo declaradas. `organizacion/09_TABLA_PERMISOS.md` regenerada — ya no
dice que `pricing.js` está fuera (se migró en TAREA 15) y explica por qué
`GET/POST /api/invitations/:token(/accept)` y `GET /api/me/permissions` no están (son
públicas por diseño o reflexivas, no una acción con rol).

`tracker/tests/permissions.test.js`: 8 pruebas nuevas (edit_faddi/edit_notes,
cases.delete, documents.delete, y 3 para `admin.set_role` incluyendo que el merge de
claims no borra `orgId` al revocar admin) — **56/56 en verde** (antes 48).

### (c) `ENTREGA_E1_E3.md` (nuevo, raíz del repo) + `verificar_local.sh` (nuevo)

Documento corto para Rick: qué se construyó por interfaz (cliente/empleados/admin),
cómo revisarlo en 1 comando, las decisiones de PM_COMMENTS §H.1-H.4 que puede revertir
(con sus preguntas abiertas), qué falta/está bloqueado, y un plan de salida a producción
**no ejecutado** (commits por bloques, migraciones con `--dry-run`, deploy
tracker→web, cómo volver atrás).

**`verificar_local.sh` (nuevo, raíz):** un solo comando que corre `e2e/run.sh` y
`tracker/scripts/run_permission_tests.sh` en secuencia y da un resumen final — antes
había que correr las dos suites por separado para ver todo.

**`--dry-run` agregado a `migrate_status.js` y `migrate_roles.js`** (no existía) —
necesario para que el plan de salida a producción fuera ejecutable de verdad, no solo
aspiracional. Probado contra el emulador: el dry-run reporta exactamente lo que
migraría sin escribir nada (confirmado corriendo la migración real después — migró
exactamente los mismos casos que el dry-run había anunciado).

Suite completa vía `./verificar_local.sh` — **16/16 Playwright + 56/56 permisos + 5/5
migración, todo en verde**. Sin commit, sin deploy.

Estado de archivos: nuevos `tracker/scripts/bootstrap_admin.js`, `ENTREGA_E1_E3.md`,
`verificar_local.sh`. Modificados: `tracker/index.js` (set-role con auditoría),
`tracker/middleware/permissions.js` (6 permisos nuevos), `tracker/routes/cases.js`,
`documents.js`, `messages.js` (requirePermission agregado donde faltaba, `faddi` en
STAFF_FIELDS), `tracker/scripts/generate_permissions_doc.js`,
`tracker/scripts/migrate_status.js`, `migrate_roles.js` (`--dry-run`),
`tracker/scripts/run_permission_tests.sh`, `tracker/tests/permissions.test.js`,
`organizacion/09_TABLA_PERMISOS.md`, `tracker/routes/pricing.js` (comentario
actualizado).

## 2026-09-30 — TAREA 17: R14, biblioteca de los 13 formularios canónicos

Retomado por orden de Rick vía Dandy: seguir el plan técnico; commit/push/deploy siguen
esperando a Rick directo.

### (0) Respaldo fuera del repo (antes de tocar nada)

Todo lo de esta sesión (TAREA 6 en adelante) sigue sin commitear y solo vive en esta
máquina. Sin `git stash`, sin commit — copia aparte:
- `~/respaldo-farmazed/2026-09-30/cambios.patch` — `git diff` de los archivos ya
  trackeados y modificados (275 KB).
- `~/respaldo-farmazed/2026-09-30/untracked.tar.gz` — tar de los 130 archivos nuevos
  sin trackear (`git ls-files --others --exclude-standard`), 17.8 MB, sin
  `node_modules` (ya está en `.gitignore`).

El árbol de trabajo del repo no se tocó — solo lectura (`git diff`, `git ls-files`,
`tar`).

### (1) Catálogo — `tracker/data/formularios.js` (nuevo)

Fuente: `~/Projects/Farmazed/_Zelky-Drive-2026-09-25/F08-Form-1..13*.docx` — la serie
que `organizacion/02_MAPA_DATA.md` (sección D) marca CANONICO, la más nueva y la única
completa 1–13. Copiados a `farmazed-web/formularios/` con nombres limpios
(`formulario-01-...docx` … `formulario-13-...docx`, sin espacios ni tildes).

**`firma` y `aplica` de cada uno salen de leer el TEXTO real de cada .docx** (no solo el
nombre de archivo — `unzip -p *.docx word/document.xml` para extraer el título y el
primer párrafo de cada uno), cruzado con el vocabulario fijo de vía/subtipo que pidió la
tarea. 9 de los 13 tienen `aplica` con certeza (el título dice explícitamente
Abreviado/Reconocimiento Mutuo/Renovación/Suplementos/Intercambiabilidad/No
comercializados). **Los otros 4 (formularios 1, 2, 3 y 10) quedaron `aplica:
'por_confirmar'`** — son autorizaciones de representación legal y una declaración de
nombre comercial cuyo título no menciona ninguna vía ni tipo de solicitud; no se les
asignó nada a ciegas.

**Hueco de datos encontrado y documentado (no resuelto, no era el pedido de esta
tarea):** el modelo de casos no tiene forma de marcar que una solicitud es una
RENOVACIÓN — `wizard.js` fija `tipoSolicitud: 'Nuevo Registro'` siempre, sin UI para
cambiarlo. Los 6 formularios etiquetados `renovaciones`/`intercambiabilidad`/
`no_comercializados` (4, 5, 7, 8, 12, 13) nunca le van a aparecer a un cliente en su caso
mientras ese hueco siga abierto — sí se siguen viendo en la biblioteca completa del
admin, que no filtra. Queda anotado en el propio `formularios.js` para quien retome esto
después.

### (2) UI — cliente filtrado, admin biblioteca completa

**Backend** (`tracker/routes/formularios.js`, nuevo): `GET /api/formularios`
(biblioteca completa, cualquier rol) y `GET /api/cases/:id/formularios` (solo lo que
aplica con certeza a ESE caso + los `por_confirmar` aparte — nunca ocultados, nunca
afirmados). Los .docx en sí se sirven como estáticos públicos
(`farmazed-web/formularios/*.docx`) — son plantillas en blanco sin datos de ningún
cliente, no necesitan signed URL como sí necesita un documento ya subido.

**Permiso nuevo** `formularios.read` (los 6 roles) en `tracker/middleware/permissions.js`
— `organizacion/09_TABLA_PERMISOS.md` regenerada.

**Cliente** (`client-dashboard.html`): sección "Formularios" dentro de cada expediente
expandido, junto a "Documentos del expediente" — descarga directa, sin duplicar en el
front la lógica de qué formulario va con qué trámite (el backend ya decide, el cliente
solo pregunta por SU caso).

**Admin** (`admin/formularios.html`, nuevo): biblioteca completa, con firma y aplicación
de cada uno, badge "Por confirmar" para los 4 que quedaron así. Nav "Formularios"
agregado a los sidebars de `casos.html`/`bandeja.html`/`empresas.html`.

### (3) Tests

`tracker/tests/permissions.test.js`: 3 pruebas nuevas — biblioteca completa da 13
siempre; un caso Abreviado+Suplementos (`case-formularios-test`, nuevo en
`seed_roles.js`) trae form-06/07/11/12 en `aplicables` y exactamente 1/2/3/10 en
`porConfirmar`, nunca form-09 (Reconocimiento Mutuo); el 403 cruzado entre empresas
también aplica aquí. **59/59 en verde** (antes 56).

`e2e/formularios.spec.js` (nuevo, 2 specs, capturas en `sessions/2026-09-30/`): admin ve
las 13 con los 4 "Por confirmar" marcados; el cliente del caso Abreviado+Suplementos ve
exactamente los 4 aplicables + los 4 por-confirmar, y NO ve Reconocimiento Mutuo.

**`./verificar_local.sh` corrido completo — 18/18 Playwright + 59/59 permisos + 5/5
migración, todo en verde** (una corrida aislada de Playwright tuvo un fallo transitorio
ya conocido en esta máquina — re-corrida limpia dio 18/18, no era un bug de esta tarea).

Sin commit, sin deploy. Estado de archivos: nuevos `tracker/data/formularios.js`,
`tracker/routes/formularios.js`, `farmazed-web/formularios/*.docx` (13),
`farmazed-web/admin/formularios.html`, `e2e/formularios.spec.js`. Modificados:
`tracker/index.js` (monta el router), `tracker/middleware/permissions.js`
(`formularios.read`), `tracker/scripts/seed_roles.js` (fixture
`case-formularios-test`), `tracker/tests/permissions.test.js`,
`organizacion/09_TABLA_PERMISOS.md`, `farmazed-web/portal/js/api.js`
(`getFormularios`/`getCaseFormularios`), `farmazed-web/client-dashboard.html` (sección
Formularios), `farmazed-web/admin/casos.html`/`bandeja.html`/`empresas.html` (nav).

## 2026-09-30 — TAREA 18: R5/R12, cotizaciones (agrupa N casos, borrador automático)

Retomado en la misma jornada que TAREA 17, orden de Rick vía Dandy (seguir el plan
técnico; commit/push/deploy siguen esperando a Rick directo).

**Qué pedía la tarea** (PM_COMMENTS líneas 50/57/78/447, SVG fase 4 "Cotización del
servicio"): una colección `quotes` por encima de los casos que agrupa N casos de la
MISMA empresa (R5 — cada caso conserva su `caseCode`), con borrador automático al
definirse vía/categoría en fase_03 (R12), que el admin ajusta (motivo obligatorio si el
monto se aparta del tarifario) y envía; el cliente titular la acepta o rechaza con el
desglose honorarios/tasas visible; y un gate nuevo: fase_04 → fase_05 exige una
cotización aceptada que incluya ese caso.

**(a) Modelo y resolución de categoría — `tracker/routes/quotes.js`.** Colección
`quotes` (top-level): `orgId`, `caseIds[]`, `lineas[]` (`caseId`, `caseCode`,
`categoriaPrecio`, `tarifarioHonorarios`/`tarifarioTasas` — congelados al crear la
línea —, `honorariosFarmazed`/`tasasOficiales`/`monto` efectivos, `ajustado`,
`motivoAjuste`), `total`, `estado` (`borrador`|`enviada`|`aceptada`|`rechazada`),
`historial` (array, no subcolección — alcanza para el volumen de esto). `resolverCategoriaPrecio()`
mapea `tramiteType`/`tipoRegistro`/`tipoMedicamento` a un id de `tracker/seed_pricing.js`
— **igual disciplina que TAREA 17 con los formularios: si no se puede resolver con
certeza, `categoriaPrecio: null` y el admin la completa a mano, nunca se inventa un
precio.** Hueco encontrado (documentado en el código, no resuelto — fuera de esta
tarea): `seed_pricing.js` solo tiene filas de `medicamentos`/Nuevo Registro; Regular +
Biológicos/Homeopático/Suplementos/Vacuna, y Abreviado + Vacuna/Medio de
Contraste/Gas Medicinal/Productos Naturales, no tienen fila propia — quedan `null`
hasta que Farmazed defina esos precios.

**(b) Borrador automático (R12).** Factoricé el desglose honorarios/tasas de
`pricing.js` a `tracker/utils/pricing_desglose.js` (antes solo vivía ahí, ahora lo
comparten pricing.js y quotes.js). En `cases.js`, al ENTRAR a fase_04 se llama
`attachCaseToDraftQuote()`: si ya hay un borrador de esa empresa lo reusa (agrega la
línea), si no lo crea. Si algo falla ahí no bloquea la respuesta del PATCH (el admin
siempre puede armar la línea a mano desde `admin/cotizaciones.html`) — solo se registra
el error.

**(c) Gate fase_04 → fase_05.** Mismo patrón que el gate de pagos de TAREA 11
(`hasAcceptedQuote()`/`describeQuoteGate()`, ver `quotes.js`): sin una cotización
`aceptada` que incluya el caso, el PATCH da 400; el admin puede forzarlo con
`override:true` (queda en `statusHistory`, igual que los demás overrides).

**(d) Permisos nuevos** (`tracker/middleware/permissions.js`, tabla regenerada):
`quotes.read` (cliente_titular/cliente_miembro/admin — el staff no participa de la
cotización, no está en la lista), `quotes.edit`/`quotes.send` (solo admin),
`quotes.accept` (**solo cliente_titular, no cliente_miembro** — decisión de esta tarea:
quien acepta un compromiso de pago de la empresa es el dueño de la cuenta, mismo
criterio que `invitations.create_miembro`).

**(e) UI.** `admin/cotizaciones.html` (nueva, nav agregado a casos/bandeja/empresas/
formularios): lista las cotizaciones por empresa, cada línea editable
(honorarios/tasas + motivo), botón "Enviar cotización". `client-dashboard.html`: módulo
nuevo "Cotización" (badge con el conteo de `enviada`) — el cliente NUNCA ve el borrador
sin ajustar (se filtra en el front), solo desde que se envía; ve el desglose por caso y
Aceptar/Rechazar (Rechazar pide motivo).

**(f) Pruebas.** `tracker/tests/permissions.test.js`: 8 pruebas nuevas (67/67 en total)
con 3 casos dedicados `case-quote-test-1/2/3` (org Alfa, fase_03, seed_roles.js) —
borrador agrupa los 3, ajuste sin motivo (400) y con motivo (200), envío, 403 cruzado
(titular_beta) y de rol (cliente_miembro no edita/envía/acepta), gate bloqueado+override,
y gate satisfecho tras aceptar (fase_04→fase_05 sin override). `e2e/quotes.spec.js`
(nuevo): flujo completo por UI con capturas — 3 casos a fase_04, ajuste con motivo en
`admin/cotizaciones.html`, envío, el cliente ve el desglose y acepta desde
`client-dashboard.html`, los 3 casos avanzan a fase_05 con su propio caseCode.

**Bug de interacción encontrado y corregido en el spec (no es un bug de layout):** el
sidebar del portal cliente se expande (overlay) al pasar el mouse por un nav-link y
tarda en volver a su ancho colapsado; el primer intento del spec chocó con eso
(Playwright reintentó un click sobre un botón que quedó momentáneamente bajo el
sidebar expandido). Se corrige en el spec alejando el mouse (`page.mouse.move`) antes
de interactuar con el contenido — no se tocó el CSS/JS del sidebar (comportamiento
preexistente, no introducido por esta tarea).

**Bug real encontrado y corregido — el gate de fase_04 rompía flujo_completo.spec.js:**
el primer gate que escribí exigía cotización aceptada para CUALQUIER caso al salir de
fase_04, sin importar si tenía empresa (`orgId`). Un caso de una cuenta sin migrar
(`orgId: null` — el flujo normal del cliente que se auto-registra, como
`flujo_completo.spec.js`) nunca puede tener una cotización (`attachCaseToDraftQuote()`
tampoco le crea línea, por diseño), así que quedaba bloqueado en fase_04 para
siempre, sin override posible desde la UI del cliente. Esto NO se vio en las pruebas de
permisos (usan cuentas con `orgId` de seed_roles.js) — apareció recién al correr la
suite completa de Playwright y romper un spec previo a esta tarea. Corregido: el gate
solo aplica si `data.orgId` existe (mismo criterio de compatibilidad que
`canAccessCase()`/`attachCaseToDraftQuote()` ya usan en toda la E3). Tras el fix,
`./verificar_local.sh` completo en verde.

**Segundo hallazgo, de test-authoring (no de producto):** con la suite completa (no en
solitario), `quotes.spec.js` fallaba de forma intermitente con `net::ERR_ABORTED` al
navegar al `expediente.html` del siguiente caso del loop — carrera entre el `alert()`
bloqueante que dispara `btn-save-status` (antes de refrescar `caseData`) y el
`page.goto()` inmediato al caso siguiente. A diferencia de `flujo_completo.spec.js`
(que reusa la MISMA página para cada avance de fase), este spec navega a una página
DISTINTA por cada uno de los 3 casos, exponiendo la carrera. Corregido centralizando el
avance en un helper `guardarEstado()` con un margen de 300ms tras el diálogo antes de
navegar — no se tocó el producto.

**Resultado final:** `./verificar_local.sh` completo — 19/19 Playwright (incluye
`quotes.spec.js`), 67/67 permisos, 5/5 migración, todo en verde.

**Estado de archivos** — nuevos: `tracker/routes/quotes.js`,
`tracker/utils/pricing_desglose.js`, `farmazed-web/admin/cotizaciones.html`,
`e2e/quotes.spec.js`. Modificados: `tracker/routes/pricing.js` (usa el util
compartido), `tracker/routes/cases.js` (hook de borrador + gate), `tracker/index.js`
(mount `/api/quotes`), `tracker/middleware/permissions.js` (4 permisos `quotes.*`),
`tracker/scripts/seed_roles.js` (3 fixtures `case-quote-test-*`),
`tracker/tests/permissions.test.js`, `organizacion/09_TABLA_PERMISOS.md`,
`farmazed-web/portal/js/api.js` (`getQuotes`/`getQuote`/`updateQuoteLine`/`sendQuote`/
`respondQuote`), `farmazed-web/client-dashboard.html` (módulo Cotización),
`farmazed-web/admin/casos.html`/`bandeja.html`/`empresas.html`/`formularios.html` (nav).
Sin commit, sin deploy.

## 2026-09-30 — TAREA 18, ajuste PM_COMMENTS §H.7: el gate de cotización cierra el hueco de cumplimiento

El PM corrigió TAREA 18: excluir del gate los casos sin `orgId` abría un hueco — con
alta por invitación todo cliente tiene empresa (y la migración le crea una a las
cuentas viejas), así que un caso sin `orgId` es dato SIN MIGRAR, no un caso
legítimamente exento.

**Cambio en `tracker/routes/cases.js`:** el gate de fase_04 → fase_05 ahora aplica
SIEMPRE. Si el caso no tiene `orgId`, el error es explícito: `"Caso sin empresa
asignada: migrar la cuenta"` (400), y el override del admin lo pasa igual que
cualquier otro gate (queda en `statusHistory`). Test nuevo en
`tracker/tests/permissions.test.js` con el fixture dedicado `case-quote-test-sin-org`
(seed_roles.js, fase_04, `orgId: null`) — bloqueado sin override, avanza con
override. 68/68 permisos en verde.

**`e2e/flujo_completo.spec.js` corregido para entrar por invitación (el modelo real,
no `register()` directo):** el admin invita al titular desde `admin/empresas.html`
(crea la empresa), el cliente acepta el token en `aceptar-invitacion.html` y entra ya
con `orgId` — mismo recorrido que `roles.spec.js` "invitación -> aceptar -> login".
Como consecuencia, el caso de este spec SÍ tiene empresa y el gate de cotización le
aplica de verdad en fase_04 → fase_05; como ese flujo (pagos/documentos/subsanación)
no es donde se prueba la cotización (eso ya lo cubre `e2e/quotes.spec.js`), esa
transición puntual se fuerza con `{"override":true}` y un motivo explícito
(`advanceOverride()`), igual que lo haría un admin ante una excepción real. Ajustada
también la aserción de "no fue un override real" en fase_07 para mirar solo la
entrada más nueva del historial (`.field-row` primero) — antes miraba el panel
completo y el override de fase_04/05 la hacía fallar en falso.

Dos bugs de test-authoring encontrados y corregidos en `advanceOverride()` (ninguno de
producto): (1) marcar "Forzar (override)" dispara `buildStatusOptions()`
(`admin/expediente.html`), que RECONSTRUYE el `<select>` y vuelve a seleccionar el
estado ACTUAL — si el target ya estaba elegido ANTES de marcar el checkbox, la
reconstrucción lo pisaba; el checkbox debe ir primero. (2) inmediatamente después de
un cambio de estado sin recargar la página, el checkbox/fila de motivo no quedaban en
un estado estable para un `check()+fill()` encadenado — se corrigió con un
`page.reload()` antes del override, el mismo patrón que ya usaban
`payments.spec.js`/`estados.spec.js`.

**Resultado:** `./verificar_local.sh` completo — 20/20 Playwright, 68/68 permisos,
4/4 paquete IEA, 5/5 migración, todo en verde (con TAREA 19 ya incluida en la misma
corrida — ver su propia sección abajo).

## 2026-09-30 — TAREA 19: R13, conteo de páginas del paquete IEA (advierte, nunca bloquea)

**Límite: 150 páginas** — encontrado en `_Zelky-Drive-2026-09-25`, en DOS documentos
independientes: `F08-IEA-guia para usuarios IEA word listo.docx` y `F10-Fase 10 Se
verifica la documentación con nuestras matrices guias.docx`, ambos con el mismo texto
("...No exceder en la documentación de 150 páginas"). Coincide con el número que
PM_COMMENTS Parte 0 (R13) ya tenía fijado — no hizo falta dejarlo en null/por
confirmar, aparece explícito y dos veces.

**Qué documentos "van al IEA"** — fuente: `F08-IEA-Matriz requisitos IEA enviar.docx`,
Sección 4, lista 7: Fórmula Cualitativa-Cuantitativa, Metodología Analítica,
Certificado de Análisis de Producto Terminado, Especificaciones de Producto
Terminado, Espectros/Cromatogramas, Proyecto de Etiqueta, Validación Analítica. De
esos 7, el checklist actual (`faddi_checklists.js`) solo tiene upload propio para 5:
`formula`, `metodo_analisis`, `cert_analisis`, `especificaciones`, `etiquetas` (ver
`tracker/data/paquete_iea.js`, `IEA_DOC_IDS`). **"Espectros/Cromatogramas" y
"Validación Analítica" NO tienen un id de documento propio hoy** — no se inventó uno
ni se asumió que viajan dentro de otro upload; quedan fuera del conteo (el total que
muestra el tracker es un piso, nunca cuenta de más). Gap documentado en el código,
pendiente de que Farmazed confirme cómo se suben esos dos si hace falta.

Esa misma Sección 4 también dice que el IEA recibe todo consolidado en UN solo PDF
por correo — este tracker no arma ese consolidado (cada documento se sube por
separado), así que sumar las páginas de lo ya subido es la aproximación más fiel
posible sin ese paso.

**Implementación:**
- Dependencia nueva: `pdf-lib` (pura JS, sin bindings nativos, cero dependencias
  propias) en `tracker/` y en `e2e/` (para generar PDFs reales en el spec). Contar
  páginas de un PDF de forma confiable no se puede hacer a mano sin repetir el
  trabajo de una librería ya madura — se evaluó y se decidió que valía la pena, a
  diferencia de los tests (que sí evitan dependencias nuevas a propósito).
- `tracker/utils/pdf_pages.js`: `countPdfPages(buffer)` — `null` si no es un PDF
  válido/parseable (nunca lanza, nunca bloquea la subida por esto).
- `tracker/routes/documents.js`: guarda `pageCount` en cada documento subido (PDF) y
  expone `GET /api/cases/:caseId/documents/paquete-iea` (mismo permiso
  `documents.read` que ya existía — no hizo falta un permiso nuevo) con
  `{ limite, totalPaginas, excedido, documentos }`.
- UI: `admin/expediente.html` muestra un banner "Paquete IEA: X / 150 páginas"
  (visible para todo el staff que abre el expediente — es informativo, no una acción
  con permiso propio). `wizard.js` avisa con un toast tras cada subida si se excede;
  `client-dashboard.html` (subida desde "Pendientes", TAREA 13) lo agrega al mismo
  `alert()` de confirmación. Ninguno de los dos bloquea nada.

**Pruebas:** `tracker/tests/paquete_iea.test.js` (nuevo, 4/4) con el fixture dedicado
`case-iea-test` — sube PDFs reales generados con pdf-lib, confirma la suma, que un
documento fuera del paquete no cuenta, que un archivo no-PDF no rompe el conteo
(pageCount null, se excluye), y que la subida NUNCA se bloquea aunque exceda.
`e2e/paquete_iea.spec.js` (nuevo, con capturas): el cliente sube `formula` (90p, sin
aviso) y `especificaciones` (70p, cruza a 160/150 — aparece el toast), el wizard
sigue sin bloquearse, y el admin ve el mismo conteo en `admin/expediente.html`.

**Resultado:** `./verificar_local.sh` completo — 20/20 Playwright (incluye
`paquete_iea.spec.js`), 68/68 permisos, 4/4 paquete IEA, 5/5 migración, todo en
verde.

**Estado de archivos** — nuevos: `tracker/utils/pdf_pages.js`,
`tracker/data/paquete_iea.js`, `tracker/tests/paquete_iea.test.js`,
`e2e/paquete_iea.spec.js`. Modificados: `tracker/routes/documents.js`,
`tracker/routes/cases.js` (gate §H.7), `tracker/scripts/seed_roles.js` (fixtures
`case-quote-test-sin-org`, `case-iea-test`), `tracker/tests/permissions.test.js`,
`tracker/scripts/run_permission_tests.sh`, `tracker/package.json`/`package-lock.json`
(pdf-lib), `e2e/package.json`/`package-lock.json` (pdf-lib, devDependency),
`e2e/flujo_completo.spec.js` (invitación + override puntual),
`farmazed-web/portal/js/api.js` (`getPaqueteIEA`), `farmazed-web/portal/js/wizard.js`,
`farmazed-web/client-dashboard.html`, `farmazed-web/admin/expediente.html`. Sin
commit, sin deploy.

## 2026-09-30 — TAREA 20 (cierre): ENTREGA_E1_E3.md actualizada con TAREAS 17-19

Sin código nuevo — solo documentación y respaldo, por instrucción explícita del PM.

- **`ENTREGA_E1_E3.md`** actualizada: §1 con 3 subsecciones nuevas (Formularios R14,
  Cotizaciones R5/R12, Paquete IEA R13); §2 con los conteos actuales (20 specs
  Playwright, 68 permisos, 4 paquete IEA, 5 migración); §3 con §H.6 (formularios/
  renovaciones) y §H.7 (gate de cotización siempre aplica); §4 con los 3 huecos
  documentados en TAREAS 17-19 (renovaciones sin `tipoSolicitud`, categorías de precio
  sin fila en el tarifario, paquete IEA con 2 de 7 documentos sin id propio); §5 con
  los bloques de commit 10-12 (formularios, cotizaciones, paquete IEA) y una nota sobre
  la dependencia nueva `pdf-lib` en el build del tracker (se resuelve sola vía
  `npm install`, no hace falta un paso manual — solo confirmar en el log del build);
  §6 nueva, con el resultado de la última corrida de `verificar_local.sh`.
- **Respaldo nuevo** (mismo método que el 29-sep, fuera del repo):
  `~/respaldo-farmazed/2026-09-30b/cambios.patch` (5552 líneas) + `untracked.tar.gz`
  (168 archivos sin trackear, sin `node_modules`).
- **`verificar_local.sh` corrido una vez más**, en limpio: 20/20 Playwright, 68/68
  permisos, 4/4 paquete IEA, 5/5 migración — todo en verde. Resultado pegado en
  ENTREGA_E1_E3.md §6.

Sin commit, sin deploy. Quedo en espera, como pidió el PM.

## 2026-09-30/01-oct — TAREA 21: el flujo canónico pasa a 13 fases en 5 bloques (§H.8, reemplaza §H.1/§H.3)

Zelky (vía Raion) mandó los documentos del 26-sep (`Matriz_flujo_cliente_.docx`,
`Manual_flujo_al_cliente_.docx`) que reemplazan el SVG de 14 fases del 12-sep. Esta
tarea rehace TODA la máquina de estados y todo lo que dependía de ella — el cambio más
grande de la sesión hasta ahora.

**(a) `tracker/data/case_status.js` reescrito:** 13 fases en 5 bloques (A: 1-3, B: 4-5,
C: 6-8, D: 9-10, E: 11-13) + `draft`/`submitted`/`pending_docs`/`deleted` + `cerrado`
(nuevo — cotización rechazada) + `observado_dnfd`/`aprobado`/`denegado` = 21 estados.
Transiciones: secuencial + `fase_04`→`cerrado` (motivo obligatorio) + `fase_08`→`fase_08`
(self-loop, nuevo ciclo de subsanación, SE REGISTRA como transición real aunque el
status no cambie de valor) + `fase_10`→`fase_09` (subsanación) + `fase_13`↔`observado_dnfd`
+ `fase_13`→`aprobado`|`denegado`. Nuevo: `PHASE_BLOCK`/`BLOCK_LABELS` (los 5 bloques,
consumidos por `GET /api/meta/statuses` como `blockLabels`).

**(b) Controles rehechos.** `MANUAL_PHASES = {fase_08, fase_10}` (antes fase_07/10/12).
Fase 8 exige DOS confirmaciones — legal (abogado) y técnica/matrices (regente) — antes
de que el ANALISTA pueda avanzarla a fase_09; fase 10 la confirma el analista solo
(cambió de dueño: antes la confirmaba el regente). `STAFF_EXIT_OWNER` quedó VACÍO —
ningún rol de staff que no sea analista mueve status directamente nunca (ni siquiera en
fases secuenciales sin control); abogado/regente solo registran su confirmación de
fase_08 vía el endpoint nuevo `POST /api/cases/:id/confirmaciones/fase8` (body
`{tipo:'legal'|'tecnica'}`), gateado por los permisos nuevos `cases.confirm_8_legal`/
`cases.confirm_8_tecnica` (se quitaron `cases.confirm_7`/`cases.confirm_8` viejo/
`cases.confirm_12` — ya no aplican; `cases.confirm_10` ahora es de analista). Cada
confirmación queda en `cases/{id}/confirmacionesFase8Log` además del campo
denormalizado `confirmacionesFase8` en el caso. El ciclo fase_08→fase_08 limpia las dos
confirmaciones (nuevo ciclo = requiere firmar de nuevo). 09_TABLA_PERMISOS.md
regenerada. **Bug de UI encontrado y corregido en el mismo cambio:** el guard
`if (newStatus === caseData.status)` de `admin/expediente.html` bloqueaba el propio
self-loop de fase_08 desde la interfaz (nunca se podía disparar un "nuevo ciclo" a
mano) — se agregó la excepción explícita.

**(c) Plazo de subsanación.** `tracker/utils/plazo_subsanacion.js` (nuevo): al entrar a
`observado_dnfd` calcula la fecha límite (Art. 22 D.E. 27/2024) — Regular 3 meses,
Abreviado 8 días hábiles (lunes a viernes, sin calendario de feriados de Panamá —
limitación documentada, no un bug). Cualquier otra vía queda con una NOTA en vez de una
fecha inventada. Se recalcula cada vez que se entra (puede haber más de un ciclo
fase_13↔observado_dnfd). Visible al staff (`admin/expediente.html`, banner nuevo) y al
cliente (`client-dashboard.html`, banner en el expediente expandido).

**(d) Gates reubicados.** Cotización aceptada para fase_04→fase_05: sin cambios (TAREA
18/§H.7). Pagos (`tracker/routes/payments.js`): se QUITARON los gates de fase_13 y de
salida de fase_14 — esas fases ya no existen con ese significado (fase_13 nueva es
"Seguimiento y gestión post-ingreso"; fase_14 no existe). Queda solo el gate de fase_05
(pago `cliente_a_farmazed`) — la TAREA 22 rehace el desglose por concepto (honorarios +
tasas DNFD + IEA, "en cheques separados" según §H.8). El campo `fase` de un pago sigue
aceptando `'fase_13'` como ETIQUETA (anticipo/saldo), no como fase real — las etiquetas
de UI se renombraron de "Fase 5 (anticipo)"/"Fase 13 (saldo)" a "Anticipo"/"Saldo" en
`admin/expediente.html` y "Anticipo (honorarios)"/"Saldo (honorarios)" en
`client-dashboard.html`, para no mentir sobre una fase que ya no significa eso.

**(e) `tracker/scripts/migrate_status.js` reescrito.** Legacy pre-fases → modelo nuevo,
con los mapeos exactos que dio el PM: `in_review`→`fase_08`, `faddi_ready`→`fase_11`,
`faddi_submitted`→`fase_13`, `observed`→`observado_dnfd`, `approved`→`aprobado`,
`denied`→`denegado`. `fase_14` (único valor del modelo de 14 fases que no existe en el
de 13) → `fase_12`. **Limitación documentada, no resuelta a medias:** `fase_01`..`fase_13`
son el MISMO string en el modelo viejo y el nuevo pero con significado distinto a
partir de fase_07 — el script no puede distinguir un caso ya-en-el-modelo-nuevo de uno
viejo con ese string (no hay marcador de versión de esquema, y ningún caso de
PRODUCCIÓN llegó a usar el modelo de 14 fases). Documentado en el propio script;
recomendación si hiciera falta limpiar datos locales viejos: re-sembrar, no migrar in
situ. Sigue `--dry-run`, solo emulador, idempotente.

**(f) UI actualizada — admin/bandeja/cliente.**
- `admin/expediente.html`: tarjeta nueva "Fase 8 — Confirmaciones" (botones de
  confirmar legal/técnica, solo visibles para quien tiene el permiso y falta
  confirmar), banner de plazo de subsanación, comentarios/labels de pago corregidos.
- `admin/bandeja.html`: `ACCION_LABEL`/`FASE_DE_ROL` (que asumían fase_07/12 del
  analista, fase_08 solo-abogado, fase_10 solo-regente) reescritos por completo:
  fase_08 muestra el estado de CADA confirmación por rol (abogado ve si falta la
  legal, regente si falta la técnica, analista/admin ven cuáles faltan); fase_10
  muestra "confirmar" solo para analista/admin.
- `client-dashboard.html`: el pipeline visual pasa de 4 "fases" hardcodeadas
  (Diagnóstico/Revisión/Elaboración/Obtención, con fase_14 que ya no existe) a los 5
  BLOQUES A-E reales (R9: "hitos del cliente"), leídos de
  `GET /api/meta/statuses.blockLabels` — un solo lugar define los bloques, backend y
  frontend no pueden desincronizarse. Etiquetas de pago renombradas (ver (d)). Banner
  de plazo de subsanación en el expediente expandido cuando el caso está
  `observado_dnfd`.
- `tracker/routes/meta.js`: expone `blockLabels` (nuevo).

**(g) Suite adaptada — todo en verde.**
- `tracker/scripts/seed_roles.js`: fixtures `case-org-alfa-fase08`/`-fase10`/`-fase12`
  (semántica vieja) reemplazados por `case-fase8-test`, `case-fase8-recycle-test`,
  `case-fase10-test`, `case-org-alfa-secuencial`, `case-cerrado-test`,
  `case-observado-regular-test`, `case-observado-abreviado-test`.
- `tracker/tests/permissions.test.js`: los 4 `describe()` de confirm_7/8/10/12 (67
  líneas, modelo viejo) reemplazados por: fase_08 dos confirmaciones (con endpoint
  nuevo), fase_08 self-loop limpia confirmaciones, fase_10 analista, "solo analista
  mueve status" genérico, fase_04→cerrado con motivo, observado_dnfd con las dos
  vías (Regular/Abreviado) y el round-trip a fase_13. 73/73 en verde (subió de 68).
- `e2e/global-setup.js`, `e2e/payments.spec.js`: se retiraron los fixtures/tests de
  los gates de fase_13/fase_14 (ya no existen); queda solo el de fase_05.
- `e2e/estados.spec.js`: reescrito para el journey de 13 fases — confirma fase_08 (dos
  partes) vía la nueva tarjeta UI, subsanación 10→09 (no 10→07 como antes), etc.
- `e2e/flujo_completo.spec.js`: mismo journey completo reescrito — incluye el ciclo
  fase_08 dual-confirm, subsanación 10→09, un round-trip fase_13↔observado_dnfd con
  el plazo visible, y termina en aprobado. Se quitó el paso de "pago a la autoridad en
  fase_14" (ya no existe esa fase; el desglose de tasas queda para la TAREA 22).
- `e2e/roles.spec.js`: analista ahora se prueba en fase_10 (no fase_07, que ya no es
  manual); abogado/regente se prueban en fase_08 (antes regente se probaba en
  fase_10, que ya no es su rol). **Bug de test encontrado y corregido:** dos fixtures
  nuevas (`case-fase8-test` y `case-fase8-recycle-test`) quedaron asignadas al mismo
  abogado/regente y ambas en fase_08 — un `getByText()` de página completa
  matcheaba las dos filas de la bandeja (strict mode violation); se acotó a la fila
  del producto específico.
- **Flake ya documentado, no una regresión:** `flujo_completo.spec.js` falló una vez
  corriendo la suite completa ("Execution context was destroyed") — pasó limpio 2/2
  veces corriéndolo solo. Mismo patrón de carreras de navegación/logout ya visto
  varias veces en esta sesión.

**Resultado:** `./verificar_local.sh`-equivalente corrido por partes — 18/18 Playwright
(incluye todos los specs adaptados), 73/73 permisos, 4/4 paquete IEA, 5/5 migración,
todo en verde.

**Fuera de alcance a propósito (documentado, no un olvido):**
- `tracker/routes/mcp.js` no se tocó — su `handleUpdateCase` sigue sin el gate de
  cotización (gap preexistente de TAREA 18, no de esta tarea) ni el de las
  confirmaciones de fase_08 (gap nuevo). Sin test que lo cubra hoy; documentado para
  quien retome el MCP.
- El desglose de fase_05 por concepto (honorarios/tasas DNFD/IEA, "en cheques
  separados") — TAREA 22, instrucción explícita del PM.
- El xlsx de precios del 24-sep (`Actualización de nuestros precios... - copia.xlsx`)
  con las categorías nuevas (Abreviado/Regular ampliados, renovaciones,
  modificaciones) — no se cargó en esta tarea; pendiente de tarea propia.

**Estado de archivos** — nuevos: `tracker/utils/plazo_subsanacion.js`. Reescritos:
`tracker/data/case_status.js`, `tracker/scripts/migrate_status.js`,
`e2e/estados.spec.js`, `e2e/payments.spec.js`. Modificados: `tracker/middleware/permissions.js`,
`tracker/routes/cases.js` (endpoint confirmaciones/fase8 + gates), `tracker/routes/payments.js`,
`tracker/routes/meta.js`, `tracker/scripts/generate_permissions_doc.js`,
`tracker/scripts/seed_roles.js`, `tracker/tests/permissions.test.js`,
`organizacion/09_TABLA_PERMISOS.md`, `farmazed-web/portal/js/api.js` (`confirmarFase8`),
`farmazed-web/admin/expediente.html`, `farmazed-web/admin/bandeja.html`,
`farmazed-web/client-dashboard.html`, `e2e/global-setup.js`, `e2e/flujo_completo.spec.js`,
`e2e/roles.spec.js`. Sin commit, sin deploy.

## 2026-10-01 — TAREA 22: gates de transición centralizados (ajuste del PM sobre TAREA 21)

El PM no aceptó TAREA 21 hasta cerrar un hueco de cumplimiento real: `mcp.js`
(Cowork) validaba transición y pago, pero NO exigía las dos confirmaciones de
fase_08 ni la cotización aceptada de fase_04→05 — cualquiera con `MCP_KEY` podía
saltarse esos dos controles aunque REST los bloqueara.

**Centralización — `tracker/services/transitions.js` (nuevo).** Única fuente de
verdad de los 5 gates de negocio: transición válida, pago de fase_05, cotización
aceptada de fase_04→05, motivo obligatorio de `cerrado`, y las dos confirmaciones
de fase_08. `checkTransition(caseData, caseId, to, {override, reason})` devuelve
`{ok, status, error, gatesSaltados, transitionValid, isFase8Recycle}` — nada se
repite entre rutas. `computeSideEffects()` calcula los campos derivados de ENTRAR
a un estado (reset de `confirmacionesFase8` al reciclar fase_08, fecha límite al
entrar a `observado_dnfd`) — tampoco se repiten. `afterTransition()` dispara el
único efecto que escribe en OTRA colección (el borrador de cotización al entrar a
fase_04). El permiso por ROL (`canTransitionCase` — quién puede pedir el salto)
queda a propósito FUERA de este servicio: es exclusivo de REST (usuario con rol),
MCP no tiene ese concepto (MCP_KEY ya es acceso de nivel admin).

**Tres llamadores, cero lógica duplicada:**
- `tracker/routes/cases.js` (PATCH /api/cases/:id) — reescrito para llamar a
  `checkTransition`/`computeSideEffects`/`afterTransition` en vez de repetir los
  5 gates inline (bajó ~150 líneas).
- `tracker/routes/mcp.js` (`handleUpdateCase`) — mismo cambio; ahora SÍ exige
  cotización y confirmaciones de fase_08, cerrando el hueco. `by: 'mcp'` se sigue
  escribiendo en `statusHistory` igual que antes.
- `tracker/routes/documents.js` (`POST /request`, el que dispara `pending_docs`)
  — ANTES no pasaba por ningún gate (escribía el status directo); ahora sí, con
  `override`/`reason` opcionales en el body, solo-admin, igual que cases.js. En
  la práctica solo el gate de pago puede llegar a aplicar ahí (los demás son
  específicos de otros orígenes/destinos que `pending_docs` no toca).

**Tests nuevos — `tracker/tests/transition_gates.test.js` (12 pruebas):** por
CADA uno de los 5 gates, una prueba vía REST (`PATCH /api/cases/:id`) y una vía
MCP (`POST /mcp`, `tools/call farmazed_update_case`, con `MCP_KEY` del emulador)
que confirman que ambas vías bloquean igual sin `override` — más 2 pruebas de que
`override:true` fuerza el salto en las dos vías. Corre con
`tracker/scripts/run_permission_tests.sh`, que ahora también arranca el tracker
con `MCP_KEY` fijo (`dev-mcp-local`, ya lo hacía) y lo pasa al test nuevo como
`FZ_MCP_KEY`. Fixtures dedicados en `seed_roles.js`: `case-gate-{transicion,pago,
cotizacion,cerrado,fase8}-{rest,mcp}` (10 casos, uno por gate y por vía).

**Por qué la suite Playwright bajó de 20 a 18 specs (pregunta directa del PM):**
NINGÚN archivo de spec se borró ni se fusionó — los 10 archivos siguen todos. Lo
que bajó es el CONTEO de tests dentro de `e2e/payments.spec.js`: tenía 3 (fase_05,
fase_13, fase_14) y en TAREA 21 quedó en 1 (solo fase_05), porque los gates de
fase_13/fase_14 se QUITARON del código (ya no existen con ese significado en el
modelo de 13 fases — instrucción explícita del PM en TAREA 21: "QUITA el gate de
fase_13 y el de salida de fase_14"). 20 − 2 = 18, exacto. Ningún otro archivo
cambió su número de tests (aunque varios — estados/flujo_completo/roles —
cambiaron bastante de CONTENIDO para el journey de 13 fases).

**Resultado:** 18/18 Playwright + 73/73 permisos + 4/4 paquete IEA + 12/12 gates
nuevos + 5/5 migración, todo en verde en el primer intento (sin necesitar ningún
fix posterior — ni siquiera el flake ya documentado de flujo_completo.spec.js
apareció esta vez).

**Estado de archivos** — nuevos: `tracker/services/transitions.js`,
`tracker/tests/transition_gates.test.js`. Modificados: `tracker/routes/cases.js`
(refactor grande), `tracker/routes/mcp.js` (gates nuevos), `tracker/routes/documents.js`
(gate nuevo en `pending_docs`), `tracker/scripts/seed_roles.js` (10 fixtures),
`tracker/scripts/run_permission_tests.sh` (arranca `transition_gates.test.js`).
Sin commit, sin deploy.

---

## TAREA 23 — Pagos por concepto y precios nuevos (§H.8, PM_COMMENTS parte
Pagos y Precios) — 29-sep

### (a) Pagos por CONCEPTO — reemplaza el modelo por `fase` de TAREA 21/22

Cada registro `cliente_a_farmazed` ahora lleva un `concepto` (no `fase`):
`honorarios | tasa_dnfd (B/.200) | mef (B/.25, solo extranjero) | iea (B/.1500
regular / B/.2250 expedita, solo si aplica) | honorarios_saldo` (informativo, NO
bloquea — instrucción explícita del PM). Cheques separados = registros
separados, cada uno con su propio comprobante. `tracker/routes/payments.js`:
`CONCEPTOS_CLIENTE`, `MONTOS_REFERENCIA` (los montos oficiales son solo
referencia de UI — el admin registra el monto real del cheque, nunca se valida
contra esto); `hasConceptPayment(caseId, concepto)` reemplaza el viejo
`hasRequiredPayment`/`GATES_PAGO`/`describeGate` (retirados — ya no tenían
sentido con un gate por concepto).

**De dónde sale qué concepto es obligatorio:** de la línea de la cotización
ACEPTADA del caso (`tracker/routes/quotes.js`) — 3 campos nuevos por línea:
`esExtranjero` (bool), `aplicaIEA` (bool), `modalidadIEA`
(`'regular'|'expedita'|null`, forzado a `null` si `aplicaIEA` es falso).
Editables vía `PATCH /api/quotes/:id/lineas/:caseId` (mismo endpoint de TAREA
18, body extendido). Nuevo helper exportado `getAcceptedQuoteLineForCase(caseId)`.

**Gate de fase_05 — ahora vive por completo en `tracker/services/transitions.js`**
(antes llamaba a `hasRequiredPayment` genérico de payments.js; ese generic ya no
existe). `conceptosRequeridosFase05(linea)`: honorarios + tasa_dnfd SIEMPRE; +
mef si `esExtranjero`; + iea si `aplicaIEA`. Si no hay cotización aceptada
(override pasado el gate de fase_04, o caso sin orgId forzado), la línea es
`null` y el gate cae a la base (honorarios + tasa_dnfd) — no inventa un
requisito que no puede sustentar. El mensaje de error lista los conceptos que
faltan (`"...sin registrar el pago de: mef, iea."`), no un texto genérico.

**UI:** `admin/expediente.html` — el selector de pago pasó de "Fase que cubre"
(fase_05/fase_13) a "Concepto" (los 5 de arriba); nuevo bloque
`#payments-resumen` (solo admin, `has('quotes.read')`) que muestra cada concepto
requerido con badge ✓/pendiente, leyendo la cotización aceptada del caso.
`admin/cotizaciones.html` — checkboxes "Extranjero (MEF)"/"Aplica IEA" + select
de modalidad por línea, guardados junto con honorarios/tasas en el mismo botón
"Guardar". `client-dashboard.html` — el bloque "Pagos" del expediente pasó de 2
badges fijos (Anticipo/Saldo) a una fila por CONCEPTO (`pagoBadge` ahora acepta
`null` = "No aplica", para mef/iea cuando la cotización no los marca — nunca se
muestra como "pendiente" algo que nunca va a pagarse).

### (b) Precios — tarifario del xlsx 24-sep, SOLO emulador

`tracker/scripts/seed_pricing_24sep.js` (nuevo, ~910 líneas, ids con sufijo
`_24sep`) carga las 53 filas de
`_Zelky-Drive-2026-09-25/F04-Actualización de nuestros precios para la
plataforma - copia.xlsx` (24-sep) en la colección `pricing` del EMULADOR —
**`tracker/seed_pricing.js` (prod, 12-sep) no se tocó**, cero riesgo de precio
en producción. Parseado con un parser XLSX propio (`zipfile` + XML de Python,
sin librerías nuevas — `pip install` está bloqueado por PEP 668 en esta
máquina): lee `sharedStrings.xml` + `sheet1.xml` directo, incluida la celda
`#REF!` cacheada de Excel.

`organizacion/10_DIFF_PRECIOS_24SEP.md` (nuevo): categoría por categoría, viejo
vs. nuevo. Hallazgos:
- **3 diferencias de precio reales** (no solo de agrupación): Mutuo Acuerdo
  B/.4,580→**4,130** (-450, se separó de WLA WHO que se queda en 4,580);
  Síntesis Química Regular B/.3,930→**4,130** (+200); Intercambiabilidad
  B/.4,030→**3,880** (-150).
- **2 inconsistencias DENTRO del xlsx** (el total declarado no cuadra con la
  suma de sus propias columnas — filas 5 y 7): se cargó la suma de componentes,
  no el total declarado (más confiable tras una edición desactualizada);
  reportado para que Zelky lo revise.
- **La fila "Renovación de registro sanitario por trámite abreviado" tiene
  `#REF!`** en el xlsx original (IEA/Total de tasas/Total general rotos en la
  fuente) — se cargó `iea: null` y `total: null`, **no se inventó un número**
  (mismo criterio de TAREA 17/19). *Nota de proceso: mi primer borrador del
  script de diff mostró por error un total fabricado (3,125, sumando el resto
  de componentes e ignorando el `#REF!`) para esta fila — lo detecté al
  revisar el propio documento antes de entregarlo y lo corregí a "sin dato" en
  `organizacion/10_DIFF_PRECIOS_24SEP.md` antes de que llegara a nadie; el
  archivo `seed_pricing_24sep.js` (los datos que de verdad carga el emulador)
  nunca tuvo el error — estaba bien desde el primer borrador.*
- ~39 categorías que el xlsx AGREGA sin equivalente viejo (Renovaciones — 8
  filas, categoría completa nueva; Modificaciones — 27 filas, categoría
  completa nueva; más Cosméticos-10-variedades y Prioridad-innovadores).
- Sigue sin resolver (ya anotado en §H.8 antes de esta tarea): Regular+
  Biológicos/Homeopático/Suplementos/Vacuna y Abreviado+Vacuna/Contraste/Gas
  Medicinal/Naturales — `resolverCategoriaPrecio()` los sigue devolviendo
  `null`, el xlsx 24-sep tampoco los trae.

**`resolverCategoriaPrecio()` (tracker/routes/quotes.js) actualizado** — pero
con una decisión de diseño explícita para no arriesgar producción: resuelve a
los ids `_24sep` (más finos — separan Mutuo Acuerdo/WLA WHO,
Suplementos/Homeopático/Radiofármaco, Naturales/Gas/Contraste, que antes
compartían una sola fila) **solo si `FIRESTORE_EMULATOR_HOST` está definido**
(`TARIFARIO_24SEP`, mismo criterio de guarda que ya usan todos los scripts de
seed/migración de esta sesión); fuera del emulador (si esto llegara a correr
contra producción) devuelve exactamente los ids viejos de siempre, sin cambio
de comportamiento. Como HOY todo (dev, tests, e2e) corre contra el emulador,
esto SÍ cambió los ids que ven las pruebas existentes — actualicé 3
aserciones en `permissions.test.js` (categoriaPrecio esperado + 2 totales que
subieron 200 por el cambio real de precio de Síntesis Química Regular).

`tracker/scripts/seed_emulador.js` ahora también corre
`seed_pricing_24sep.js` después de `seed_pricing.js` (mismo patrón,
`execFileSync`) — se siembra automáticamente en cualquier corrida de
`e2e/run.sh` o `run_permission_tests.sh`, sin paso manual.

### (c) Tests

- `tracker/tests/payment_concepts.test.js` (nuevo, 6 pruebas): fixtures
  dedicados `case-gate-pago-concepto-{rest,mcp}` (org Beta, para no chocar con
  el locator "Laboratorios Alfa" de `quotes.spec.js` — ver nota de bug abajo)
  con una cotización 'aceptada' sembrada directo con `esExtranjero:true,
  aplicaIEA:true, modalidadIEA:'expedita'`, así el gate exige los 4 conceptos.
  Por CADA vía (REST y MCP): sin pagos bloquea mencionando los 4; con 3 de 4
  sigue bloqueado por el que falta; con los 4, avanza. MCP no tiene un tool
  para registrar pagos (por diseño — ver `tracker/routes/mcp.js`), así que los
  pagos siempre se registran vía REST y se prueba que MCP VE los mismos pagos
  que REST escribió (no hay una vía "MCP" de pago separada que probar).
- `tracker/tests/permissions.test.js` — 3 aserciones actualizadas (arriba).
- `e2e/payments.spec.js` (reescrito): ahora demuestra la granularidad por
  concepto — bloqueado sin nada → bloqueado con solo "honorarios" (falta
  "tasa_dnfd") → desbloqueado con ambos → el cliente ve cada concepto por
  separado. Capturas en `sessions/2026-09-29/`.
- `e2e/flujo_completo.spec.js` — los 2 `registerPayment()` (antes
  `fase:'fase_05'`/`fase:'fase_13'`) pasan a `concepto:'honorarios'` +
  `concepto:'tasa_dnfd'` (fase_05, sin cotización aceptada — llegó por
  override — así que el gate es la base de 2) y `concepto:'honorarios_saldo'`
  (fase_13, informativo). Conteos de badges actualizados (2 checks
  intermedios + el final).

**Bug real encontrado y corregido durante la verificación:** las 2 cotizaciones
'aceptada' nuevas de `payment_concepts.test.js` se sembraron primero en org
Alfa — `admin/cotizaciones.html` (que `e2e/quotes.spec.js` recorre con un
locator `.quote-card` filtrado por texto "Laboratorios Alfa") pasó de 1 a 3
tarjetas, y Playwright lo marcó como violación de "strict mode" (locator
ambiguo). Se movieron esos 2 fixtures a org Beta (el token admin/MCP que usan
esos tests no depende de organización) — re-corrida limpia.

**Resultado final:** 18/18 Playwright + 73/73 permisos + 4/4 paquete IEA +
12/12 gates de transición + **6/6 pago por concepto (nuevo)** + 5/5 migración —
todo en verde. (El único fallo visto en el camino, en
`document_versions.spec.js` por "Invalid or expired token", es el flake ya
documentado de sesiones anteriores — desapareció en la re-corrida limpia, no
relacionado con esta tarea.)

**No hecho / fuera de alcance de esta tarea** (para que quede explícito, no
hay nada escondido):
- No se conectaron Renovaciones/Modificaciones a `resolverCategoriaPrecio()`
  — el caso no tiene forma de marcarse como "Renovación" (`tipoSolicitud` fijo
  en 'Nuevo Registro', gap de TAREA 17/§H.6) ni de indicar QUÉ modificación
  específica (27 tipos, sin campo en el modelo de caso). Se cargaron al
  tarifario para que el admin las asigne a mano.
- No se agregó ninguna reconciliación automática entre el total agregado de
  la línea de cotización (`tasasOficiales`) y la suma de los pagos por
  concepto — son dos cosas distintas a propósito (uno es el tarifario
  congelado de la línea, el otro es lo que de verdad se cobró en cheques
  reales) y el PM no pidió esa validación cruzada para esta tarea.

**Estado de archivos** — nuevos: `tracker/scripts/seed_pricing_24sep.js`,
`organizacion/10_DIFF_PRECIOS_24SEP.md`, `tracker/tests/payment_concepts.test.js`.
Modificados: `tracker/routes/payments.js` (concepto reemplaza fase),
`tracker/routes/quotes.js` (esExtranjero/aplicaIEA/modalidadIEA +
`resolverCategoriaPrecio` con ids `_24sep` bajo emulador),
`tracker/services/transitions.js` (gate de fase_05 concept-aware),
`tracker/scripts/seed_emulador.js` (siembra el tarifario 24-sep),
`tracker/scripts/seed_roles.js` (2 fixtures + 2 cotizaciones sembradas),
`tracker/scripts/run_permission_tests.sh` (corre el test nuevo),
`tracker/tests/permissions.test.js` (3 aserciones), `farmazed-web/portal/js/api.js`
(`registerPayment` concepto en vez de fase), `farmazed-web/admin/expediente.html`,
`farmazed-web/admin/cotizaciones.html`, `farmazed-web/client-dashboard.html`,
`e2e/payments.spec.js` (reescrito), `e2e/flujo_completo.spec.js`. Sin commit,
sin deploy.

### Ajuste del PM (mismo día): `PRICING_TABLE` explícita, no atada al entorno

TAREA 23 aceptada, con 1 corrección: qué tarifario está activo
(`TARIFARIO_24SEP` en `resolverCategoriaPrecio()`) miraba
`FIRESTORE_EMULATOR_HOST` — ata una decisión de NEGOCIO al entorno técnico. Se
cambió a una variable explícita: `PRICING_TABLE=24sep` activa el tarifario
nuevo; cualquier otro valor (incluida la variable sin definir) usa el de
siempre — así Rick lo enciende en producción con un solo cambio de variable de
entorno en Cloud Run cuando lo apruebe, sin que dependa de si el proceso corre
contra el emulador.

Cambios: `tracker/routes/quotes.js` (`TARIFARIO_24SEP = process.env.PRICING_TABLE
=== '24sep'`), `tracker/scripts/run_permission_tests.sh` y `e2e/run.sh`
(arrancan el tracker con `PRICING_TABLE=24sep` para que las pruebas sigan
viendo el tarifario nuevo), `DEV_LOCAL.md` y `tracker/.env.example`
(documentan la variable). `ENTREGA_E1_E3.md` (Bloque 3, plan de deploy):
nota explícita de que el deploy normal deja el tarifario de SIEMPRE activo
(la variable no existe en Cloud Run hoy) y el comando exacto
(`gcloud run services update ... --update-env-vars PRICING_TABLE=24sep`)
para cuando Rick apruebe promoverlo — con la advertencia de que antes de
encenderla alguien tiene que sembrar esas categorías en la colección
`pricing` de producción (hoy solo existen en el seed del emulador).

Re-verificado tras el cambio: 18/18 Playwright + 73/73 permisos + 4/4 IEA +
12/12 gates + 6/6 pago-por-concepto + 5/5 migración — el único fallo del
camino (`flujo_completo.spec.js`, "Execution context was destroyed" en el
logout de la corrida completa) es el flake ya documentado de sesiones
anteriores, confirmado al pasar limpio en una re-corrida aislada del mismo
spec. Sin commit, sin deploy.

---

## TAREA 24 — Auditoría del checklist contra las matrices nuevas de Zelky
(Síntesis Química + Biológicos/Biotecnológicos) — 29-sep, SOLO DIAGNÓSTICO

Instrucción explícita del PM: comparar `tracker/data/faddi_checklists.js`
requisito por requisito contra dos matrices nuevas de Zelky (28-sep) —
`Matriz_SQ_anexo1.docx` (Drive, id `1ox97pJUm0nVHKKpdyG8DbX8mdNffRHLo`, leída
con el conector de Google Drive) y `References/matrices_zelky_2026-09-28/
Matriz_BIO_anexo1.md` (ya en el repo) — **sin tocar el checklist todavía**
("primero reviso la auditoría", instrucción textual del PM). Solo registro
nuevo (renovaciones/modificaciones fuera de alcance, §H.6).

Entregado: **`organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md`** — tabla
requisito-por-requisito para SQ y para BIO (N.° de la matriz, fundamento, vía,
estado ESTA/FALTA/SOBRA/DISTINTO/N/A, nota), más una sección de "hallazgos
transversales" que aplican a ambas.

**Los 3 hallazgos más accionables:**
1. **`recibo_iea` (pago del IEA) no distingue Regular de Abreviado en NINGÚN
   subtipo del checklist** — la matriz BIO-03 dice explícitamente "en
   procedimiento ABREVIADO: no aplica" (D.E. 29/2023 Art. 6: en abreviado no
   se requieren ensayos analíticos previos), pero `DOC_RECIBO_IEA` es
   `required:true` fijo sin mirar `tipoRegistro`, para Síntesis Química,
   Biológicos, Biotecnológicos, Homeopático, Medio de Contraste y Gas
   Medicinal.
2. **Colisión de `faddiCode` 15.14 sin señalar en el código** — `otros_docs`
   (base), `declaracion_paises` (Huérfanos) y `aprobacion_arr` (Abreviado)
   comparten el mismo código; un caso Abreviado dispara `otros_docs` Y
   `aprobacion_arr` a la vez con el mismo `faddiCode`. Las otras 2 colisiones
   conocidas (15.16, 15.11) ya estaban marcadas `PENDIENTE_VERIFICAR` en el
   código; esta no.
3. **Biológicos y Biotecnológicos son un solo `tipoMedicamento` separado en
   el checklist, pero la matriz de Zelky los trata como UNA sola categoría
   unificada** — asimetría concreta: `farmacovigilancia_bio` (15.20) solo
   existe para `'Biotecnológicos'`, aunque BIO-29 (Plan de farmacovigilancia)
   no distingue entre los dos en la matriz.

Además: 3 `FALTA` claros en SQ (protección de datos, especificaciones de
principio activo/materias primas, bioequivalencia — este último con el
`⚠ VERIFICAR` propio de Zelky sin resolver), 7 `FALTA` claros en BIO
(protección de datos, declaración jurada de identidad para Abreviado,
especificaciones de fuentes del PA/banco de células, especificaciones de
excipientes, ausencia de agentes patógenos, ausencia de materias primas EET,
programa de gestión de riesgo — este último solo insinuado dentro de la
descripción de `farmacovigilancia_bio`, nunca como documento propio), y el
único `⚠ VERIFICAR` que la propia matriz BIO deja pendiente
(`BIO-S/N-1`, especificación de calidad/pureza del principio activo) se
transcribió tal cual, sin intentar resolverlo.

**No hecho, por instrucción explícita:** no se tocó `faddi_checklists.js` (el
PM revisa primero); no se auditó `Vacuna` (fuera de alcance de esta tarea);
Renovaciones/Modificaciones siguen fuera (§H.6). Sin commit, sin deploy.

---

## TAREA 25 — Aplicar la auditoría al checklist (PM_COMMENTS §H.9) — 30-sep

El PM aceptó TAREA 24 y registró 5 decisiones en §H.9 sobre qué aplicar de la
auditoría (`organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md`). Esta tarea las
aplicó todas a `tracker/data/faddi_checklists.js` — la auditoría quedó
actualizada con una columna **"Aplicado en TAREA 25"** por fila (qué se tocó,
qué se dejó igual y por qué).

### (1) `recibo_iea` deja de depender del subtipo

Antes: `DOC_RECIBO_IEA` era una constante fija (`required:true` siempre) que
cada subtipo incluía o excluía a mano en su propia lista (Suplementos,
Productos Naturales, Huérfanos, Vacuna y Radiofármaco lo excluían; los demás
lo exigían siempre, **incluso en Abreviado**, que era el bug más concreto de
la auditoría — BIO-03 dice explícito que en Abreviado no aplica).

Ahora: `docReciboIea(aplicaIEA)` (función, no constante) — tres estados:
`aplicaIEA===true` → `required:true`; `aplicaIEA===false` → no aplica,
`required:false` con motivo; `aplicaIEA===undefined` (sin cotización aceptada
todavía) → `required:false`, `condition:'Por confirmar: depende de si la
cotización marca IEA...'`. Se agrega UNA vez en `getChecklist()`, para
**cualquier** subtipo de medicamentos — ya no vive en las listas por subtipo.
`aplicaIEA` sale de `getAcceptedQuoteLineForCase(caseId)` (quotes.js, ya
existía desde TAREA 23) — los 3 llamadores de `getChecklist()`
(`cases.js` GET /:id, GET /:id/checklist, `mcp.js` `handleGetCase`) ahora
hacen ese fetch primero y pasan `aplicaIEA: linea?.aplicaIEA`.

### (2) Las 3 colisiones de `faddiCode` 15.14

`otros_docs`, `declaracion_paises` (Huérfanos) y `aprobacion_arr` (Abreviado)
compartían el código `15.14` — un caso Abreviado con Huérfanos disparaba los
3 a la vez. Los 3 quedaron `faddiCode: 'PENDIENTE_VERIFICAR'`, mismo criterio
que las otras 2 colisiones ya conocidas (`etiquetas`/`patrones` en 15.16,
`contrato_fabricacion`/`monografia` en 15.11).

### (3) Biológicos y Biotecnológicos: los mismos requisitos

Antes cada uno tenía su propia lista en `MED_VARIABLE_BY_SUBTYPE`, con
`farmacovigilancia_bio` solo en Biotecnológicos. Ahora ambos apuntan al
MISMO array (`MED_BIO_DOCS`) — cualquier documento que se agregue a uno
automáticamente aplica al otro, sin volver a divergir por accidente.

### (4) Los FALTA de la auditoría, agregados

**SQ (2):** `proteccion_datos` (opcional, Dec. 1389/2012 Art. 5),
`especificaciones_pa` (obligatorio, distinto de `especificaciones` que es
del producto terminado — Res. 126 núm. 7.6; D.E. 27/2024 Art. 78).

**BIO (7):** `proteccion_datos` (compartido con SQ),
`declaracion_identidad_abreviado` (obligatorio, **solo Abreviado** — mismo
patrón de código que `cert_analisis`/SQ: se agrega en el bloque
`if (tipoRegistro==='Abreviado')`, no en `MED_BIO_DOCS`),
`especificaciones_fuentes_pa`, `especificaciones_excipientes`,
`ausencia_agentes_patogenos`, `ausencia_materias_primas_eet`,
`programa_gestion_riesgo` (los 6 últimos obligatorios, en `MED_BIO_DOCS`).

Todos con `responsable:'cliente'` (por default), `faddiCode:
'PENDIENTE_VERIFICAR'` (ninguna matriz trae un código FADDI real) y el
fundamento normativo (N.° de la matriz + artículo/decreto) en la
`description` — no un texto genérico.

### (5) Los `⚠ VERIFICAR` de Zelky, opcionales con nota

`bioequivalencia` (SQ-15) y `especificacion_calidad_pureza_pa` (BIO-S/N-1):
`required:false`, `condition:'Farmazed confirma si aplica'` — no se resuelve
la pregunta de Zelky, solo se deja de bloquear por ella.

### Tabla antes/después (conteo total de documentos del checklist por combinación)

| Subtipo | Vía | Antes | Después | Diferencia |
|---|---|---:|---:|---|
| Síntesis Química | Regular | 22 | 25 | +3 (proteccion_datos, especificaciones_pa, bioequivalencia) |
| Síntesis Química | Abreviado | 24 | 27 | +3 (mismos 3 — recibo_iea/aprobacion_arr/cert_analisis sin cambio de conteo) |
| Biológicos | Regular | 25 | 33 | +8 (farmacovigilancia_bio, que antes solo tenía Biotecnológicos, + los 7 FALTA) |
| Biológicos | Abreviado | — | 35 | +2 sobre Regular (aprobacion_arr + declaracion_identidad_abreviado) |
| Biotecnológicos | Regular | 26 | 33 | +7 (los 7 FALTA — ya tenía farmacovigilancia_bio) |
| Biotecnológicos | Abreviado | — | 35 | +2 sobre Regular (aprobacion_arr + declaracion_identidad_abreviado) |
| Huérfanos | Regular | 23 | 24 | +1 (recibo_iea, que antes excluía por completo — ahora "por confirmar") |

(Biológicos y Biotecnológicos ya dan el MISMO número — confirma la decisión 3.
Huérfanos no estaba en el alcance de la auditoría, pero decisión 1 es
universal — se incluye para mostrar el efecto colateral esperado, no un bug.)

### Tests

- **`tracker/tests/checklist_tarea25.test.js`** (nuevo, 17 pruebas) — unitario
  PURO sobre `getChecklist()` (no usa emulador ni HTTP, corre standalone con
  `node --test`): cubre las 5 decisiones una por una (recibo_iea en sus 3
  estados incluso en subtipos que antes lo excluían por completo; las 3
  colisiones de 15.14 en `PENDIENTE_VERIFICAR`; Biológicos===Biotecnológicos
  documento por documento; los 9 FALTA presentes con su fundamento en la
  descripción; los 2 `⚠ VERIFICAR` opcionales con la nota exacta) + una
  prueba de no-regresión (trámites no-medicamentos no tienen `recibo_iea`).
  Agregado a `run_permission_tests.sh`.
- **`e2e/checklist_recibo_iea.spec.js`** (nuevo) — flujo real completo:
  2 casos nuevos (`case-checklist-iea-si`/`-no`, org Beta, seed_roles.js) en
  fase_03 → fase_04 (dispara el borrador de cotización) → admin marca
  "Aplica IEA" SOLO en uno vía `admin/cotizaciones.html` (checkbox de TAREA
  23) → envía y el cliente acepta → el checklist de `admin/expediente.html`
  muestra `recibo_iea` obligatorio en el caso marcado y "(opcional)" en el
  otro — antes de aceptar la cotización, los dos lo mostraban "(opcional)"
  por igual. Capturas en `sessions/2026-09-30/`.
- **3 specs existentes actualizados** (`e2e/checklist.spec.js`,
  `e2e/flujo_completo.spec.js`, `e2e/paquete_iea.spec.js`): sus listas
  `CLIENTE_REQUIRED_IDS` (documentos que se suben para desbloquear
  `#btn-next`) pasaron de 15 a 16 — les faltaba `especificaciones_pa`, el
  nuevo obligatorio de Síntesis Química.
- **Bug de test encontrado y corregido**: `flujo_completo.spec.js` tenía
  `otros_docsItem.getByText('Ver')` — Playwright hace match por substring,
  y `'PENDIENTE_VERIFICAR'` (el nuevo `faddiCode` de `otros_docs`) contiene
  "ver" como substring, así que el locator empezó a resolver 2 elementos
  (strict-mode violation). Se acotó a `.locator('a', { hasText: 'Ver' })`.

**Resultado final:** 18/19 Playwright + 73/73 permisos + 4/4 IEA + 12/12
gates + 6/6 pago-por-concepto + **17/17 checklist (nuevo)** + 5/5 migración.
El único fallo (`flujo_completo.spec.js`, a veces `document_versions.spec.js`
o `paquete_iea.spec.js`) es el mismo flake de navegación login/logout ya
documentado muchas veces en esta sesión — confirmado de nuevo: cada uno de
los 3 pasó limpio en una re-corrida aislada; nunca falla dos veces seguidas
por el mismo motivo, y el motivo exacto cambia de corrida en corrida (a veces
"Execution context was destroyed", a veces "net::ERR_ABORTED", a veces
"dialog.accept: Not attached to an active page") — todos síntomas de la misma
carrera de navegación bajo carga con 1 worker, no de este código.

**No aplicado** (documentado con su motivo exacto en la columna de
`organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md`, fila por fila): las 3
diferencias de redacción/contenido (BIO-12/13/20), la separación
monografía/inserto (SQ-18), el gate `cert_analisis`-solo-Abreviado de SQ
(SQ-19 — "verificar con Zelky antes de tocar el código", instrucción propia
de la auditoría, no tocado), el `required` fijo de `patrones`/`almacenamiento`
(BIO-55/31), separar el poder en dos documentos (BIO-04), y los 2 FALTA
condicionados a un campo "innovador" que el modelo de caso no tiene
(SQ-33/34, fuera de pedido de esta tarea). Vacuna sigue fuera de alcance.
Renovaciones/Modificaciones siguen fuera (§H.6). Sin commit, sin deploy.

---

## TAREA 26 — Cierre de la ronda: flake de e2e, `esInnovador`, ENTREGA y
respaldo — 30-sep

Instrucción del PM en 4 partes. Se hicieron las 4; la parte 1 (flake) quedó
con 2 causas reales corregidas y una tercera de infraestructura, más una
limitación real de la máquina que no se puede "arreglar" con código.

### (1) Flake de login/logout — causa raíz

Encontrado y corregido en **3 capas**, ninguna es un retry ni un timeout más
alto:

1. **Condición de carrera evaluate()+navegación (9 archivos de specs).**
   `logout()` (en `portal/js/auth.js`) hace `signOut()` y después
   `window.location.href = '/login.html'` — TODOS los specs disparaban esto
   dentro de `page.evaluate()` y esperaban a que el propio `evaluate()`
   resolviera ANTES de armar `page.waitForURL(...)`. Cuando la navegación
   ocurre DENTRO de `evaluate()`, a veces destruye el execution context antes
   de que `evaluate()` pueda devolver su valor — Playwright lo reporta como
   `"Execution context was destroyed"`, y el `login()` siguiente hereda la
   carrera con síntomas distintos (`net::ERR_ABORTED`, `"dialog.accept: Not
   attached to an active page"`). Arreglo: armar `page.waitForURL(...)` ANTES
   de disparar el `evaluate()`, en paralelo (`Promise.all`), e ignorar el
   rechazo del `evaluate()` — lo único que importa es que la navegación
   ocurrió de verdad. Aplicado en los 9 archivos que tenían el patrón viejo
   (de 3 variantes distintas: await completo, fire-and-forget con `.then()`,
   y una mezcla): `checklist_recibo_iea.spec.js`, `payments.spec.js`,
   `quotes.spec.js`, `paquete_iea.spec.js`, `flujo_completo.spec.js`,
   `checklist.spec.js`, `roles.spec.js`, `pricing.spec.js`,
   `document_versions.spec.js`.
2. **Bug real de producción, no solo de las pruebas — `getToken()` en
   `farmazed-web/portal/js/auth.js`.** Justo después de un redirect a una
   página nueva (login exitoso → dashboard), el módulo de `auth.js` de ESA
   página arranca con `_currentUser = null` — se llena recién cuando
   `onAuthStateChanged` dispara de forma ASÍNCRONA al restaurar la sesión
   persistida de Firebase. `getToken()` miraba `_currentUser` directo: si
   algo pedía un token en esa ventana (en las pruebas: `uploadAs()` justo
   después de `login()`; en la vida real: un clic del cliente inmediatamente
   después de entrar al dashboard, en una conexión lenta), devolvía `null`
   sin intentarlo — el backend rechazaba con "Invalid or expired token".
   Arreglo: `getToken()` ahora hace `await auth.authStateReady()` (API de
   Firebase v10.7+, pensada exactamente para esto) antes de mirar
   `auth.currentUser` — la fuente de verdad real de Firebase, no una
   variable de módulo que puede ir un paso atrás.
3. **Infra: `e2e/run.sh` arrancaba el frontend estático con un `sleep 1` sin
   verificar nada.** Bajo carga del host, 1 segundo no siempre alcanza para
   que `python3 -m http.server` esté aceptando conexiones cuando Playwright
   hace su primer `page.goto()`. Reemplazado por el mismo patrón de
   reintentos con `curl` que ya usan los emuladores y el tracker (hasta 15
   intentos de 1s, con `❌` y log si nunca arranca) — no es un timeout más
   largo "a ciegas", es esperar a que el proceso real esté listo.

**Lo que NO se pudo arreglar con código — limitación real de la máquina,
documentada con evidencia, no una excusa:** Patch es una máquina compartida
(18 usuarios conectados a la vez en las corridas de esta tarea, confirmado
con `uptime`/`who`). Durante las verificaciones de esta tarea el load average
subió de 6.7 a 16.1 y el swap (8 GiB) estuvo permanentemente saturado —
confirmé que NINGÚN proceso mío quedó huérfano entre corridas (`ps aux` sin
emuladores/tracker/playwright colgados). Con los 3 arreglos de arriba, varias
corridas completas pasaron limpias; pero en corridas con la máquina bajo
carga alta, sigue apareciendo un fallo — siempre en el PRIMER test de la
corrida, siempre con un síntoma distinto cada vez (a veces
`"Execution context was destroyed"`, a veces `net::ERR_ABORTED`, a veces
`"dialog.accept: Not attached to an active page"`), y NUNCA en una corrida
aislada del mismo spec (confirmado repetidas veces). Eso es la firma de
contención de recursos del host, no de un bug determinista de la app —
**no cumplí el criterio de aceptación de "3 corridas seguidas sin fallos"**,
y no intenté forzarlo con reintentos ni timeouts porque la instrucción del
PM lo prohibía explícitamente y hacerlo habría escondido el síntoma sin
arreglar nada real. Si Rick quiere una corrida 100% limpia para algo
puntual, mejor en un momento de menos carga en Patch — aviso al PM de este
resultado en vez de reportar un falso "arreglado".

### (2) Campo `esInnovador` — staff lo confirma en fase 3, junto con vía y categoría

- **Modelo**: `esInnovador` (boolean) en el caso. Tri-estado igual que
  `aplicaIEA` (TAREA 25): `true` = obligatorio, `false` = no aplica,
  `undefined` = "por confirmar" (no bloquea).
- **Quién lo edita**: antes, el staff (analista/abogado/regente) solo podía
  tocar `status`/`notes`/`faddi` de un caso — ni siquiera podía corregir
  `tipoRegistro`/`tipoMedicamento`, pese a que fase_03 ("Tipo de registro
  sanitario y ruta de registro", §H.8) es responsabilidad de Farmazed, no
  del cliente. Se agregaron los 3 campos (`tipoRegistro`, `tipoMedicamento`,
  `esInnovador`) a `STAFF_FIELDS` en `tracker/routes/cases.js`, con un
  permiso nuevo `cases.edit_via_categoria` (`tracker/middleware/
  permissions.js`, roles: analista/abogado/regente/admin — no se restringió
  a un rol de staff específico porque el resto de `STAFF_FIELDS` tampoco lo
  hace). `organizacion/09_TABLA_PERMISOS.md` regenerado con el script
  existente.
- **Checklist**: se aplicaron los 2 FALTA de SQ que quedaron pendientes en
  TAREA 25 — `docEstudiosClinicosSQ(esInnovador)` (matriz SQ ítem 33) y
  `docResumenSeguridadSQ(esInnovador)` (matriz SQ ítem 34), mismo patrón
  tri-estado que `docReciboIea`. Solo para Síntesis Química (la auditoría no
  encontró este gap en BIO ni en otro subtipo). `getChecklist()` recibe
  `esInnovador` como opción nueva; los 3 llamadores (`cases.js` GET /:id,
  GET /:id/checklist, `mcp.js` `handleGetCase`) pasan `data.esInnovador`
  directo (a diferencia de `aplicaIEA`, este campo vive en el caso mismo, no
  hace falta ir a buscar la cotización).
- **UI nueva** — `admin/expediente.html`, tarjeta "Vía y Categoría — Fase 3"
  (gateada por `cases.edit_via_categoria`, solo visible para trámites
  `medicamentos`): select de vía, checkboxes de categoría (mismo listado
  `TIPOS_MED` que usa el wizard del cliente, para no divergir), select de
  "¿Es innovador?" con 3 opciones (Por confirmar/Sí/No), botón Guardar.
  **Bug encontrado y corregido en el camino**: `PATCH /api/cases/:id`
  devuelve solo los campos actualizados (`{id, ...update}`), no el caso
  completo — el primer borrador del handler hacía `caseData = updated`,
  que hubiera borrado `tramiteType`/`status`/`product`/etc. de la variable
  en memoria y roto `render()`. Corregido a `Object.assign(caseData,
  updated)` (mismo patrón que ya usan `btn-save-assign`/`btn-save-faddi`).
- **`resolverCategoriaPrecio()` (tracker/routes/quotes.js) — decisión
  explícita de NO mapear "Prioridad innovadores"** (categoría del tarifario
  24-sep, `med_abreviado_prioridad_innovadores_24sep`). La regla no es
  obvia: no está claro si "innovador" debe REEMPLAZAR la categoría del
  subtipo (Biológicos/Huérfanos ya tienen su propia fila obligatoria por
  ley, independiente de si el producto es innovador) o si solo debe aplicar
  cuando no hay una fila más específica (p.ej. Síntesis Química genérica);
  tampoco el xlsx aclara si es excluyente de las demás filas de Abreviado o
  un cargo adicional. Se dejó un comentario extenso en el código explicando
  esto — el admin sigue completando la línea a mano en estos casos, como
  hace hoy con toda categoría sin fila propia.
- **Tests**: `tracker/tests/checklist_tarea26.test.js` (nuevo, 5 pruebas,
  unitario puro sobre `getChecklist()`) + `tracker/tests/
  permissions.test.js` (3 pruebas nuevas: cliente bloqueado, analista SÍ
  puede confirmar los 3 campos juntos, el checklist refleja `esInnovador`
  inmediatamente). Agregado a `run_permission_tests.sh`.
- `organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md` actualizado: las filas
  SQ-33/34 pasan de "No aplicado" a "Sí (TAREA 26)", con nota de qué se
  agregó; sección D renombrada a "TAREA 24 vs. 25 vs. 26" con el resumen de
  esta parte.

### (3) `ENTREGA_E1_E3.md` actualizado con TAREAS 21-26

Nueva sección completa ("El flujo canónico pasa a 13 fases, pagos por
concepto, precios 24-sep y auditoría del checklist") resumiendo, para Rick
(no con el detalle técnico de este handover): la máquina de 13 fases, los
gates centralizados, los pagos por concepto y el tarifario del 24-sep
(`PRICING_TABLE`), y la auditoría del checklist. §H.1 y §H.3 (sección 3,
decisiones) marcados explícitamente como **superados por §H.8**; §H.8 y §H.9
agregados como viñetas nuevas. Sección 2 (comando de verificación) y sección
6 (última verificación) actualizadas con los conteos reales de hoy (125
pruebas de backend, 19 specs de Playwright) y con la nota honesta sobre el
flake del punto (1).

### (4) Respaldo

`~/respaldo-farmazed/2026-09-30c/cambios.patch` (414 KB, verificado con
`git apply --check` contra un clon fresco del mismo HEAD — aplica limpio) +
`untracked.tar.gz` (215 archivos, ~40 MB).

### Verificación final

Backend: **125/125** (76 permisos + 4 IEA + 12 gates + 6 pago-por-concepto +
17 checklist TAREA 25 + 5 checklist TAREA 26 + 5 migración) — verde en cada
corrida, sin excepción. Playwright: **18-19/19** según la corrida — ver nota
del punto (1) para el detalle honesto del flake residual. Sin commit, sin
deploy. El PM pidió esperar después de esto.

---

## TAREA 27 — Rick autoriza commit y push (§H.10) — 30-sep

Instrucción directa de Rick a través del PM: *"procede con todo pero no hagas
deployment aun, solo commit y push, asi yo pruebo todo en local desde la pc
de argus."* — **sin deploy, sin migraciones en producción, sin tocar Cloud
Run ni Firestore de prod.**

### (1) Antes de stagear

- `.vscode/` estaba untracked y a punto de entrar — se agregó a
  `.gitignore` (no estaba cubierto antes; PM lo pidió explícitamente).
- `tracker/node_modules/` y `e2e/node_modules/` ya estaban correctamente
  excluidos (`tracker/.gitignore` propio + `e2e/node_modules/` en el
  `.gitignore` raíz) — verificado con `git check-ignore`, no con solo
  mirarlo.
- `e2e/test-results/`, `playwright-report/`, logs de emuladores
  (`firestore-debug.log`, etc.): ya excluidos, y no había ninguno suelto en
  el repo al momento de revisar.
- JDK / `~/.local`: no hay binarios del JDK en el repo — las 4 menciones que
  aparecen (`DEV_LOCAL.md`, `run_permission_tests.sh`, `e2e/run.sh`,
  `handover.md`) son solo la ruta por defecto de una variable de entorno
  (`JAVA_HOME`), no el JDK copiado.
- **Archivos >5 MB**: ninguno. Verificado programáticamente sobre los 238
  archivos que terminaron entrando (`stat` de cada uno) — los únicos >1 MB
  eran PDFs/PSD de `References/`, y esos ya estaban excluidos por
  `*.pdf`/`*.psd` en `.gitignore` desde antes de esta tarea (confirmado con
  `git check-ignore -v`, no estaban a punto de entrar).
- Total: **238 archivos** nuevos/modificados entraron en esta entrega (la
  primera desde `5729a63`, hace varias sesiones) — 146 son capturas de
  Playwright (`sessions/`), el resto es código real.

### (2) gitleaks sobre lo stageado

`gitleaks git --staged` → **2 hallazgos, ambos ya conocidos**: las claves
viejas `fz-admin-2026` y `fz-mcp-2026` en `PM_COMMENTS.md` (líneas 639 y
643), dentro del runbook de rotación de claves — son ejemplos de curl que
verifican que esas claves YA ROTADAS devuelven 401, no credenciales activas.
Cero hallazgos nuevos o inesperados. El apiKey web de Firebase
(`farmazed-web/portal/js/config.js`) ni siquiera lo marcó — es pública por
diseño (Firebase no la trata como secreto; la seguridad la dan las reglas de
Firestore/Storage, no ocultar esta clave).

### (3) Commits por bloques (orden de `ENTREGA_E1_E3.md`)

Como nunca hubo commits incrementales de este trabajo (todo llegó a esta
sesión como un único árbol de trabajo sin commitear de varias sesiones), no
existía una historia real por TAREA para preservar — se agrupó por ÁREA
funcional, en el orden en que `ENTREGA_E1_E3.md` describe el producto:

1. `d9cd70f` — Tracker v2: API completa (todo `tracker/`: rutas,
   middleware, servicios, utils, scripts, tests de integración).
2. `8a1c337` — Portal del cliente: dashboard, wizard, `auth.js` (incluye el
   fix de `getToken()`/`authStateReady()` de TAREA 26).
3. `21e31ec` — Panel de empleados (bandeja).
4. `f8caa7d` — Panel admin (casos, expediente, cotizaciones, precios,
   empresas, formularios).
5. `9ab6f80` — Alta de cuentas por invitación.
6. `46cd4de` — Suite E2E con Playwright (19 specs) + capturas (`sessions/`).
7. `b6b2d1a` — Config de infraestructura local (emuladores, `.gitignore`,
   `verificar_local.sh`, `DEV_LOCAL.md`).
8. Este commit — documentación de proceso y decisiones (`organizacion/`,
   `PM_COMMENTS.md`, `ENTREGA_E1_E3.md`, `References/matrices_zelky_2026-09-28/`,
   este `handover.md`).

Todos terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
(línea exacta que pidió el PM).

### (4) Push y respaldo

`git push origin main` — el remoto apunta a la URL vieja del repo
(RichoX-Hub/Farmazed), que redirige; funciona igual. Respaldo adicional (por
si acaso, aunque ya no hace falta para recuperar nada) sigue en
`~/respaldo-farmazed/2026-09-30c/` de TAREA 26.

### Qué NO se hizo (por instrucción explícita)

Ningún deploy a Cloud Run, ninguna migración contra Firestore de
producción, `PRICING_TABLE` sin tocar en prod (sigue en el tarifario de
siempre). El conteo de casos por estado en producción sigue bloqueado por
el clasificador de permisos (§H.1) — sin cambios en esta tarea.

**Seguimiento de TAREA 27** (mismo día, misma autorización de Rick): el PM
encontró que `farmazed-web/formularios/*.docx` (13 plantillas) quedaban
excluidas por la regla `*.docx` del `.gitignore` — en una PC nueva (Argus) la
biblioteca de formularios daría 404. Se agregó la excepción
`!farmazed-web/formularios/*.docx` después de esa línea, verificado con
`git check-ignore` que ya no se ignoran; se revisó con grep (rutas servidas/
leídas en `farmazed-web` y `tracker` contra `git check-ignore`) si algún otro
archivo de runtime había quedado atrapado igual — ninguno. `gitleaks`
repetido sobre lo stageado, mismos 2 hallazgos ya conocidos. Commit
`e5a56b8` ("Incluir las 13 plantillas de formularios en el repo") + push.
Verificado: `git ls-files farmazed-web/formularios | wc -l` = 13,
`ls-remote == rev-parse`.

## TAREA 28 — Ronda 2 de Zelky: representación, Vacuna=Biológicos, precios
sin fila propia, prioridad innovadores (§H.11) — 2-oct

Instrucción del PM (relayed de Rick vía Dandy): aplicar las 4 decisiones de
Zelky de PM_COMMENTS §H.11. **Sin commit ni deploy** — esta ronda la
commitea Rick cuando la pruebe, a diferencia de TAREA 27.

### (1) Campo `representacion` en el caso

Tri-estado igual que `esInnovador` (TAREA 26): `titular_directo` |
`casa_matriz_distribuidor` | sin definir ("por confirmar"), editable por el
staff en la misma tarjeta de fase 3 (`farmazed-web/admin/expediente.html`,
nuevo `<select id="via-representacion">`). `ADMIN_FIELDS`/`STAFF_FIELDS` en
`tracker/routes/cases.js` lo aceptan.

`tracker/data/formularios.js` ganó un mecanismo nuevo y opcional,
`aplicaSegunCaso(caseData)`, usado SOLO por F1 y F2 (los únicos que dependen
de un dato del caso, no de un tag estático): devuelve `'si'`, `'no'` o
`'por_confirmar'` según `representacion`. El resto de los 13 formularios
sigue con el mecanismo viejo de tags (`aplica: [...] | 'por_confirmar'`), sin
tocar. F3 (poder al farmacéutico) y F10 pasaron de `'por_confirmar'` a
aplicables con certeza: F3 siempre en medicamentos, F10 en todo registro
nuevo — ya no quedan "por confirmar" salvo F1/F2 mientras no se defina
`representacion`. `getFormulariosParaCaso()` reescrita para consultar
`aplicaSegunCaso` cuando existe, antes de caer al mecanismo de tags.

La biblioteca del admin sin contexto de caso (`admin/formularios.html`)
sigue mostrando F1/F2 como "por confirmar" (ahí no hay un caso real del que
leer `representacion`) — actualicé el mapa de etiquetas (`medicamentos_siempre`,
`nuevo_registro`) y el texto explicativo para que ya no diga "4 formularios
por confirmar" sino 2, con la razón.

### (2) Vacuna = Biológicos

`tracker/data/faddi_checklists.js`: `'Vacuna'` ahora apunta al mismo array
`MED_BIO_DOCS` que Biológicos/Biotecnológicos (reemplaza el placeholder de
TAREA 21, que tenía solo 2 documentos marcados "⚠️ pendiente de verificar").
El documento especial `declaracion_identidad_abreviado` (que antes solo se
agregaba para Bio/Biotec en vía Abreviada) ahora también se agrega para
Vacuna. Precio: `resolverCategoriaPrecio()` ya trataba Vacuna como
Bio/Biotec en Abreviado desde TAREA 23/25; sin cambio ahí.

### (3) `resolverCategoriaPrecio` — tarifario 24-sep

- **Regular + categoría sin fila propia** (Vacuna, Homeopáticos,
  Radiofármacos, Suplementos, etc.) → cae a la fila genérica "Procedimiento
  Regular" (`med_regular_general_24sep`), en vez de `null`. Las categorías
  que SÍ tienen fila propia (Síntesis Química, Bio/Biotec, Cosméticos...)
  siguen devolviendo su categoría específica, no la genérica — verificado
  explícitamente en `precios_tarea28.test.js` que no se pisan.
- **Abreviado + Contraste/Gas/Naturales** → confirmado por Zelky como "ruta
  no tarifada" (no es un hueco de información, es así a propósito). Sigue
  devolviendo `null`, pero ahora el comentario en el código lo documenta como
  resuelto, no como pendiente.

### (4) Prioridad para innovadores — línea adicional, no reemplazo

Zelky confirmó que es una línea ADICIONAL de la cotización, no una categoría
que sustituye a la principal. Se agregó un discriminador `tipo` a las líneas
de cotización (`'principal'` | `'prioridad_innovadores'`) porque ahora un
mismo `caseId` puede tener 2 líneas — hubo que revisar y filtrar por `tipo`
en **todos** los puntos que antes asumían una sola línea por caso:
`getAcceptedQuoteLineForCase` (filtra `tipo==='principal'` para los gates de
pago), el handler `PATCH /:id/lineas/:caseId` (ahora recibe `tipo` en el
body para saber cuál de las 2 ajustar), y 2 lookups del front (`client-
dashboard.html` para pagos, `cotizaciones.html` para mostrar/editar).

`lineaPrioridadInnovadores(caseData)` (nueva, en `tracker/routes/quotes.js`)
devuelve `null` salvo que `PRICING_TABLE=24sep` **y** `esInnovador===true`
**y** la categoría del caso sea Síntesis Química, Biológicos o
Biotecnológicos — **deliberadamente NO incluye Vacuna**: la instrucción del
PM nombró las 3 categorías de forma literal para esta regla específica, a
diferencia de la regla de Vacuna=Biológicos del punto (2), que es una regla
distinta de Zelky. Cuando aplica, usa los montos de la fila "Prioridad
innovadores" del xlsx y queda con `ajustado:true` y un `motivoAjuste` que
dice explícitamente que es provisional y que el admin debe revisarla
(incluye si duplica o no las tasas de la línea principal, que no es obvio
desde el código). `attachCaseToDraftQuote()` agrega esta línea extra junto a
la principal cuando corresponde, tanto si crea la cotización como si la
cotización ya existe en borrador.

### Tests

3 archivos nuevos, todos pasan aislados con `node --test` (sin emulador):
`formularios_tarea28.test.js` (7), `checklist_tarea28.test.js` (3),
`precios_tarea28.test.js` (4, corre con `PRICING_TABLE=24sep` seteado ANTES
del `require('../routes/quotes')` — ese módulo lee la variable una sola vez
al cargarse). Más 2 pruebas nuevas en `permissions.test.js` (confirmar
`representacion` vía API y su efecto en `/formularios`; la línea extra de
"Prioridad innovadores" en la cotización, incluyendo que ajustarla a 0 no
toca la línea principal).

Al correr la suite completa encontré y arreglé una regresión real en una
prueba YA EXISTENTE de `permissions.test.js` (`formularios.read`): su
aserción de `porConfirmar` estaba hardcodeada a los 4 formularios viejos —
con F3/F10 ahora aplicables con certeza, el valor correcto es exactamente
`['form-01', 'form-02']`. Mismo patrón en `e2e/formularios.spec.js` (conteo
de badges "Por confirmar" de 4 a 2, más aserciones nuevas de que F3/F10 ya
se ven) y en `admin/formularios.html` (texto explicativo).

### Verificación — suite en verde

Esta máquina (Patch) estuvo con carga muy alta durante buena parte de esta
sesión (load average 11-20, RAM/swap casi agotados por otros procesos del
usuario — `ps aux`/`ss -ltnp` confirmaron que no eran procesos míos
colgados). Varias corridas fallaron solo al arrancar los emuladores de
Firebase (nunca llegaron a ejecutar una prueba) — no son fallos de este
código. Se agregó un reintento acotado (3 intentos, puerto nuevo cada vez)
al arranque del tracker en `run_permission_tests.sh` y `e2e/run.sh` por el
mismo motivo de TOCTOU que ya tenían documentado (proceso ajeno fijo en
`:8080`), pero NO se subieron timeouts de los emuladores ni se agregaron
reintentos de aserciones — misma política que el flake de TAREA 26.

En una ventana de carga más baja (load 4.78):
- `tracker/scripts/run_permission_tests.sh` → **142/142, 0 fallos**
  (incluye los 3 archivos nuevos + las 2 pruebas agregadas).
- `./e2e/run.sh` (18/19 specs — el repo tiene 19 specs pero uno de ellos,
  `estados.spec.js`, corre 2 describe blocks contados aparte en Playwright;
  ver el log) → 17 pasaron, 1 falló (`flujo_completo.spec.js`, que no toca
  nada de esta tarea: Síntesis Química + Regular, sin `esInnovador` ni
  `representacion`). Corrido aislado 2 veces más con el MISMO código: pasó
  limpio las 2 veces (una tardó 1.7 min por la carga del host) — confirma que
  fue ruido de la máquina compartida, no una regresión de TAREA 28. Los 2
  specs de `formularios.spec.js` (los que sí dependen de F1/F2/F3/F10)
  pasaron limpios en la corrida completa.

### Qué NO se hizo

- No se repitió la actualización de `organizacion/11_AUDITORIA_CHECKLIST_MATRICES.md`
  — la instrucción de esta ronda solo pidió explícitamente actualizar
  `ENTREGA_E1_E3.md` (a diferencia de TAREA 26, que sí pidió el audit doc).
  Si Rick/PM quieren esa columna también reflejada ahí, decirlo y se agrega.
- Sin commit ni deploy — instrucción explícita de esta ronda (el commit lo
  pide Rick).
- No se tocó nada de producción ni `PRICING_TABLE` fuera del emulador.

### Seguimiento del mismo día — 2 correcciones que pidió el PM tras revisar la entrega

**(a) Vacuna también entra en "Prioridad innovadores".** En la primera
versión dejé `CATEGORIAS_PRIORIDAD_INNOVADORES` (quotes.js) sin Vacuna,
razonando que Zelky solo nombró Síntesis Química/Biológicos/Biotecnológicos
para esa regla específica. El PM corrigió: "Vacuna = Biológicos" (§H.11) es
general, no se limita al checklist/precio base — aplica también aquí.
Agregado `'Vacuna'` a la constante; fixture nuevo en `seed_roles.js`
(`case-prioridad-innovadores-vacuna-test`, Abreviado+Vacuna+esInnovador) y
test nuevo en `permissions.test.js` que confirma la línea extra con
`categoriaPrecio: 'med_abreviado_biologicos_24sep'` en la principal (Vacuna
= Biológicos) + la línea `prioridad_innovadores` igual que para Síntesis
Química. Backend completo re-verificado: 143/143.

**(b) Corrección sobre el conteo de Playwright (18 vs 19).** El PM notó que
antes reportaba 19 specs y en esta tarea reporté "18/18" — error mío, no un
cambio real: el repo sigue con 19 pruebas (11 archivos `.spec.js`; conteo
exacto por archivo: `grep -c "test(" e2e/*.spec.js` → la mayoría tiene 1,
`formularios.spec.js` y `pricing.spec.js` tienen 2, `roles.spec.js` tiene 7).
Lo que pasó: la corrida completa del 2-oct tuvo un fallo real en
`flujo_completo.spec.js` (test #5) y se cortó — sin terminar — en el #18,
porque mi propio wrapper `timeout 400` mató el proceso de Playwright a mitad
de camino (confirmado: el log de esa corrida en background terminó con
`EXIT:124`, el código estándar de `timeout` cuando mata por plazo vencido,
no con el resumen final de Playwright). Sumé "17 que sí pasaron + 1
(`flujo_completo`) que re-confirmé aislado" = 18, y reporté eso como si
fuera el total, sin darme cuenta de que la prueba #19
(`roles.spec.js`: "invitación -> aceptar -> login") nunca llegó a correr esa
vez. La corrí ahora, aislada, sin ese límite de tiempo: pasó limpia. Total
real confirmado: **19/19** (no todos en una sola corrida continua, por la
carga del host, pero cada uno individualmente verificado con el código
actual).

## TAREA 29 — Rick autoriza commit y push de la ronda Zelky 2 (§H.12) — 3-oct

Orden de Rick vía Dandy, verificada por el PM con `pm-order-check farmazed`
(PM_COMMENTS §H.12). Sin deploy. Mismos controles que TAREA 27.

- Pre-stage: 94 archivos modificados/nuevos, ninguno >1 MB; revisado
  `git status --short --ignored=matching` — los 22 archivos ignorados son
  todos material de referencia ya conocido (PSDs, PDFs, docx fuera de
  `formularios/`), nada indebido a punto de entrar.
- `gitleaks git --staged`: **0 hallazgos** (el diff de esta ronda no toca
  las líneas de `PM_COMMENTS.md` con las claves viejas rotadas de TAREA 27 —
  esas ya están en un commit anterior, no en este stage).
- 4 commits por bloque, todos con título `Rick: ...` (instrucción literal
  de la orden) y `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`:
  1. `3cb5ed2` — backend (`tracker/`: representación, Vacuna=Biológicos,
     precios sin fila propia, prioridad innovadores + los 3 archivos de
     test nuevos y las pruebas agregadas a `permissions.test.js`).
  2. `79a9534` — front admin/cliente (select de representación en
     `expediente.html`, línea extra en `cotizaciones.html`,
     `client-dashboard.html`, `admin/formularios.html`).
  3. `fd858c7` — specs e2e (`formularios.spec.js`) + reintento de arranque
     del tracker (`e2e/run.sh`) + capturas regeneradas por las corridas de
     verificación.
  4. `bde53bb` — documentación (`ENTREGA_E1_E3.md`, `handover.md`,
     `PM_COMMENTS.md` §H.11/§H.12, `organizacion/09_TABLA_PERMISOS.md`).
- `git push origin main` — mismo redirect de la URL vieja que TAREA 27,
  funciona igual. Verificado: `git status` limpio, `git ls-remote origin
  main` == `git rev-parse main` (`bde53bb...`).
- Sin deploy, sin migraciones, sin tocar `PRICING_TABLE` en prod.

## TAREA 30 — Demo a mano para Rick (`demo_local.sh`) — 3-oct

Rick quiere probar el estado actual a mano desde Argus, por tunel SSH. Nuevo
`demo_local.sh` (raíz del repo) — ver DEV_LOCAL.md ("Demo a mano para Rick")
para el detalle completo. Resumen:

- Levanta emuladores + seed completo (`seed_emulador` + `seed_roles` +
  `seed_pricing_24sep`) + tracker (`PRICING_TABLE=24sep`) + frontend
  (`:8092`), y se queda corriendo hasta Ctrl-C (no se apaga solo como
  `e2e/run.sh`). Corriendo en una sesión `tmux` llamada `farmazed-demo`
  (`tmux attach -t farmazed-demo` para verla; Ctrl-C ahí apaga todo).
- El puerto del tracker nunca es fijo (8080 ocupado en Patch) — el script
  genera `farmazed-web/demo.html` (no se commitea, se borra al salir) que
  fija `fzApiPort` en localStorage y redirige a `login.html`, para que Rick
  entre con una sola URL sin que le importe el puerto real.
- **Ajuste del mismo día, pedido por el PM tras ver la demo corriendo**: (1)
  `login.html` mandaba a los 3 roles de staff (analista/abogado/regente) al
  portal del CLIENTE — solo distinguía admin de "todo lo demás". Corregido
  (`destinoSegunRol()`, usa `isAdmin()`/`isStaff()` de `auth.js`, que ya
  existían): admin → `admin/casos.html` (el panel v2 real — NO
  `dashboard.html`, que es solo la especificación de diseño, sin conectar a
  los flujos reales, ver CLAUDE.md), staff → `admin/bandeja.html`, cliente
  → `client-dashboard.html` sin cambio. Aplicado en caliente (frontend
  estático, solo recargar) — no hizo falta reiniciar la demo. Arreglé
  también la regex compartida de `login()` en los 11 specs de `e2e/`
  (esperaban `dashboard|client-dashboard`, le agregué
  `admin/casos|admin/bandeja`) para que no se rompa el `waitForURL` de login
  de admin/staff en la próxima corrida de Playwright — sintaxis verificada
  (`node --check` en los 11), pero **no corrí la suite completa de e2e**
  porque usa los mismos puertos fijos (`:8092`, `:9099`) que la demo que
  tiene que seguir corriendo — pendiente correrla cuando ya no haga falta
  mantener la demo viva, o si el PM prefiere que la pare un momento para
  verificar ahora, decirlo. (2) Faltaba el puerto `:9199` (Storage emulator)
  en la línea de `ssh -L` que imprime el script — los links de "Descargar"
  de documentos apuntan directo ahí (`tracker/services/storage.js`, el
  emulador no firma URLs reales). Agregado.
- Verificación: `curl` a los 4 health-checks (tracker, frontend x2, Auth
  emulator) en `200`; login real (REST del Auth emulator, sin navegador)
  para admin-e3/titular-alfa/analista — los 3 con `idToken`, y
  `GET /api/cases` filtra correcto por rol/org; sin token, `401`. Después
  del ajuste de `login.html`, un script de Playwright aparte (navegador
  real, contra la demo ya corriendo, sin tocarla) confirmó el destino
  correcto para los 5 roles.
- Sin commit (lo pide Rick si hace falta), sin deploy.

## TAREA 31 — CORS del tracker: `localhost` vs `127.0.0.1` (urgente) — 3-oct

Rick probó la demo desde Argus por túnel SSH y falló: el tracker solo
aceptaba `Origin: http://localhost:8092` fijo; con `127.0.0.1:8092` (como
le resolvió el túnel) o cualquier otro puerto, el preflight no traía
`Access-Control-Allow-Origin`. Confirmado con `curl -X OPTIONS` antes de
tocar nada (ver detalle completo en DEV_LOCAL.md, sección "CORS del tracker
en modo emulador").

- `tracker/index.js`: `cors({ origin: [...] })` (array fijo) ->
  `cors({ origin: (origin, cb) => ... })` (función). Fuera del emulador
  (sin `FIRESTORE_EMULATOR_HOST`), exactamente la misma allowlist de
  siempre — producción sin cambios. Solo en modo emulador acepta cualquier
  `http://localhost:<puerto>` o `http://127.0.0.1:<puerto>`.
- Revisé lo demás que pidió el PM: los emuladores de Auth/Storage ya
  reflejan cualquier origen (no tenían el problema); `demo.html`/
  `login.html` solo usan rutas relativas en sus redirects, no saltan de
  host. Sí encontré un salto real en `portal/js/config.js`: `API_BASE`
  armaba la URL con `localhost` fijo sin importar el alias con el que se
  cargó la página — si la página está en `127.0.0.1` pero pide la API en
  `localhost`, el `Origin` que manda el navegador (el de la página) es el
  que no calzaba con lo que el tracker esperaba. Cambiado a
  `window.location.hostname` (dentro de `IS_LOCAL`, sin tocar producción).
- Reinicio en caliente: solo el proceso del tracker (leí su `/proc/<pid>/environ`
  antes de matarlo para relanzarlo con la MISMA config exacta, no adivinada)
  — los emuladores (con el seed completo) siguieron corriendo, confirmado
  que `GET /api/cases` de admin sigue devolviendo los mismos 38 casos tras
  el restart.
- Verificado: preflight con ambos orígenes (`localhost`/`127.0.0.1`) ahora
  trae la cabecera correcta; un origen ajeno sigue sin ella (no se abrió de
  más); verificación lógica aparte de la función de origen (6 combinaciones
  prod/emulador × fijo/random/ajeno); login real con Playwright (navegador
  real) entrando por `http://127.0.0.1:8092/demo.html` — login de admin,
  aterriza en `admin/casos.html`, 38 casos cargados, sin errores de CORS en
  consola; repetido por `localhost` (cliente) para confirmar que el caso
  original no se rompió.
- Demo sigue viva en `tmux farmazed-demo`. Sin commit, sin deploy.

## TAREA 32 — Registro abierto de clientes nuevos (PM_COMMENTS §H.13) — 3-oct

Reemplaza el supuesto de §H.4 ("sin registro abierto") — la invitación sigue
existiendo para miembros/empleados (invitations.js, sin tocar), esto es la
puerta nueva para un titular que llega solo. Corrido en una instancia
aislada de emuladores+tracker+frontend (ver DEV_LOCAL.md, "Probar algo sin
tocar una demo que ya está corriendo") — la demo de Rick en
`tmux farmazed-demo` no se tocó en ningún momento, verificado antes/durante/
después.

### (a) Registro + verificación de correo obligatoria

- `tracker/routes/register.js` (nuevo, `POST /api/register`, público):
  crea la empresa (`orgs`) y el usuario Firebase (`admin.auth().createUser`,
  `emailVerified:false`) en un solo paso; fija `role:'cliente_titular'` +
  `orgId` por `setCustomUserClaims` SIEMPRE del lado del servidor — el
  endpoint nunca lee `req.body.role` ni `req.body.orgId`, así que no hay
  forma de escalar rol ni de pegarse a una empresa ajena mandándolo en el
  body (probado explícito). Rate limit básico en memoria por IP (5 cada 10
  min, mismo criterio de extracción de IP que la ruta legacy de QR en
  `index.js`) — no sobrevive un restart ni es defensa distribuida, "básico"
  como pidió el PM. Validación manual (estilo del resto del archivo, no
  `express-validator` aunque está en `package.json` — para no mezclar
  convenciones de validación en el mismo código base).
- `farmazed-web/registro.html` (nuevo): el form público, link "Crear
  cuenta" agregado en `login.html`. Tras el POST exitoso, hace `login()` +
  `sendEmailVerification()` del SDK de cliente (el admin SDK no manda
  correos) — en el emulador, el link de verificación sale en su propia API
  REST (`GET /emulator/v1/projects/.../oobCodes`), nunca un correo real.
- **Gate de verificación — decisión de diseño, NO en el backend**: vive
  entero en el front (`requireVerifiedLogin()`, nueva en `auth.js`, usada
  por las 9 páginas protegidas en vez de `requireLogin` — dashboards,
  wizard indirectamente, todo `admin/*.html`) — si no está verificado,
  redirige a `farmazed-web/verificar-correo.html` (nuevo: reenviar correo /
  "ya verifiqué, continuar" / cerrar sesión). Consideré además bloquearlo
  en `requireAuth` (backend) para que no se pueda saltar llamando la API
  directo, pero lo descarté: cualquier cuenta real ya existente en
  producción cuyo `emailVerified` nunca se haya fijado explícitamente a
  `true` quedaría bloqueada el día que esto se despliegue, y es un riesgo
  que no me corresponde asumir sin que Rick lo sepa. Si se quiere ese
  refuerzo en el backend también, decirlo aparte — no es gratis.
  Para que el gate nuevo no rompiera lo que ya funcionaba: las cuentas por
  invitación quedan `emailVerified:true` automáticas al aceptar
  (`invitations.js`, Farmazed ya vetó ese correo al invitar) y las cuentas
  semilla (`seed_emulador.js`, `seed_roles.js`) también — si no, la demo Y
  toda la suite de e2e existente habrían quedado bloqueadas por este mismo
  cambio.

### (b) Captación de información preliminar (Fase 2 Zelky)

`PATCH /api/orgs/mine/captacion` (nuevo, en `orgs.js`) — un solo endpoint
sirve para la pantalla bloqueante de primer ingreso Y para "editar después
desde Mi Empresa" (mismo botón reabre el mismo form, `window.__fzAbrirCaptacion`,
`client-dashboard.html`): "se pide una sola vez" es una decisión de UI (el
front solo MUESTRA el overlay si `org.captacion` no existe), no una
inmutabilidad en el backend. Los 6 campos de §H.13 literal (país y nombre
del fabricante como UN campo de texto — así vino la pregunta de Zelky;
categoría(s) de producto, subconjunto validado contra `TRAMITE_TYPES` de
`faddi_checklists.js`; número de productos por categoría; registro previo
ante autoridad reconocida; cliente nuevo o ya registrado en Panamá;
modificación en curso). Permiso nuevo `orgs.edit_captacion`
(cliente_titular + admin — el miembro no puede, y no debería quedar
bloqueado por algo que no puede completar, así que el overlay de primer
ingreso solo se dispara si el rol es titular).

### (c) Lead en la bandeja de staff

`GET /api/orgs/leads` + `POST /api/orgs/:orgId/leads/revisar` (nuevo,
`orgs.js`), permiso nuevo `orgs.read_leads` (staff + admin, mismo permiso
para ver y marcar — es triage liviano, no una confirmación con separación
de roles como fase_08). `admin/bandeja.html` ganó una card "Clientes
nuevos — revisar captación" arriba de la tabla de casos (los leads no
tienen caso todavía, por eso no son una fila de esa tabla).

### (d) Permisos, tests, spec e2e

- `organizacion/09_TABLA_PERMISOS.md` regenerado (`generate_permissions_doc.js`)
  por los 2 permisos nuevos.
- `tracker/tests/registro_tarea32.test.js` (nuevo, 13 tests): registro
  normal, no puede escalar rol ni pegarse a otra empresa, correo duplicado
  409, campos faltantes 400, rate limit 429 al 6to intento; captación:
  miembro no puede (403), categoría inválida 400, titular completa y
  `GET /api/me/org` la refleja, editar después actualiza sin duplicar,
  staff no puede completarla (403); leads: titular no puede verlos (403),
  staff los ve, admin marca revisado y desaparece.
- `e2e/registro.spec.js` (nuevo): recorrido completo real en navegador —
  registro -> intento de entrar sin verificar (bloqueado en 2 puntos:
  login.html Y navegación directa a client-dashboard.html) -> confirma el
  correo vía el oobLink del emulador de Auth (simula el clic real) ->
  entra -> capta la pantalla bloqueante de primer ingreso -> la llena ->
  recargar NO la vuelve a mostrar -> aparece editable en Mi Empresa ->
  logout -> login como analista -> ve el lead nuevo en su bandeja.
- Para que el spec nuevo pudiera correr contra una instancia de Auth en un
  puerto DISTINTO al de siempre (9099, el de la demo) hizo falta un cambio
  chico adicional: `auth.js` tenía `connectAuthEmulator` con el puerto fijo
  a mano — ahora usa `localAuthPort()` (nueva en `config.js`, mismo
  mecanismo que `fzApiPort`/`localApiPort()` de TAREA 26/30), default
  `9099` si no se toca — ningún spec viejo ni la demo necesitan cambiar
  nada. Ver DEV_LOCAL.md para la receta completa de correr pruebas en una
  instancia aislada sin tocar una demo que ya está corriendo.

### Verificación

Suite backend completa (156 tests: 80 permissions + 13 registro_tarea32 +
32 checklist/formularios puros + 4 precios + 4 paquete_iea + 12
transition_gates + 6 payment_concepts + 5 migration) — **156/156, 0
fallos**, contra la instancia aislada (puertos 8070/9198/8190/9298,
`firebase.test-ports.json` temporal, borrado al terminar). `e2e/registro.spec.js`
corrido 2 veces (la primera encontró el problema real de arriba —
`connectAuthEmulator` con puerto fijo— la segunda, con el fix, pasó
limpio). Demo de Rick verificada viva antes/durante/después (curl a sus 3
puertos), nunca reiniciada ni tocada.

### Qué NO se hizo / decisiones que puede querer revisar el PM

- No se tocó `invitations.js` más allá de agregar `emailVerified:true` al
  aceptar — la invitación sigue funcionando exactamente igual.
- Sin commit ni deploy — instrucción explícita de esta ronda.

### Ajuste del mismo día — refuerzo del gate de verificación en el backend

El PM confirmó el riesgo que señalé (verificación solo en frontend se
salta llamando la API directo) y pidió reforzarla, pero SOLO para cuentas
del registro abierto, para no arriesgar cuentas reales ya existentes:

- `tracker/routes/register.js`: el `setCustomUserClaims` ahora incluye
  `origen: 'registro'` (además de `role`/`orgId` de siempre).
- `tracker/middleware/auth.js` (`requireAuth`): si el token decodificado
  trae `origen === 'registro'` y `email_verified === false`, 403
  ("Verifica tu correo antes de continuar.") — ANTES de llegar a
  `req.user`/`next()`, así que ningún endpoint autenticado es alcanzable.
  Cuentas de invitación/semilla/legacy nunca tienen el claim `origen`, no
  las toca. Dejé un `EXEMPT_PATHS` (vacío hoy, documentado) por si en el
  futuro aparece un endpoint que SÍ necesite ser alcanzable sin verificar
  — hoy no hay ninguno (reenviar el correo es un SDK call directo a
  Firebase, no pasa por el tracker).
- 3 tests nuevos en `registro_tarea32.test.js` (ahora 16 en total):
  cuenta registrada sin verificar -> 403 creando un caso; la misma, ya
  verificada -> 201 normal; cuenta legacy/invitación (sin el claim) -> 201,
  sin verse afectada.
- **Bug propio que encontré al verificar**: el archivo de test ya hacía 7+
  llamadas a `/api/register` desde la misma IP de loopback, y el rate
  limit es 5/10min — el archivo se autobloqueaba a partir de cierto punto
  (`429` en vez del código que de verdad se estaba probando). Arreglado
  dándole a cada llamada (salvo la del propio test de rate limit) una IP
  sintética distinta vía `X-Forwarded-For` — más realista además (en la
  vida real cada registro viene de una IP distinta).
- Verificado: 16/16 en `registro_tarea32.test.js`, más 102/102 del resto
  de la suite backend (permissions 80, paquete_iea 4, transition_gates 12,
  payment_concepts 6) sin regresiones — confirma que el refuerzo no afecta
  ningún endpoint para cuentas que no sean del registro abierto. Mismo
  método de instancia aislada que el resto de TAREA 32 (ver DEV_LOCAL.md)
  — la demo de Rick en `tmux farmazed-demo` sigue sin tocarse, confirmado
  antes/durante/después otra vez.
- **IMPORTANTE — instrucción explícita del PM**: el `/api/register` nuevo
  (y el refuerzo de este ajuste) YA están en el código, pero el tracker de
  la demo de Rick sigue corriendo con el código VIEJO (sin estos cambios)
  — **no reiniciar ese tracker hasta que el PM lo pida**. Los HTML nuevos
  (`registro.html`, `verificar-correo.html`, `demo.html`) ya los sirve el
  frontend estático de la demo (es estático, no necesita reinicio), pero
  si Rick hace clic en "Crear cuenta" ahora mismo, el POST a
  `/api/register` le va a dar 404 contra ese tracker viejo — es esperado,
  no es un bug, hasta que el PM autorice el reinicio.

## TAREA 33 — Suscripción + pago en línea con PayPal (PM_COMMENTS §H.14) — 3-oct

Dos cobros separados (decisión de Rick): plan recurrente de "uso de la
plataforma" + pago de cada cotización. Por PayPal se cobra TODO junto
(honorarios+tasa DNFD+MEF+IEA en un solo cargo); Farmazed emite después los
cheques separados a cada autoridad — por eso hizo falta poder reconstruir
esa separación desde el cargo único (ver (a) abajo).

### (a) Proveedor intercambiable — `tracker/services/payments/`

- `index.js`: `getProvider()` — PayPal real SOLO si
  `PAYPAL_CLIENT_ID`+`PAYPAL_CLIENT_SECRET`+`PAYPAL_ENV` están los 3 en el
  entorno; si falta cualquiera, `mock`. Nunca a medias.
- `mock.js`: estado en memoria, aprueba todo de una (sin app sandbox no hay
  checkout real al que redirigir — `approveUrl` siempre `null`, es la señal
  de "sin redirect real"). Es el único probado de verdad en esta tarea.
- `paypal.js`: REST v2 (Orders) + v1 (Subscriptions, Notifications) con
  `fetch` nativo, OAuth `client_credentials` cacheado. Escrito contra la
  documentación oficial, **sin smoke-test real** — Rick no ha creado la app
  en developer.paypal.com todavía.
- `tracker/.env.example` — agregar ahí `PAYPAL_CLIENT_ID`/`_SECRET`/`_ENV`/
  `_WEBHOOK_ID` como placeholders cuando Rick tenga las credenciales reales;
  **nunca** en el repo ni en `.env` versionado.

### (b) Desglose por concepto — extensión necesaria del modelo de cotización

El modelo de línea de `quotes.js` solo tenía 2 buckets
(`honorariosFarmazed`/`tasasOficiales`) — no bastaba para repartir un cargo
único de PayPal en los pagos por CONCEPTO que ya entiende `payments.js`
(honorarios/tasa_dnfd/mef/iea). Agregado `desgloseConceptos()` en
`tracker/utils/pricing_desglose.js` (partición exacta de `TASAS_KEYS`:
tasa_dnfd = refrendo_cnf+tasa_dnfd_servicio+tasa_dnfd_tramite, mef=tasa_mef,
iea=iea) y guardado en cada línea (`tarifarioConceptos` congelado,
`conceptos` efectivo — el admin puede pisarlo a mano en el PATCH de
ajuste, opcional). La línea extra de "Prioridad innovadores" (TAREA 28) va
TODA a `honorarios` (es cargo de Farmazed, no tasa oficial — y Zelky ya
avisó que podría duplicar las tasas de la principal).

`conceptosRequeridosFase05()` (la regla de qué conceptos exige el gate) se
movió de `services/transitions.js` a `tracker/utils/conceptos_fase05.js`
— `quotes.js` también la necesita (para saber qué pagos crear al capturar)
y `transitions.js` ya depende de `quotes.js`; importarla al revés desde
`quotes.js` hubiera sido un require circular.

### (c) Plan recurrente — `tracker/routes/subscription.js`

UN plan (no una lista — así lo pidió el PM), doc único `meta/plan_suscripcion`.
Montos **sin hardcodear** — el admin los define en `admin/precios.html`
(nueva card arriba del tarifario). El titular se suscribe desde Mi Empresa
(`client-dashboard.html`); estado (activa/pendiente/cancelada) vive en
`orgs/{orgId}.suscripcion` — **no bloquea ningún trámite** (ningún gate de
`transitions.js` la consulta, instrucción explícita). Permisos nuevos:
`subscription.manage_plan` (admin), `subscription.subscribe` (cliente_titular).

### (d) Pago de la cotización aceptada — `tracker/routes/quotes.js`

`POST /:id/pago/crear-orden` + `POST /:id/pago/capturar` (permiso nuevo
`quotes.pay`, solo cliente_titular — mismo criterio que `quotes.accept`).
El monto **SIEMPRE** se calcula en el servidor desde `recomputeTotal(data.lineas)`
— ni `crear-orden` ni `capturar` leen un monto del body; cualquier campo que
el cliente mande ahí se ignora (probado explícito). Al capturar: se verifica
`status/orderId/amount/currency` contra lo que el PROVEEDOR devuelve Y
contra lo que el servidor calculó al crear la orden — cualquier discrepancia
aborta sin crear pagos, queda para revisión manual. Por cada caso de la
cotización, `createConceptPayment()` (nueva, `routes/payments.js`, mismo
tipo de registro que ya entiende `hasConceptPayment()` pero sin comprobante
manual) crea un pago por cada concepto de `conceptosRequeridosFase05(principal)`
— el gate de fase_05 se destraba por el camino normal, sin tocarlo. Idempotente
(`pagoPaypal.estado:'capturada'` en la cotización) — capturar 2 veces no
duplica.

**Bug propio encontrado y arreglado**: el chequeo de idempotencia corría
ANTES de validar el `orderId` del body — una cotización ya capturada
devolvía "éxito" para CUALQUIER `orderId` que alguien mandara. Reordenado:
el `orderId` se valida siempre primero.

### (e) Webhook — `tracker/routes/webhooks.js`

`POST /api/webhooks/paypal`, listo, **sin uso real en local** (no hay URL
pública). `paypal.js.verifyWebhookSignature()` falla cerrado sin
`PAYPAL_WEBHOOK_ID` configurado; `mock.verifyWebhookSignature()` siempre da
`true` (no hay nada real que falsificar en el mock) — probado cada rama por
separado.

### UI

`admin/precios.html`: card "Plan de suscripción" (nombre/monto/período).
`client-dashboard.html`: Mi Empresa gana el estado de suscripción +
suscribir/cancelar; Cotización gana "Pagar con PayPal" en una cotización
aceptada sin pagar (mock captura directo; si algún día hay `approveUrl` real
de PayPal, redirige ahí — rama sin probar contra PayPal de verdad).

### Tests y verificación

`tracker/tests/pagos_paypal_tarea33.test.js` (19 tests, contra el tracker
real + emulador, proveedor SIEMPRE mock): plan (admin sí/cliente no/período
inválido/lectura pública), suscripción (miembro no/titular sí/doble-409/
cancelar), pago completo (monto del cliente ignorado, miembro no puede,
capturar antes de crear-orden, orderId equivocado sin crear pagos, monto
corrompido en Firestore directo -> capturar rechaza sin crear pagos —
simulado así porque la cotización 'aceptada' ya no se puede editar por la
API, no hay otra forma de probar esa verificación de servidor —, captura
real crea los conceptos correctos, fase_05 se destraba por el gate normal,
doble captura idempotente, crear-orden sobre cotización pagada -> 409),
webhook (mock 200, paypal.js falla cerrado sin webhook id). **19/19 en
verde**, más el resto de la suite backend (permissions 80, paquete_iea 4,
transition_gates 12, payment_concepts 6, migration 5, registro_tarea32 16,
checklist/formularios/precios puros 36) sin regresiones.

`e2e/pago_paypal.spec.js` (Playwright, mock), 2 tests: (1) admin define el
plan -> titular se suscribe desde Mi Empresa; (2) flujo completo fase_04 ->
cotización enviada -> aceptada -> pagada con PayPal -> fase_05 destrabado
por el admin vía la UI normal de expediente.html. Caso dedicado
`case-pago-paypal-test` (seed_roles.js, org Beta) para no interferir con
quotes.spec.js.

**Estado real de la verificación — no es 100% limpio todavía, siendo
honesto:**
- **Test 1 (suscripción): confirmado en verde**, corrida aislada completa.
- **Test 2 (pago de cotización): la lógica de negocio que prueba ya está
  100% confirmada** por otros dos caminos — `pagos_paypal_tarea33.test.js`
  (19/19, incluyendo la MISMA secuencia crear-orden/capturar/conceptos/
  idempotencia) y la verificación manual con `curl` que hice antes de
  escribir el spec (documentada arriba). Pero el spec de Playwright EN SÍ
  todavía no terminó una corrida limpia: encontré y arreglé 3 problemas
  reales del arnés de prueba (ninguno del producto) de forma iterativa —
  1) olvidé fijar `fzAuthPort`, el navegador se conectaba al Auth emulator
  de la DEMO de Rick (puerto 9099 default) en vez de mi instancia aislada
  (9198) — sin impacto en la demo, fue solo lectura (sign-in); 2) la
  pantalla bloqueante de captación (TAREA 32) interceptaba clics en el
  primer ingreso del titular, agregué un helper que la completa vía API
  si aparece; 3) el sidebar fijo del template queda visualmente encima del
  botón "Aceptar" un instante mientras el contenido recién inyectado
  asienta layout — `click({force:true})` empeoraba esto (sigue siendo un
  click de mouse en esas coordenadas, terminaba abriendo "Mi Empresa" en
  vez de aceptar); cambiado a `dispatchEvent('click')` (dispara el evento
  directo en el botón, sin pasar por qué está encima visualmente). Antes
  de poder confirmar que el fix #3 deja la corrida limpia, el sistema mató
  el proceso en background por memoria crítica del host (swap al 100%,
  confirmado con `free -h` — **no es un fallo de la prueba ni del
  producto**, y no lo reinicié por mi cuenta como indica la instrucción
  del propio sistema). Pendiente: una corrida más cuando el host tenga
  memoria libre, para la confirmación final de test 2. No bloquea el cierre
  de esta tarea dado que la lógica ya está probada por los otros 2 caminos
  — lo marco explícito para que el PM decida si hace falta esperar esa
  confirmación o no.

Todo esto corrido en una instancia aislada (ver DEV_LOCAL.md) — la demo de
Rick en `tmux farmazed-demo` no se tocó en ningún momento (verificado antes/
durante/después de cada intento).

### Qué NO se hizo / queda pendiente de que Rick decida

- Montos del plan recurrente: sin definir (Rick/Zelky) — el admin los pone
  cuando los tenga, nada hardcodeado.
- Comisión de PayPal: no se suma al cliente (pendiente de que Rick lo
  confirme como decisión comercial, instrucción explícita de no inventar).
- `paypal.js` nunca se probó contra la sandbox real — en cuanto Rick cree
  la app en developer.paypal.com, hace falta un smoke-test real antes de
  confiar en esa rama en producción.
- Sin commit ni deploy — instrucción explícita.

### TAREA 34 en cola

3 flujos de alta desde los planes del landing (§H.15) — usa los 2 rieles de
pago de esta tarea (Plan Registro -> pago de cotización con PayPal, Plan
Empresarial -> suscripción al plan recurrente). El PM confirma cuando
entregue esta.

## TAREA 34 — Tres flujos de alta desde los planes del landing (PM_COMMENTS §H.15) — 3-oct

Los 3 botones "Solicitar" del landing (`index.html`) ya no van a `#contacto`
— van a `registro.html?plan=consulta|registro|empresarial`. Común a los 3:
registro (§H.13) con el plan guardado en la empresa → verificación →
captación (§H.13) → bienvenida y nav según el plan.

### (a) Plan guardado al registrarse + "Enviar consulta" sin cuenta

- `register.js`: acepta `plan` en el body, valida contra
  `['consulta','registro','empresarial']`, **default 'consulta'** si falta
  o es inválido (nunca se inventa otro default) — se guarda en `orgs.plan`.
- `PATCH /api/orgs/mine/plan` (nuevo, `orgs.js`, permiso `orgs.set_plan`,
  cliente_titular): "el cliente puede pedir subir de plan" — sin
  restricción de qué transición vale, no se pidió ninguna. Usado por el
  CTA "Contratar el registro" (Consulta->Registro) y por "Subir de plan"
  en Mi Empresa.
- `tracker/routes/contact_leads.js` (nuevo): `POST /api/contact-leads`
  (público, rate limit básico igual que `register.js`) — el form
  "Enviar consulta" del hero (`index.html`, `contact-form2`) crea un lead
  **sin cuenta**. Ese jQuery de vendor seguía apuntando a `appointment.php`
  (no existe, fallaba en silencio) — agregué un listener INDEPENDIENTE
  (módulo ES, no se tocó el archivo de vendor) que llama este endpoint.
  `GET /api/contact-leads` (staff/admin, permiso nuevo `contact_leads.read`
  — DISTINTO de `orgs.read_leads` de TAREA 32, que son empresas que YA
  tienen cuenta y captación). `POST /:id/invitar` (admin) reusa
  `invitations.js` (le agregué `router.createInvitation` exportado para no
  duplicar la lógica) — crea la empresa + invitación con el correo del
  lead y lo marca `invitado`.

### (b) Plan Consulta — diagnóstico

- `PUT /api/orgs/:orgId/diagnostico` (nuevo, `orgs.js`, permiso nuevo
  `orgs.edit_diagnostico`, staff+admin): clasificación, ruta recomendada,
  requisitos aplicables, estimado de tiempos y costos — vive en la EMPRESA
  (no en un caso, "sin dossier ni trámite" todavía). Lectura: ya viene en
  `GET /api/me/org` (spread completo, como captación/suscripción).
- UI staff: `admin/empresas.html` — cada fila de empresa con `plan='consulta'`
  tiene un botón "Cargar/Editar diagnóstico" que despliega un form inline
  (sin un router de detalle nuevo, mismo criterio liviano que `verMiembros`).
- UI cliente: `client-dashboard.html`, módulo nuevo "Diagnóstico" (nav
  visible solo si `org.plan==='consulta'`) — lo muestra, y si existe, el
  CTA "Contratar el registro" llama `PATCH /orgs/mine/plan` con
  `plan:'registro'`.

### (c) Plan Registro

Es el wizard + cotización + pago con PayPal que **ya existían** (TAREAS
18/33) — lo único nuevo es que `?plan=registro` queda guardado y la
bienvenida menciona "Solicitar Registro" directo. Sin endpoints nuevos.

### (d) Plan Empresarial

- `tracker/routes/empresarial.js` (nuevo): `POST /solicitar` (titular,
  permiso nuevo `empresarial.solicitar`) — productos estimados + necesidades
  (modificaciones/etiquetado/informes), guarda
  `orgs.propuestaEmpresarial.estado='solicitada'`. `PUT /:orgId/condiciones`
  (admin, permiso nuevo `empresarial.manage`) — monto/período + gestor de
  cuenta (**valida que el uid sea un analista real**, no cualquier uid);
  crea un plan PROPIO de esa empresa en el proveedor de pagos (NO el plan
  global de `subscription.js` — "a convenir" es por empresa). `POST /aceptar`
  (titular) — se suscribe al plan de SU propuesta (mismo mecanismo de
  `provider.createSubscription` que TAREA 33, mismo campo
  `orgs.suscripcion` resultante — de cara al resto del sistema es la misma
  cosa, no importa qué plan la originó).
- UI staff: `admin/empresas.html` — fila con `plan==='empresarial'` y
  propuesta `'solicitada'` muestra "Definir condiciones" (form inline,
  select de gestor poblado con los analistas reales vía `GET /api/employees`).
- UI cliente: `client-dashboard.html`, módulo nuevo "Informes de avance"
  (nav visible si `org.plan==='empresarial'`) — solicitud/estado/aceptar,
  y debajo, la tabla de TODOS los casos de la empresa con su fase (mismo
  `GET /api/cases`, ya filtra por `orgId` del lado del servidor).

### Permisos y tests

6 permisos nuevos (`orgs.set_plan`, `orgs.edit_diagnostico`,
`contact_leads.read`, `empresarial.solicitar`, `empresarial.manage`) +
`09_TABLA_PERMISOS.md` regenerado. `tracker/tests/planes_landing_tarea34.test.js`
(21 tests): registro con plan válido/inválido/ausente, subir de plan
(miembro no puede, plan inválido 400, titular sí), diagnóstico (cliente no
puede, falta un campo, staff lo carga y el cliente lo ve), lead sin cuenta
(POST público, rate limit, staff no-cliente lo ve, invitar crea
org+invitación y desaparece de la lista), Plan Empresarial completo
(miembro no puede solicitar, solicitar duplicado 409, aceptar antes de
condiciones 400, condiciones con gestor que no es analista 400, condiciones
válidas, miembro no puede definir condiciones, aceptar crea la suscripción).

e2e: 2 specs nuevos, **escritos pero NO corridos todavía** —
`e2e/plan_consulta.spec.js` (registro->verificación->captación->diagnóstico
cargado por staff->cliente lo ve->Contratar el registro; más el lead del
hero->invitar) y `e2e/plan_empresarial.spec.js` (registro->solicitud->
condiciones->aceptar->Informes de avance). Siguen los mismos patrones ya
verificados en TAREA 32/33 (`fzAuthPort`, el helper de captación,
`dispatchEvent('click')` en vez de `click`/`force` por el sidebar fijo que
intercepta clics — ver la nota de TAREA 33 sobre ese bug de arnés).

### Verificación — honesto: el backend NO se pudo correr contra un emulador real esta ronda

El código está completo, con sintaxis validada (`node --check` en todo
`tracker/`) y revisado con cuidado, pero el host (Patch) estuvo en un
estado de carga MUCHO peor que el de TAREA 33 durante toda esta tarea —
`load average` visto hasta **31.86** (vs. 11-20 antes), swap prácticamente
agotado (`free -h`: a veces menos de 400Mi de RAM libre y menos de 1MB de
swap libre de 8GB) — ni siquiera los emuladores de Firebase lograron
arrancar completo en 2 intentos (Firestore sí, Auth/Storage nunca
reportaron listos, igual que el síntoma ya documentado en TAREA 26/28).
Ninguno de los 2 intentos fue por una instancia mía sin apagar — de hecho
encontré y mate un proceso HUÉRFANO MÍO (tracker aislado de un intento
anterior de esta misma tarea, puerto 8070, apuntando a un emulador que ya
había matado — ~97MB de RAM sin ningún propósito) antes de reiniciar el
tracker de la demo, buena práctica que no había hecho tan explícita antes.

No forcé más intentos — ni el test de backend (`planes_landing_tarea34.test.js`)
ni los 2 specs e2e se corrieron contra un emulador real esta ronda. Lo que
SÍ verifiqué, contra el tracker de la DEMO (ya reiniciado con el código
nuevo, ver abajo): `/health`, CORS en ambos orígenes, login real de admin,
`GET /api/cases` (38 casos, el seed real de la demo intacto),
`POST /api/register` con `plan:'empresarial'` (201), `GET /api/subscription/plan`
(200, `plan:null` porque la demo nunca tuvo un plan global configurado —
correcto, no un error), `GET /api/contact-leads` (200, lista vacía),
`GET /api/me/org` con una cuenta sin `orgId` (400 limpio, no 500) — ningún
endpoint nuevo rompe el arranque ni devuelve 500 en estos chequeos básicos,
pero esto NO es lo mismo que la suite completa de 21 tests contra datos de
prueba controlados. Pendiente: correr `planes_landing_tarea34.test.js` y
los 2 e2e cuando el host lo permita.

### Reinicio del tracker de la demo (instrucción explícita)

Mismo procedimiento que la vez pasada: identifiqué el PID real (no el
huérfano) por su `/proc/<pid>/environ`, lo mate, y lo relancé con el MISMO
entorno exacto (`PRICING_TABLE=24sep`, puerto 8081, mismas env del
emulador). Arrancó bien (tardó un poco más en responder al primer `/health`
por la carga del host, nada más). Los emuladores de la demo (puerto 9099/
8090/9199, corriendo desde TAREA 30) nunca se tocaron — confirmado que
siguen siendo el MISMO proceso de siempre, no algo que haya reiniciado.

### Guía de prueba para Rick (los 3 planes + el lead del hero)

Túneles SSH necesarios desde Argus — los 4 de siempre (`8092` frontend,
`9099` Auth emulator, `8081` tracker, `9199` Storage) **más uno nuevo si
quiere verificar el correo desde la UI del emulador en vez de con
"Reenviar correo"/"Ya verifiqué, continuar"**: `4040` (Emulator UI).

**Plan Consulta:**
1. `http://localhost:8092/index.html` → "Planes y Precios" → "Solicitar"
   bajo Plan Consulta → crea la cuenta → verifica el correo → completa la
   captación (pantalla bloqueante, una sola vez).
2. Ve el mensaje "Farmazed está preparando tu diagnóstico" y el nav
   "Diagnóstico" (vacío todavía).
3. Logout. Entra como `analista@farmazed.test` / `Farmazed123!` →
   `/admin/empresas.html` → busca la empresa que acabas de crear → "Cargar
   diagnóstico" → llena los 5 campos → Guardar.
4. Logout. Vuelve a entrar como el cliente → "Diagnóstico" → ya se ve lo
   que cargó el analista → botón "Contratar el registro".
5. Confirma que ahora "Solicitar Registro" está disponible (el plan subió).

**Plan Registro:** mismo botón "Solicitar" bajo Plan Registro →
registro/verificación/captación → directo a "Solicitar Registro" (el
wizard de siempre) → cotización → "Pagar con PayPal" (TAREA 33, mock).

**Plan Empresarial:**
1. "Solicitar" bajo Plan Empresarial → registro/verificación/captación.
2. Nav "Informes de avance" → llena "Solicitud de propuesta" (productos
   estimados + necesidades) → Enviar.
3. Logout. Como admin → `/admin/empresas.html` → esa empresa ahora tiene
   "Definir condiciones" → monto, período, gestor de cuenta (el selector
   solo lista analistas reales) → Guardar.
4. Logout. Como el cliente → "Informes de avance" → ve las condiciones →
   "Aceptar y suscribirme" → queda "Suscripción activa" + la tabla de
   todos los casos de la empresa.

**Nota — 2 cosas separadas que se parecen:** el botón "Suscribirme" de **Mi
Empresa** (TAREA 33) sigue existiendo para CUALQUIER empresa, al plan
GLOBAL que el admin define en `/admin/precios.html` — es un riel
independiente del Plan Empresarial de esta tarea (que es a-convenir, por
empresa). No es un bug que convivan los dos, es el diseño del PM; aviso
por si genera confusión al probar.

**Lead sin cuenta:** `index.html`, el formulario "Solicitar Diagnóstico
Regulatorio" debajo del slider (NO el de la sección de planes) → llenar y
"ENVIAR CONSULTA" → como staff/admin, `/admin/bandeja.html` → card
"Consultas del sitio (sin cuenta)" → "Invitar a crear cuenta".

### Qué NO se hizo

- Sin commit ni deploy — instrucción explícita.

### Actualización — verificación parcial completada (3-oct, noche)

El host bajó lo suficiente (load 1-min de 2.17, swap liberó ~157Mi) para
retomar. Orden pedido por el PM: backend completo primero, después los 3
e2e pendientes de a uno.

- **Backend: 198/198, 0 fallos** — las 2 suites nuevas
  (`pagos_paypal_tarea33.test.js` 19/19, `planes_landing_tarea34.test.js`
  20/20) más todo el resto (permissions 80, registro_tarea32 16,
  paquete_iea 4, transition_gates 12, payment_concepts 6, checklist/
  formularios/precios puros 32+4, migration 5) sin ninguna regresión.
- **e2e `pago_paypal.spec.js` (TAREA 33): 2/2 confirmados** (en corridas
  separadas — el primero completo, el segundo aislado tras limpiar
  cotizaciones/pagos viejos del mismo caso fixture que había dejado la
  corrida del backend justo antes; mismo patrón de "fixtures compartidos
  entre test files" ya documentado antes, no un bug nuevo).
- **e2e `plan_consulta.spec.js`: 3 bugs reales encontrados y arreglados en
  el arnés de prueba** (ninguno del producto), todavía SIN una corrida
  limpia completa — la última intentona la mató el sistema por memoria
  crítica del host (no por el test; instrucción explícita de no
  reintentarla sola):
  1. El formulario del hero (`contact-form2`) nunca disparaba mi listener:
     lo until até al `submit` del form, pero el jQuery de vendor
     (`script.js`) ya tiene su PROPIO listener de `click` en el botón que
     llama `preventDefault()` — eso cancela la acción por defecto del
     click (enviar el form) ANTES de que el evento `submit` llegue a
     dispararse. Arreglado: mi listener ahora escucha `click` en el mismo
     botón (`#submit_contact2`), no `submit` en el form — un segundo
     `addEventListener('click', ...)` en el mismo elemento SÍ se ejecuta
     igual (el `preventDefault()` de un listener no frena a los demás).
     **Este bug también existía fuera de la prueba** — el formulario del
     hero en producción tampoco habría funcionado nunca con el listener
     original.
  2. `page.once('dialog', ...)` sobre un prompt específico reventaba con
     "Cannot accept dialog which is already handled" porque el listener
     GLOBAL del `beforeEach` (`page.on('dialog', d => d.accept())`) ya lo
     había resuelto primero (vacío, sin el texto que necesitaba el
     prompt). Arreglado: un solo listener global que mira `dialog.type()`
     y contesta con el valor correcto si es un `prompt`.
  3. El nombre de empresa de la prueba era fijo (`'E2E Consulta Co'`) —
     reintentos anteriores (fallidos) ya habían dejado más de una empresa
     con ese nombre en Firestore, y el locator sin `.first()` rompía en
     "strict mode violation" al encontrar más de una fila. Arreglado:
     nombre único por corrida (`Date.now()`), mismo criterio que ya usan
     los correos de prueba.
  4. (No es un bug, solo un ajuste de locator) `getByText('diagnóstico
     regulatorio')` a nivel de página rompía en strict mode porque el
     prototipo del módulo Resumen YA tiene esa frase en otro texto
     estático — acotado a `#bienvenida-text` específicamente.
- **e2e `plan_empresarial.spec.js`: todavía sin intentar correrlo** — se le
  aplicó preventivamente el mismo fix del punto de verificación de correo
  (ver abajo) por las dudas, pero no hubo tiempo de una corrida real antes
  de que el host volviera a subir.
- **Hallazgo transversal (afecta a los 2 specs nuevos, ya arreglado en
  ambos)**: el patrón `confirmarCorreo() -> goto('/login.html') ->
  waitForURL(verificar-correo.html)` que SÍ funcionó siempre en
  `registro.spec.js` (TAREA 32) no es 100% determinista — al restaurar la
  sesión persistida, Firebase a veces ya trae `emailVerified` fresco del
  servidor (sin pasar por la pantalla intermedia) y a veces no; no hay
  control real sobre ese timing desde el test. Arreglado aceptando
  CUALQUIERA de los 2 destinos (`verificar-correo` o `client-dashboard`
  directo) en vez de exigir uno específico — el punto de estos 2 specs es
  el flujo de cada plan, no la mecánica exacta de la verificación (eso ya
  lo prueba a fondo `registro.spec.js`).

## 2026-10-03 — TAREA 34: verificación completa (backend + e2e), host ya estable

Orden pedido por el PM ("backend completo, luego los e2e pendientes de a
uno... apagando tu instancia aislada al terminar") ejecutado de punta a
punta con el host ya en condiciones normales (load <2, swap liberándose).
Resultado final, TODO VERDE:

- **Backend**: 198/198 (sin regresiones) — incluye
  `pagos_paypal_tarea33.test.js` 19/19 y `planes_landing_tarea34.test.js`
  20/20, confirmados de nuevo en esta corrida.
- **`e2e/pago_paypal.spec.js`**: 2/2 (TAREA 33, quedaba pendiente desde la
  ronda anterior por el host).
- **`e2e/plan_consulta.spec.js`**: 2/2. Bug real encontrado y corregido en
  el camino: `requireVerifiedLogin()` (`portal/js/auth.js`) dejaba pasar al
  usuario con `user.emailVerified===true` pero el ID TOKEN cacheado seguía
  con el claim viejo `email_verified:false` — cualquier llamada a la API
  justo después de entrar (sin pasar por el botón "Ya verifiqué,
  continuar") daba 403 del gate de TAREA 32 aunque la pantalla ya hubiera
  dejado pasar. Fix: `await user.getIdToken(true)` justo después de
  confirmar `emailVerified`. Además: el hero `#submit_contact2` nunca
  enviaba el form porque el jQuery de vendor ya hacía `preventDefault()` en
  el `click` del mismo botón, cancelando el `submit` antes de que mi
  listener (atado a `submit`) pudiera correr — fix: atar el listener nuevo
  al `click` del botón, no al `submit` del form (bug de producción real,
  preexistente, no solo de la prueba). También: `admin/empresas.html` es
  admin-only por SU PROPIO gate de página (`isAdmin()`), aunque el permiso
  de backend `orgs.edit_diagnostico` sí admite cualquier staff — hoy solo
  admin puede llegar a "Cargar diagnóstico" por la UI; si Rick quiere que
  analista/abogado/regente también entren a esa página hace falta tocar el
  gate de `empresas.html` (no se tocó, fuera de alcance de la 34). Y un
  último bug de carrera en el propio spec (no de producto): el botón
  "Contratar el registro" hace `window.location.reload()` de la MISMA url
  (sigue en `client-dashboard.html`) — `waitForURL` con ese mismo regex
  resolvía de inmediato porque la url actual ya calzaba, sin esperar el
  reload real, y el `page.evaluate()` siguiente caía en medio de la
  navegación real ("Execution context was destroyed"). Fix: esperar
  `page.waitForEvent('load')` armado ANTES del `dispatchEvent('click')`,
  en paralelo (mismo patrón TAREA 26 de otros specs).
- **`e2e/plan_empresarial.spec.js`**: 1/1, primera corrida real de este
  archivo. Bug de carrera (del spec, no de producto) encontrado y
  corregido: el submit de "Definir condiciones" en `admin/empresas.html`
  guarda vía API (async) y SOLO AL TERMINAR hace `alert('Condiciones
  guardadas.')`; el spec seguía derecho a `logout()` sin esperar ese
  alert, y cuando el backend tardaba un poco el diálogo llegaba tarde,
  justo cuando `logout()` ya estaba navegando — "Not attached to an active
  page". Fix: armar `page.waitForEvent('dialog')` ANTES del click y
  correrlo en paralelo con él (mismo patrón), para no seguir hasta que el
  alert realmente se dispare.

Instancia aislada (emuladores 9198/8190/9298, tracker 8070, estático 8093)
apagada por completo al terminar, confirmada sin procesos residuales. Demo
de Rick (8081/8090/9099/9199/8092, tmux `farmazed-demo`) verificada viva
antes y después, sin tocar. Sin commit ni deploy, como se pidió.

TAREA 34 queda VERIFICADA de punta a punta. Pendiente de Rick: decidir si
quiere abrir `admin/empresas.html` a todo el staff (ver nota arriba) — no
es parte de la 34, es un hallazgo colateral.

## 2026-10-03 — TAREA 35: `admin/empresas.html` abierta a todo el staff

Pedida por Rick directo tras la 34 (el hallazgo colateral de arriba). Solo
frontend estático + un permiso de backend — queda activo en la demo sin
reiniciar nada (confirmado: no se reinició ni el tracker ni los
emuladores de la demo en esta ronda).

- **Backend**: nuevo permiso `orgs.list` (listar empresas, solo lectura),
  roles `[...STAFF_ROLES, 'admin']` — separado de `orgs.manage` (crear una
  empresa directa + ver sus miembros), que sigue siendo solo admin.
  `GET /api/orgs` ahora pide `orgs.list` en vez de `orgs.manage`
  (`tracker/routes/orgs.js`). `orgs.edit_diagnostico` ya era staff+admin
  desde la 34 — no se tocó. Tabla regenerada
  (`node tracker/scripts/generate_permissions_doc.js`,
  `organizacion/09_TABLA_PERMISOS.md`) — de paso recogió varias filas de
  TAREA 33/34 que estaban pendientes de regenerar desde la vez pasada
  (quotes.pay, subscription.*, orgs.edit_captacion, orgs.read_leads,
  orgs.set_plan, orgs.edit_diagnostico, contact_leads.read,
  empresarial.*), no es contenido nuevo, solo el doc desincronizado.
- **`tracker/tests/permissions.test.js`**: el describe `orgs.manage —
  solo admin` se partió en dos: `orgs.list — staff y admin (TAREA 35)`
  (admin/analista/abogado/regente SÍ listan, cliente_titular NO) y
  `orgs.manage — crear empresa directa y ver miembros, solo admin`
  (admin SÍ crea y ve miembros; analista NO puede ninguna de las dos,
  aunque sí pueda listar).
- **`admin/empresas.html`**: gate de página cambiado de `isAdmin()` a
  `hasBackofficeAccess()` (igual que `bandeja.html`). El rol efectivo
  (`GET /api/me/permissions`) decide qué ve cada uno — no un segundo if
  de rol a mano: staff solo ve la lista de empresas + "Cargar
  diagnóstico" (si `plan==='consulta'`); "Ver miembros", "Definir
  condiciones", "Invitar titular/empleado" y la tabla de Invitaciones
  quedan ocultos para no-admin (siguen siendo acciones solo-admin en el
  backend — el peor caso de un error en el flag del front sería un botón
  que de todos modos rebota en 403, no un hueco real).
- **`admin/bandeja.html`**: el enlace "Empresas" del sidebar ahora se
  muestra según el permiso real (`myPerms.permissions.includes('orgs.list')`)
  en vez de `role==='admin'` a mano. "Precios" sigue admin-only.
- **`e2e/plan_consulta.spec.js`**: el paso 5 ("staff carga el
  diagnóstico") ahora loguea como `analista@farmazed.test` en vez de
  admin — ya no hace falta el rodeo documentado en la 34. De paso se le
  aplicó la MISMA carrera-con-diálogo encontrada y corregida en
  `plan_empresarial.spec.js` (el submit de "Cargar diagnóstico" también
  hace `alert()` async antes de un logout inmediato) — mismo fix
  (`page.waitForEvent('dialog')` armado antes del click, en paralelo).

Verificación en la instancia aislada (emuladores 9198/8190/9298, tracker
8070, estático 8093), host con load <2 todo el tiempo:
- Backend completo: 207/207 (incluye `migrate_roles.js` corrido a mano
  antes de `migration.test.js`, ya que corrí los archivos de prueba
  directo en vez del script orquestador que lo hace solo — sin eso salían
  2 "fail" en `migration.test.js` que NO son regresión, son el paso de
  migración que falta). Los 2 describe nuevos de permisos (`orgs.list` /
  `orgs.manage`) pasan limpio.
- `e2e/plan_consulta.spec.js`: 2/2 (con analista cargando el diagnóstico).
- `e2e/plan_empresarial.spec.js`: 1/1 (sin regresión en el flujo admin de
  "Definir condiciones").

Instancia aislada apagada por completo al terminar (confirmado sin
procesos residuales en 8070/8093/9198/8190/9298). Demo de Rick verificada
viva antes y después (tracker 8081 responde 200), nunca tocada. Sin
commit ni deploy.

### Ajuste — reinicio del tracker de la demo (correcto: `orgs.list` es
### cambio de backend, Node no recarga código solo)

El PM marcó bien un hueco: verificar TAREA 35 en la instancia AISLADA no
alcanza para que la DEMO lo tenga — el tracker de la demo seguía corriendo
con el código viejo (orgs.manage) en memoria. Reiniciado SOLO el proceso
del tracker de la demo (PID viejo 2476754 -> nuevo, mismo entorno exacto
leído de `/proc/<pid>/environ` antes de matarlo: PORT=8081,
FIRESTORE_EMULATOR_HOST=localhost:8090, FIREBASE_AUTH_EMULATOR_HOST=
localhost:9099, STORAGE_EMULATOR_HOST=http://localhost:9199, etc.).
Emuladores de la demo NO tocados.

Verificado con un login REAL de analista contra la demo (Playwright
headless, solo lectura, cerrado al terminar):
- `GET /api/orgs` con el token real de analista -> **200** (antes del
  reinicio hubiera dado 403, código viejo en memoria).
- `admin/empresas.html` carga y muestra las 4 empresas de la demo.
- El link "Empresas" del sidebar de `bandeja.html` aparece para analista.
- "Ver miembros", "Definir condiciones" y la columna "Empleados" NO
  aparecen (correcto, siguen admin-only).
- "Cargar diagnóstico" no aparece en ninguna fila — correcto, ninguna de
  las 4 empresas de la demo tiene `plan:'consulta'` ahora mismo (dato de
  fixture, no es un bug).

Encontrado en el camino (y corregido, dato no código): el `analista@
farmazed.test` de la DEMO tenía `emailVerified:false` en el emulador de
Auth — dato viejo, de antes de que seed_roles.js empezara a poner
`emailVerified:true` (TAREA 32). Causaba que el login de analista
rebotara a verificar-correo.html y no es nada de TAREA 35. Corregido con
`admin.auth().updateUser('role-analista', { emailVerified: true })`
(mismo flag que ya pone seed_roles.js) — no se tocó ningún otro dato de
la demo, ni Firestore, ni otras cuentas.

---

## ESTADO AL CIERRE — 2026-10-04, antes de un reinicio de sesiones (leer primero)

Rick pidió respaldo + reinicio de sesiones para cargar plugins nuevos.
Resumen de TAREAS 30-35 y lo que queda pendiente — nada de esto está
commiteado, todo vive solo en el working tree de esta máquina (Patch).

**TAREA 30** — `demo_local.sh`: demo a mano para Rick por túnel SSH desde
Argus (`tmux farmazed-demo`). Hecha y verificada. Sigue corriendo.

**TAREA 31** — CORS del tracker (`localhost` vs `127.0.0.1`): arreglado
(`tracker/index.js` + `portal/js/config.js`). Hecha y verificada.

**TAREA 32** — Registro abierto de clientes nuevos (§H.13): alta sin
invitación + verificación de correo (front Y backend, claim del token).
Hecha, 16/16 backend, e2e verificado.

**TAREA 33** — Suscripción + pago PayPal (§H.14, proveedor mock):
`subscription.*` (plan global), pago de cotización por concepto. Hecha,
19/19 backend + `pago_paypal.spec.js` 2/2.

**TAREA 34** — 3 flujos de alta desde los planes del landing (§H.15):
Consulta (diagnóstico), Registro (wizard→cotización→pago), Empresarial
(propuesta→condiciones→suscripción), + lead sin cuenta del hero. Hecha,
backend 198/198 (en su momento) + `plan_consulta.spec.js` 2/2 +
`plan_empresarial.spec.js` 1/1. 2 bugs reales de producto encontrados y
corregidos en el camino (token de verificación obsoleto en
`requireVerifiedLogin()`; el form del hero nunca enviaba nada).

**TAREA 35** — `admin/empresas.html` abierta a todo el staff (hallazgo
colateral de la 34): permiso nuevo `orgs.list` (staff+admin, separado de
`orgs.manage` que sigue admin-only). Hecha, backend 207/207 + e2e
re-verificados. **Reiniciado el tracker de la DEMO** (solo el proceso,
mismo entorno, emuladores intactos) para que el cambio de backend
quedara activo ahí — verificado con login real de analista
(`GET /api/orgs` → 200, lista visible en `empresas.html`).

### Pendiente — necesita que Rick decida

1. **Commit**: nada de TAREA 6 en adelante está commiteado — toda esta
   sesión (30-35 incluidas) sigue solo en el working tree. Falta que Rick
   autorice explícitamente el commit (y, aparte, el push/deploy) antes de
   subir nada. Ver respaldo de esta fecha más abajo.
2. **Las "dos suscripciones" que conviven (señalado en TAREA 34, sección
   de arriba, "Nota — 2 cosas separadas que se parecen")**: el botón
   "Suscribirme" de **Mi Empresa** (TAREA 33) sigue vivo para CUALQUIER
   empresa, al plan GLOBAL que el admin define en `admin/precios.html` —
   es un riel independiente del **Plan Empresarial** (TAREA 34/35, a
   convenir por empresa, con gestor de cuenta). Las dos cosas coexisten
   por diseño del PM, pero no se le preguntó a Rick directamente si
   quiere que sigan las DOS o si alguna se retira/fusiona — queda como
   pregunta abierta, no como bug.

### Respaldo de esta fecha

`~/respaldo-farmazed/2026-10-04/cambios.patch` (204 KB, 3654 líneas —
`git diff` de los archivos trackeados y modificados; verificado con
`git apply --check` contra un clon fresco del mismo HEAD,
`bde53bb...610d6` — aplica limpio) + `untracked.tar.gz` (2.6 MB, 28
archivos nuevos sin trackear, sin `node_modules`). Mismo método que
`~/respaldo-farmazed/2026-09-30c/` — solo lectura sobre el árbol del
repo, sin `git stash` ni commit.

---

## 2026-10-04 — TAREA 36: Auditoría completa con los plugins nuevos (PM) — hallazgos y plan

Orden de Rick (vía Dandy, 04-oct 10:25, verificada con `pm-order-check`):
avanzar con lo pendiente usando ecc / agent-skills / understand-anything /
ponytail y revisar el proyecto completo (estructura de backend, conexiones,
funcionalidad). **Auditoría solo lectura**: no se editó código. 6 revisiones
en paralelo: `ecc:architect`, `ecc:security-reviewer`,
`ecc:silent-failure-hunter`, `ecc:code-explorer` (conexiones front↔API),
`ecc:pr-test-analyzer`, `ponytail-audit`. Rutas relativas a `tracker/`
salvo que se indique. Línea base de tests: TAREA 36-A (developer), ver abajo
cuando la reporte.

### Lo que está bien (no tocar)
- Todos los endpoints que llama el front existen y coinciden en método,
  ruta y payload. El front no toca Firestore/Storage directo (todo vía
  tracker con admin SDK).
- Rutas nuevas no públicas con `requireAuth` + `requirePermission`; el
  monto de PayPal lo recalcula el servidor; `canAccessQuote/Case` validan
  org; el rol del registro lo fija el servidor; `orgId` sale del claim.
- Verificación de firma real de PayPal falla cerrado sin `PAYPAL_WEBHOOK_ID`.
- Ningún archivo fuente >800 líneas salvo `farmazed-web/admin/expediente.html`
  (958). Gates de transición probados por REST y MCP.
- **Secretos reales en el repo: ninguno.** Solo valores de dev
  (`dev-admin-local`, contraseña de seeds que se niegan a correr sin emulador).

### CRITICAL — bloquean cualquier salida a producción
C1. **XSS almacenado público→admin.** `farmazed-web/admin/bandeja.html:148-155,187-193`
    (y demás páginas admin) meten en `innerHTML` sin escapar datos de
    `POST /api/contact-leads` (público), `org.nombre` del registro y
    `captacion.*`. Un anónimo roba el token del admin. No existe función de
    escape en el front; CSP desactivada (`index.js:23`).
C2. **Pagos caen al mock en silencio.** `services/payments/index.js:17-24`:
    si falta una variable de PayPal usa el mock, que captura todo como
    COMPLETED y da por válido cualquier webhook (`mock.js`). En Cloud Run un
    typo = pagos gratis que abren el gate de fase_05 y suscripciones activas.
    `.env.example` no lista las variables de PayPal.
C3. **Captura de pago no atómica.** `routes/quotes.js:533-651`: `crear-orden`
    pisa el `orderId` (dos pestañas → orden aprobada huérfana); `capturar`
    sin transacción → pagos duplicados por doble clic/reintento; si
    Firestore falla tras cobrar, cliente cobrado sin rastro y el 422
    `ORDER_ALREADY_CAPTURED` no se reconcilia; monto comparado como float
    con `!==` (`:617`) → 409 con el dinero ya cobrado.
C4. **Aceptar invitación sin auth y con `uid` libre.** `routes/invitations.js:122-156`:
    quien tenga un token aplica el rol de la invitación (incluido admin) y
    `emailVerified:true` a cualquier cuenta; borra claims previos; `used` no
    es atómico.

### HIGH
H1. `middleware/permissions.js:38-41` cuenta sin claims → `cliente_titular`:
    alta directa con el SDK cliente se salta la verificación de correo y
    puede crear casos.
H2. `routes/documents.js:327-356` PATCH de revisión sin `getCaseOrFail` →
    staff no asignado aprueba/rechaza documentos ajenos.
H3. `routes/mcp.js:498-547` `handleRequestDocument` duplica
    `POST /documents/request` **sin** pasar por `checkTransition`.
H4. Rate limit evadible (`register.js:70`, `contact_leads.js:38`,
    `index.js:70`): IP del primer `X-Forwarded-For` (falsificable), Map en
    memoria sin purga, no compartido entre instancias.
H5. Transiciones de estado sin transacción (`cases.js:254-304`,
    `mcp.js:480-493`): dos transiciones concurrentes pueden saltar el gate
    de pago; `update` + `statusHistory` no atómicos;
    `transitions.js:195` traga el error de `attachCaseToDraftQuote`.
H6. Suscripciones (`subscription.js:61-135`, `empresarial.js:44-141`): doble
    clic → dos suscripciones PayPal; cada edición del plan crea producto/plan
    nuevo (huérfanos); `cancel` da 500 si ya estaba cancelada en PayPal.
H7. Webhook PayPal (`webhooks.js`) solo hace `console.log` y responde 200:
    `pendiente` nunca pasa a `activa`, `CANCELLED` nunca se refleja, sin
    idempotencia por `event.id`. **Hay que resolverlo antes de PayPal real.**
H8. `register.js:83-117,238-256` usuario de Auth huérfano si falla org/claims
    (reintento = 409). `services/payments/paypal.js` `fetch` sin timeout.
H9. **Tests de pagos, registro y planes no corren en `verificar_local.sh`**:
    `pagos_paypal_tarea33`, `registro_tarea32`, `planes_landing_tarea34` no
    están en `scripts/run_permission_tests.sh`. 0 tests de 401; 0 de webhook
    con firma inválida; `messages`, `employees`, `me`, `storage` sin tests.

### MEDIUM
- Config: `index.js:18-19` y `services/storage.js:7,10` ponen `projectId`
  `'farmazed'` por defecto → en local sin `FIRESTORE_EMULATOR_HOST` apunta a
  **producción**. Falta validar variables al arrancar (`MCP_KEY`≥32,
  PayPal). `.env.example` con `ADMIN_KEY` y `ALLOWED_ORIGINS` sin uso.
- Reglas: solo existen `firestore.emulator.rules`/`storage.emulator.rules`
  (`allow all`) y `firebase.json` las apunta → un `firebase deploy` a prod
  abriría la BD. Falta `firestore.rules`/`storage.rules` de prod deny-all.
- CORS (`index.js:30-37`): `localhost` permitido en prod; regex
  `/\.farmazed\.com$/` sin ancla ni `https`.
- Errores: todos los `catch` devuelven `e.message` al cliente (filtra error
  de PayPal) y casi ninguno hace `console.error`.
- Validación: `payments.js:137-216` fecha inválida → 500, monto `Infinity`,
  monto inválido → 0 que abre el gate; blob huérfano en Storage.
  `quotes.js:143` / `pricing_desglose.js:216` precio ausente → cotización $0
  silenciosa. `requireMcpKey` compara con `!==` (usar `timingSafeEqual`).
  `GET /qr` público escribe en Firestore sin límite.
- Estructura: `services/transitions.js:33` importa lógica colgada de los
  routers (`router.hasConceptPayment = …`) → mover a `services/`. Alta de
  empresa en 4 sitios con campos distintos (`register`, `invitations`,
  `contact_leads`, `orgs`). `getCaseOrFail` copiado 3 veces + 5 en
  `cases.js`. Rate limit copiado.
- Front: `admin/precios.html:345,389,513` no revisa `res.ok` (error = "no hay
  plan"/tabla vacía). `dashboard.html:744` URL de Cloud Run fija (es spec de
  diseño, no se borra). `api.farmazed.com` (prod en `config.js:61`) sin
  confirmar en `DEPLOY.md`.

### LOW / limpieza (ponytail, ~-170 líneas y -4 dependencias seguras)
`express-validator` sin uso; `uuid` → `crypto.randomUUID()`;
`@google-cloud/firestore` solo para `Timestamp`; `nodemon` → `node --watch`.
`init()` repetido en 6 páginas admin → `initBackoffice()` en `auth.js`;
`precios.html` con fetch a mano en vez de `api.js`; `uploadDocument`/
`registerPayment` duplican `apiFetch`; fechas a mano en `mcp.js`/`messages.js`
(ya existe `serializeTimestamps`); `STAFF_EXIT_OWNER = {}` muerto; código sin
consumidor (`createOrg`, `getQuote`, `deleteDocument` en `api.js`). Renombrar
tests `*_tareaNN` a nombres de dominio. Sleeps fijos en e2e. Agregar
`farmazed-web/demo.html` a `.gitignore`.

### Plan (una tarea a la vez; cada entrega pasa `ponytail-review` + revisión de código/seguridad antes de aceptarse)
| # | Tarea | Cubre |
|---|---|---|
| 36-A | Línea base de la suite completa (en curso, developer) | — |
| 37 | Escape de salida en todo el admin/portal + `maxLength` en servidor para campos públicos | C1 |
| 38 | Pagos atómicos: `crear-orden`/`capturar` con transacción e id determinista, centavos, reconciliación 422, timeouts en `paypal.js`; suscripción con transacción y `cancel` idempotente | C3, H6, H8(timeout) |
| 39 | Auth y acceso: invitación con `requireAuth` + email + transacción; sin claims → 403; `getCaseOrFail` en PATCH de documentos (y helper único); MCP `request_document` por `checkTransition`; `trust proxy` + `req.ip` + rate limit único; rollback del registro; `timingSafeEqual` | C4, H1-H4, H8 |
| 40 | Fallo cerrado y config: mock solo con emulador o `PAYMENTS_PROVIDER=mock`; validación de variables al arrancar (sin `projectId` por defecto); reglas de prod deny-all; CORS de prod; errores genéricos + `console.error`; `.env.example` al día | C2, MEDIUM config/CORS/errores |
| 41 | Transiciones atómicas (`applyTransition()` único con transacción, REST y MCP) y validación de montos/fechas en pagos | H5, MEDIUM validación |
| 42 | Tests: meter las 3 suites en el script, 401, webhook firma inválida, captura en paralelo, org ajena, renombrar `tareaNN` | H9 |
| 43 | Limpieza ponytail segura (dependencias, helpers duplicados, `res.ok` en `precios.html`) | LOW |

**Necesita decisión de Rick** (no se ejecuta sin respuesta):
1. **Webhook PayPal (H7)**: qué debe hacer cada evento (activar/cancelar
   suscripción, registrar pago). Requisito antes de PayPal real.
2. **Commit/push**: TAREAS 30-35 (último commit `bde53bb`, 3-oct) y las correcciones 37-43 siguen sin commit.
3. **Dos suscripciones** (plan global de Mi Empresa vs Plan Empresarial):
   pregunta abierta del 04-oct.
4. Retirar el tarifario legacy (~-290 líneas) cuando prod use `PRICING_TABLE=24sep`.
5. Unificar el CSS de `admin/precios.html` con el resto (cambia cómo se ve).

## 2026-10-04 — TAREA 36 (parte A, solo lectura): línea base antes de la auditoría

No se editó ningún archivo del repo. Instancia aislada (emuladores 9198/8190/9298,
tracker 8070, estático 8093, `firebase.test-ports.json`); scripts de la corrida en el
scratchpad de la sesión, no en el repo. Demo (tmux `farmazed-demo`) verificada viva
(8081 → 200) al final; instancia aislada apagada por PID. Host con load 15–22 todo el rato.

Backend (`node --test`, una sola instancia, en este orden): permissions 86/86,
paquete_iea 4/4, transition_gates 12/12, payment_concepts 6/6, checklist_tarea25 17/17,
checklist_tarea26 5/5, formularios_tarea28 7/7, checklist_tarea28 3/3, precios_tarea28 4/4,
registro_tarea32 16/16, planes_landing_tarea34 20/20, migration 5/5 (tras migrate_roles),
**pagos_paypal_tarea33 18/19**. Total backend en la corrida completa: 203/204.
Fallo: `capturar de verdad -> crea los pagos por concepto` — actual
[honorarios×3, tasa_dnfd×3] vs esperado [honorarios, tasa_dnfd]: datos de otra prueba
previa en el mismo caso. Solo, en instancia limpia: 19/19.

Playwright: solo 4 de 15 specs se pueden correr en instancia aislada (registro,
plan_consulta, plan_empresarial, pago_paypal: leen FZ_AUTH_PORT/fzAuthPort). Los otros 11
(checklist, checklist_recibo_iea, document_versions, estados, flujo_completo, formularios,
paquete_iea, payments, pricing, quotes, roles) fijan Auth en 9099 = el de la demo: NO
corridos, por no tocar la demo (y `e2e/run.sh` hace `pkill` por patrón, mataría la demo).
Resultado de los 4: 4 pasan; `pago_paypal.spec.js` falla 2/2 si corre DESPUÉS de los tests
backend en la misma instancia (`#btn-suscribir` no aparece / status-select ≠ fase_03:
caso `case-pago-paypal-test` ya mutado) y pasa 2/2 solo en instancia limpia. Es
acoplamiento de estado entre `pagos_paypal_tarea33.test.js` y el spec, no regresión de
producto; no se arregló (parte A solo lectura).

## 2026-10-04 — TAREA 37: XSS almacenado público→admin (C1)

Hecho (sin commit/push; demo viva 200 antes y después; instancia aislada 9198/8190/9298, 8070, 8093):
- **Front**: `esc()` (& < > " ') exportado desde `portal/js/auth.js` (no hay archivo nuevo). Aplicado a todo dato de BD/usuario en
  innerHTML/atributos/onclick de `admin/{bandeja,casos,cotizaciones,empresas,expediente,formularios,precios}.html` y `portal/js/wizard.js`
  (toast escapa su mensaje). `registro.html`, `verificar-correo.html`, `login.html`, `index.html`, `demo.html`: sin sumideros (solo textContent).
  `expediente.html` `fieldRow`: el botón copiar usaba el valor dentro de un string JS en onclick → ahora `data-copy` + `this.dataset.copy`.
  `empresas.html`: `verMiembros(id)` busca el nombre en `orgsCache` en vez de recibirlo por onclick.
- **Servidor**: `tracker/utils/validar_texto.js` (nuevo, `textoError`/`trimOrNull`: solo string, trim, tope, 400). Topes: nombre/empresa/tipoProducto/orgName 120,
  correo 254, teléfono 40, país 80, password 6–128, fabricante 200, nº productos 120. En `contact_leads.js`, `register.js`, `orgs.js` (captación y POST /api/orgs).
  Se guarda con trim; NO se escapa en servidor (el escape es del front). El form del hero no manda `mensaje` y el backend no lo guarda: sin tope porque no existe el campo.
- **Pruebas nuevas**: `tracker/tests/xss_tarea37.test.js` (30, enganchada en `run_permission_tests.sh`) y `e2e/xss_bandeja.spec.js`.
  El spec FALLA contra el front con `esc` neutralizado (copia temporal en 8094) y pasa con el fix; backend sin fix no tenía topes (los 400 no existían).
- **Verificación**: backend 30/30 nuevos; suite 232 pasan, 2 fallan en `pagos_paypal_tarea33` (el acoplamiento de estado ya anotado en T36→T42,
  pasa 19/19 solo). Playwright: xss_bandeja, plan_consulta, plan_empresarial OK; `registro.spec` dio timeout de 45 s una vez bajo load ~25 y pasa solo (27 s).
  Smoke (script temporal, ya borrado) cargó las 7 páginas admin + portal/nuevo con 0 errores JS y expediente renderiza el caso.
- **Revisiones**: ponytail-review → un shrink aplicado (`textoError` −3 líneas). ecc:security-reviewer → 0 CRITICAL, 0 HIGH.

No hecho / pendiente (decisión: fuera del alcance pedido):
- **CSP**: no activada (rompe scripts inline). Pendiente.
- **`client-dashboard.html` / `dashboard.html`** (spec de diseño, no tocadas): mismo patrón. client-dashboard: 23 innerHTML, 0 esc; sin escapar
  `paisYNombreFabricante`/`numeroProductosPorCategoria` (~1714-1716), campos del diagnóstico (~1930-1934, XSS staff→cliente), `err.message`, cotizaciones, productos, docs, mensajes. dashboard.html: 13 innerHTML. Tarea aparte recomendada, empezando por 1714/1716 y 1930-1934.
- MEDIUM (reviewer): `onclick="f('${esc(x)}')"` no es seguro si el valor trae `'` (expediente, empresas, precios, y `location.href` en bandeja/casos); hoy los valores son ids autogenerados/estáticos, no explotable. Arreglo: data-* + listener delegado.
- MEDIUM: rate limit de contact-leads/register usa `x-forwarded-for` controlable por el cliente y el Map nunca se purga → flood de leads / memoria. Arreglo: `trust proxy` + `req.ip` + purga.
- LOW: `PUT /diagnostico` y `POST /api/empresarial` sin tope/tipo (guardan crudo); `categoriasProducto` sin tope de cantidad; zero-width chars pasan el trim; el e2e no cubre `empresas.html`/`expediente.html`.
- `admin/precios.html` hace `fetch /api/admin/pricing` sin Authorization: confirmar que la ruta es pública a propósito.

## 2026-10-04 — TAREA 37b: XSS restante (client-dashboard.html, dashboard.html, topes en diagnóstico/empresarial)

Sin commit/push. Demo viva 200 antes/después. Instancia aislada (9198/8190/9298, 8070, 8093; copia sin escape en 8094 para el "debe fallar").
- **`client-dashboard.html`** (portal vivo del cliente; NO rediseñado, NO borrado): el `<script type="module">` importa `esc` y hace `window.esc = esc`;
  el `<script>` clásico define `const esc = (v) => window.esc(v)` (envoltorio perezoso, el helper sigue siendo uno solo en `portal/js/auth.js`;
  los renders corren desde el módulo, después de asignar `window.esc` — confirmado por el revisor, sin carrera). Escapados todos los innerHTML con datos de BD/usuario:
  captación (fabricante, n.° productos, categorías), diagnóstico (5 campos), Mi Empresa (miembros, invitaciones, plan, suscripción), cotizaciones (código, motivo de rechazo, orden PayPal, data-quote),
  empresarial (periodo, gestor, informes), precios, pendientes/notificaciones, productos, pipeline, expediente (documentos, notas, formularios, actividad, pagos, plazo), docs, hilos y chat, badges y `err.message`.
- **`dashboard.html`**: es un prototipo con datos constantes (`var D = {...}`); lo único con dato real es el panel QR (`s.device`) → `window.esc(d)`. El resto no se tocó (no hay dato de usuario).
- **Servidor**: `PUT /api/orgs/:orgId/diagnostico` (5 campos, 500, string, trim, se guarda con trim) y `POST /api/empresarial/solicitar` (`productosEstimados` 1000) con `textoError`.
- **Pruebas**: `tracker/tests/xss_tarea37.test.js` ahora 46 (+16: tope/no-string por campo, 500 exacto→200, solo espacios→400, ausente→400, empresarial 1001/no-string→400);
  `e2e/xss_portal_cliente.spec.js` (cliente registra captación hostil, staff guarda diagnóstico hostil, el cliente abre client-dashboard → Mi Empresa y Diagnóstico: texto literal, 0 img/svg, `window.__xss` undefined): pasa con el fix y FALLA con `esc` neutralizado.
  Smoke temporal (borrado): portal de `titular-alfa` recorriendo los 9 módulos + dashboard admin → 0 errores JS.
- **Regresión**: backend 232+ igual que antes (único rojo `pagos_paypal_tarea33`, el coupling de T42). Playwright con fix: plan_consulta, registro, xss_bandeja, xss_portal_cliente OK.
  **`plan_empresarial.spec.js` es intermitente**: 3 de 4 en `--repeat-each=4` limpio; los fallos vistos fueron (a) `net::ERR_ABORTED` en `waitForURL` del login (patrón ya descrito en T26/T28 bajo load alto)
  y (b) una vez `#btn-aceptar-empresarial` ausente (el módulo se renderizó antes de que `window.__fzMyRole` estuviera cargado → sin botón de titular). No toca mi diff (no cambié el orden de carga ni la lógica de rol), pero no pude compararlo contra un baseline previo; candidato para T42 (esperar `__fzMyRole` / reintentar el login).
- **Revisiones**: ponytail-review → 1 recorte (`Number(idx)` sobraba, revertido a `${idx}`). ecc:security-reviewer → 0 CRITICAL, 0 HIGH.
- **No hecho (LOW/MEDIUM del revisor)**: el e2e solo cubre captación+diagnóstico (no producto/chat/miembros/motivo de rechazo en client-dashboard);
  `window.location.href = orden.approveUrl` sin validar `https://` (viene de PayPal); `(p.total||0).toLocaleString` sin `Number()` (hoy numérico); `querySelector('[value="${…}"]')` con valor de BD en la captación (enum forzado por el backend);
  `acc[s.device]`/`s.timestamp.slice` en el panel QR de dashboard.html (robustez, sin XSS); `formatDate` hace `split` sin `String()`. CSP y rate limit siguen fuera (T39/T40).

## 2026-10-04 — TAREA 38: pagos atómicos (C3 + H6 + timeout H8)

Sin commit/push. Demo viva 200 antes/después. Instancia aislada (9198/8190/9298, 8070, 8093). Diff chico, sin reestructurar archivos (eso es T41).
- **`routes/quotes.js`** (crear-orden / capturar): estado de `pagoPaypal` reservado dentro de `runTransaction` ('creando' / 'capturando', TTL 2 min para reservas abandonadas).
  crear-orden: si ya hay orden `creada` con el mismo monto → se REUTILIZA (200, `reutilizada:true`; el `approveUrl` ahora se guarda); en paralelo el segundo recibe 409; total 0 → 400.
  capturar: creada→capturando en transacción (segundo en paralelo → 409; ya `capturada` → respuesta idempotente), `captureId` guardado apenas cobra, montos en centavos enteros (`Math.round(n*100)`),
  pagos por concepto con id determinista `orderId_caseId_concepto` escritos en UN batch junto con el estado `capturada` (`createConceptPayment` en `payments.js` ahora acepta `paymentId` y `batch`).
  Cobrado pero registro falla (o caso sin línea principal) → `captura_sin_registrar` + `console.error` con orderId/captureId (sin secretos); reintentar `/capturar` lo completa sin recobrar.
  Monto/moneda/orderId distinto o captura PENDING DESPUÉS de cobrar → `captura_discrepante` (NO se libera: crear-orden queda bloqueado para no abrir otra orden encima del dinero cobrado; el 409 ya no devuelve el cuerpo del proveedor).
- **`services/payments/paypal.js`**: `fetchJson` con `AbortSignal.timeout` (15 s, `PAYPAL_TIMEOUT_MS`) en TODOS los fetch (incluido OAuth y la lectura del cuerpo), 2xx con JSON inválido → error claro (204 vacío → {}), `approveUrl` solo `https://*.paypal.com`
  (si falla al crear una suscripción, esa suscripción se cancela, no queda huérfana), `captureOrder` 422 ORDER_ALREADY_CAPTURED → `getOrder` y sigue, `cancelSubscription` 422 SUBSCRIPTION_STATUS_INVALID = éxito solo si PayPal dice CANCELLED/EXPIRED (APPROVAL_PENDING sigue siendo error).
  `mock.js`: guarda el monto con 2 decimales como PayPal (0.30, no 0.30000000000000004) y `getOrder` trae `captureId`.
- **`routes/subscription.js` + `empresarial.js`**: subscribe y `/empresarial/aceptar` reservan 'pendiente' en `runTransaction` antes de llamar al proveedor (revierten si falla; si el proveedor creó la suscripción pero Firestore no la guardó, se cancela en el proveedor y se loguea); doble clic → 409.
  `/cancel` idempotente: ya cancelada → 200 `{estado:'cancelada', yaEstaba:true}` (antes 400). `utils/http_error.js` (nuevo): `HttpError` + `responderError`; los errores del proveedor (con `.status`) salen al cliente como 502 genérico y se loguean completos.
- **Pruebas**: `tracker/tests/pagos_atomicos_tarea38.test.js` (16, casos/cotizaciones/usuarios PROPIOS creados en before; enganchada en `run_permission_tests.sh`): 16/16 con el fix.
  Contra una copia del tracker con la lógica PREVIA de quotes.js/subscription.js: 8 de 16 fallan (crear-orden reutiliza/paralelo, capturar en paralelo, 0.1+0.2, discrepante, total 0, captura_sin_registrar, subscribe en paralelo, cancel ya cancelada);
  "reintento tras capturar" ya era idempotente y pasa en ambos; `empresarial/aceptar` paralelo y los 6 de paypal.js (fetch stubbeado) no distinguen porque la copia previa mantuvo esos archivos nuevos — su fallo "sin fix" no se midió.
- **Regresión**: backend sin regresiones (permissions 86, planes_landing 20, xss 46, etc.); único rojo `pagos_paypal_tarea33` (17/19) = el acoplamiento de estado ya anotado para T42
  (otras pruebas ya suscribieron org-beta y engrosaron la cotización borrador compartida → 409 al suscribir y pagos ×3). Playwright en instancia limpia: pago_paypal 2/2, plan_empresarial 1/1 (este spec sigue siendo intermitente por una carrera del propio spec: `dispatchEvent` clickea el nav oculto antes de que el módulo cargue el rol; T42).
- **Revisiones**: ponytail-review (nada que recortar). ecc:silent-failure-hunter y ecc:security-reviewer: 0 CRITICAL; los HIGH aplicables a este diff se corrigieron (mismatch tras cobrar sin rastro, captureId sin catch, caso sin línea principal saltado en silencio, suscripción huérfana, cancelar APPROVAL_PENDING como éxito, getProvider fuera del try, e.message del proveedor al cliente, approveUrl a cualquier https, total 0).
- **NO hecho / decisiones para Rick-PM**:
  1. `services/payments/index.js` cae a **mock en silencio** si falta una variable de PayPal; en producción eso daría pagos "cobrados" sin dinero y abriría el gate de fase_05. No lo cambié (hoy producción no tiene credenciales y no hay deploy de pagos): decidir si en Cloud Run (`K_SERVICE`) sin credenciales debe fallar cerrado.
  2. Una `pendiente` CON `subscriptionId` (APPROVAL_PENDING real) se puede volver a suscribir y se pisa (queda huérfana en PayPal); resolverlo necesita probar contra el sandbox real (cancelar una pendiente no siempre es posible).
  3. Escrituras de liberación/marca sin token de dueño (una reserva vencida de la solicitud A puede pisar el resultado de la B); header `PayPal-Request-Id`; cuadrar la suma de conceptos contra lo cobrado (los `conceptos` pueden diferir del `monto` por ajustes manuales); `createConceptPayment` convierte NaN en 0; `/cancel` sin transacción. Todo LOW/MEDIUM de baja probabilidad.

## 2026-10-04 — TAREA 39: autenticación y acceso (C4 + H1-H5, H8)

Sin commit/push. Demo viva (no se tocó; sigue con el código anterior hasta que Rick la reinicie — ver "ANTES DE DESPLEGAR/REINICIAR"). Instancia aislada (9198/8190/9298, 8070, 8093).
- **1 · `routes/invitations.js` accept**: `requireAuth`; el uid sale de `req.user.uid` (el `uid` del body se ignora); correo de la sesión == correo de la invitación (normalizado: trim/minúsculas) o 403;
  la invitación se consume en `runTransaction` ANTES de los claims (accept doble en paralelo → 200 + 409); claims FUSIONADOS (conserva `origen` y demás; la invitación reemplaza `role`/`orgId`/`admin`);
  `emailVerified` se marca antes que los claims y, si falla algo, `used` se devuelve (el último paso, el que da el rol, es el irreversible). Front: `api.acceptInvitation(token)` y `aceptar-invitacion.html` ya no mandan uid (la sesión sale de `register()`).
- **2 · `middleware/permissions.js`**: `effectiveRole` → `null` sin `role` ni `admin` (el fallback `admin:true`→admin se mantiene); `requirePermission` responde 403 "no tiene un rol asignado"; `/api/me/permissions` da `role:null, permissions:[]`.
  Verificado: registro (`role:'cliente_titular'`), invitación y `seed_roles.js`/`bootstrap_admin.js` siempre dejan role. **Quedan sin role**: la cuenta legacy `cliente@farmazed.test` de `seed_emulador.js` (`{}`) y toda cuenta real anterior a E3 → `e2e/run.sh` y `demo_local.sh` ahora corren `migrate_roles.js` tras sembrar.
- **3 · `getCaseOrFail`** único en `middleware/permissions.js` (documents/messages/payments/cases dejaron sus copias/bloques inline) y el PATCH de revisión de documentos ahora lo llama (antes un staff NO asignado aprobaba/rechazaba documentos de cualquier caso). `GET /api/cases/:id` devuelve ahora también `id` dentro del cuerpo.
- **4 · `services/document_requests.js`** (nuevo): REST (`POST /documents/request`) y MCP (`farmazed_request_document`) comparten lógica y gate (`checkTransition` corre ANTES de escribir; antes el MCP escribía pending_docs sin gate, y también creaba documentos en casos inexistentes → ahora error).
- **5 · `utils/rate_limit.js`** (nuevo): un limitador (purga por ventana, tope de 50 000 IPs, IPv6 por /64, `reset()` para pruebas) usado por register, contact-leads y `/qr` (60/10 min; pasado el límite igual redirige, solo no registra). `app.set('trust proxy', TRUST_PROXY||1)` y `req.ip` (también en `/qr`).
- **6 · `register.js`**: si falla la empresa o los claims tras `createUser` → se borran usuario y empresa (el correo queda libre; 500 genérico).
- **7 · `middleware/auth.js` `requireMcpKey`**: `crypto.timingSafeEqual` sobre SHA-256 (igual largo).
- Docs: `generate_permissions_doc.js` y comentarios obsoletos de accept actualizados; `09_TABLA_PERMISOS.md` regenerada.
- **Pruebas**: `tracker/tests/auth_acceso_tarea39.test.js` (20, enganchada en `run_permission_tests.sh`) 20/20 con el fix; contra una copia del tracker con la lógica PREVIA: 10 de 20 fallan
  (accept sin sesión/otro correo/uid ajeno/paralelo/claims/normalizado, sin role, PATCH no asignado, MCP sin gate, XFF rotado). Las pruebas EN PROCESO (limitador, registro huérfano, requireMcpKey, effectiveRole) usan el código actual, no la copia previa, por eso "pasan" ahí.
  `e2e/aceptar_invitacion.spec.js` (nuevo) pasa 4/4 corridas. Backend sin regresiones (permissions 86, xss 46, atómicos 16, planes 20, registro 16, migration 5…; único rojo `pagos_paypal_tarea33` = coupling T42).
  Playwright (instancia limpia): registro, plan_empresarial, pago_paypal, xss_bandeja, xss_portal_cliente OK; `plan_consulta.spec` falló 2 veces en 9 intentos (un timeout de `load` al recargar y `#contact-leads-card` oculto) con load del host 30 — mismo patrón de flake de carga ya anotado para T42; no hay un baseline previo que lo descarte del todo.
- **Revisiones**: ponytail-review → recortes aplicados (`middleware()` del limitador y un export sin uso). ecc:security-reviewer: 0 CRITICAL; aplicado M1 (orden updateUser→claims), M2 (`TRUST_PROXY`), M3 (IPv6 /64 + tope), L3 (comentarios). Dos HIGH NO resueltos aquí (ver abajo).
- **ANTES DE DESPLEGAR / REINICIAR LA DEMO (decisión de Rick-PM)**:
  1. **Cuentas reales sin role quedarán con 403 en todo.** `scripts/migrate_roles.js` está limitado al EMULADOR (sale si no hay `FIRESTORE_EMULATOR_HOST`). Hace falta un camino para producción (script con credenciales GCP por línea de comandos, o flag `--prod --confirm`) y un `--dry-run` previo para listar cuentas sin role. NO corrí nada contra producción.
  2. La demo de Rick (tmux `farmazed-demo`) corre el tracker anterior; al reiniciarla con `demo_local.sh` ya migra solo, pero si se reinicia SOLO el tracker sobre el emulador ya sembrado, `cliente@farmazed.test` quedará sin role (403) hasta correr `migrate_roles.js` contra ese emulador.
  3. **El token de invitación sigue siendo un bearer** (revisor, HIGH): `GET /api/invitations/:token` es público y devuelve el correo, y cualquiera puede registrar una cuenta con ese correo sin verificarlo y aceptar si tiene el token; además accept fuerza `emailVerified:true`. El cambio pedido (uid del token + correo igual) cierra la sustitución de uid pero no eso. Diseño robusto: que accept (público) reciba `{password, displayName}` y cree el usuario con el correo de la invitación (nadie puede pre-registrarlo), enmascarar el correo en el GET público y bloquear en `register.js` los correos con invitación vigente. Queda para decidir.
  4. `trust proxy 1` es correcto con Cloud Run directo; si `api.farmazed.com` pasa por un LB/CDN extra, todos compartirían un bucket → `TRUST_PROXY=2` (o más). Verificar las cabeceras reales en el primer despliegue.
- No hecho (LOW): `MCP farmazed_update_case` sigue aceptando `override:true` (MCP_KEY es acceso admin; decidir si se quita); `register.js` sigue devolviendo 409 "Ya existe una cuenta" (enumeración de correos, ya existía); `formularios.js` tiene su propio `canAccessCase` (correcto, duplicado).

## 2026-10-04 — TAREA 39b: invitación sin squatting + camino de migración a producción

Sin commit/push. NO se corrió nada contra producción. Demo viva (200, no tocada). Instancia aislada (9198/8190/9298, 8070, 8093).
- **Accept con DOS caminos** (`routes/invitations.js`, `POST /:token/accept`; el enlace prueba la propiedad del buzón):
  · **Sin sesión** (no tiene cuenta): body `{password, displayName}` → el servidor CREA el usuario con el correo de la invitación, `emailVerified:true` y el rol/org de la invitación; consume el token en `runTransaction`; límite de 5 intentos/10 min por IP real (`utils/rate_limit.js`); responde 201 con el correo (para que el front inicie sesión).
  Si ya existe una cuenta con ese correo: **no verificada → se TOMA** (el enlace sí prueba el buzón: contraseña nueva, refresh tokens revocados, claims previos descartados — cierra el caso "el atacante registró el correo antes de la invitación"); **verificada → 409 `cuenta_existente`** (debe iniciar sesión).
  · **Con sesión** (ya tiene cuenta): camino de T39 (uid del token, correo igual) y ahora exige `email_verified:true` (403 claro si no).
  Reversión segura: `used` solo se devuelve si se pudo deshacer lo creado / el error es de los que garantizan "no se creó nada".
- **GET enmascarado** (`r***@dominio.com`, `lastIndexOf('@')`); `createInvitation` normaliza el correo (trim + minúsculas).
- **`register.js`**: correo con invitación vigente → 409. El mensaje es el MISMO que el de "ya existe una cuenta" (no sirve de oráculo de invitaciones).
- **Front** (`aceptar-invitacion.html`, `portal/js/api.js`): muestra el correo enmascarado; el formulario llama al accept público (`apiFetch({anonimo:true})`, no manda sesión) y luego `login()`; si responde `cuenta_existente` aparece "Ya tengo una cuenta" (login + accept con sesión). `<meta name="referrer" content="no-referrer">` (el token va en la URL).
- **`scripts/migrate_roles.js`**: `resolverModo()` (pura, probada): EMULADOR (AMBAS variables, Firestore y Auth) escribe salvo `--dry-run` (los scripts de prueba y la demo no cambian); PRODUCCIÓN exige `--prod` + `FIREBASE_PROJECT_ID`, es **dry-run por defecto** y escribe solo con `--prod --confirm`; `--confirm` sin `--prod`, `--prod` con un emulador y UN solo emulador definido son errores. Desviación consciente del pedido: en el emulador el default sigue siendo escribir (si no, se rompen `e2e/run.sh`, `demo_local.sh` y `run_permission_tests.sh`).
- **`DEPLOY.md`**: sección "ANTES de desplegar el tracker (TAREAS 39/39b) — paso previo OBLIGATORIO": comandos `--prod` (dry-run) → revisar → `--prod --confirm` (solo con visto bueno de Rick), `TRUST_PROXY` (default 1; 2+ si hay LB/CDN) y la nota de la demo local (B).
- **Pruebas**: `tracker/tests/invitacion_squat_tarea39b.test.js` (15, enganchada en `run_permission_tests.sh`) 15/15; contra el tracker de la T39 (sin 39b) fallan 10 de 15 (accept público ×6, squatter, cuenta verificada, GET sin máscara, register 409); los 3 de `migrate_roles` y 2 más pasan igual por ser en proceso/ya cubiertos.
  `auth_acceso_tarea39` (ajustada al nuevo camino) 20/20; registro_tarea32 16, xss 46, planes 20, permissions 86, atómicos 16 (corrida previa), migration 5. `e2e/aceptar_invitacion.spec.js` 2 tests (sin cuenta / "ya tengo una cuenta") 2/2 y registro.spec OK.
  (Una falla transitoria de `xss_tarea37` en una corrida intermedia fue colisión de IPs sintéticas entre archivos de prueba bajo el rate limit compartido; la prueba nueva usa ahora 192.0.2.x.)
- **Revisión** ponytail: nada que recortar. ecc:security-reviewer: 0 CRITICAL; aplicados H1 (modo emulador exige AMBAS variables), H2 (toma de cuenta no verificada), M2 (reversión), M3 (correo normalizado en createUser), M4 (mismo 409), L3 (máscara), no-referrer.
- **No hecho — decisiones para Rick/PM**:
  1. **Caducidad de invitaciones** (M1): hoy no caducan; un token filtrado = bearer permanente del rol (admin incluido). Propuesta: `expiresAt` 7 días (48 h para personal) validado con 410, + backfill de las existentes. El token sigue en la query (`?token=`): pasarlo al fragmento `#token=` evitaría logs/Referer.
  2. **Backfill de correos** de invitaciones ya existentes (guardadas sin normalizar) antes del deploy, para que el 409 de `register.js` las vea (M3).
  3. **`migrate_roles.js` no es reanudable** (M5): si falla entre claims y backfill de casos, el reintento salta a esa cuenta y sus casos quedan sin `orgId`; propuesta: id de org determinista + backfill de casos antes de los claims + exigir `--project=<id>` igual a `FIREBASE_PROJECT_ID`. Conviene hacerlo antes de correrlo en producción.
  4. Contraseña mínima de 6 también para personal/admin (L4); el límite por IP cuenta también los éxitos (L1).

## 2026-10-04 — TAREA 39c: cierre de invitaciones y migración

Sin commit/push. NO se corrió nada contra producción (ni dry-run: solo se probó el rechazo de argumentos). Demo viva 200.
- **Caducidad** (`routes/invitations.js`): toda invitación nueva lleva `expiresAt` = creación + 7 días (sin distinguir personal). Las viejas sin `expiresAt` = `createdAt + 7 d` en el código (sin backfill obligatorio); sin fechas o dato corrupto → falla CERRADO (caducada). 410 con mensaje claro en `GET /:token` y en accept (público y con sesión, dentro de la transacción); una invitación YA usada sigue dando `used:true`/409 aunque sea vieja; `devolverInvitacion` no toca `expiresAt` (no se puede "resucitar"). `register.js`: una invitación caducada ya no bloquea el registro de ese correo. Para reenviar, el admin crea otra invitación.
- **`scripts/backfill_invitaciones.js`** (nuevo): normaliza (trim + minúsculas) el correo de las invitaciones viejas; MISMOS modos que migrate_roles (`resolverModo` compartido): emulador escribe salvo `--dry-run`; producción exige `--prod --project=<id>`, dry-run por defecto, escribe solo con `--confirm`. No toca `expiresAt`. Idempotente, por lotes de 400.
- **`scripts/migrate_roles.js` reanudable**: empresa con id determinista `mig_<uid>` (`.create()`, ALREADY_EXISTS = ya la creó un corte anterior) → `orgId` en los casos (por lotes de 400) → claims LO ÚLTIMO; una cuenta solo "cuenta como migrada" cuando ya tiene role, así que volver a correr completa lo pendiente sin duplicar. Si la cuenta ya traía `orgId` en sus claims se respeta (no se le crea otra empresa). `--project=<id>` obligatorio con `--prod` (y debe coincidir con `FIREBASE_PROJECT_ID`/`GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT`; repetido = error). Refactor: `migrarCuentas({auth, db, admin, dryRun})` inyectable (así la prueba simula el corte) y `main` solo si es el script.
- **Password mínima 8** para cuentas NUEVAS (registro y accept público; `errorPassword` en `utils/validar_texto.js`, `minlength="8"` en `registro.html` y `aceptar-invitacion.html`); las cuentas existentes no se tocan (una con 6 sigue entrando — probado).
- **`DEPLOY.md`**: comandos con `--project`, backfill de correos, reanudable, caducidad (las invitaciones de más de 7 días darán 410) y mínimo de 8.
- **Pruebas**: `tracker/tests/caducidad_migracion_tarea39c.test.js` (15, enganchada en `run_permission_tests.sh`) 15/15; contra el tracker SIN la 39c fallan 11 de 14 de la corrida previa (caducidad nueva/vieja de 8 d/registro con caducada, password 7 ×2, migración ×3 y backfill/--project ×2; "vieja de 6 días vigente", "usada y vieja" y "cuenta existente con password corta" pasan igual por diseño). Migración interrumpida (fallo simulado al poner los claims de A) + re-corrida → A y B terminan idénticos, 1 empresa por cuenta, casos con orgId, 3.ª corrida = 0 migradas.
  Sin regresiones: 39b 15, 39 20, registro 16, xss 46, planes 20, permissions 86, migration 5; Playwright aceptar_invitacion 2/2, registro, plan_empresarial OK (corrida previa a los últimos ajustes; los ajustes solo tocaron scripts/expiración y se re-corrió el backend).
- **Revisión**: ponytail → quitado `expiresAt` del GET (nadie lo usaba) y código muerto. ecc:security-reviewer: 0 CRITICAL/0 HIGH; aplicados M1 (lotes), M2 (orgId previo), L1 (fail-closed), L3 (GCLOUD_PROJECT, `--project` repetido), L5.
- **No hecho (LOW)**: `.create()` adopta cualquier `orgs/mig_<uid>` existente sin comprobar `createdBy`; el log de `backfill_invitaciones` imprime correos completos (consola de admin); `invalid-uid` con `/` abortaría el script (improbable).

---

## 2026-10-04 — Mapa del código con graphify (orden de Rick vía Dandy)

**Cómo se generó.** `graphify` (extracción AST, determinista, 0 tokens de LLM)
sobre el **código propio**: `tracker/`, `farmazed-web/portal/js/`,
`farmazed-web/js/`, `e2e/` → 99 archivos, ~96 k palabras. Se excluyó a
propósito el resto del corpus (1385 archivos / 5,3 M palabras): plantillas
`farmazed-web/src/approx` y `src/wecare` (671 archivos de terceros), imágenes,
`References/` y documentos. Limitación: graphify no analiza el JS inline de
los `.html` (admin/portal); esas conexiones salen de la auditoría TAREA 36
(revisión `ecc:code-explorer`). Incluye el código en curso de la TAREA 40.

**Resultado:** 955 nodos · 1570 aristas · 67 comunidades · **0 ciclos de
import** · 95 % EXTRACTED / 5 % INFERRED. Salud del grafo: 26 aristas a
símbolos externos/no resueltos y 245 colapsadas (mismo par con `calls` +
`contains`, inocuas). Salidas en `graphify-out/` (sin trackear, **no
commitear**: agregar a `.gitignore`): `graph.html` (interactivo, abrir en el
navegador), `GRAPH_REPORT.md`, `graph.json`. Consultar con
`graphify query "<pregunta>"` desde la raíz del repo; actualizar con
`/graphify . --update`.

### Estructura por capas

```
NAVEGADOR
  farmazed-web/*.html (index, login, registro, verificar-correo, demo)
  farmazed-web/client-dashboard.html   ← portal VIVO del cliente
  farmazed-web/admin/*.html            ← back-office (bandeja, casos, cotizaciones,
                                          empresas, expediente, formularios, precios)
  portal/js: config.js (emulador vs prod por hostname) → auth.js (Firebase Auth,
             esc(), roles) → api.js (apiFetch → API_BASE) ; wizard.js, status_ui.js
        │  HTTPS + Bearer (ID token de Firebase)
        ▼
TRACKER (Express, tracker/index.js) — config.js valida entorno al arrancar (T40)
  middleware/auth.js         requireAuth, requireVerifiedLogin, requireMcpKey
  middleware/permissions.js  requirePermission, effectiveRole, canAccessCase,
                             getCaseOrFail (único desde T39)
  routes/  /api/cases (+ /documents /messages /payments /formularios)
           /api/quotes  /api/orgs  /api/me  /api/employees  /api/invitations
           /api/register  /api/contact-leads  /api/subscription  /api/empresarial
           /api/webhooks/paypal   /mcp (servidor MCP)   / (pricing, meta, qr, scans)
  services/ transitions.js (gates de fase: checkTransition) ;
            document_requests.js (REST y MCP comparten, T39) ; storage.js ;
            payments/{index,mock,paypal}.js (adaptador de proveedor)
  data/     case_status.js (13 fases / estados), faddi_checklists.js
  utils/    pricing_desglose.js, serialize.js, validar_texto.js (T37),
            rate_limit.js (T39), http_error.js, conceptos_fase05.js, pdf_pages.js
        │  firebase-admin SDK (el front NUNCA toca Firestore/Storage directo)
        ▼
FIREBASE: Auth · Firestore · Storage   (local: emuladores, proyecto demo-farmazed)
EXTERNOS: PayPal (orders + subscriptions + webhooks), Cloud Run
```

### Nodos centrales (lo que más se usa — tocar con cuidado)
`requirePermission()` (18 conexiones) · `requireAuth()` (17) ·
`serializeTimestamps()` (14) · `checkTransition()` (13) · `HttpError` (12) ·
`paypalFetch()` (11) · `portal/js/auth.js` (10). Cualquier cambio en estos
afecta a casi todas las rutas: exige correr la suite completa.

### Conexiones clave que muestra el grafo
- Las 13 fases viven en `data/case_status.js`; las consumen `services/transitions.js`
  (`checkTransition → isValidTransition`), `routes/mcp.js` (`handleUpdateCase →
  isValidStatus`) y `scripts/migrate_status.js`.
- `routes/mcp.js` lee los checklists (`getChecklist` de `data/faddi_checklists.js`).
- **Dependencia invertida aún abierta** (MEDIUM de TAREA 36, va en T41):
  `services/transitions.js:33-34` hace `require('../routes/payments')` y
  `require('../routes/quotes')`. No hay ciclo hoy, pero la lógica de negocio
  sigue colgada de los routers.
- Comunidades de baja cohesión (candidatas a ordenar, sin urgencia):
  `portal/js/wizard.js` + `auth.js` (0,05) y `data/faddi_checklists.js` (0,05).

### Mapa de pruebas (qué cubre qué)
| Área | Backend (`tracker/tests`) | e2e (`e2e/`) |
|---|---|---|
| Permisos / roles | permissions, auth_acceso_tarea39 | roles |
| Invitaciones / migración | invitacion_squat_tarea39b, caducidad_migracion_tarea39c, migration | aceptar_invitacion |
| Registro / leads | registro_tarea32, planes_landing_tarea34, xss_tarea37 | registro, plan_consulta, plan_empresarial, xss_bandeja, xss_portal_cliente |
| Pagos / PayPal | payment_concepts, pagos_paypal_tarea33, pagos_atomicos_tarea38 | payments, pago_paypal |
| Fases / gates | transition_gates | estados, flujo_completo |
| Checklist / formularios / IEA | checklist_tarea25/26/28, formularios_tarea28, paquete_iea | checklist, checklist_recibo_iea, formularios, paquete_iea |
| Cotizaciones / precios | precios_tarea28 | quotes, pricing |
| Config de arranque | config_tarea40 (en curso) | — |
| **Sin tests** | messages, employees, me, meta, storage, serialize | document_versions cubre versiones |

Pendientes ya planificados que el mapa confirma: T41 (sacar la lógica de
`routes/` a `services/`, `applyTransition()` único), T42 (tests faltantes,
renombrar `*_tareaNN`, estado compartido, `fzAuthPort` en specs).

## 2026-10-04 — TAREA 40: fallo cerrado y configuración de producción (C2 + config/reglas/CORS/errores)

Sin commit/push/deploy. NO se desplegaron reglas. Demo viva (200, no tocada). Instancia aislada (9198/8190/9298, 8070, 8093) — ahora con las reglas deny-all.
- **1 · Pagos** (`services/payments/index.js` + `tracker/config.js`): el mock SOLO con `FIRESTORE_EMULATOR_HOST` o `PAYMENTS_PROVIDER=mock`, y `PAYMENTS_PROVIDER=mock` en producción = error. Si no es mock y faltan `PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID` (o `PAYPAL_ENV` no es sandbox|live) el tracker NO arranca; ya no cae al mock. `getProvider()` aplica la misma regla en cada llamada.
- **2 · Config al arrancar** (`tracker/config.js`, un solo lugar, `index.js` sale con `process.exit(1)` y mensaje claro): modo EMULADOR (`FIRESTORE_EMULATOR_HOST`, debe ser localhost/127.0.0.1) o PRODUCCIÓN (`NODE_ENV=production`, normalizado, o `K_SERVICE` de Cloud Run); ni uno ni otro = se aborta (un tracker local con credenciales no puede escribir en prod por accidente); emulador+producción = error; `FIREBASE_PROJECT_ID` y `GCS_BUCKET` obligatorios (sin defaults 'farmazed'/'farmazed-docs' en `index.js`, `services/storage.js` —ahora perezoso—, `seed_pricing.js`, `bootstrap_admin.js`); producción: `MCP_KEY` >= 32; `TRUST_PROXY` entero >= 1 (default 1). Producción con `PAYPAL_ENV=sandbox` arranca con advertencia. `.env.example` al día (sin ADMIN_KEY/ALLOWED_ORIGINS/GCP_PROJECT_ID; con PayPal, PAYMENTS_PROVIDER, TRUST_PROXY, NODE_ENV). `tracker/Dockerfile`: `ENV NODE_ENV=production`.
- **3 · Reglas**: `firestore.rules` y `storage.rules` deny-all; `firebase.json` y `firebase.test-ports.json` apuntan a ellas. Verificado que ninguna prueba necesita reglas abiertas (ni backend —incluye subida de documentos— ni Playwright; el front no usa los SDK de Firestore/Storage) → se ELIMINARON `firestore.emulator.rules`/`storage.emulator.rules` y se actualizó `DEV_LOCAL.md`. NO se desplegó nada (`firebase deploy --only firestore:rules,storage` es decisión de Rick).
- **4 · CORS** (`origenPermitido` en config.js): producción solo `^https://([a-z0-9-]+\.)?farmazed\.com$`; localhost/127.0.0.1 con cualquier puerto solo fuera de producción.
- **5 · Errores**: interceptor en `index.js` — toda respuesta 500 con `error` sale con "Error interno del servidor…" y el detalle va a `console.error` con método, ruta y uid (el 500 deliberadamente informativo "cobrado sin registrar" de quotes.js se marca `res.locals.errorControlado`); handler global (JSON malformado → 400 genérico, resto 500 genérico); `unhandledRejection` se loguea, `uncaughtException` se loguea y sale con código 1. Los 4xx de negocio y el 502 genérico del proveedor de pagos no se tocan. MCP (HTTP 200 JSON-RPC): los errores INTERNOS (código numérico gRPC, auth/storage/app, o mensaje con rutas del proyecto) salen genéricos y los de negocio igual. Los 400 de `register`/`invitations` ya no devuelven `e.message` de Firebase Auth.
- **6 · `backfill_invitaciones.js`**: correos enmascarados en el log (`enmascararCorreo` ahora vive en `utils/validar_texto.js`).
- **Pruebas**: `tracker/tests/config_tarea40.test.js` (18, enganchada en `run_permission_tests.sh`) 18/18 con el fix; contra una copia con el `index.js`/`storage.js` de git HEAD fallan 9 de 18 (los 6 arranques inválidos, CORS en el servidor real y los dos 500). Backend completo sin regresiones (permissions 86, precios 4 [arreglado: storage perezoso], 39/39b/39c, xss, atómicos…; único rojo `pagos_paypal_tarea33` = coupling T42). Playwright con reglas deny-all: pago_paypal 2/2, plan_consulta 2/2, registro, aceptar_invitacion 2/2, xss ×2 OK; `plan_empresarial` pasó en una corrida y falló en otra (intermitente conocido, T42).
- **Revisiones**: ponytail → nada que recortar. ecc:security-reviewer: 0 CRITICAL; 2 HIGH: H1 (deploy: DEPLOY.md corregido con el orden seguro `--no-traffic`) y H2 (MCP, arreglado); aplicados M2/M3/M4/L1/L7/L8.
- **DECISIONES / RIESGOS DE DEPLOY (Rick)**:
  1. **El servicio Cloud Run actual probablemente NO tiene `FIREBASE_PROJECT_ID`, `GCS_BUCKET` ni las variables de PayPal** (usaba defaults y el mock): este código no arranca hasta que existan, y las de PayPal exigen que Rick cree la app en developer.paypal.com. Es un requisito duro; DEPLOY.md trae el orden (describir env → poner variables/secretos → desplegar `--no-traffic` → comprobar → pasar tráfico).
  2. Desplegar o no las reglas deny-all (confirmar antes en la consola que las de producción actuales son las esperadas).
  3. CORS con `credentials:true` acepta CUALQUIER subdominio de 1 nivel de farmazed.com; si hay subdominios abandonados conviene una lista explícita (`www`, `api`, `app`).
- No hecho (LOW): `unhandledRejection` solo registra (no sale); `backfill_invitaciones.js` conserva `demo-farmazed` como proyecto por defecto (solo emulador); ~40 `res.status(500).json({error:e.message})` siguen escribiendo el mensaje al log vía el interceptor en vez de `next(e)`.

## 2026-10-04 — TAREA 41: estructura y atomicidad del backend (H5 + estructura/validación)

Sin commit/push. Demo viva (200, no tocada). Refactor: la suite existente fue la red (primera corrida detectó 1 import colgado en `cases.js`, corregido).
- **1 · Rutas finas**: `services/payments_ledger.js` (nuevo: `hasConceptPayment`, `createConceptPayment`, constantes TIPOS_PAGO/AUTORIDADES/CONCEPTOS_CLIENTE/MONTOS_REFERENCIA) y `services/quotes.js` (nuevo: `resolverCategoriaPrecio`, `tarifarioDe`, `recomputeTotal`, `attachCaseToDraftQuote`, `hasAcceptedQuote`, `describeQuoteGate`, `getAcceptedQuoteLineForCase`). `services/transitions.js`, `routes/cases.js`, `routes/mcp.js` y `routes/quotes.js` ya no hacen `require('../routes/...')`; se quitaron TODOS los `router.xxx = ...` de payments/quotes. `precios_tarea28.test.js` importa de `services/quotes`. Sin ciclos de require.
- **2 · `applyTransition()`** (`services/transitions.js`): `runTransaction` que RELEE el caso, evalúa el gate (`checkTransition`) y la autorización por rol opcional (REST), y escribe `update` + `statusHistory` JUNTOS; después `afterTransition`. La usan `PATCH /api/cases/:id`, MCP `farmazed_update_case` y `services/document_requests.js` (pending_docs). Dos peticiones concurrentes: la segunda reintenta, ve el status nuevo (idéntica → noop, una sola entrada de historial; distinta → se evalúa contra el status real). `db` inyectable para simular fallos.
  **Error de `attachCaseToDraftQuote` (decisión)**: la transición ya está guardada, así que NO se devuelve 500 (el cliente reintentaría algo ya hecho). Se registra con `console.error`, se MARCA en el caso (`cotizacionBorradorError {mensaje, at}`, se limpia cuando una entrada posterior a fase_04 sí arma la línea), la respuesta REST/MCP trae `avisos`, y `admin/expediente.html` muestra un banner rojo y un aviso al guardar el estado. Caso sin `orgId` también da aviso (antes: silencio). La línea EXTRA de prioridad innovadores ya no tumba la principal (se agrega la principal y luego se avisa).
- **3 · Validación y precios**: `POST /api/cases/:id/payments`: monto finito y > 0 (Infinity/1e999/texto/'' → 400), fecha inválida → 400, TODO antes de subir a Storage; si falla el `set` se borra el blob; `uploadFile` borra el archivo si falla la URL firmada. `createConceptPayment` lanza si el monto no es un número finito >= 0 (adiós `Number(x)||0`). `tarifarioDe`: categoría `null` (ruta no tarifada) sigue en cero a propósito; fila de precio inexistente o sin componentes → error explícito ("Falta la fila de precio…") en vez de una cotización de $0.
- **4 · `createOrg()`** (`services/orgs.js`): register, invitations/titular, contact_leads/invitar y POST /api/orgs crean el mismo documento base (nombre con trim, createdAt, createdBy, + plan/pais/telefonoContacto solo si se pasan).
- **5 · CORS**: lista EXPLÍCITA, `CORS_ORIGINS` (coma) con default `https://farmazed.com` y `https://www.farmazed.com`, coincidencia exacta (adiós "cualquier subdominio"); localhost solo fuera de producción; validada al arrancar. `.env.example` y `DEPLOY.md` al día. **Ojo al desplegar**: si algún front se sirve desde otro origen (`*.web.app`, otro subdominio) hay que listarlo.
- **6 · `.gitignore`**: `graphify-out/` y `farmazed-web/demo.html`.
- **Pruebas**: `tracker/tests/estructura_tarea41.test.js` (14, enganchada en `run_permission_tests.sh`; usa Storage del emulador para comprobar que no queda blob): 14/14. Contra una copia con el flujo previo de PATCH/pagos/precio/createOrg fallan 4 de 12 (paralelo idéntico → 2 entradas de historial, aviso del borrador, pagos inválidos con blob huérfano/500, createOrg sin trim); las demás (atomicidad con `db` inyectado, `tarifarioDe`, `createConceptPayment`) ejercen el código actual en proceso y no discriminan contra esa copia. CORS sin `sub.farmazed.com` en `config_tarea40.test.js` (19/19).
  Suite backend completa sin regresiones (permissions 86, transition_gates 12, payment_concepts 6, precios 4, 37/38/39/39b/39c, xss 46, migration 5…; único rojo `pagos_paypal_tarea33` = coupling T42). Playwright: 10/10 en la corrida previa a los últimos ajustes; en la final 9/10 con `plan_empresarial` intermitente (conocido, T42).
- **Revisiones**: ponytail → imports revisados, nada que recortar. ecc:code-reviewer: APPROVE (0 CRITICAL/HIGH). ecc:silent-failure-hunter: 1 HIGH (el aviso/marcador no tenía consumidor → agregado banner + aviso en expediente) y varios MEDIUM: aplicados orden de `document_requests` (transición atómica ANTES de escribir el documento), limpieza del marcador con su propio catch, strictness de `createConceptPayment`, blob huérfano en `uploadFile`, aviso sin `orgId`, línea extra aislada, validación de `createOrg`, comentarios obsoletos, tests de noop/override/rol.
- **Deuda anotada (no hecha)**: `attachCaseToDraftQuote` sigue sin ser transaccional (dos casos de la misma empresa entrando a fase_04 a la vez pueden crear dos borradores o pisarse `lineas`; ya era así); los gates de `checkTransition` leen quotes/payments fuera de la transacción (comentado: solo se agregan); el marcador no se limpia si el admin repara la línea a mano sin reentrar a fase_04; `routes/quotes.js` captura PayPal sigue usando `|| 0` para conceptos ausentes; el aviso MCP va dentro del JSON del resultado (sin `isError`); no hay prueba de la carrera de `document_requests` (ya cerrada por el orden) ni del camino MCP de `handleUpdateCase`.

## 2026-10-04 — TAREA 41b (página admin "Configuración" con el mapa del código)

**Hecho**
- `tracker/scripts/actualizar_grafo.sh`: graphify solo AST (sin LLM) sobre tracker/, e2e/, farmazed-web/portal/js/, farmazed-web/js/ → `tracker/assets/code-graph.html` (versionado, ~780 KB; 983 nodos). Generado el 2026-10-04. Cuándo regenerar: DEV_LOCAL.md ("Mapa del código").
- `GET /api/admin/code-graph` (`tracker/routes/system.js`): requireAuth + permiso nuevo `system.code_graph` (solo admin; en `permissions.js` y `organizacion/09_TABLA_PERMISOS.md`). 404 claro si falta el archivo; `Cache-Control: private, no-store`; `Last-Modified` = fecha de generación.
- `farmazed-web/admin/configuracion.html` (solo admin; el resto redirige a su bandeja/portal): pide el HTML con token y lo muestra en `<iframe sandbox="allow-scripts" csp=…>` (sin allow-same-origin → no ve el token). "Abrir en pestaña nueva" abre una envoltura blob con el mismo iframe sandbox (una URL blob directa heredaría el origen). Enlace "Configuración" solo visible para admin en casos/bandeja/cotizaciones/formularios/empresas. `api.getCodeGraph()` en api.js.
- El grafo NO está en `farmazed-web/` (lo comprueba un test).
- Pruebas: `tracker/tests/code_graph_tarea41b.test.js` (9/9: 401, 403 para 5 roles, admin 200, 404, no-estático) enganchado en `run_permission_tests.sh`; `e2e/configuracion.spec.js` (2/2: admin ve el grafo en el iframe, aislamiento SecurityError, popup; analista sin enlace y redirigido). Regresión: permissions 86, config_tarea40 19, estructura_tarea41 14, auth_acceso_tarea39 20, xss_bandeja y registro e2e OK.

**Reviewers**: ponytail-review: nada que recortar. ecc:security-reviewer: 0 CRITICAL/HIGH; sin colisión en /api/admin, sin fuga en el grafo (sin rutas locales ni secretos), aislamiento correcto. Aplicado: CSP del iframe (`default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline'; img-src data:`, bloquea exfiltración por fetch) y guarda de fecha inválida.

**No hecho / deuda**
- M1: el HTML del grafo carga vis-network de unpkg (versión fija + SRI); sin red el mapa sale en blanco. Vendorizarlo (inline en el script) eliminaría la dependencia y permitiría CSP sin unpkg.
- L3: `c.label` del grafo entra por innerHTML sin esc(); hoy son "Community N". Si alguien nombra comunidades con `graphify label` (LLM), parchear. Contenido por el sandbox.
- Comunidades como "Community N" (nombrarlas requiere LLM).
- `.dockerignore` del tracker no excluye `assets/`: el archivo viaja en la imagen y solo se sirve por la ruta protegida (necesario para que funcione en prod).
- `requireAuth` usa verifyIdToken sin checkRevoked (previo; un admin degradado conserva acceso hasta 1 h). Candidato a T42.
- Sin commit/push/deploy.

## 2026-10-04 — TAREA 42: Tests (H9)

Sin commit/push/deploy. La demo (tmux `farmazed-demo`) se reinició antes (paso 1) y siguió viva (8081/8092 → 200) durante todas las corridas de esta tarea.

**Hecho**
- **Entorno aislado compartido** `tracker/scripts/entorno_aislado.sh` (lo cargan `run_permission_tests.sh` y `e2e/run.sh`): emuladores en los puertos de `firebase.test-ports.json` (9198/8190/9298), tracker/estático en el primer libre desde 8070/8093. **Se quitó el `pkill` por patrón** (mataba la demo): al salir solo detiene el grupo de procesos que arrancó y espera a que se liberen los puertos; si un puerto de prueba está ocupado avisa y sale sin matar nada. `verificar_local.sh` = e2e + backend, ambos aislados.
- **Backend completo en `run_permission_tests.sh`**: corre TODO `tracker/tests/*.test.js` (glob; `permissions` primero, `migration` al final tras migrar) con el mismo entorno, resumen por suite y falla si una suite corre 0 pruebas. `npm test` en `tracker/package.json`. Una suite nueva se engancha sola.
- **Estado compartido**: `tests/_fixtures.js` (titular/usuario/caso propios con ids únicos por corrida) y `tests/_ip.js` (IP sintética única por proceso y llamada: el rate limit por IP de register/contact-leads es compartido por todas las suites y se pisaba — causa del `xss` intermitente). `pagos_paypal` ahora crea empresa, titular, caso y cotización propios (y titular propio para suscripción): ya no depende de las semillas ni del orden.
- **Renombres** (archivos y `describe`, sin "TAREA NN"; referencias en .sh/DEV_LOCAL actualizadas; el handover histórico NO se reescribió):

| antes | ahora |
|---|---|
| pagos_paypal_tarea33 | pagos_paypal |
| registro_tarea32 | registro_captacion |
| planes_landing_tarea34 | planes_y_leads |
| checklist_tarea25 | checklist_base |
| checklist_tarea26 | checklist_via_categoria |
| checklist_tarea28 | checklist_vacuna (no `checklist_formularios`: es Vacuna=Biológicos) |
| formularios_tarea28 | formularios |
| precios_tarea28 | precios |
| xss_tarea37 | xss |
| auth_acceso_tarea39 | auth_acceso |
| invitacion_squat_tarea39b | invitacion_squat |
| caducidad_migracion_tarea39c | caducidad_migracion |
| pagos_atomicos_tarea38 | pagos_atomicos |
| config_tarea40 | config |
| estructura_tarea41 | estructura |
| code_graph_tarea41b | code_graph |

- **Huecos cubiertos** (suites nuevas): `acceso_basico` (25: 401 sin token/Basic/Bearer vacío/no-JWT/JWT `alg:none` en 23 rutas de todos los routers; cuenta del registro abierto sin verificar → 403 en pagos, orgs, quotes, documents, subscription, cases, con control positivo al verificarla; mensajes: empresa ajena 403, solo campos públicos, topes; employees solo admin; el cliente no mueve el estado ni con `override`/mass-assignment) y `paypal_contrato` (8, en proceso: webhook con firma inválida → 400 sin efectos con proveedor stubbeado y con el adaptador real sobre `fetch` stubbeado, proveedor caído ≠ 200, contrato de `createOrder`/`captureOrder`).
- **Hallazgos reales que salieron al escribir las pruebas (arreglados)**:
  1. **El cliente recibía `notes` (notas internas) y `faddi` en `GET /api/cases` y `/:id`** → `sinCamposInternos()` en `routes/cases.js` (solo para roles cliente; admin/staff las siguen viendo; prueba con control positivo).
  2. **Desde T40 la descarga directa de documentos fallaba en local** (reglas de Storage deny-all + URL del emulador sin token → también en la demo): `services/storage.js` pone `firebaseStorageDownloadTokens` al subir y lo añade a la URL, SOLO en modo emulador (producción sigue con URLs firmadas). Lo cubre `e2e/document_versions.spec.js` ("Ver archivo" descarga el archivo viejo).
- **e2e**: `playwright.config.js` fija `fzApiPort`/`fzAuthPort` para TODOS los specs (`storageState`), así los 11 specs corren en puertos aislados (ya no chocan con la demo). Login con el esperador armado antes del click, `waitUntil:'commit'` y tolerancia a `ERR_ABORTED` centralizada (`e2e/_esperas.js: enviarLogin`); `waitForTimeout` (10) → esperas a condición (`guardarEstado` espera PATCH + relectura, `esperarAnimaciones`, `esperarQueNadaSeEjecute`); `plan_empresarial`/`plan_consulta` esperan `window.__fzMyRole` (la carrera del rol). Esos 11 specs llevaban sin correr desde T32/T39 y estaban rotos por el producto, no por la infraestructura: overlay de captación (T32) → `global-setup.js` deja las empresas sembradas con captación completa y asigna el `orgId` de `cliente@` a los casos fixture (T39); correo enmascarado en la invitación (T39b) en `roles.spec`; `flujo_completo`/`roles` completan la captación de la empresa nueva (invitación); `paquete_iea` crea el titular verificado por Admin SDK (`e2e/_cuentas.js`) en vez del `register()` viejo; `estados` con timeout de 120 s (recorrido largo).

**Resultados**
- Backend completo (23 suites, ~420 pruebas): verde en **6 corridas** (2 seguidas tras el último cambio de código). Antes de arreglar las IPs, 1 de 3 corridas fallaba en `xss` (429 por IP compartida).
- Playwright: **31/31** con la demo viva. `--repeat-each=3` sobre los idempotentes (checklist, configuracion, formularios, paquete_iea, plan_empresarial, plan_consulta, pricing, roles, xss_portal_cliente): 56/57; el fallo es `plan_empresarial` en `#done-msg` tras el registro (causa probable, no confirmada con log: el rate limit REAL de `/api/register`, 5 por IP cada 10 min — 3 specs × 3 repeticiones registran >5 cuentas desde 127.0.0.1).
- **No repetibles con `--repeat-each` (por diseño actual)**: `pago_paypal` (2), `payments`, `quotes`, `estados`, `document_versions` y `checklist_recibo_iea` (avanzan/acumulan el estado de casos sembrados una sola vez en `global-setup`), `registro`, `aceptar_invitacion` y `xss_bandeja` (textos/correos fijos → duplicados en la 2.ª repetición). `flujo_completo` pasa 2 de 3. Hacerlos repetibles = que cada spec cree sus propios casos (como ya hace el backend): trabajo aparte, no hecho.

**Revisiones**: ponytail-review: se quitó el re-export `ipUnica` de `_fixtures` (sin uso); resto sin recortes (`entorno_aislado.sh` reemplaza ~150 líneas duplicadas en dos runners). ecc:pr-test-analyzer: 0 CRITICAL; aplicado: `faddi` + control positivo en la prueba de notas, mass-assignment/override desde cliente, `esperarAnimaciones` ignora las infinitas, `relectura` sin rechazo suelto, `esperarQueNadaSeEjecute` espera imágenes, "0 pruebas = fallo", proveedor caído en el webhook, `employees` sin umbral frágil.

**No hecho / pendiente**
- Pruebas de `GET /api/cases/:id/history` (¿el cliente ve `override`/`reason` internos?), de `POST /api/cases` (devuelve `notes:''`/`faddi:{}` vacíos, sin fuga de contenido) y de `PATCH` respondiendo sin `notes`/`faddi`: no cubiertas.
- Contrato de OAuth (`Basic base64`, renovación por `expires_in`) y `PayPal-Request-Id` (paypal.js no manda idempotency key: un reintento podría duplicar la orden) — para T43/decisión.
- El webhook sigue sin efectos reales (H7, decisión de Rick): la prueba de "sin efectos" es débil hasta que lo tenga.
- El grafo del código se regeneró (nombres nuevos).

## 2026-10-04 — TAREA 43: Limpieza y deuda

Sin commit/push/deploy; demo viva (8081 → 200 al final). `npm test` verde 2 corridas seguidas (23 suites) + e2e 31/31 con la demo viva; tras el último retoque (clave de orden) se re-corrieron pagos_paypal, pagos_atomicos y estructura: verdes.

**A. Seguridad**
- `cases.js`: `sinCamposInternos` también en POST y PATCH; `GET /:id/history` al cliente solo devuelve `{id, from, to, at}` (sin `reason`, `override`, `by`, `byEmail`). Pruebas en `acceso_basico` (con control positivo: el admin ve todo).
- `paypal.js`: cabecera `PayPal-Request-Id`: `createOrder` (clave `order-<cotización>-<centavos>-<hora>`), `captureOrder` (`capture-<orderId>`, estable), `createSubscription` (`sub-<empresa>-<plan>-<hora>`, `claveSuscripcion` en subscription.js; sirve a subscription y empresarial). Por hora a propósito: un reintento inmediato no duplica, pero una orden caducada o una re-suscripción tras cancelar no quedan pegadas a la respuesta vieja (revisión). Sin `requestId` no se manda cabecera. `createPlan` sin clave (acción rara de admin). Pruebas en `paypal_contrato` (+5): cabeceras, OAuth (`Basic base64(id:secret)`, `grant_type`, form-urlencoded, token reutilizado, renovación por `expires_in`).
- `requireAuth`: `verifyIdToken(token, true)` (checkRevoked). Prueba en `auth_acceso`: tras `revokeRefreshTokens` el token viejo da 401 y uno nuevo entra. Coste: una consulta a Auth por petición. MCP no usa tokens de usuario.

**B. Integridad**: `armarBorrador` (borrador de cotización) en una transacción con la consulta dentro: 4 casos de la misma empresa saliendo de fase_03 en paralelo dejan UN borrador con las 4 líneas (prueba en `estructura`). Los gates de `checkTransition` (cotización aceptada, pagos por concepto) leen con la `t` de `applyTransition`.

**C. Limpieza (sin cambio de comportamiento)**
- Quitado de `package.json`: `express-validator`, `uuid` (→ `crypto.randomUUID` en payments.js/ledger; imports sin uso fuera de cases/documents), `@google-cloud/firestore` (index.js usa `admin.firestore.Timestamp`), `nodemon` (`dev` = `node --watch`). Lockfile actualizado y `npm prune`.
- `initBackoffice()` en `portal/js/auth.js` (login verificado + acceso de back-office + nombre + logout + enlaces solo-admin): usado por casos, bandeja, cotizaciones, formularios, empresas, expediente y configuracion (imports sin uso podados). `precios.html` tiene navbar propia y no se tocó en eso.
- `precios.html` sobre `api.js` (`getPlan/savePlan/updatePricing`; muestra `err.message`/`body.error`, ya no "Error al guardar" genérico ni tabla vacía en silencio). `apiFetch` acepta `FormData` (no fuerza JSON): `uploadDocument` y `registerPayment` ahora son `apiFetch`.
- `serializeTimestamps` único (messages.js, mcp.js, index.js lo usan; adiós `?.toDate?.()?.toISOString()` a mano). `STAFF_EXIT_OWNER` eliminado (`canTransitionCase` = solo analista).
- Código muerto: quitados de `api.js` `createOrg`, `getQuote`, `deleteDocument` (sin consumidores en farmazed-web ni e2e). **Se dejaron las rutas** `POST /api/orgs`, `GET /api/quotes/:id`, `DELETE …/documents/:id`: las usan las pruebas de permisos/pagos y forman parte de la matriz de permisos.
- No quitado: `uuid` sigue en `node_modules` por dependencia transitiva de `@google-cloud/storage`.

**D. Grafo**: vis-network 9.1.6 vendorizado en `tracker/assets/vendor/` (SRI verificado igual al de unpkg) e inline en `code-graph.html` (`actualizar_grafo.sh` lo inserta y falla si queda `unpkg`); el HTML ya no tiene `<script src>` ni hosts externos (solo licencias en comentarios; prueba nueva en `code_graph`). CSP del iframe sin hosts: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`. Comunidades con nombre real y determinista (sin LLM): `tracker/scripts/nombrar_comunidades.py` → "subscription.js + empresarial.js · símbolo más conectado". HTML ~1.6 MB (era 0.8).

**Revisiones**: ecc:code-reviewer 0 CRITICAL/HIGH. MEDIUM 1 (initBackoffice exigiría correo verificado a admin/staff): revisado, falso — esas páginas ya usaban `requireVerifiedLogin`; no hay cambio. MEDIUM 2 (clave de orden sin hora) aplicado. LOW: clave de suscripción por hora es "mejor esfuerzo" (anotado); comentario viejo de STAFF_EXIT_OWNER en seed_roles.js (inocuo).

**No hecho**: webhook (espera decisión de Rick); `bootstrap_admin.js` no fuerza `emailVerified:true` (si el admin real no tiene el correo verificado, el front ya lo manda a verificar-correo, como antes); el HTML del grafo sigue mostrando `label` de comunidad por innerHTML sin `esc` (ahora son nombres de archivo/símbolo del propio repo, contenido por el sandbox).

## SUBIDA T30–T43 (04-oct, orden directa de Rick: "sube todo")
- Commit `09b15df` ("feat: plan T30-T43 …", 220 archivos, trailer Co-Authored-By) y push a origin/main (`bde53bb..09b15df`). Sin deploy.
- Verificado antes: `tracker/.env`, `graphify-out/` y `farmazed-web/demo.html` ignorados y fuera del commit; escaneo de patrones de secretos (claves, tokens, URLs con clave) sin hallazgos (`.env.example` solo con marcadores `<…>`).
- Entran los borrados de `firestore.emulator.rules`/`storage.emulator.rules` (sustituidos por `firestore.rules`/`storage.rules`, ver DEV_LOCAL.md).
- Aviso: GitHub indica que el repo se movió a https://github.com/commercialaffairs-lab/Farmazed.git; `origin` sigue apuntando a RichoX-Hub/Farmazed (redirige). No lo cambié.
- `git status` limpio.

## 2026-10-05 — Decisiones de Rick 1, 2 y 4 de PENDIENTES.md (webhook, una sola suscripción, precios.html)

Sin commit/push/deploy. Rick respondió las decisiones abiertas de la TAREA 36: (1) webhook = propuesta del PM; (2) "es una o la otra", con cambio de plan: la actual se cobra hasta terminar el ciclo y ese día rige la nueva; (3) tarifario viejo: esperar al deploy (no se tocó); (4) unificar y mejorar `admin/precios.html`.

**Webhook (H7)** — `services/paypal_webhook.js` (la ruta `routes/webhooks.js` queda fina):
- ACTIVATED → `activa`; CANCELLED/EXPIRED → `cancelada`; SUSPENDED → `suspendida`; PAYMENT.FAILED → `suscripcion.pagoFallidoEn` + revisión; CAPTURE.REFUNDED/DENIED → `quotes/{id}.pagoPaypal.incidencia` + revisión; CAPTURE.COMPLETED → `pagoPaypal.conciliadoEn` (o revisión si no hay pago registrado).
- Idempotencia: `paypal_eventos/{event.id}` se crea en la MISMA transacción que el efecto. Un evento sin `id` no se procesa (200, sin efectos).
- CAPTURE.COMPLETED que llega mientras `/pago/capturar` todavía registra (`creando|creada|capturando`) → 503 sin anotar el evento: PayPal reintenta y entonces concilia.
- Una suscripción `cancelada` no revive con un ACTIVATED atrasado. Un evento de una suscripción que no es la vigente de la empresa → revisión (CANCELLED/EXPIRED de una ajena se ignora).
- Errores: 500 genérico + `console.error` (ya no devuelve `e.message`).

**Pagos por revisar** — `services/revisiones_pago.js` + `routes/revisiones_pago.js` (`GET /api/admin/revisiones-pago`, `POST …/:id/resolver`), permiso nuevo `payments.review` (solo admin; `09_TABLA_PERMISOS.md` actualizado). Tarjeta en `admin/bandeja.html`; si la carga falla lo dice (no se oculta en silencio).

**Una sola suscripción + cambio de plan** — `services/suscripciones.js` (los helpers que colgaban de `routes/subscription.js` se movieron ahí: las rutas ya no se importan entre sí):
- `suscripcion.tipo` = `global|empresarial` (las viejas sin `tipo` se deducen por `planId`). Mismo tipo activo → 409.
- Con una activa del OTRO tipo: `getSubscription().nextBillingTime` → la nueva se crea con `start_time` en esa fecha y se guarda en `orgs/{id}.cambioDePlan`; la vigente no se toca. Al activarse (webhook; el mock, al instante) pasa a `suscripcion` con `rigeDesde` y `anterior.{tipo,subscriptionId,planId,vigenteHasta}`, y la anterior se cancela en el proveedor. Si esa cancelación falla → revisión `cambio-<subscriptionId>` (si no, cobraría doble).
- Antes, `POST /api/empresarial/aceptar` con el plan global activo PISABA la suscripción sin cancelarla en PayPal (doble cobro). Corregido por este flujo.
- `aceptar` admite también la propuesta `aceptada` si el Empresarial no está activo (aprobación abandonada, cancelada o vuelta al global).
- `POST /subscription/cancel` descarta también un `cambioDePlan` pendiente. Una `suspendida` que se reemplaza se cancela en el proveedor.
- Proveedor: `createSubscription({startTime})` y `getSubscription().nextBillingTime` en `paypal.js` y `mock.js`.
- Front (`client-dashboard.html`): tipo de plan, aviso "sigue vigente hasta el …", botón "Cambiar al plan de la plataforma", y **redirección a `approveUrl`** al suscribirse/aceptar (antes no se redirigía: con PayPal real el titular nunca habría llegado a aprobar).

**`admin/precios.html`** — mismo armazón que el resto del admin (sidebar, `initBackoffice`, Bootstrap), sin handlers inline. Plan de suscripción arriba; tarifario con buscador, filtro por grupo, barra honorarios/tasas, campos agrupados y aviso de cambios sin guardar. Se conservan los selectores de `e2e/pricing.spec.js` y `e2e/pago_paypal.spec.js`.

**Pruebas** — suite nueva `tests/webhook_paypal.test.js` (21). Backend completo: **24 suites en verde** (1 corrida), en un contenedor Docker (node 22 + Java 21 + emuladores) sobre una copia del repo, porque la PC de Rick no tiene Java.

**No hecho / pendiente**
- **e2e (Playwright) NO se corrió** tras estos cambios: correr `./verificar_local.sh` en Patch. Afecta sobre todo a `pricing`, `pago_paypal`, `plan_empresarial`.
- **Nada probado contra PayPal real**: `start_time`, `billing_info.next_billing_time` y el ACTIVATED de una suscripción con inicio futuro siguen la documentación, sin smoke-test en Sandbox.
- El mapa del código (`actualizar_grafo.sh`) no se regeneró con los archivos nuevos.
- `precios.html` no se revisó en un navegador (sin demo en esta máquina).
- Al dejar el Plan Empresarial la empresa conserva gestor de cuenta e informes: decisión 7 de `PENDIENTES.md`.
- Una suscripción `pendiente` que se reemplaza sin aprobar queda en PayPal (no se puede cancelar sin aprobar); si alguien la aprueba después, el webhook la manda a revisión.

## 2026-10-05 (tarde) — PayPal sandbox de punta a punta, demo en Docker y modales propios

Sin deploy. Trabajo hecho con Rick en su PC (Windows), que no tiene Java.

**Retorno desde PayPal (bloqueaba la prueba real)**
- `paypal.js`: `application_context.return_url/cancel_url` en órdenes (`PAY_NOW`) y suscripciones (`SUBSCRIBE_NOW`); `approveUrlSegura` acepta también `rel: payer-action`. Sin esto el cliente aprobaba en PayPal y nunca volvía: la orden no se capturaba.
- `services/payments/index.js: urlsDeRetorno()` (las arma el servidor, nunca el navegador) → `client-dashboard.html?paypal=pago&quote=<id>` (+ `token=<orderId>` que añade PayPal), `?paypal=suscripcion`, `?paypal=cancelado`. `config.js: portalUrl` (`PORTAL_URL`, default primer origen de CORS en prod / `http://localhost:8092` en local).
- `client-dashboard.html`: al cargar con `?paypal=pago` llama `capturarPago(quote, token)`, limpia la URL (`replaceState`) y abre Cotización.
- `demo_local.sh` lee SOLO `PAYMENTS_PROVIDER`/`PAYPAL_*` de `tracker/.env`; `FZ_TRACKER_PORT` fija el puerto inicial del tracker.

**Demo en Docker** — `demo_docker.sh` + `docker/demo.Dockerfile` (Node 22 + Java 21 + emuladores). Copia el repo al contenedor, pone los emuladores en `0.0.0.0`, publica 8092/9099/9199/4040 y el primer puerto libre desde 8080 para el tracker (en la PC de Rick es 8081: el 8080 lo usa un Python local). Detenido el contenedor viejo `farmazed-web` (copia del proyecto en el Escritorio) que ocupaba el 8092.

**Verificado con PayPal sandbox real** (cuenta Business "Farmazed", app sandbox, cuentas de prueba en PAYPAL_SETUP.md): cotización de `case-pago-paypal-test` → Pagar con PayPal → aprobación con la cuenta Personal sandbox → vuelta al portal → `pagoPaypal.estado = capturada` con `captureId`, pagos `honorarios`/`tasa_dnfd` registrados con `origen: paypal`. OAuth sandbox 200 desde el contenedor. Suscripciones y cambio de plan siguen sin prueba real (webhook no alcanzable).

**Modales propios** (pedido de Rick) — `farmazed-web/portal/js/dialogos.js`: `avisar`/`confirmar`/`preguntar` (promesas, misma semántica que alert/confirm/prompt; tipo info/éxito/error deducido del texto; foco atrapado, Escape, Enter; texto por `textContent`). 62 usos reemplazados en `admin/{bandeja,cotizaciones,empresas,expediente}.html` y `client-dashboard.html` (ahí también como globales para el script clásico). Bajo Playwright (`navigator.webdriver`) se auto-resuelven salvo `window.__fzDialogosReales`; `window.__fzRespuestaDialogo` responde los prompts. e2e ajustados: `plan_consulta` (valor del prompt + espera el PUT), `plan_empresarial` (espera el PUT), `quotes` (espera el PATCH rechazado). Probado en el navegador: render, Escape→null, Aceptar→valor, Cancelar→false, páginas sin errores de consola.

**precios.html**: grupos del tarifario 24-sep después de los fijos; grises de etiquetas a `#5f6b7a` (contraste AA).

**No hecho**: e2e NO corridos tras los cambios de hoy; sin `responderDialogo` helper en e2e (ninguna prueba verifica el modal real); el mapa del código no se regeneró.

## 2026-10-05 (noche) — Landing: sección "La Plataforma" y arreglos

Pedido de Rick: revisar el landing y mostrar la UI en móvil y PC "para que venda". Cambios en `farmazed-web/index.html` y `css/farmazed.css`:
- **Sección nueva `#plataforma`** (entre Metodología y Planes): copy de 4 beneficios + CTAs "Entrar al portal"/"Solicitar diagnóstico", y maquetas del portal del cliente en laptop y teléfono hechas en HTML/CSS (no capturas): se escriben a tamaño real (1000×600 y 360×640, texto ≥ 11px) y se escalan con `transform: scale(--fz-s)`, calculado por un `ResizeObserver` al ancho real de cada pantalla. Colores y componentes del portal (navy, azul, verde, badges, barra de 13 fases, fila de cotización, lista de documentos). Verificado en 1366 px y 390 px.
- **Menú**: "Inicio" apuntaba a `login.html` en los dos menús → `#inicio`; botón **Portal de clientes** (azul marino) al final del menú principal y en la barra superior; enlace "Plataforma".
- **Plan Registro**: mostraba **$0** (copiado del Plan Consulta) → "Por cotización". Cambio de texto comercial: confirmar con Rick.
- Quitado el icono de Google+ (red cerrada). Los demás sociales siguen en `#` (sin cuentas definidas).
- Etiquetas Open Graph (título, descripción, imagen H0.png, locale es_PA).
- Lección CSS: un ítem de grid con `margin: 0 auto` + `max-width` se encoge al contenido en una sola columna; hace falta `width: 100%`.

No tocado: las páginas internas (`nosotros`, `blog`, `testimonios`, `contacto`) existen y cargan el mismo CSS; no se revisaron a fondo.

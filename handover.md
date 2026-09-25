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

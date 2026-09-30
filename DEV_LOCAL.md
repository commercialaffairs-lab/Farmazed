# Dev local — tracker + frontend contra emuladores Firebase

Fase 0 del encargo de las 3 interfaces (PM_COMMENTS Parte H). Objetivo: correr todo en
Patch sin tocar producción. El proyecto de emulador es **`demo-farmazed`** — el prefijo
`demo-` hace que el SDK de Firebase corra en modo offline: es imposible que esto le
pegue a producción, aunque falten las env vars (a diferencia de solo confiar en que
alguien recuerde no pasar `--project farmazed`).

**Nunca correr `firebase deploy` desde este repo.** `firestore.emulator.rules` y
`storage.emulator.rules` son intencionalmente abiertas (`allow if true`) — sirven solo
para el emulador local. Por eso NO se llaman `firestore.rules`/`storage.rules` (los
nombres por defecto que `firebase deploy` sube solo): un despliegue accidental con esos
nombres por defecto abriría producción. `firebase.json` apunta explícitamente a los
nombres `.emulator.rules`.

## Prerrequisito: Java 21+ (una sola vez)

Los emuladores de Firestore necesitan un JDK 21+. Ya está instalado en este usuario en
`~/.local/jdk-21.0.12.1+1-jre` (Temurin, sin sudo) y `~/.bashrc` ya exporta `JAVA_HOME`
y lo agrega al `PATH`. Si es una sesión nueva de shell, basta con abrir una terminal
nueva (o `source ~/.bashrc`). Verificar con `java -version` → debe decir `21.x`.

## 1. Levantar los emuladores (Auth + Firestore + Storage)

Desde la raíz del repo (`Proyecto Farmazetd Regulatory/`, donde están `firebase.json`
y `.firebaserc`):

```bash
npx firebase-tools emulators:start --project demo-farmazed
```

Primera vez descarga los binarios del emulador (~1 min). Cuando esté listo:

| Servicio | Host:Port |
|---|---|
| Auth | `127.0.0.1:9099` |
| Firestore | `127.0.0.1:8090` |
| Storage | `127.0.0.1:9199` |
| UI del emulador | `http://127.0.0.1:4040` |

(Puerto de Firestore movido de 8080 → 8090 porque el tracker usa 8080. UI movida de
4000 → 4040 porque 4000 ya estaba ocupado en esta máquina.)

Dejar corriendo esta terminal. Los datos son en memoria — se pierden al cerrar el
emulador (no hay import/export configurado; si hace falta persistencia entre
reinicios, agregar `--export-on-exit` y `--import` a mano, no está hecho en Fase 0).

## 2. Seed de datos de prueba

En **otra terminal**, desde `tracker/`:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8090 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
STORAGE_EMULATOR_HOST=http://localhost:9199 \
FIREBASE_PROJECT_ID=demo-farmazed \
GCS_BUCKET=demo-farmazed.appspot.com \
node scripts/seed_emulador.js
```

Crea:
- **Admin:** `admin@farmazed.test` / `Farmazed123!` (contraseña de desarrollo local,
  solo existe en el emulador — no es un secreto real, no toca producción).
- **Cliente:** `cliente@farmazed.test` / `Farmazed123!`
- 3 casos del cliente en distintos estados (`draft`, `in_review`, `approved`), solo con
  trámites habilitados hoy (`medicamentos`, `cosmeticos` — ver
  `tracker/data/tramites_habilitados.js`).
- Las 13 categorías de precios (delega en `seed_pricing.js`, que ahora también respeta
  `FIREBASE_PROJECT_ID` para poder apuntar al emulador).

**Idempotente:** usa IDs fijos (`seed-admin-uid`, `seed-case-draft`, etc.) y `set()`, no
`add()`. Correrlo de nuevo sobrescribe los mismos documentos — no duplica. Verificado
corriéndolo dos veces seguidas.

**Guard:** si `FIRESTORE_EMULATOR_HOST` no está definido, el script se niega a correr
(`process.exit(1)`) — no hay forma de que este script toque Firestore real por
accidente.

## 3. Levantar el tracker (API) contra el emulador

Desde `tracker/`:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8090 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
STORAGE_EMULATOR_HOST=http://localhost:9199 \
FIREBASE_PROJECT_ID=demo-farmazed \
GCS_BUCKET=demo-farmazed.appspot.com \
ADMIN_KEY=dev-admin-local \
MCP_KEY=dev-mcp-local \
PORT=8080 \
PRICING_TABLE=24sep \
node index.js
```

`GET http://localhost:8080/health` debe dar `200`.

**`PRICING_TABLE=24sep`** (TAREA 23, ajuste del PM): activa el tarifario nuevo
del 24-sep (`resolverCategoriaPrecio()` en `tracker/routes/quotes.js`) — sin
esta variable (o con cualquier otro valor), usa el tarifario de siempre. Es
una decisión de NEGOCIO explícita, no algo atado al emulador — quítala si
quieres probar contra el tarifario viejo en local.

**Nota sobre el puerto 8080:** si ya hay algo corriendo ahí en tu máquina, usa otro
puerto (`PORT=8081` por ejemplo) y ajusta `API_BASE` en
`farmazed-web/portal/js/config.js` (rama `IS_LOCAL`) para que coincida. El código del
repo asume 8080 por convención (ya estaba así antes de esta tarea).

Sin ninguna de esas env vars, el tracker se comporta exactamente igual que en
producción (Firestore/Auth/Storage reales, proyecto `farmazed`) — nada de esto cambia
el default.

## 4. Servir el frontend

Desde la raíz del repo:

```bash
python3 -m http.server 8092 --directory farmazed-web
```

(Puerto 8092 porque ya está en la lista de orígenes permitidos por CORS en
`tracker/index.js`.) Abrir `http://localhost:8092/login.html`.

El frontend detecta `localhost`/`127.0.0.1` solo (`IS_LOCAL` en
`portal/js/config.js`) y en ese caso:
- Usa un `FIREBASE_CONFIG` con `projectId: "demo-farmazed"` (config de mentira, no la
  real de producción).
- Conecta el Auth SDK al emulador (`connectAuthEmulator`, en `portal/js/auth.js`).
- Apunta `API_BASE` a `http://localhost:8080`.

Fuera de `localhost`, todo el código de arriba usa exactamente las mismas rutas de
antes — cero cambio de comportamiento en producción.

**Nota:** el frontend nunca usa Firestore ni Storage del lado del cliente (todo pasa
por la API del tracker) — no hace falta `connectFirestoreEmulator` ni
`connectStorageEmulator` en el navegador, solo `connectAuthEmulator`.

## 5. Probar login

1. Ir a `http://localhost:8092/login.html`.
2. Login con `cliente@farmazed.test` / `Farmazed123!` → debe entrar a
   `client-dashboard.html` y ver los 3 casos seed.
3. Login con `admin@farmazed.test` / `Farmazed123!` → debe entrar a `dashboard.html`
   (el guard de `isAdmin()` lo detecta por el custom claim `admin: true` que pone el
   seed).

Verificado en esta sesión (sin navegador, simulando el mismo flujo con curl + el REST
API del Auth emulator para mintear tokens reales): login de ambos roles, `GET
/api/cases` filtra correctamente por cliente vs. admin, `GET /api/admin/pricing` 200
solo con claim admin, sin token → 401.

## Limitaciones conocidas de este setup (Fase 0, no bloqueantes)

- El emulador de Storage no soporta signed URLs reales (no hay service account local).
  `tracker/services/storage.js` lo detecta (`STORAGE_EMULATOR_HOST`) y devuelve la URL
  de descarga directa del propio emulador en su lugar — probado subiendo y descargando
  un archivo de prueba, funciona.
- El emulador de Firestore no exige los mismos índices compuestos que producción real
  — si el 500 de D02 (abajo) resulta ser un problema de índice en prod, este setup no
  puede reproducirlo por diseño.
- Sin import/export configurado — los datos del emulador desaparecen al reiniciarlo.
  Volver a correr `seed_emulador.js` cuando haga falta (es gratis, es idempotente).

## Hallazgo D02 — 500 en GET /api/cases/:id/documents: NO reproducido

Intentado en el emulador con: caso vacío (sin documentos), caso con 1 documento recién
subido, y caso inexistente (404 correcto, no 500). Los tres devuelven el código
esperado, sin error.

Revisando el código actual: **ningún flujo de UI activo llama hoy a este endpoint desde
el wizard**. `portal/js/wizard.js` (Paso 4, Carga Documental) llama a
`GET /api/cases/:id/checklist`, no a `/documents` (confirmado por `grep`). El único
call site de `/documents` en el frontend activo es `client-dashboard.html:1010`
(resumen de "Productos"), y está envuelto en `.catch(() => ({ documents: [] }))` — un
500 ahí no se ve como error en consola, se ve como lista vacía.

Esto es consistente con el hallazgo de la sesión 2026-08-26 (ver handover.md): el 500
original reportado por el PM probablemente vino de un `node_modules` corrupto de esa
sesión (ya arreglado), no de un bug en el endpoint. No se tocó código — D02 queda
documentado como "no reproducible con node_modules limpio + emulador", igual que en
agosto. D03 (arreglar el 500) no aplica mientras no se reproduzca.

## Pruebas E2E (Playwright) — `e2e/`

Recorridos reales en un Chromium headless contra el emulador (nunca contra prod).
Patch ya tiene el Chromium de Playwright cacheado en `~/.cache/ms-playwright` — no
descarga nada.

```bash
./e2e/run.sh                    # corre todos los specs de e2e/
./e2e/run.sh estados.spec.js    # corre uno solo
```

`e2e/run.sh` levanta emuladores + siembra datos + tracker + frontend estático, corre
Playwright, y apaga todo al salir (pase o falle el test) — es un solo comando, no hace
falta abrir terminales aparte como en el resto de este documento. Si el puerto 8080
está ocupado en esta máquina, usa el siguiente libre para el tracker y ajusta
`config.js` temporalmente, restaurándolo siempre al salir.

Capturas de pantalla de cada paso se guardan en `sessions/<fecha>/` (cada spec decide
su propia carpeta — ver la constante `SHOT_DIR` de cada archivo).

**Patrón para specs nuevos (ej. D16):** un archivo `e2e/<flujo>.spec.js` nuevo, usando
`global-setup.js` para dejar los datos en un estado conocido y las mismas convenciones
del primero (`estados.spec.js`): manejar `page.on('dialog', d => d.accept())` una vez
por test (la UI usa `alert()`/`confirm()` nativos), navegar directo a la página de
destino en vez de por el prototipo `dashboard.html`/`login.html` de la raíz cuando haga
falta velocidad, y guardar capturas numeradas por paso.

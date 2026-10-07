# Dev local — tracker + frontend contra emuladores Firebase

Fase 0 del encargo de las 3 interfaces (PM_COMMENTS Parte H). Objetivo: correr todo en
Patch sin tocar producción. El proyecto de emulador es **`demo-farmazed`** — el prefijo
`demo-` hace que el SDK de Firebase corra en modo offline: es imposible que esto le
pegue a producción, aunque falten las env vars (a diferencia de solo confiar en que
alguien recuerde no pasar `--project farmazed`).

**Reglas (TAREA 40):** `firestore.rules` y `storage.rules` son **deny-all** (`allow ...: if false`)
y sirven igual para producción y para los emuladores: el front no accede directo a Firestore/
Storage, todo va por el tracker (Admin SDK, que ignora las reglas) — verificado, ninguna prueba
(backend ni Playwright) necesita reglas abiertas. Antes había unas `*.emulator.rules` abiertas
(`allow if true`); se eliminaron para que no exista en el repo ningún archivo de reglas que
abra producción si alguien lo despliega. `firebase.json` y `firebase.test-ports.json` apuntan a
las deny-all. **No correr `firebase deploy` sin que Rick lo decida** (ver DEPLOY.md).

**El tracker solo arranca con los emuladores** (TAREA 40, `tracker/config.js`): hay que definir
`FIRESTORE_EMULATOR_HOST` (localhost/127.0.0.1), `FIREBASE_PROJECT_ID` y `GCS_BUCKET` (los scripts
`e2e/run.sh`, `demo_local.sh` y `run_permission_tests.sh` ya lo hacen). Sin emulador y sin
`NODE_ENV=production` se niega, para no escribir en producción por accidente.

## Mapa del código (página admin "Configuración")

`admin/configuracion.html` muestra un grafo interactivo del código (backend, pruebas y portal),
solo para el admin: lo sirve `GET /api/admin/code-graph` (permiso `system.code_graph`) desde
`tracker/assets/code-graph.html`, que SÍ se versiona — nunca se copia a `farmazed-web/` (todo
lo que está ahí se sirve sin auth y el grafo expone la estructura interna).

Regenerarlo con `./tracker/scripts/actualizar_grafo.sh` (necesita `graphify`: `pipx install
graphifyy`; solo AST, sin LLM ni API keys; ~20 s; las comunidades se nombran solas con `tracker/scripts/nombrar_comunidades.py`; vis-network va vendorizado e inline desde `tracker/assets/vendor/`, el HTML no carga nada de internet).
**Cuándo**: después de un cambio estructural (refactors, archivos o servicios nuevos/movidos,
rutas nuevas) y antes de un deploy que lo incluya; no hace falta por cada commit. El HTML trae
la fecha de generación (cabecera `Last-Modified`) y la página la muestra, así se ve si está viejo.

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

## Pruebas de backend — `tracker/tests/` (TAREA 42)

```bash
./tracker/scripts/run_permission_tests.sh                 # TODAS las suites + migración (≈4 min)
./tracker/scripts/run_permission_tests.sh pagos_paypal xss # solo algunas (nombre sin .test.js)
(cd tracker && npm test)                                  # igual que la primera
```

Una suite nueva se engancha sola: basta crear `tracker/tests/<tema>.test.js` (el script corre todo
el glob; `permissions` primero y `migration` al final, después de migrar las cuentas legacy). Cada
suite crea sus **propias** empresas, usuarios y casos con `tests/_fixtures.js` (ids únicos por
corrida): ninguna depende del estado que otra dejó en las semillas, el orden no importa.
Los nombres son de dominio (no `_tareaNN`); el historial por tarea sigue en `handover.md`.

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
falta abrir terminales aparte como en el resto de este documento. Corre en un entorno
aislado (puertos de prueba, ver "Pruebas con la demo viva" más abajo), así que se puede
lanzar con la demo viva; los puertos llegan al navegador por `localStorage`, nunca se edita
`config.js`. Acepta cualquier argumento de `playwright test` (`./e2e/run.sh --repeat-each=3`).

Capturas de pantalla de cada paso se guardan en `sessions/<fecha>/` (cada spec decide
su propia carpeta — ver la constante `SHOT_DIR` de cada archivo).

**Patrón para specs nuevos (ej. D16):** un archivo `e2e/<flujo>.spec.js` nuevo, usando
`global-setup.js` para dejar los datos en un estado conocido y las mismas convenciones
del primero (`estados.spec.js`): manejar `page.on('dialog', d => d.accept())` una vez
por test (la UI usa `alert()`/`confirm()` nativos), navegar directo a la página de
destino en vez de por el prototipo `dashboard.html`/`login.html` de la raíz cuando haga
falta velocidad, y guardar capturas numeradas por paso.

## Demo a mano para Rick (`demo_local.sh`, TAREA 30)

A diferencia de `e2e/run.sh` (que apaga todo al terminar las pruebas),
`demo_local.sh` deja todo levantado — emuladores, seed completo, tracker,
frontend — hasta que alguien lo corta con Ctrl-C. Pensado para que Rick
pruebe a mano desde el navegador, no para CI ni para Playwright.

```bash
./demo_local.sh
```

Arranca, en orden: emuladores (Auth/Firestore/Storage), `seed_emulador.js`
(admin@/cliente@ legacy + 3 casos), `seed_roles.js` (2 empresas + 1 usuario
por rol + los casos de TAREA 15-28), `seed_pricing_24sep.js` (ya lo llama
`seed_emulador.js` internamente; se repite explícito, es idempotente), el
tracker con `PRICING_TABLE=24sep`, y el frontend estático en `:8092`. Al
terminar imprime las URLs, los puertos a tunelear y la tabla de usuarios de
prueba.

**Puerto del tracker — nunca fijo.** En Patch el `:8080` casi siempre está
ocupado por un proceso ajeno (ver nota en `e2e/run.sh` y
`tracker/scripts/run_permission_tests.sh`), así que el script busca el
siguiente libre (reintenta hasta 3 veces por la carrera de puertos contra
ese proceso externo). Para que Rick pueda entrar con **una sola URL** sin
que le importe en qué puerto quedó el tracker esa vez, el script genera
`farmazed-web/demo.html` (no se commitea — `cleanup()` lo borra al salir):
fija `fzApiPort` en `localStorage` (el mismo mecanismo que ya usa
`e2e/run.sh`/`portal/js/config.js`) y redirige a `login.html`. Esa es la URL
que hay que abrir, no `login.html` directo.

**A dónde manda `login.html` según el rol (TAREA 30, ajuste del mismo día)**
— antes solo distinguía admin de "todo lo demás" y mandaba a los 3 roles de
staff al portal del cliente por error. Ahora:
- admin → `admin/casos.html` (el panel v2 real, con el sidebar de
  Expedientes/Bandeja/Cotizaciones/Formularios/Empresas).
- staff (analista/abogado/regente) → `admin/bandeja.html`.
- cliente (titular/miembro) → `client-dashboard.html`.

`dashboard.html` (raíz) **no es destino de ningún login** — es la
especificación de diseño del v2 (ver `CLAUDE.md`: no se borra, pero tampoco
está conectada a los flujos reales; sus links de "Ver expediente"/"Descargar
matriz" son literalmente `href="#"`). El cambio es solo en
`farmazed-web/login.html` (función `destinoSegunRol()`, usa `isAdmin()` e
`isStaff()` de `portal/js/auth.js`, ya existían) — como el frontend es
estático, se aplicó en caliente (recargar el navegador), sin reiniciar nada.
Se actualizó también la regex compartida de `login()` en los 11 specs de
`e2e/` (esperaban solo `dashboard|client-dashboard`, ahora también
`admin/casos|admin/bandeja`) — cada test ya navegaba explícito a su página
de destino después, así que el único efecto era que el `waitForURL` inicial
no iba a resolver nunca para admin/staff.

**Puertos a tunelear desde Argus (`ssh -L`) — 4, no 3:**
- `:8092` (frontend) y el puerto del tracker que imprima el script
  (`:8080` o el siguiente libre): obvio, son el front y la API.
- `:9099` (Auth emulator): `portal/js/auth.js` llama a
  `connectAuthEmulator('http://localhost:9099')` a mano, el navegador le
  habla directo.
- `:9199` (Storage emulator) — **ajuste del mismo día, lo encontró el PM**:
  en local, `tracker/services/storage.js` no firma URLs reales (el emulador
  no lo soporta) — devuelve la URL de descarga directa del propio emulador
  (`http://localhost:9199/v0/b/...`) como el `signedUrl` del documento. Los
  links de "Descargar" en el expediente apuntan ahí, y el navegador los
  sigue directo — sin tunelear este puerto, descargar un documento falla
  aunque todo lo demás funcione.
- `:8090` (Firestore) **no** hace falta — eso solo lo usa el tracker del
  lado del servidor, el navegador nunca le habla directo.

El propio script imprime el comando `ssh -L` completo con los puertos ya
resueltos de esa corrida — copiar y pegar esa línea (solo falta
`<usuario>@<ip-de-Patch>`).

**Verificado (3-oct):** `curl` a `/health` del tracker, a `/login.html` y
`/demo.html` del frontend, y a la raíz del Auth emulator — los 4 en `200`.
Login real contra el emulador (API REST de Identity Toolkit, sin pasar por
el navegador) para `admin-e3@farmazed.test`, `titular-alfa@farmazed.test` y
`analista@farmazed.test`: los 3 obtienen `idToken`, y `GET /api/cases` con
cada token filtra correcto (`admin`: 38 casos de ambas empresas;
`titular-alfa`: 27, solo `org-alfa`; `analista`: 28, `org-alfa` + casos sin
empresa — sin ver `org-beta`); sin token, `401`. Después del ajuste de
`login.html`, un script de Playwright aparte (navegador real, contra la
demo ya corriendo, sin reiniciarla) confirmó el destino de los 5 roles:
admin → `admin/casos.html`, analista/abogado/regente → `admin/bandeja.html`,
titular-alfa → `client-dashboard.html` — los 5 correctos.

## CORS del tracker en modo emulador — `localhost` vs `127.0.0.1` (TAREA 31)

Rick probó la demo desde Argus por túnel SSH y el login falló: el tracker
solo tenía `http://localhost:8092` en su allowlist de CORS (fijo, pensado
para correr siempre en esa máquina con ese puerto exacto) — con
`http://127.0.0.1:8092` (como le resolvió el túnel) o cualquier otro puerto,
el preflight no traía `Access-Control-Allow-Origin` y el navegador bloqueaba
todo. Confirmado con `curl -X OPTIONS ... -H "Origin: ..."` antes de tocar
nada.

**Arreglo (`tracker/index.js`):** el `origin` de `cors()` pasó de un array
fijo a una función. Fuera del emulador (sin `FIRESTORE_EMULATOR_HOST`),
**comportamiento idéntico a antes** — la misma allowlist de siempre
(`farmazed.com`, `*.farmazed.com`, `localhost:8092`, `localhost:3000`), nada
nuevo permitido en producción. **Solo con `FIRESTORE_EMULATOR_HOST`
definido** (es decir, siempre que esto corre contra el emulador — demo,
e2e, pruebas de permisos) se acepta cualquier `http://localhost:<puerto>` o
`http://127.0.0.1:<puerto>` — el puerto real del tracker/frontend varía
corrida a corrida en Patch, y Rick puede entrar por cualquiera de los dos
alias según cómo resuelva su túnel.

**Revisado también (todo limpio salvo un punto):**
- Los emuladores de Auth (`:9099`) y Storage (`:9199`) ya reflejan
  CUALQUIER origen en sus cabeceras CORS (verificado con `curl -X OPTIONS`
  contra ambos con `Origin: http://127.0.0.1:8092`) — no tenían el
  problema, es solo del tracker propio.
- `demo.html`/`login.html`: todas sus redirecciones (`location.replace`,
  `window.location.href`) usan rutas RELATIVAS (`/login.html`,
  `admin/casos.html`, etc.) — nunca se construye una URL con un host fijo,
  así que no "saltan" de `localhost` a `127.0.0.1` ni viceversa.
- **Sí había un salto real**: `portal/js/config.js` armaba `API_BASE` con
  `http://localhost:${puerto}` fijo, sin importar con qué alias se había
  cargado la propia página. Si la página corre en `127.0.0.1` pero pide la
  API en `localhost`, el navegador manda `Origin: http://127.0.0.1:...` (el
  de la página, no el del destino) — ahí es donde pegaba el bug de arriba.
  Arreglado para usar `window.location.hostname` (el mismo con el que se
  cargó la página), siempre dentro de `IS_LOCAL`.

**Reinicio en caliente:** solo se mató y relevantó el proceso del tracker
(mismo puerto, mismas env vars — ver PID/`environ` antes de matarlo, para
no adivinar la config) — los emuladores (con el seed completo adentro)
siguieron corriendo sin tocarlos.

**Verificado (3-oct, tras el restart):**
- `curl -X OPTIONS` con `Origin: http://localhost:8092` y con
  `Origin: http://127.0.0.1:8092`: ambos devuelven
  `Access-Control-Allow-Origin` correcto ahora. Un origen ajeno
  (`http://evil.example.com`) sigue sin cabecera — no se abrió nada de más.
- `GET /api/cases` con el token de admin sigue devolviendo los mismos 38
  casos de siempre — el seed no se perdió con el restart del tracker.
- Verificación lógica aparte (`node -e`, sin red) de la función de origen
  con 6 combinaciones (prod/emulador × puerto fijo/random/ajeno) — los 6
  resultados esperados.
- Login real con Playwright (navegador real, no REST) entrando por
  `http://127.0.0.1:8092/demo.html` (el caso exacto que falló): login de
  admin, aterriza en `admin/casos.html`, carga 38 filas de casos, sin
  errores de CORS en la consola del navegador. Repetido por
  `http://localhost:8092` (cliente titular-alfa) para confirmar que no hay
  regresión del caso original.

## Pruebas con la demo viva — entorno aislado (TAREA 42, reemplaza la receta manual de TAREA 32)

`e2e/run.sh`, `tracker/scripts/run_permission_tests.sh` y `verificar_local.sh` corren SIEMPRE
en un entorno aislado (`tracker/scripts/entorno_aislado.sh`): emuladores en los puertos de
prueba de `firebase.test-ports.json` (Auth `9198`, Firestore `8190`, Storage `9298`), tracker
en el primer puerto libre desde `8070` y frontend desde `8093`. La demo (`tmux farmazed-demo`:
`9099`/`8090`/`9199`/`8092`/tracker `8081`) puede seguir viva y no se toca: al salir, el script
detiene solo lo que arrancó (el grupo de procesos de los emuladores), sin `pkill` por nombre.
Si un puerto de prueba ya está ocupado (otra corrida viva) avisa y sale, no mata nada.

Los puertos llegan al navegador por `localStorage` (`fzApiPort`/`fzAuthPort`, ver
`portal/js/config.js`); `e2e/playwright.config.js` los fija una vez para todos los specs
(`storageState`), así ningún spec tiene que acordarse de ponerlos.


## Demo con correos reales (`FZ_AUTH=real`, 06-oct-2026)

Para probar el registro con cuentas de correo de verdad (verificación por correo) sin tocar
producción: Auth **real** del proyecto Firebase de pruebas `farmazed-pruebas` (creado por Rick
el 06-oct) + Firestore y Storage **emulados**. Los datos de la demo siguen en esta máquina; solo
las cuentas (correo, contraseña, claims de rol) viven en ese proyecto.

```
FZ_AUTH=real ./demo_docker.sh      # Windows con Docker (PC de Rick)
FZ_AUTH=real ./demo_local.sh       # Linux (Patch)
```

- Requiere credenciales de Google (ADC) de una cuenta con acceso a `farmazed-pruebas`
  (`gcloud auth application-default login`). `demo_docker.sh` las copia a
  `.tools/adc-farmazed-pruebas.json` (ignorado por git) con la cuota apuntando a ese proyecto,
  sin tocar el ADC global.
- `demo.html` deja `localStorage.fzAuthReal=1`; `portal/js/config.js` elige entonces
  `FIREBASE_CONFIG_PRUEBAS` y `auth.js` no conecta el emulador de Auth. Solo dentro de
  `IS_LOCAL`: producción nunca lo ve.
- El tracker corre sin `FIREBASE_AUTH_EMULATOR_HOST` y con `FIREBASE_PROJECT_ID=farmazed-pruebas`;
  `migrate_roles.js` admite esa mezcla solo con `FZ_AUTH=real` y un proyecto distinto de `farmazed`.
- Los seeds crean los usuarios de prueba (`admin-e3@farmazed.test`, etc.) en el proyecto real;
  esos correos no reciben nada, pero sirven para entrar. Para probar el correo de verificación:
  `demo.html` → "Crear cuenta" con un Gmail real → el correo llega desde
  `noreply@farmazed-pruebas.firebaseapp.com`.
- Limpieza: Firebase Console → Authentication → Usuarios (borrar los de prueba cuando se quiera).

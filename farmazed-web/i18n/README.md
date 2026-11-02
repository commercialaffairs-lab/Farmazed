# Idiomas de la interfaz (ES / EN / FR / PT)

Rick (01-nov-2026): la demo oficial (portal del cliente, back-office del regente, login) y los
manuales deben existir en los cuatro idiomas, **sin mezclas**. El español es la fuente; los demás
idiomas se traducen palabra por palabra desde él.

## Archivos

- `farmazed-web/portal/js/i18n.js` — la capa: `FZI18N.t()`, `aplicar()`, `cambiarIdioma()`,
  `onCambio()`, `fecha()`, `montarSelector()`. Script clásico en el `<head>` de cada página traducida.
- `farmazed-web/i18n/_partes/<area>.json` — **la fuente de las traducciones**, una por área:
  `{ "en": { "texto español": "traducción" }, "fr": {...}, "pt": {...} }`.
- `farmazed-web/i18n/{en,fr,pt}.json` — **generados** por `node tracker/scripts/i18n_fusionar.js`
  (`npm run i18n` en `tracker/`): fusión de todas las partes, ordenada. No se editan a mano.
  `tests/i18n.test.js` comprueba que estén al día y que ninguna clave usada falte en algún idioma.

## Convenciones de marcado

1. **Texto estático** en HTML: `data-i18n` en el elemento hoja que contiene el texto.
   ```html
   <h2 data-i18n>Mis Productos</h2>
   <button data-i18n>Guardar</button>
   ```
   Si el elemento mezcla texto e iconos o etiquetas (`<i class="bi …"></i> Guardar`), envuelve el
   texto: `<i class="bi …"></i> <span data-i18n>Guardar</span>`. Solo si no hay más remedio,
   `data-i18n-html` (la clave es el `innerHTML` exacto, recortado).
2. **Atributos**: `data-i18n-attr="placeholder,title,aria-label"` (los que tenga el elemento).
3. **Texto generado por JS**: `t('Texto en español')`. Con variables, marcadores entre llaves:
   `t('Paso {n} de {total}', { n, total })`. **Nunca** concatenar trozos traducidos
   (`t('Hay') + n + t('casos')` ✗) ni usar plantillas como clave (`` t(`…${x}…`) `` ✗): la clave debe
   ser un literal entre comillas para que la prueba de cobertura la encuentre.
   - En módulos ES y en scripts clásicos: `const { t } = window.FZI18N;` (ya existe al cargar).
4. **Etiquetas que llegan del tracker** (fase de un caso, estado, nombre de documento del checklist,
   concepto de la cotización, estado de un lead, tipo de trámite): también `t(etiqueta)`. Sus textos
   en español están en el diccionario (parte `datos.json`).
5. **Fechas**: `FZI18N.fecha(valor)` / `FZI18N.fechaHora(valor)` en vez de `toLocaleDateString('es-PA')`.
   Montos: se mantienen `B/.` y el formato actual.
6. **Repintar al cambiar de idioma**: lo marcado con `data-i18n` se vuelve a traducir solo; lo que
   la página generó por JS debe repintarse: `FZI18N.onCambio(() => repintarVistaActual())`.
7. **Clave = el español exacto** tal como está en el código, recortado (sin espacios a los lados),
   con su puntuación y mayúsculas. Misma clave en varios archivos → una sola traducción.

## Qué NO se traduce

Nombres propios y códigos: Farmazed, DNFD, IEA, MEF, PayPal, Rapid PayPro, FADDI, CRM, `B/.`,
códigos de expediente (`FZ-DEMO-2026-0002`), correos, nombres de empresas y productos de ejemplo
("Laboratorios Ejemplo S.A.", "Producto Ejemplo 2", "Farmacia Ejemplo"), valores técnicos (`draft`).

## Glosario (mantener en todo el sitio)

| es | en | fr | pt |
|---|---|---|---|
| registro sanitario | sanitary registration | enregistrement sanitaire | registo sanitário |
| trámite | procedure | procédure | processo |
| expediente | file | dossier | processo |
| caso | case | dossier | caso |
| regente | regent | régent | regente |
| cotización | quote | devis | orçamento |
| honorarios | fees | honoraires | honorários |
| tasa | fee | taxe | taxa |
| fase | phase | phase | fase |
| captación de información preliminar | preliminary information intake | collecte d'informations préliminaires | recolha de informação preliminar |
| documento / documentación | document / documentation | document / documentation | documento / documentação |
| cotejo técnico | technical check | vérification technique | verificação técnica |
| borrador | draft | brouillon | rascunho |
| Mi Bandeja | My Inbox | Ma corbeille | A minha caixa |
| Mis Productos | My Products | Mes produits | Os meus produtos |
| Solicitar Registro | Request Registration | Demander l'enregistrement | Pedir registo |
| Mi Empresa | My Company | Mon entreprise | A minha empresa |
| Mensajes | Messages | Messages | Mensagens |
| Reiniciar cuenta demo | Reset demo account | Réinitialiser le compte démo | Reiniciar conta demo |
| Ayuda | Help | Aide | Ajuda |
| Iniciar sesión / Cerrar sesión | Sign in / Sign out | Se connecter / Se déconnecter | Iniciar sessão / Terminar sessão |
| Guardar / Cancelar / Siguiente / Anterior | Save / Cancel / Next / Back | Enregistrer / Annuler / Suivant / Précédent | Guardar / Cancelar / Seguinte / Anterior |
| Aceptar / Rechazar | Accept / Reject | Accepter / Refuser | Aceitar / Rejeitar |
| Pagar con PayPal | Pay with PayPal | Payer avec PayPal | Pagar com PayPal |
| lead | lead | lead | lead |

Portugués europeo (registo, ecrã, palavra-passe), francés con espacio antes de `:` `;` `!` `?`
y comillas « », inglés estadounidense. Tratamiento: "tú" en español → "you"; en francés "vous";
en portugués tratamiento formal ("o seu", "a sua").

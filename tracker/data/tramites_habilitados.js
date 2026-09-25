/**
 * Trámites habilitados para ESCRITURAS NUEVAS (decisión F-6).
 *
 * Fuente de verdad única del backend: toda ruta que crea o modifica un caso
 * valida contra esta lista (routes/cases.js POST y PATCH, routes/mcp.js
 * farmazed_update_case). No repetir los nombres de los trámites cerrados en
 * ningún otro archivo.
 *
 * Cerrados: higienicos, plaguicidas, excepcion, publicidad. La clienta
 * (info@farmazed.com, correo del 12-sep) los dio de baja: sin matriz validada.
 * Es una línea de producto retirada, no una medida cautelar nuestra.
 *
 * REVERTIR = agregar el trámite a TRAMITES_HABILITADOS. Nada más.
 *
 * Alcance: solo escrituras nuevas. Los casos que ya existen en Firestore no se
 * tocan ni se borran, y las lecturas (checklist, contexto FADDI) siguen igual.
 * El front end tiene su propia copia del criterio (wizard.js, campo `disponible`).
 */
const { TRAMITE_TYPES } = require('./faddi_checklists');

const TRAMITES_HABILITADOS = ['medicamentos', 'cosmeticos'];

/**
 * Devuelve null si el trámite está habilitado; si no, el rechazo a enviar:
 *   { status, body: { error, code, tramiteType, habilitados } }
 * Lista blanca estricta: cualquier valor fuera de TRAMITES_HABILITADOS se
 * rechaza (mayúsculas, espacios, arrays, null), nunca cae al camino Regular.
 */
function rechazoTramite(tramiteType) {
  if (TRAMITES_HABILITADOS.includes(tramiteType)) return null;

  const habilitados = TRAMITES_HABILITADOS.join(', ');
  const conocido    = TRAMITE_TYPES.includes(tramiteType);
  return {
    status: conocido ? 422 : 400,
    body: {
      error: conocido
        ? `El trámite '${tramiteType}' no está habilitado. Trámites habilitados: ${habilitados}.`
        : `tramiteType must be one of: ${habilitados}`,
      code:        conocido ? 'TRAMITE_NO_HABILITADO' : 'TRAMITE_INVALIDO',
      tramiteType,
      habilitados: [...TRAMITES_HABILITADOS],
    },
  };
}

module.exports = { TRAMITES_HABILITADOS, rechazoTramite };

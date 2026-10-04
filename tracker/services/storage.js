const { Storage } = require('@google-cloud/storage');
const { randomUUID } = require('node:crypto');

// STORAGE_EMULATOR_HOST solo se define en dev local (ver DEV_LOCAL.md) — sin
// ella, el comportamiento es idéntico al de antes en prod.
const { obtenerConfig } = require('../config');

// TAREA 40: sin proyecto/bucket por defecto. Se crea PEREZOSAMENTE (en el primer uso,
// no al cargar el módulo): así quien solo importa las rutas (p. ej. una prueba unitaria
// sin entorno) no necesita configuración; el tracker real ya validó la suya al arrancar.
const EMULATOR_HOST = process.env.STORAGE_EMULATOR_HOST;
let _cache = null;
function gcs() {
  if (!_cache) {
    const config = obtenerConfig();
    const storage = new Storage({
      projectId: config.projectId,
      ...(EMULATOR_HOST ? { apiEndpoint: EMULATOR_HOST } : {}),
    });
    _cache = { BUCKET: config.bucket, bucket: storage.bucket(config.bucket) };
  }
  return _cache;
}

// El emulador de Storage de Firebase no implementa firma de URLs (no hay
// service account real localmente) — en dev local se devuelve la URL de
// descarga directa del propio emulador en su lugar. Las reglas son deny-all (TAREA 40): igual que
// en producción, solo entra quien trae el token de descarga del objeto (`firebaseStorageDownloadTokens`),
// que se pone al subir. Solo emulador: en producción las URLs siguen siendo firmadas.
function emulatorDownloadUrl(storagePath, token) {
  return `${EMULATOR_HOST}/v0/b/${gcs().BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

/**
 * Upload a file buffer to Cloud Storage.
 * Returns the GCS path (gs://...) and a 1-hour signed URL.
 */
async function uploadFile(caseId, docId, originalName, buffer, mimeType) {
  const ext      = originalName.split('.').pop();
  const gcsPath  = `cases/${caseId}/${docId}.${ext}`;
  const file     = gcs().bucket.file(gcsPath);

  const downloadToken = EMULATOR_HOST ? randomUUID() : null;
  await file.save(buffer, {
    metadata: { contentType: mimeType, ...(downloadToken ? { metadata: { firebaseStorageDownloadTokens: downloadToken } } : {}) },
    resumable: false,
  });

  let signedUrl;
  try {
    signedUrl = EMULATOR_HOST
      ? emulatorDownloadUrl(gcsPath, downloadToken)
      : (await file.getSignedUrl({
          action:  'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        }))[0];
  } catch (e) {
    // El archivo ya se guardó pero no se pudo firmar la URL: el llamador nunca recibe
    // `storagePath`, así que no podría borrarlo — se borra aquí para no dejarlo huérfano.
    await file.delete({ ignoreNotFound: true })
      .catch(err => console.error('[storage] no se pudo borrar el archivo huérfano', { gcsPath, error: err.message }));
    throw e;
  }

  return {
    gcsPath:    `gs://${gcs().BUCKET}/${gcsPath}`,
    signedUrl,
    storagePath: gcsPath,
  };
}

/**
 * Generate a fresh 1-hour signed URL for an existing GCS file.
 */
async function getSignedUrl(storagePath) {
  const file = gcs().bucket.file(storagePath);
  if (EMULATOR_HOST) {
    const [meta] = await file.getMetadata();
    return emulatorDownloadUrl(storagePath, meta.metadata?.firebaseStorageDownloadTokens);
  }
  const [url] = await file.getSignedUrl({
    action:  'read',
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}

/**
 * Delete a file from Cloud Storage.
 */
async function deleteFile(storagePath) {
  const file = gcs().bucket.file(storagePath);
  await file.delete({ ignoreNotFound: true });
}

module.exports = { uploadFile, getSignedUrl, deleteFile };

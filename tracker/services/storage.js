const { Storage } = require('@google-cloud/storage');
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../utils/http_error');

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

// TAREA 65: lista blanca de archivos que se pueden subir (documentos del expediente y comprobantes
// de pago). Nada de html ni svg (script ejecutable al abrirlos desde el dominio de Storage/URL firmada).
// La extensión es lo que se guarda en el nombre del objeto: solo [a-z0-9]{1,5} y dentro de esta lista.
const TIPOS_PERMITIDOS = {
  pdf:  ['application/pdf'],
  jpg:  ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], gif: ['image/gif'], webp: ['image/webp'],
  doc:  ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls:  ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt:  ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  odt:  ['application/vnd.oasis.opendocument.text'], ods: ['application/vnd.oasis.opendocument.spreadsheet'],
  zip:  ['application/zip', 'application/x-zip-compressed'],
};
const EXTENSION_VALIDA = /^[a-z0-9]{1,5}$/i;

/** Extensión saneada (minúsculas) del nombre original, o null si no es válida. */
function extensionSegura(nombre) {
  const partes = String(nombre || '').split('.');
  const ext = partes.length > 1 ? partes.pop() : '';
  return EXTENSION_VALIDA.test(ext) ? ext.toLowerCase() : null;
}

/** Texto del error si el archivo no está permitido; null si sí. Extensión Y tipo MIME deben coincidir con la lista. */
function archivoNoPermitido(nombre, mimeType) {
  const ext = extensionSegura(nombre);
  if (!ext || !TIPOS_PERMITIDOS[ext]) {
    return 'Tipo de archivo no permitido. Sube un PDF, una imagen (JPG, PNG, GIF, WEBP), un documento de Office (DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS) o un ZIP.';
  }
  if (!TIPOS_PERMITIDOS[ext].includes(String(mimeType || '').toLowerCase())) {
    return 'El tipo del archivo no coincide con su extensión.';
  }
  return null;
}

// Vista previa en el navegador SOLO para estos formatos (extensión saneada Y MIME guardado coinciden);
// todo lo demás (office, zip, gif…) se descarga como adjunto. Nunca html/svg: ni siquiera pasan la lista blanca.
const INLINE_PERMITIDO = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

/** 'inline' | 'attachment' para un objeto con esa extensión (o ruta/nombre) y ese MIME guardado. */
function disposicionPara(nombreORuta, mimeType) {
  const ext = extensionSegura(nombreORuta);
  return ext && INLINE_PERMITIDO[ext] && INLINE_PERMITIDO[ext] === String(mimeType || '').toLowerCase() ? 'inline' : 'attachment';
}

/**
 * Upload a file buffer to Cloud Storage.
 * Returns the GCS path (gs://...) and a 1-hour signed URL.
 */
async function uploadFile(caseId, docId, originalName, buffer, mimeType) {
  const malo = archivoNoPermitido(originalName, mimeType);
  if (malo) throw new HttpError(415, { error: malo });
  const ext      = extensionSegura(originalName);
  const disposicion = disposicionPara(originalName, mimeType);
  const gcsPath  = `cases/${caseId}/${docId}.${ext}`;
  const file     = gcs().bucket.file(gcsPath);

  const downloadToken = EMULATOR_HOST ? randomUUID() : null;
  await file.save(buffer, {
    metadata: { contentType: mimeType, contentDisposition: disposicion, ...(downloadToken ? { metadata: { firebaseStorageDownloadTokens: downloadToken } } : {}) },
    resumable: false,
  });

  let signedUrl;
  try {
    signedUrl = EMULATOR_HOST
      ? emulatorDownloadUrl(gcsPath, downloadToken)
      : (await file.getSignedUrl({
          action:  'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
          responseDisposition: disposicion,
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
async function getSignedUrl(storagePath, mimeType) {
  const file = gcs().bucket.file(storagePath);
  if (EMULATOR_HOST) {
    const [meta] = await file.getMetadata();
    return emulatorDownloadUrl(storagePath, meta.metadata?.firebaseStorageDownloadTokens);
  }
  const [url] = await file.getSignedUrl({
    action:  'read',
    expires: Date.now() + 60 * 60 * 1000,
    responseDisposition: disposicionPara(storagePath, mimeType),
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

/** Contenido de un objeto ya subido (p. ej. el PDF fiscal de una factura). @returns {Promise<Buffer>} */
async function downloadFile(storagePath) {
  const [contenido] = await gcs().bucket.file(storagePath).download();
  return contenido;
}

module.exports = { disposicionPara, archivoNoPermitido, extensionSegura, TIPOS_PERMITIDOS, uploadFile, getSignedUrl, deleteFile, downloadFile };

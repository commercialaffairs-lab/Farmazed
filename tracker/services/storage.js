const { Storage } = require('@google-cloud/storage');

// STORAGE_EMULATOR_HOST solo se define en dev local (ver DEV_LOCAL.md) — sin
// ella, el comportamiento es idéntico al de antes en prod.
const EMULATOR_HOST = process.env.STORAGE_EMULATOR_HOST;
const storage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID || 'farmazed',
  ...(EMULATOR_HOST ? { apiEndpoint: EMULATOR_HOST } : {}),
});
const BUCKET  = process.env.GCS_BUCKET || 'farmazed-docs';
const bucket  = storage.bucket(BUCKET);

// El emulador de Storage de Firebase no implementa firma de URLs (no hay
// service account real localmente) — en dev local se devuelve la URL de
// descarga directa del propio emulador en su lugar.
function emulatorDownloadUrl(storagePath) {
  return `${EMULATOR_HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

/**
 * Upload a file buffer to Cloud Storage.
 * Returns the GCS path (gs://...) and a 1-hour signed URL.
 */
async function uploadFile(caseId, docId, originalName, buffer, mimeType) {
  const ext      = originalName.split('.').pop();
  const gcsPath  = `cases/${caseId}/${docId}.${ext}`;
  const file     = bucket.file(gcsPath);

  await file.save(buffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  const signedUrl = EMULATOR_HOST
    ? emulatorDownloadUrl(gcsPath)
    : (await file.getSignedUrl({
        action:  'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      }))[0];

  return {
    gcsPath:    `gs://${BUCKET}/${gcsPath}`,
    signedUrl,
    storagePath: gcsPath,
  };
}

/**
 * Generate a fresh 1-hour signed URL for an existing GCS file.
 */
async function getSignedUrl(storagePath) {
  if (EMULATOR_HOST) return emulatorDownloadUrl(storagePath);
  const file = bucket.file(storagePath);
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
  const file = bucket.file(storagePath);
  await file.delete({ ignoreNotFound: true });
}

module.exports = { uploadFile, getSignedUrl, deleteFile };

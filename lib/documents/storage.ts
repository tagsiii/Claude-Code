import { db } from '../db/client';

export const DOCUMENTS_BUCKET = 'deal-documents';

// Store an original uploaded file in the private Supabase Storage bucket.
// Returns the storage path (used later for signed-URL download).
export async function storeFile(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

// Create a short-lived signed URL so the analyst can re-download the original file.
export async function getSignedUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteFile(path: string): Promise<void> {
  await db.storage.from(DOCUMENTS_BUCKET).remove([path]);
}

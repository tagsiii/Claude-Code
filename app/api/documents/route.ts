import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { classifyKind, isSupported, parseDocument } from '@/lib/documents/parse';
import { storeFile } from '@/lib/documents/storage';
import { createDocument, updateDocument, getDocuments, getDocumentBySha } from '@/lib/db/queries';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const documents = await getDocuments();
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const notes = (form?.get('notes') as string | null) ?? null;

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const filename = file.name || 'upload';
  const mime = file.type || 'application/octet-stream';

  if (!isSupported(filename, mime)) {
    return NextResponse.json(
      { error: `Unsupported file type. Upload Word, Excel, PDF, CSV, or text files.` },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 25 MB limit' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Dedupe identical uploads.
  const existing = await getDocumentBySha(sha256);
  if (existing) {
    return NextResponse.json({ document: existing, duplicate: true });
  }

  const kind = classifyKind(filename, mime);
  const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 120);
  const storagePath = `${crypto.randomUUID()}/${safeName}`;

  // Store the original file first so it is never lost, even if parsing fails.
  await storeFile(storagePath, buffer, mime);

  const doc = await createDocument({
    filename,
    mime_type: mime,
    byte_size: file.size,
    sha256,
    storage_path: storagePath,
    kind,
    status: 'parsing',
    notes,
    uploaded_by: session.user?.email ?? null,
  });

  try {
    const parsed = await parseDocument(buffer, filename, mime);
    await updateDocument(doc.id, {
      status: 'parsed',
      parsed_text: parsed.text,
      char_count: parsed.charCount,
      page_count: parsed.pageCount,
      kind: parsed.kind,
    });
    return NextResponse.json({
      document: { ...doc, status: 'parsed', char_count: parsed.charCount, page_count: parsed.pageCount },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateDocument(doc.id, { status: 'error', error_message: message });
    return NextResponse.json({ document: { ...doc, status: 'error', error_message: message }, error: message }, { status: 200 });
  }
}

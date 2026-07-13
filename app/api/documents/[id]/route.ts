import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocumentById, deleteDocument } from '@/lib/db/queries';
import { getSignedUrl, deleteFile } from '@/lib/documents/storage';
import { analyzeDocument } from '@/lib/pipeline/documentPipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

// GET → signed download URL for the original file.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await getDocumentById(params.id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = await getSignedUrl(doc.storage_path);
  if (!url) return NextResponse.json({ error: 'Could not create download link' }, { status: 500 });
  return NextResponse.json({ url });
}

// POST → run the document through the extraction/running-tab pipeline.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await analyzeDocument(params.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE → remove the record and the stored original file.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const doc = await getDocumentById(params.id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteFile(doc.storage_path).catch(() => {});
  await deleteDocument(params.id);
  return NextResponse.json({ ok: true });
}

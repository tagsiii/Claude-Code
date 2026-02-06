import { NextRequest, NextResponse } from 'next/server';
import { getAllConstraints, addConstraint, deleteConstraint } from '@/lib/store';
import { v4 as uuid } from 'uuid';

export async function GET() {
  const constraints = getAllConstraints();
  return NextResponse.json(constraints);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const constraint = addConstraint({ ...body, id: body.id || uuid() });
  return NextResponse.json(constraint, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  const deleted = deleteConstraint(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Constraint not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

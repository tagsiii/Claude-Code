import { NextResponse } from 'next/server';
import { getAllQualifications } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getAllQualifications());
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const graph = db.getGraphData();
  const fingerprints = db.getDeviceFingerprints();

  return NextResponse.json({
    status: 'success',
    data: {
      graph,
      fingerprints,
    },
  });
}

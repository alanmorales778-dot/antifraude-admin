import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const rooms = db.getWarRooms();
  return NextResponse.json({ status: 'success', data: rooms });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId, senderAlias, text } = body;

    if (!roomId || !senderAlias || !text) {
      return NextResponse.json({ error: 'Faltan datos de mensaje' }, { status: 400 });
    }

    const success = db.addWarRoomMessage(roomId, senderAlias, text);
    return NextResponse.json({ status: 'success', sent: success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

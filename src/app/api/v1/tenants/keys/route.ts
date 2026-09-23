import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id') || 'tenant-mp';

    const keys = await db.getApiKeysForTenant(tenantId);
    return NextResponse.json({ status: 'success', data: keys });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { tenant_id = 'tenant-mp', name = 'Nueva Clave API' } = body;

    const newKey = await db.generateApiKey(tenant_id, name);
    return NextResponse.json({
      status: 'success',
      message: 'Clave de API generada exitosamente. Guárdala en un lugar seguro.',
      data: newKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get('key_id');

    if (!keyId) {
      return NextResponse.json({ error: 'Se requiere key_id' }, { status: 400 });
    }

    const revoked = await db.revokeApiKey(keyId);
    if (!revoked) {
      return NextResponse.json({ error: 'No se puede revocar la clave primaria o la clave no existe' }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', message: 'Clave API revocada correctamente' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

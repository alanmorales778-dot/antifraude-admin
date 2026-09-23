import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, inQuarantine } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Se requiere tenantId' }, { status: 400 });
    }

    const updated = await db.setTenantQuarantine(tenantId, Boolean(inQuarantine));
    if (!updated) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      status: 'success',
      message: inQuarantine ? 'Tenant puesto en Cuarentena' : 'Tenant retirado de Cuarentena',
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

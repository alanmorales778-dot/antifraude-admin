import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId') || undefined;
  const webhooks = db.getWebhooks(tenantId);
  return NextResponse.json({ status: 'success', data: webhooks });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId = 'tenant-mp', url, events = ['SCORE_CRITICAL'] } = body;

    if (!url) return NextResponse.json({ error: 'Se requiere url' }, { status: 400 });

    const created = db.createWebhook({
      tenantId,
      url,
      events,
      secretKey: `whsec_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      status: 'ACTIVE',
      lastTriggeredAt: new Date().toISOString(),
    });

    return NextResponse.json({ status: 'success', data: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta webhook id' }, { status: 400 });

    const toggled = db.toggleWebhook(id);
    return NextResponse.json({ status: 'success', toggled });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

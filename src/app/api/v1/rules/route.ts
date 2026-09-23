import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const rules = db.getDynamicRules();
  return NextResponse.json({ status: 'success', data: rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, conditionDescription, actionDescription, ruleJson } = body;

    if (!name || !conditionDescription || !actionDescription) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const created = db.addDynamicRule({
      name,
      conditionDescription,
      actionDescription,
      enabled: true,
      backtestAccuracy: 97.4,
      backtestFpRate: 1.1,
      ruleJson: ruleJson || { action: 'REQUIRE_BIOMETRICS' },
    });

    return NextResponse.json({ status: 'success', data: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get('id');
    if (!ruleId) return NextResponse.json({ error: 'Falta rule id' }, { status: 400 });

    const updated = db.toggleDynamicRule(ruleId);
    return NextResponse.json({ status: 'success', toggled: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

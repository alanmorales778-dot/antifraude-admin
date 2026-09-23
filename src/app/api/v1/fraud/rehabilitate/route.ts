import { NextRequest, NextResponse } from 'next/server';
import { computeBlindHashSync } from '@/lib/crypto';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { IdentifierType } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let tenantId = 'tenant-mp';
    let tenantName = 'Mercado Pago Argentina';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.replace('Bearer ', '').trim();
      const tenant = await db.getTenantByApiKey(apiKey);
      if (tenant) {
        tenantId = tenant.id;
        tenantName = tenant.name;
      }
    }

    const body = await req.json().catch(() => ({}));
    const { identifier_type, identifier_value, reason } = body;

    if (!identifier_type || !identifier_value || !reason) {
      return NextResponse.json(
        {
          error: 'BAD_REQUEST',
          message: 'Se requieren identifier_type, identifier_value y motivo de rehabilitación (reason)',
        },
        { status: 400 }
      );
    }

    // 1. Calcular hash ciego
    const { blindHash } = computeBlindHashSync(identifier_type as IdentifierType, identifier_value);

    // 2. Ejecutar rehabilitación en la base del consorcio
    const updated = await db.rehabilitateEntity(blindHash, reason);

    if (!updated) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'No se encontró un registro previo de fraude para este identificador',
        },
        { status: 404 }
      );
    }

    // 3. Limpiar caché Redis
    await redis.del(`risk_eval:${blindHash}`);

    // 4. Registrar auditoría de corrección
    await db.logAudit({
      tenantId,
      tenantName,
      endpoint: '/api/v1/fraud/rehabilitate',
      identifierType: identifier_type as IdentifierType,
      blindHashPreview: `${blindHash.slice(0, 8)}...${blindHash.slice(-6)}`,
      latencyMs: 8,
      statusCode: 200,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      status: 'success',
      message: 'Falso positivo corregido. El puntaje de riesgo fue restablecido a nivel seguro en tiempo real.',
      data: {
        blind_hash: blindHash,
        rehabilitated: true,
        new_risk_score: updated.riskScore,
        rehabilitated_at: updated.rehabilitatedAt,
        justification: reason,
      },
    });
  } catch (error: any) {
    console.error('Error rehabilitating fraud entity:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: error.message },
      { status: 500 }
    );
  }
}

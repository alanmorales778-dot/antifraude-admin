import { NextRequest, NextResponse } from 'next/server';
import { computeBlindHashSync } from '@/lib/crypto';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { IdentifierType, FraudTypology } from '@/lib/types';

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
    const {
      identifier_type,
      identifier_value,
      reason,
      severity = 3,
      incident_date,
      non_pii_notes,
      tenant_id_override,
    } = body;

    if (!identifier_type || !identifier_value || !reason) {
      return NextResponse.json(
        {
          error: 'BAD_REQUEST',
          message: 'Se requieren identifier_type, identifier_value y reason',
        },
        { status: 400 }
      );
    }

    // Permitir override de tenant en modo demo interactivo
    if (tenant_id_override) {
      const customTenant = await db.getTenantById(tenant_id_override);
      if (customTenant) {
        tenantId = customTenant.id;
        tenantName = customTenant.name;
      }
    }

    // 1. Blind Hashing irreversible
    const { blindHash, normalized } = computeBlindHashSync(
      identifier_type as IdentifierType,
      identifier_value
    );

    // 2. Registrar evento e incrementar contador de entidades independientes
    const { entity, event } = await db.upsertFraudReport({
      blindHash,
      entityType: identifier_type as IdentifierType,
      tenantId,
      tenantName,
      reason: reason as FraudTypology,
      severity: Math.min(5, Math.max(1, Number(severity))),
      incidentDate: incident_date,
      nonPiiNotes: non_pii_notes,
    });

    // 3. Invalidar la caché Redis para que la próxima consulta lea el nuevo score inmediatamente
    await redis.del(`risk_eval:${blindHash}`);

    // 4. Log de auditoría
    await db.logAudit({
      tenantId,
      tenantName,
      endpoint: '/api/v1/fraud/report',
      identifierType: identifier_type as IdentifierType,
      blindHashPreview: `${blindHash.slice(0, 8)}...${blindHash.slice(-6)}`,
      latencyMs: 14,
      statusCode: 201,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json(
      {
        status: 'success',
        message: 'Fraude confirmado registrado exitosamente en la red del consorcio',
        data: {
          blind_hash: blindHash,
          event_id: event.id,
          updated_risk_score: entity.riskScore,
          distinct_institutions_count: entity.distinctTenantsCount,
          total_reports: entity.reportCount,
          normalized_preview: normalized.length > 4 ? `${normalized.slice(0, 3)}***` : '***',
          timestamp: event.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error reporting fraud:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: error.message },
      { status: 500 }
    );
  }
}

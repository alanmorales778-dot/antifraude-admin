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
    const { items, tenant_id_override } = body;

    if (tenant_id_override) {
      const customTenant = await db.getTenantById(tenant_id_override);
      if (customTenant) {
        tenantId = customTenant.id;
        tenantName = customTenant.name;
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Se requiere un arreglo "items" no vacío' },
        { status: 400 }
      );
    }

    if (items.length > 500) {
      return NextResponse.json(
        { error: 'PAYLOAD_TOO_LARGE', message: 'Máximo 500 reportes por lote' },
        { status: 413 }
      );
    }

    const startTime = performance.now();

    const results = await Promise.all(
      items.map(async (item: any, idx: number) => {
        try {
          const type = (item.identifier_type || item.type || 'EMAIL').toUpperCase() as IdentifierType;
          const value = item.identifier_value || item.value || '';
          const reason = (item.reason || 'OPERACION_SOSPECHOSA') as FraudTypology;
          const severity = Math.min(5, Math.max(1, Number(item.severity || 3)));

          if (!value) {
            return {
              index: idx,
              status: 'ERROR',
              error: 'Identificador no provisto',
            };
          }

          const { blindHash } = computeBlindHashSync(type, value);
          const { entity, event } = await db.upsertFraudReport({
            blindHash,
            entityType: type,
            tenantId,
            tenantName,
            reason,
            severity,
            nonPiiNotes: item.notes,
          });

          await redis.del(`risk_eval:${blindHash}`);

          return {
            index: idx,
            status: 'SUCCESS',
            blind_hash: blindHash,
            event_id: event.id,
            updated_score: entity.riskScore,
            distinct_institutions: entity.distinctTenantsCount,
          };
        } catch (err: any) {
          return {
            index: idx,
            status: 'ERROR',
            error: err.message,
          };
        }
      })
    );

    const totalElapsed = Math.round(performance.now() - startTime);

    return NextResponse.json({
      status: 'success',
      total_submitted: items.length,
      successful: results.filter(r => r.status === 'SUCCESS').length,
      failed: results.filter(r => r.status === 'ERROR').length,
      execution_time_ms: totalElapsed,
      data: results,
    });
  } catch (error: any) {
    console.error('Error in batch report:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: error.message },
      { status: 500 }
    );
  }
}

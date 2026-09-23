import { NextRequest, NextResponse } from 'next/server';
import { evaluateRisk } from '@/lib/risk-engine';
import { IdentifierType } from '@/lib/types';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let tenantId = 'tenant-mp';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.replace('Bearer ', '').trim();
      const tenant = await db.getTenantByApiKey(apiKey);
      if (tenant) tenantId = tenant.id;
    }

    const body = await req.json().catch(() => ({}));
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Se requiere un arreglo "items" no vacío' },
        { status: 400 }
      );
    }

    if (items.length > 500) {
      return NextResponse.json(
        { error: 'PAYLOAD_TOO_LARGE', message: 'Máximo 500 elementos por lote en modo síncrono' },
        { status: 413 }
      );
    }

    const startTime = performance.now();

    // Procesar elementos en paralelo con control de concurrencia
    const results = await Promise.all(
      items.map(async (item: any, idx: number) => {
        try {
          const type = (item.identifier_type || item.type || 'EMAIL').toUpperCase() as IdentifierType;
          const value = item.identifier_value || item.value || '';
          if (!value) {
            return {
              index: idx,
              id: item.id || `item-${idx}`,
              status: 'ERROR',
              error: 'Identificador vacío',
            };
          }

          const evalResult = await evaluateRisk(type, value, tenantId);
          return {
            index: idx,
            id: item.id || `item-${idx}`,
            status: 'SUCCESS',
            identifier_type: type,
            blind_hash: evalResult.blindHash,
            risk_score: evalResult.riskScore,
            risk_level: evalResult.riskLevel,
            recommendation: evalResult.recommendation,
            distinct_institutions: evalResult.distinctInstitutionsCount,
            network_matches: evalResult.networkMatches,
            rehabilitated: evalResult.rehabilitated,
          };
        } catch (err: any) {
          return {
            index: idx,
            id: item.id || `item-${idx}`,
            status: 'ERROR',
            error: err.message,
          };
        }
      })
    );

    const totalElapsed = Math.round(performance.now() - startTime);

    return NextResponse.json({
      status: 'success',
      total_processed: items.length,
      successful: results.filter(r => r.status === 'SUCCESS').length,
      failed: results.filter(r => r.status === 'ERROR').length,
      execution_time_ms: totalElapsed,
      average_per_item_ms: (totalElapsed / items.length).toFixed(2),
      data: results,
    });
  } catch (error: any) {
    console.error('Error in batch evaluate:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: error.message },
      { status: 500 }
    );
  }
}
